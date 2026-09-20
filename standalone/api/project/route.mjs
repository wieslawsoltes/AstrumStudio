// Generated from app/api/project/route.ts. Regenerate with pnpm prepare:standalone.
import { db, json, error, body, access } from '../shared.mjs';
import { applyOperations } from '../../../public/studio/packages/core/index.js';
export async function GET(req) { try {
    let id = new URL(req.url).searchParams.get('id') || '', { p, role } = await access(req, id);
    return json({ id: p.id, name: p.name, scene: JSON.parse(p.scene), revision: p.revision, role });
}
catch (e) {
    return error(e);
} }
export async function PATCH(req) { try {
    let { id, revision, ops } = await body(req), { p } = await access(req, id, true);
    if (p.revision !== revision)
        return json({ error: 'Another collaborator saved changes. Synchronize before saving.', revision: p.revision }, 409);
    if (!Array.isArray(ops) || ops.length > 6000)
        return json({ error: 'Invalid operation batch' }, 400);
    let scene;
    try {
        scene = applyOperations(JSON.parse(p.scene), ops);
    }
    catch (e) {
        e.status = 400;
        throw e;
    }
    let result = await db().prepare('UPDATE projects SET scene = ?,name = ?,revision = revision+1,updated_at = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(scene), scene.name, Date.now(), id, revision).run();
    if (!result.meta.changes)
        return json({ error: 'Project changed during save' }, 409);
    return json({ revision: revision + 1 });
}
catch (e) {
    return error(e);
} }
export async function DELETE(req) { try {
    let { id } = await body(req), { role } = await access(req, id, true);
    if (role !== 'owner')
        return json({ error: 'Only the owner can delete this project' }, 403);
    await db().batch([db().prepare('DELETE FROM comments WHERE project_id = ?').bind(id), db().prepare('DELETE FROM members WHERE project_id = ?').bind(id), db().prepare('DELETE FROM presence WHERE project_id = ?').bind(id), db().prepare('DELETE FROM projects WHERE id = ?').bind(id)]);
    return json({ ok: true });
}
catch (e) {
    return error(e);
} }
