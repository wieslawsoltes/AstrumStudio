import { cp, mkdir, readFile, writeFile, rm, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'public/studio');
const target = resolve(root, 'dist-pages');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
await cp(resolve(root, 'public/favicon.svg'), resolve(target, 'favicon.svg'));
const html = await readFile(resolve(target, 'index.html'), 'utf8');
if (!html.includes('<html lang="en">')) throw new Error('Unrecognized studio HTML entrypoint');
await writeFile(resolve(target, 'index.html'), html.replace('<html lang="en">', '<html lang="en" data-storage="local">'));
await writeFile(resolve(target, '.nojekyll'), '');

async function verify(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Symlinks are not permitted in Pages output');
        if (entry.isDirectory()) { await verify(path); continue; }
        if (!path.endsWith('.js')) continue;
        const js = await readFile(path, 'utf8');
        for (const match of js.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+\.js)['"]/g))
            await access(resolve(dirname(path), match[1]));
    }
}
await verify(target);
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await access(resolve(target, match[1]));
if (/(?:src|href)="\//.test(html)) throw new Error('Root-relative asset URL breaks project Pages hosting');
console.log('Built dist-pages: portable static editor with browser-local IndexedDB storage.');
