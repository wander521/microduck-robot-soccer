import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { setRigTeam, disposeTeamSkin } from "../src/team-skin.js";
test("blue accents are isolated per robot and switch back to original orange without tinting its team", () => {
  const material = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const neutral = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
  const make = () => {
    const root = new THREE.Group();
    for (const name of ["jaw.stl", "sole_left.stl", "top_head_shell.stl"]) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(),
        name === "top_head_shell.stl" ? neutral : material,
      );
      mesh.userData.meshName = name;
      root.add(mesh);
    }
    return { root };
  };
  const blue = make(),
    orange = make();
  setRigTeam(blue, "blue");
  setRigTeam(orange, "orange");
  assert.notEqual(blue.root.children[0].material, material);
  assert.equal(orange.root.children[0].material, material);
  assert.equal(material.color.getHex(), 0xff6600);
  assert.equal(blue.root.children[0].material.color.getHex(), 0x2687d6);
  assert.equal(blue.root.children[1].material.color.getHex(), 0x205fa0);
  assert.equal(blue.root.children[2].material, neutral);
  setRigTeam(blue, "orange");
  assert.equal(blue.root.children[0].material, material);
  setRigTeam(orange, "blue");
  assert.equal(orange.root.children[0].material.color.getHex(), 0x2687d6);
  assert.equal(blue.root.children[0].material.color.getHex(), 0xff6600);
  disposeTeamSkin(blue);
  disposeTeamSkin(orange);
});
