/** IndexedDB persistence for static deployments. No accounts or network sharing. */
import { ProjectClient } from './index.js';
import { clone, uid, validateScene, applyOperations } from '../core/index.js';

const identity = Object.freeze({ id: 'browser-local', email: 'local@astrum.browser' });
function fail(message, status = 400, data = {}) {
    const error = new Error(message);
    error.status = status;
    error.data = { error: message, ...data };
    throw error;
}

/** Pure transaction logic, also usable by other local database adapters. */
export function localOperation(record, path, method, body = {}) {
    if (path === '/projects' && method === 'POST') {
        validateScene(body.scene);
        const project = { id: uid(), owner: identity.id, name: body.scene.name,
            scene: clone(body.scene), revision: 1, updated_at: Date.now(), comments: [] };
        return { write: project, value: { id: project.id, revision: 1 } };
    }
    if (!record) fail('Project not found in this browser. Import an Astrum scene file to transfer it from another device.', 404);
    if (path === '/project' && method === 'GET') {
        return { value: { id: record.id, name: record.name, scene: clone(record.scene),
            revision: record.revision, role: 'owner' } };
    }
    if (path === '/project' && method === 'PATCH') {
        if (body.revision !== record.revision)
            fail('Another tab saved changes. Synchronize before saving.', 409, { revision: record.revision });
        if (!Array.isArray(body.ops) || body.ops.length > 6000) fail('Invalid operation batch');
        const scene = applyOperations(record.scene, body.ops);
        const next = { ...record, scene, name: scene.name, revision: record.revision + 1, updated_at: Date.now() };
        return { write: next, value: { revision: next.revision } };
    }
    if (path === '/project' && method === 'DELETE') return { remove: record.id, value: { ok: true } };
    if (path === '/comments' && method === 'GET')
        return { value: clone(record.comments.slice(-100).reverse()) };
    if (path === '/comments' && method === 'POST') {
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000)
            fail('Comment must contain 1–4000 characters');
        const comment = { id: uid(), project_id: record.id, author: identity.email,
            text: body.text.trim(), object_id: typeof body.objectId === 'string' ? body.objectId : null,
            frame: Number.isFinite(body.frame) ? body.frame : null, created_at: Date.now() };
        return { write: { ...record, comments: [...record.comments, comment] }, value: { ok: true } };
    }
    if (path === '/members' && method === 'PATCH') return { value: { ok: true, localOnly: true } };
    if (path === '/members') fail('Online collaboration requires the hosted server. GitHub Pages saves only in this browser.', 501);
    fail('Unsupported local operation', 405);
}

export class LocalProjectClient extends ProjectClient {
    constructor(databaseName = 'astrum-studio', factory = globalThis.indexedDB) {
        super();
        this.mode = 'local';
        this.databaseName = databaseName;
        this.factory = factory;
        this.database = null;
        this.closed = false;
    }
    openDatabase() {
        if (this.closed) return Promise.reject(new Error('Local project client is closed'));
        if (!this.factory) return Promise.reject(new Error('Browser storage is unavailable. Use File → Export Astrum scene to save your work.'));
        if (!this.database) {
            this.database = new Promise((resolve, reject) => {
                const request = this.factory.open(this.databaseName, 1);
                let failed = false;
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains('projects'))
                        request.result.createObjectStore('projects', { keyPath: 'id' });
                };
                request.onerror = () => { failed = true; this.database = null; reject(request.error); };
                request.onblocked = () => { failed = true; this.database = null; reject(new Error('Close other Astrum tabs to upgrade browser storage.')); };
                request.onsuccess = () => {
                    const db = request.result;
                    if (failed || this.closed) { db.close(); reject(new Error('Local project client is closed')); return; }
                    db.onversionchange = () => { db.close(); this.database = null; };
                    resolve(db);
                };
            });
        }
        return this.database;
    }
    async request(path, method = 'GET', body = {}) {
        if (this.closed) throw new Error('Local project client is closed');
        const url = new URL(path, 'https://astrum.local');
        if (url.pathname === '/session' && method === 'GET') return { ...identity, mode: 'local' };
        const db = await this.openDatabase();
        const snapshot = clone(body);
        return new Promise((resolve, reject) => {
            let result, problem;
            const tx = db.transaction('projects', method === 'GET' ? 'readonly' : 'readwrite');
            const store = tx.objectStore('projects');
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => { problem ||= tx.error; };
            tx.onabort = () => reject(problem || tx.error || new Error('Browser storage write failed. Export your scene as a backup.'));
            const list = url.pathname === '/projects' && method === 'GET';
            const create = url.pathname === '/projects' && method === 'POST';
            const run = record => {
                try {
                    if (list) {
                        result = record.sort((a, b) => b.updated_at - a.updated_at).slice(0, 100)
                            .map(({ id, name, revision, updated_at, owner }) => ({ id, name, revision, updated_at, owner }));
                        return;
                    }
                    const operation = localOperation(record, url.pathname, method, snapshot);
                    result = operation.value;
                    if (operation.write) store.put(operation.write);
                    if (operation.remove) store.delete(operation.remove);
                } catch (error) { problem = error; tx.abort(); }
            };
            // All reads and writes stay in one IndexedDB transaction. Cross-tab CAS is atomic.
            if (create) run(null);
            else {
                const id = method === 'GET' ? url.searchParams.get('id') : snapshot.id;
                const read = list ? store.getAll() : store.get(id || '');
                read.onsuccess = () => run(read.result);
            }
        });
    }
    dispose() {
        super.dispose();
        this.closed = true;
        this.database?.then(db => db.close()).catch(() => {});
        this.database = null;
    }
}
