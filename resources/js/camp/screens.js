/* HelloCamp 2026 — Screen 1 (island overview) and Screen 2 (shipyard shop). */
window.Camp = window.Camp || {};

(function () {

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------------------------------------------------------------- Screen 1
  /* Which quadrant each team's ship sails out into, as [x, y] signs. They line up
   * with the corners its card sits in, below. Ships travel mainly sideways: a
   * 16:9 stage has roughly three times more room left-to-right than up-and-down,
   * and a ship heading due north has no water to sail into at all. */
  var SHIP_QUADRANT = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

  /* Scenery in the open water: sea stacks, reef patches and a wreck. Positions
   * are literal fractions of the stage and never random — renderIsland runs
   * again on every resize and every language switch, and the sea floor should
   * not rearrange itself when somebody drags the window.
   *
   * All of it hugs the left and right thirds, leaving the middle band clear for
   * the island, and `w` is each sprite's true pixel width so it can be blown up
   * by a whole number. */
  var SCENERY = [
    { art: 'rock-a',  w: 56, x: 0.14, y: 0.26, flip: false },
    // kept out to the corner: at x 0.79 it crowded the end of the wordmark
    { art: 'rock-a',  w: 56, x: 0.88, y: 0.17, flip: true },
    // parked in the gap between the two right-hand boats, not under one of them
    { art: 'reef-a',  w: 52, x: 0.93, y: 0.53, flip: false },
    { art: 'reef-b',  w: 34, x: 0.08, y: 0.66, flip: true },
    // pushed out of the bottom-centre: the menu bar grew a button and on a
    // 1024-wide laptop it reached this reef
    { art: 'reef-c',  w: 34, x: 0.15, y: 0.90, flip: false },
    // tucked into the bottom corner, clear of where the lower-right boat's
    // readout ends up once that team has sailed a full week
    { art: 'wreck-a', w: 52, x: 0.84, y: 0.87, flip: true },
  ];
  /* Turned 45 degrees a boat needs a square box of its half-perimeter, so scale 2
     would be larger on screen than the upright sprite ever was. Scale 1 keeps the
     fleet small enough to leave the island as the subject of the board. */
  var BOAT_SCALE = 1;

  /* ------------------------------------------------------------------ camera
   *
   * The island receding and the boats advancing are the same fact, not two
   * effects: as the leading team pulls away, the whole view pulls back with it.
   * The island is a fixed thing in the world, so a wider view makes it smaller
   * on screen, and that retreating shoreline is what frees the water the fleet
   * sails into.
   *
   * The leader's share of the water saturates rather than being re-fitted each
   * night. Re-fitting is what pins the leader: divide by the leader and the
   * leader is always exactly 1, so the boat everyone watches never moves however
   * far it sails. A saturating curve keeps every extra metre worth something
   * while never running off the edge — and it needs no ceiling, so it behaves
   * whether the week ends at 800 m or 80 000 m.
   *
   * ZOOM_HALF is the one number worth retuning. It is the distance at which the
   * leader is halfway out and the island has given up half the ground it will
   * ever give up. Lower it to make the week feel faster, raise it to stretch the
   * sense of scale out.
   *
   * It was 2500, which spent half the lane inside the first two nights and left
   * nothing for the rest of the week: a 400 m night moved a boat 26px on Monday
   * and literally 0px once it was 20 km out. 6000 spreads the same lane over a
   * plausible week instead, and paces the island's shrink to match.
   *
   * Note this can only ever be a partial fix. The lane is about 256px wide on a
   * laptop, so a night worth 2% of the week is 5px however the curve is shaped —
   * which is why the board also prints the night's gain as a number. */
  var ZOOM_HALF = 6000;

  /* The island keeps most of its presence. An earlier version scaled it straight
   * down toward a floor, which meant that by mid-week it had collapsed to a small
   * disc adrift in a lot of empty water — the thing the whole board is about,
   * reduced to the least interesting object on screen. Instead the shrink is
   * bounded to the range below: it recedes enough to sell the camera pulling
   * back, and never far enough to stop being the landmass everyone is escaping. */
  /* How small it gets once the fleet is long gone. Snapping the island to whole
     multiples costs it range — 0.62 rounded to the same step as 0.75 on a laptop,
     so the shrink stopped reading at all. 0.55 buys back a third discrete step
     without letting the island stop being a landmass. */
  var ISLAND_FAR = 0.55;

  // true pixel dimensions of the art, so it can be blown up by whole numbers
  var ISLAND_SRC = 160;
  var OCEAN_SRC_W = 320, OCEAN_SRC_H = 179;

  function leaderDistance() {
    var leader = 0;
    Camp.state.teams.forEach(function (t) { leader = Math.max(leader, t.distance); });
    return leader;
  }

  /* Fraction of its full size the island is drawn at: 1 at the start of the week,
   * easing toward ISLAND_FAR and never below it. */
  function islandScale(leader) {
    return ISLAND_FAR + (1 - ISLAND_FAR) * (ZOOM_HALF / (leader + ZOOM_HALF));
  }

  /* How far along its run a boat sits, from 0 at the shore to 1 far out.
   *
   * Two rules keep a boat from ever sliding backwards, and both were learned the
   * hard way:
   *
   * 1. Measure each boat by its OWN metres, never as a fraction of the leader's.
   *    Measuring against the leader keeps the fleet in true proportion, but it
   *    means a team going nowhere relative to a runaway leader gets pulled in
   *    even while it sails.
   * 2. Anchor to the island's UNSCALED size, not the size it is drawn at. The
   *    shore retreats a long way as the camera pulls back — faster, early on,
   *    than a trailing team's own progress can carry it — so a boat pinned to
   *    the live shoreline gets towed inward with it.
   *
   * Both ends of the range are therefore fixed, and only the boat's own distance
   * moves it. The island recedes behind the fleet rather than dragging it. */
  function shipProgress(d) {
    return d / (d + ZOOM_HALF);
  }

  Camp.renderIsland = function () {
    var stage = document.getElementById('island-stage');
    stage.innerHTML = '';

    var stageRect = stage.getBoundingClientRect();

    /* ---- pixel grid ------------------------------------------------------
     *
     * Every upscaled asset is snapped to a WHOLE multiple of its source size.
     * A pixel image drawn at 4.59x has some source pixels three screen pixels
     * wide and some four; the eye reads that as mush, and it is the difference
     * between art that looks authored and art that looks resampled.
     *
     * The island therefore steps between a handful of discrete sizes across the
     * week instead of tweening smoothly through every fraction between them —
     * and the CSS transition that used to slide it through those fractions is
     * gone for the same reason. */
    var leader = leaderDistance();
    var wanted = Math.min(stageRect.width * 0.52, stageRect.height * 0.68);
    var baseK = Math.max(2, Math.round(wanted / ISLAND_SRC));
    var islandK = Math.max(2, Math.round(baseK * islandScale(leader)));
    stage.style.setProperty('--island-px', (ISLAND_SRC * islandK) + 'px');

    /* The ocean tiles at `cover`, which is never a whole multiple either. These
     * go on the root, not the stage: .ocean-bg is the stage's PARENT and custom
     * properties only inherit downward. Ceil, never floor, or the background
     * stops short of the viewport and letterboxes. */
    var oceanK = Math.max(1, Math.ceil(Math.max(stageRect.width / OCEAN_SRC_W,
                                                stageRect.height / OCEAN_SRC_H)));
    var root = document.documentElement.style;
    root.setProperty('--ocean-w', (OCEAN_SRC_W * oceanK) + 'px');
    root.setProperty('--ocean-h', (OCEAN_SRC_H * oceanK) + 'px');

    /* Scenery first, so it sits under everything else. One whole-number block
     * size keeps it on the same pixel grid as the boats — a fractional scale
     * would resample the sprites and fuzz their edges. */
    var blockPx = Math.max(2, Math.round(stageRect.width / 700));
    SCENERY.forEach(function (d) {
      var img = document.createElement('img');
      img.className = 'sea-deco';
      img.src = 'resources/camp/deco/' + d.art + '.png';
      img.alt = '';
      img.style.width = (d.w * blockPx) + 'px';
      img.style.left = (d.x * 100) + '%';
      img.style.top = (d.y * 100) + '%';
      if (d.flip) img.style.transform = 'translate(-50%, -50%) scaleX(-1)';
      stage.appendChild(img);
    });

    /* Cloud shadow, sliding over the water, the boats and the island alike. One
     * shadow crossing all three is what makes them read as being in the same
     * place rather than as stacked layers — so it sits ABOVE the boats. Two
     * seeds at different speeds keeps it from looking like one repeating blob. */
    [['cloud-a', 3], ['cloud-b', 91]].forEach(function (c) {
      var cl = el('div', 'cloud-shadow ' + c[0]);
      cl.style.backgroundImage = 'url(' + Camp.cloudShadow(c[1]) + ')';
      stage.appendChild(cl);
    });

    // central island (generated key art)
    var isl = document.createElement('img');
    isl.className = 'island-canvas';
    isl.src = 'resources/camp/island-px.png';
    isl.alt = '';
    // no re-render on load any more: the boats are anchored to the island's size
    // as the stylesheet computes it, so nothing here waits on the image decoding
    stage.appendChild(isl);

    /* Fireflies drifting over the forest. Their spread tracks the island as it
     * recedes — pinned to a fixed slice of the stage they would end up hovering
     * over open water once the island had shrunk away beneath them. */
    var scale = islandScale(leader);
    for (var fi = 0; fi < 8; fi++) {
      var fly = el('div', 'firefly');
      fly.style.left = (50 + (Math.random() - 0.5) * 32 * scale) + '%';
      fly.style.top = (52 + (Math.random() - 0.5) * 44 * scale) + '%';
      fly.style.animationDelay = (Math.random() * 6) + 's';
      fly.style.animationDuration = (5 + Math.random() * 6) + 's';
      stage.appendChild(fly);
    }

    /* The logo is drawn from the bitmap font rather than set in a webfont: a
     * vector serif is antialiased by definition, which is the one thing pixel
     * art cannot be. Scale is picked so the wordmark lands at roughly 60% of the
     * stage, then floored to a whole number — a fractional scale would resample
     * the letters and fuzz their edges. */
    var title = el('div', 'island-title');
    // with the corner tables gone the wordmark has the whole width to work with
    var titleBudget = Math.max(160, stageRect.width * 0.62);
    var titleScale = Math.max(2, Math.min(7,
      Math.floor(titleBudget / Camp.textGrid(Camp.STR.title).w)));
    /* Bone white shading into weathered sea-teal, both sampled from the island
     * itself — its beaches run about #e1dbca and its lagoons about #5bb2b1. That
     * keeps the wordmark part of the place rather than an ornament laid on top,
     * and still holds ~9.7:1 against the water, the same legibility the old gold
     * had. The outline is the island's own darkest green. */
    title.appendChild(Camp.renderText(Camp.STR.title, {
      scale: titleScale,
      top: '#f4efdd', bottom: '#89b8ae', outline: '#061415',
    }));
    stage.appendChild(title);

    /* Standings, with ties sharing a place — two teams level on 900 m are both
     * second, and nobody is third. Sorting by index alone also handed team 0 a
     * gold medal on a fresh board for having sailed nowhere, so a week that has
     * not started yet gets no places at all. */
    var ranked = Camp.state.teams.slice().sort(function (a, b) { return b.distance - a.distance; });
    var anySailed = ranked[0].distance > 0;
    var rankOf = {};
    ranked.forEach(function (t, i) {
      rankOf[t.id] = (i > 0 && t.distance === ranked[i - 1].distance)
        ? rankOf[ranked[i - 1].id]
        : i;
    });

    // a crown means "winning", so it only appears when exactly one team is —
    // four teams level on the same distance would otherwise wear four of them
    var soleLeader = ranked.filter(function (t) { return rankOf[t.id] === 0; }).length === 1;

    // gold / silver / bronze / also-ran, as [light, dark] pairs
    var MEDAL_TINT = [
      ['#ffd76a', '#c98f2b'],
      ['#e6eef5', '#98a5b2'],
      ['#e0975a', '#96591f'],
      ['#76858f', '#47525c'],
    ];

    // the island's size before the camera pulls back — what the boats anchor to
    var geom = {
      stageW: stageRect.width,
      cx: stageRect.width / 2,
      // the island's full size as actually drawn — quantised, so the boats are
      // anchored to the same grid the art is snapped to
      baseHalfW: ISLAND_SRC * baseK / 2,
    };
    var placed = [];

    /* Everything a team owns now travels with its boat. The four corner tables
     * are gone: they were a spreadsheet bolted to a seascape, they duplicated the
     * distance already printed on the water, and they fenced the boats into a
     * narrow band between them. Without them the whole stage is open water. */
    Camp.state.teams.forEach(function (team, i) {
      var quad = SHIP_QUADRANT[i];
      var ship = el('div', 'island-ship');
      placed.push({ el: ship, sx: quad[0], sy: quad[1], t: shipProgress(team.distance) });
      ship.style.animationDelay = (i * 0.6) + 's';

      // stern to the island, bow out into its own corner of the sea
      var bc = Camp.renderBoat(team, BOAT_SCALE, Camp.boatFacing(quad[0], quad[1]));
      bc.className = 'ship-canvas';
      ship.appendChild(bc);

      /* Rank, said out loud. It used to be a 10px medal coin — the smallest thing
       * on a board whose entire job is showing who is winning, and smaller than
       * the shell icon beside it. Now it is a numeral in the bitmap font, tinted
       * gold/silver/bronze, and the leader additionally gets a crown over the
       * boat and a gold-edged plate. Nothing is awarded before anyone sails. */
      var rank = rankOf[team.id];
      var plate = el('div', 'ship-plate');
      plate.style.background = team.color;
      if (anySailed) {
        var badge = el('span', 'rank-badge');
        badge.appendChild(Camp.renderText(String(rank + 1), {
          scale: 2, splitRow: 4,
          top: MEDAL_TINT[rank][0], bottom: MEDAL_TINT[rank][1], outline: '#0a1218',
        }));
        plate.appendChild(badge);
      }
      plate.appendChild(el('span', null, team.name));
      ship.appendChild(plate);

      if (anySailed && rank === 0 && soleLeader) {
        ship.classList.add('leader');
        var crown = Camp.renderUiIcon('crown', 2);
        crown.className = 'ship-crown';
        ship.insertBefore(crown, ship.firstChild);
      }

      // distance and shells side by side — the two numbers a team actually wants
      var stats = el('div', 'ship-stats');
      stats.appendChild(el('span', 'ship-dist', Camp.formatMeters(team.distance)));
      var shells = el('span', 'ship-shells');
      shells.appendChild(Camp.renderUiIcon('shell', 2));
      shells.appendChild(el('span', null, String(team.shells)));
      stats.appendChild(shells);
      ship.appendChild(stats);

      /* What tonight was actually worth. The board used to show one cumulative
       * number that only ever crept, so a team could sail hard and see nothing
       * change. A gain and a change of place are the two things people ask. */
      var gain = Camp.gainTonight(team);
      var moved = Camp.placesGained(team);
      if (gain > 0 || moved !== 0) {
        var line = el('div', 'ship-tonight');
        if (gain > 0) {
          line.appendChild(el('span', 'gain', '+' + Camp.formatMeters(gain)));
          line.appendChild(el('span', 'tonight-label', Camp.STR.tonight));
        }
        if (moved !== 0) {
          line.appendChild(el('span', 'moved ' + (moved > 0 ? 'up' : 'down'),
            (moved > 0 ? '▲' : '▼') + Math.abs(moved)));
        }
        ship.appendChild(line);
      }

      ship.onclick = function () { Camp.go('shop', i); };
      stage.appendChild(ship);
    });

    /* Position last, once each boat has been measured. Boats fan out along their
     * quadrant's diagonal, matching the way they are pointed — near the island
     * they sit just off the shore, and the further they sail the more they spread
     * toward their own corner. The vertical budget is what it is; where the two
     * boats on one side would meet, the lanes give way rather than overlap. */
    var titleRect = stage.querySelector('.island-title').getBoundingClientRect();
    var menuRect = document.getElementById('island-actions').getBoundingClientRect();
    var shipBox = placed[0].el.getBoundingClientRect();
    var halfW = shipBox.width / 2, halfH = shipBox.height / 2;

    var innerX = geom.baseHalfW + halfW + 16;                       // clear of the shore
    var outerX = Math.max(innerX, stageRect.width / 2 - halfW - 12);
    var topRoom = stageRect.height * 0.52 - titleRect.bottom - halfH - 10;
    var botRoom = menuRect.top - stageRect.height * 0.52 - halfH - 10;
    var outerY = Math.max(0, Math.min(topRoom, botRoom));
    var innerY = Math.min(halfH + 10, outerY);                      // never cross over

    var cy = stageRect.height * 0.52;
    var shoreR = geom.baseHalfW * islandScale(leader);   // island as currently drawn

    placed.forEach(function (p, i) {
      var x = geom.cx + p.sx * (innerX + (outerX - innerX) * p.t);
      var y = cy + p.sy * (innerY + (outerY - innerY) * p.t);
      // a phone in portrait has no room either side of the island, so let the
      // boats bunch up on screen rather than sail off the edge
      var fx = Math.min(Math.max(x, halfW + 6), stageRect.width - halfW - 6);
      var fy = Math.min(Math.max(y, halfH + 6), stageRect.height - halfH - 6);
      p.el.style.left = Math.round(fx) + 'px';
      p.el.style.top = Math.round(fy) + 'px';

      /* A wake trailing back toward the island. Four of them radiating from one
       * centre are what turn four boats at four coordinates into a composition —
       * each boat stops being a dot and becomes the far end of a journey.
       *
       * Rotated along the TRUE bearing home, computed from the final clamped
       * position. The obvious flat 45 degrees would be wrong: x and y come from
       * independent budgets, so the real fan is only a few degrees off level. */
      var dx = geom.cx - fx, dy = cy - fy;
      var gap = Math.sqrt(dx * dx + dy * dy) - shoreR;
      // A boat sits clear of the shore even at zero metres, so distance has to be
      // the gate, not geometry — a team that has not sailed leaves no wake.
      if (p.t < 0.005 || gap < 26) return;
      var wake = el('div', 'ship-wake');
      wake.style.left = Math.round(fx) + 'px';
      wake.style.top = Math.round(fy) + 'px';
      wake.style.width = Math.round(gap * 0.55) + 'px';
      wake.style.transform = 'rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + 'deg)';
      wake.style.animationDelay = (i * 0.4) + 's';
      stage.appendChild(wake);
    });
  };

  // ---------------------------------------------------------------- Screen 2
  var shopTeamIndex = 0;

  Camp.renderShop = function (teamIndex) {
    if (teamIndex !== undefined) shopTeamIndex = teamIndex;
    var team = Camp.team(shopTeamIndex);

    var badge = document.getElementById('shop-team-badge');
    badge.textContent = team.name;
    badge.style.background = team.color;
    document.getElementById('shop-shells').textContent = team.shells;
    var shellWrap = document.getElementById('shop-shells-wrap');
    var oldShell = shellWrap.querySelector('canvas');
    if (oldShell) oldShell.remove();   // renderShop runs again on every purchase
    shellWrap.insertBefore(Camp.renderUiIcon('shell', 2), shellWrap.firstChild);

    var host = document.getElementById('shop-categories');
    host.innerHTML = '';

    Camp.CATEGORY_ORDER.forEach(function (cat) {
      var meta = Camp.STR.categories[cat];
      var section = el('section', 'shop-cat');
      var head = el('div', 'shop-cat-head');
      head.appendChild(el('h2', 'shop-cat-title', meta.name));
      head.appendChild(el('span', 'shop-cat-hint', meta.hint));
      section.appendChild(head);

      var row = el('div', 'shop-items');
      Camp.CATALOG[cat].forEach(function (item, tier) {
        row.appendChild(itemCard(team, cat, item, tier));
      });
      section.appendChild(row);
      host.appendChild(section);
    });

    renderPreview(team);
  };

  function itemCard(team, cat, item, tier) {
    var owned = team.owned[cat].indexOf(item.id) >= 0;
    var equipped = team.equipped[cat] === item.id;

    var card = el('div', 'item-card tier-' + tier + (owned ? ' owned' : '') + (equipped ? ' equipped' : ''));

    var iconWrap = el('div', 'item-icon');
    iconWrap.appendChild(Camp.renderIcon(item.id, 3));
    card.appendChild(iconWrap);
    card.appendChild(el('div', 'item-name', Camp.itemName(item)));
    card.appendChild(el('div', 'item-desc', Camp.itemDesc(item)));

    var foot = el('div', 'item-foot');
    if (equipped) {
      foot.appendChild(el('span', 'item-equipped-tag', '✓ ' + Camp.STR.equipped));
    } else if (owned) {
      foot.appendChild(el('span', 'item-owned-tag', Camp.STR.owned));
    } else {
      var btn = el('button', 'buy-btn');
      btn.appendChild(Camp.renderUiIcon('shell', 2));
      btn.appendChild(el('span', null, String(item.price)));
      if (team.shells < item.price) btn.classList.add('poor');
      btn.onclick = function (e) {
        e.stopPropagation();
        if (Camp.buy(team, cat, item.id)) Camp.renderShop();
        else shakeElement(btn);
      };
      foot.appendChild(btn);
    }
    card.appendChild(foot);

    if (owned && !equipped) {
      card.onclick = function () {
        Camp.equip(team, cat, item.id);
        Camp.renderShop();
      };
    }
    return card;
  }

  function shakeElement(node) {
    node.classList.remove('shake');
    void node.offsetWidth; // restart the animation
    node.classList.add('shake');
  }

  function renderPreview(team) {
    var host = document.getElementById('shop-preview-boat');
    host.innerHTML = '';
    host.appendChild(Camp.renderBoat(team, 3));
    var parts = document.getElementById('shop-preview-parts');
    parts.innerHTML = '';
    Camp.CATEGORY_ORDER.forEach(function (cat) {
      var row = el('div', 'preview-part');
      row.appendChild(el('span', 'preview-part-cat', Camp.STR.categories[cat].name));
      row.appendChild(el('span', 'preview-part-name', Camp.itemName(Camp.equippedItem(team, cat))));
      parts.appendChild(row);
    });
  }

  Camp.shopTeam = function () { return shopTeamIndex; };

  // ---------------------------------------------------------- Podium screen
  var podiumTimers = [];

  function clearPodiumTimers() {
    podiumTimers.forEach(clearTimeout);
    podiumTimers = [];
    // the confetti removal timer may just have been cancelled — sweep directly
    document.querySelectorAll('#podium-stage .confetti').forEach(function (n) { n.remove(); });
  }
  Camp.stopPodium = clearPodiumTimers;

  /* Ranked reveal 4th -> 1st with counting distances and confetti for the winner. */
  Camp.renderPodium = function () {
    clearPodiumTimers();
    // same bitmap wordmark treatment as the island logo, so the two headings match
    var podTitle = document.getElementById('podium-title');
    podTitle.innerHTML = '';
    podTitle.appendChild(Camp.renderText(Camp.STR.podiumTitle, {
      scale: Math.max(3, Math.min(8, Math.floor(window.innerWidth * 0.34 /
        Camp.textGrid(Camp.STR.podiumTitle).w))),
      top: '#ffe9b0', bottom: '#d99a2b', outline: '#241503',
    }));

    var stage = document.getElementById('podium-stage');
    stage.innerHTML = '';

    var ranked = Camp.state.teams.slice().sort(function (a, b) { return b.distance - a.distance; });
    var COLUMN_ORDER = [1, 0, 2, 3];   // visual slots left->right show 2nd, 1st, 3rd, 4th
    var HEIGHTS = [250, 190, 145, 105];

    var slots = COLUMN_ORDER.map(function (rank) {
      var team = ranked[rank];
      var col = el('div', 'podium-col');
      var boatWrap = el('div', 'podium-boat');
      if (rank === 0) {
        var crown = Camp.renderUiIcon('crown', 3);
        crown.className = 'podium-crown';   // CSS fades it in with the .winner class
        boatWrap.appendChild(crown);
      }
      boatWrap.appendChild(Camp.renderBoat(team, 2));
      var name = el('div', 'podium-name', team.name);
      name.style.background = team.color;
      var dist = el('div', 'podium-dist', '0 m');
      var block = el('div', 'podium-block');
      block.style.height = HEIGHTS[rank] + 'px';
      block.appendChild(el('div', 'podium-rank', (rank + 1) + '.'));
      col.appendChild(boatWrap);
      col.appendChild(name);
      col.appendChild(dist);
      col.appendChild(block);
      stage.appendChild(col);
      return { col: col, team: team, rank: rank, distEl: dist };
    });

    // reveal worst-first, winner last
    var order = slots.slice().sort(function (a, b) { return b.rank - a.rank; });
    order.forEach(function (slot, i) {
      podiumTimers.push(setTimeout(function () {
        slot.col.classList.add('revealed');
        countUp(slot.distEl, slot.team.distance, 1100);
        if (slot.rank === 0) {
          slot.col.classList.add('winner');
          confettiBurst(stage);
        }
      }, 600 + i * 1500));
    });
  };

  function countUp(node, target, ms) {
    var t0 = null; // anchor to the first animation timestamp, not performance.now()
    function tick(t) {
      if (t0 === null) t0 = t;
      var f = Math.max(0, Math.min(1, (t - t0) / ms));
      var eased = 1 - Math.pow(1 - f, 3);
      node.textContent = Camp.formatMeters(target * eased);
      if (f < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function confettiBurst(stage) {
    var colors = Camp.state.teams.map(function (t) { return t.color; }).concat(['#e9b64f', '#ffffff', '#3ee6ef']);
    for (var i = 0; i < 80; i++) {
      var p = el('div', 'confetti');
      p.style.background = colors[i % colors.length];
      p.style.left = (10 + Math.random() * 80) + '%';
      p.style.animationDelay = (Math.random() * 1.2) + 's';
      p.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
      p.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      stage.appendChild(p);
    }
    podiumTimers.push(setTimeout(function () {
      stage.querySelectorAll('.confetti').forEach(function (n) { n.remove(); });
    }, 6000));
  }
})();
