import{mkdir,rm,readFile,copyFile}from'node:fs/promises';import{posix}from'node:path';
const destination='public/studio/vendor';await mkdir(destination,{recursive:true});
for(const name of['three.webgpu.js','three.core.js','three.tsl.js'])await copyFile('node_modules/three/build/'+name,destination+'/'+name);
await rm(destination+'/addons',{recursive:true,force:true});const seen=new Set();
async function copyAddon(path){if(seen.has(path))return;seen.add(path);const source='node_modules/three/examples/jsm/'+path,content=await readFile(source,'utf8');await mkdir(posix.dirname(destination+'/addons/'+path),{recursive:true});await copyFile(source,destination+'/addons/'+path);for(const match of content.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+\.js)['"]/g))await copyAddon(posix.normalize(posix.join(posix.dirname(path),match[1])))}
for(const path of['controls/OrbitControls.js','controls/TransformControls.js','environments/RoomEnvironment.js','exporters/GLTFExporter.js','loaders/GLTFLoader.js','loaders/OBJLoader.js','loaders/STLLoader.js'])await copyAddon(path);
await copyFile('node_modules/three/LICENSE',destination+'/THREE-LICENSE.txt');console.log('Prepared Three.js and '+seen.size+' required addon modules');
