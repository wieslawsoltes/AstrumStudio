// Generated from app/api/session/route.ts. Regenerate with pnpm prepare:standalone.
import { user, json, error } from '../shared.mjs';
export async function GET(req) { try {
    return json(user(req));
}
catch (e) {
    return error(e);
} }
