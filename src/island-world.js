import * as THREE from "three";

// A small toy woodland: shared low-poly geometry keeps the scenery lightweight.
export function createIslandWorld() {
  const world = new THREE.Group();
  world.name = "little-world";
  const palette = {
    grass: 0x88a66a, soil: 0xa08b71, rock: 0x8e9690,
    bark: 0x86604a, birch: 0xe5d9b4, dark: 0x466b55,
    leaf: 0x71945a, light: 0xa8b66d, pine: 0x527d68,
    peach: 0xc88f76, cream: 0xf3e4c4, roof: 0xb76f51,
    glass: 0x517c86, cloud: 0xe8eff0, path: 0xd1bc92,
  };
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) materials.set(color,
      new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
    return materials.get(color);
  };
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const stone = new THREE.IcosahedronGeometry(1, 0);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const stem = new THREE.CylinderGeometry(0.7, 1, 1, 6);
  const cone = new THREE.ConeGeometry(1, 1, 7);
  function mesh(geo, color, position, scale, parent = world, shadow = true) {
    const item = new THREE.Mesh(geo, mat(color));
    item.position.set(...position);
    item.scale.set(...scale);
    item.castShadow = shadow;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function island(parent, radius, depth) {
    mesh(new THREE.CylinderGeometry(radius, radius * 0.8, depth * 0.25, 12),
      palette.grass, [0, -depth * 0.125 - 0.025, 0], [1, 1, 1], parent);
    const underside = mesh(new THREE.ConeGeometry(radius * 0.81, depth, 12),
      palette.soil, [0, -depth * 0.71, 0], [1, 1, 1], parent);
    underside.rotation.z = Math.PI;
    // Exposed pale rock breaks up the otherwise uniform earthen sides.
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      mesh(stone, i % 2 ? palette.rock : palette.soil,
        [Math.cos(a) * radius * 0.57, -depth * 0.55, Math.sin(a) * radius * 0.57],
        [radius * 0.25, depth * 0.36, radius * 0.27], parent);
    }
  }
  island(world, 7, 5.8);

  function tree(x, z, kind, size = 1, rotation = 0) {
    const group = new THREE.Group();
    group.name = `island-tree-${kind}`;
    group.position.set(x, -0.02, z);
    group.scale.setScalar(size);
    group.rotation.y = rotation;
    world.add(group);
    if (kind === "pine") {
      mesh(stem, palette.bark, [0, 0.34, 0], [0.075, 0.68, 0.075], group);
      for (let layer = 0; layer < 3; layer++) {
        const radius = 0.43 - layer * 0.105;
        const leaves = mesh(cone, [palette.dark, palette.pine, palette.leaf][layer],
          [0, 0.63 + layer * 0.27, 0], [radius, 0.72 - layer * 0.12, radius], group);
        leaves.rotation.y = layer * 0.4;
      }
    } else {
      const birch = kind === "birch";
      mesh(stem, birch ? palette.birch : palette.bark,
        [0, 0.42, 0], [0.065, 0.84, 0.065], group);
      for (const side of [-1, 1]) {
        const branch = mesh(stem, birch ? palette.birch : palette.bark,
          [side * 0.1, 0.65, 0], [0.03, 0.38, 0.03], group);
        branch.rotation.z = -side * 0.6;
      }
      const shades = birch ? [palette.light, palette.leaf, palette.light]
        : [palette.leaf, palette.dark, palette.leaf];
      [[-0.22, 0.94, 0.02], [0.2, 1.12, -0.03], [0, 1.35, 0]].forEach((p, i) => {
        const leaves = mesh(crown, shades[i], p,
          birch ? [0.27, 0.4, 0.27] : [0.38, 0.34, 0.34], group);
        leaves.rotation.set(0.12 * i, i * 0.9, i * 0.2);
      });
      if (birch) {
        for (let i = 0; i < 3; i++)
          mesh(cube, palette.bark, [0.01, 0.22 + i * 0.15, 0.061],
            [0.07, 0.018, 0.008], group, false);
      }
    }
    return group;
  }
  const kinds = ["broadleaf", "pine", "birch", "broadleaf", "pine"];
  for (let i = 0; i < 20; i++) {
    const angle = i * 2.4;
    const radius = 3.2 + (i % 4) * 0.85;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    // Give the cottage a little clearing rather than intersecting its roof.
    if (Math.hypot(x + 2.7, z + 2.65) < 1.05) continue;
    tree(x, z, kinds[i % kinds.length], 0.72 + (i % 4) * 0.13, angle);
  }

  // Cottage, window boxes and stepping stones make the woodland feel inhabited.
  const cottage = new THREE.Group();
  cottage.position.set(-2.7, 0, -2.65);
  cottage.rotation.y = 0.22;
  world.add(cottage);
  mesh(cube, palette.cream, [0, 0.32, 0], [0.85, 0.64, 0.7], cottage);
  const roof = mesh(new THREE.ConeGeometry(0.71, 0.47, 4), palette.roof,
    [0, 0.86, 0], [1, 1, 1], cottage);
  roof.rotation.y = Math.PI / 4;
  mesh(cube, palette.soil, [0.23, 0.91, -0.12], [0.13, 0.43, 0.13], cottage);
  mesh(cube, palette.dark, [0, 0.23, 0.356], [0.19, 0.46, 0.025], cottage);
  mesh(stone, palette.cream, [0.06, 0.23, 0.378], [0.018, 0.018, 0.018], cottage);
  for (const x of [-0.26, 0.26]) {
    mesh(cube, palette.roof, [x, 0.44, 0.363], [0.2, 0.2, 0.025], cottage);
    mesh(cube, palette.glass, [x, 0.44, 0.38], [0.145, 0.14, 0.015], cottage);
    mesh(cube, palette.cream, [x, 0.44, 0.393], [0.018, 0.14, 0.012], cottage);
    mesh(cube, palette.roof, [x, 0.31, 0.39], [0.23, 0.08, 0.09], cottage);
    for (let j = 0; j < 3; j++)
      mesh(stone, j % 2 ? palette.peach : palette.light,
        [x + (j - 1) * 0.065, 0.37, 0.4], [0.045, 0.055, 0.04], cottage);
  }
  for (let i = 0; i < 6; i++) {
    const step = mesh(stone, palette.path,
      [-2.65 + i * 0.12, 0.003, -2.1 + i * 0.1], [0.14, 0.026, 0.1]);
    step.rotation.y = i * 0.7;
  }

  // Low foreground detail stays entirely beyond the robots' run-off lane.
  for (let i = 0; i < 10; i++) {
    const angle = i * 2.399 + 0.6, radius = 2.65 + (i % 3) * 0.9;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const boulder = mesh(stone, i % 2 ? palette.rock : palette.soil,
      [x, 0.075, z], [0.16, 0.14, 0.11]);
    boulder.rotation.y = angle;
    for (let j = 0; j < 3; j++) {
      mesh(crown, j % 2 ? palette.leaf : palette.light,
        [x + 0.14 + j * 0.075, 0.07, z - 0.07], [0.11, 0.085, 0.1]);
    }
  }
  const flowers = new THREE.InstancedMesh(stone, mat(0xffffff), 54);
  const stalks = new THREE.InstancedMesh(stem, mat(palette.dark), 54);
  const transform = new THREE.Object3D();
  const flowerColors = [palette.cream, palette.peach, 0xe5bf67];
  for (let i = 0; i < 54; i++) {
    const patch = Math.floor(i / 6), angle = patch * 2.399 + 0.4;
    const radius = 2.75 + (patch % 3) * 0.65;
    transform.position.set(Math.cos(angle) * radius + Math.sin(i * 4.7) * 0.2,
      0.075 + (i % 3) * 0.012, Math.sin(angle) * radius + Math.cos(i * 3.3) * 0.16);
    transform.scale.set(0.043, 0.017, 0.043);
    transform.updateMatrix();
    flowers.setMatrixAt(i, transform.matrix);
    flowers.setColorAt(i, new THREE.Color(flowerColors[patch % 3]));
    transform.position.y *= 0.5;
    transform.scale.set(0.006, transform.position.y * 2, 0.006);
    transform.updateMatrix();
    stalks.setMatrixAt(i, transform.matrix);
  }
  world.add(flowers, stalks);

  // A few distant landmarks reveal that this pitch really is above the clouds.
  for (const [x, y, z, radius] of [[-8.7, -0.8, -7, 1.1], [6.7, -1.3, -8.8, 0.85], [9, -1.8, 3.8, 0.7]]) {
    const outcrop = new THREE.Group();
    outcrop.position.set(x, y, z);
    world.add(outcrop);
    island(outcrop, radius, radius * 1.8);
    const sapling = tree(0, 0, "pine", radius * 0.62);
    outcrop.add(sapling);
  }
  for (const [x, y, z, size] of [[-8, -0.7, -4, 1.25], [0, -1.4, -10, 1.5], [7, -0.5, -6, 1.1], [-7, -2.1, 6, 1.1], [8, -2, 5, 1.2]]) {
    const cloud = new THREE.Group();
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(size);
    world.add(cloud);
    [[-0.65, 0, 0, 0.58], [0, 0.14, 0, 0.8], [0.65, 0.02, 0.08, 0.52]].forEach(([cx, cy, cz, s]) =>
      mesh(crown, palette.cloud, [cx, cy, cz], [s, s * 0.44, s * 0.67], cloud, false));
  }
  // Batch repeated static parts by geometry/material, including their shadows.
  world.updateMatrixWorld(true);
  const batches = new Map();
  world.traverse((item) => {
    if (!item.isMesh || item.isInstancedMesh) return;
    const key = `${item.geometry.uuid}/${item.material.uuid}/${item.castShadow}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(item);
  });
  for (const items of batches.values()) {
    if (items.length < 2) continue;
    const first = items[0];
    const batch = new THREE.InstancedMesh(first.geometry, first.material, items.length);
    batch.castShadow = first.castShadow;
    batch.receiveShadow = true;
    items.forEach((item, i) => {
      batch.setMatrixAt(i, item.matrixWorld);
      item.removeFromParent();
    });
    world.add(batch);
  }
  world.visible = false;
  return world;
}
