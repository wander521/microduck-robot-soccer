import { Matrix4, Mesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Only call for scenery whose local transforms never change. Keep animated,
// transparent and individually recolored parts outside the batch.
export function batchStaticMeshes(root, exclude = []) {
  root.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert();
  const excluded = new Set();
  for (const object of exclude) object.traverse((child) => excluded.add(child));
  const batches = new Map();
  root.traverse((mesh) => {
    if (
      !mesh.isMesh ||
      mesh.isInstancedMesh ||
      !mesh.visible ||
      excluded.has(mesh) ||
      Array.isArray(mesh.material) ||
      mesh.material.transparent ||
      mesh.geometry.morphAttributes.position
    )
      return;
    const attributes = Object.entries(mesh.geometry.attributes)
      .map(([name, value]) => `${name}:${value.itemSize}:${value.normalized}`)
      .sort()
      .join("/");
    const key = `${mesh.material.uuid}/${mesh.castShadow}/${mesh.receiveShadow}/${mesh.renderOrder}/${attributes}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  });
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      return geometry.applyMatrix4(
        new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
      );
    });
    const geometry = mergeGeometries(geometries);
    for (const part of geometries) part.dispose();
    if (!geometry) continue;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const first = meshes[0];
    const batch = new Mesh(geometry, first.material);
    batch.name = "static-scenery-batch";
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    batch.matrixAutoUpdate = false;
    root.add(batch);
    for (const mesh of meshes) mesh.removeFromParent();
  }
}
