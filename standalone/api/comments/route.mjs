// Generated from app/api/comments/route.ts. Regenerate with pnpm prepare:standalone.
import { db, json, error, body, access } from '../shared.mjs';
export async function GET(req) { try {
    let id = new URL(req.url).searchParams.get('id') || '';
    await access(req, id);
    return json((await db().prepare('SELECT * FROM comments WHERE project_id = ? ORDER BY created_at DESC LIMIT 100').bind(id).all()).results);
}
catch (e) {
    return error(e);
} }
export async function POST(req) { try {
    let { id, text, objectId, frame } = await body(req), { u } = await access(req, id);
    if (typeof text !== 'string' || !text.trim() || text.length > 4000)
        return json({ error: 'Comment must contain 1–4000 characters' }, 400);
    await db().prepare('INSERT INTO comments (id,project_id,author,text,object_id,frame,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, u.email, text.trim(), typeof objectId === 'string' ? objectId : null, Number.isFinite(frame) ? frame : null, Date.now()).run();
    return json({ ok: true }, 201);
}
catch (e) {
    return error(e);
} }
