/* HelloCamp 2026 — persistent team state (localStorage). */
window.Camp = window.Camp || {};

(function () {
  var KEY = 'hellocamp2026-state-v1';

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
    return { teams: teams, lang: 'en' };
  }

  /* Make sure a loaded state has every field a fresh one would (safe upgrades). */
  function normalize(state) {
    if (!state || !Array.isArray(state.teams) || state.teams.length !== 4) return freshState();
    if (!Camp.LANGS[state.lang]) state.lang = 'en';
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
