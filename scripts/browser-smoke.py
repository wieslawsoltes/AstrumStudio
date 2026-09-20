"""Exercise the static editor at a GitHub project subpath using real IndexedDB."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import tempfile
import threading
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

async def check(base):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH') or None,
            headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
        page = await context.new_page()
        errors, failed, api = [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failed.append([r.status, r.url]) if r.status >= 400 else None)
        page.on('request', lambda r: api.append(r.url) if '/api/' in r.url else None)
        await page.goto(base, wait_until='networkidle')
        await page.wait_for_function('window.astrum?.viewport?.ready', timeout=90000)
        info = await page.evaluate('({backend:astrum.viewport.backend,objects:astrum.document.scene.objects.length,mode:astrum.client.mode})')
        assert info['mode'] == 'local' and info['objects'] > 0, info
        await page.locator('.title-actions [data-action="save"]').click()
        await page.wait_for_function('window.astrum.client.project && !window.astrum.client.busy')
        project = await page.evaluate('astrum.client.project')
        await page.reload(wait_until='networkidle')
        await page.wait_for_function('window.astrum?.client?.project', timeout=60000)
        assert await page.evaluate('astrum.client.project') == project
        await page.evaluate("astrum.commands.execute('create-cube')")
        await page.locator('.title-actions [data-action="save"]').click()
        await page.wait_for_function('!astrum.client.busy')
        count = await page.evaluate('astrum.document.scene.objects.length')
        await page.reload(wait_until='networkidle')
        await page.wait_for_function('window.astrum?.client?.project', timeout=60000)
        assert await page.evaluate('astrum.document.scene.objects.length') == count
        await page.locator('.share-button').click()
        assert 'There are no online accounts' in await page.locator('#dialog-content').inner_text()
        await page.locator('#dialog-close').click()
        storage = await page.evaluate('''async () => {
            const {LocalProjectClient} = await import('./packages/collaboration/local.js');
            const {clone} = await import('./packages/core/index.js');
            const a = new LocalProjectClient(astrum.client.databaseName);
            const b = new LocalProjectClient(astrum.client.databaseName);
            const pa = await a.load(astrum.client.project), pb = await b.load(astrum.client.project);
            const sa = clone(pa.scene), sb = clone(pb.scene);
            sa.name = 'Race A'; sb.name = 'Race B';
            const saved = await Promise.allSettled([a.save(sa), b.save(sb)]);
            if (saved.filter(x => x.status === 'fulfilled').length !== 1 ||
                saved.find(x => x.status === 'rejected')?.reason.status !== 409)
                throw Error('Atomic revision comparison failed');
            await a.comment('Browser review', pa.scene.objects[0].id, 42);
            const notes = await b.comments();
            if (notes[0].frame !== 42) throw Error('Local review notes failed');
            const temporary = new LocalProjectClient(astrum.client.databaseName);
            const tmp = await temporary.create(pa.scene);
            await temporary.comment('Delete with project', undefined, 0);
            await temporary.request('/project', 'DELETE', {id:tmp.id});
            try { await temporary.comments(); throw Error('Deleted project was accessible'); }
            catch (e) { if (e.status !== 404) throw e; }
            a.dispose(); b.dispose(); temporary.dispose();
            return {cas:'one writer accepted', comments:notes.length, deletion:'verified'};
        }''')
        output = ROOT / 'test-results'
        output.mkdir(exist_ok=True)
        await page.screenshot(path=str(output / 'pages-desktop.png'), full_page=True)
        # A link originating on another browser must not prevent editor initialization.
        await page.goto(base + '?project=missing-local-project', wait_until='networkidle')
        await page.wait_for_function('window.astrum?.viewport?.ready', timeout=60000)
        assert 'Project not found in this browser' in await page.locator('#toast').inner_text()
        await page.set_viewport_size({'width': 1000, 'height': 750})
        await page.screenshot(path=str(output / 'pages-compact.png'), full_page=True)
        result = {'startup':info, 'persistedObjects':count, 'storage':storage,
                  'runtimeErrors':errors, 'failedRequests':failed, 'apiRequests':api}
        print(json.dumps(result, indent=2))
        (output / 'browser-smoke.json').write_text(json.dumps(result, indent=2))
        assert not errors, errors
        assert not failed, failed
        assert not api, api
        await browser.close()

if __name__ == '__main__':
    with tempfile.TemporaryDirectory(prefix='astrum-pages-') as directory:
        (Path(directory) / 'AstrumStudio').symlink_to(ROOT / 'dist-pages', target_is_directory=True)
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=directory))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            asyncio.run(check(f'http://127.0.0.1:{server.server_port}/AstrumStudio/'))
        finally:
            server.shutdown()
            thread.join()
            server.server_close()
