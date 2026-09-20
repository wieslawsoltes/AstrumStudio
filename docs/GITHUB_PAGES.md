# GitHub Pages deployment

Public demo: https://wieslawsoltes.github.io/AstrumStudio/

The Pages edition is the same plain HTML/JavaScript editor with a static-hosting persistence adapter. It has no server runtime, login service, or hosted database.

## Storage and sharing

**Save locally** writes the scene to IndexedDB in the current browser profile, scoped to this deployment path. Saved projects and local review notes survive ordinary reloads. Clearing site data, deleting a browser profile, or private-browsing cleanup may remove them. Keep backups with **File → Export Astrum scene**.

A project URL identifies a record in that browser only. It is not an online share link and will not open the scene on another device. The account and collaboration dialogs explain these boundaries instead of presenting nonfunctional invitations. Transfer editable project files using export/import.

Tabs within the same browser profile use atomic IndexedDB transactions with revision compare-and-swap, and the existing object-level merge/conflict flow. This is not network collaboration or CRDT coediting.

The original hosted API, database schema, migrations, and standalone SQLite server remain in the repository. For team accounts and shared projects, deploy the server-backed edition separately; GitHub Pages does not execute that API.

## Build without installing dependencies

The repository includes its pinned Three.js browser modules. With Node.js 24 or newer:

```sh
npm test
npm run build:pages
python3 -m http.server 8080 --directory dist-pages
```

Open http://localhost:8080. Only `dist-pages/` is published. Its entrypoint uses relative asset paths and explicitly selects browser-local storage; no server files or credentials enter that directory.

## Automated deployment

`.github/workflows/pages.yml` tests the source, builds the static editor, runs the browser smoke test, and uses the official GitHub Pages artifact/deployment actions. Pushes to `main` deploy after checks succeed; pull requests run validation without publishing. The workflow also supports manual dispatch.

The browser smoke test runs headless Chromium with software rendering. It checks the repository subpath, initialization, object creation, save/reload persistence, local comments, concurrent revision conflicts, clear sharing limits, absence of `/api/` traffic, and missing asset/runtime errors. This is not physical-GPU qualification.

A one-time source import workflow is used to transfer the recovered archive into GitHub. It verifies checksums before writing files and restores the pinned vendor modules from the official npm package. It is removed after the import is verified. Generated library tarballs remain build/release artifacts rather than tracked files.
