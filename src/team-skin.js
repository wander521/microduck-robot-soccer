import * as THREE from "three";
const baseMaterials = new WeakMap();
function blueAccent(name) {
  if (/sole_/.test(name)) return 0x205fa0;
  if (/bottom_head_shell|^jaw\.stl|foot_|ankle_/.test(name)) return 0x2687d6;
  if (/soft_mouth_top|jaw_soft/.test(name)) return 0x71c4f1;
  return null;
}
// Geometry and neutral materials remain shared. Team accents are private to a rig.
export function setRigTeam(rig, team) {
  if (rig.team === team) return;
  const previous = rig.teamMaterials || new Set();
  const materials = new Map();
  rig.root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    if (!baseMaterials.has(mesh)) baseMaterials.set(mesh, mesh.material);
    const original = baseMaterials.get(mesh);
    const color =
      team === "blue" ? blueAccent(mesh.userData.meshName || "") : null;
    if (color === null) {
      mesh.material = original;
      return;
    }
    const key = original.uuid + ":" + color;
    if (!materials.has(key)) {
      const material = original.clone();
      material.color = new THREE.Color(color);
      materials.set(key, material);
    }
    mesh.material = materials.get(key);
  });
  for (const material of previous) material.dispose();
  rig.teamMaterials = new Set(materials.values());
  rig.team = team;
}
export function disposeTeamSkin(rig) {
  for (const material of rig.teamMaterials || []) material.dispose();
  rig.teamMaterials = new Set();
}
