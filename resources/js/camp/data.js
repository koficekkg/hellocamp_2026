/* HelloCamp 2026 — item catalog and tuning constants. Plain script, no modules. */
window.Camp = window.Camp || {};

/* All player-facing strings live here, per language. Camp.STR always points at
 * the active table (see Camp.applyLang); missing keys fall back to English. */
Camp.LANGS = {
  en: {
    title: 'HELLOCAMP 2026',
    subtitle: 'Escape from the Island',
    balance: 'Shells',
    distance: 'Distance',
    boat: 'Boat',
    shop: 'Shipyard',
    play: 'PLAY',
    backToIsland: '← Island',
    equipped: 'EQUIPPED',
    owned: 'Click to equip',
    fuel: 'FUEL',
    wind: 'WIND',
    crashed: 'CRASHED!',
    outOfFuel: 'OUT OF FUEL',
    kraken: 'THE KRAKEN GOT YOU!',
    countdownGo: 'GO!',
    runDistance: 'This run',
    bestRun: 'Best tonight',
    repeat: 'REPEAT',
    cont: 'CONTINUE',
    pressToStart: 'Press ◀ or ▶ to set sail',
    adminTitle: 'Camp crew settings',
    adminCols: 'Color · Team name · 🐚 Shells · 🌊 Distance (m)',
    save: 'Save',
    cancel: 'Cancel',
    resetAll: 'Reset everything',
    resetConfirm: 'Wipe ALL teams, purchases and distances?',
    endNight: '🏁 End the night',
    podiumTitle: 'Standings',
    podiumBack: '← Back to the island',
    intro: '🎬 Intro',
    skip: 'Skip ▶▶',
    categories: {
      motor: { name: 'Motors', hint: 'Better motors run longer before the fuel is gone' },
      sail:  { name: 'Sails',  hint: 'Better sails squeeze more speed out of a wind charge' },
      boat:  { name: 'Boats',  hint: 'Better boats are simply faster' },
      hull:  { name: 'Hull',   hint: 'A tougher hull shrugs off crashes' },
      charm: { name: 'Charms', hint: 'Charms call the wind to your sails' },
    },
    items: {}, // English names/descriptions live on the catalog itself
  },
  cs: {
    title: 'HELLOCAMP 2026',
    subtitle: 'Útěk z ostrova',
    balance: 'Mušle',
    distance: 'Vzdálenost',
    boat: 'Loď',
    shop: 'Loděnice',
    play: 'HRÁT',
    backToIsland: '← Ostrov',
    equipped: 'NASAZENO',
    owned: 'Klikni pro nasazení',
    fuel: 'PALIVO',
    wind: 'VÍTR',
    crashed: 'ZTROSKOTALI JSTE!',
    outOfFuel: 'DOŠLO PALIVO',
    kraken: 'DOSTALA VÁS KRAKATICE!',
    countdownGo: 'VPŘED!',
    runDistance: 'Tato plavba',
    bestRun: 'Nejlepší dnes',
    repeat: 'ZNOVU',
    cont: 'POKRAČOVAT',
    pressToStart: 'Vypluj stiskem ◀ nebo ▶',
    adminTitle: 'Nastavení pro vedoucí',
    adminCols: 'Barva · Název týmu · 🐚 Mušle · 🌊 Vzdálenost (m)',
    save: 'Uložit',
    cancel: 'Zrušit',
    resetAll: 'Smazat vše',
    resetConfirm: 'Opravdu smazat VŠECHNY týmy, nákupy i vzdálenosti?',
    endNight: '🏁 Vyhlásit večer',
    podiumTitle: 'Pořadí',
    podiumBack: '← Zpět na ostrov',
    intro: '🎬 Intro',
    skip: 'Přeskočit ▶▶',
    categories: {
      motor: { name: 'Motory', hint: 'Lepší motor vydrží déle, než dojde palivo' },
      sail:  { name: 'Plachty', hint: 'Lepší plachta vymáčkne z větrné energie víc rychlosti' },
      boat:  { name: 'Lodě',  hint: 'Lepší loď je prostě rychlejší' },
      hull:  { name: 'Trup',  hint: 'Pevnější trup ustojí náraz' },
      charm: { name: 'Talismany', hint: 'Talisman přivolává vítr do plachet' },
    },
    items: {
      pan:        { name: 'Pánev',                  desc: 'Pádlování nádobím. Palivo na 35 s.' },
      oar:        { name: 'Dřevěné veslo',          desc: 'Konečně pořádné veslo. Palivo na 60 s.' },
      emotor:     { name: 'Elektromotor',           desc: 'Vrní jako lednička. Palivo na 95 s.' },
      petrol:     { name: 'Benzínový motor',        desc: 'Řve a smrdí, ale jede. Palivo na 140 s.' },
      turbine:    { name: 'Lodní turbína',          desc: 'Skoro letadlo. Palivo na 200 s.' },
      tshirt:     { name: 'Děravé tričko',          desc: 'Víc děr než trička. Vítr ×1,35 na 4 s.' },
      bedsheet:   { name: 'Plachta z prostěradla',  desc: 'Vypůjčeno z ložnice. Vítr ×1,7 na 5,5 s.' },
      frigate:    { name: 'Fregatní oplachtění',    desc: 'Plné plachtoví! Vítr ×2,1 na 7 s.' },
      spinnaker:  { name: 'Závodní spinakr',        desc: 'Nafoukne se v barvách týmu. Vítr ×2,5 na 8,5 s.' },
      dragon:     { name: 'Dračí plachta',          desc: 'Prý pochází z ostrova. Vítr ×3 na 10 s.' },
      raft:       { name: 'Vor z klád',             desc: 'Tři klády a kus lana. Rychlost 14 m/s.' },
      inflatable: { name: 'Nafukovací člun',        desc: 'Houpe se, ale sviští. Rychlost 18 m/s.' },
      speedboat:  { name: 'Motorový člun',          desc: 'Tohle už je jízda. Rychlost 23 m/s.' },
      catamaran:  { name: 'Závodní katamarán',      desc: 'Dva trupy, žádné brzdy. Rychlost 29 m/s.' },
      galleon:    { name: 'Pirátská galeona',       desc: 'Postrach všech moří. Rychlost 34 m/s.' },
      bare:       { name: 'Holý trup',              desc: 'Jeden šutr a je po plavbě.' },
      woodplate:  { name: 'Dřevěné pláty',          desc: 'Ustojí jeden náraz za plavbu.' },
      steelplate: { name: 'Ocelové pláty',          desc: 'Ustojí dva nárazy za plavbu.' },
      nocharm:    { name: 'Bez talismanu',          desc: 'Moře ti nic nedluží.' },
      dolphin:    { name: 'Vyřezávaný delfín',      desc: 'Větrné bonusy se objevují častěji.' },
      goldshell:  { name: 'Zlatá mušle',            desc: 'Mnohem víc větru a vydrží déle.' },
    },
  },
};

/* Active string table; swapped by Camp.applyLang() (missing keys fall back to English). */
Camp.STR = Camp.LANGS.en;

Camp.applyLang = function () {
  var lang = (Camp.state && Camp.state.lang) || 'en';
  var base = Camp.LANGS.en, over = Camp.LANGS[lang] || base;
  var s = {};
  for (var k in base) s[k] = over[k] !== undefined ? over[k] : base[k];
  Camp.STR = s;
};

/* Item display text respecting the active language. */
Camp.itemName = function (item) {
  var t = Camp.STR.items && Camp.STR.items[item.id];
  return (t && t.name) || item.name;
};
Camp.itemDesc = function (item) {
  var t = Camp.STR.items && Camp.STR.items[item.id];
  return (t && t.desc) || item.desc;
};

/*
 * The three upgrade categories. Items are ordered cheapest/worst -> best.
 * Tier 0 of each category is starter gear every team owns from the beginning,
 * so a fresh team can always play.
 *
 *  - fuelSec:  how many seconds of fuel the motor gives
 *  - windMult: peak speed multiplier right after grabbing a wind charge
 *  - windSec:  how long a wind charge lasts before it fully decays
 *  - speed:    base cruising speed in world px/s (10 px = 1 m)
 */
Camp.CATALOG = {
  motor: [
    { id: 'pan',       name: 'Frying Pan',     price: 0,  starter: true, fuelSec: 35,
      desc: 'Paddling with cookware. 35 s of fuel.' },
    { id: 'oar',       name: 'Wooden Oar',     price: 25, fuelSec: 60,
      desc: 'A real oar at last. 60 s of fuel.' },
    { id: 'emotor',    name: 'Electric Motor', price: 60, fuelSec: 95,
      desc: 'Hums like a fridge. 95 s of fuel.' },
    { id: 'petrol',    name: 'Petrol Motor',   price: 120, fuelSec: 140,
      desc: 'Loud, smelly, glorious. 140 s of fuel.' },
    { id: 'turbine',   name: 'Marine Turbine', price: 200, fuelSec: 200,
      desc: 'Basically an airplane. 200 s of fuel.' },
  ],
  sail: [
    { id: 'tshirt',    name: 'Holey T-Shirt',  price: 0,  starter: true, windMult: 1.35, windSec: 4,
      desc: 'More hole than shirt. Wind boost ×1.35 for 4 s.' },
    { id: 'bedsheet',  name: 'Bedsheet Sail',  price: 25, windMult: 1.7, windSec: 5.5,
      desc: 'Borrowed from the bunkhouse. Wind boost ×1.7 for 5.5 s.' },
    { id: 'frigate',   name: 'Frigate Multi-Sail', price: 60, windMult: 2.1, windSec: 7,
      desc: 'Full rigging! Wind boost ×2.1 for 7 s.' },
    { id: 'spinnaker', name: 'Racing Spinnaker', price: 120, windMult: 2.5, windSec: 8.5,
      desc: 'Balloons out in team colors. Wind ×2.5 for 8.5 s.' },
    { id: 'dragon',    name: 'Dragon Sail',    price: 200, windMult: 3.0, windSec: 10,
      desc: 'They whisper it came from the island. Wind ×3 for 10 s.' },
  ],
  boat: [
    { id: 'raft',      name: 'Log Raft',       price: 0,  starter: true, speed: 140,
      desc: 'Three logs and some rope. Base speed 14 m/s.' },
    { id: 'inflatable',name: 'Inflatable Raft',price: 30, speed: 180,
      desc: 'Bouncy but quick. Base speed 18 m/s.' },
    { id: 'speedboat', name: 'Speedboat',      price: 75, speed: 230,
      desc: 'Now we are talking. Base speed 23 m/s.' },
    { id: 'catamaran', name: 'Racing Catamaran', price: 150, speed: 290,
      desc: 'Two hulls, zero brakes. Base speed 29 m/s.' },
    { id: 'galleon',   name: 'Pirate Galleon', price: 260, speed: 340,
      desc: 'Terror of every sea. Base speed 34 m/s.' },
  ],
  hull: [
    { id: 'bare',      name: 'Bare Hull',      price: 0,  starter: true, armor: 0,
      desc: 'One rock and it is over.' },
    { id: 'woodplate', name: 'Wooden Plating', price: 80, armor: 1,
      desc: 'Shrugs off one crash per run.' },
    { id: 'steelplate',name: 'Steel Plating',  price: 170, armor: 2,
      desc: 'Shrugs off two crashes per run.' },
  ],
  charm: [
    { id: 'nocharm',   name: 'No Charm',       price: 0,  starter: true, windFreq: 1, windBonus: 1,
      desc: 'The sea owes you nothing.' },
    { id: 'dolphin',   name: 'Carved Dolphin', price: 70, windFreq: 0.7, windBonus: 1,
      desc: 'Wind charges appear more often.' },
    { id: 'goldshell', name: 'Golden Shell',   price: 150, windFreq: 0.55, windBonus: 1.15,
      desc: 'Much more wind, and it lasts longer too.' },
  ],
};

Camp.CATEGORY_ORDER = ['motor', 'sail', 'boat', 'hull', 'charm'];

Camp.itemById = function (cat, id) {
  var list = Camp.CATALOG[cat] || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0];
};

/* Default team setup — names and colors are editable in the crew settings. */
Camp.DEFAULT_TEAMS = [
  { name: 'Red Sharks',     color: '#e8433f' },
  { name: 'Blue Dolphins',  color: '#2f6fe4' },
  { name: 'Green Turtles',  color: '#2fa84f' },
  { name: 'Yellow Seagulls',color: '#eda912' },
];

/* Game tuning */
Camp.TUNING = {
  pxPerMeter: 10,
  windSpawnMin: 3.0,   // seconds between wind charge spawns (min)
  windSpawnMax: 6.0,   // seconds between wind charge spawns (max)
  steerSpeedFrac: 0.85, // lateral speed as a fraction of current forward speed
  obstacleGapPx: 165,  // average world-px between obstacle waves early on
  minObstacleGapPx: 108, // densest it ever gets
  rampMeters: 1500,    // density reaches max after this many meters
};
