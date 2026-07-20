/* HelloCamp 2026 — procedural pixel art: boats built from equipped parts, and shop icons.
 * Canonical boat orientation: bow pointing DOWN (the direction of travel in the game).
 * Everything is drawn on a small unit grid and scaled up with smoothing disabled. */
window.Camp = window.Camp || {};

(function () {
  var BOAT_W = 40, BOAT_H = 64; // unit grid for a full boat (hull + motor + sail)

  // ---- tiny color helpers -------------------------------------------------
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    var n = m ? parseInt(m[1], 16) : 0x888888;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function mix(hex, other, t) {
    var a = hexToRgb(hex), b = hexToRgb(other), c = [0, 0, 0];
    for (var i = 0; i < 3; i++) c[i] = Math.round(a[i] + (b[i] - a[i]) * t);
    return rgbStr(c);
  }
  Camp.lighten = function (hex, t) { return mix(hex, '#ffffff', t); };
  Camp.darken = function (hex, t) { return mix(hex, '#1c2733', t); };

  var C = {
    out: '#40342a',   // generic dark outline
    wood: '#b98a52', woodD: '#8a6238', woodL: '#d9ab72',
    rope: '#e8d9ad',
    white: '#ffffff', grey: '#d8dee4', greyM: '#a7b1ba', greyD: '#5a636b', black: '#33383d',
    canvas: '#f4efe2', canvasD: '#d9d2bd',
    orange: '#ef7d33', orangeL: '#ffa95e', orangeD: '#c65f1d',
    floor: '#cfe6ef', glass: '#9fd6ef',
    foam: '#eafcff',
  };

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // ---- hulls (bow at bottom) ---------------------------------------------
  function drawRaft(ctx) {
    // five logs running bow-ward, staggered tips, two rope lashings
    var logs = [
      { x: 9,  top: 22, bot: 54 },
      { x: 13, top: 20, bot: 57 },
      { x: 17, top: 19, bot: 58 },
      { x: 21, top: 20, bot: 57 },
      { x: 25, top: 22, bot: 54 },
    ];
    logs.forEach(function (l, i) {
      px(ctx, l.x, l.top, 4, l.bot - l.top, C.out);
      px(ctx, l.x + 1, l.top + 1, 2, l.bot - l.top - 2, i % 2 ? C.wood : C.woodL);
      px(ctx, l.x + 1, l.top + 1, 1, l.bot - l.top - 2, C.woodD);
      px(ctx, l.x + 1, l.bot - 2, 2, 1, C.woodD); // log end
    });
    px(ctx, 8, 28, 22, 2, C.rope);
    px(ctx, 8, 44, 22, 2, C.rope);
    px(ctx, 8, 29, 22, 1, mix('#e8d9ad', '#40342a', 0.35));
    px(ctx, 8, 45, 22, 1, mix('#e8d9ad', '#40342a', 0.35));
  }

  function drawInflatable(ctx, teamColor) {
    // rounded tube with a soft floor; team-colored nose patch
    // outer outline
    px(ctx, 10, 18, 18, 42, C.out);
    px(ctx, 8, 22, 22, 34, C.out);
    // tube body
    px(ctx, 11, 19, 16, 40, C.orange);
    px(ctx, 9, 23, 20, 32, C.orange);
    // tube highlights
    px(ctx, 11, 20, 3, 36, C.orangeL);
    px(ctx, 9, 24, 2, 28, C.orangeL);
    px(ctx, 25, 22, 2, 32, C.orangeD);
    // floor
    px(ctx, 13, 24, 12, 28, C.floor);
    px(ctx, 13, 24, 12, 2, mix('#cfe6ef', '#40342a', 0.15));
    // bench
    px(ctx, 13, 34, 12, 4, C.orangeD);
    px(ctx, 13, 34, 12, 1, C.orangeL);
    // nose patch in team color
    px(ctx, 16, 55, 6, 4, Camp.darken(teamColor, 0.25));
    px(ctx, 17, 55, 4, 3, teamColor);
  }

  function drawSpeedboat(ctx, teamColor) {
    var y;
    // hull silhouette: flat stern (y=18) narrowing to a point (y=59)
    for (y = 18; y <= 59; y++) {
      var t = (y - 18) / 41;
      var half = t < 0.55 ? 11 : Math.max(1, Math.round(11 * (1 - (t - 0.55) / 0.5)));
      px(ctx, 19 - half, y, half * 2 + (y < 58 ? 2 : 1), 1, '#2b3a4a');
    }
    for (y = 19; y <= 57; y++) {
      var t2 = (y - 18) / 41;
      var h2 = t2 < 0.55 ? 10 : Math.max(1, Math.round(10 * (1 - (t2 - 0.55) / 0.48)));
      px(ctx, 19 - h2 + 1, y, Math.max(1, h2 * 2 - 1), 1, C.white);
    }
    // deck shading + team racing stripe down the middle
    for (y = 20; y <= 55; y++) {
      var t3 = (y - 18) / 41;
      var h3 = t3 < 0.55 ? 10 : Math.max(1, Math.round(10 * (1 - (t3 - 0.55) / 0.48)));
      if (h3 > 2) px(ctx, 19 + h3 - 2, y, 1, 1, C.grey);
    }
    px(ctx, 18, 40, 4, 18, teamColor);
    px(ctx, 18, 40, 1, 18, Camp.darken(teamColor, 0.2));
    // cockpit
    px(ctx, 13, 24, 14, 12, C.greyD);
    px(ctx, 14, 25, 12, 10, C.floor);
    px(ctx, 14, 30, 12, 2, C.greyM); // seat
    // windshield
    px(ctx, 13, 36, 14, 2, '#2b3a4a');
    px(ctx, 14, 36, 12, 1, C.glass);
    // bow highlight
    px(ctx, 16, 56, 2, 2, C.grey);
  }

  // ---- motors (stern overlay, top of the sprite) --------------------------
  function drawPan(ctx) {
    px(ctx, 22, 6, 8, 8, C.out);
    px(ctx, 23, 7, 6, 6, C.black);
    px(ctx, 24, 8, 2, 2, C.greyM);
    px(ctx, 19, 12, 4, 2, C.out);   // handle toward the boat
    px(ctx, 19, 12, 3, 1, C.woodD);
  }
  function drawOar(ctx) {
    // oar laid diagonally over the stern
    px(ctx, 12, 6, 3, 3, C.out);
    px(ctx, 12, 6, 2, 2, C.woodL);  // blade tip
    px(ctx, 13, 8, 3, 3, C.out);
    px(ctx, 13, 8, 2, 2, C.wood);
    px(ctx, 15, 10, 2, 2, C.woodD);
    px(ctx, 17, 12, 2, 2, C.woodD);
    px(ctx, 19, 14, 2, 2, C.woodD);
    px(ctx, 11, 4, 4, 3, C.out);
    px(ctx, 12, 5, 2, 4, C.woodL);  // blade
  }
  function drawEMotor(ctx, teamColor) {
    px(ctx, 15, 8, 10, 8, C.out);
    px(ctx, 16, 9, 8, 6, C.greyM);
    px(ctx, 16, 9, 8, 2, C.greyD);
    px(ctx, 17, 12, 3, 2, teamColor); // little brand badge
    // propeller wash
    px(ctx, 17, 3, 2, 4, C.foam);
    px(ctx, 21, 2, 2, 5, C.foam);
    px(ctx, 14, 4, 2, 3, C.foam);
    px(ctx, 19, 5, 2, 3, '#cdeef7');
  }

  // ---- sails (billboard across the hull) + team flag on the mast ----------
  function mastAndFlag(ctx, mastTop, teamColor) {
    px(ctx, 19, mastTop, 2, 22, C.out);
    px(ctx, 19, mastTop, 1, 22, C.woodD);
    // flag flying to the right of the mast tip
    px(ctx, 21, mastTop, 7, 4, Camp.darken(teamColor, 0.25));
    px(ctx, 21, mastTop, 6, 3, teamColor);
    px(ctx, 21, mastTop, 6, 1, Camp.lighten(teamColor, 0.3));
  }
  function drawTShirtSail(ctx, teamColor) {
    mastAndFlag(ctx, 20, teamColor);
    // stretched t-shirt: body + stubby sleeves + holes
    px(ctx, 12, 26, 16, 10, C.out);
    px(ctx, 13, 27, 14, 8, C.white);
    px(ctx, 10, 27, 3, 4, C.out);
    px(ctx, 11, 28, 2, 2, C.white);   // left sleeve
    px(ctx, 27, 27, 3, 4, C.out);
    px(ctx, 27, 28, 2, 2, C.white);   // right sleeve
    px(ctx, 13, 27, 14, 1, C.grey);
    // holes
    px(ctx, 16, 30, 2, 2, C.floor);
    px(ctx, 22, 32, 2, 1, C.floor);
    px(ctx, 19, 28, 1, 1, C.floor);
    px(ctx, 24, 29, 1, 2, C.floor);
  }
  function drawBedsheetSail(ctx, teamColor) {
    mastAndFlag(ctx, 18, teamColor);
    px(ctx, 8, 24, 24, 14, C.out);
    px(ctx, 9, 25, 22, 12, C.white);
    // billowing shading + fold lines
    px(ctx, 9, 25, 22, 2, C.grey);
    px(ctx, 14, 27, 1, 10, C.grey);
    px(ctx, 25, 27, 1, 10, C.grey);
    // wavy free edge
    px(ctx, 10, 37, 3, 1, C.white);
    px(ctx, 16, 37, 4, 1, C.white);
    px(ctx, 24, 37, 3, 1, C.white);
  }
  function drawFrigateSail(ctx, teamColor) {
    mastAndFlag(ctx, 14, teamColor);
    // top sail
    px(ctx, 11, 18, 18, 8, C.out);
    px(ctx, 12, 19, 16, 6, C.canvas);
    px(ctx, 12, 19, 16, 1, C.canvasD);
    // main sail
    px(ctx, 7, 27, 26, 12, C.out);
    px(ctx, 8, 28, 24, 10, C.white);
    px(ctx, 8, 28, 24, 2, C.grey);
    px(ctx, 13, 30, 1, 8, C.grey);
    px(ctx, 26, 30, 1, 8, C.grey);
    // spars
    px(ctx, 9, 26, 22, 1, C.woodD);
    px(ctx, 11, 17, 18, 1, C.woodD);
  }

  function drawCatamaran(ctx, teamColor) {
    // twin narrow hulls with a deck bridge
    [8, 26].forEach(function (hx) {
      for (var y = 20; y <= 58; y++) {
        var t = (y - 20) / 38;
        var half = t < 0.6 ? 3 : Math.max(1, Math.round(3 * (1 - (t - 0.6) / 0.45)));
        px(ctx, hx + 3 - half, y, half * 2 + 1, 1, '#2b3a4a');
      }
      for (var y2 = 21; y2 <= 56; y2++) {
        var t2 = (y2 - 20) / 38;
        var h2 = t2 < 0.6 ? 2 : Math.max(1, Math.round(2 * (1 - (t2 - 0.6) / 0.42)));
        px(ctx, hx + 3 - h2 + 1, y2, Math.max(1, h2 * 2 - 1), 1, C.white);
      }
      px(ctx, hx + 2, 24, 1, 28, Camp.darken(teamColor, 0.1)); // racing stripe
    });
    // bridge deck
    px(ctx, 13, 28, 14, 16, '#2b3a4a');
    px(ctx, 14, 29, 12, 14, C.grey);
    px(ctx, 14, 29, 12, 3, C.greyM);
    px(ctx, 16, 33, 8, 6, teamColor);
    px(ctx, 16, 33, 8, 1, Camp.lighten(teamColor, 0.35));
  }

  function drawGalleon(ctx, teamColor) {
    var y;
    // broad wooden hull, flat stern, rounded bow
    for (y = 16; y <= 60; y++) {
      var t = (y - 16) / 44;
      var half = t < 0.62 ? 13 : Math.max(2, Math.round(13 * (1 - (t - 0.62) / 0.44)));
      px(ctx, 20 - half, y, half * 2, 1, C.out);
    }
    for (y = 17; y <= 58; y++) {
      var t3 = (y - 16) / 44;
      var h3 = t3 < 0.62 ? 12 : Math.max(1, Math.round(12 * (1 - (t3 - 0.62) / 0.42)));
      px(ctx, 20 - h3 + 1, y, Math.max(1, h3 * 2 - 2), 1, (y % 4 < 2) ? C.wood : C.woodD);
    }
    // gold trim lines + deck
    px(ctx, 9, 22, 22, 1, '#e9b64f');
    px(ctx, 10, 50, 20, 1, '#e9b64f');
    px(ctx, 11, 26, 18, 20, C.woodL);
    px(ctx, 11, 26, 18, 2, C.wood);
    // stern castle (raised block at the back)
    px(ctx, 12, 17, 16, 7, C.out);
    px(ctx, 13, 18, 14, 5, C.woodD);
    px(ctx, 14, 19, 3, 2, '#e9b64f');
    px(ctx, 23, 19, 3, 2, '#e9b64f');
    // bow figure
    px(ctx, 18, 57, 4, 3, '#e9b64f');
  }

  function drawPetrol(ctx) {
    px(ctx, 14, 6, 12, 10, C.out);
    px(ctx, 15, 7, 10, 8, '#c8362f');
    px(ctx, 15, 7, 10, 3, '#e8534a');
    px(ctx, 17, 11, 6, 2, C.black);
    // exhaust puffs
    px(ctx, 12, 3, 3, 3, 'rgba(160,170,180,0.8)');
    px(ctx, 24, 2, 3, 3, 'rgba(160,170,180,0.65)');
    px(ctx, 18, 1, 3, 3, 'rgba(160,170,180,0.5)');
  }
  function drawTurbine(ctx, teamColor) {
    px(ctx, 13, 5, 14, 11, C.out);
    px(ctx, 14, 6, 12, 9, C.greyM);
    px(ctx, 14, 6, 12, 3, C.greyD);
    px(ctx, 16, 9, 8, 4, C.black);   // intake
    px(ctx, 17, 10, 2, 2, '#3ee6ef');
    px(ctx, 21, 10, 2, 2, '#3ee6ef');
    // jet wash
    px(ctx, 15, 1, 3, 4, '#9ff5fa');
    px(ctx, 19, 0, 2, 5, '#e0fcff');
    px(ctx, 22, 1, 3, 4, '#9ff5fa');
  }

  function drawSpinnakerSail(ctx, teamColor) {
    mastAndFlag(ctx, 14, teamColor);
    // balloon sail: widening rows in team color with a light center stripe
    var rows = [
      { y: 18, half: 6 }, { y: 20, half: 9 }, { y: 22, half: 11 },
      { y: 24, half: 13 }, { y: 27, half: 14 }, { y: 31, half: 14 },
      { y: 35, half: 13 }, { y: 38, half: 11 },
    ];
    rows.forEach(function (r, i) {
      var h = (i < rows.length - 1 ? rows[i + 1].y : r.y + 2) - r.y;
      px(ctx, 20 - r.half - 1, r.y, r.half * 2 + 2, h, C.out);
    });
    rows.forEach(function (r, i) {
      var h = (i < rows.length - 1 ? rows[i + 1].y : r.y + 2) - r.y;
      px(ctx, 20 - r.half, r.y, r.half * 2, h, teamColor);
      px(ctx, 20 - r.half, r.y, 3, h, Camp.lighten(teamColor, 0.35));
    });
    px(ctx, 18, 18, 4, 22, C.white); // center stripe
    px(ctx, 18, 18, 1, 22, 'rgba(0,0,0,0.15)');
  }

  function drawDragonSail(ctx, teamColor) {
    mastAndFlag(ctx, 12, teamColor);
    // batwing membrane with glowing edges and spar "fingers"
    var memb = '#3a2f4e', membD = '#2a2138', glow = '#3ee6ef';
    px(ctx, 7, 17, 26, 3, C.out);
    px(ctx, 8, 18, 24, 1, membD);
    // membrane, scalloped bottom
    px(ctx, 7, 20, 26, 14, memb);
    px(ctx, 7, 20, 26, 2, membD);
    [9, 15, 21, 27].forEach(function (sx) { px(ctx, sx, 20, 2, 16, membD); }); // finger spars
    // scallops (cut notches from the bottom)
    [11, 17, 23, 29].forEach(function (sx) { px(ctx, sx, 32, 4, 2, 'rgba(0,0,0,0)'); });
    ctx.clearRect(12, 33, 3, 2); ctx.clearRect(18, 33, 3, 2); ctx.clearRect(24, 33, 3, 2);
    // glow edge
    px(ctx, 7, 34, 5, 1, glow);
    px(ctx, 15, 34, 3, 1, glow);
    px(ctx, 21, 34, 3, 1, glow);
    px(ctx, 27, 34, 6, 1, glow);
    px(ctx, 6, 17, 1, 18, glow);
    px(ctx, 33, 17, 1, 18, glow);
    // spikes on the top spar
    [10, 19, 28].forEach(function (sx) { px(ctx, sx, 15, 2, 2, membD); });
  }

  // ---- hull plating (drawn over the hull, under the sail) -----------------
  function platingShape(ctx, main, shade, dots) {
    // side bumpers
    px(ctx, 5, 26, 3, 26, C.out);
    px(ctx, 6, 27, 2, 24, main);
    px(ctx, 6, 27, 1, 24, shade);
    px(ctx, 32, 26, 3, 26, C.out);
    px(ctx, 32, 27, 2, 24, main);
    px(ctx, 33, 27, 1, 24, shade);
    // bow bumper
    px(ctx, 13, 58, 14, 3, C.out);
    px(ctx, 14, 59, 12, 2, main);
    for (var i = 0; i < 4; i++) {
      px(ctx, 6, 30 + i * 6, 1, 1, dots);
      px(ctx, 33, 30 + i * 6, 1, 1, dots);
    }
    px(ctx, 16, 59, 1, 1, dots);
    px(ctx, 23, 59, 1, 1, dots);
  }
  function drawWoodPlating(ctx) { platingShape(ctx, C.wood, C.woodD, C.woodL); }
  function drawSteelPlating(ctx) { platingShape(ctx, C.greyM, C.greyD, C.white); }

  // ---- bow charms ---------------------------------------------------------
  function drawDolphinCharm(ctx) {
    px(ctx, 17, 59, 6, 3, C.out);
    px(ctx, 18, 60, 4, 2, '#9fb8d0');
    px(ctx, 19, 58, 2, 2, '#9fb8d0'); // fin
    px(ctx, 22, 61, 2, 1, '#7d9bb8'); // tail
  }
  function drawGoldShellCharm(ctx) {
    // glow halo
    px(ctx, 16, 57, 8, 6, 'rgba(255, 226, 130, 0.45)');
    px(ctx, 17, 58, 6, 4, C.out);
    px(ctx, 18, 59, 4, 3, '#e9b64f');
    px(ctx, 18, 59, 4, 1, '#ffe9a8');
    px(ctx, 19, 60, 1, 2, '#c98f2b');
    px(ctx, 21, 60, 1, 2, '#c98f2b');
  }

  var HULLS = { raft: drawRaft, inflatable: drawInflatable, speedboat: drawSpeedboat,
                catamaran: drawCatamaran, galleon: drawGalleon };
  var MOTORS = { pan: drawPan, oar: drawOar, emotor: drawEMotor,
                 petrol: drawPetrol, turbine: drawTurbine };
  var SAILS = { tshirt: drawTShirtSail, bedsheet: drawBedsheetSail, frigate: drawFrigateSail,
                spinnaker: drawSpinnakerSail, dragon: drawDragonSail };
  var PLATING = { woodplate: drawWoodPlating, steelplate: drawSteelPlating };
  var CHARMS = { dolphin: drawDolphinCharm, goldshell: drawGoldShellCharm };

  /* Render a full boat (hull + motor + sail + flag) for a team's equipped build.
   *
   * `facing` turns the sprite so it points where it is going:
   *   undefined / 'down'    bow down — the canonical orientation used in the game
   *   'left' / 'right'      bow out to that side
   *   'nw' 'ne' 'sw' 'se'   bow out on the diagonal, stern toward the island
   *
   * A quarter turn is exact on a pixel grid — a transpose, not a resample. The
   * diagonals are not: 45 degrees has to resample, so the boat is scaled up to
   * whole blocks FIRST and only then turned, which keeps the stair-stepping on
   * the block grid instead of dissolving individual art pixels. */
  Camp.renderBoat = function (team, scale, facing) {
    scale = scale || 2;
    var unit = document.createElement('canvas');
    unit.width = BOAT_W; unit.height = BOAT_H;
    var ctx = unit.getContext('2d');
    (HULLS[team.equipped.boat] || drawRaft)(ctx, team.color);
    if (PLATING[team.equipped.hull]) PLATING[team.equipped.hull](ctx);
    (MOTORS[team.equipped.motor] || drawPan)(ctx, team.color);
    (SAILS[team.equipped.sail] || drawTShirtSail)(ctx, team.color);
    if (CHARMS[team.equipped.charm]) CHARMS[team.equipped.charm](ctx);

    var big = document.createElement('canvas');
    big.width = BOAT_W * scale; big.height = BOAT_H * scale;
    var bctx = big.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(unit, 0, 0, big.width, big.height);
    if (!facing || facing === 'down') return big;

    var out, octx;
    /* The bow points down in the source. Canvas y grows downward, so a positive
     * rotation turns clockwise on screen and sends a down-pointing bow to the
     * LEFT — the opposite of what the angle's sign suggests at a glance. */
    if (facing === 'left' || facing === 'right') {
      out = document.createElement('canvas');
      out.width = big.height; out.height = big.width;
      octx = out.getContext('2d');
      octx.imageSmoothingEnabled = false;
      if (facing === 'right') {
        octx.translate(0, out.height);
        octx.rotate(-Math.PI / 2);
      } else {
        octx.translate(out.width, 0);
        octx.rotate(Math.PI / 2);
      }
      octx.drawImage(big, 0, 0);
      return out;
    }

    var deg = DIAGONALS[facing];
    if (deg === undefined) return big;
    // a rectangle turned 45 degrees needs a square box of its half-perimeter
    var side = Math.ceil((big.width + big.height) * Math.SQRT1_2);
    out = document.createElement('canvas');
    out.width = side; out.height = side;
    octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.translate(side / 2, side / 2);
    octx.rotate(deg * Math.PI / 180);
    octx.drawImage(big, -big.width / 2, -big.height / 2);
    return out;
  };

  /* Screen angle that puts the bow in each diagonal, derived from the same
   * clockwise-positive convention as the quarter turns above. */
  var DIAGONALS = { nw: 135, ne: -135, sw: 45, se: -45 };

  /* Which way a boat in this quadrant should point to have its back to the
   * island, given [x, y] signs away from the centre. */
  Camp.boatFacing = function (sx, sy) {
    return (sy < 0 ? 'n' : 's') + (sx < 0 ? 'w' : 'e');
  };
  Camp.BOAT_W = BOAT_W; Camp.BOAT_H = BOAT_H;

  // ---- shop icons (32x32 unit grid) ---------------------------------------
  var ICONS = {
    pan: function (ctx) {
      px(ctx, 8, 6, 14, 14, C.out);
      px(ctx, 9, 7, 12, 12, C.black);
      px(ctx, 11, 9, 8, 8, '#4a5157');
      px(ctx, 12, 10, 3, 3, C.greyM);
      px(ctx, 13, 19, 4, 9, C.out);
      px(ctx, 14, 19, 2, 8, C.woodD);
    },
    oar: function (ctx) {
      for (var i = 0; i < 9; i++) px(ctx, 8 + i * 2, 22 - i * 2, 3, 3, i < 2 ? C.woodL : C.woodD);
      px(ctx, 22, 4, 6, 8, C.out);
      px(ctx, 23, 5, 4, 6, C.woodL);
      px(ctx, 6, 24, 4, 4, C.out);
      px(ctx, 7, 25, 2, 2, C.wood);
    },
    emotor: function (ctx) {
      px(ctx, 8, 5, 16, 10, C.out);
      px(ctx, 9, 6, 14, 8, C.greyM);
      px(ctx, 9, 6, 14, 3, C.greyD);
      px(ctx, 11, 10, 5, 3, '#e8433f');
      px(ctx, 14, 15, 4, 8, C.out);
      px(ctx, 15, 16, 2, 7, C.greyD);
      px(ctx, 10, 23, 12, 3, C.out);
      px(ctx, 11, 24, 10, 1, C.glass);
      px(ctx, 8, 26, 4, 2, C.foam);
      px(ctx, 20, 26, 4, 2, C.foam);
    },
    tshirt: function (ctx) {
      px(ctx, 10, 6, 12, 20, C.out);
      px(ctx, 11, 7, 10, 18, C.white);
      px(ctx, 5, 6, 6, 7, C.out);
      px(ctx, 6, 7, 4, 5, C.white);
      px(ctx, 21, 6, 6, 7, C.out);
      px(ctx, 22, 7, 4, 5, C.white);
      px(ctx, 14, 6, 4, 2, C.floor);   // collar
      px(ctx, 13, 12, 3, 3, C.floor);  // holes
      px(ctx, 18, 18, 3, 2, C.floor);
      px(ctx, 12, 21, 2, 2, C.floor);
      px(ctx, 19, 9, 1, 2, C.floor);
    },
    bedsheet: function (ctx) {
      px(ctx, 15, 3, 2, 26, C.woodD);
      px(ctx, 5, 5, 22, 18, C.out);
      px(ctx, 6, 6, 20, 16, C.white);
      px(ctx, 6, 6, 20, 3, C.grey);
      px(ctx, 11, 9, 1, 13, C.grey);
      px(ctx, 20, 9, 1, 13, C.grey);
      px(ctx, 7, 22, 4, 1, C.white);
      px(ctx, 14, 22, 5, 1, C.white);
      px(ctx, 22, 22, 3, 1, C.white);
    },
    frigate: function (ctx) {
      px(ctx, 15, 2, 2, 28, C.woodD);
      px(ctx, 9, 3, 14, 7, C.out);
      px(ctx, 10, 4, 12, 5, C.canvas);
      px(ctx, 6, 12, 20, 9, C.out);
      px(ctx, 7, 13, 18, 7, C.white);
      px(ctx, 7, 13, 18, 2, C.grey);
      px(ctx, 8, 23, 16, 6, C.out);
      px(ctx, 9, 24, 14, 4, C.canvas);
      px(ctx, 8, 11, 16, 1, C.woodD);
      px(ctx, 7, 22, 18, 1, C.woodD);
    },
    raft: function (ctx) {
      for (var i = 0; i < 5; i++) {
        px(ctx, 5 + i * 5, 5 + (i % 2 ? 0 : 2), 5, 22 - (i % 2 ? 0 : 3), C.out);
        px(ctx, 6 + i * 5, 6 + (i % 2 ? 0 : 2), 3, 20 - (i % 2 ? 0 : 3), i % 2 ? C.wood : C.woodL);
        px(ctx, 6 + i * 5, 6 + (i % 2 ? 0 : 2), 1, 20 - (i % 2 ? 0 : 3), C.woodD);
      }
      px(ctx, 4, 10, 24, 2, C.rope);
      px(ctx, 4, 20, 24, 2, C.rope);
    },
    inflatable: function (ctx) {
      px(ctx, 7, 4, 18, 24, C.out);
      px(ctx, 5, 8, 22, 16, C.out);
      px(ctx, 8, 5, 16, 22, C.orange);
      px(ctx, 6, 9, 20, 14, C.orange);
      px(ctx, 8, 6, 3, 20, C.orangeL);
      px(ctx, 22, 8, 2, 16, C.orangeD);
      px(ctx, 11, 10, 10, 12, C.floor);
      px(ctx, 11, 15, 10, 3, C.orangeD);
    },
    speedboat: function (ctx) {
      var y;
      for (y = 4; y <= 28; y++) {
        var t = (y - 4) / 24;
        var half = t < 0.5 ? 8 : Math.max(1, Math.round(8 * (1 - (t - 0.5) / 0.55)));
        px(ctx, 15 - half, y, half * 2 + 1, 1, '#2b3a4a');
      }
      for (y = 5; y <= 26; y++) {
        var t2 = (y - 4) / 24;
        var h2 = t2 < 0.5 ? 7 : Math.max(1, Math.round(7 * (1 - (t2 - 0.5) / 0.5)));
        px(ctx, 15 - h2 + 1, y, Math.max(1, h2 * 2 - 1), 1, C.white);
      }
      px(ctx, 14, 15, 3, 12, '#e8433f');
      px(ctx, 10, 8, 11, 5, C.greyD);
      px(ctx, 11, 9, 9, 3, C.floor);
      px(ctx, 10, 13, 11, 1, C.glass);
    },
    petrol: function (ctx) {
      px(ctx, 7, 6, 18, 14, C.out);
      px(ctx, 8, 7, 16, 12, '#c8362f');
      px(ctx, 8, 7, 16, 4, '#e8534a');
      px(ctx, 11, 12, 10, 4, C.black);
      px(ctx, 13, 13, 6, 2, C.greyM);
      px(ctx, 14, 20, 4, 6, C.out);
      px(ctx, 15, 21, 2, 5, C.greyD);
      px(ctx, 22, 3, 4, 3, 'rgba(160,170,180,0.8)');
      px(ctx, 26, 1, 3, 3, 'rgba(160,170,180,0.55)');
    },
    turbine: function (ctx) {
      px(ctx, 6, 8, 20, 13, C.out);
      px(ctx, 7, 9, 18, 11, C.greyM);
      px(ctx, 7, 9, 18, 4, C.greyD);
      px(ctx, 10, 12, 12, 6, C.black);
      px(ctx, 12, 14, 2, 2, '#3ee6ef');
      px(ctx, 15, 14, 2, 2, '#3ee6ef');
      px(ctx, 18, 14, 2, 2, '#3ee6ef');
      px(ctx, 26, 10, 4, 3, '#9ff5fa');
      px(ctx, 26, 15, 5, 3, '#e0fcff');
      px(ctx, 5, 23, 22, 3, C.foam);
    },
    spinnaker: function (ctx) {
      px(ctx, 15, 2, 2, 28, C.woodD);
      var rows = [[5, 5], [7, 9], [9, 12], [12, 13], [16, 13], [20, 12], [23, 9]];
      rows.forEach(function (r) { px(ctx, 16 - r[1], r[0], r[1] * 2, 3, C.out); });
      rows.forEach(function (r) {
        px(ctx, 16 - r[1] + 1, r[0] + 1, r[1] * 2 - 2, 2, '#e8433f');
        px(ctx, 16 - r[1] + 1, r[0] + 1, 3, 2, '#ff7d75');
      });
      px(ctx, 14, 6, 4, 19, C.white);
    },
    dragon: function (ctx) {
      px(ctx, 15, 2, 2, 28, C.woodD);
      px(ctx, 4, 5, 24, 3, C.out);
      px(ctx, 4, 8, 24, 12, '#3a2f4e');
      [7, 13, 19, 25].forEach(function (sx) { px(ctx, sx, 8, 2, 14, '#2a2138'); });
      ctx.clearRect(9, 19, 4, 3); ctx.clearRect(15, 19, 4, 3); ctx.clearRect(21, 19, 4, 3);
      px(ctx, 4, 20, 3, 1, '#3ee6ef');
      px(ctx, 13, 20, 2, 1, '#3ee6ef');
      px(ctx, 19, 20, 2, 1, '#3ee6ef');
      px(ctx, 25, 20, 3, 1, '#3ee6ef');
      px(ctx, 3, 5, 1, 16, '#3ee6ef');
      px(ctx, 28, 5, 1, 16, '#3ee6ef');
      [6, 15, 24].forEach(function (sx) { px(ctx, sx, 3, 2, 2, '#2a2138'); });
    },
    catamaran: function (ctx) {
      [7, 20].forEach(function (hx) {
        px(ctx, hx, 4, 6, 24, '#2b3a4a');
        px(ctx, hx + 1, 5, 4, 21, C.white);
        px(ctx, hx + 2, 8, 1, 16, '#e8433f');
        px(ctx, hx + 1, 26, 4, 1, C.grey);
      });
      px(ctx, 12, 10, 9, 10, C.greyD);
      px(ctx, 13, 11, 7, 8, C.grey);
      px(ctx, 14, 13, 5, 4, '#e8433f');
    },
    galleon: function (ctx) {
      var y;
      for (y = 3; y <= 29; y++) {
        var t = (y - 3) / 26;
        var half = t < 0.6 ? 9 : Math.max(1, Math.round(9 * (1 - (t - 0.6) / 0.45)));
        px(ctx, 15 - half, y, half * 2 + 1, 1, C.out);
      }
      for (y = 4; y <= 27; y++) {
        var t2 = (y - 3) / 26;
        var h2 = t2 < 0.6 ? 8 : Math.max(1, Math.round(8 * (1 - (t2 - 0.6) / 0.42)));
        px(ctx, 15 - h2 + 1, y, Math.max(1, h2 * 2 - 1), 1, (y % 4 < 2) ? C.wood : C.woodD);
      }
      px(ctx, 8, 8, 15, 1, '#e9b64f');
      px(ctx, 9, 22, 13, 1, '#e9b64f');
      px(ctx, 10, 4, 11, 4, C.woodD);
      px(ctx, 11, 5, 2, 2, '#e9b64f');
      px(ctx, 18, 5, 2, 2, '#e9b64f');
      px(ctx, 14, 27, 3, 2, '#e9b64f');
    },
    woodplate: function (ctx) {
      // shield
      px(ctx, 8, 4, 16, 18, C.out);
      px(ctx, 9, 5, 14, 16, C.wood);
      px(ctx, 9, 5, 14, 4, C.woodL);
      for (var yy = 22; yy <= 27; yy++) px(ctx, 8 + (yy - 21), yy, 16 - (yy - 21) * 2, 1, yy === 27 ? C.out : C.wood);
      px(ctx, 8, 22, 16, 1, C.out);
      px(ctx, 15, 8, 2, 14, C.woodD);
      px(ctx, 11, 8, 1, 1, C.woodL); px(ctx, 20, 8, 1, 1, C.woodL);
      px(ctx, 11, 17, 1, 1, C.woodL); px(ctx, 20, 17, 1, 1, C.woodL);
    },
    steelplate: function (ctx) {
      px(ctx, 8, 4, 16, 18, C.out);
      px(ctx, 9, 5, 14, 16, C.greyM);
      px(ctx, 9, 5, 14, 4, C.grey);
      for (var yy = 22; yy <= 27; yy++) px(ctx, 8 + (yy - 21), yy, 16 - (yy - 21) * 2, 1, yy === 27 ? C.out : C.greyM);
      px(ctx, 8, 22, 16, 1, C.out);
      px(ctx, 15, 8, 2, 14, C.greyD);
      px(ctx, 11, 8, 1, 1, C.white); px(ctx, 20, 8, 1, 1, C.white);
      px(ctx, 11, 17, 1, 1, C.white); px(ctx, 20, 17, 1, 1, C.white);
    },
    dolphin: function (ctx) {
      px(ctx, 6, 14, 20, 8, C.out);
      px(ctx, 7, 15, 18, 6, '#9fb8d0');
      px(ctx, 7, 15, 18, 2, '#c3d6e8');
      px(ctx, 13, 10, 5, 5, C.out);
      px(ctx, 14, 11, 3, 4, '#9fb8d0'); // dorsal fin
      px(ctx, 24, 11, 5, 5, C.out);
      px(ctx, 25, 12, 3, 3, '#7d9bb8'); // tail
      px(ctx, 9, 16, 2, 2, C.black);   // eye
    },
    goldshell: function (ctx) {
      px(ctx, 8, 6, 16, 4, 'rgba(255,226,130,0.5)');
      px(ctx, 6, 10, 20, 4, 'rgba(255,226,130,0.35)');
      px(ctx, 9, 8, 14, 16, C.out);
      px(ctx, 10, 9, 12, 14, '#e9b64f');
      px(ctx, 10, 9, 12, 3, '#ffe9a8');
      px(ctx, 13, 11, 2, 12, '#c98f2b');
      px(ctx, 17, 11, 2, 12, '#c98f2b');
      px(ctx, 12, 24, 8, 3, C.out);
      px(ctx, 13, 25, 6, 2, '#c98f2b'); // hinge
    },
  };

  /* ---- small UI glyphs ----------------------------------------------------
   * The interface used to lean on emoji (🐚 ⛵ 🌊 🥇), which the OS renders as
   * smooth full-colour vectors — the one thing on screen that could never match
   * the sprites. These replace them.
   *
   * Written as pixel maps because that stays far easier to read and nudge than
   * a wall of fillRect calls. Drawn on a 10x10 grid: at scale 2 one art pixel is
   * 2 CSS px, exactly a pixel on the boat sprites, so the icons land on the same
   * grid as everything else. */
  var UI_COLORS = {
    o: '#16222f',                      // outline
    p: '#ffd3de', P: '#e894ab',        // shell
    b: '#5cc8ea', B: '#2f7fa8',        // water
    w: C.wood,    W: C.woodD, c: C.canvas,
    k: '#c3ccd4', K: '#6d7b87',        // metal
    M: '#e9b64f', m: '#c98f2b',        // medal, overridable per rank
  };

  var UI_ART = {
    shell: [
      '...oooo...',
      '..opppo...',
      '.opPpPpo..',
      'opPpPpPpo.',
      'opPpPpPpo.',
      'opPpPpPpo.',
      '.opPpPpo..',
      '..oppppo..',
      '...oooo...',
      '..........',
    ],
    wave: [
      '..........',
      '..........',
      '...oo...oo',
      '..obbo.obb',
      '.obbbbobbb',
      'obbBbbbbBb',
      'oBBBBBBBBB',
      '.ooooooooo',
      '..........',
      '..........',
    ],
    /* the mast is drawn in wood, not outline — an outline-coloured mast vanishes
       against the panel and leaves the sail floating above the hull */
    boat: [
      '...oo.....',
      '...owcco..',
      '...owccco.',
      '...owcccco',
      '...owoooo.',
      '...ow.....',
      'oooooooooo',
      'owwwwwwwwo',
      '.oWWWWWWo.',
      '..oooooo..',
    ],
    /* Sliders rather than a cog: a ten-pixel cog needs teeth and a bore, and at
       that size the two collapse into each other and read as a hash symbol. */
    settings: [
      '..........',
      'KKKKKKKKKK',
      '.....kk...',
      '.....kk...',
      'KKKKKKKKKK',
      '..kk......',
      '..kk......',
      'KKKKKKKKKK',
      '.......kk.',
      '.......kk.',
    ],
    play: [
      '..........',
      '..MM......',
      '..MMM.....',
      '..MMMM....',
      '..MMMMM...',
      '..MMMMM...',
      '..MMMM....',
      '..MMM.....',
      '..MM......',
      '..........',
    ],
    crown: [
      '..........',
      '.o.o.o.o..',
      '.o.o.o.o..',
      '.oMoMoMo..',
      '.oMMMMMo..',
      '.oMMMMMo..',
      '.ooooooo..',
      '..........',
      '..........',
      '..........',
    ],
    flag: [
      '.o........',
      '.occoocc..',
      '.ooccooc..',
      '.occoocc..',
      '.ooccooc..',
      '.o........',
      '.o........',
      '.o........',
      '.oo.......',
      '..........',
    ],
    /* A plain shaded disc. An earlier version had proper ribbon straps above the
       medallion, but two stalks on a round body reads as an insect at 10px —
       rank is carried by the tint anyway. */
    medal: [
      '..........',
      '...oooo...',
      '..oMMMMo..',
      '.oMMMMMmo.',
      '.oMMMmmmo.',
      '.oMMmmmmo.',
      '..ommmmo..',
      '...oooo...',
      '..........',
      '..........',
    ],
  };

  /* ---- bitmap typeface -----------------------------------------------------
   * A browser cannot render vector text as pixel art — antialiased curves are
   * exactly what pixel art is not — so display text is drawn from an actual
   * 5x7 bitmap font. Two rows are reserved above every line for Czech
   * diacritics, which are composed onto the plain letter rather than being
   * drawn as separate glyphs. */
  var GLYPH_W = 5, GLYPH_H = 7, GLYPH_GAP = 1, ACCENT_H = 2;

  var FONT = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '#....', '####.', '....#', '#...#', '.###.'],
    '6': ['.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
    ',': ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  };

  var MARKS = {
    acute: ['...#.', '..#..'],
    caron: ['.#.#.', '..#..'],
    ring:  ['..#..', '.#.#.'],
  };

  /* Czech letters, composed as a plain letter plus a mark. */
  var ACCENTED = {
    'Á': ['A', 'acute'], 'É': ['E', 'acute'], 'Í': ['I', 'acute'], 'Ó': ['O', 'acute'],
    'Ú': ['U', 'acute'], 'Ý': ['Y', 'acute'], 'Ů': ['U', 'ring'],
    'Č': ['C', 'caron'], 'Ď': ['D', 'caron'], 'Ě': ['E', 'caron'], 'Ň': ['N', 'caron'],
    'Ř': ['R', 'caron'], 'Š': ['S', 'caron'], 'Ť': ['T', 'caron'], 'Ž': ['Z', 'caron'],
  };

  /* Unit-grid size of a string, before scaling. One pixel of margin all round
     leaves room for the outline to sit in. */
  function textGrid(text) {
    return {
      w: text.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP + 2,
      h: ACCENT_H + GLYPH_H + 2,
    };
  }
  Camp.textGrid = textGrid;

  /* Render a line of display text.
   *
   * opts.scale      pixels per art pixel (default 4)
   * opts.top/bottom the two flat bands the letters are filled with
   * opts.outline    colour of the 1px hard outline, or null for none
   * opts.splitRow   glyph row where the fill changes band (default 3) */
  Camp.renderText = function (text, opts) {
    opts = opts || {};
    var scale = opts.scale || 4;
    var top = opts.top || '#ffe9b0';
    var bottom = opts.bottom || '#c98f2b';
    var outline = opts.outline === undefined ? '#050f1c' : opts.outline;
    var splitRow = opts.splitRow === undefined ? 3 : opts.splitRow;

    text = String(text).toUpperCase();
    var grid = textGrid(text);

    // paint the glyphs into a boolean mask first, so the outline can be derived
    // from it rather than being drawn per glyph and doubling up between letters
    var mask = [];
    for (var y = 0; y < grid.h; y++) {
      mask.push(new Array(grid.w));
    }

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var acc = ACCENTED[ch];
      var rows = FONT[acc ? acc[0] : ch];
      if (!rows) rows = FONT[' '];
      var gx = 1 + i * (GLYPH_W + GLYPH_GAP);
      for (var r = 0; r < GLYPH_H; r++) {
        for (var c = 0; c < GLYPH_W; c++) {
          if (rows[r].charAt(c) === '#') mask[1 + ACCENT_H + r][gx + c] = r < splitRow ? 1 : 2;
        }
      }
      if (acc) {
        var mk = MARKS[acc[1]];
        for (var mr = 0; mr < ACCENT_H; mr++) {
          for (var mc = 0; mc < GLYPH_W; mc++) {
            if (mk[mr].charAt(mc) === '#') mask[1 + mr][gx + mc] = 1;
          }
        }
      }
    }

    var out = document.createElement('canvas');
    out.width = grid.w * scale;
    out.height = grid.h * scale;
    var ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function on(x, y) {
      return y >= 0 && y < grid.h && x >= 0 && x < grid.w && mask[y][x];
    }

    if (outline) {
      ctx.fillStyle = outline;
      for (var oy = 0; oy < grid.h; oy++) {
        for (var ox = 0; ox < grid.w; ox++) {
          if (on(ox, oy)) continue;
          // any empty cell touching a lit one becomes outline, including corners,
          // so letters stay legible against busy water
          if (on(ox - 1, oy) || on(ox + 1, oy) || on(ox, oy - 1) || on(ox, oy + 1) ||
              on(ox - 1, oy - 1) || on(ox + 1, oy - 1) ||
              on(ox - 1, oy + 1) || on(ox + 1, oy + 1)) {
            ctx.fillRect(ox * scale, oy * scale, scale, scale);
          }
        }
      }
    }

    for (var fy = 0; fy < grid.h; fy++) {
      for (var fx = 0; fx < grid.w; fx++) {
        if (!mask[fy][fx]) continue;
        ctx.fillStyle = mask[fy][fx] === 1 ? top : bottom;
        ctx.fillRect(fx * scale, fy * scale, scale, scale);
      }
    }

    out.setAttribute('role', 'img');
    out.setAttribute('aria-label', text);
    return out;
  };

  /* ---- cloud shadow -------------------------------------------------------
   * A drifting shadow, built as pixel art rather than as a blurred blob: value
   * noise on a coarse lattice, cut into two flat alpha steps. A third step is
   * below what a projector can actually show, and a smooth gradient would be the
   * one un-pixelated thing left on the board.
   *
   * Seeded rather than Math.random so a given cloud is always the same cloud —
   * renderIsland runs again on every resize and language switch, and the sky
   * should not reshuffle when someone drags the window. */
  var cloudCache = {};

  Camp.cloudShadow = function (seed) {
    if (cloudCache[seed]) return cloudCache[seed];

    var W = 128, H = 80;
    var s = (seed * 2654435761) >>> 0;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    function ease(t) { return t * t * (3 - 2 * t); }

    /* Two octaves, not one. A single coarse lattice produces two or three huge
     * amorphous blobs that read as geometry rather than weather; adding a finer
     * octave at lower amplitude breaks their edges up into something cloud-shaped. */
    function octave(lx, ly) {
      var lat = [];
      for (var j = 0; j <= ly; j++) {
        lat.push([]);
        for (var i = 0; i <= lx; i++) lat[j].push(rnd());
      }
      return function (x, y) {
        var fx = x / W * lx, fy = y / H * ly;
        var x0 = Math.floor(fx), y0 = Math.floor(fy);
        var tx = ease(fx - x0), ty = ease(fy - y0);
        var a = lat[y0][x0] + (lat[y0][x0 + 1] - lat[y0][x0]) * tx;
        var b = lat[y0 + 1][x0] + (lat[y0 + 1][x0 + 1] - lat[y0 + 1][x0]) * tx;
        return a + (b - a) * ty;
      };
    }
    var coarse = octave(8, 5), fine = octave(21, 13);

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');

    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var v = (coarse(x, y) + 0.45 * fine(x, y)) / 1.45;
        // feather the tile edges, or the cloud ends in a hard rectangle
        v *= Math.min(1, Math.min(x, W - 1 - x) / 14) * Math.min(1, Math.min(y, H - 1 - y) / 10);
        if (v < 0.47) continue;
        // three steps, shallow: a cloud shadow should darken the water, not stain it
        ctx.fillStyle = v < 0.55 ? 'rgba(3, 11, 22, 0.10)'
                      : v < 0.62 ? 'rgba(3, 11, 22, 0.19)'
                      : 'rgba(3, 11, 22, 0.27)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    cloudCache[seed] = cv.toDataURL();
    return cloudCache[seed];
  };

  /* tint optionally replaces the [light, dark] medal pair, so one map serves
     gold, silver, bronze and also-ran. */
  Camp.renderUiIcon = function (name, scale, tint) {
    scale = scale || 2;
    var art = UI_ART[name];
    var out = document.createElement('canvas');
    out.width = 10 * scale;
    out.height = 10 * scale;
    if (!art) return out;
    var ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (var y = 0; y < art.length; y++) {
      for (var x = 0; x < art[y].length; x++) {
        var ch = art[y].charAt(x);
        var col = tint && ch === 'M' ? tint[0]
                : tint && ch === 'm' ? tint[1]
                : UI_COLORS[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return out;
  };

  /* Icon canvas for a shop item. Team color only matters for a few accents. */
  Camp.renderIcon = function (itemId, scale) {
    scale = scale || 3;
    var unit = document.createElement('canvas');
    unit.width = 32; unit.height = 32;
    var ctx = unit.getContext('2d');
    (ICONS[itemId] || function () {})(ctx);
    var out = document.createElement('canvas');
    out.width = 32 * scale; out.height = 32 * scale;
    var octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(unit, 0, 0, out.width, out.height);
    return out;
  };
})();
