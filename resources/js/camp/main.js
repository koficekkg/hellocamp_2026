/* HelloCamp 2026 — router between the three screens + camp crew (admin) settings. */
window.Camp = window.Camp || {};

(function () {
  var current = null;

  // screens.js keeps its own copy inside its closure; this file needs one too
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* Switch screens: 'island' | 'shop' | 'game' | 'podium'. teamIndex applies to shop/game. */
  Camp.go = function (screen, teamIndex) {
    if (current === 'game' && screen !== 'game') Camp.Game.stop();
    if (current === 'podium' && screen !== 'podium') Camp.stopPodium();
    current = screen;

    ['island', 'shop', 'game', 'podium'].forEach(function (s) {
      document.getElementById('screen-' + s).classList.toggle('active', s === screen);
    });

    if (screen === 'island') Camp.renderIsland();
    if (screen === 'shop') Camp.renderShop(teamIndex);
    if (screen === 'game') Camp.Game.start(teamIndex !== undefined ? teamIndex : Camp.shopTeam());
    if (screen === 'podium') Camp.renderPodium();
  };
  Camp.currentScreen = function () { return current; };

  /* ---- award shells ---------------------------------------------------------
   *
   * The reason the camp exists: leaders hand out shells for real-life games all
   * day, and teams spend them in the shipyard. Until now nothing in the codebase
   * ever awarded any — the only way in was typing an absolute total into the
   * crew settings form, which meant doing mental arithmetic to give a team ten
   * shells. This does the arithmetic.
   *
   * Awarding applies and saves immediately, so a leader can hand out shells at
   * the poolside and close the laptop without pressing anything else. */
  var AWARD_STEPS = [1, 5, 10, 25];

  function openAward() {
    var host = document.getElementById('award-rows');
    host.innerHTML = '';

    Camp.state.teams.forEach(function (team, i) {
      var row = el('div', 'award-row');

      var plate = el('span', 'award-team', team.name);
      plate.style.background = team.color;
      row.appendChild(plate);

      var count = el('span', 'award-count');
      count.appendChild(Camp.renderUiIcon('shell', 2));
      var num = el('span', 'award-num', String(team.shells));
      count.appendChild(num);
      row.appendChild(count);

      var btns = el('span', 'award-btns');
      AWARD_STEPS.forEach(function (n) {
        var b = el('button', 'award-btn', '+' + n);
        b.onclick = function () { bump(team, n, num); };
        btns.appendChild(b);
      });
      // a leader will mis-tap; taking it back should not need the settings form
      var undo = el('button', 'award-btn take', '−5');
      undo.onclick = function () { bump(team, -5, num); };
      btns.appendChild(undo);
      row.appendChild(btns);

      host.appendChild(row);
    });

    document.getElementById('award-modal').classList.add('visible');
  }

  function bump(team, n, num) {
    team.shells = Math.max(0, team.shells + n);
    num.textContent = String(team.shells);
    Camp.save();
  }

  function closeAward() {
    document.getElementById('award-modal').classList.remove('visible');
    Camp.go('island');   // the board shows shell counts, so refresh it
  }

  // ---- crew settings modal -------------------------------------------------
  function openAdmin() {
    var modal = document.getElementById('admin-modal');
    var host = document.getElementById('admin-rows');
    host.innerHTML = '';

    Camp.state.teams.forEach(function (team, i) {
      var row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML =
        '<input type="color" class="admin-color" value="' + team.color + '">' +
        '<input type="text" class="admin-name" maxlength="24" value="' + team.name.replace(/"/g, '&quot;') + '">' +
        '<label class="lab-shells"><input type="number" class="admin-shells" min="0" max="9999" value="' + team.shells + '"></label>' +
        '<label class="lab-dist"><input type="number" class="admin-dist" min="0" max="999999" value="' + Math.round(team.distance) + '"></label>';
      // pixel glyphs in place of the 🐚 / 🌊 these labels used to carry
      row.querySelector('.lab-shells').insertBefore(Camp.renderUiIcon('shell', 2), row.querySelector('.admin-shells'));
      row.querySelector('.lab-dist').insertBefore(Camp.renderUiIcon('wave', 2), row.querySelector('.admin-dist'));
      host.appendChild(row);
    });

    modal.classList.add('visible');
  }

  function saveAdmin() {
    var rows = document.querySelectorAll('#admin-rows .admin-row');
    rows.forEach(function (row, i) {
      var team = Camp.team(i);
      team.color = row.querySelector('.admin-color').value;
      var name = row.querySelector('.admin-name').value.trim();
      if (name) team.name = name;
      team.shells = Math.max(0, parseInt(row.querySelector('.admin-shells').value, 10) || 0);
      team.distance = Math.max(0, parseInt(row.querySelector('.admin-dist').value, 10) || 0);
    });
    Camp.save();
    closeAdmin();
    Camp.go('island');
  }

  function closeAdmin() {
    document.getElementById('admin-modal').classList.remove('visible');
  }

  function resetAll() {
    if (window.confirm(Camp.STR.resetConfirm)) {
      Camp.resetAll();
      closeAdmin();
      Camp.go('island');
    }
  }

  /* Push every static label through Camp.STR so translating data.js translates the whole UI. */
  function applyStrings() {
    var S = Camp.STR;
    var map = {
      'shop-back': S.backToIsland,
      'shop-title': S.shop,
      'shop-play': '▶ ' + S.play,
      'hud-fuel-label': S.fuel,
      'hud-wind-label': S.wind,
      'hud-ready': S.pressToStart,
      'over-run-label': S.runDistance,
      'over-best-label': S.bestRun,
      'over-repeat': '↺ ' + S.repeat,
      'over-continue': S.cont + ' ➜',
      'admin-title': S.adminTitle,
      'admin-cols': S.adminCols,
      'admin-save': S.save,
      'admin-cancel': S.cancel,
      'admin-reset': S.resetAll,
      'podium-open': S.endNight,   // glyph re-added below — this wipes child nodes
      'award-title': S.awardTitle,
      'award-hint': S.awardHint,
      'award-done': S.done,
      'podium-back': S.podiumBack,
      'intro-skip': S.skip,
      'lang-toggle': Camp.state.lang === 'cs' ? 'EN' : 'CZ',
    };
    for (var id in map) {
      var node = document.getElementById(id);
      if (node) node.textContent = map[id];
    }

    /* Pixel glyphs in place of the emoji these buttons used to carry — the OS
     * renders emoji as smooth vector art, which is the one thing on screen that
     * can never match the sprites. Applied after the textContent pass above,
     * which would otherwise wipe them, and re-applied on every language switch. */
    glyph('award-open', 'shell');
    glyph('admin-open', 'settings');
    glyph('intro-open', 'play');
    glyph('podium-open', 'flag');
  }

  function glyph(id, name) {
    var node = document.getElementById(id);
    if (!node || !Camp.renderUiIcon) return;
    // buttons whose label is not in the map above keep their children across a
    // language switch, so clear the old glyph or they stack up one per switch
    var old = node.querySelector('.btn-glyph');
    if (old) old.remove();
    var icon = Camp.renderUiIcon(name, 2);
    icon.className = 'btn-glyph';
    node.insertBefore(icon, node.firstChild);
  }
  Camp.applyStrings = applyStrings;

  Camp.setLang = function (lang) {
    Camp.state.lang = Camp.LANGS[lang] ? lang : 'en';
    Camp.save();
    Camp.applyLang();
    applyStrings();
    Camp.go(current || 'island'); // re-render the active screen in the new language
  };

  // ---- intro cinematic -------------------------------------------------------
  function openIntro() {
    var overlay = document.getElementById('intro-overlay');
    var video = document.getElementById('intro-video');
    overlay.classList.add('visible');
    video.currentTime = 0;
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked: controls still work */ });
    video.onended = closeIntro;
  }
  function closeIntro() {
    var video = document.getElementById('intro-video');
    video.pause();
    document.getElementById('intro-overlay').classList.remove('visible');
  }

  // ---- boot ----------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    Camp.applyLang();
    applyStrings();
    document.getElementById('award-open').onclick = openAward;
    document.getElementById('award-done').onclick = closeAward;
    document.getElementById('admin-open').onclick = openAdmin;
    document.getElementById('admin-save').onclick = saveAdmin;
    document.getElementById('admin-cancel').onclick = closeAdmin;
    document.getElementById('admin-reset').onclick = resetAll;
    document.getElementById('shop-back').onclick = function () { Camp.go('island'); };
    document.getElementById('shop-play').onclick = function () { Camp.go('game'); };
    /* Ending the night is what closes it: the standings are recorded so that
     * tomorrow the board can say what tonight was worth. closeNight refuses if
     * nothing has sailed since the last one, so opening the podium twice to
     * show people the reveal again cannot wipe every "tonight" figure. */
    document.getElementById('podium-open').onclick = function () {
      Camp.closeNight();
      Camp.go('podium');
    };
    document.getElementById('podium-back').onclick = function () { Camp.go('island'); };
    document.getElementById('lang-toggle').onclick = function () {
      Camp.setLang(Camp.state.lang === 'cs' ? 'en' : 'cs');
    };
    document.getElementById('intro-open').onclick = openIntro;
    document.getElementById('intro-skip').onclick = closeIntro;

    // keep the island layout fresh when the window changes size
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (document.getElementById('screen-island').classList.contains('active')) Camp.renderIsland();
      }, 150);
    });

    Camp.onSpritesReady(function () { Camp.go('island'); });
  });
})();
