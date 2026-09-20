// Generated from app/api/projects/route.ts. Regenerate with pnpm prepare:standalone.
import { db, user, json, error, body } from '../shared.mjs';
import { validateScene } from '../../../public/studio/packages/core/index.js';
export async function GET(req) { try {
    let u = user(req);
    let r = await db().prepare('SELECT DISTINCT p.id,p.name,p.revision,p.updated_at,p.owner FROM projects p LEFT JOIN members m ON m.project_id = p.id WHERE p.owner = ? OR m.email = ? ORDER BY p.updated_at DESC LIMIT 100').bind(u.id, u.email).all();
    return json(r.results);
}
catch (e) {
    return error(e);
} }
export async function POST(req) { try {
    let u = user(req), { scene } = await body(req);
    try {
        validateScene(scene);
    }
    catch (e) {
        e.status = 400;
        throw e;
    }
    let id = crypto.randomUUID();
    await db().prepare('INSERT INTO projects (id,owner,name,scene,revision,updated_at) VALUES (?,?,?,?,1,?)').bind(id, u.id, scene.name, JSON.stringify(scene), Date.now()).run();
    return json({ id, revision: 1 }, 201);
}
catch (e) {
    return error(e);
} }
