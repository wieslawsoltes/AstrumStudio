const vendor = new URL('../public/studio/vendor/', import.meta.url);
export function resolve(specifier, context, nextResolve) {
    const files = { three: 'three.webgpu.js', 'three/webgpu': 'three.webgpu.js', 'three/tsl': 'three.tsl.js' };
    const path = files[specifier] || (specifier.startsWith('three/addons/') ? 'addons/' + specifier.slice(13) : null);
    return path ? { url: new URL(path, vendor).href, shortCircuit: true } : nextResolve(specifier, context);
}
