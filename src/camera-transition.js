import { Vector3 } from "three";

// One owner for the camera during a mode change. Follow/orbit resumes afterwards.
export class CameraTransition {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.active = false;
  }
  start({ position, target, offset, zoom, duration = 0.65 }) {
    if (this.active) this.finish();
    const camera = this.camera, controls = this.controls;
    this.fromPosition = camera.position.clone();
    this.fromTarget = controls.target.clone();
    this.fromZoom = camera.zoom;
    this.wasEnabled = controls.enabled;
    this.wasDamped = controls.enableDamping;
    // Drain OrbitControls' old drag/zoom inertia without displaying its last step.
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(this.fromPosition);
    controls.target.copy(this.fromTarget);
    camera.zoom = this.fromZoom;
    camera.updateProjectionMatrix();
    controls.update();
    controls.enabled = false;
    this.destination = {position, target, offset, zoom};
    this.elapsed = 0;
    this.duration = duration;
    this.active = true;
    if (duration === 0) this.update(0);
  }
  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    const t = this.duration === 0 ? 1 : Math.min(1, this.elapsed / this.duration);
    const eased = t * t * (3 - 2 * t);
    const {position, target, offset, zoom} = this.destination;
    const toTarget = typeof target === "function" ? target() : target;
    const toPosition = offset ? new Vector3().copy(toTarget).add(offset) : position;
    const toZoom = typeof zoom === "function" ? zoom() : zoom;
    this.camera.position.lerpVectors(this.fromPosition, toPosition, eased);
    this.controls.target.lerpVectors(this.fromTarget, toTarget, eased);
    this.camera.zoom = this.fromZoom + (toZoom - this.fromZoom) * eased;
    this.camera.updateProjectionMatrix();
    if (t === 1) this.finish();
  }
  finish() {
    this.controls.enabled = this.wasEnabled;
    this.controls.enableDamping = this.wasDamped;
    this.active = false;
  }
}
