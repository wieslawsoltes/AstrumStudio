import { clone, diffScenes, applyOperations, Signal } from '../core/index.js';
export class ProjectClient {
    constructor(base = '/api') { this.base = base; this.status = new Signal; this.generation = 0; this.reset(); }
    reset() { this.generation++; this.project = null; this.baseScene = null; this.revision = 0; this.busy = false; this.requestToken = null; }
    async request(path, method = 'GET', body) { let r = await fetch(this.base + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); let data = await r.json(); if (!r.ok) {
        let error = Error(data.error || 'Request failed');
        error.status = r.status;
        error.data = data;
        throw error;
    } return data; }
    session() { return this.request('/session'); }
    list() { return this.request('/projects'); }
    async create(scene) { this.reset(); let generation = this.generation, snapshot = clone(scene), token = {}; this.busy = true; this.requestToken = token; try {
        let p = await this.request('/projects', 'POST', { scene: snapshot });
        if (generation !== this.generation)
            throw Error('Project changed while saving');
        this.project = p.id;
        this.revision = p.revision;
        this.baseScene = snapshot;
        return p;
    }
    finally {
        if (this.requestToken === token) {
            this.busy = false;
            this.requestToken = null;
        }
    } }
    async load(id) { this.reset(); let generation = this.generation, token = {}; this.busy = true; this.requestToken = token; try {
        let p = await this.request('/project?id=' + encodeURIComponent(id));
        if (generation !== this.generation)
            throw Error('Project changed while loading');
        this.project = id;
        this.revision = p.revision;
        this.baseScene = clone(p.scene);
        return p;
    }
    finally {
        if (this.requestToken === token) {
            this.busy = false;
            this.requestToken = null;
        }
    } }
    async save(scene) { if (this.busy)
        return false; if (!this.project)
        throw Error('Save the project first'); let generation = this.generation, id = this.project, token = {}, snapshot = clone(scene), ops = diffScenes(this.baseScene, snapshot); if (!ops.length)
        return true; this.busy = true; this.requestToken = token; try {
        this.status.emit('Saving');
        let r = await this.request('/project', 'PATCH', { id, revision: this.revision, ops });
        if (generation !== this.generation)
            return false;
        this.revision = r.revision;
        this.baseScene = snapshot;
        this.status.emit('Saved');
        return true;
    }
    catch (e) {
        if (generation !== this.generation)
            return false;
        this.status.emit(e.status === 409 ? 'Conflict — review changes' : 'Save failed');
        throw e;
    }
    finally {
        if (this.requestToken === token) {
            this.busy = false;
            this.requestToken = null;
        }
    } }
    async sync(local, canApply = () => true) { if (!this.project || this.busy)
        return null; let generation = this.generation, id = this.project, token = {}; this.busy = true; this.requestToken = token; try {
        let p = await this.request('/project?id=' + encodeURIComponent(id));
        if (generation !== this.generation || !canApply() || p.revision === this.revision)
            return null;
        let current = typeof local === 'function' ? local() : local, pending = diffScenes(this.baseScene, current), remote = diffScenes(this.baseScene, p.scene);
        let conflict = pending.some(a => remote.some(b => a.collection === b.collection && a.id === b.id));
        let merged;
        if (!conflict) {
            try {
                merged = applyOperations(p.scene, pending);
            }
            catch {
                conflict = true;
            }
        }
        if (conflict) {
            this.status.emit('Conflict — review changes');
            return { conflict: true, remote: p };
        }
        this.revision = p.revision;
        this.baseScene = clone(p.scene);
        return { scene: merged, hasPending: pending.length > 0 };
    }
    finally {
        if (this.requestToken === token) {
            this.busy = false;
            this.requestToken = null;
        }
    } }
    comments() { return this.request('/comments?id=' + encodeURIComponent(this.project)); }
    comment(text, objectId, frame) { return this.request('/comments', 'POST', { id: this.project, text, objectId, frame }); }
    members() { return this.request('/members?id=' + encodeURIComponent(this.project)); }
    invite(email, role = 'editor') { return this.request('/members', 'POST', { id: this.project, email, role }); }
    presence(selection) { return this.request('/members', 'PATCH', { id: this.project, selection }); }
    dispose() { this.reset(); clearInterval(this.pollTimer); }
}
