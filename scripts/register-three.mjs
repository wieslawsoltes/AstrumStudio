// Resolve Node tests against exactly the same bundled Three.js modules as the browser.
import { register } from 'node:module';
register('./three-loader.mjs', import.meta.url);
