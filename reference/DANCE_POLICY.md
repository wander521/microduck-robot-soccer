# Trained MicroDuck dance policy

The deployed policy is the existing checkpoint from the separate DuckEMW training task, not scripted joint choreography. The fixed deployed ID, SHA-256, checkpoint and observation/action contract are recorded in `public/assets/policies/duckemw_dance.json`. The 4096-environment / 4000-iteration run completed successfully with seed 42. The deployed checkpoint is 3500, selected for lower long-run drift: about 0.062 m in the native 122-second evaluation, compared with 0.493 m for checkpoint 3999. Its SHA-256 is `2e6c33f93826cd0b325885a2577d22fcc93715625a4174dc08694fac61c2b436`.

Training source: [emwstudio/DuckEMW](https://github.com/emwstudio/DuckEMW) at `bdb870fd2e9b0329d7df70e06abc0d2262a38960`, on the compatible Pollen Robotics training base `5946fd9cdbc58956424420153e51975af3b30d77`. The dance MDP and configuration were recovered from the author's public training source. Observation normalization is baked into the ONNX export. No songs or author-published trained weights were copied.

Runtime: 61 observations, 14 joint actions, 50 Hz policy / 200 Hz MuJoCo; one control-step joint-velocity delay and nominal four physics-step actuator transport delay. The dance command is two-beat sine/cosine phase, BPM/120 and three move-ID bits, written into observation slots 55–60. `dance-command.js` selects trained move IDs; it does not prescribe joint or body positions.

The exact walk collision model used by training is included as `robot_dance.xml` with four namespaced `dance_*.stl` meshes. Robot geometry remains Pollen Robotics' CC BY-NC-SA 4.0; source/runtime adaptations retain Apache-2.0 attribution described in THIRD_PARTY.md.

The training task’s selected-checkpoint ONNX-WASM verification records four robots over 122 seconds, finite state, zero falls, maximum drift 0.0586 m, 47.91 mm climax vertical span and 55.71° head-pitch span. Four seeded 42-second push tests also recorded zero falls; native/WASM inference differed by at most 2.98e-7 over 24 representative observations. The game separately tests real walking formation, trained dance, in-place exit, and asynchronous Space reset. It does not adjust root positions, floor height or joints to hide instability during dance.

## Replacing the policy

Replace the ONNX and its manifest together, preserving the 61D/14D, 50/200 Hz and delay contract. Update the SHA-256, ID, checkpoint, training status and actual verification results; run the physical and manifest tests before publishing. A changed collision model or observation contract requires a matching runtime/model change, rather than silently loading an incompatible policy. Formation, camera transitions and in-place exit are independent of the checkpoint. There is no keyframe fallback.
