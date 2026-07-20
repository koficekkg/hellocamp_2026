/* HelloCamp 2026 — persistent team state (localStorage). */
window.Camp = window.Camp || {};

(function () {
  var KEY = 'hellocamp2026-state-v1';
  var MAX_NIGHTS = 30;   // a camp week is 7; the cap just stops unbounded growth

  function starterOwned() {
    var owned = {};
    Camp.CATEGORY_ORDER.forEach(function (cat) {
      owned[cat] = Camp.CATALOG[cat].filter(function (it) { return it.starter; })
                                    .map(function (it) { return it.id; });
    });
    return owned;
  }

  function freshTeam(i) {
    var d = Camp.DEFAULT_TEAMS[i];
    return {
      id: i,
      name: d.name,
      color: d.color,
      shells: 40,
      distance: 0, // cumulative meters over the whole week
      owned: starterOwned(),
      equipped: { motor: 'pan', sail: 'tshirt', boat: 'raft', hull: 'bare', charm: 'nocharm' },
    };
  }

  function freshState() {
    var teams = [];
    for (var i = 0; i < 4; i++) teams.push(freshTeam(i));
    // `nights` holds each team's cumulative distance as it stood when a night was
    // closed. Without it the board only ever knew one number per team and could
    // not answer "what happened tonight" — the question a week-long camp asks.
    return { teams: teams, lang: 'en', nights: [] };
  }

  /* Make sure a loaded state has every field a fresh one would (safe upgrades). */
  function normalize(state) {
    if (!state || !Array.isArray(state.teams) || state.teams.length !== 4) return freshState();
    if (!Camp.LANGS[state.lang]) state.lang = 'en';

    /* A save written before nights existed simply has none — it keeps every
     * distance it had and starts logging from tonight. Entries are sanitised
     * rather than trusted: a hand-edited or truncated log must not be able to
     * make the board render NaN. */
    if (!Array.isArray(state.nights)) state.nights = [];
    state.nights = state.nights.filter(function (n) {
      return n && Array.isArray(n.distances) && n.distances.length === 4;
    }).map(function (n) {
      return { distances: n.distances.map(function (d) { return Math.max(0, Number(d) || 0); }) };
    }).slice(-MAX_NIGHTS);
    for (var i = 0; i < 4; i++) {
      var fresh = freshTeam(i), t = state.teams[i];
      for (var k in fresh) if (t[k] === undefined) t[k] = fresh[k];
      // heal wrong types too, not just missing keys (hand-edited storage etc.)
      if (typeof t.name !== 'string' || !t.name.trim()) t.name = fresh.name;
      if (typeof t.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(t.color)) t.color = fresh.color;
      t.shells = Math.max(0, Number(t.shells) || 0);
      t.distance = Math.max(0, Number(t.distance) || 0);
      // arrays would survive in-session but JSON.stringify drops named props on
      // them, silently losing purchases on save — only plain objects are valid
      if (typeof t.owned !== 'object' || !t.owned || Array.isArray(t.owned)) t.owned = fresh.owned;
      if (typeof t.equipped !== 'object' || !t.equipped || Array.isArray(t.equipped)) t.equipped = fresh.equipped;
      Camp.CATEGORY_ORDER.forEach(function (cat) {
        if (!Array.isArray(t.owned[cat]) || !t.owned[cat].length) t.owned[cat] = fresh.owned[cat];
        if (!t.equipped[cat] || t.owned[cat].indexOf(t.equipped[cat]) < 0) t.equipped[cat] = t.owned[cat][0];
      });
      t.id = i;
    }
    return state;
  }

  var state;
  try {
    state = normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch (e) {
    state = freshState();
  }

  Camp.state = state;

  Camp.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(Camp.state)); } catch (e) { /* private mode etc. */ }
  };

  Camp.resetAll = function () {
    var lang = state && Camp.LANGS[state.lang] ? state.lang : 'en';
    Camp.state = state = freshState();
    state.lang = lang; // a wipe shouldn't flip the crew's language choice
    Camp.save();
  };

  Camp.team = function (i) { return Camp.state.teams[i]; };

  // ---- nights --------------------------------------------------------------
  /* Distances as they stood when the last night was closed, or null on the first
     night of the week — when everything sailed so far counts as "tonight". */
  Camp.lastNight = function () {
    var n = Camp.state.nights;
    return n.length ? n[n.length - 1] : null;
  };

  Camp.nightCount = function () { return Camp.state.nights.length; };

  /* How far a team has sailed since the last night was closed. */
  Camp.gainTonight = function (team) {
    var last = Camp.lastNight();
    var was = last ? last.distances[team.id] : 0;
    return Math.max(0, team.distance - was);
  };

  /* Placings for a set of distances, ties sharing a place — the same rule the
     island uses, so "moved up" means the same thing in both. */
  function placings(distances) {
    var order = distances.map(function (d, i) { return { i: i, d: d }; })
                         .sort(function (a, b) { return b.d - a.d; });
    var rank = [];
    order.forEach(function (e, k) {
      rank[e.i] = (k > 0 && e.d === order[k - 1].d) ? rank[order[k - 1].i] : k;
    });
    return rank;
  }
  Camp.placings = placings;

  /* Places gained since the last night closed. Positive means moved up the
     board. Returns 0 for every team on the first night, when there is no
     previous standing to have moved relative to. */
  Camp.placesGained = function (team) {
    var last = Camp.lastNight();
    if (!last) return 0;
    var then = placings(last.distances);
    var now = placings(Camp.state.teams.map(function (t) { return t.distance; }));
    return then[team.id] - now[team.id];
  };

  /* Close the night: record where everyone stands. Refuses when nothing has
     moved since the last close, so a second press cannot append an empty night
     and reset every "tonight" figure on the board to zero. */
  Camp.closeNight = function () {
    var now = Camp.state.teams.map(function (t) { return t.distance; });
    var last = Camp.lastNight();
    if (last && last.distances.every(function (d, i) { return d === now[i]; })) return false;
    Camp.state.nights.push({ distances: now });
    if (Camp.state.nights.length > MAX_NIGHTS) Camp.state.nights.shift();
    Camp.save();
    return true;
  };

  Camp.equippedItem = function (team, cat) {
    return Camp.itemById(cat, team.equipped[cat]);
  };

  /* Buy an item for a team. Returns true when the purchase went through. */
  Camp.buy = function (team, cat, itemId) {
    var item = Camp.itemById(cat, itemId);
    if (!item || item.id !== itemId) return false; // reject ids not in the catalog
    if (team.owned[cat].indexOf(itemId) >= 0) return false;
    if (team.shells < item.price) return false;
    team.shells -= item.price;
    team.owned[cat].push(itemId);
    team.equipped[cat] = itemId; // convenience: newly bought gear is equipped right away
    Camp.save();
    return true;
  };

  Camp.equip = function (team, cat, itemId) {
    if (team.owned[cat].indexOf(itemId) < 0) return false;
    team.equipped[cat] = itemId;
    Camp.save();
    return true;
  };

  /* Stats of the currently equipped build, used by the game. */
  Camp.buildStats = function (team) {
    var charm = Camp.equippedItem(team, 'charm');
    return {
      fuelSec: Camp.equippedItem(team, 'motor').fuelSec,
      windMult: Camp.equippedItem(team, 'sail').windMult,
      windSec: Camp.equippedItem(team, 'sail').windSec * (charm.windBonus || 1),
      speed: Camp.equippedItem(team, 'boat').speed,
      armor: Camp.equippedItem(team, 'hull').armor || 0,
      windFreq: charm.windFreq || 1,
    };
  };

  Camp.formatMeters = function (m) {
    m = Math.round(m);
    return String(m).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m';
  };
})();
