/** Astrum scene engine: serializable scene graph, transactions, animation, procedural evaluation. */
export const VERSION = '0.1.0';
export const uid = () => globalThis.crypto.randomUUID();
export const clone = v => structuredClone(v);
export class Signal {
    #listeners = new Set();
    subscribe(fn) { this.#listeners.add(fn); return () => this.#listeners.delete(fn); }
    emit(value) { for (const fn of this.#listeners)
        fn(value); }
}
export const TYPES = ['cube', 'sphere', 'torus', 'cylinder', 'cone', 'capsule', 'plane', 'icosahedron', 'knot', 'group', 'cloner', 'light', 'camera', 'mesh'];
export function material(name = 'Porcelain', color = '#b9c9de', extra = {}) { return { id: uid(), name, color, metalness: 0.05, roughness: 0.3, ...extra }; }
export function object(type = 'cube', extra = {}) { if (!TYPES.includes(type))
    throw Error('Unknown object type'); return { id: uid(), name: type[0].toUpperCase() + type.slice(1), type, parent: null, visible: true, locked: false, position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1], params: { radius: 1, width: 2, height: 2, depth: 2, tube: 0.3, segments: 48, count: 12, mode: 'radial', spacing: 2.5, seed: 7, random: 0 }, material: null, modifiers: [], tracks: {}, ...extra }; }
export function emptyScene() { return { format: 'astrum', version: 1, id: uid(), name: 'Untitled scene', objects: [], materials: [material()], fps: 30, duration: 180, settings: { background: '#292d35', exposure: 1.05, grid: true, shadows: true } }; }
export function demoScene() { let s = emptyScene(); s.name = 'Orbital • Motion study'; s.materials = [material('Glacier', '#89c9ef', { metalness: .65, roughness: .22 }), material('Brushed platinum', '#bdc6d3', { metalness: .92, roughness: .26 }), material('Midnight', '#222b42', { metalness: .45, roughness: .29 }), material('Apricot', '#edaa75', { metalness: .4, roughness: .28 }), material('Chalk', '#d4d8dc', { roughness: .65 }), material('Amethyst', '#9e86c9', { metalness: .5, roughness: .26 })]; let group = object('group', { name: 'Orbital sculpture', position: [0, 0, 0] }); s.objects.push(group); s.objects.push(object('torus', { name: 'Outer orbit', parent: group.id, position: [0, 2.8, 0], rotation: [52, 10, -23], params: { radius: 2.15, tube: .13, segments: 96 }, material: s.materials[1].id })); s.objects.push(object('torus', { name: 'Inner orbit', parent: group.id, position: [0, 2.8, 0], rotation: [-38, 32, 30], params: { radius: 1.75, tube: .20, segments: 96 }, material: s.materials[0].id, tracks: { rotation: [{ frame: 0, value: [-38, 32, 30] }, { frame: 180, value: [-38, 392, 30] }] } })); s.objects.push(object('sphere', { name: 'Core', parent: group.id, position: [0, 2.8, 0], scale: [1.07, 1.07, 1.07], material: s.materials[0].id })); s.objects.push(object('cloner', { name: 'Satellite array', parent: group.id, position: [0, 2.8, 0], rotation: [20, 0, 14], scale: [1, 1, 1], params: { count: 10, mode: 'radial', radius: 2.85, spacing: 1, seed: 12, random: .13, primitive: 'sphere', size: .18 }, material: s.materials[3].id, tracks: { rotation: [{ frame: 0, value: [20, 0, 14] }, { frame: 180, value: [20, 360, 14] }] } })); s.objects.push(object('cylinder', { name: 'Exhibition plinth', position: [0, .35, 0], params: { radius: 3, height: .7, segments: 96 }, material: s.materials[2].id })); s.objects.push(object('cylinder', { name: 'Plinth inlay', position: [0, .705, 0], params: { radius: 2.9, height: .02, segments: 96 }, material: s.materials[1].id })); s.objects.push(object('plane', { name: 'Studio floor', position: [0, -.02, 0], rotation: [-90, 0, 0], scale: [100, 100, 100], material: s.materials[4].id })); s.objects.push(object('light', { name: 'Key light', position: [5, 9, 5], params: { intensity: 90, color: '#e0edff' } })); s.objects.push(object('light', { name: 'Warm rim', position: [-5, 6, -3], params: { intensity: 70, color: '#ffcfaa' } })); return s; }
const finiteArray = (a, n = 3) => Array.isArray(a) && a.length === n && a.every(v => Number.isFinite(v) && Math.abs(v) <= 1e8);
const safeId = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const validName = v => typeof v === 'string' && v.length > 0 && v.length <= 240;
const hexColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export function validateScene(s) {
    if (!s || s.format !== 'astrum' || s.version !== 1 || !safeId(s.id) || !validName(s.name) || !Array.isArray(s.objects) || s.objects.length > 5000 || !Array.isArray(s.materials) || s.materials.length > 1000)
        throw Error('Invalid Astrum scene or scene limits exceeded');
    if (!Number.isFinite(s.fps) || s.fps < 1 || s.fps > 240 || !Number.isFinite(s.duration) || s.duration < 1 || s.duration > 100000)
        throw Error('Invalid animation settings');
    if (!s.settings || !hexColor(s.settings.background) || !Number.isFinite(s.settings.exposure) || s.settings.exposure < 0 || s.settings.exposure > 10 || typeof s.settings.grid !== 'boolean' || typeof s.settings.shadows !== 'boolean')
        throw Error('Invalid scene settings');
    let ids = new Set(), mids = new Set();
    for (let m of s.materials) {
        if (!safeId(m.id) || mids.has(m.id) || !validName(m.name) || !hexColor(m.color) || !Number.isFinite(m.metalness) || m.metalness < 0 || m.metalness > 1 || !Number.isFinite(m.roughness) || m.roughness < 0 || m.roughness > 1)
            throw Error('Invalid material');
        mids.add(m.id);
    }
    for (let o of s.objects) {
        if (!safeId(o.id) || ids.has(o.id) || !validName(o.name) || !TYPES.includes(o.type) || !finiteArray(o.position) || !finiteArray(o.rotation) || !finiteArray(o.scale) || o.scale.some(x => Math.abs(x) < .0001) || typeof o.visible !== 'boolean' || typeof o.locked !== 'boolean' || o.parent !== null && !safeId(o.parent))
            throw Error('Invalid object or transform');
        ids.add(o.id);
        if (o.material !== null && !mids.has(o.material))
            throw Error('Missing material reference');
        if (!o.params || typeof o.params !== 'object' || Array.isArray(o.params))
            throw Error('Invalid object parameters');
        for (let [k, v] of Object.entries(o.params)) {
            if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > 100000))
                throw Error('Invalid numeric parameter');
            if (!['number', 'string', 'boolean'].includes(typeof v) || typeof v === 'string' && v.length > 100)
                throw Error('Invalid parameter');
            if (k === 'color' && !hexColor(v))
                throw Error('Invalid light color');
        }
        if (!Array.isArray(o.modifiers) || o.modifiers.length > 32 || o.modifiers.some(m => !['twist', 'bend', 'taper', 'inflate', 'wave', 'noise'].includes(m.type) || !Number.isFinite(m.strength) || Math.abs(m.strength) > 1000))
            throw Error('Invalid modifiers');
        if (o.type === 'mesh' && !o.geometry)
            throw Error('Mesh geometry required');
        if (o.geometry) {
            let { positions, indices } = o.geometry;
            if (!Array.isArray(positions) || positions.length > 3000000 || positions.length < 9 || positions.length % 3 || !indices && positions.length % 9 || !positions.every(v => Number.isFinite(v) && Math.abs(v) <= 1e8) || indices && (!Array.isArray(indices) || indices.length < 3 || indices.length > 3000000 || indices.length % 3 || !indices.every(x => Number.isInteger(x) && x >= 0 && x < positions.length / 3)))
                throw Error('Invalid mesh geometry');
        }
        if (!o.tracks || typeof o.tracks !== 'object' || Array.isArray(o.tracks))
            throw Error('Invalid tracks');
        for (let [k, keys] of Object.entries(o.tracks)) {
            if (!['position', 'rotation', 'scale'].includes(k) || !Array.isArray(keys) || keys.length > 10000 || keys.some(x => !Number.isFinite(x.frame) || x.frame < 0 || !finiteArray(x.value) || k === 'scale' && x.value.some(v => Math.abs(v) < .0001) || x.interpolation && !['linear', 'smooth', 'step'].includes(x.interpolation)))
                throw Error('Invalid animation track');
            if (new Set(keys.map(x => x.frame)).size !== keys.length)
                throw Error('Duplicate keyframe');
        }
    }
    let map = new Map(s.objects.map(o => [o.id, o]));
    for (let o of s.objects) {
        let seen = new Set([o.id]), p = o.parent;
        while (p) {
            if (seen.has(p) || !map.has(p))
                throw Error('Invalid or cyclic hierarchy');
            seen.add(p);
            p = map.get(p).parent;
        }
    }
    return s;
}
export function sampleTrack(keys, frame) { if (!keys?.length)
    return null; const sorted = [...keys].sort((a, b) => a.frame - b.frame); if (frame <= sorted[0].frame)
    return [...sorted[0].value]; if (frame >= sorted.at(-1).frame)
    return [...sorted.at(-1).value]; let b = sorted.findIndex(k => k.frame > frame), a = sorted[b - 1], z = sorted[b]; let t = (frame - a.frame) / (z.frame - a.frame); if (a.interpolation === 'step')
    t = 0;
else if (a.interpolation === 'smooth')
    t = t * t * (3 - 2 * t); return a.value.map((v, i) => v + (z.value[i] - v) * t); }
export function evaluateObject(o, frame) { let result = { ...o }; for (let key of ['position', 'rotation', 'scale'])
    result[key] = sampleTrack(o.tracks?.[key], frame) || [...o[key]]; return result; }
export function seededRandom(seed = 1) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function cloneTransforms(p = {}) { let count = Math.min(1000, Math.max(1, Math.round(p.count || 12))), rng = seededRandom(p.seed || 1), out = []; for (let i = 0; i < count; i++) {
    let a = i / count * Math.PI * 2, n = Math.ceil(Math.cbrt(count));
    let pos = p.mode === 'linear' ? [(i - (count - 1) / 2) * (p.spacing || 2), 0, 0] : p.mode === 'grid' ? [(i % n - (n - 1) / 2) * (p.spacing || 2), (Math.floor(i / n) % n - (n - 1) / 2) * (p.spacing || 2), (Math.floor(i / n / n) - (n - 1) / 2) * (p.spacing || 2)] : [Math.cos(a) * (p.radius || 3), 0, Math.sin(a) * (p.radius || 3)];
    out.push({ position: pos.map(v => v + (rng() - .5) * (p.random || 0)), rotation: [0, -a * 180 / Math.PI, 0], scale: [1, 1, 1] });
} return out; }
export class SceneDocument {
    constructor(scene = emptyScene()) { this.scene = clone(validateScene(scene)); this.changed = new Signal; this.undoStack = []; this.redoStack = []; this.selection = []; this.selectionChanged = new Signal; this.revision = 0; }
    get(id) { return this.scene.objects.find(o => o.id === id); }
    select(ids) { this.selection = [...new Set(ids)].filter(id => this.get(id)); this.selectionChanged.emit(this.selection); }
    transact(label, fn) { let before = clone(this.scene); try {
        fn(this.scene);
        validateScene(this.scene);
    }
    catch (e) {
        this.scene = before;
        throw e;
    } let after = clone(this.scene); if (JSON.stringify(before) === JSON.stringify(after))
        return; this.undoStack.push({ label, before, after }); if (this.undoStack.length > 80)
        this.undoStack.shift(); this.redoStack = []; this.revision++; this.changed.emit({ label, scene: this.scene }); }
    undo() { let h = this.undoStack.pop(); if (!h)
        return; this.redoStack.push(h); this.scene = clone(h.before); this.select(this.selection); this.revision++; this.changed.emit({ label: 'Undo ' + h.label, scene: this.scene }); }
    redo() { let h = this.redoStack.pop(); if (!h)
        return; this.undoStack.push(h); this.scene = clone(h.after); this.select(this.selection); this.revision++; this.changed.emit({ label: 'Redo ' + h.label, scene: this.scene }); }
    add(type, extra = {}) { let o = object(type, { material: this.scene.materials[0]?.id, ...extra }); this.transact('Create ' + o.name, s => s.objects.push(o)); this.select([o.id]); return o; }
    update(id, patch, label = 'Edit object') { this.transact(label, () => Object.assign(this.get(id), clone(patch))); }
    remove(ids = this.selection) { let removed = new Set(ids); let progress = true; while (progress) {
        progress = false;
        for (let o of this.scene.objects)
            if (removed.has(o.parent) && !removed.has(o.id)) {
                removed.add(o.id);
                progress = true;
            }
    } this.transact('Delete objects', s => s.objects = s.objects.filter(o => !removed.has(o.id))); this.select([]); }
    duplicate(ids = this.selection) { let all = new Set(ids); for (let i = 0; i < this.scene.objects.length; i++)
        for (let o of this.scene.objects)
            if (all.has(o.parent))
                all.add(o.id); let map = new Map([...all].map(id => [id, uid()])), copies = this.scene.objects.filter(o => all.has(o.id)).map(o => ({ ...clone(o), id: map.get(o.id), parent: map.get(o.parent) || o.parent, name: o.name + ' copy', position: o.position.map((v, i) => v + (!all.has(o.parent) && i === 0 ? 1 : 0)) })); this.transact('Duplicate objects', s => s.objects.push(...copies)); this.select(ids.map(id => map.get(id))); return copies; }
    reparent(id, parent) { this.transact('Reparent object', () => { this.get(id).parent = parent; }); }
    keyframe(ids = this.selection, frame = 0) { this.transact('Record keyframe', () => { for (let id of ids) {
        let o = this.get(id);
        o.tracks ??= {};
        for (let key of ['position', 'rotation', 'scale']) {
            let a = o.tracks[key] || [];
            a = a.filter(k => k.frame !== frame);
            a.push({ frame, value: [...o[key]], interpolation: 'smooth' });
            o.tracks[key] = a.sort((x, y) => x.frame - y.frame);
        }
    } }); }
    replace(scene) { this.scene = clone(validateScene(scene)); this.undoStack = []; this.redoStack = []; this.selection = []; this.revision++; this.changed.emit({ label: 'Load scene', scene: this.scene }); this.selectionChanged.emit([]); }
    serialize() { return JSON.stringify(this.scene, null, 2); }
    dispose() { this.undoStack = []; this.redoStack = []; }
}
export function diffScenes(base, next) { let ops = []; for (let collection of ['objects', 'materials']) {
    let a = new Map(base[collection].map(v => [v.id, v])), b = new Map(next[collection].map(v => [v.id, v]));
    for (let [id, value] of b)
        if (JSON.stringify(a.get(id)) !== JSON.stringify(value))
            ops.push({ collection, id, value });
    for (let [id] of a)
        if (!b.has(id))
            ops.push({ collection, id, value: null });
} for (let key of ['name', 'fps', 'duration', 'settings'])
    if (JSON.stringify(base[key]) !== JSON.stringify(next[key]))
        ops.push({ collection: 'meta', id: key, value: next[key] }); return ops; }
export function applyOperations(scene, ops) { let s = clone(scene); for (let op of ops) {
    if (op.collection === 'meta') {
        if (!['name', 'fps', 'duration', 'settings'].includes(op.id))
            throw Error('Invalid metadata');
        s[op.id] = clone(op.value);
    }
    else if (['objects', 'materials'].includes(op.collection)) {
        let a = s[op.collection], i = a.findIndex(v => v.id === op.id);
        if (op.value === null) {
            if (i >= 0)
                a.splice(i, 1);
        }
        else if (op.value.id !== op.id)
            throw Error('ID mismatch');
        else if (i >= 0)
            a[i] = clone(op.value);
        else
            a.push(clone(op.value));
    }
    else
        throw Error('Invalid operation');
} return validateScene(s); }
