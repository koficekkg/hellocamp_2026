/* HelloCamp 2026 — Screen 3: the sailing game.
 * Endless runner in the style of the original surf game: the boat travels down
 * the screen, obstacles scroll up past it. Equipped gear defines the numbers:
 *   motor -> fuel seconds, sail -> wind boost strength/duration, boat -> base speed. */
window.Camp = window.Camp || {};

(function () {
  var H = 760;                 // internal canvas height; width follows the window
  var W = 1350;                // recomputed on every game start (widescreen like the original surf)
  var BASE_W = 540;            // width the obstacle density was tuned at
  var PLAYER_Y = 185;          // boat's fixed y position on screen
  var PLAYER_SCALE = 2;

  var canvas, ctx, hud = {};
  var team, stats, boatSprite;
  var raf = null, lastT = 0;

  var run; // per-run state
  var session; // per-visit state (survives Repeat, reset when entering from shop)

  var keys = { left: false, right: false };   // keyboard
  var touch = { left: false, right: false };  // derived from active pointers
  var activePointers = {};                    // pointerId -> 'left' | 'right'
  var paused = false;                         // focus lost mid-run: freeze instead of sailing blind

  function newRun() {
    return {
      phase: 'ready',        // ready | countdown | running | dying | caught | over
      countdownT: 0,         // seconds left in the 3-2-1 countdown
      goFlashT: 0,           // "GO!" flash right after the countdown
      worldY: 0,             // total forward travel in world px
      x: W / 2,
      vx: 0,
      fuel: stats.fuelSec,
      charge: 0,             // wind charge 0..1
      speed: 0,              // current forward speed px/s (for wake/anim)
      obstacles: [],
      pickups: [],
      wake: [],
      splash: null,          // {t} crash animation clock
      nextWaveAt: 780,       // world y of the first obstacle wave (start stretch is clear)
      laneX: W / 2 - 75,     // left edge of the guaranteed-safe corridor
      laneLog: [],           // {y, x, w} corridor history, oldest first
      nextWindAt: 1.5 + Math.random() * 2,
      clock: 0,
      endReason: null,       // 'crash' | 'kraken'
      bobT: Math.random() * 10,
      kraken: null,          // {dist, t} once the fuel is gone
      catchT: 0,             // kraken catch animation clock
      movers: [],            // crossing jet-skis (lethal)
      dolphins: [],          // leaping dolphins (ambient, harmless)
      nextMoverAt: 14 + Math.random() * 6,
      nextDolphinAt: 4 + Math.random() * 4,
      armor: stats.armor,    // hull plating charges left this run
      graceT: 0,             // invulnerability after plating absorbs a hit
      shieldFlashT: 0,
    };
  }

  // ---- spawning -----------------------------------------------------------
  function pickObstacle() {
    var pool = Camp.OBSTACLE_POOL, total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i].w;
    var r = Math.random() * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) return pool[i]; }
    return pool[0];
  }

  function spawnWave() {
    var t = Camp.TUNING;
    var meters = run.worldY / t.pxPerMeter;
    var ramp = Math.min(1, meters / t.rampMeters);
    var gap = t.obstacleGapPx - (t.obstacleGapPx - t.minObstacleGapPx) * ramp;
    var waveY = run.nextWaveAt; // world y of this wave line

    // one guaranteed passable corridor that COMPOSES across waves: the lane
    // drifts as a bounded random walk, never further per wave than the boat
    // can steer between two waves (lateral reach ~= 0.85 * gap)
    var laneW = 150 - 40 * ramp;
    var maxShift = gap * 0.4; // per-wave drift stays well under the boat's lateral reach (~0.85*gap)
    run.laneX = Math.max(30, Math.min(W - 30 - laneW,
      run.laneX + (Math.random() * 2 - 1) * maxShift));
    var laneX = run.laneX;
    run.laneLog.push({ y: waveY, x: laneX, w: laneW });
    if (run.laneLog.length > 300) run.laneLog.shift();

    var widthFactor = W / BASE_W;
    var count = Math.max(1, Math.round(widthFactor * (1 + (Math.random() < 0.35 + 0.35 * ramp ? 1 : 0))));
    for (var i = 0; i < count; i++) {
      var def = pickObstacle();
      var sp = Camp.SPRITES[def.s];
      var w = sp.r[2] * def.scale, h = sp.r[3] * def.scale;
      // find an x that (a) leaves the corridor clear over the obstacle's WHOLE
      // height — the lane drifts up to 0.4px sideways per px of descent, so
      // tall sprites must keep extra distance (drift cone, not a line) — and
      // (b) doesn't overlap other recently spawned obstacles
      var margin = 22 + 0.4 * h;
      for (var tries = 0; tries < 10; tries++) {
        var x = Math.random() * (W - w);
        if (x + w >= laneX - margin && x <= laneX + laneW + margin) continue;
        var y = waveY + (Math.random() - 0.5) * 40;
        var clear = true;
        for (var k = Math.max(0, run.obstacles.length - 14); k < run.obstacles.length; k++) {
          var o = run.obstacles[k];
          if (x < o.x + o.w + 8 && x + w > o.x - 8 && y < o.y + o.h + 8 && y + h > o.y - 8) {
            clear = false;
            break;
          }
        }
        if (clear) {
          run.obstacles.push({
            s: def.s, x: x, y: y, w: w, h: h,
            hb: sp.hb || [0.1, 0.1, 0.8, 0.8],
          });
          break;
        }
      }
    }
    run.nextWaveAt = waveY + gap * (0.75 + Math.random() * 0.5);
  }

  function spawnWind() {
    var t = Camp.TUNING;
    var y = run.worldY + H + 60;
    // bias wind charges toward the safe corridor so they stay collectible,
    // and never drop one inside an obstacle
    var x = run.laneX + 75;
    for (var tries = 0; tries < 6; tries++) {
      var cand = Math.max(40, Math.min(W - 40, run.laneX + 75 + (Math.random() - 0.5) * 340));
      var clear = true;
      for (var k = Math.max(0, run.obstacles.length - 20); k < run.obstacles.length; k++) {
        var o = run.obstacles[k];
        if (cand > o.x - 40 && cand < o.x + o.w + 40 && y > o.y - 110 && y < o.y + o.h + 110) {
          clear = false;
          break;
        }
      }
      if (clear) { x = cand; break; }
    }
    run.pickups.push({ x: x, y: y, t: Math.random() * 6 });
    // charms make the wind blow more often
    run.nextWindAt = run.clock +
      (t.windSpawnMin + Math.random() * (t.windSpawnMax - t.windSpawnMin)) * (stats.windFreq || 1);
  }

  function spawnMover() {
    var fromLeft = Math.random() < 0.5;
    var variant = Math.random() < 0.5 ? 1 : 2;
    run.movers.push({
      variant: variant,
      x: fromLeft ? -80 : W + 80,
      y: run.worldY + 260 + Math.random() * 320,
      vx: (fromLeft ? 1 : -1) * (100 + Math.random() * 50),
      animT: 0,
    });
    run.nextMoverAt = run.clock + 9 + Math.random() * 7;
  }

  function spawnDolphin() {
    var fromLeft = Math.random() < 0.5;
    run.dolphins.push({
      x: fromLeft ? -40 : W + 40,
      y: run.worldY + 150 + Math.random() * 500,
      vx: (fromLeft ? 1 : -1) * (70 + Math.random() * 50),
      animT: Math.random() * 3,
    });
    run.nextDolphinAt = run.clock + 7 + Math.random() * 6;
  }

  // ---- simulation ---------------------------------------------------------
  function currentSpeed() {
    var windFactor = 1 + (stats.windMult - 1) * run.charge;
    if (run.fuel > 0) return stats.speed * windFactor;
    return stats.speed * (windFactor - 1); // fuel gone: the wind alone carries you
  }

  function update(dt) {
    run.bobT += dt;

    if (run.phase === 'dying') {
      run.splash.t += dt;
      if (run.splash.t > 1.0) endRun('crash');
      return;
    }
    if (run.phase === 'countdown') {
      if (paused) return;
      run.countdownT -= dt;
      if (run.countdownT <= 0) {
        run.phase = 'running';
        run.goFlashT = 0.8;
      }
      return;
    }
    if (run.phase === 'caught') {
      run.catchT += dt;
      if (run.catchT > 1.5) endRun('kraken');
      return;
    }
    if (run.phase !== 'running' || paused) return;
    // the wind-spawn clock only ticks while actually sailing, so idling on the
    // ready screen can't eat the first spawn interval
    run.clock += dt;
    if (run.goFlashT > 0) run.goFlashT -= dt;
    if (run.graceT > 0) run.graceT -= dt;
    if (run.shieldFlashT > 0) run.shieldFlashT -= dt;

    // fuel drains at a constant rate while the run is live
    run.fuel = Math.max(0, run.fuel - dt);
    // wind charge decays over the sail's duration
    if (run.charge > 0) run.charge = Math.max(0, run.charge - dt / stats.windSec);

    var v = currentSpeed();
    run.speed = v;

    // the tank is dry: the kraken wakes up and starts closing in.
    // Wind charges slow it down — chain them to buy precious metres.
    if (run.fuel <= 0 && !run.kraken) run.kraken = { dist: 540, t: 0, x: run.x };
    if (run.kraken) {
      var k = run.kraken;
      k.t += dt;
      k.x += (run.x - k.x) * Math.min(1, dt * 1.1); // it hunts you, lazily
      var close = (46 + Math.min(120, k.t * 14)) * (1 - 0.6 * run.charge);
      k.dist -= close * dt;
      if (k.dist <= 78) {
        run.phase = 'caught';
        run.catchT = 0;
        return;
      }
    }

    run.worldY += v * dt;

    // steering: lateral speed scales with how fast you are going
    var dir = (keys.right || touch.right ? 1 : 0) - (keys.left || touch.left ? 1 : 0);
    var targetVx = dir * Math.max(60, v) * Camp.TUNING.steerSpeedFrac;
    run.vx += (targetVx - run.vx) * Math.min(1, dt * 10);
    run.x = Math.max(24, Math.min(W - 24, run.x + run.vx * dt));

    // wake trail
    if (v > 20) {
      run.wake.push({ x: run.x + (Math.random() - 0.5) * 10, y: run.worldY - 28, age: 0 });
      if (run.wake.length > 90) run.wake.shift();
    }
    for (var i = 0; i < run.wake.length; i++) run.wake[i].age += dt;

    // spawning
    while (run.nextWaveAt < run.worldY + H + 200) spawnWave();
    if (run.clock >= run.nextWindAt) spawnWind();
    if (!run.kraken && run.worldY > 2200 && run.clock >= run.nextMoverAt) spawnMover();
    if (run.clock >= run.nextDolphinAt) spawnDolphin();

    // movers cross the field; dolphins are just passing through
    run.movers.forEach(function (m) { m.x += m.vx * dt; m.animT += dt; });
    run.dolphins.forEach(function (d) { d.x += d.vx * dt; d.animT += dt; });
    run.movers = run.movers.filter(function (m) { return m.x > -160 && m.x < W + 160 && m.y > run.worldY - 300; });
    run.dolphins = run.dolphins.filter(function (d) { return d.x > -120 && d.x < W + 120 && d.y > run.worldY - 300; });

    // cull what's far behind
    run.obstacles = run.obstacles.filter(function (o) { return o.y + o.h > run.worldY - 200; });
    run.pickups = run.pickups.filter(function (p) { return p.y > run.worldY - 200 && !p.taken; });

    // pickup collection (generous circle around the bolt)
    var px = run.x, py = run.worldY;
    run.pickups.forEach(function (p) {
      var dx = p.x - px, dy = p.y - py;
      if (dx * dx + dy * dy < 42 * 42) {
        p.taken = true;
        run.charge = 1;
      }
    });

    // collision: boat hitbox in world coords (hull only, a bit forgiving);
    // hull plating absorbs hits — the obstacle shatters and a short grace
    // window prevents chain hits
    if (run.graceT <= 0) {
      var bw = 17 * PLAYER_SCALE, bh = 34 * PLAYER_SCALE;
      var bx = run.x - bw / 2, by = run.worldY - bh * 0.25;
      for (var j = 0; j < run.obstacles.length; j++) {
        var o = run.obstacles[j];
        var hx = o.x + o.w * o.hb[0], hy = o.y + o.h * o.hb[1];
        var hw = o.w * o.hb[2], hh = o.h * o.hb[3];
        if (bx < hx + hw && bx + bw > hx && by < hy + hh && by + bh > hy) {
          if (run.armor > 0) {
            run.armor--;
            run.obstacles.splice(j, 1);
            run.graceT = 0.9;
            run.shieldFlashT = 0.6;
            break;
          }
          run.phase = 'dying';
          run.splash = { t: 0, x: run.x };
          return;
        }
      }
      for (var m = 0; m < run.movers.length; m++) {
        var mv = run.movers[m];
        var mx = mv.x - 16, my = mv.y - 13;
        if (bx < mx + 32 && bx + bw > mx && by < my + 26 && by + bh > my) {
          if (run.armor > 0) {
            run.armor--;
            run.movers.splice(m, 1);
            run.graceT = 0.9;
            run.shieldFlashT = 0.6;
            break;
          }
          run.phase = 'dying';
          run.splash = { t: 0, x: run.x };
          return;
        }
      }
    }
  }

  function endRun(reason) {
    run.phase = 'over';
    run.endReason = reason;
    var meters = run.worldY / Camp.TUNING.pxPerMeter;
    session.runs.push(meters);
    session.best = Math.max(session.best, meters);
    showOverlay(reason, meters);
  }

  // ---- rendering ----------------------------------------------------------
  function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ddf0f9';
    ctx.fillRect(0, 0, W, H);

    // scrolling water texture
    var tile = Camp.waterTile;
    if (tile.complete && tile.naturalWidth) {
      var off = -(run.worldY % 256);
      for (var ty = off - 256; ty < H + 256; ty += 256)
        for (var tx = 0; tx < W; tx += 256)
          ctx.drawImage(tile, tx, Math.round(ty));
    }

    // sparse procedural wave dashes so the open sea doesn't look empty
    ctx.fillStyle = 'rgba(126, 190, 216, 0.5)';
    var cell = 96;
    var row0 = Math.floor((run.worldY - PLAYER_Y) / cell) - 1;
    for (var row = row0; row < row0 + H / cell + 2; row++) {
      for (var col = 0; col < W / cell + 1; col++) {
        var h1 = ((row * 2654435761 ^ col * 96777) >>> 0) % 1000;
        if (h1 < 550) continue; // not every cell gets a wave
        var wx = col * cell + (h1 % 61);
        var wy = row * cell + (h1 % 83) - (run.worldY - PLAYER_Y);
        ctx.fillRect(Math.round(wx), Math.round(wy), 10 + (h1 % 14), 2);
        if (h1 % 3 === 0) ctx.fillRect(Math.round(wx + 4), Math.round(wy + 3), 6 + (h1 % 8), 2);
      }
    }

    function sy(worldY) { return PLAYER_Y + (worldY - run.worldY); }

    // shoreline island drifting away at the start of a run
    if (run.worldY < 900) {
      Camp.drawSprite(ctx, 'islandC', W / 2 - 235, sy(-150) - 130, 2.5);
    }

    // wake
    for (var i = 0; i < run.wake.length; i++) {
      var wk = run.wake[i];
      var a = Math.max(0, 1 - wk.age / 1.4);
      if (a <= 0) continue;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.75 * a).toFixed(2) + ')';
      var s = 3 + wk.age * 10;
      ctx.fillRect(Math.round(wk.x - s / 2), Math.round(sy(wk.y) - 2), Math.round(s), 3);
    }

    // dolphins leap in the background (harmless scenery)
    run.dolphins.forEach(function (d) {
      var y = sy(d.y);
      if (y < -80 || y > H + 80) return;
      var frame = 'dolphin' + (1 + Math.floor(d.animT * 4) % 3);
      var r = Camp.SPRITES[frame].r;
      ctx.save();
      ctx.translate(Math.round(d.x), Math.round(y));
      if (d.vx > 0) ctx.scale(-1, 1);
      ctx.drawImage(Camp.sheet, r[0], r[1], r[2], r[3], -r[2] * 0.7, -r[3] * 0.7, r[2] * 1.4, r[3] * 1.4);
      ctx.restore();
    });

    // pickups (bobbing bolt with a wind swirl)
    run.pickups.forEach(function (p) {
      var y = sy(p.y) + Math.sin(run.bobT * 3 + p.t) * 3;
      if (y < -80 || y > H + 80) return;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(p.x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7fd4e8';
      ctx.lineWidth = 3;
      ctx.stroke();
      Camp.drawSprite(ctx, 'boltSmall', p.x - 16, y - 16, 0.62);
    });

    // obstacles, sorted for painter's order
    run.obstacles.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (o) {
      var y = sy(o.y);
      if (y > H + 160 || y + o.h < -160) return;
      var def = Camp.SPRITES[o.s];
      ctx.drawImage(Camp.sheet, def.r[0], def.r[1], def.r[2], def.r[3],
        Math.round(o.x), Math.round(y), Math.round(o.w), Math.round(o.h));
    });

    // crossing jet-skis with their wakes
    run.movers.forEach(function (m) {
      var y = sy(m.y);
      if (y < -90 || y > H + 90) return;
      // wake dashes trailing behind
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (var wk = 1; wk <= 4; wk++) {
        var tx = m.x - Math.sign(m.vx) * wk * 16;
        ctx.fillRect(Math.round(tx - 5), Math.round(y + 6), 10, 2);
      }
      var frame = 'jetski' + m.variant + (Math.floor(m.animT * 8) % 2 ? 'a' : 'b');
      var r = Camp.SPRITES[frame].r;
      ctx.save();
      ctx.translate(Math.round(m.x), Math.round(y));
      if (m.vx > 0) ctx.scale(-1, 1);
      ctx.drawImage(Camp.sheet, r[0], r[1], r[2], r[3], -r[2], -r[3], r[2] * 2, r[3] * 2);
      ctx.restore();
    });

    // the kraken rising behind the boat — screen-space so the chase is
    // visible the moment it starts (tentacle tips at the top edge first)
    if (run.kraken && run.phase !== 'caught' && run.phase !== 'over') {
      var kk = run.kraken;
      var frameIdx = Math.max(0, Math.min(5, Math.floor((540 - kk.dist) / 540 * 6)));
      var kr = Camp.SPRITES['kraken' + frameIdx].r;
      var emerge = Math.max(0, Math.min(1, 1 - kk.dist / 540));
      var drawTop = -kr[3] * 2 - 6 + emerge * (PLAYER_Y - 78 + kr[3] * 2 + 46);
      ctx.drawImage(Camp.sheet, kr[0], kr[1], kr[2], kr[3],
        Math.round(kk.x - kr[2]), Math.round(drawTop), kr[2] * 2, kr[3] * 2);
      // dread creeps in as it gets close
      var dread = Math.max(0, Math.min(0.16, (1 - kk.dist / 540) * 0.16));
      ctx.fillStyle = 'rgba(56, 18, 84, ' + dread.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // caught: the head lunges down from where the chase left it onto the boat
    if (run.phase === 'caught') {
      var ct = run.catchT;
      var kr5 = Camp.SPRITES.kraken5.r;
      // continuity: the chase renders its last frame with top ≈ 90 (dist ≈ 78)
      var lunge = Math.min(1, ct / 0.35);
      var headTop = 90 + lunge * 92;
      var headX = run.kraken ? run.kraken.x : run.x;
      ctx.drawImage(Camp.sheet, kr5[0], kr5[1], kr5[2], kr5[3],
        Math.round(headX - kr5[2]), Math.round(headTop), kr5[2] * 2, kr5[3] * 2);
      var tn = Camp.SPRITES.tentacle.r;
      for (var ti = 0; ti < 3; ti++) {
        var tRise = Math.min(1, Math.max(0, (ct - ti * 0.15) / 0.4));
        var txx = run.x - 50 + ti * 42;
        ctx.drawImage(Camp.sheet, tn[0], tn[1], tn[2], tn[3],
          Math.round(txx), Math.round(PLAYER_Y + 30 - tn[3] * 1.6 * tRise), tn[2] * 1.6, tn[3] * 1.6);
      }
      for (var kc = 0; kc < 3; kc++) {
        var crr = 8 + ct * 70 + kc * 12;
        ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 0.85 - ct * 0.55).toFixed(2) + ')';
        ctx.lineWidth = 5 - kc;
        ctx.beginPath();
        ctx.arc(run.x, PLAYER_Y, crr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // player boat (hidden once the splash has swallowed it)
    if (!(run.phase === 'dying' && run.splash.t > 0.45) &&
        !(run.phase === 'caught' && run.catchT > 0.7) && run.phase !== 'over') {
      var bob = run.phase === 'running' ? 0 : Math.sin(run.bobT * 2) * 2;
      var tilt = Math.max(-0.16, Math.min(0.16, run.vx / 900));
      ctx.save();
      ctx.translate(Math.round(run.x), Math.round(PLAYER_Y + bob));
      ctx.rotate(tilt);
      ctx.drawImage(boatSprite, -boatSprite.width / 2, -boatSprite.height * 0.42);
      ctx.restore();
    }

    // hull plating just ate a hit — cyan shield burst around the boat
    if (run.shieldFlashT > 0) {
      var sf = 1 - run.shieldFlashT / 0.6;
      ctx.strokeStyle = 'rgba(62, 230, 239, ' + (0.9 * (1 - sf)).toFixed(2) + ')';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(run.x, PLAYER_Y, 46 + sf * 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.6 * (1 - sf)).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(run.x, PLAYER_Y, 38 + sf * 62, 0, Math.PI * 2);
      ctx.stroke();
    }

    // crash splash
    if (run.phase === 'dying') {
      var t = run.splash.t;
      for (var k = 0; k < 3; k++) {
        var rr = 10 + t * 90 + k * 14;
        ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 0.9 - t * 0.9).toFixed(2) + ')';
        ctx.lineWidth = 6 - k;
        ctx.beginPath();
        ctx.arc(run.splash.x, PLAYER_Y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    updateHud();
  }

  function updateHud() {
    var fuelFrac = run.fuel / stats.fuelSec;
    hud.fuelFill.style.width = (fuelFrac * 100).toFixed(1) + '%';
    hud.fuelFill.style.background = fuelFrac > 0.5 ? '#3fbf5a' : fuelFrac > 0.2 ? '#f0a41e' : '#e8433f';
    hud.windWrap.style.visibility = run.charge > 0 ? 'visible' : 'hidden';
    hud.windFill.style.width = (run.charge * 100).toFixed(1) + '%';
    hud.armor.textContent = run.armor > 0 ? '🛡'.repeat(run.armor) : '';
    hud.dist.textContent = Camp.formatMeters(run.worldY / Camp.TUNING.pxPerMeter);
    hud.ready.style.display = (run.phase === 'ready' || (paused && run.phase === 'running')) ? '' : 'none';

    // 3-2-1-GO
    if (run.phase === 'countdown' || (run.phase === 'running' && run.goFlashT > 0)) {
      var txt = run.phase === 'countdown'
        ? String(Math.max(1, Math.ceil(run.countdownT / 0.8)))
        : (Camp.STR.countdownGo || 'GO!');
      if (hud.count.textContent !== txt) {
        hud.count.textContent = txt;
        hud.count.classList.remove('pop');
        void hud.count.offsetWidth; // restart the pop animation
        hud.count.classList.add('pop');
      }
      hud.count.style.display = '';
    } else {
      hud.count.style.display = 'none';
    }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    var dt = Math.max(0, Math.min(0.05, (t - lastT) / 1000 || 0.016));
    lastT = t;
    update(dt);
    draw();
  }

  // ---- overlay ------------------------------------------------------------
  function showOverlay(reason, meters) {
    hud.overTitle.textContent =
      reason === 'crash' ? Camp.STR.crashed :
      reason === 'kraken' ? Camp.STR.kraken : Camp.STR.outOfFuel;
    hud.overRun.textContent = Camp.formatMeters(meters);
    hud.overBest.textContent = Camp.formatMeters(session.best);
    hud.overlay.classList.add('visible');
  }

  function hideOverlay() { hud.overlay.classList.remove('visible'); }

  function repeat() {
    hideOverlay();
    run = newRun();
  }

  function cont() {
    team.distance += session.best;
    Camp.save();
    Camp.Game.stop();
    Camp.go('island');
  }

  // ---- input --------------------------------------------------------------
  function onKey(down, e) {
    var hit = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = down;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = down;
    else hit = false;
    if (hit) {
      e.preventDefault();
      paused = false;
      if (down && run.phase === 'ready') { run.phase = 'countdown'; run.countdownT = 2.4; }
    }
  }
  function keydown(e) { onKey(true, e); }
  function keyup(e) { onKey(false, e); }

  function recomputeTouch() {
    touch.left = touch.right = false;
    for (var id in activePointers) {
      if (activePointers[id] === 'left') touch.left = true;
      else touch.right = true;
    }
  }
  function pointerdown(e) {
    var rect = canvas.getBoundingClientRect();
    activePointers[e.pointerId] = (e.clientX - rect.left) < rect.width / 2 ? 'left' : 'right';
    recomputeTouch();
    paused = false;
    if (run.phase === 'ready') { run.phase = 'countdown'; run.countdownT = 2.4; }
  }
  function pointerup(e) {
    delete activePointers[e.pointerId];
    recomputeTouch();
  }

  /* keep the internal buffer matched to the window so rendering never stretches */
  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!canvas || !run) return;
      W = Math.max(600, Math.min(2200, Math.round(H * (window.innerWidth / Math.max(1, window.innerHeight)))));
      canvas.width = W;
      run.x = Math.max(24, Math.min(W - 24, run.x));
      run.laneX = Math.max(30, Math.min(W - 180, run.laneX));
      // waves already staged off-screen kept their corridor at the OLD lane —
      // throw them back and respawn against the re-clamped lane
      var visibleEdge = run.worldY + (H - PLAYER_Y) + 60;
      run.obstacles = run.obstacles.filter(function (o) { return o.y < visibleEdge; });
      run.laneLog = run.laneLog.filter(function (e) { return e.y < visibleEdge; });
      run.nextWaveAt = Math.max(visibleEdge + 40, run.worldY + 300);
    }, 150);
  }
  function clearInputs() {
    activePointers = {};
    keys.left = keys.right = touch.left = touch.right = false;
  }
  function onWindowBlur() {
    clearInputs();
    // don't sail (or count down into sailing) blind while unfocused
    if (run && (run.phase === 'running' || run.phase === 'countdown')) paused = true;
  }
  function onWindowFocus() { paused = false; }

  // ---- public -------------------------------------------------------------
  Camp.Game = {
    start: function (teamIndex) {
      Camp.Game.stop(); // never let two frame loops run at once
      team = Camp.team(teamIndex);
      stats = Camp.buildStats(team);
      boatSprite = Camp.renderBoat(team, PLAYER_SCALE);
      session = { runs: [], best: 0 };

      canvas = document.getElementById('game-canvas');
      // match the window's aspect ratio at a fixed internal height
      W = Math.max(600, Math.min(2200, Math.round(H * (window.innerWidth / Math.max(1, window.innerHeight)))));
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d');

      hud.fuelFill = document.getElementById('hud-fuel-fill');
      hud.windWrap = document.getElementById('hud-wind');
      hud.windFill = document.getElementById('hud-wind-fill');
      hud.armor = document.getElementById('hud-armor');
      hud.dist = document.getElementById('hud-distance');
      hud.ready = document.getElementById('hud-ready');
      hud.count = document.getElementById('hud-countdown');
      hud.overlay = document.getElementById('game-overlay');
      hud.overTitle = document.getElementById('over-title');
      hud.overRun = document.getElementById('over-run');
      hud.overBest = document.getElementById('over-best');

      document.getElementById('over-repeat').onclick = repeat;
      document.getElementById('over-continue').onclick = cont;

      document.getElementById('game-team-tag').textContent = team.name;
      document.getElementById('game-team-tag').style.background = team.color;

      clearInputs();
      paused = false;
      run = newRun();
      hideOverlay();

      window.addEventListener('keydown', keydown);
      window.addEventListener('keyup', keyup);
      canvas.addEventListener('pointerdown', pointerdown);
      window.addEventListener('pointerup', pointerup);
      window.addEventListener('pointercancel', pointerup);
      window.addEventListener('blur', onWindowBlur);
      window.addEventListener('focus', onWindowFocus);
      window.addEventListener('resize', onResize);

      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    },
    /* test/debug access used by the camp crew console and automated checks */
    debug: function () { return { run: run, stats: stats, session: session, keys: keys }; },
    stop: function () {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      if (canvas) canvas.removeEventListener('pointerdown', pointerdown);
      window.removeEventListener('pointerup', pointerup);
      window.removeEventListener('pointercancel', pointerup);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      paused = false;
    },
  };
})();
