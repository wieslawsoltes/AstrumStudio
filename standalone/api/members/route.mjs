// Generated from app/api/members/route.ts. Regenerate with pnpm prepare:standalone.
import { db, json, error, body, access } from '../shared.mjs';
export async function GET(req) { try {
    let id = new URL(req.url).searchParams.get('id') || '', { role } = await access(req, id);
    let members = await db().prepare('SELECT email,role FROM members WHERE project_id = ?').bind(id).all(), online = await db().prepare('SELECT name,selection,updated_at FROM presence WHERE project_id = ? AND updated_at > ?').bind(id, Date.now() - 20000).all();
    return json({ role, members: members.results, online: online.results });
}
catch (e) {
    return error(e);
} }
export async function POST(req) { try {
    let { id, email, role } = await body(req), a = await access(req, id, true);
    if (a.role !== 'owner')
        return json({ error: 'Only the project owner can manage access' }, 403);
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || !['editor', 'viewer'].includes(role))
        return json({ error: 'Enter a valid email and role' }, 400);
    await db().prepare('INSERT INTO members (id,project_id,email,role) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET role = excluded.role').bind(id + ':' + email.toLowerCase(), id, email.toLowerCase(), role).run();
    return json({ ok: true });
}
catch (e) {
    return error(e);
} }
export async function DELETE(req) { try {
    let { id, email } = await body(req), a = await access(req, id, true);
    if (a.role !== 'owner')
        return json({ error: 'Only the owner can remove access' }, 403);
    await db().prepare('DELETE FROM members WHERE project_id = ? AND email = ?').bind(id, email).run();
    return json({ ok: true });
}
catch (e) {
    return error(e);
} }
export async function PATCH(req) { try {
    let { id, selection } = await body(req), { u } = await access(req, id);
    await db().prepare('INSERT INTO presence (id,project_id,name,selection,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET selection=excluded.selection,updated_at=excluded.updated_at').bind(id + ':' + u.id, id, u.email, JSON.stringify(Array.isArray(selection) ? selection.slice(0, 100) : []), Date.now()).run();
    return json({ ok: true });
}
catch (e) {
    return error(e);
} }
