/* HelloCamp 2026 — sprite sheet loader and source rects (resources/surf/objects.png). */
window.Camp = window.Camp || {};

(function () {
  var sheet = new Image();
  sheet.src = 'resources/surf/objects.png';
  var water = new Image();
  water.src = 'resources/surf/bg.png';

  Camp.sheet = sheet;
  Camp.waterTile = water;

  Camp.onSpritesReady = function (cb) {
    var left = 2;
    function done() { if (--left === 0) cb(); }
    function hook(img) {
      // a failed load also has complete === true — it must still count as
      // ready, or a missing asset would leave the app on a blank screen
      if (img.complete) done();
      else { img.onload = done; img.onerror = done; }
    }
    hook(sheet); hook(water);
  };

  /* [sx, sy, sw, sh] source rects on objects.png.
   * hb: collision box as fractions of the drawn sprite [x, y, w, h]. */
  Camp.SPRITES = {
    // small/medium obstacles (64px cells at y=64)
    pilings:   { r: [0, 66, 62, 66],    hb: [0.12, 0.10, 0.76, 0.72] },
    pilings2:  { r: [64, 66, 62, 66],   hb: [0.12, 0.10, 0.76, 0.72] },
    stump:     { r: [128, 66, 62, 66],  hb: [0.15, 0.25, 0.70, 0.55] },
    log:       { r: [192, 66, 62, 66],  hb: [0.08, 0.30, 0.84, 0.42] },
    rowboat:   { r: [256, 64, 64, 76],  hb: [0.25, 0.10, 0.50, 0.80] },
    canoe:     { r: [320, 66, 62, 66],  hb: [0.12, 0.20, 0.76, 0.60] },
    rocks1:    { r: [384, 66, 62, 66],  hb: [0.12, 0.18, 0.76, 0.64] },
    rockBig:   { r: [448, 64, 64, 68],  hb: [0.15, 0.12, 0.70, 0.72] },
    rocks2:    { r: [512, 74, 62, 58],  hb: [0.12, 0.20, 0.76, 0.60] },
    iceberg:   { r: [576, 64, 64, 68],  hb: [0.15, 0.15, 0.70, 0.65] },
    tealRock:  { r: [640, 70, 62, 62],  hb: [0.12, 0.18, 0.76, 0.62] },
    islet1:    { r: [768, 66, 62, 66],  hb: [0.10, 0.25, 0.80, 0.55] },
    isletPalm: { r: [832, 60, 62, 72],  hb: [0.12, 0.30, 0.76, 0.50] },
    islet2:    { r: [896, 66, 62, 66],  hb: [0.10, 0.28, 0.80, 0.50] },
    // big sandy islands (row 1 and 2)
    islandA:   { r: [388, 142, 184, 110], hb: [0.08, 0.20, 0.84, 0.62] },
    islandB:   { r: [576, 148, 184, 104], hb: [0.08, 0.20, 0.84, 0.62] },
    islandC:   { r: [764, 142, 188, 110], hb: [0.08, 0.20, 0.84, 0.62] },
    islandD:   { r: [384, 260, 186, 120], hb: [0.08, 0.20, 0.84, 0.60] },
    islandE:   { r: [576, 264, 184, 116], hb: [0.08, 0.20, 0.84, 0.60] },
    // kraken tentacle clusters
    tentacles1:{ r: [1156, 268, 116, 118], hb: [0.15, 0.20, 0.70, 0.65] },
    tentacles2:{ r: [1284, 268, 116, 118], hb: [0.15, 0.20, 0.70, 0.65] },
    tentacles3:{ r: [1412, 268, 116, 118], hb: [0.15, 0.20, 0.70, 0.65] },
    // pickups
    bolt:      { r: [1026, 2, 60, 60] },
    boltSmall: { r: [1032, 200, 52, 52] },
    // movers
    jetski1a:  { r: [1152, 128, 64, 64], hb: [0.2, 0.2, 0.6, 0.6] },
    jetski1b:  { r: [1216, 128, 64, 64], hb: [0.2, 0.2, 0.6, 0.6] },
    jetski2a:  { r: [1152, 192, 64, 64], hb: [0.2, 0.2, 0.6, 0.6] },
    jetski2b:  { r: [1216, 192, 64, 64], hb: [0.2, 0.2, 0.6, 0.6] },
    dolphin1:  { r: [1344, 64, 56, 64] },
    dolphin2:  { r: [1344, 128, 56, 64] },
    dolphin3:  { r: [1344, 192, 56, 64] },
    // the kraken (6 rising frames)
    kraken0:   { r: [1154, 388, 122, 122] },
    kraken1:   { r: [1282, 388, 122, 122] },
    kraken2:   { r: [1410, 388, 122, 122] },
    kraken3:   { r: [1538, 388, 122, 122] },
    kraken4:   { r: [1666, 388, 122, 122] },
    kraken5:   { r: [1794, 388, 122, 122] },
    tentacle:  { r: [1100, 264, 34, 70] },
  };

  /* Names of sprites used as random obstacles, with relative spawn weight and draw scale. */
  Camp.OBSTACLE_POOL = [
    { s: 'rocks1',    w: 14, scale: 1.6 },
    { s: 'rockBig',   w: 12, scale: 1.6 },
    { s: 'rocks2',    w: 12, scale: 1.6 },
    { s: 'pilings',   w: 8,  scale: 1.6 },
    { s: 'pilings2',  w: 6,  scale: 1.6 },
    { s: 'stump',     w: 8,  scale: 1.6 },
    { s: 'log',       w: 10, scale: 1.6 },
    { s: 'rowboat',   w: 5,  scale: 1.6 },
    { s: 'canoe',     w: 5,  scale: 1.6 },
    { s: 'iceberg',   w: 4,  scale: 1.6 },
    { s: 'tealRock',  w: 6,  scale: 1.6 },
    { s: 'islet1',    w: 5,  scale: 1.7 },
    { s: 'isletPalm', w: 5,  scale: 1.7 },
    { s: 'islet2',    w: 5,  scale: 1.7 },
    { s: 'tentacles1',w: 4,  scale: 1.5 },
    { s: 'tentacles2',w: 4,  scale: 1.5 },
    { s: 'tentacles3',w: 4,  scale: 1.5 },
    { s: 'islandA',   w: 3,  scale: 1.4 },
    { s: 'islandB',   w: 3,  scale: 1.4 },
    { s: 'islandC',   w: 3,  scale: 1.4 },
    { s: 'islandD',   w: 2,  scale: 1.4 },
    { s: 'islandE',   w: 2,  scale: 1.4 },
  ];

  Camp.drawSprite = function (ctx, name, x, y, scale) {
    var sp = Camp.SPRITES[name];
    var r = sp.r;
    ctx.drawImage(Camp.sheet, r[0], r[1], r[2], r[3],
      Math.round(x), Math.round(y), Math.round(r[2] * scale), Math.round(r[3] * scale));
  };
})();
