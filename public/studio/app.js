import { SceneDocument, demoScene, emptyScene, object, material, clone, uid, evaluateObject, diffScenes } from './packages/core/index.js';
import { subdivideMesh, extrudeFace, weldMesh } from './packages/core/modeling.js';
import { Viewport } from './packages/renderer/index.js';
import { CommandRegistry, PanelResizer, escapeHTML as esc, download, debounce } from './packages/controls/index.js';
import { ProjectClient } from './packages/collaboration/index.js';
import { LocalProjectClient } from './packages/collaboration/local.js';
import { icon, hydrateIcons } from './icons.js';
const $ = (s, root = document) => root.querySelector(s), $$ = (s, root = document) => [...root.querySelectorAll(s)];
const localMode = document.documentElement.dataset.storage === 'local';
const doc = new SceneDocument(demoScene()), client = localMode ? new LocalProjectClient('astrum:' + new URL('./', import.meta.url).pathname) : new ProjectClient, commands = new CommandRegistry;
let viewport, inspector = 'object', shelf = 'materials', rightTab = 'objects', frame = 0, autoKey = false, snap = false, activeMaterial = null, dirty = true, suppress = false, collapsed = new Set, toastTimer, polling = false, pendingConflict = null, currentRole = 'owner';
const notify = (message) => { $('#toast').textContent = message; $('#toast').classList.add('visible'); $('#status-message').textContent = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000); };
const guard = fn => async (...args) => { try {
    return await fn(...args);
}
catch (e) {
    console.error(e);
    notify(e.message || 'The operation could not be completed');
} };
function dialog(title, html, bind) { $('#dialog-title').textContent = title; $('#dialog-content').innerHTML = html; if (!$('#dialog').open)
    $('#dialog').showModal(); hydrateIcons($('#dialog')); bind?.($('#dialog-content')); }
function closeDialog() { $('#dialog').close(); }
$('#dialog-close').onclick = closeDialog;
$('#dialog').addEventListener('click', e => { if (e.target === $('#dialog')) {
    let r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeDialog();
} });
function field(label, input) { return `<div class="field-row"><label>${label}</label>${input}</div>`; }
function number(label, key, value, step = .1, min = '', max = '') { return field(label, `<input type="number" data-field="${key}" value="${Number(value ?? 0).toFixed(step < 1 ? 2 : 0)}" step="${step}" ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''} aria-label="${label}">`); }
function select(label, key, value, options) { return field(label, `<select data-field="${key}" aria-label="${label}">${options.map(o => { let [v, n] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(n)}</option>`; }).join('')}</select>`); }
function bool(label, key, value) { return field(label, `<input type="checkbox" data-field="${key}" ${value ? 'checked' : ''} aria-label="${label}">`); }
function current() { return doc.get(doc.selection[0]); }
function setInspector(tab) { inspector = tab; $$('[data-inspector]').forEach(b => b.classList.toggle('active', b.dataset.inspector === tab)); renderInspector(); }
function renderInspector() {
    let o = current(), html = '';
    $('#attribute-title').innerHTML = icon(o?.type || 'cube') + `<span>${esc(o?.name || 'Scene settings')}</span>`;
    if (!o) {
        html = '<div class="section-label">Scene</div>' + field('Name', `<input data-scene="name" value="${esc(doc.scene.name)}" aria-label="Scene name">`) + field('Background', `<input type="color" data-setting="background" value="${doc.scene.settings.background}" aria-label="Background">`) + field('Exposure', `<input type="range" min="0.1" max="3" step="0.05" data-setting="exposure" value="${doc.scene.settings.exposure}" aria-label="Exposure">`) + field('Floor grid', `<input type="checkbox" data-setting="grid" ${doc.scene.settings.grid ? 'checked' : ''} aria-label="Show grid">`) + field('Shadows', `<input type="checkbox" data-setting="shadows" ${doc.scene.settings.shadows ? 'checked' : ''} aria-label="Show shadows">`) + `<div class="separator"></div><p class="hint">Select an object in the viewport or Object Manager to edit its parameters.</p><button class="attribute-action" data-action="primitives">${icon('plus')} Create object</button>`;
    }
    else if (inspector === 'transform') {
        let v = evaluateObject(o, frame);
        html = '<div class="section-label">Local coordinates</div><div class="vector-grid"><span></span><div class="vector-head">X</div><div class="vector-head">Y</div><div class="vector-head">Z</div></div>';
        for (let [k, label] of [['position', 'Position'], ['rotation', 'Rotation °'], ['scale', 'Scale']])
            html += `<div class="vector-grid"><span>${label}</span>${v[k].map((n, i) => `<input type="number" data-vector="${k}" data-axis="${i}" value="${n.toFixed(2)}" step="${k === 'rotation' ? 1 : .1}" aria-label="${label} ${'XYZ'[i]}">`).join('')}</div>`;
        html += `<div class="separator"></div><button class="attribute-action" data-action="record">◆ Record keyframe</button> <button class="attribute-action" data-action="reset-transform">Reset</button><p class="hint">Gizmo space is set in the top toolbar. Coordinates are relative to the parent. ${autoKey ? 'Auto keyframing is enabled.' : 'Press K to record the current pose.'}</p>`;
    }
    else if (inspector === 'material') {
        let m = doc.scene.materials.find(m => m.id === o.material) || doc.scene.materials[0];
        html = '<div class="section-label">Surface</div>' + select('Material', 'material', o.material, doc.scene.materials.map(m => [m.id, m.name]));
        if (m)
            html += field('Name', `<input data-material-field="name" data-material-id="${m.id}" value="${esc(m.name)}" aria-label="Material name">`) + field('Base color', `<input type="color" data-material-field="color" data-material-id="${m.id}" value="${m.color}" aria-label="Base color">`) + field('Metalness', `<input type="range" min="0" max="1" step="0.01" data-material-field="metalness" data-material-id="${m.id}" value="${m.metalness}" aria-label="Metalness">`) + field('Roughness', `<input type="range" min="0.03" max="1" step="0.01" data-material-field="roughness" data-material-id="${m.id}" value="${m.roughness}" aria-label="Roughness">`) + `<div class="separator"></div><p class="hint">Material edits update every object using this material. Drag a material from the shelf onto an object to assign it.</p><button class="attribute-action" data-action="material">Create material</button>`;
    }
    else if (inspector === 'modifiers') {
        html = '<div class="section-label">Deformer stack</div>';
        html += (o.modifiers || []).map((m, i) => `<div class="modifier-card"><div class="modifier-title">${icon('deform')} ${esc(m.type)}<button data-remove-modifier="${i}" title="Remove modifier">×</button></div>${field('Enabled', `<input type="checkbox" data-modifier="${i}" data-mod-key="enabled" ${m.enabled !== false ? 'checked' : ''} aria-label="Enable ${m.type}">`)}${field('Strength', `<input type="number" data-modifier="${i}" data-mod-key="strength" value="${m.strength}" step="0.1" aria-label="${m.type} strength">`)}</div>`).join('');
        html += '<button class="attribute-action" data-action="modifier">+ Add deformer</button><p class="hint">Deformers evaluate from top to bottom on the original geometry. Subdivide a mesh for smoother deformation.</p>';
    }
    else {
        html = '<div class="section-label">Basic properties</div>' + field('Name', `<input data-field="name" value="${esc(o.name)}" aria-label="Object name">`) + bool('Visible', 'visible', o.visible) + bool('Locked', 'locked', o.locked);
        let p = o.params || {};
        if (['cube', 'plane'].includes(o.type)) {
            html += '<div class="separator"></div><div class="section-label">' + (o.type === 'cube' ? 'Cube' : 'Plane') + ' dimensions</div>' + number('Width', 'params.width', p.width || 2, .1, .01) + number('Height', 'params.height', p.height || 2, .1, .01);
            if (o.type === 'cube')
                html += number('Depth', 'params.depth', p.depth || 2, .1, .01);
        }
        if (['sphere', 'torus', 'cylinder', 'cone', 'capsule', 'knot', 'icosahedron'].includes(o.type)) {
            html += '<div class="separator"></div><div class="section-label">Object parameters</div>' + number('Radius', 'params.radius', p.radius || 1, .1, .01);
            if (['torus', 'knot'].includes(o.type))
                html += number('Tube radius', 'params.tube', p.tube || .3, .05, .01);
            if (['cylinder', 'cone', 'capsule'].includes(o.type))
                html += number('Height', 'params.height', p.height || 2, .1, .01);
            if (o.type !== 'icosahedron')
                html += number('Segments', 'params.segments', p.segments || 48, 1, 3, 192);
        }
        if (o.type === 'cloner') {
            html += '<div class="separator"></div><div class="section-label">Procedural distribution</div>' + select('Mode', 'params.mode', p.mode, ['radial', 'linear', 'grid']) + select('Primitive', 'params.primitive', p.primitive || 'sphere', ['sphere', 'cube', 'torus', 'icosahedron']) + number('Count', 'params.count', p.count || 12, 1, 1, 1000) + number('Radius', 'params.radius', p.radius || 3, .1, .01) + number('Spacing', 'params.spacing', p.spacing || 2, .1, .01) + number('Object size', 'params.size', p.size || .25, .05, .01) + number('Randomness', 'params.random', p.random || 0, .1, 0) + number('Seed', 'params.seed', p.seed || 1, 1);
            html += '<p class="hint">Instances share geometry and materials. Make editable to turn the distribution into independent objects.</p>';
        }
        if (o.type === 'light') {
            html += '<div class="separator"></div><div class="section-label">Point light</div>' + number('Intensity', 'params.intensity', p.intensity ?? 70, 1, 0, 10000) + field('Color', `<input type="color" data-field="params.color" value="${p.color || '#ffffff'}" aria-label="Light color">`);
        }
        if (o.type === 'camera')
            html += '<button class="attribute-action" data-action="look-camera">Look through camera</button><button class="attribute-action" data-action="capture-camera">Capture current view</button>';
        if (o.type === 'mesh')
            html += '<div class="separator"></div><div class="section-label">Editable mesh</div><p class="hint">' + (o.geometry.positions.length / 3).toLocaleString() + ' vertices · ' + ((o.geometry.indices?.length || o.geometry.positions.length / 3) / 3).toLocaleString() + ' triangles</p><button class="attribute-action" data-action="subdivide">Subdivide</button> <button class="attribute-action" data-action="weld">Weld points</button><button class="attribute-action" data-action="extrude">Extrude selected polygon</button>';
        else if (!['group', 'light', 'camera'].includes(o.type))
            html += '<div class="separator"></div><button class="attribute-action" data-action="editable">' + icon('editable') + ' Make editable</button>';
        html += '<div class="separator"></div><button class="attribute-action" data-action="focus">Frame selection</button> <button class="attribute-action" data-action="duplicate">Duplicate</button>';
    }
    $('#attributes').innerHTML = html;
}
function renderTree() { let query = $('#object-search').value.toLowerCase(), rows = []; function walk(parent, depth) { for (let o of doc.scene.objects.filter(o => o.parent === parent)) {
    let kids = doc.scene.objects.some(c => c.parent === o.id), match = o.name.toLowerCase().includes(query), mat = doc.scene.materials.find(m => m.id === o.material);
    if (match)
        rows.push(`<div class="tree-row ${doc.selection.includes(o.id) ? 'selected' : ''}" data-id="${o.id}" data-type="${o.type}" role="treeitem" aria-selected="${doc.selection.includes(o.id)}" aria-level="${depth + 1}" draggable="true" tabindex="0" style="padding-left:${9 + depth * 16}px"><button class="expand" data-collapse="${o.id}" title="${collapsed.has(o.id) ? 'Expand' : 'Collapse'} group">${kids ? (collapsed.has(o.id) ? '›' : '⌄') : ''}</button><span class="object-icon">${icon(o.type)}</span><span class="tree-name">${esc(o.name)}</span>${mat ? `<span class="material-dot" style="background:${mat.color}"></span>` : ''}<button class="visibility" data-visibility="${o.id}" title="Toggle visibility">${icon(o.visible ? 'eye' : 'hidden')}</button><button class="lock" data-lock="${o.id}" title="${o.locked ? 'Unlock' : 'Lock'} object" style="opacity:${o.locked ? 1 : .25}">${icon('lock')}</button></div>`);
    if (!collapsed.has(o.id) || query)
        walk(o.id, depth + 1);
} } walk(null, 0); $('#object-tree').innerHTML = rows.join(''); $('#object-count').textContent = doc.scene.objects.length; $('#scene-object-count').textContent = `${doc.scene.objects.length} objects`; $('#selection-status').textContent = doc.selection.length ? `${doc.selection.length} selected · ${current()?.name || ''}` : 'Select an object to edit'; $('#track-label').textContent = current()?.name || 'All transform tracks'; }
function renderShelf() { let html; if (shelf === 'materials') {
    html = doc.scene.materials.map(m => `<button class="material-card ${activeMaterial === m.id ? 'active' : ''}" draggable="true" data-material="${m.id}" title="Assign ${esc(m.name)} to selection"><div class="material-swatch" style="--swatch:${m.color}"></div><span>${esc(m.name)}</span></button>`).join('') + `<button class="material-card new-material" data-action="material">${icon('plus')}<span>New material</span></button>`;
}
else if (shelf === 'assets') {
    html = ['cube', 'sphere', 'torus', 'cylinder', 'cone', 'capsule', 'icosahedron', 'knot', 'plane', 'cloner'].map(type => `<button class="asset-card" data-create="${type}">${icon(type)}${type[0].toUpperCase() + type.slice(1)}</button>`).join('');
}
else {
    html = doc.undoStack.slice(-12).reverse().map((h, i) => `<div class="history-item"><span>${doc.undoStack.length - i}</span>${esc(h.label)}</div>`).join('') || '<p class="hint">Your editing history will appear here.</p>';
} $('#shelf').innerHTML = html; $('#material-count').textContent = `${doc.scene.materials.length} materials`; }
function renderTimeline() { let duration = doc.scene.duration; $('#scrubber').max = duration; $('#frame-range').textContent = `0 — ${duration} F`; $('#fps').textContent = doc.scene.fps + ' FPS'; $('#ruler-numbers').innerHTML = Array.from({ length: 11 }, (_, i) => `<span>${Math.round(i * duration / 10)}</span>`).join(''); let objs = doc.selection.length ? doc.scene.objects.filter(o => doc.selection.includes(o.id)) : doc.scene.objects; let keys = new Set(objs.flatMap(o => Object.values(o.tracks || {}).flatMap(a => a.map(k => k.frame)))); $('#key-marks').innerHTML = [...keys].map(f => `<i style="left:${f / duration * 100}%" title="Frame ${f}"></i>`).join(''); setFrame(frame, false); }
function setFrame(value, update = true) { frame = Math.max(0, Math.min(doc.scene.duration, Number(value) || 0)); $('#scrubber').value = frame; $('#frame-number').value = Math.round(frame); $('#playhead').style.left = frame / doc.scene.duration * 100 + '%'; $('#playhead span').textContent = Math.round(frame); if (update)
    viewport?.updateFrame(frame); if (!$('#curve-view').hidden)
    drawCurves(); }
function drawCurves() { let canvas = $('#curve-canvas'), w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h)
    return; canvas.width = w * 2; canvas.height = h * 2; let ctx = canvas.getContext('2d'); ctx.scale(2, 2); ctx.clearRect(0, 0, w, h); ctx.strokeStyle = '#3c4455'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * h / 5);
    ctx.lineTo(w, i * h / 5);
    ctx.stroke();
} let o = current(), keys = o?.tracks?.rotation || o?.tracks?.position; ctx.fillStyle = '#96a1b8'; ctx.font = '10px sans-serif'; ctx.fillText(keys ? 'Rotation / position channels' : 'Select an animated object to view curves', 8, 13); if (keys) {
    let vals = keys.flatMap(k => k.value), min = Math.min(...vals, 0), max = Math.max(...vals, 1);
    for (let axis = 0; axis < 3; axis++) {
        ctx.strokeStyle = ['#d9868c', '#a2c389', '#829ff1'][axis];
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
            let v = evaluateObject(o, x / w * doc.scene.duration), prop = o.tracks.rotation ? 'rotation' : 'position', y = h - 15 - (v[prop][axis] - min) / (max - min) * (h - 40);
            if (x === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
} ctx.strokeStyle = '#a2b0ff'; ctx.beginPath(); ctx.moveTo(frame / doc.scene.duration * w, 0); ctx.lineTo(frame / doc.scene.duration * w, h); ctx.stroke(); }
function renderAll() { renderTree(); renderInspector(); renderShelf(); renderTimeline(); $('#document-name').textContent = doc.scene.name; $('.scene-label').textContent = doc.scene.name.split('•')[0].trim().slice(0, 28).toUpperCase(); $('.scene-subtitle').textContent = doc.scene.objects.length + ' objects / ' + doc.scene.fps + ' fps'; $('#dirty-marker').hidden = !dirty; }
const recover = debounce(() => { try {
    localStorage.setItem('astrum-recovery', JSON.stringify({ project: client.project, scene: doc.scene, time: Date.now() }));
}
catch { } }, 600);
const autosave = debounce(guard(async () => { if (client.project && !pendingConflict) {
    try {
        if (!await client.save(doc.scene) || !client.baseScene)
            return;
        dirty = diffScenes(client.baseScene, doc.scene).length > 0;
        $('#dirty-marker').hidden = !dirty;
        if (dirty)
            autosave();
    }
    catch (e) {
        if (e.status === 409)
            await syncProject();
        else
            throw e;
    }
} }), 1300);
doc.changed.subscribe(e => { if (!suppress) {
    dirty = true;
    recover();
    autosave();
} renderAll(); if (!suppress)
    $('#save-state').textContent = client.project ? 'Changes pending' : 'Unsaved project'; });
doc.selectionChanged.subscribe(() => { renderTree(); renderInspector(); renderTimeline(); if (innerWidth < 651 && doc.selection.length)
    $('#right-panel').classList.add('mobile-open'); });
client.status.subscribe(s => { $('#save-state').textContent = s; });
function applyObjectField(key, value) { let o = current(); if (!o || o.locked && key !== 'locked')
    throw Error('Unlock the object to edit it'); doc.transact('Edit ' + key, () => { let target = doc.get(o.id); if (key.startsWith('params.'))
    target.params[key.slice(7)] = value;
else
    target[key] = value; }); }
$('#attributes').addEventListener('change', guard(e => { let t = e.target, o = current(); if (t.matches('[data-field]')) {
    let value = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value;
    if (t.type === 'number' && !t.checkValidity())
        throw Error('Value is outside the allowed range');
    applyObjectField(t.dataset.field, value);
}
else if (t.dataset.vector) {
    if (o.locked)
        throw Error('Unlock the object first');
    let key = t.dataset.vector, axis = +t.dataset.axis, n = Number(t.value);
    if (!Number.isFinite(n))
        throw Error('Enter a finite number');
    if (key === 'scale' && Math.abs(n) < .001)
        n = .001;
    let pose = evaluateObject(o, frame)[key];
    pose[axis] = n;
    doc.transact('Edit ' + key, () => { let target = doc.get(o.id); target[key] = pose; if (autoKey || target.tracks?.[key]?.length) {
        target.tracks[key] = (target.tracks[key] || []).filter(k => k.frame !== Math.round(frame));
        target.tracks[key].push({ frame: Math.round(frame), value: pose, interpolation: 'smooth' });
    } });
}
else if (t.dataset.materialField) {
    doc.transact('Edit material', s => { let m = s.materials.find(m => m.id === t.dataset.materialId); m[t.dataset.materialField] = t.type === 'range' ? Number(t.value) : t.value; });
}
else if (t.dataset.modifier !== undefined) {
    doc.transact('Edit modifier', () => { let m = doc.get(o.id).modifiers[+t.dataset.modifier]; m[t.dataset.modKey] = t.type === 'checkbox' ? t.checked : Number(t.value); });
}
else if (t.dataset.setting) {
    doc.transact('Scene settings', s => s.settings[t.dataset.setting] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value);
}
else if (t.dataset.scene) {
    doc.transact('Rename scene', s => s.name = t.value);
} }));
$('#object-search').oninput = renderTree;
$('#object-tree').addEventListener('click', guard(e => { let target = e.target.closest('button'), row = e.target.closest('.tree-row'); if (target?.dataset.collapse) {
    let id = target.dataset.collapse;
    collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
    renderTree();
}
else if (target?.dataset.visibility) {
    let o = doc.get(target.dataset.visibility);
    doc.update(o.id, { visible: !o.visible }, 'Toggle visibility');
}
else if (target?.dataset.lock) {
    let o = doc.get(target.dataset.lock);
    doc.update(o.id, { locked: !o.locked }, 'Toggle lock');
}
else if (row) {
    let id = row.dataset.id;
    doc.select(e.shiftKey ? [...new Set([...doc.selection, id])] : [id]);
} }));
$('#object-tree').addEventListener('dblclick', e => { let row = e.target.closest('.tree-row'); if (row) {
    doc.select([row.dataset.id]);
    setInspector('object');
    $('#attributes input')?.focus();
} });
$('#object-tree').addEventListener('keydown', e => { if (e.key === 'Enter') {
    let row = e.target.closest('.tree-row');
    if (row)
        doc.select([row.dataset.id]);
} });
document.addEventListener('dragstart', e => { let row = e.target.closest('.tree-row'), mat = e.target.closest('[data-material]'); if (row)
    e.dataTransfer.setData('application/astrum-object', row.dataset.id); if (mat)
    e.dataTransfer.setData('application/astrum-material', mat.dataset.material); });
$('#object-tree').addEventListener('dragover', e => { e.preventDefault(); $$('.dragover').forEach(x => x.classList.remove('dragover')); e.target.closest('.tree-row')?.classList.add('dragover'); });
$('#object-tree').addEventListener('dragleave', e => e.target.closest('.tree-row')?.classList.remove('dragover'));
$('#object-tree').addEventListener('drop', guard(e => { e.preventDefault(); $$('.dragover').forEach(x => x.classList.remove('dragover')); let row = e.target.closest('.tree-row'), id = e.dataTransfer.getData('application/astrum-object'), mat = e.dataTransfer.getData('application/astrum-material'); if (id)
    viewport.reparent(id, row?.dataset.id || null);
else if (mat && row)
    doc.update(row.dataset.id, { material: mat }, 'Assign material'); }));
$('#viewport').addEventListener('dragover', e => e.preventDefault());
$('#viewport').addEventListener('drop', guard(e => { e.preventDefault(); let mat = e.dataTransfer.getData('application/astrum-material'); if (mat) {
    viewport.pick(e);
    if (current())
        doc.update(current().id, { material: mat }, 'Assign material');
}
else if (e.dataTransfer.files.length)
    importFile(e.dataTransfer.files[0]); }));
function popup(items, anchor) { let p = $('#popover'); p.innerHTML = items.map(item => item === null ? '<hr>' : `<button data-command="${item.id}">${esc(item.label)}<span>${esc(item.shortcut || '')}</span></button>`).join(''); p.hidden = false; let r = anchor?.getBoundingClientRect() || { left: innerWidth / 2 - 110, bottom: 100 }; p.style.left = Math.max(5, Math.min(innerWidth - 250, r.left)) + 'px'; p.style.top = Math.min(innerHeight - 250, r.bottom + 3) + 'px'; }
function cmd(id, label, run, shortcut = '') { commands.register(id, label, guard(run), shortcut); }
cmd('save', 'Save project', saveProject, 'Ctrl S');
cmd('new', 'New scene', () => confirmReplace('Create a new scene?', () => loadScene(emptyScene())), 'Ctrl N');
cmd('demo', 'Open Orbital demo', () => confirmReplace('Open the Orbital scene?', () => loadScene(demoScene())));
cmd('projects', 'Open project browser', () => showRight('projects'), 'Ctrl O');
cmd('export', 'Export Astrum scene', () => download(doc.serialize(), safeName() + '.astrum'));
cmd('import', 'Import scene / geometry', () => $('#file-input').click(), 'Ctrl I');
cmd('export-glb', 'Export GLB geometry', async () => { notify('Preparing GLB export…'); download(await viewport.exportGLTF(), safeName() + '.glb', 'model/gltf-binary'); notify('GLB exported'); });
cmd('undo', 'Undo', () => doc.undo(), 'Ctrl Z');
cmd('redo', 'Redo', () => doc.redo(), 'Ctrl Shift Z');
cmd('delete', 'Delete selected', () => { if (!doc.selection.length)
    return; doc.remove(doc.selection.filter(id => !doc.get(id).locked)); }, 'Delete');
cmd('duplicate', 'Duplicate selected', () => doc.duplicate(), 'Ctrl D');
cmd('group', 'Group selected', () => { if (!doc.selection.length)
    throw Error('Select objects to group'); let ids = [...doc.selection], g = object('group', { name: 'Group', position: [0, 0, 0] }); doc.transact('Create group', s => s.objects.push(g)); for (let id of ids)
    viewport.reparent(id, g.id); doc.select([g.id]); }, 'Alt G');
cmd('ungroup', 'Move selection to root', () => { for (let id of [...doc.selection])
    viewport.reparent(id, null); });
cmd('select-all', 'Select all objects', () => doc.select(doc.scene.objects.filter(o => !o.locked).map(o => o.id)), 'Ctrl A');
cmd('deselect', 'Deselect', () => doc.select([]), 'Esc');
cmd('focus', 'Frame selected', () => viewport.focus(), 'F');
cmd('grid', 'Toggle floor grid', () => doc.transact('Toggle grid', s => s.settings.grid = !s.settings.grid));
cmd('snap', 'Toggle snapping', () => { snap = !snap; viewport.setSnap(snap); $('#snap').classList.toggle('active', snap); notify(snap ? 'Snapping: 0.5 units / 15°' : 'Snapping off'); });
cmd('quad', 'Toggle four-view preview', () => { viewport.quad = !viewport.quad; viewport.transform.detach(); viewport.needsRender = true; $('#quad-labels').hidden = !viewport.quad; if (!viewport.quad) {
    viewport.resize();
    viewport.select();
} notify(viewport.quad ? 'Four-view preview · use Coordinates to edit' : 'Perspective viewport'); });
cmd('primitives', 'Create object', () => popup(['cube', 'sphere', 'torus', 'cylinder', 'cone', 'capsule', 'plane', 'knot', 'icosahedron', 'cloner', 'light', 'camera', 'group'].map(type => ({ id: 'create-' + type, label: type[0].toUpperCase() + type.slice(1) })), lastAnchor));
for (let type of ['cube', 'sphere', 'torus', 'cylinder', 'cone', 'capsule', 'plane', 'knot', 'icosahedron', 'cloner', 'light', 'camera', 'group'])
    cmd('create-' + type, 'Create ' + type, () => { let extra = {}; if (type === 'plane')
        extra.rotation = [-90, 0, 0]; if (type === 'cloner')
        extra.params = { count: 12, mode: 'radial', radius: 3, size: .25, spacing: 1, primitive: 'cube', seed: 1, random: 0 }; if (type === 'light')
        extra = { position: [3, 5, 3], params: { intensity: 100, color: '#ffffff' } }; doc.add(type, extra); setInspector('object'); });
cmd('editable', 'Make editable', () => { if (!current())
    throw Error('Select an object first'); viewport.makeEditable(current().id); notify('Geometry is editable. Use point or polygon mode.'); }, 'C');
cmd('subdivide', 'Subdivide mesh', () => { let o = current(); if (!o)
    throw Error('Select a mesh'); if (o.type !== 'mesh') {
    viewport.makeEditable(o.id);
    o = current();
} if (o.type !== 'mesh')
    throw Error('Select an individual mesh'); doc.update(o.id, { geometry: subdivideMesh(o.geometry) }, 'Subdivide mesh'); });
cmd('weld', 'Weld duplicate vertices', () => { let o = current(); if (o?.type !== 'mesh')
    throw Error('Select an editable mesh'); doc.update(o.id, { geometry: weldMesh(o.geometry) }, 'Weld vertices'); });
cmd('extrude', 'Extrude selected polygon', () => { let o = current(), face = viewport.faceIndex; if (o?.type !== 'mesh' || face === null)
    throw Error('Make the object editable, switch to polygon mode, then click a polygon'); dialog('Extrude polygon', field('Distance', `<input id="extrude-distance" type="number" value="0.3" step="0.1">`) + `<div class="dialog-actions"><button class="primary" id="do-extrude">Extrude</button></div>`, () => $('#do-extrude').onclick = guard(() => { doc.update(o.id, { geometry: extrudeFace(o.geometry, face, Number($('#extrude-distance').value)) }, 'Extrude polygon'); closeDialog(); })); });
cmd('modifier', 'Add deformer', () => { let o = current(); if (!o || ['group', 'light', 'camera', 'cloner'].includes(o.type))
    throw Error('Select a primitive or editable mesh to deform'); popup(['twist', 'bend', 'taper', 'inflate', 'wave', 'noise'].map(type => ({ id: 'modifier-' + type, label: type[0].toUpperCase() + type.slice(1) })), lastAnchor); });
for (let type of ['twist', 'bend', 'taper', 'inflate', 'wave', 'noise'])
    cmd('modifier-' + type, 'Add ' + type + ' deformer', () => { let o = current(); if (!o)
        throw Error('Select an object'); doc.update(o.id, { modifiers: [...o.modifiers, { type, strength: .4, enabled: true }] }, 'Add ' + type); setInspector('modifiers'); });
cmd('play', 'Play / pause', () => { viewport.playing = !viewport.playing; if (viewport.playing) {
    viewport.transform.detach();
    viewport.clearComponent();
}
else
    viewport.select(); $('#play').innerHTML = icon(viewport.playing ? 'pause' : 'play'); $('#play').classList.toggle('active', viewport.playing); }, 'Space');
cmd('first', 'First frame', () => setFrame(0));
cmd('last', 'Last frame', () => setFrame(doc.scene.duration));
cmd('previous', 'Previous frame', () => setFrame(Math.round(frame) - 1));
cmd('next', 'Next frame', () => setFrame(Math.round(frame) + 1));
cmd('record', 'Record transform keys', () => { if (!doc.selection.length)
    throw Error('Select an object to animate'); doc.transact('Record transform keyframes', () => { for (let id of doc.selection) {
    let o = doc.get(id), m = viewport.objects.get(id);
    o.tracks ??= {};
    for (let key of ['position', 'rotation', 'scale']) {
        let value = key === 'rotation' ? [m.rotation.x * 180 / Math.PI, m.rotation.y * 180 / Math.PI, m.rotation.z * 180 / Math.PI] : m[key].toArray();
        o.tracks[key] = (o.tracks[key] || []).filter(k => k.frame !== Math.round(frame));
        o.tracks[key].push({ frame: Math.round(frame), value, interpolation: 'smooth' });
    }
} }); notify('Keyframes recorded at frame ' + Math.round(frame)); }, 'K');
cmd('autokey', 'Toggle auto keyframes', () => { autoKey = !autoKey; viewport.autoKey = autoKey; $('#autokey').classList.toggle('active', autoKey); notify(autoKey ? 'Auto keyframing on' : 'Auto keyframing off'); });
cmd('keys', 'Edit keyframes', keyframeDialog);
cmd('animation-settings', 'Animation settings', () => dialog('Animation settings', field('Frame rate', `<input id="edit-fps" type="number" min="1" max="240" value="${doc.scene.fps}">`) + field('End frame', `<input id="edit-duration" type="number" min="1" max="100000" value="${doc.scene.duration}">`) + `<div class="dialog-actions"><button id="save-animation" class="primary">Apply</button></div>`, () => $('#save-animation').onclick = guard(() => { doc.transact('Animation settings', s => { s.fps = Number($('#edit-fps').value); s.duration = Number($('#edit-duration').value); }); closeDialog(); })));
cmd('reset-transform', 'Reset transform', () => { let o = current(); if (!o)
    return; doc.update(o.id, { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, 'Reset transform'); });
cmd('material', 'Create material', () => { let m = material('Material ' + (doc.scene.materials.length + 1), '#9cb6d7'); doc.transact('Create material', s => { s.materials.push(m); for (let id of doc.selection)
    doc.get(id).material = m.id; }); activeMaterial = m.id; if (current())
    setInspector('material');
else
    materialDialog(m.id); });
cmd('render', 'Render image', renderDialog, 'Ctrl R');
cmd('collaborate', 'Project collaboration', collaborateDialog);
cmd('help', 'Help & shortcuts', helpDialog);
cmd('account', 'Account', async () => { if (localMode) { browserStorageDialog(); return; } try {
    let u = await client.session();
    dialog('Your workspace', `<p>Signed in as <strong>${esc(u.email)}</strong>.</p><p class="dialog-info">Projects are stored in your hosted workspace. Project access and site access are managed separately.</p><button data-action="projects" class="primary">Open saved projects</button>`);
}
catch {
    dialog('Sign in', `<p>Sign in to save projects and collaborate. You can continue editing and export project files without signing in.</p><div class="dialog-actions"><a class="primary" target="_top" href="/signin-with-chatgpt?return_to=/studio/index.html">Sign in with ChatGPT</a></div>`);
} });
cmd('theme', 'Toggle light / dark theme', () => { document.body.classList.toggle('light'); localStorage.setItem('astrum-theme', document.body.classList.contains('light') ? 'light' : 'dark'); });
cmd('command', 'Command search', commandDialog, 'Shift C');
cmd('panel', 'Toggle Objects & Attributes', () => $('#right-panel').classList.toggle('mobile-open'));
cmd('cameras', 'Choose camera', () => { let options = [{ id: 'view-perspective', label: 'Editor perspective' }, ...doc.scene.objects.filter(o => o.type === 'camera').map(o => ({ id: 'camera-' + o.id, label: o.name }))]; for (let o of doc.scene.objects.filter(o => o.type === 'camera'))
    commands.register('camera-' + o.id, o.name, () => { doc.select([o.id]); commands.execute('look-camera'); }); popup(options, lastAnchor); });
cmd('view-perspective', 'Editor perspective', () => viewport.setView('Perspective'));
cmd('look-camera', 'Look through selected camera', () => { let o = current(); if (o?.type !== 'camera')
    throw Error('Select a camera'); let m = viewport.objects.get(o.id); m.updateWorldMatrix(true, false); m.getWorldPosition(viewport.camera.position); m.getWorldQuaternion(viewport.camera.quaternion); let direction = viewport.camera.getWorldDirection(viewport.target); viewport.orbit.target.copy(viewport.camera.position).addScaledVector(direction, 10); viewport.orbit.update(); viewport.needsRender = true; });
cmd('capture-camera', 'Capture viewport in camera', () => { let o = current(); if (o?.type !== 'camera')
    throw Error('Select a camera'); viewport.reparent(o.id, null); doc.update(o.id, { position: viewport.camera.position.toArray(), rotation: [viewport.camera.rotation.x, viewport.camera.rotation.y, viewport.camera.rotation.z].map(x => x * 180 / Math.PI) }, 'Capture camera'); });
cmd('recovery', 'Restore local recovery', () => { let data = JSON.parse(localStorage.getItem('astrum-recovery') || 'null'); if (!data)
    throw Error('No recovery snapshot on this device'); confirmReplace('Restore the recovery from ' + new Date(data.time).toLocaleString() + '?', () => loadScene(data.scene)); });
const menus = { File: ['new', 'demo', 'projects', null, 'save', 'export', 'import', 'export-glb', null, 'recovery'], Edit: ['undo', 'redo', null, 'duplicate', 'delete', 'group', 'ungroup'], Create: ['create-cube', 'create-sphere', 'create-torus', 'primitives', null, 'create-cloner', 'create-light', 'create-camera', 'material'], Select: ['select-all', 'deselect', 'focus'], Tools: ['editable', 'subdivide', 'weld', 'extrude', null, 'modifier', 'snap'], Animate: ['play', 'record', 'autokey', 'keys', 'animation-settings'], Render: ['render', 'export-glb'], Window: ['panel', 'quad', 'grid', 'theme', 'command'], Help: ['help', 'account'] };
$('#menus').innerHTML = Object.keys(menus).map(label => `<button data-menu="${label}">${label}</button>`).join('');
let lastAnchor;
document.addEventListener('click', guard(e => { let b = e.target.closest('button'); if (!e.target.closest('#popover') && !e.target.closest('[data-menu]'))
    $('#popover').hidden = true; if (!b)
    return; lastAnchor = b; if (b.dataset.action)
    return commands.execute(b.dataset.action); if (b.dataset.command) {
    $('#popover').hidden = true;
    return commands.execute(b.dataset.command);
} if (b.dataset.menu)
    return popup(menus[b.dataset.menu].map(id => id ? commands.commands.get(id) : null), b); if (b.dataset.create)
    return commands.execute('create-' + b.dataset.create); if (b.dataset.tool) {
    viewport.setTool(b.dataset.tool);
    $$('[data-tool]').forEach(x => x.classList.toggle('active', x === b));
    return;
} if (b.dataset.component) {
    viewport.setComponent(b.dataset.component);
    $$('[data-component]').forEach(x => x.classList.toggle('active', x === b));
    if (b.dataset.component !== 'object')
        notify('Select a ' + (b.dataset.component === 'face' ? 'polygon' : 'point') + ' on an editable mesh');
    return;
} if (b.dataset.axis && b.classList.contains('axis')) {
    b.classList.toggle('active');
    viewport.transform['show' + b.dataset.axis] = b.classList.contains('active');
    viewport.needsRender = true;
    return;
} if (b.dataset.inspector)
    return setInspector(b.dataset.inspector); if (b.dataset.shelf) {
    shelf = b.dataset.shelf;
    $$('[data-shelf]').forEach(x => x.classList.toggle('active', x === b));
    renderShelf();
    return;
} if (b.dataset.material) {
    activeMaterial = b.dataset.material;
    if (current()) {
        doc.transact('Assign material', () => doc.selection.forEach(id => { if (!doc.get(id).locked)
            doc.get(id).material = b.dataset.material; }));
        setInspector('material');
    }
    else
        materialDialog(b.dataset.material);
    return;
} if (b.dataset.removeModifier !== undefined) {
    let o = current();
    doc.update(o.id, { modifiers: o.modifiers.filter((_, i) => i !== +b.dataset.removeModifier) }, 'Remove modifier');
    return;
} if (b.dataset.right)
    return showRight(b.dataset.right); if (b.dataset.bottom) {
    $$('[data-bottom]').forEach(x => x.classList.toggle('active', x === b));
    $('#time-ruler').hidden = b.dataset.bottom === 'curves';
    $('#curve-view').hidden = b.dataset.bottom !== 'curves';
    $('#timeline').style.height = b.dataset.bottom === 'curves' ? '210px' : '';
    drawCurves();
    return;
} if (b.dataset.workspace) {
    $$('[data-workspace]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b); });
    let mode = b.dataset.workspace;
    setInspector(mode === 'Motion' ? 'modifiers' : mode === 'Rendering' ? 'material' : mode === 'Animation' ? 'transform' : 'object');
    if (mode === 'Animation') {
        $('[data-bottom="curves"]').click();
    }
    else
        $('[data-bottom="timeline"]').click();
    if (mode === 'Modeling') {
        $('[data-shelf="assets"]').click();
    }
    else
        $('[data-shelf="materials"]').click();
    return;
} }));
$('#shelf').addEventListener('dblclick', e => { let b = e.target.closest('[data-material]'); if (b)
    materialDialog(b.dataset.material); });
$('#space').onchange = e => viewport.setSpace(e.target.value);
$('#view').onchange = e => { viewport.setView(e.target.value); $('#viewport-label').textContent = e.target.value; };
$('#display').onchange = e => viewport.setDisplay(e.target.value);
$('#scrubber').oninput = e => { viewport.playing = false; $('#play').innerHTML = icon('play'); setFrame(e.target.value); };
$('#scrubber').onchange = () => { renderInspector(); viewport.select(); };
$('#frame-number').onchange = e => { setFrame(e.target.value); renderInspector(); };
$('#document-name').onclick = () => { dialog('Rename scene', `<input id="scene-name" style="width:100%" value="${esc(doc.scene.name)}" aria-label="Scene name"><div class="dialog-actions"><button class="primary" id="rename-scene">Rename</button></div>`, () => $('#rename-scene').onclick = () => { doc.transact('Rename scene', s => s.name = $('#scene-name').value.trim() || 'Untitled scene'); closeDialog(); }); };
function safeName() { return doc.scene.name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase().slice(0, 70) || 'scene'; }
function loadScene(scene) { client.reset(); pendingConflict = null; currentRole = 'owner'; doc.replace(scene); setFrame(0); history.replaceState(null, '', location.pathname); viewport?.focus(); notify('Scene opened'); }
function confirmReplace(message, fn) { if (!dirty)
    return fn(); dialog(message, '<p>The current scene has unsaved changes. Export a copy before replacing it if you want to keep them.</p><div class="dialog-actions"><button id="cancel-replace" class="secondary">Cancel</button><button id="backup-replace" class="secondary">Export current</button><button id="do-replace" class="primary">Continue</button></div>', () => { $('#cancel-replace').onclick = closeDialog; $('#backup-replace').onclick = () => commands.execute('export'); $('#do-replace').onclick = () => { closeDialog(); fn(); }; }); }
async function importFile(file) { if (/\.(astrum|json)$/i.test(file.name)) {
    let s = JSON.parse(await file.text());
    confirmReplace('Open imported scene?', () => loadScene(s));
}
else {
    notify('Importing ' + file.name + '…');
    let n = await viewport.importFile(file);
    notify(n + ' mesh' + (n === 1 ? '' : 'es') + ' imported');
} }
$('#file-input').onchange = guard(async (e) => { if (e.target.files[0])
    await importFile(e.target.files[0]); e.target.value = ''; });
async function saveProject() { if (client.busy) {
    notify('A project operation is already in progress');
    return;
} if (!client.project) {
    let p = await client.create(doc.scene);
    history.replaceState(null, '', location.pathname + '?project=' + p.id);
    dirty = diffScenes(client.baseScene, doc.scene).length > 0;
    $('#dirty-marker').hidden = !dirty;
    $('#save-state').textContent = dirty ? 'Changes pending' : 'Saved';
    if (dirty)
        autosave();
    notify('Project saved');
    return p;
} try {
    if (!await client.save(doc.scene) || !client.baseScene)
        return;
    dirty = diffScenes(client.baseScene, doc.scene).length > 0;
    $('#dirty-marker').hidden = !dirty;
    notify('Project saved');
}
catch (e) {
    if (e.status === 409) {
        await syncProject();
        return;
    }
    if (e.status === 401) {
        commands.execute('account');
        return;
    }
    throw e;
} }
async function openProject(id) { dialog('Opening project', '<p class="hint">Loading the saved scene…</p>'); let p; try {
    p = await client.load(id);
}
catch (e) {
    closeDialog();
    throw e;
} suppress = true; doc.replace(p.scene); suppress = false; dirty = false; currentRole = p.role; setFrame(0); history.replaceState(null, '', location.pathname + '?project=' + id); $('#dirty-marker').hidden = true; $('#save-state').textContent = 'Saved'; pendingConflict = null; closeDialog(); notify(p.role === 'viewer' ? 'Project opened with view access' : 'Project opened'); }
async function syncProject() { if (!client.project || polling || pendingConflict || viewport?.transform.dragging)
    return; polling = true; try {
    let result = await client.sync(() => doc.scene, () => !viewport?.transform.dragging);
    if (result?.conflict) {
        pendingConflict = result.remote;
        $('#save-state').textContent = 'Conflicting edits';
        showConflict();
        return;
    }
    if (result?.scene) {
        suppress = true;
        doc.replace(result.scene);
        suppress = false;
        dirty = result.hasPending;
        renderAll();
        $('#save-state').textContent = dirty ? 'Changes pending' : 'Synced';
        if (dirty)
            autosave();
    }
}
finally {
    polling = false;
} }
function showConflict() { dialog('Resolve shared changes', '<p>A collaborator edited the same object or scene property. Your edits are still available here.</p><p class="dialog-info">Export a copy to preserve your current version, then choose which project version to keep.</p><div class="dialog-actions"><button id="conflict-export" class="secondary">Export my copy</button><button id="conflict-remote" class="secondary">Use shared version</button><button id="conflict-local" class="primary">Save my version</button></div>', () => { $('#conflict-export').onclick = () => commands.execute('export'); $('#conflict-remote').onclick = () => { client.revision = pendingConflict.revision; client.baseScene = clone(pendingConflict.scene); suppress = true; doc.replace(pendingConflict.scene); suppress = false; pendingConflict = null; dirty = false; closeDialog(); notify('Shared version loaded'); }; $('#conflict-local').onclick = guard(async () => { client.revision = pendingConflict.revision; client.baseScene = clone(pendingConflict.scene); pendingConflict = null; await saveProject(); closeDialog(); }); }); }
async function showRight(tab) { rightTab = tab; $$('[data-right]').forEach(b => b.classList.toggle('active', b.dataset.right === tab)); $('#object-tree').hidden = tab !== 'objects'; $('.object-search').hidden = tab !== 'objects'; $('#right-alternate').hidden = tab === 'objects'; if (innerWidth < 651)
    $('#right-panel').classList.add('mobile-open'); if (tab === 'objects')
    return; let target = $('#right-alternate'); target.innerHTML = '<p class="hint">Loading…</p>'; try {
    if (tab === 'projects') {
        let projects = await client.list();
        target.innerHTML = `<button class="attribute-action" data-action="save">Save current project</button>${projects.length ? projects.map(p => `<button class="project-card" data-project="${p.id}"><strong>${esc(p.name)}</strong><small>Revision ${p.revision} · ${new Date(p.updated_at).toLocaleDateString()}</small></button>`).join('') : '<p class="hint">No saved projects yet.</p>'}`;
        $$('[data-project]', target).forEach(b => b.onclick = () => confirmReplace('Open saved project?', () => guard(openProject)(b.dataset.project)));
    }
    else {
        if (!client.project) {
            target.innerHTML = '<p class="hint">Save this project to add shared review comments.</p><button class="attribute-action" data-action="save">Save project</button>';
            return;
        }
        let comments = await client.comments();
        target.innerHTML = '<div class="comment-compose"><textarea id="comment-text" placeholder="Add a review note…" aria-label="Review comment"></textarea><button id="post-comment" class="attribute-action">Post at frame ' + Math.round(frame) + '</button></div>' + comments.map(c => `<div class="comment-card"><small>${esc(c.author)} · F${c.frame ?? 0}</small><p>${esc(c.text)}</p><button data-comment-frame="${c.frame || 0}" data-comment-object="${esc(c.object_id || '')}" class="attribute-action">Go to frame</button></div>`).join('');
        $('#post-comment').onclick = guard(async () => { await client.comment($('#comment-text').value, current()?.id, Math.round(frame)); await showRight('comments'); });
        $$('[data-comment-frame]').forEach(b => b.onclick = () => { setFrame(+b.dataset.commentFrame); if (b.dataset.commentObject)
            doc.select([b.dataset.commentObject]); });
    }
}
catch (e) {
    target.innerHTML = `<p class="hint">${esc(e.message)}</p><button class="attribute-action" data-action="account">Account</button>`;
} }
function browserStorageDialog() {
    dialog('Browser-local workspace', '<p>This GitHub Pages edition saves projects and review notes in IndexedDB on this browser and device.</p><div class="dialog-info">There are no online accounts, invitations, or cross-device project links here. Clearing site data deletes local projects. Use File → Export Astrum scene for backups and file-based sharing.</div><p class="hint">For signed-in team collaboration, deploy the included server and database. The repository documents the separate hosted and standalone editions.</p>');
}
async function collaborateDialog() { if (localMode) { browserStorageDialog(); return; } if (!client.project)
    await saveProject(); let result = await client.members(), url = location.origin + location.pathname + '?project=' + client.project; dialog('Collaborate on this project', `<p>Give teammates access to this scene and its review notes.</p>${field('Project link', `<input id="share-url" readonly value="${esc(url)}">`)}<button id="copy-link" class="attribute-action">Copy project link</button><div class="separator"></div>${result.role === 'owner' ? field('Email', `<input id="member-email" type="email" placeholder="teammate@example.com">`) + field('Permission', `<select id="member-role"><option value="editor">Can edit</option><option value="viewer">Can view & comment</option></select>`) + `<button id="add-member" class="primary">Grant project access</button>` : ''}<div id="member-list">${result.members.map(m => `<div class="member-row"><span>${esc(m.email)}</span><small>${esc(m.role)}</small>${result.role === 'owner' ? `<button data-revoke="${esc(m.email)}">Remove</button>` : ''}</div>`).join('')}</div><div class="dialog-info">Project permissions apply after a teammate can open the site. This site starts private; its owner must separately enable the intended site audience. Granting project access does not send an email.</div><p class="hint">Changes synchronize every 4 seconds. Independent object edits merge automatically; overlapping edits require a choice. ${result.online.length} active session(s).</p>`, () => { $('#copy-link').onclick = guard(async () => { await navigator.clipboard.writeText(url); notify('Project link copied'); }); if ($('#add-member'))
    $('#add-member').onclick = guard(async () => { await client.invite($('#member-email').value, $('#member-role').value); await collaborateDialog(); notify('Project access granted'); }); $$('[data-revoke]').forEach(b => b.onclick = guard(async () => { await client.request('/members', 'DELETE', { id: client.project, email: b.dataset.revoke }); await collaborateDialog(); })); }); }
function materialDialog(id) { let m = doc.scene.materials.find(x => x.id === id); dialog('Material · ' + m.name, field('Name', `<input id="mat-name" value="${esc(m.name)}">`) + field('Base color', `<input id="mat-color" type="color" value="${m.color}">`) + field('Metalness', `<input id="mat-metal" type="range" min="0" max="1" step="0.01" value="${m.metalness}">`) + field('Roughness', `<input id="mat-rough" type="range" min="0.03" max="1" step="0.01" value="${m.roughness}">`) + `<div class="dialog-actions"><button class="secondary" id="mat-copy">Duplicate</button><button class="primary" id="mat-apply">Apply</button></div>`, () => { $('#mat-apply').onclick = () => { doc.transact('Edit material', s => { Object.assign(s.materials.find(m => m.id === id), { name: $('#mat-name').value, color: $('#mat-color').value, metalness: Number($('#mat-metal').value), roughness: Number($('#mat-rough').value) }); }); closeDialog(); }; $('#mat-copy').onclick = () => { let copy = { ...clone(m), id: uid(), name: m.name + ' copy' }; doc.transact('Duplicate material', s => s.materials.push(copy)); closeDialog(); materialDialog(copy.id); }; }); }
function keyframeDialog() { let o = current(); if (!o)
    throw Error('Select an animated object'); let rows = Object.entries(o.tracks || {}).flatMap(([key, keys]) => keys.map((k, i) => `<div class="key-row" data-key-row data-track="${key}" data-key-index="${i}"><label>${key}</label><input type="number" class="key-frame" value="${k.frame}" min="0" max="${doc.scene.duration}" aria-label="Key frame">${k.value.map((v, i) => `<input type="number" class="key-value" value="${v.toFixed(2)}" step="0.1" aria-label="${'XYZ'[i]} value">`).join('')}<select class="key-interpolation" aria-label="Interpolation">${['smooth', 'linear', 'step'].map(v => `<option ${v === (k.interpolation || 'linear') ? 'selected' : ''}>${v}</option>`).join('')}</select><button class="delete-key" title="Delete key">×</button></div>`)); dialog('Keyframes · ' + o.name, rows.join('') || '<p class="hint">No keys yet. Move to a frame, set the pose, and press K.</p>'); $('#dialog').style.width = '760px'; $('#dialog-content').insertAdjacentHTML('beforeend', '<div class="dialog-actions"><button class="primary" id="save-keys">Apply keyframes</button></div>'); $$('.delete-key').forEach(b => b.onclick = () => b.closest('.key-row').remove()); $('#save-keys').onclick = guard(() => { let tracks = {}; $$('[data-key-row]').forEach(row => { let key = row.dataset.track; tracks[key] ??= []; let f = Number($('.key-frame', row).value); if (!Number.isFinite(f) || f < 0 || f > doc.scene.duration)
    throw Error('Keyframe outside animation range'); if (tracks[key].some(k => k.frame === f))
    throw Error('Two keys cannot share a frame on one track'); tracks[key].push({ frame: f, value: $$('.key-value', row).map(i => Number(i.value)), interpolation: $('.key-interpolation', row).value }); }); doc.update(o.id, { tracks }, 'Edit keyframes'); closeDialog(); }); }
$('#dialog').addEventListener('close', () => $('#dialog').style.width = '');
function renderDialog() { dialog('Render image', `<p class="hint">Render the current perspective camera to a PNG image.</p>${field('Preset', `<select id="render-preset"><option value="1920,1080">HD · 1920 × 1080</option><option value="2560,1440">QHD · 2560 × 1440</option><option value="3840,2160">4K · 3840 × 2160</option><option value="1080,1080">Square · 1080 × 1080</option></select>`)}${field('Width', `<input id="render-width" type="number" min="64" max="4096" value="1920">`)}${field('Height', `<input id="render-height" type="number" min="64" max="4096" value="1080">`)}${field('Transparent', `<input id="render-alpha" type="checkbox">`)}<div class="dialog-info">${esc(viewport.backend)} raster rendering · PBR materials · environment lighting · shadows. Frame ${Math.round(frame)} at ${doc.scene.fps} FPS.</div><div class="dialog-actions"><button class="secondary" id="render-cancel">Cancel</button><button id="render-now" class="primary">Render & download PNG</button></div>`, () => { $('#render-preset').onchange = e => { let [w, h] = e.target.value.split(','); $('#render-width').value = w; $('#render-height').value = h; }; $('#render-cancel').onclick = closeDialog; $('#render-now').onclick = guard(async () => { let w = Number($('#render-width').value), h = Number($('#render-height').value); if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 64 || w > 4096 || h > 4096)
    throw Error('Choose dimensions from 64 to 4096'); let button = $('#render-now'); button.disabled = true; button.textContent = 'Rendering…'; let play = viewport.playing; viewport.playing = false; try {
    let blob = await viewport.exportPNG(Math.round(w), Math.round(h), $('#render-alpha').checked);
    download(blob, safeName() + '-' + Math.round(frame) + '.png', 'image/png');
    closeDialog();
    notify('PNG image exported');
}
finally {
    viewport.playing = play;
    button.disabled = false;
    button.textContent = 'Render & download PNG';
} }); }); }
function commandDialog() { dialog('Command search', '<input id="command-query" class="command-input" placeholder="Search commands…" autocomplete="off" aria-label="Search commands"><div class="command-list" id="command-results"></div>', () => { let draw = () => { $('#command-results').innerHTML = commands.search($('#command-query').value).slice(0, 20).map(c => `<button data-run="${c.id}">${esc(c.label)}<span>${esc(c.shortcut)}</span></button>`).join(''); $$('[data-run]').forEach(b => b.onclick = () => { closeDialog(); commands.execute(b.dataset.run); }); }; $('#command-query').oninput = draw; $('#command-query').onkeydown = e => { if (e.key === 'Enter')
    $('[data-run]')?.click(); }; draw(); setTimeout(() => $('#command-query').focus(), 20); }); }
function helpDialog() { dialog('Welcome to Astrum Studio', `<p>A 3D workspace for modeling, procedural composition, animation, and image rendering.</p><div class="separator"></div><div class="help-grid"><span>Orbit camera</span><kbd>Drag</kbd><span>Pan / zoom</span><kbd>Right-drag / Wheel</kbd><span>Add to selection</span><kbd>Shift click</kbd><span>Move / rotate / scale</span><kbd>E / R / T</kbd><span>Frame selection</span><kbd>F</kbd><span>Make editable</span><kbd>C</kbd><span>Play / pause</span><kbd>Space</kbd><span>Record transform keys</span><kbd>K</kbd><span>Undo / redo</span><kbd>Ctrl Z / Ctrl Shift Z</kbd><span>Save project</span><kbd>Ctrl S</kbd><span>Command search</span><kbd>Shift C</kbd><span>Toggle Objects panel</span><kbd>Tab</kbd></div><div class="separator"></div><p><strong>Try it:</strong> select Inner orbit, play the timeline, change its material, then render an image. Add a cloner and edit its count, distribution, or randomness in Attributes.</p><p><strong>Mesh editing:</strong> select a primitive, press C, choose point or polygon mode on the left, and click the mesh. Drag a point gizmo or use Extrude for a selected triangle.</p><p class="dialog-info">This is an initial working release. Native C4D files, Redshift rendering, UV/texture workflows, character rigging, simulation systems, and complete Cinema 4D parity are not available. Geometry exchange supports OBJ, STL, and uncompressed self-contained glTF/GLB; imported materials and animation are not preserved. Shared editing uses revision-checked polling.</p><p class="hint">Astrum is an independent application. Third-party names identify compatibility boundaries only.</p>`); }
document.addEventListener('keydown', e => { if (e.target.closest('input,textarea,select') || $('#dialog').open)
    return; let mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase(), id; if (mod) {
    id = ({ s: 'save', o: 'projects', i: 'import', d: 'duplicate', a: 'select-all', r: 'render', z: e.shiftKey ? 'redo' : 'undo', y: 'redo' })[key];
}
else if (key === 'c' && e.shiftKey)
    id = 'command';
else if (e.altKey && key === 'g')
    id = 'group';
else
    id = ({ delete: 'delete', backspace: 'delete', f: 'focus', c: 'editable', ' ': 'play', k: 'record', escape: 'deselect', tab: 'panel' })[key]; if (id) {
    e.preventDefault();
    commands.execute(id);
}
else if (['e', 'r', 't'].includes(key)) {
    e.preventDefault();
    $(`[data-tool="${{ e: 'translate', r: 'rotate', t: 'scale' }[key]}"]`).click();
} });
window.addEventListener('beforeunload', e => { if (dirty) {
    e.preventDefault();
    e.returnValue = '';
} });
window.addEventListener('resize', () => { if (!$('#curve-view').hidden)
    drawCurves(); });
new PanelResizer($('#right-resizer'), $('#right-panel'), 'x', 265, 550);
if (localMode) {
    const saveButton = document.querySelector('.title-actions [data-action="save"]');
    saveButton.textContent = 'Save locally';
    saveButton.title = 'Save in this browser (Ctrl+S). Export scene files for backups.';
    document.querySelector('.share-button').title = 'Browser storage and sharing limitations';
    document.querySelector('#save-state').textContent = 'Browser-local project';
}
if (localStorage.getItem('astrum-theme') === 'light')
    document.body.classList.add('light');
hydrateIcons();
renderAll();
async function boot() { try {
    viewport = new Viewport($('#viewport'), doc);
    viewport.error.subscribe(notify);
    viewport.stats.subscribe(s => { $('#renderer-badge').textContent = s.backend; $('#render-stats').textContent = `${s.backend} · ${Number(s.triangles).toLocaleString()} triangles · ${s.calls} draws`; $('#object-stats').textContent = doc.scene.objects.length + ' objects · ' + Number(s.triangles).toLocaleString() + ' triangles'; });
    await viewport.init();
    $('#loading').remove();
    viewport.onFrame = f => setFrame(f, false);
    doc.select([doc.scene.objects.find(o => o.name === 'Inner orbit').id]);
    let project = new URLSearchParams(location.search).get('project');
    if (project) {
        try { await openProject(project); }
        catch (error) { notify(error.message); }
    }
    setInterval(() => { if (client.project && !document.hidden) {
        guard(syncProject)();
        client.presence(doc.selection).catch(() => { });
        if (rightTab === 'comments' && !$('#comment-text')?.value && !$('#right-alternate').contains(document.activeElement))
            showRight('comments');
    } }, 4000);
    client.session().then(u => { $('.avatar').textContent = u.email[0].toUpperCase(); $('.avatar').title = u.email; }).catch(() => { });
    window.astrum = { document: doc, viewport, commands, client };
}
catch (e) {
    console.error(e);
    if ($('#loading'))
        $('#loading').innerHTML = `<strong>Unable to initialize the viewport</strong><span>${esc(e.message)}</span><p class="hint">Use a browser with WebGPU or WebGL 2 enabled.</p><button class="primary" id="retry-viewport">Retry</button>`;
    if ($('#retry-viewport'))
        $('#retry-viewport').onclick = () => location.reload();
    notify(e.message);
} }
boot();
