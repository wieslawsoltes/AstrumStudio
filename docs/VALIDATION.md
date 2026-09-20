# Validation record — 0.1.0

## Source import

The recovered source was imported without rewriting Git history. All 156 authored/scaffold text files and 13 bundled Three.js files were verified by checksum before committing. `SOURCE-IMPORT.json` records their original archive hashes for provenance; it is a record of the import, not a constraint preventing later source changes. The bundled Three.js files match the official npm `three@0.184.0` package byte-for-byte. Temporary transfer fragments and recovery workflows are not part of the current source tree.

## Automated engine and integration tests

`npm test` contains 27 tests. All 27 passed locally and on GitHub's Node.js 24 runner during the source import, with no failures or skipped tests. Coverage includes:

- Demo serialization, validation, atomic rollback, history, graph duplication and deletion.
- Animation interpolation, seeded cloners, scene-operation merging, and invalid-input rejection.
- Triangle subdivision, extrusion, welding, deformation, interleaved-buffer extraction, and finite primitive geometry.
- Save-snapshot correctness, stale requests, edits during polling, and structural/independent merge conflicts.
- Real SQLite migrations, API project CRUD, permissions, revision conflicts, review notes, membership, cross-origin write rejection, and static serving/traversal protection.
- Local-storage snapshots, revision compare-and-swap, input validation, frame/object notes, project deletion cleanup, and explicit local-only sharing semantics.

`npm run build:pages` validates local module imports and relative entrypoint assets. `npm run package:libraries` builds four ESM/TypeScript-declaration library archives. Both commands passed locally and on the GitHub import runner without installing the hosting scaffold's dependencies.

## Browser and deployment gates

`.github/workflows/pages.yml` runs the tests and both builds, then runs `scripts/browser-smoke.py` in pinned Playwright Chromium with software rendering. It checks initialization, object creation, save/reload persistence, real IndexedDB concurrent writes, review notes, deletion, local sharing messages, desktop/compact screenshots, and the absence of runtime errors, missing assets, or accidental `/api/` requests.

Only a successful validation job can publish `dist-pages/` to GitHub Pages. A second browser pass exercises the actual published URL. Each run retains JSON reports and screenshots; inspect that run's conclusion rather than treating workflow configuration alone as a passing result. Pull requests validate without publishing. Successful builds also retain complete source and static-site ZIP archives plus the four installable library tarballs.

## Remaining qualification boundaries

The earlier hosted Vinext/Cloudflare build was checked in its original hosting environment; the Pages pipeline does not rebuild or deploy that separate backend. Headless software-rendering checks do not establish physical-GPU performance, complete visual correctness, PNG/GLB production export fidelity, cross-browser or mobile-touch qualification, accessibility compliance, networked collaboration scale, long-session memory stability, penetration testing, or production certification. They do not establish native Cinema 4D compatibility or complete feature parity.
