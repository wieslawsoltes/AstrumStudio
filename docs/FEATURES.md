# Capability and compatibility matrix

This table describes implemented behavior in 0.1.0. “Implemented” means the code path exists with the limits stated here; it does not imply comprehensive professional qualification.

| Area | Implemented | Boundaries |
| --- | --- | --- |
| Scene | Stable graph, hierarchy, duplication, groups, visibility, lock, serialization, history | No layers, inherited Takes, XRefs, or arbitrary plugin objects. Grouping/reparenting is object-based; keyframes are not retargeted when changing animated parents. |
| Selection | Mesh raycast, hierarchy selection, Shift multi-selection, point and triangle modes | No edge, loop/ring, brush/lasso, soft-selection, or occluded-component selection. Quad view supports object picking and numeric editing; gizmos are disabled there. |
| Transforms | Move/rotate/scale, local/world gizmos, snapping | Numeric values are local. Multiobject gizmo translation updates siblings; multiobject rotation/scale uses the primary selection. A standalone Top/Front/Right view reorients the perspective camera; the secondary four-view previews are orthographic. |
| Modeling | Primitive dimensions, mesh conversion, point movement, triangle extrusion, midpoint subdivision, weld | No quad/ngon topology, bevel, Boolean kernel, remesher, sculpting, splines, sweep/loft, retopology, UV unwrap, or production topology repair. Subdivision splits triangles without Catmull–Clark smoothing. |
| Deformers | Ordered twist, bend, taper, inflate, wave, noise | CPU vertex deformation, without field volumes, weights, spatial bounds, GPU deformation, or arbitrary node graphs. Cloner deformers are not exposed. |
| Procedural cloning | GPU-instanced linear/radial/grid primitive cloners, seed/random offsets, editable conversion | Single primitive source per cloner. No nested source graphs, surface distribution, Fields, effectors, collision-aware distribution, or dynamic attributes. |
| Animation | Transform channels, record/auto key, editable keys, linear/smooth/step interpolation, F-curve display | Euler rotation, no tangent editing, nonlinear clips, constraints, rigging, skinning, morphs, parameter animation outside transforms, or audio. F-curves are displayed for rotation if present, otherwise position. |
| Rendering | Three.js WebGPURenderer with WebGL 2 fallback, raster PBR, environment light, shadowed key light, PNG up to 4096² | Not Redshift or a path tracer. No progressive GI, spectral transport, AOVs, EXR, motion blur, denoising, tiled rendering, network render farm, video encoding, or render queue. Added point lights illuminate without individual shadow maps. |
| Surfaces | Color, roughness, metalness; shared material assignment | No texture maps, UV editing, baking, layered materials, node materials, subsurface or volumetric pipelines. |
| Imports | Astrum JSON projects; OBJ/STL and uncompressed self-contained glTF/GLB geometry | Imported external materials, textures, UVs, animation, skinning, and semantic hierarchy are not retained. Draco/Meshopt/KTX codecs and external-file packages are not configured. Instanced GLB geometry is expanded into separate meshes. |
| Exports | Complete Astrum project JSON; static geometry GLB; PNG | GLB captures evaluated geometry/transforms at the current frame, not animation tracks or editor metadata. No native C4D, FBX, USD, Alembic, or proprietary SDK formats. |
| Persistence | D1 hosted projects; SQLite local projects; manual project export; temporary device recovery snapshot | 6 MB API request limit, 5000 objects, 1000 materials, 1000 instances per cloner, bounded geometry. Device recovery is best effort, not an offline synchronization log. |
| Collaboration | Authenticated roles, presence, review notes, 4-second polling, optimistic revisions, automatic object-level disjoint merge, explicit overlap/structural conflict resolution | No WebSocket/CRDT transport, live cursors, granular field merge, enterprise SSO/admin/audit/retention, or distributed locking. Remote merge resets local undo history. Site audience is separate from project permissions. |
| Local launcher | Native Node HTTP and SQLite, same API behavior under one local identity | Loopback only, single local user. Production multiuser deployment uses the hosted platform and D1. |
| UI | Desktop DCC organization, viewport/tree/attributes/timeline/material shelf, themes, command search, numeric inputs, shortcuts | Not pixel-identical UI parity; no detachable native windows, arbitrary docking, custom workspaces, comprehensive touch/accessibility qualification. |
| Distribution | Independent ESM packages and types, source archive, example, reproducible package script | No npm publication, native .NET wrappers, plugin ABI, long-term API stability guarantee, or comprehensive compatibility certification. |

## Reference workflows

The UI organization and feature boundaries were checked against Maxon's official product and workflow documentation:

- [Cinema 4D](https://www.maxon.net/en/cinema-4d)
- [Manager and workflow topics](https://www.maxon.net/en/certification/c4d-topics-list)
- [Modeling](https://www.maxon.net/en/cinema-4d/features/modeling)
- [Animation basics](https://www.maxon.net/en/cinema-4d/features/animation-basics)
- [MoGraph basics](https://www.maxon.net/en/cinema-4d/features/mograph-basics)
- [Take system](https://www.maxon.net/en/cinema-4d/features/take-system)
- [Three.js WebGPU renderer](https://threejs.org/docs/pages/WebGPURenderer.html)

Full professional parity would require implementing and qualifying the missing systems above, along with many additional interchange, pipeline, plugin, and platform behaviors. This release makes no such parity claim.
