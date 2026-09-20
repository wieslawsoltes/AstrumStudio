import type{MeshData,SceneObject}from'./index.js';
export function subdivideMesh(mesh:MeshData):MeshData;
export function extrudeFace(mesh:MeshData,triangle:number,distance?:number):MeshData;
export function weldMesh(mesh:MeshData,tolerance?:number):MeshData;
export function deformPositions(positions:ArrayLike<number>,modifiers:SceneObject['modifiers']):Float32Array;
