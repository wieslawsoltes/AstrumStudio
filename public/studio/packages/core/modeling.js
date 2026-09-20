/** Pure CPU topology operations: triangle subdivision, face extrusion, welding and deformation. */
export function subdivideMesh(mesh) { let p = [...mesh.positions], idx = mesh.indices || Array.from({ length: p.length / 3 }, (_, i) => i), out = [], edges = new Map; function midpoint(a, b) { let k = [Math.min(a, b), Math.max(a, b)].join(':'); if (edges.has(k))
    return edges.get(k); let n = p.length / 3; for (let j = 0; j < 3; j++)
    p.push((p[a * 3 + j] + p[b * 3 + j]) / 2); edges.set(k, n); return n; } if (idx.length > 750000)
    throw Error('Subdivision would exceed mesh limit'); for (let i = 0; i < idx.length; i += 3) {
    let [a, b, c] = idx.slice(i, i + 3), ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
} return { positions: p, indices: out }; }
export function extrudeFace(mesh, triangle, distance = 0.3) { let p = [...mesh.positions], idx = mesh.indices ? [...mesh.indices] : Array.from({ length: p.length / 3 }, (_, i) => i), offset = triangle * 3; if (offset < 0 || offset + 2 >= idx.length)
    throw Error('Select a polygon first'); let [a, b, c] = idx.slice(offset, offset + 3), v = i => p.slice(i * 3, i * 3 + 3), A = v(a), B = v(b), C = v(c), u = B.map((x, i) => x - A[i]), w = C.map((x, i) => x - A[i]), n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], len = Math.hypot(...n) || 1, start = p.length / 3; for (let point of [A, B, C])
    p.push(...point.map((x, i) => x + n[i] / len * distance)); idx.splice(offset, 3, start, start + 1, start + 2); for (let [x, y, j, k] of [[a, b, 0, 1], [b, c, 1, 2], [c, a, 2, 0]])
    idx.push(x, y, start + k, x, start + k, start + j); return { positions: p, indices: idx }; }
export function weldMesh(mesh, tolerance = 1e-5) { let p = [], map = new Map, remap = [], src = mesh.positions; for (let i = 0; i < src.length; i += 3) {
    let point = src.slice(i, i + 3), key = point.map(v => Math.round(v / tolerance)).join(',');
    if (!map.has(key)) {
        map.set(key, p.length / 3);
        p.push(...point);
    }
    remap.push(map.get(key));
} let idx = mesh.indices || Array.from({ length: src.length / 3 }, (_, i) => i); return { positions: p, indices: idx.map(i => remap[i]) }; }
export function deformPositions(positions, modifiers) { let p = Float32Array.from(positions); for (let m of modifiers || []) {
    if (m.enabled === false)
        continue;
    let strength = Number(m.strength) || 0;
    for (let i = 0; i < p.length; i += 3) {
        let x = p[i], y = p[i + 1], z = p[i + 2];
        if (m.type === 'twist') {
            let a = y * strength, c = Math.cos(a), s = Math.sin(a);
            p[i] = x * c - z * s;
            p[i + 2] = x * s + z * c;
        }
        else if (m.type === 'taper') {
            p[i] = x * (1 + y * strength * .25);
            p[i + 2] = z * (1 + y * strength * .25);
        }
        else if (m.type === 'bend' && Math.abs(strength) > .0001) {
            let a = y * strength, r = 1 / strength;
            p[i] = (r + x) * Math.cos(a) - r;
            p[i + 1] = (r + x) * Math.sin(a);
        }
        else if (m.type === 'inflate') {
            let n = Math.hypot(x, y, z) || 1;
            p[i] = x + x / n * strength;
            p[i + 1] = y + y / n * strength;
            p[i + 2] = z + z / n * strength;
        }
        else if (m.type === 'wave') {
            p[i + 1] = y + Math.sin(x * 2 + z * 2) * strength;
        }
        else if (m.type === 'noise') {
            p[i] = x + Math.sin(y * 7 + z * 11) * strength * .2;
            p[i + 1] = y + Math.sin(z * 9 + x * 13) * strength * .2;
            p[i + 2] = z + Math.sin(x * 11 + y * 5) * strength * .2;
        }
    }
} return p; }
