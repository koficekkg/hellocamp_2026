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
      pattern: 'scatter',    // current terrain pattern (see rollPattern)
      patternUntil: 0,       // world y where the next pattern is rolled
      slalomSide: 1,         // which shore the slalom corridor is swinging toward
      nextWindAt: 1.5 + Math.random() * 2,
      nextTentacleAt: 1000 + Math.random() * 400, // world y of the first kraken tentacle
      clock: 0,
      endReason: null,       // 'crash' | 'kraken'
      bobT: Math.random() * 10,
      kraken: null,          // {dist, t, x, mode} — fuel gone, or a tentacle was touched
      catchT: 0,             // kraken catch animation clock
      dolphins: [],          // leaping dolphins (ambient, harmless)
      nextDolphinAt: 4 + Math.random() * 4,
      armor: stats.armor,    // hull plating charges left this run
      graceT: 0,             // invulnerability after plating absorbs a hit
      shieldFlashT: 0,
    };
  }

  // ---- spawning -----------------------------------------------------------
  function pickObstacle(maxH) {
    var pool = Camp.OBSTACLE_POOL, total = 0, i, ok = [];
    for (i = 0; i < pool.length; i++) {
      var d = pool[i];
      if (maxH && Camp.SPRITES[d.s].r[3] * d.scale > maxH) continue;
      ok.push(d);
      total += d.w;
    }
    var r = Math.random() * total;
    for (i = 0; i < ok.length; i++) { r -= ok[i].w; if (r <= 0) return ok[i]; }
    return ok[0];
  }

  /* Try to add one obstacle at (x, y) belonging to the wave line at waveY.
   * Size gets a ±20% jitter and a random mirror so repeated sprites don't
   * read as copy-paste. Rejects anything that overlaps recent spawns (pad px
   * apart, negative = may touch) or, when laneW is given, anything inside the
   * corridor's drift cone — the lane shifts up to `slope` px sideways per px
   * of descent, so the margin must cover the sprite's whole height PLUS its
   * offset from the wave line the lane was sampled at. Returns obstacle/null. */
  function placeObstacle(def, x, y, waveY, pad, laneW, slope) {
    var jit = 0.8 + Math.random() * 0.45;
    var sp = Camp.SPRITES[def.s];
    var w = sp.r[2] * def.scale * jit, h = sp.r[3] * def.scale * jit;
    x = Math.max(-w * 0.3, Math.min(W - w * 0.7, x));
    if (laneW != null) {
      var margin = 22 + (slope || 0.4) * (h + Math.abs(y - waveY));
      if (x + w >= run.laneX - margin && x <= run.laneX + laneW + margin) return null;
    }
    if (pad == null) pad = 8;
    for (var k = Math.max(0, run.obstacles.length - 24); k < run.obstacles.length; k++) {
      var o = run.obstacles[k];
      if (x < o.x + o.w + pad && x + w > o.x - pad && y < o.y + o.h + pad && y + h > o.y - pad)
        return null;
    }
    var ob = { s: def.s, x: x, y: y, w: w, h: h,
               hb: sp.hb || [0.1, 0.1, 0.8, 0.8], flip: Math.random() < 0.5 };
    run.obstacles.push(ob);
    return ob;
  }

  /* One randomly-placed obstacle that respects the corridor. */
  function scatterOne(waveY, laneW, tries, slope) {
    for (var n = 0; n < tries; n++) {
      var def = pickObstacle();
      if (placeObstacle(def, Math.random() * (W - 60), waveY + (Math.random() - 0.5) * 40,
                        waveY, 8, laneW, slope)) return true;
    }
    return false;
  }

  /* Move the guaranteed-safe corridor. The per-wave shift always stays under
   * the boat's lateral reach between two waves (~0.85 * gap), so the corridor
   * COMPOSES across waves and is always steerable. */
  function driftLane(gap, laneW, target, aggressive) {
    var maxShift = gap * (aggressive ? 0.6 : 0.4);
    var want = target == null
      ? run.laneX + (Math.random() * 2 - 1) * maxShift
      : run.laneX + Math.max(-maxShift, Math.min(maxShift, target - run.laneX));
    run.laneX = Math.max(30, Math.min(W - 30 - laneW, want));
  }

  /* The sea comes in stretches, like the original surf game: calm open water,
   * loose scatter, winding slalom canyons, archipelago clusters, and wall
   * lines with a single gap to find. */
  function rollPattern(waveY, ramp) {
    var r = Math.random(), pick;
    if (r < 0.13) pick = 'calm';
    else if (r < 0.38) pick = 'scatter';
    else if (r < 0.60) pick = 'slalom';
    else if (r < 0.80) pick = 'cluster';
    else pick = 'wall';
    if (pick === run.pattern && pick !== 'scatter') pick = 'scatter'; // no set piece twice in a row
    run.pattern = pick;
    var len = pick === 'calm' ? 300 + Math.random() * 250 :
              pick === 'scatter' ? 550 + Math.random() * 450 :
              pick === 'slalom' ? (850 + Math.random() * 650) * (0.8 + 0.4 * ramp) :
              pick === 'cluster' ? 650 + Math.random() * 450 :
              1; // wall is a single line; roll again next wave
    run.patternUntil = waveY + len;
    if (pick === 'slalom') {
      run.slalomSide = run.laneX + 75 < W / 2 ? 1 : -1;
      // obstacles already spawned assumed the gentler 0.4 drift cone — ease
      // into the aggressive swing so their height window stays honored
      run.slalomEase = 2;
    }
  }

  function spawnWave() {
    var t = Camp.TUNING;
    var meters = run.worldY / t.pxPerMeter;
    var ramp = Math.min(1, meters / t.rampMeters);
    var gap = t.obstacleGapPx - (t.obstacleGapPx - t.minObstacleGapPx) * ramp;
    var waveY = run.nextWaveAt; // world y of this wave line
    var laneW = 150 - 40 * ramp;
    var widthFactor = W / BASE_W;
    var i, def, sp;

    if (waveY >= run.patternUntil) rollPattern(waveY, ramp);

    if (run.pattern === 'calm') {
      // open water: a breather between set pieces
      driftLane(gap, laneW, null, false);
      run.nextWaveAt = waveY + gap * (1.1 + Math.random() * 0.5);

    } else if (run.pattern === 'slalom') {
      // the corridor swings hard toward one shore, then the other; obstacles
      // hug the drift cone on both sides so it reads as a winding canyon
      var target = run.slalomSide > 0 ? W - 60 - laneW : 60;
      driftLane(gap, laneW, target, run.slalomEase <= 0);
      if (run.slalomEase > 0) run.slalomEase--;
      if (Math.abs(run.laneX - target) < 40) run.slalomSide *= -1;
      [-1, 1].forEach(function (side) {
        var d = pickObstacle(120);
        var s = Camp.SPRITES[d.s];
        var w = s.r[2] * d.scale * 1.25, h = s.r[3] * d.scale * 1.25;
        var margin = 26 + 0.6 * h;
        var x = side < 0
          ? run.laneX - margin - w - 20 - Math.random() * 50
          : run.laneX + laneW + margin + 20 + Math.random() * 50;
        if (x > -w * 0.4 && x < W - w * 0.6)
          placeObstacle(d, x, waveY + (Math.random() - 0.5) * 30, waveY, 6, laneW, 0.6);
      });
      if (Math.random() < 0.4) scatterOne(waveY, laneW, 5, 0.6);
      run.nextWaveAt = waveY + gap * (0.75 + Math.random() * 0.3);

    } else if (run.pattern === 'cluster') {
      // an archipelago blob on the roomier side of the corridor
      driftLane(gap, laneW, null, false);
      var side2 = run.laneX + laneW / 2 > W / 2 ? -1 : 1;
      var room = side2 < 0 ? run.laneX - 80 : W - (run.laneX + laneW) - 80;
      if (room > 180) {
        var cx = side2 < 0
          ? 40 + Math.random() * (room - 180)
          : run.laneX + laneW + 120 + Math.random() * (room - 180);
        var n = 3 + Math.floor(Math.random() * 3);
        for (i = 0; i < n; i++)
          placeObstacle(pickObstacle(), cx + (Math.random() - 0.5) * 280,
                        waveY + (Math.random() - 0.5) * 190, waveY, 2, laneW);
      }
      if (Math.random() < 0.6) scatterOne(waveY, laneW, 6);
      run.nextWaveAt = waveY + gap * (0.9 + Math.random() * 0.5);

    } else if (run.pattern === 'wall') {
      // a line of obstacles across the whole sea with one gap at the corridor
      driftLane(gap, laneW, null, false);
      // the gap must stay clear over the wall pieces' WHOLE height while the
      // lane keeps drifting, so it is padded by the full drift cone
      var gapPad = 92 - 20 * ramp;
      var gapStart = run.laneX - gapPad, gapEnd = run.laneX + laneW + gapPad;
      var x2 = -14;
      while (x2 < W + 14) {
        var d3 = pickObstacle(115);
        var s3 = Camp.SPRITES[d3.s];
        var w3 = s3.r[2] * d3.scale;
        if (x2 + w3 * 1.25 > gapStart && x2 < gapEnd) { x2 = gapEnd; continue; }
        var ob = placeObstacle(d3, x2, waveY + (Math.random() - 0.5) * 26, waveY, -10);
        x2 += (ob ? ob.w : w3) * (0.95 + Math.random() * 0.2);
      }
      run.nextWaveAt = waveY + gap * 1.7; // room to recover behind a wall

    } else {
      // scatter: loose random field (the classic filler)
      driftLane(gap, laneW, null, false);
      var count = Math.max(1, Math.round(widthFactor * (1 + (Math.random() < 0.35 + 0.35 * ramp ? 1 : 0))));
      for (i = 0; i < count; i++) scatterOne(waveY, laneW, 10);
      run.nextWaveAt = waveY + gap * (0.7 + Math.random() * 0.6);
    }

    run.laneLog.push({ y: waveY, x: run.laneX, w: laneW });
    if (run.laneLog.length > 300) run.laneLog.shift();
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

  /* Kraken tentacles are not part of the obstacle pool: they are bait, not
   * walls (touching one starts the chase instead of sinking you), so they
   * deliberately spawn IN the player's path — usually squatting in the safe
   * corridor with a squeeze gap on one side, sometimes in the open water
   * right next to it. */
  function spawnTentacle() {
    var y = run.nextTentacleAt;
    run.nextTentacleAt = y + 650 + Math.random() * 650;
    // the corridor AT THE TENTACLE'S y, not at the newest wave line
    var lane = null, bd = 1e9;
    for (var li = run.laneLog.length - 1; li >= 0; li--) {
      var dd = Math.abs(run.laneLog[li].y - y);
      if (dd > bd) break; // log is ascending; distance only grows from here
      bd = dd;
      lane = run.laneLog[li];
    }
    var laneX = lane ? lane.x : run.laneX;
    var laneW = lane ? lane.w : 150;
    var def = { s: 'tentacles' + (1 + Math.floor(Math.random() * 3)), scale: 1.3 };
    var w = Camp.SPRITES[def.s].r[2] * def.scale;
    for (var tries = 0; tries < 5; tries++) {
      var x;
      if (Math.random() < 0.7) {
        // block one side of the corridor, leave a squeeze gap on the other
        var f = 0.35 + Math.random() * 0.3;
        x = Math.random() < 0.5
          ? laneX + laneW * f - w * 0.85
          : laneX + laneW * (1 - f) - w * 0.15;
      } else {
        // open water just off the corridor, where wanderers sail
        var off = 130 + Math.random() * 260;
        x = laneX + laneW / 2 - w / 2 + (Math.random() < 0.5 ? -off : off);
      }
      if (placeObstacle(def, x, y + (Math.random() - 0.5) * 60, y, 6)) return;
    }
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
    if (run.fuel <= 0 && !run.kraken) run.kraken = { dist: 540, t: 0, x: run.x, mode: 'fuel' };
    if (run.kraken) {
      var k = run.kraken;
      k.t += dt;
      if (k.crashT != null) {
        // it slammed into something — sinks back into the deep
        k.crashT += dt;
        k.dist += 500 * dt;
        if (k.dist > 560) run.kraken = null;
      } else {
        // a tentacle-roused kraken hunts with real intent; the fuel one is patient
        var hunt = k.mode === 'tentacle' ? 2.4 : 1.1;
        k.x += (run.x - k.x) * Math.min(1, dt * hunt);
        var close = k.mode === 'tentacle'
          ? (52 + Math.min(75, k.t * 10)) * (1 - 0.45 * run.charge)
          : (46 + Math.min(120, k.t * 14)) * (1 - 0.6 * run.charge);
        k.dist -= close * dt;
        if (k.dist <= 78) {
          run.phase = 'caught';
          run.catchT = 0;
          return;
        }
        // a chasing kraken can be tricked: steer so an obstacle scrolls into
        // its head — the crash ends the chase (the fuel kraken never stops)
        if (k.mode === 'tentacle') {
          var emerge = Math.max(0, Math.min(1, 1 - k.dist / 540));
          if (emerge > 0.3) {
            var kr = Camp.SPRITES.kraken0.r;
            var headTop = -kr[3] * 2 - 6 + emerge * (PLAYER_Y - 78 + kr[3] * 2 + 46) + 66;
            var headH = 130, headHalfW = 66;
            for (var q = 0; q < run.obstacles.length; q++) {
              var ob = run.obstacles[q];
              if (ob.s.indexOf('tentacles') === 0) continue; // its own arms
              var oy = ob.y - run.worldY + PLAYER_Y; // obstacle in screen coords
              if (k.x - headHalfW < ob.x + ob.w && k.x + headHalfW > ob.x &&
                  headTop < oy + ob.h && headTop + headH > oy) {
                run.obstacles.splice(q, 1);
                k.crashT = 0;
                k.splashY = headTop + headH * 0.5;
                break;
              }
            }
          }
        }
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
    while (run.nextTentacleAt < run.worldY + H + 200) spawnTentacle();
    if (run.clock >= run.nextWindAt) spawnWind();
    if (run.clock >= run.nextDolphinAt) spawnDolphin();

    // dolphins are just passing through
    run.dolphins.forEach(function (d) { d.x += d.vx * dt; d.animT += dt; });
    run.dolphins = run.dolphins.filter(function (d) { return d.x > -120 && d.x < W + 120 && d.y > run.worldY - 300; });

    // cull what's far behind (keep enough behind the boat for the kraken to hit)
    run.obstacles = run.obstacles.filter(function (o) { return o.y + o.h > run.worldY - 320; });
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
          if (o.s.indexOf('tentacles') === 0) {
            // brushing a tentacle doesn't sink you — it wakes the KRAKEN
            run.obstacles.splice(j, 1);
            run.graceT = 1.0;
            if (!run.kraken) {
              run.kraken = { dist: 500, t: 0, x: run.x, mode: 'tentacle' };
            } else if (run.kraken.crashT != null) {
              // roused again mid-sink
              run.kraken.crashT = null;
              run.kraken.mode = 'tentacle';
              run.kraken.t = 0;
              run.kraken.dist = Math.min(run.kraken.dist, 500);
            } else {
              run.kraken.dist = Math.max(110, run.kraken.dist - 90); // angrier
            }
            break;
          }
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
    ctx.fillStyle = '#8fd5ef';
    ctx.fillRect(0, 0, W, H);

    // scrolling water texture
    var tile = Camp.waterTile;
    if (tile.complete && tile.naturalWidth) {
      var off = -(run.worldY % 256);
      for (var ty = off - 256; ty < H + 256; ty += 256)
        for (var tx = 0; tx < W; tx += 256)
          ctx.drawImage(tile, tx, Math.round(ty));
    }

    // sparse procedural ripples: white foam curls and deeper-blue swells,
    // swaying gently so the sea feels alive
    var cell = 80;
    var row0 = Math.floor((run.worldY - PLAYER_Y) / cell) - 1;
    for (var row = row0; row < row0 + H / cell + 2; row++) {
      for (var col = 0; col < W / cell + 1; col++) {
        var h1 = ((row * 2654435761 ^ col * 96777) >>> 0) % 1000;
        if (h1 < 430) continue; // not every cell gets a ripple
        var sway = Math.sin(run.bobT * 0.9 + row * 1.7 + col) * 3;
        var wx = col * cell + (h1 % 53) + sway;
        var wy = row * cell + (h1 % 67) - (run.worldY - PLAYER_Y);
        var len = 12 + (h1 % 16);
        if (h1 % 2) {
          // foam ripple with upturned tips
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fillRect(Math.round(wx), Math.round(wy), len, 2);
          ctx.fillRect(Math.round(wx - 2), Math.round(wy - 2), 3, 2);
          ctx.fillRect(Math.round(wx + len - 1), Math.round(wy - 2), 3, 2);
        } else {
          // darker water shadow under a swell
          ctx.fillStyle = 'rgba(46, 138, 178, 0.35)';
          ctx.fillRect(Math.round(wx), Math.round(wy), len, 2);
          ctx.fillRect(Math.round(wx + 3), Math.round(wy + 3), Math.max(4, len - 8), 2);
        }
      }
    }

    function sy(worldY) { return PLAYER_Y + (worldY - run.worldY); }

    // the island being escaped from drifts away at the start of a run —
    // the same key art as the island screen, so the story connects
    if (run.worldY < 1200) {
      var isl = Camp.islandArt;
      if (isl.complete && isl.naturalWidth) {
        var iw = 560;
        ctx.imageSmoothingEnabled = true; // key art, not pixel art
        ctx.drawImage(isl, W / 2 - iw / 2, sy(-60) - iw, iw, iw);
        ctx.imageSmoothingEnabled = false;
      } else {
        Camp.drawSprite(ctx, 'islandC', W / 2 - 235, sy(-150) - 130, 2.5);
      }
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

    // pickups (bobbing energy bolt in a bubble)
    run.pickups.forEach(function (p) {
      var y = sy(p.y) + Math.sin(run.bobT * 3 + p.t) * 3;
      if (y < -80 || y > H + 80) return;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2e9fc0';
      ctx.lineWidth = 3;
      ctx.stroke();
      Camp.drawSprite(ctx, 'boltSmall', p.x - 16, y - 16, 0.62);
    });

    // obstacles, sorted for painter's order
    run.obstacles.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (o) {
      var y = sy(o.y);
      if (y > H + 160 || y + o.h < -160) return;
      var def = Camp.SPRITES[o.s];
      if (o.flip) {
        ctx.save();
        ctx.translate(Math.round(o.x) + Math.round(o.w), Math.round(y));
        ctx.scale(-1, 1);
        ctx.drawImage(Camp.sheet, def.r[0], def.r[1], def.r[2], def.r[3],
          0, 0, Math.round(o.w), Math.round(o.h));
        ctx.restore();
      } else {
        ctx.drawImage(Camp.sheet, def.r[0], def.r[1], def.r[2], def.r[3],
          Math.round(o.x), Math.round(y), Math.round(o.w), Math.round(o.h));
      }
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
      // it just crashed into an obstacle — white shockwave where it hit
      if (kk.crashT != null && kk.crashT < 0.7) {
        for (var kc2 = 0; kc2 < 3; kc2++) {
          var crr2 = 12 + kk.crashT * 110 + kc2 * 16;
          ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 0.85 - kk.crashT * 1.1).toFixed(2) + ')';
          ctx.lineWidth = 6 - kc2;
          ctx.beginPath();
          ctx.arc(kk.x, kk.splashY, crr2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
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
