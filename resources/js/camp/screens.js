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
  /* Ship bearings around the island (degrees; 0 = east, -90 = north). */
  var SHIP_BEARINGS = [-90, -8, 188, 90];
  var CARD_POS = [
    { left: '12px', top: '12px' },
    { right: '12px', top: '12px' },
    { left: '12px', bottom: '12px' },
    { right: '12px', bottom: '12px' },
  ];

  /* How far from the island a ship sits, given its team's total distance.
   * Auto-scales so the current leader is near the outer edge of the water. */
  function shipRadius(team, bearing, stageW, stageH, islandHalfW, islandHalfH) {
    var rad = bearing * Math.PI / 180;
    var dx = Math.cos(rad), dy = Math.sin(rad);

    // shortest radius: just off the island's elliptical shore
    var minR = (islandHalfW * islandHalfH) /
      Math.sqrt(Math.pow(islandHalfH * dx, 2) + Math.pow(islandHalfW * dy, 2)) + 46 +
      (Math.abs(dy) > 0.7 ? 40 : 0); // ships are tall — extra clearance above/below the island

    // longest radius: stay inside the viewport with a margin for the label
    var maxR = Infinity;
    if (Math.abs(dx) > 0.001) maxR = Math.min(maxR, (stageW / 2 - 170) / Math.abs(dx));
    // southern ships need extra room for the bottom menu bar
    var vMargin = dy > 0 ? 190 : 135;
    if (Math.abs(dy) > 0.001) maxR = Math.min(maxR, (stageH / 2 - vMargin) / Math.abs(dy));

    var leader = 0;
    Camp.state.teams.forEach(function (t) { leader = Math.max(leader, t.distance); });
    var scaleMax = Math.max(3000, leader * 1.15);
    var frac = Math.min(1, team.distance / scaleMax);
    // on cramped viewports maxR can fall below the shore radius — staying on
    // screen wins over keeping clear of the island art
    var r = maxR <= minR ? maxR : minR + (maxR - minR) * frac;
    return { r: r, dx: dx, dy: dy };
  }

  Camp.renderIsland = function () {
    var stage = document.getElementById('island-stage');
    stage.innerHTML = '';

    // expanding water ripples under the island
    var ripples = el('div', 'island-ripples');
    for (var ri = 0; ri < 3; ri++) {
      var rp = el('div', 'ripple');
      rp.style.animationDelay = (ri * 2.6) + 's';
      ripples.appendChild(rp);
    }
    stage.appendChild(ripples);

    // central island (generated key art)
    var isl = document.createElement('img');
    isl.className = 'island-canvas';
    isl.src = 'resources/camp/island.png';
    isl.alt = '';
    // ship placement depends on the island's rendered size — re-render once it loads
    if (!isl.complete) isl.onload = function () { if (document.getElementById('screen-island').classList.contains('active')) Camp.renderIsland(); };
    stage.appendChild(isl);

    // fireflies drifting over the forest
    for (var fi = 0; fi < 14; fi++) {
      var fly = el('div', 'firefly');
      fly.style.left = (34 + Math.random() * 32) + '%';
      fly.style.top = (28 + Math.random() * 44) + '%';
      fly.style.animationDelay = (Math.random() * 6) + 's';
      fly.style.animationDuration = (5 + Math.random() * 6) + 's';
      stage.appendChild(fly);
    }

    var title = el('div', 'island-title');
    var emblem = document.createElement('img');
    emblem.className = 'island-emblem';
    emblem.src = 'resources/camp/emblem.png';
    emblem.alt = '';
    title.appendChild(emblem);
    title.appendChild(el('div', 'island-title-main', Camp.STR.title));
    title.appendChild(el('div', 'island-title-sub', Camp.STR.subtitle));
    stage.appendChild(title);

    // current standings decide the medal shown on each card
    var ranked = Camp.state.teams.slice().sort(function (a, b) { return b.distance - a.distance; });
    var rankOf = {};
    ranked.forEach(function (t, r) { rankOf[t.id] = r; });
    var MEDALS = ['🥇', '🥈', '🥉', '4.'];

    var stageRect = stage.getBoundingClientRect();
    var islRect = isl.getBoundingClientRect();
    var cx = stageRect.width / 2, cy = stageRect.height * 0.52;
    var islandHalfW = (islRect.width > 10 ? islRect.width : Math.min(stageRect.width * 0.42, 560)) / 2;
    var islandHalfH = islRect.height > 10 ? islRect.height / 2 : islandHalfW * 0.8;

    Camp.state.teams.forEach(function (team, i) {
      // ship floating in the water, drifting further out the more metres the team has sailed
      var pos = shipRadius(team, SHIP_BEARINGS[i], stageRect.width, stageRect.height, islandHalfW, islandHalfH);
      var ship = el('div', 'island-ship');
      ship.style.left = Math.round(cx + pos.dx * pos.r) + 'px';
      ship.style.top = Math.round(cy + pos.dy * pos.r) + 'px';
      ship.style.animationDelay = (i * 0.6) + 's';
      var bc = Camp.renderBoat(team, 2);
      bc.className = 'ship-canvas';
      ship.appendChild(bc);
      var plate = el('div', 'ship-plate', team.name);
      plate.style.background = team.color;
      ship.appendChild(plate);
      ship.appendChild(el('div', 'ship-dist', Camp.formatMeters(team.distance)));
      ship.onclick = function () { Camp.go('shop', i); };
      stage.appendChild(ship);

      // team card in the corner
      var card = el('div', 'team-card');
      Object.keys(CARD_POS[i]).forEach(function (k) { card.style[k] = CARD_POS[i][k]; });
      var bar = el('div', 'team-card-bar');
      bar.style.background = 'linear-gradient(180deg, ' + Camp.lighten(team.color, 0.12) + ', ' + Camp.darken(team.color, 0.18) + ')';
      bar.appendChild(el('span', 'team-card-name', team.name));
      bar.appendChild(el('span', 'team-card-medal', MEDALS[rankOf[team.id]]));
      card.appendChild(bar);
      var body = el('div', 'team-card-body');
      body.appendChild(statRow('🐚 ' + Camp.STR.balance, team.shells));
      body.appendChild(statRow('⛵ ' + Camp.STR.boat, Camp.itemName(Camp.equippedItem(team, 'boat'))));
      body.appendChild(statRow('🌊 ' + Camp.STR.distance, Camp.formatMeters(team.distance)));
      card.appendChild(body);
      card.onclick = function () { Camp.go('shop', i); };
      stage.appendChild(card);
    });

    function statRow(label, value) {
      var row = el('div', 'stat-row');
      row.appendChild(el('span', 'stat-label', label));
      row.appendChild(el('span', 'stat-value', String(value)));
      return row;
    }
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
      var btn = el('button', 'buy-btn', '🐚 ' + item.price);
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
    document.getElementById('podium-title').textContent = Camp.STR.podiumTitle;

    var stage = document.getElementById('podium-stage');
    stage.innerHTML = '';

    var ranked = Camp.state.teams.slice().sort(function (a, b) { return b.distance - a.distance; });
    var COLUMN_ORDER = [1, 0, 2, 3];   // visual slots left->right show 2nd, 1st, 3rd, 4th
    var HEIGHTS = [250, 190, 145, 105];

    var slots = COLUMN_ORDER.map(function (rank) {
      var team = ranked[rank];
      var col = el('div', 'podium-col');
      var boatWrap = el('div', 'podium-boat');
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
