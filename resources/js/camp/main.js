/* HelloCamp 2026 — router between the three screens + camp crew (admin) settings. */
window.Camp = window.Camp || {};

(function () {
  var current = null;

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
        '<label>🐚 <input type="number" class="admin-shells" min="0" max="9999" value="' + team.shells + '"></label>' +
        '<label>🌊 <input type="number" class="admin-dist" min="0" max="999999" value="' + Math.round(team.distance) + '"></label>';
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
      'podium-open': S.endNight,
      'podium-back': S.podiumBack,
      'intro-skip': S.skip,
      'lang-toggle': Camp.state.lang === 'cs' ? 'EN' : 'CZ',
    };
    for (var id in map) {
      var node = document.getElementById(id);
      if (node) node.textContent = map[id];
    }
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
    document.getElementById('admin-open').onclick = openAdmin;
    document.getElementById('admin-save').onclick = saveAdmin;
    document.getElementById('admin-cancel').onclick = closeAdmin;
    document.getElementById('admin-reset').onclick = resetAll;
    document.getElementById('shop-back').onclick = function () { Camp.go('island'); };
    document.getElementById('shop-play').onclick = function () { Camp.go('game'); };
    document.getElementById('podium-open').onclick = function () { Camp.go('podium'); };
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
