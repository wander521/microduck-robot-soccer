import test from "node:test";
import assert from "node:assert/strict";
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Box3 } from "three";
import { batchStaticMeshes } from "../src/static-batch.js";
import { setText, setAttribute, setProperty } from "../src/dom-updates.js";

test("unchanged snapshots preserve DOM text nodes and reflected attributes", () => {
  let writes = 0,
    text = "0",
    disabled = false;
  const attrs = new Map([["aria-pressed", "false"]]);
  const element = {
    get textContent() {
      return text;
    },
    set textContent(value) {
      writes++;
      text = value;
    },
    get disabled() {
      return disabled;
    },
    set disabled(value) {
      writes++;
      disabled = value;
    },
    getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => {
      writes++;
      attrs.set(key, value);
    },
  };
  for (let i = 0; i < 50; i++) {
    setText(element, 0);
    setAttribute(element, "aria-pressed", false);
    setProperty(element, "disabled", false);
  }
  assert.equal(writes, 0);
  assert.equal(setText(element, 1), true);
  setAttribute(element, "aria-pressed", true);
  setProperty(element, "disabled", true);
  assert.equal(writes, 3);
  assert.equal(text, "1");
  assert.equal(disabled, true);
});

test("static batching preserves transformed scenery, shadow groups and independent moving parts", () => {
  const root = new Group();
  root.position.set(3, 2, -1);
  root.rotation.y = 0.4;
  const nested = new Group();
  nested.rotation.z = 0.3;
  root.add(nested);
  const material = new MeshBasicMaterial();
  for (let i = 0; i < 3; i++) {
    const mesh = new Mesh(new BoxGeometry(), material);
    mesh.position.set(i * 2, i, 0);
    mesh.scale.set(1, i + 1, 0.5);
    mesh.castShadow = true;
    nested.add(mesh);
  }
  const independentlyColored = new Mesh(new BoxGeometry(), material);
  independentlyColored.position.z = 10;
  root.add(independentlyColored);
  const moving = new Group();
  const transparent = new Mesh(
    new BoxGeometry(),
    new MeshBasicMaterial({ transparent: true }),
  );
  moving.add(new Mesh(new BoxGeometry(), material));
  root.add(moving, transparent);
  const before = new Box3().setFromObject(root);
  batchStaticMeshes(root, [moving, independentlyColored]);
  root.updateMatrixWorld(true);
  const after = new Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min) < 1e-5);
  assert.ok(before.max.distanceTo(after.max) < 1e-5);
  const batch = root.getObjectByName("static-scenery-batch");
  assert.equal(batch.geometry.attributes.position.count, 3 * 36);
  assert.equal(batch.castShadow, true);
  assert.equal(batch.material, material);
  assert.equal(nested.children.length, 0);
  assert.equal(independentlyColored.parent, root);
  assert.equal(transparent.parent, root);
  assert.equal(moving.children.length, 1);
});
