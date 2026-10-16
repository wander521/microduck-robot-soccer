import test from "node:test";
import assert from "node:assert/strict";
import {PerspectiveCamera, Vector3} from "three";
import {CameraTransition} from "../src/camera-transition.js";
function fixture() {
  const camera = new PerspectiveCamera(52, 1.6, .008, 1000);
  camera.position.set(1.9, 2.077, 2.3);
  let inertia = .3;
  const controls = {target:new Vector3(0,.177,0), enabled:true, enableDamping:true,
    update() {camera.position.x += inertia; inertia = this.enableDamping ? inertia*.9 : 0;}};
  return {camera, controls, transition:new CameraTransition(camera, controls)};
}
test("a camera handoff drains orbit inertia without a first-frame jump", () => {
  const {camera,controls,transition} = fixture();
  const initial = camera.position.clone();
  transition.start({position:new Vector3(0,.85,2.15),target:new Vector3(0,.18,-.12),zoom:.8});
  assert.ok(camera.position.distanceTo(initial) < 1e-12);
  controls.update();
  assert.ok(camera.position.distanceTo(initial) < 1e-12);
  transition.update(1/60);
  assert.ok(camera.position.distanceTo(initial) < .01);
  assert.equal(controls.enabled,false);
  for (let i=0;i<40;i++) transition.update(1/60);
  assert.equal(transition.active,false);
  assert.ok(camera.position.distanceTo(new Vector3(0,.85,2.15)) < 1e-12);
  assert.equal(controls.enabled,true);
  assert.equal(controls.enableDamping,true);
});
test("returning to follow uses the player's moving current position and supports interruption", () => {
  const {camera,controls,transition} = fixture();
  const target = new Vector3(.7,.177,-.12), offset = new Vector3(1.9,1.9,2.3);
  transition.start({target:()=>target.clone(),offset,zoom:1});
  transition.update(.2);
  const mid = camera.position.clone();
  transition.start({target:()=>target.clone(),offset,zoom:1});
  assert.ok(camera.position.distanceTo(mid) < 1e-12);
  target.x += .2;
  transition.update(1);
  assert.ok(controls.target.distanceTo(target) < 1e-12);
  assert.ok(camera.position.distanceTo(target.clone().add(offset)) < 1e-12);
});
test("reduced-motion camera cuts leave controls usable", () => {
  const {camera,controls,transition} = fixture();
  transition.start({position:new Vector3(0,1,2),target:new Vector3(),zoom:1,duration:0});
  assert.equal(transition.active,false);
  assert.equal(controls.enabled,true);
  assert.ok(camera.position.distanceTo(new Vector3(0,1,2)) < 1e-12);
});
