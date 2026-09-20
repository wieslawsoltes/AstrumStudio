# Astrum library API

## Core

`@astrum/core` has no DOM or renderer dependency. Transforms use world units, local position/scale vectors, and Euler XYZ rotations in degrees. An object has a stable ID and optional parent ID. Meshes use triangle indices and XYZ positions.

```js
import { SceneDocument, emptyScene, evaluateObject } from '@astrum/core';

const document = new SceneDocument(emptyScene());
const cube = document.add('cube', { name: 'Hero', position: [0, 2, 0] });
const unsubscribe = document.changed.subscribe(({ label, scene }) => {
  console.log(label, scene.objects.length);
});
document.transact('Move hero', () => {
  document.get(cube.id).position = [2, 2, 0];
});
document.select([cube.id]);
document.keyframe([cube.id], 0);
document.update(cube.id, { rotation: [0, 360, 0] });
document.keyframe([cube.id], 180);
const pose = evaluateObject(document.get(cube.id), 90);
document.undo();
document.redo();
const json = document.serialize();
unsubscribe();
```

`transact()` snapshots before and after, validates the result, rolls back invalid operations, records one history entry, and emits `changed`. All persistent document mutation should go through a transaction. History is bounded to 80 entries. `replace()` validates and loads a document while resetting history and selection.

`keyframe()` records the document's stored base transforms. To record a currently evaluated viewport pose, read the viewport object transforms and write the desired key values in a transaction, as the application does. `evaluateObject()` returns a sampled view without mutating the document.

`reparent()` on `SceneDocument` changes parent IDs and validates cycles. Use `Viewport.reparent()` when world-transform preservation is needed. Reparenting animated objects does not retarget all animation keys.

`cloneTransforms()` returns deterministic instance transforms for linear/radial/grid distributions. `seededRandom()` provides reproducible procedural randomness. `diffScenes()` and `applyOperations()` create and apply object/material or metadata operations; operation application validates the completed scene.

## Topology

```js
import { subdivideMesh, extrudeFace, weldMesh, deformPositions } from '@astrum/core/modeling';

const refined = subdivideMesh(mesh);        // four triangles per input triangle
const raised = extrudeFace(mesh, 0, 0.25); // cap and three side walls
const welded = weldMesh(mesh, 1e-5);
const positions = deformPositions(mesh.positions, [
  { type: 'twist', strength: 0.5, enabled: true }
]);
```

These functions are nonmutating. Mesh subdivision shares midpoint vertices along indexed edges. It does not implement smoothing subdivision. Extrusion operates on one triangle, not an arbitrary coplanar region. Welding uses quantized positional equivalence and does not preserve UV seams because UV attributes are outside the current mesh format.

## Renderer

`@astrum/renderer` depends on Three.js 0.184.0 and `@astrum/core`. It is browser-oriented and app-independent. Call `await init()` before using renderer-dependent methods. The container must have nonzero dimensions.

```js
import { Viewport } from '@astrum/renderer';
const viewport = await new Viewport(container, document).init();
viewport.setTool('translate');
viewport.setSpace('local');
viewport.setSnap(true);
viewport.updateFrame(48);
viewport.focus();
const png = await viewport.exportPNG(1920, 1080, true);
const binaryGLB = await viewport.exportGLTF();
viewport.stats.subscribe(({ backend, triangles, calls }) => console.log(backend, triangles, calls));
// When removing the host control:
viewport.dispose();
```

The renderer maintains scene objects and shared materials, caches geometry descriptions, uses instancing for procedural clones, and renders on scene/camera change or during playback. CPU scene validation, undo snapshots, deformation, and synchronization are not GPU-accelerated. `quad=true` produces one perspective plus three orthographic previews; gizmo editing is intentionally disabled in quad mode.

For an unbundled browser integration, map `three`, `three/webgpu`, `three/tsl`, and the `three/addons/` prefix as in `examples/standalone-viewer.html`. Do not mix mismatched Three.js versions. The distributed npm package imports `three/webgpu` explicitly.

## Controls

`@astrum/controls` provides `CommandRegistry`, `PanelResizer`, `escapeHTML`, `download`, `debounce`, and the optional `<astrum-number>` custom element. It does not depend on the studio shell. The shell supplies layout, theme CSS, and its selection/inspector bindings.

```js
import { CommandRegistry } from '@astrum/controls';
const commands = new CommandRegistry();
const unregister = commands.register('undo', 'Undo', () => document.undo(), 'Ctrl Z');
commands.execute('undo');
console.log(commands.search('un'));
unregister();
```

## Collaboration

`@astrum/collaboration` provides the client protocol; it needs a compatible authenticated HTTP API.

```js
import { ProjectClient } from '@astrum/collaboration';
const client = new ProjectClient('/api');
await client.create(document.scene);
await client.save(document.scene);
const update = await client.sync(() => document.scene, () => !dragInProgress);
if (update?.conflict) {
  // Present the remote version and preserve/export local work for resolution.
} else if (update?.scene) {
  document.replace(update.scene);
}
```

Always use a current-scene getter for synchronization when the document can be replaced by undo/redo or other actions. The client snapshots outgoing creates/saves before I/O and uses generation checks so late responses cannot cross project boundaries. `reset()` invalidates the current project. Automatic retries must preserve local edits and respect conflicts.

The application polls every four seconds and saves changes after an idle delay. Object/material records form conflict units; unrelated properties of the same object still conflict. Structural invalidity after a disjoint-ID merge also invokes conflict resolution.

## HTTP API

All hosted APIs require trusted platform identity headers and enforce project membership server-side. Never expose a deployment that lets untrusted clients set the forwarded identity headers. The local launcher overwrites these headers with its fixed local identity and binds only to loopback.

| Endpoint | Methods | Behavior |
| --- | --- | --- |
| `/api/session` | GET | Current identity |
| `/api/projects` | GET, POST | List accessible projects; create validated scene |
| `/api/project?id=…` | GET | Load scene, revision, role |
| `/api/project` | PATCH, DELETE | Compare-and-swap operation batch; owner deletion |
| `/api/members?id=…` | GET | Roles and recent presence |
| `/api/members` | POST, DELETE, PATCH | Owner membership management; current-user presence |
| `/api/comments?id=…` | GET | Shared review notes |
| `/api/comments` | POST | Add a note, optional object/frame context |

PATCH `/api/project` accepts `{ id, revision, ops }`. Both the initial read and conditional SQL UPDATE enforce optimistic revision checks. A conflict returns HTTP 409. Role and origin failures return HTTP 403; missing identity returns 401. Invalid document content returns 400. Server storage failures return a recoverable error, without clearing the user's input.


## Browser-local persistence (static hosting)

`LocalProjectClient` in `packages/collaboration/local.js` implements the same save, load, list, revision, and review-note interface as `ProjectClient`, using IndexedDB rather than HTTP. The packaged subpath is `@astrum/collaboration/local`. Instantiate it with a deployment-specific database name and call `dispose()` when finished. `mode` is `local`; invitations and remote membership operations are explicitly unsupported. Browser storage is not a backup or online sharing service.
