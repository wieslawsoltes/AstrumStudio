import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { evaluateObject, cloneTransforms, Signal, clone, uid } from '../core/index.js';
import { deformPositions } from '../core/modeling.js';
export { THREE };
const rad = Math.PI / 180;
export function createGeometry(o) { let p = o.params || {}, seg = Math.min(192, Math.max(3, Math.floor(p.segments || 48))), g; switch (o.type) {
    case 'cube':
        g = new THREE.BoxGeometry(p.width || 2, p.height || 2, p.depth || 2, 8, 8, 8);
        break;
    case 'sphere':
        g = new THREE.SphereGeometry(p.radius || 1, seg, Math.max(8, seg / 2));
        break;
    case 'torus':
        g = new THREE.TorusGeometry(p.radius || 1, p.tube || .3, 24, seg);
        break;
    case 'cylinder':
        g = new THREE.CylinderGeometry(p.radius || 1, p.radius || 1, p.height || 2, seg, 12);
        break;
    case 'cone':
        g = new THREE.ConeGeometry(p.radius || 1, p.height || 2, seg, 12);
        break;
    case 'capsule':
        g = new THREE.CapsuleGeometry(p.radius || .6, p.height || 1.2, 12, seg);
        break;
    case 'plane':
        g = new THREE.PlaneGeometry(p.width || 2, p.height || 2, 16, 16);
        break;
    case 'icosahedron':
        g = new THREE.IcosahedronGeometry(p.radius || 1, Math.min(4, p.detail ?? 1));
        break;
    case 'knot':
        g = new THREE.TorusKnotGeometry(p.radius || 1, p.tube || .28, 128, 16);
        break;
    case 'mesh':
        g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(o.geometry.positions, 3));
        if (o.geometry.indices)
            g.setIndex(o.geometry.indices);
        break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
} if (o.modifiers?.length) {
    g.setAttribute('position', new THREE.BufferAttribute(deformPositions(g.attributes.position.array, o.modifiers), 3));
    g.computeVertexNormals();
} if (!g.attributes.normal)
    g.computeVertexNormals(); g.computeBoundingSphere(); return g; }
export function geometryData(g) { const a = g.getAttribute('position'), positions = []; for (let i = 0; i < a.count; i++)
    positions.push(a.getX(i), a.getY(i), a.getZ(i)); return { positions, indices: g.index ? Array.from(g.index.array) : undefined }; }
export class Viewport {
    constructor(container, doc) { this.container = container; this.document = doc; this.scene = new THREE.Scene; this.content = new THREE.Group; this.scene.add(this.content); this.camera = new THREE.PerspectiveCamera(38, 1, .05, 1500); this.camera.position.set(10, 7, 12); this.target = new THREE.Vector3(0, 2, 0); this.camera.lookAt(this.target); this.objects = new Map; this.materials = new Map; this.frame = 0; this.playing = false; this.mode = 'shaded'; this.component = 'object'; this.faceIndex = null; this.vertexIndex = null; this.selected = new Signal; this.stats = new Signal; this.error = new Signal; this.ready = false; this.disposers = []; this.last = 0; this.needsRender = true; this.quad = false; this.cameraMode = 'Perspective'; }
    async init() {
        this.renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        await this.renderer.init();
        this.backend = this.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
        this.container.append(this.renderer.domElement);
        this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D viewport');
        this.renderer.domElement.tabIndex = 0;
        this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbit.target.copy(this.target);
        this.orbit.enableDamping = true;
        this.orbit.dampingFactor = .12;
        this.orbit.minDistance = .4;
        this.orbit.maxDistance = 250;
        this.orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
        this.orbit.addEventListener('change', () => this.needsRender = true);
        this.transform = new TransformControls(this.camera, this.renderer.domElement);
        this.transform.setSize(.85);
        this.transform.setMode('translate');
        this.scene.add(this.transform.getHelper());
        this.transform.addEventListener('dragging-changed', e => { this.orbit.enabled = !e.value; });
        this.transform.addEventListener('mouseDown', () => { this.dragStart = clone(this.document.scene); this.wasTransform = true; });
        this.transform.addEventListener('objectChange', () => { this.needsRender = true; this.updateSelectionBox(); });
        this.transform.addEventListener('mouseUp', () => this.commitTransform());
        this.grid = new THREE.GridHelper(40, 40, 0x596272, 0x3a424c);
        this.grid.position.y = .015;
        this.grid.material.transparent = true;
        this.grid.material.opacity = .38;
        this.scene.add(this.grid);
        this.ambient = new THREE.HemisphereLight(0xc9dfff, 0x4e4759, 2.2);
        this.scene.add(this.ambient);
        let sun = new THREE.DirectionalLight(0xfff5e8, 3.5);
        sun.position.set(5, 10, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -14;
        sun.shadow.camera.right = 14;
        sun.shadow.camera.top = 14;
        sun.shadow.camera.bottom = -14;
        sun.shadow.bias = -.0003;
        sun.shadow.normalBias = .025;
        this.scene.add(sun);
        this.sun = sun;
        let rim = new THREE.DirectionalLight(0xb2d8ff, 1.5);
        rim.position.set(-5, 5, -3);
        this.scene.add(rim);
        try {
            let pmrem = new THREE.PMREMGenerator(this.renderer);
            let room = new RoomEnvironment;
            this.envTarget = await pmrem.fromSceneAsync(room, .04);
            this.scene.environment = this.envTarget.texture;
            room.dispose();
            pmrem.dispose();
        }
        catch (e) {
            console.warn('Environment lighting:', e.message);
        }
        this.box = new THREE.Box3Helper(new THREE.Box3, 0x9aafff);
        this.box.material.depthTest = false;
        this.box.material.transparent = true;
        this.box.material.opacity = .65;
        this.box.visible = false;
        this.scene.add(this.box);
        this.raycaster = new THREE.Raycaster;
        this.pointer = new THREE.Vector2;
        let down;
        this.renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; this.wasTransform = false; }, { capture: true });
        this.renderer.domElement.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || this.wasTransform || e.button !== 0 || e.altKey)
            return; this.pick(e); });
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.disposers.push(this.document.changed.subscribe(() => this.sync()));
        this.disposers.push(this.document.selectionChanged.subscribe(() => this.select()));
        this.sync();
        this.resize();
        this.ready = true;
        this.renderer.setAnimationLoop(t => this.tick(t));
        return this;
    }
    resize() { let w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h)
        return; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.needsRender = true; }
    getMaterial(id) { let data = this.document.scene.materials.find(m => m.id === id) || { id: 'default', color: '#b4c4dc', roughness: .4, metalness: 0 }; let m = this.materials.get(data.id); if (!m) {
        m = new THREE.MeshStandardMaterial;
        this.materials.set(data.id, m);
    } let signature = JSON.stringify([data.color, data.metalness, data.roughness, this.mode]); if (m.userData.signature === signature)
        return m; m.userData.signature = signature; m.color.set(data.color); m.metalness = Math.max(0, Math.min(1, data.metalness)); m.roughness = Math.max(.03, Math.min(1, data.roughness)); m.wireframe = this.mode === 'wireframe'; m.flatShading = this.mode === 'flat'; m.side = THREE.DoubleSide; m.needsUpdate = true; return m; }
    sync() {
        if (!this.renderer)
            return;
        let scene = this.document.scene, ids = new Set(scene.objects.map(o => o.id));
        for (let [id, m] of this.objects)
            if (!ids.has(id)) {
                m.removeFromParent();
                this.disposeObject(m);
                this.objects.delete(id);
            }
        this.scene.background = new THREE.Color(scene.settings?.background || '#292d35');
        this.renderer.toneMappingExposure = scene.settings?.exposure ?? 1;
        this.grid.visible = scene.settings?.grid !== false;
        this.sun.castShadow = scene.settings?.shadows !== false;
        for (let o of scene.objects) {
            let key = JSON.stringify([o.type, o.params, o.modifiers]), m = this.objects.get(o.id);
            if (m?.userData.geometryKey !== key || m?.userData.geometryRef !== o.geometry) {
                if (m) {
                    m.removeFromParent();
                    this.disposeObject(m);
                }
                m = this.build(o);
                m.userData = { ...m.userData, id: o.id, geometryKey: key, geometryRef: o.geometry };
                m.traverse(c => c.userData.id = o.id);
                this.objects.set(o.id, m);
            }
            m.name = o.name;
            m.visible = o.visible !== false;
            if (m.isMesh)
                m.material = this.getMaterial(o.material);
            if (m.isPointLight) {
                m.intensity = o.params.intensity ?? 60;
                m.color.set(o.params.color || '#ffffff');
            }
            m.userData.locked = o.locked;
        }
        for (let o of scene.objects) {
            let m = this.objects.get(o.id), parent = this.objects.get(o.parent) || this.content;
            if (m.parent !== parent)
                parent.add(m);
        }
        this.updateFrame(this.frame);
        this.select();
        this.needsRender = true;
    }
    build(o) { if (o.type === 'group')
        return new THREE.Group; if (o.type === 'camera') {
        let g = new THREE.Group;
        let body = new THREE.Mesh(new THREE.BoxGeometry(.6, .4, .5), new THREE.MeshBasicMaterial({ color: 0x7bc7ae, wireframe: true }));
        g.add(body);
        return g;
    } if (o.type === 'light') {
        let light = new THREE.PointLight(o.params.color || '#ffffff', o.params.intensity ?? 70, 100, 2);
        let icon = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 8), new THREE.MeshBasicMaterial({ color: o.params.color || '#ffffff' }));
        light.add(icon);
        return light;
    } if (o.type === 'cloner') {
        let transforms = cloneTransforms(o.params), geo = createGeometry({ type: o.params.primitive || 'sphere', params: { radius: o.params.size || .25, width: (o.params.size || .25) * 2, height: (o.params.size || .25) * 2, depth: (o.params.size || .25) * 2, segments: 24 } }), m = new THREE.InstancedMesh(geo, this.getMaterial(o.material), transforms.length), dummy = new THREE.Object3D;
        for (let i = 0; i < transforms.length; i++) {
            let t = transforms[i];
            dummy.position.fromArray(t.position);
            dummy.rotation.set(...t.rotation.map(v => v * rad));
            dummy.scale.fromArray(t.scale);
            dummy.updateMatrix();
            m.setMatrixAt(i, dummy.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        m.castShadow = true;
        m.receiveShadow = true;
        m.computeBoundingSphere();
        return m;
    } let m = new THREE.Mesh(createGeometry(o), this.getMaterial(o.material)); m.castShadow = o.type !== 'plane'; m.receiveShadow = true; return m; }
    disposeObject(m) { m.traverse(c => { c.geometry?.dispose(); if (c.material?.isMeshBasicMaterial)
        c.material.dispose(); }); }
    updateFrame(frame) { this.frame = frame; for (let o of this.document.scene.objects) {
        let m = this.objects.get(o.id), v = evaluateObject(o, frame);
        m.position.fromArray(v.position);
        m.rotation.set(...v.rotation.map(v => v * rad));
        m.scale.fromArray(v.scale);
    } this.content.updateMatrixWorld(true); this.updateSelectionBox(); this.needsRender = true; }
    select() { if (!this.transform)
        return; let ids = this.document.selection, m = this.objects.get(ids[0]); this.clearComponent(); this.transform.detach(); if (m && !m.userData.locked && this.component === 'object' && !this.playing && !this.quad)
        this.transform.attach(m); this.updateSelectionBox(); this.needsRender = true; }
    updateSelectionBox() { if (!this.box)
        return; let ids = this.document.selection; this.box.box.makeEmpty(); for (let id of ids) {
        let m = this.objects.get(id);
        if (m)
            this.box.box.expandByObject(m);
    } this.box.visible = ids.length > 0 && !this.box.box.isEmpty() && this.component === 'object'; }
    clearComponent() { if (this.componentOverlay) {
        this.scene.remove(this.componentOverlay);
        this.componentOverlay.geometry?.dispose();
        this.componentOverlay.material?.dispose();
        this.componentOverlay = null;
    } if (this.vertexHandle) {
        this.scene.remove(this.vertexHandle);
        this.vertexHandle = null;
    } this.faceIndex = null; this.vertexIndex = null; }
    pick(event) { let rect = this.renderer.domElement.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top, cam = this.camera; if (this.quad) {
        let w = rect.width / 2, h = rect.height / 2, col = x >= w ? 1 : 0, row = y >= h ? 1 : 0;
        cam = this.quadCameras?.[row * 2 + col] || this.camera;
        x -= col * w;
        y -= row * h;
        this.pointer.set(x / w * 2 - 1, -y / h * 2 + 1);
    }
    else
        this.pointer.set(x / rect.width * 2 - 1, -y / rect.height * 2 + 1); this.raycaster.setFromCamera(this.pointer, cam); let hits = this.raycaster.intersectObjects(this.content.children, true).filter(h => { let o = this.document.get(h.object.userData.id); return o?.visible && !o.locked && h.object.visible && this.isVisible(h.object); }); let h = hits[0]; if (this.component !== 'object' && h) {
        let o = this.document.get(h.object.userData.id);
        if (o.type !== 'mesh') {
            this.error.emit('Use Make editable before selecting points or polygons.');
            return;
        }
        this.document.select([o.id]);
        this.selectComponent(h);
        return;
    } let id = h?.object.userData.id; if (event.shiftKey && id) {
        let ids = new Set(this.document.selection);
        ids.has(id) ? ids.delete(id) : ids.add(id);
        this.document.select([...ids]);
    }
    else
        this.document.select(id ? [id] : []); this.selected.emit(h); }
    isVisible(m) { while (m) {
        if (!m.visible)
            return false;
        m = m.parent;
    } return true; }
    selectComponent(hit) { this.clearComponent(); let mesh = hit.object, g = mesh.geometry; this.transform.detach(); if (this.component === 'face') {
        this.faceIndex = hit.faceIndex;
        let indices = g.index ? Array.from(g.index.array).slice(hit.faceIndex * 3, hit.faceIndex * 3 + 3) : [hit.faceIndex * 3, hit.faceIndex * 3 + 1, hit.faceIndex * 3 + 2], points = indices.flatMap(i => [g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i)]);
        let geo = new THREE.BufferGeometry;
        geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        this.componentOverlay = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf7ad61, side: THREE.DoubleSide, transparent: true, opacity: .7, depthTest: false }));
        this.componentOverlay.matrixAutoUpdate = false;
        this.componentOverlay.matrix.copy(mesh.matrixWorld);
        this.scene.add(this.componentOverlay);
    }
    else {
        let local = mesh.worldToLocal(hit.point.clone()), best = Infinity, index = 0;
        for (let i = 0; i < g.attributes.position.count; i++) {
            let p = new THREE.Vector3().fromBufferAttribute(g.attributes.position, i), d = p.distanceToSquared(local);
            if (d < best) {
                best = d;
                index = i;
            }
        }
        this.vertexIndex = index;
        let p = new THREE.Vector3().fromBufferAttribute(g.attributes.position, index).applyMatrix4(mesh.matrixWorld);
        this.vertexHandle = new THREE.Object3D;
        this.vertexHandle.position.copy(p);
        this.scene.add(this.vertexHandle);
        if (!this.quad)
            this.transform.attach(this.vertexHandle);
        let geo = new THREE.BufferGeometry;
        geo.setAttribute('position', new THREE.Float32BufferAttribute(p.toArray(), 3));
        this.componentOverlay = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb55e, size: .1, depthTest: false }));
        this.scene.add(this.componentOverlay);
    } this.needsRender = true; }
    commitTransform() { let id = this.document.selection[0], o = this.document.get(id), m = this.objects.get(id); if (!o || o.locked)
        return; if (this.vertexHandle && this.vertexIndex !== null) {
        let local = m.worldToLocal(this.vertexHandle.position.clone()), index = this.vertexIndex;
        this.document.transact('Move vertex', () => { let geometry = clone(this.document.get(id).geometry); geometry.positions.splice(index * 3, 3, ...local.toArray()); this.document.get(id).geometry = geometry; });
        let updated = this.objects.get(id), point = local.clone().applyMatrix4(updated.matrixWorld);
        this.selectComponent({ object: updated, point, faceIndex: 0 });
        return;
    } if (!m)
        return; let patch = { position: m.position.toArray(), rotation: [m.rotation.x / rad, m.rotation.y / rad, m.rotation.z / rad], scale: m.scale.toArray().map(v => Math.abs(v) < .001 ? .001 : v) }; let selected = this.document.selection, old = this.dragStart?.objects.find(x => x.id === id); this.document.transact('Transform objects', () => { Object.assign(this.document.get(id), patch); let target = this.document.get(id); for (let key of ['position', 'rotation', 'scale'])
        if (this.autoKey || target.tracks?.[key]?.length) {
            target.tracks ??= {};
            target.tracks[key] = (target.tracks[key] || []).filter(k => k.frame !== Math.round(this.frame));
            target.tracks[key].push({ frame: Math.round(this.frame), value: [...patch[key]], interpolation: 'smooth' });
        } if (old && this.transform.mode === 'translate')
        for (let sid of selected.slice(1)) {
            let other = this.document.get(sid);
            if (!other.locked && other.parent === o.parent)
                other.position = other.position.map((v, i) => v + patch.position[i] - old.position[i]);
        } }); }
    setTool(mode) { this.transform.setMode(mode); this.needsRender = true; }
    setSpace(space) { this.transform.setSpace(space); }
    setSnap(enabled) { this.transform.setTranslationSnap(enabled ? .5 : null); this.transform.setRotationSnap(enabled ? 15 * rad : null); this.transform.setScaleSnap(enabled ? .1 : null); }
    setComponent(mode) { this.component = mode; this.select(); }
    setDisplay(mode) { this.mode = mode; for (let m of this.materials.values()) {
        m.wireframe = mode === 'wireframe';
        m.flatShading = mode === 'flat';
        m.needsUpdate = true;
    } this.needsRender = true; }
    focus() { let b = new THREE.Box3; for (let id of this.document.selection) {
        let m = this.objects.get(id);
        if (m)
            b.expandByObject(m);
    } if (b.isEmpty())
        b.setFromCenterAndSize(new THREE.Vector3(0, 2, 0), new THREE.Vector3(8, 8, 8)); let center = b.getCenter(new THREE.Vector3), size = b.getSize(new THREE.Vector3).length(); this.orbit.target.copy(center); this.camera.position.copy(center).add(new THREE.Vector3(1, .65, 1).normalize().multiplyScalar(Math.max(2, size * 1.3))); this.orbit.update(); this.needsRender = true; }
    setView(mode) { this.cameraMode = mode; let t = this.orbit.target, d = Math.max(8, this.camera.position.distanceTo(t)); let vec = { Top: [.001, d, 0], Front: [0, 0, d], Right: [d, 0, 0], Perspective: [d * .64, d * .42, d * .7] }[mode]; if (vec) {
        this.camera.position.copy(t).add(new THREE.Vector3(...vec));
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(t);
        this.orbit.update();
    } this.needsRender = true; }
    reparent(id, parent) { let m = this.objects.get(id), newParent = this.objects.get(parent) || this.content; m.updateWorldMatrix(true, false); let world = m.matrixWorld.clone(); newParent.updateWorldMatrix(true, false); let local = new THREE.Matrix4().copy(newParent.matrixWorld).invert().multiply(world), p = new THREE.Vector3, q = new THREE.Quaternion, s = new THREE.Vector3; local.decompose(p, q, s); let e = new THREE.Euler().setFromQuaternion(q); this.document.transact('Reparent object', () => { let o = this.document.get(id); Object.assign(o, { parent, position: p.toArray(), rotation: [e.x / rad, e.y / rad, e.z / rad], scale: s.toArray() }); }); }
    async exportPNG(width = 1920, height = 1080, transparent = false) { this.exporting = true; width = Math.min(4096, Math.max(64, width)); height = Math.min(4096, Math.max(64, height)); let size = this.renderer.getSize(new THREE.Vector2), pr = this.renderer.getPixelRatio(), aspect = this.camera.aspect, bg = this.scene.background, grid = this.grid.visible, box = this.box.visible, helper = this.transform.getHelper(), alpha = this.renderer.getClearAlpha(), overlayVisible = this.componentOverlay?.visible; try {
        if (this.componentOverlay)
            this.componentOverlay.visible = false;
        this.renderer.setClearAlpha(transparent ? 0 : 1);
        this.grid.visible = false;
        this.box.visible = false;
        helper.visible = false;
        this.scene.background = transparent ? null : bg;
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        await this.renderer.renderAsync(this.scene, this.camera);
        return await new Promise((resolve, reject) => this.renderer.domElement.toBlob(b => b ? resolve(b) : reject(Error('Image export failed')), 'image/png'));
    }
    finally {
        this.exporting = false;
        this.renderer.setClearAlpha(alpha);
        if (this.componentOverlay)
            this.componentOverlay.visible = overlayVisible;
        this.scene.background = bg;
        this.grid.visible = grid;
        this.box.visible = box;
        helper.visible = true;
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(size.x, size.y);
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.needsRender = true;
    } }
    makeEditable(id) { let o = this.document.get(id), m = this.objects.get(id); if (!m?.isMesh)
        throw Error('Select a mesh or primitive'); if (o.type === 'cloner') {
        let group = { ...clone(o), type: 'group', params: {}, modifiers: [] }, transforms = cloneTransforms(o.params), items = transforms.map((t, i) => ({ id: uid(), name: o.name + ' ' + (i + 1), type: 'mesh', parent: id, visible: true, locked: false, ...t, material: o.material, params: {}, modifiers: [], tracks: {}, geometry: geometryData(m.geometry) }));
        this.document.transact('Make cloner editable', s => { Object.assign(this.document.get(id), group); s.objects.push(...items); });
    }
    else
        this.document.update(id, { type: 'mesh', geometry: geometryData(m.geometry), modifiers: [] }, 'Make editable'); }
    async exportGLTF() { let { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js'); return new Promise((resolve, reject) => new GLTFExporter().parse(this.content, resolve, reject, { binary: true, onlyVisible: true })); }
    async importFile(file) { if (file.size > 20000000)
        throw Error('Import limit is 20 MB'); let root; if (/\.obj$/i.test(file.name)) {
        let { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
        root = new OBJLoader().parse(await file.text());
    }
    else if (/\.(gltf|glb)$/i.test(file.name)) {
        let { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        let buffer = await file.arrayBuffer();
        let parsed = await new GLTFLoader().parseAsync(buffer, '');
        root = parsed.scene;
    }
    else if (/\.stl$/i.test(file.name)) {
        let { STLLoader } = await import('three/addons/loaders/STLLoader.js');
        root = new THREE.Mesh(new STLLoader().parse(await file.arrayBuffer()));
    }
    else
        throw Error('Supported geometry: GLB, self-contained glTF, OBJ and STL'); let items = []; root.updateMatrixWorld(true); root.traverse(m => { if (!m.isMesh)
        return; let count = m.isInstancedMesh ? m.count : 1; for (let i = 0; i < count; i++) {
        let g = m.geometry.clone(), matrix = m.matrixWorld.clone();
        if (m.isInstancedMesh) {
            let instance = new THREE.Matrix4;
            m.getMatrixAt(i, instance);
            matrix.multiply(instance);
        }
        g.applyMatrix4(matrix);
        items.push({ id: uid(), name: (m.name || file.name) + (count > 1 ? ' ' + (i + 1) : ''), type: 'mesh', parent: null, visible: true, locked: false, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], material: this.document.scene.materials[0]?.id ?? null, geometry: geometryData(g), params: {}, modifiers: [], tracks: {} });
        g.dispose();
    } }); if (!items.length)
        throw Error('No meshes found'); this.document.transact('Import geometry', s => s.objects.push(...items)); this.document.select(items.map(o => o.id)); this.focus(); return items.length; }
    tick(t) { if (!this.ready || this.exporting)
        return; let dt = Math.min((t - this.last) / 1000, .1); this.last = t; if (this.playing) {
        this.updateFrame((this.frame + dt * this.document.scene.fps) % (this.document.scene.duration + 1));
        this.onFrame?.(this.frame);
    } this.orbit.update(); if (this.needsRender || this.playing) {
        if (this.quad)
            this.renderQuad();
        else {
            this.renderer.setScissorTest(false);
            this.renderer.render(this.scene, this.camera);
        }
        this.needsRender = false;
    } if (!this.lastStats || t - this.lastStats > 500) {
        this.stats.emit({ backend: this.backend, triangles: this.renderer.info.render.triangles, calls: this.renderer.info.render.drawCalls, fps: Math.round(1 / (dt || .016)) });
        this.lastStats = t;
    } }
    renderQuad() { let w = this.container.clientWidth, h = this.container.clientHeight, views = [[0, h / 2, w / 2, h / 2, this.camera], [w / 2, h / 2, w / 2, h / 2, 'Top'], [0, 0, w / 2, h / 2, 'Front'], [w / 2, 0, w / 2, h / 2, 'Right']]; this.quadCameras = []; this.renderer.setScissorTest(true); for (let [x, y, vw, vh, cam] of views) {
        let camera = cam;
        if (typeof cam === 'string') {
            camera = new THREE.OrthographicCamera(-7 * vw / vh, 7 * vw / vh, 7, -7, .01, 1000);
            let t = this.orbit.target, delta = { Top: [.001, 50, 0], Front: [0, 0, 50], Right: [50, 0, 0] }[cam];
            camera.position.copy(t).add(new THREE.Vector3(...delta));
            camera.lookAt(t);
        }
        else {
            camera.aspect = vw / vh;
            camera.updateProjectionMatrix();
        }
        this.quadCameras.push(camera);
        this.renderer.setViewport(x, y, vw, vh);
        this.renderer.setScissor(x, y, vw, vh);
        this.renderer.render(this.scene, camera);
    } this.renderer.setViewport(0, 0, w, h); this.renderer.setScissorTest(false); }
    dispose() { this.ready = false; this.renderer?.setAnimationLoop(null); this.resizeObserver?.disconnect(); this.disposers.forEach(f => f()); this.orbit?.dispose(); this.transform?.dispose(); for (let m of this.objects.values())
        this.disposeObject(m); for (let m of this.materials.values())
        m.dispose(); this.envTarget?.dispose(); this.renderer?.dispose(); this.renderer?.domElement.remove(); }
}
