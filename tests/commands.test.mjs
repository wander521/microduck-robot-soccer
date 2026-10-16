import test from "node:test";
import assert from "node:assert/strict";
import { createRoom, addPlayer } from "../src/simulation.js";
import { applyCommand } from "../src/commands.js";
test("browser commands clamp input, preserve dance lock and let Space exit", () => {
  const room = createRoom(),
    p = addPlayer(room, "you", "Player");
  applyCommand(room, p, { type: "input", forward: 100, turn: -9 });
  assert.equal(p.forward, 1);
  assert.equal(p.turn, -1);
  applyCommand(room, p, { type: "dance" });
  assert.equal(room.dancing, true);
  applyCommand(room, p, { type: "input", forward: 1, turn: 1 });
  assert.equal(p.forward, 0);
  assert.equal(p.turn, 0);
  applyCommand(room, p, { type: "mode", mode: "roller" });
  assert.equal(p.mode, "walk");
  applyCommand(room, p, { type: "reset" });
  assert.equal(room.dancing, false);
  assert.equal(room.ballResetPending, true);
  assert.equal(p.resetRevision, 1);
});
test("browser controls change teams, mode, AI, name and autoplay locally", () => {
  const room = createRoom(),
    p = addPlayer(room, "you", "Player");
  applyCommand(room, p, { type: "ai", value: true });
  assert.equal(room.players.size, 4);
  applyCommand(room, p, { type: "ai", value: false });
  assert.equal(room.players.size, 1);
  applyCommand(room, p, { type: "team" });
  assert.equal(p.team, "orange");
  applyCommand(room, p, { type: "mode", mode: "roller" });
  assert.equal(p.mode, "roller");
  applyCommand(room, p, { type: "mode", mode: "invalid" });
  assert.equal(p.mode, "roller");
  applyCommand(room, p, { type: "rename", name: " 小鸭球员 " });
  assert.equal(p.name, "小鸭球员");
  applyCommand(room, p, { type: "auto", value: true });
  assert.equal(p.auto, true);
  applyCommand(room, p, { type: "kick" });
  assert.equal(p.kickRequested, true);
});

test("reset restarts every duck in separated team positions and clears ongoing actions", () => {
  for (const team of ["blue", "orange"]) {
    const room = createRoom(), captain = addPlayer(room, "you", "Captain", team);
    applyCommand(room, captain, {type:"ai", value:true});
    room.scores = {blue:2, orange:1};
    const settings = new Map([...room.players.values()].map((p,i)=>{
      p.mode = i===1 ? "roller" : "walk";
      Object.assign(p, {x:1,z:.7,forward:1,turn:.8,kick:1,kickRequested:true,
        charge:.8,chargeCooldown:8,quack:.4,recovery:"stand"});
      return [p.id,{team:p.team,mode:p.mode,auto:p.auto,name:p.name,revision:p.resetRevision}];
    }));
    applyCommand(room,captain,{type:"reset"});
    for(const p of room.players.values()){
      const before=settings.get(p.id);
      assert.equal(p.resetRevision,before.revision+1);
      for(const key of ["team","mode","auto","name"])assert.equal(p[key],before[key]);
      assert.equal(p.charge,0);assert.equal(p.chargeCooldown,0);
      assert.equal(p.kick,0);assert.equal(p.kickRequested,false);
      assert.equal(p.recovery,null);assert.equal(p.forward,0);assert.equal(p.turn,0);
      assert.equal(p.quack,0);
      assert.equal(p.yaw,p.team==="blue"?0:Math.PI);
      assert.ok(p.team==="blue"?p.x<0:p.x>0);
      for(const q of room.players.values())if(q!==p)assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>.3);
    }
    assert.deepEqual(room.scores,{blue:2,orange:1});
    assert.equal(room.ballResetPending,true);
  }
});
