# Validation record — 0.1.0

Automated tests run with Node's built-in test runner. The suite contains 20 passing tests covering:

- Demo serialization, scene validation, atomic rollback, history, graph duplication and deletion.
- Linear/step animation sampling, deterministic cloners, object-operation merging.
- Rejection of unsafe identifiers, malformed settings/materials, and invalid mesh data.
- Triangle subdivision, extrusion, welding, deformation and interleaved-buffer import extraction.
- Geometry generation for every editable primitive.
- Save snapshot correctness, stale project request isolation, undo during polling, structural conflicts and independent merges.
- Real SQLite migration application and API project creation/read/update/deletion.
- Owner/editor/viewer and outsider authorization; conditional revision conflicts; review notes and membership.
- Cross-origin write rejection and serving the actual static application entrypoints.

All four generated library tarballs were extracted into an isolated package tree, imported, and executed together successfully. Seven authored application JavaScript modules pass syntax checking, and their local import/asset references resolve.

The hosted Vinext/Cloudflare build completes and emits the Worker, static assets, logical D1 configuration, and generated migration. Standalone API tests execute the generated handlers against Node SQLite. Source JavaScript is syntax-checked, and required local import/asset paths are checked when preparing the release.

Not performed: browser-driven interaction testing, screenshot/visual QA, physical-GPU rendering or PNG/GLB export qualification, cross-browser testing, accessibility audit, networked multiple-browser testing, stress testing, long-session memory qualification, penetration testing, or production certification. The suite does not establish full visual correctness or native Cinema 4D compatibility.
