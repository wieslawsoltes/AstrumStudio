# Astrum Studio

An independent browser-based 3D scene, modeling, motion-design, animation, and rendering workspace. The application UI is plain HTML, CSS, and JavaScript. Its standalone scene engine, topology operations, viewport, controls, and collaboration client are reusable ESM packages in one repository.

**Release 0.1.0 is a working initial implementation, not complete Cinema 4D parity or a production-qualified replacement.** See [the capability matrix](docs/FEATURES.md) for explicit boundaries.

## Live browser app

**[Open Astrum Studio on GitHub Pages](https://wieslawsoltes.github.io/AstrumStudio/)**

The public Pages edition saves projects and review notes **locally in your browser** using IndexedDB. It does not provide hosted accounts or network collaboration. Export Astrum scene files for backups and transfers; local project links do not share scene data with other people. The original server-backed edition is retained separately. See [GitHub Pages deployment](docs/GITHUB_PAGES.md).

```sh
# No dependency installation is needed for these commands.
npm test
npm run build:pages
python3 -m http.server 8080 --directory dist-pages
```

## Run the downloaded app — no installation or build

Install Node.js 24 or newer, extract the source archive, and run from the extracted directory:

```sh
node standalone/server.mjs
```

Open **http://localhost:8080**. The archive includes the required browser rendering modules and generated server modules. The launcher uses Node's built-in SQLite support; it creates `.astrum-data/projects.sqlite` for saved projects. It binds only to loopback and uses a single local identity. It is not a multiuser production server.

To use a different port:

```sh
ASTRUM_PORT=8081 node standalone/server.mjs
```

The hosted edition uses signed-in identities, Cloudflare D1, owner/editor/viewer authorization, shared review comments, and revision-checked synchronization. The initial hosted site is private. A project membership grant does not change site access or send an invitation email.

## First workflow

1. The editable **Orbital** scene opens with two orbital rings, a metallic core, an instanced satellite array, a plinth, a floor, and lights.
2. Select an object in the viewport or Object Manager. Use **E**, **R**, and **T** for translation, rotation, and scale; use **F** to frame the selection.
3. Change primitive parameters in **Attributes → Object**. Change transforms in **Coordinates**, surface properties in **Material**, and deformation in **Modifiers**.
4. Press **Space** to play the scene's actual keyframed animation. Scrub the timeline, press **K** to record a transform pose, and use **Edit keyframes** to edit timing, values, and interpolation.
5. For mesh editing, select a primitive, press **C** to make it editable, then choose point or polygon mode. Move a selected point with the gizmo, subdivide, weld coincident vertices, or extrude the selected triangle.
6. Use **Save** for a stored project; **File → Export Astrum scene** for a complete editable project file; **Render** for PNG output.

## Implemented systems

- Scene graph with stable IDs, hierarchy, world-preserving drag reparenting, naming, visibility, locking, duplication, grouping, validation, transactional rollback, undo/redo, and serialization.
- WebGPU-first raster viewport on Three.js 0.184.0, WebGL 2 fallback, PBR materials, environment lighting, shadows, orbit/pan/zoom, transform gizmos, snapping, local/world gizmo coordinates, and four-view preview.
- Nine parametric primitive types, mesh conversion, point movement, triangle extrusion, midpoint subdivision, welding, and ordered twist/bend/taper/inflate/wave/noise deformers.
- Instanced linear, radial, and grid cloners with counts, spacing, size, seed, deterministic random offsets, and conversion to independent editable meshes.
- Position, rotation, and scale animation; automatic keys; smooth/linear/step interpolation; transport; timing and frame-rate controls; keyframe editor; F-curve display.
- Material shelf and editor, asset browser, edit-history shelf, resizable attributes panel, light/dark themes, command search, keyboard shortcuts, compact-screen panel toggle.
- Astrum JSON import/export; geometry import from OBJ, STL, self-contained uncompressed glTF/GLB; binary GLB geometry export; PNG renders up to 4096 pixels per dimension, including alpha output.
- Durable project storage, revision checks, object-level merge of nonoverlapping changes, explicit conflict resolution, owner/editor/viewer permissions, frame/object review comments, and presence records.

## Repository structure

| Path | Purpose |
| --- | --- |
| `public/studio/index.html`, `app.js`, `studio.css` | Plain HTML/JS application |
| `public/studio/packages/core` | Independent scene document, animation, topology and procedural functions |
| `public/studio/packages/renderer` | Reusable Three.js WebGPU viewport and geometry interchange |
| `public/studio/packages/controls` | Framework-independent command registry, resizing, downloads, numeric custom element |
| `public/studio/packages/collaboration` | Revision-aware project client and merge coordination |
| `app/api` | Hosted API routes with identity and authorization checks |
| `db/schema.ts`, `drizzle` | Database schema and generated migrations |
| `standalone` | Build-free local launcher, SQLite adapter, generated shared API routes |
| `examples` | App-independent viewport example |
| `tests` | Engine, geometry, collaboration-race, API and storage checks |
| `docs` | API guide, architecture, capability boundaries, validation record |
| `artifacts/packages` | Generated installable library tarballs in the release archive |

The hosted shell uses the supplied Vinext/Cloudflare integration to serve the static application and API. The browser editor and reusable libraries do not depend on React. Existing starter dependencies are retained for the hosting build; they are unnecessary for the build-free local launcher.

## Development

The project uses the pinned pnpm version in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm prepare:studio
pnpm prepare:standalone
pnpm test
pnpm build
pnpm package:libraries
```

`prepare:studio` copies only required Three.js modules and their local addon dependencies. `prepare:standalone` transpiles the hosted API handlers to runnable local ESM without changing their behavior. It also runs automatically before the hosted build. After editing API source, regenerate before starting the standalone server or running API tests.

For the independent viewer example, serve the repository root with an HTTP server and open `examples/standalone-viewer.html`. The main application launcher serves only `public/`.

## Use the libraries independently

The downloadable archive includes four `.tgz` packages. They have ESM exports, TypeScript declarations, and MIT licensing for Astrum-authored code. They have been packaged locally; they have **not** been published to npm.

```sh
npm install ./artifacts/packages/astrum-core-0.1.0.tgz \
  ./artifacts/packages/astrum-renderer-0.1.0.tgz \
  ./artifacts/packages/astrum-controls-0.1.0.tgz \
  ./artifacts/packages/astrum-collaboration-0.1.0.tgz three@0.184.0
```

```js
import { SceneDocument, demoScene } from '@astrum/core';
import { Viewport } from '@astrum/renderer';

const document = new SceneDocument(demoScene());
const viewport = await new Viewport(containerElement, document).init();
document.add('cube', { name: 'My cube', position: [3, 1, 0] });
```

Read [API.md](docs/API.md) for events, transactions, serialization, modeling, rendering, and synchronization APIs.

## Validation and limits

Automated validation covers scene and geometry operations, hostile/invalid document rejection, stale-save and synchronization races, SQLite migrations, owner/editor/viewer access, revision conflicts, comments, and deletion cleanup. The hosting build succeeds. The Pages deployment adds headless Chromium smoke tests; see the workflow result for the tested commit. Physical-GPU qualification, accessibility certification, and production-scale performance testing remain outstanding. See [VALIDATION.md](docs/VALIDATION.md).

## License and attribution

Astrum-authored code is MIT licensed. Three.js is MIT licensed; its bundled notice is in `public/studio/vendor/THREE-LICENSE.txt`. Other development dependencies retain their respective licenses. No proprietary Cinema 4D source, icons, file SDK, or rendering technology is included. The workflow organization is independently implemented and inspired by conventional desktop DCC applications. Cinema 4D and Redshift are referenced only to identify feature and compatibility boundaries.
