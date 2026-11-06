import * as THREE from 'three';

/* =========================================================================
   Krampus Cookies — a whimsical cookie-consent banner.
   You are Santa. Eat the kids' cookies (accept) or be revealed as Krampus.
   ========================================================================= */

const $ = (s) => document.querySelector(s);
const stage = $('.stage');
const canvas = $('#scene');
const bubblesEl = $('#bubbles');
const consentEl = $('#consent');
const params = new URLSearchParams(location.search);

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = {
  linear: (k) => k,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out: (k) => 1 - (1 - k) ** 3,
  in: (k) => k * k * k,
  back: (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
};
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* ------------------------------------------------------------------ renderer */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2a3a);
const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 60);
const CAM_POS = new THREE.Vector3(0, 1.95, 4.3);
const CAM_LOOK = new THREE.Vector3(0, 1.0, -0.6);
camera.position.copy(CAM_POS);
camera.lookAt(CAM_LOOK);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the horizontal framing roughly constant so narrow phones still see everyone
  const baseV = THREE.MathUtils.degToRad(40);
  const hHalf = Math.atan(Math.tan(baseV / 2) * 1.55);
  const v = camera.aspect < 1.55 ? 2 * Math.atan(Math.tan(hHalf) / camera.aspect) : baseV;
  camera.fov = Math.min(THREE.MathUtils.radToDeg(v), 54);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

/* ------------------------------------------------------------------ lights */
const hemi = new THREE.HemisphereLight(0xfff0dc, 0x5a3322, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6c4, 2.2);
sun.position.set(3, 7, 5);
sun.target.position.set(0, 0, -0.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
const fireLight = new THREE.PointLight(0xff7a2a, 9, 9, 1.4);
fireLight.position.set(-2.6, 0.7, -2.7);
scene.add(fireLight);

const COL = {
  skyWarm: new THREE.Color(0xfff0dc), skyRed: new THREE.Color(0xff3020),
  fireWarm: new THREE.Color(0xff7a2a), fireRed: new THREE.Color(0xff0000),
};

/* ------------------------------------------------------------------ materials */
const grad = new THREE.DataTexture(new Uint8Array([70, 160, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a160c, side: THREE.BackSide });

function mesh(geo, color, o = {}) {
  const mat = o.basic
    ? new THREE.MeshBasicMaterial({ color, ...o.mat })
    : new THREE.MeshToonMaterial({ color, gradientMap: grad, ...o.mat });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = o.shadow !== false && !o.basic;
  m.receiveShadow = !!o.receive;
  if (o.outline !== false && !o.basic) {
    const ol = new THREE.Mesh(geo, outlineMat);
    ol.scale.setScalar(o.outline || 1.07);
    m.add(ol);
  }
  return m;
}
const G = THREE;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4;
  return t;
}
const plankTex = canvasTex(512, 512, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(26, 48%, ${33 + Math.random() * 9}%)`;
    g.fillRect(0, i * 64, w, 64);
    g.fillStyle = 'rgba(40,15,5,.5)';
    g.fillRect(0, i * 64, w, 3);
    g.fillRect(Math.random() * w, i * 64, 3, 64);
    g.fillStyle = 'rgba(255,255,255,.04)';
    for (let k = 0; k < 6; k++) g.fillRect(0, i * 64 + 8 + k * 9, w, 1);
  }
}, [7, 7]);
const wallTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#24533d'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2b6048'; g.fillRect(0, 0, w / 2, h);
  g.fillStyle = '#d9a940';
  for (const [x, y] of [[64, 64], [192, 192], [64, 192], [192, 64]]) {
    g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 9, y); g.lineTo(x, y + 14); g.lineTo(x - 9, y); g.fill();
  }
}, [10, 3]);
const noteTex = canvasTex(256, 160, (g, w, h) => {
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c8102e'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#2b1a12'; g.textAlign = 'center';
  g.font = 'bold 34px Fredoka, sans-serif'; g.fillText('Für', w / 2, 58);
  g.font = 'bold 38px Fredoka, sans-serif'; g.fillText('Sinterklaus', w / 2, 100);
  g.fillStyle = '#c8102e'; g.font = '34px sans-serif'; g.fillText('♥', w / 2, 140);
});

/* ------------------------------------------------------------------ characters */
const SKIN = 0xffd2b0;

function addFace(head, r, o = {}) {
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = mesh(new G.SphereGeometry(r * 0.15, 14, 10), 0x1a0f0a, { outline: false, shadow: false });
    e.scale.z = 0.6;
    e.position.set(s * r * 0.36, r * 0.12, r * 0.9);
    const hl = mesh(new G.SphereGeometry(r * 0.055, 8, 6), 0xffffff, { basic: true });
    hl.position.set(r * 0.05, r * 0.06, r * 0.12);
    e.add(hl);
    head.add(e);
    eyes.push(e);
    if (o.cheeks !== false) {
      const ch = mesh(new G.SphereGeometry(r * 0.15, 10, 8), 0xff8f8f, { outline: false, shadow: false });
      ch.scale.set(1, 0.7, 0.35);
      ch.position.set(s * r * 0.58, -r * 0.18, r * 0.78);
      head.add(ch);
    }
    if (o.brows) {
      const b = mesh(new G.CapsuleGeometry(r * 0.035, r * 0.2, 2, 6), o.brows, { outline: false, shadow: false });
      b.rotation.z = Math.PI / 2 - s * 0.18;
      b.position.set(s * r * 0.36, r * 0.4, r * 0.88);
      head.add(b);
    }
  }
  const nose = mesh(new G.SphereGeometry(r * 0.11, 10, 8), o.nose || 0xffb48f, { outline: false });
  nose.position.set(0, -r * 0.04, r * 0.99);
  head.add(nose);
  const smile = mesh(new G.TorusGeometry(r * 0.22, r * 0.045, 6, 16, Math.PI), 0x6a1a10, { outline: false, shadow: false });
  smile.rotation.z = Math.PI;
  smile.position.set(0, -r * 0.24, r * 0.93);
  head.add(smile);
  const mouth = mesh(new G.SphereGeometry(r * 0.17, 12, 10), 0x5a0e10, { outline: false, shadow: false });
  mouth.scale.set(1.1, 1, 0.45);
  mouth.position.set(0, -r * 0.36, r * 0.9);
  mouth.visible = false;
  head.add(mouth);
  return { eyes, smile, mouth };
}

function limb(len, rad, color, hand) {
  const pivot = new G.Group();
  const m = mesh(new G.CapsuleGeometry(rad, Math.max(0.01, len - rad * 2), 4, 10), color);
  m.position.y = -len / 2;
  pivot.add(m);
  if (hand) {
    const h = mesh(new G.SphereGeometry(hand.r, 12, 10), hand.color);
    h.position.y = -len;
    pivot.add(h);
  }
  return pivot;
}

function baseChar(name, bubbleY) {
  const root = new G.Group();
  const body = new G.Group();
  root.add(body);
  return {
    name, root, body, bubbleY,
    mode: 'idle', phase: Math.random() * 10, talking: false, lookY: 0,
    blinkT: rand(1, 4), blinkLeft: 0,
  };
}

function makeKid(o) {
  const c = baseChar(o.name, 0.5);
  const { body } = c;
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new G.Group();
    leg.position.set(s * 0.1, 0.45, 0);
    const shin = mesh(new G.CapsuleGeometry(0.065, 0.28, 4, 10), o.legs);
    shin.position.y = -0.2;
    leg.add(shin);
    const shoe = mesh(new G.SphereGeometry(0.085, 12, 10), o.shoe);
    shoe.scale.set(1, 0.6, 1.5);
    shoe.position.set(0, -0.4, 0.04);
    leg.add(shoe);
    body.add(leg);
    legs.push(leg);
  }
  [c.lLeg, c.rLeg] = legs;

  if (o.girl) {
    const skirt = mesh(new G.CylinderGeometry(0.17, 0.33, 0.34, 22), o.skirt);
    skirt.position.y = 0.5;
    const apron = mesh(new G.CylinderGeometry(0.182, 0.342, 0.3, 22, 1, true, -0.65, 1.3), 0xffffff, { outline: false });
    apron.position.y = 0.49;
    const bodice = mesh(new G.CylinderGeometry(0.15, 0.17, 0.25, 16), o.shirt);
    bodice.position.y = 0.78;
    const blouse = mesh(new G.SphereGeometry(0.12, 12, 8), 0xffffff, { outline: false });
    blouse.scale.set(1, 0.4, 0.5);
    blouse.position.set(0, 0.9, 0.1);
    body.add(skirt, apron, bodice, blouse);
  } else {
    const shorts = mesh(new G.CylinderGeometry(0.19, 0.21, 0.2, 16), 0x6b4226);
    shorts.position.y = 0.5;
    const shirt = mesh(new G.CylinderGeometry(0.16, 0.19, 0.32, 16), o.shirt);
    shirt.position.y = 0.73;
    body.add(shorts, shirt);
    for (const s of [-1, 1]) {
      const strap = mesh(new G.BoxGeometry(0.04, 0.32, 0.02), 0x5a3418, { outline: false });
      strap.position.set(s * 0.08, 0.73, 0.175);
      strap.rotation.x = -0.1;
      body.add(strap);
    }
    const bar = mesh(new G.BoxGeometry(0.2, 0.05, 0.02), 0x5a3418, { outline: false });
    bar.position.set(0, 0.79, 0.17);
    const edel = mesh(new G.SphereGeometry(0.03, 8, 6), 0xffffff, { outline: false });
    edel.position.set(0, 0.79, 0.185);
    body.add(bar, edel);
  }

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = limb(0.33, 0.052, o.girl ? 0xffffff : o.shirt, { r: 0.06, color: SKIN });
    arm.position.set(s * 0.21, 0.84, 0);
    body.add(arm);
    arms.push(arm);
  }
  [c.lArm, c.rArm] = arms;

  const head = new G.Group();
  head.position.y = 1.13;
  body.add(head);
  c.head = head;
  head.add(mesh(new G.SphereGeometry(0.28, 28, 20), SKIN, { outline: 1.05 }));
  Object.assign(c, addFace(head, 0.28, { brows: o.hair }));

  const hairMat = { outline: false, mat: { side: G.DoubleSide } };
  const cap = mesh(new G.SphereGeometry(0.297, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), o.hair, hairMat);
  const back = mesh(new G.SphereGeometry(0.297, 28, 14, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, Math.PI * (o.girl ? 0.64 : 0.56)), o.hair, hairMat);
  head.add(cap, back);

  if (o.girl) {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const b = mesh(new G.SphereGeometry(0.068 - i * 0.008, 12, 10), o.hair, { outline: 1.12 });
        b.position.set(s * (0.25 + i * 0.03), -0.12 - i * 0.085, -0.05);
        head.add(b);
      }
      const bow = mesh(new G.SphereGeometry(0.05, 10, 8), 0xc8102e);
      bow.scale.set(1.8, 0.8, 0.7);
      bow.position.set(s * 0.37, -0.47, -0.05);
      head.add(bow);
    }
  } else {
    const hat = new G.Group();
    hat.position.set(0, 0.2, -0.02);
    hat.rotation.z = 0.14;
    const brim = mesh(new G.CylinderGeometry(0.36, 0.36, 0.03, 26), 0x2f5d3a, { outline: 1.03 });
    const crown = mesh(new G.CylinderGeometry(0.16, 0.22, 0.18, 20), 0x2f5d3a);
    crown.position.y = 0.1;
    const band = mesh(new G.CylinderGeometry(0.205, 0.222, 0.04, 20), 0x8b1d1d, { outline: false });
    band.position.y = 0.03;
    const feather = mesh(new G.ConeGeometry(0.03, 0.3, 8), 0xf4f0e6);
    feather.position.set(0.17, 0.2, -0.04);
    feather.rotation.z = -0.55;
    hat.add(brim, crown, band, feather);
    head.add(hat);
  }
  return c;
}

function makeMerkel() {
  const c = baseChar('merkel', 0);
  c.side = true;
  const { body } = c;
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = limb(0.8, 0.085, 0x23232c);
    leg.position.set(s * 0.12, 0.84, 0);
    const shoe = mesh(new G.SphereGeometry(0.1, 12, 10), 0x111111);
    shoe.scale.set(1, 0.55, 1.6);
    shoe.position.set(0, -0.8, 0.05);
    leg.add(shoe);
    body.add(leg);
    legs.push(leg);
  }
  [c.lLeg, c.rLeg] = legs;
  const hips = mesh(new G.CylinderGeometry(0.24, 0.25, 0.16, 18), 0x23232c);
  hips.position.y = 0.88;
  const hem = mesh(new G.CylinderGeometry(0.28, 0.3, 0.16, 20), 0xe4572e);
  hem.position.y = 0.98;
  const torso = mesh(new G.CapsuleGeometry(0.27, 0.42, 6, 18), 0xe4572e);
  torso.scale.z = 0.82;
  torso.position.y = 1.24;
  const top = mesh(new G.ConeGeometry(0.1, 0.24, 3), 0x1d1d22, { outline: false });
  top.rotation.z = Math.PI;
  top.scale.z = 0.2;
  top.position.set(0, 1.42, 0.218);
  body.add(hips, hem, torso, top);
  for (let i = 0; i < 3; i++) {
    const btn = mesh(new G.SphereGeometry(0.025, 8, 6), 0x2a160c, { outline: false });
    btn.position.set(0, 1.24 - i * 0.1, 0.225);
    body.add(btn);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = limb(0.6, 0.075, 0xe4572e, { r: 0.072, color: SKIN });
    arm.position.set(s * 0.31, 1.5, 0);
    body.add(arm);
    arms.push(arm);
  }
  [c.lArm, c.rArm] = arms;

  // the famous diamond of hands
  const raute = mesh(new G.TorusGeometry(0.078, 0.034, 8, 4), SKIN);
  raute.position.set(0, 1.05, 0.38);
  raute.scale.setScalar(0.001);
  body.add(raute);
  c.raute = raute;

  const head = new G.Group();
  head.position.y = 1.85;
  body.add(head);
  c.head = head;
  const skull = mesh(new G.SphereGeometry(0.25, 28, 20), SKIN, { outline: 1.05 });
  skull.scale.y = 1.08;
  head.add(skull);
  Object.assign(c, addFace(head, 0.25, { brows: 0x9a7a45 }));
  c.smile.scale.set(1.15, 0.7, 1);

  const HAIR = 0xd9b56b;
  const hm = { outline: false, mat: { side: G.DoubleSide } };
  const shell = mesh(new G.SphereGeometry(0.285, 32, 16, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.63), HAIR, hm);
  shell.scale.set(1.08, 1.1, 1.04);
  const capH = mesh(new G.SphereGeometry(0.286, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), HAIR, hm);
  capH.scale.set(1.08, 1.1, 1.04);
  const bangs = mesh(new G.SphereGeometry(0.29, 24, 6, Math.PI / 2 - 0.9, 1.8, Math.PI * 0.2, Math.PI * 0.16), HAIR, hm);
  bangs.scale.set(1.08, 1.1, 1.04);
  bangs.rotation.y = -0.15;
  head.add(shell, capH, bangs);
  return c;
}

/* ------------------------------------------------------------------ world */
let W; // current world state
const bodies = [];
const particles = [];
const sharedGeo = {
  drop: new G.SphereGeometry(0.03, 8, 6),
  crumb: new G.BoxGeometry(0.035, 0.03, 0.035),
  confetti: new G.PlaneGeometry(0.07, 0.11),
};

function makeCookie() {
  const g = new G.Group();
  g.add(mesh(new G.CylinderGeometry(0.11, 0.11, 0.035, 22), 0xd9984f, { outline: 1.1 }));
  for (let i = 0; i < 6; i++) {
    const chip = mesh(new G.SphereGeometry(0.018, 6, 5), 0x3b1e0e, { outline: false, shadow: false });
    const a = i * 1.1 + rand(0, 0.5), r = rand(0.02, 0.08);
    chip.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    g.add(chip);
  }
  g.userData.r = 0.02;
  return g;
}

function buildWorld() {
  const root = new G.Group();
  scene.add(root);
  const w = { root, items: [], cookies: [] };

  // room
  const floor = mesh(new G.PlaneGeometry(30, 30), 0xffffff, { mat: { map: plankTex }, outline: false, shadow: false, receive: true });
  floor.rotation.x = -Math.PI / 2;
  const wall = mesh(new G.PlaneGeometry(30, 10), 0xffffff, { mat: { map: wallTex }, outline: false, shadow: false, receive: true });
  wall.position.set(0, 5, -3.5);
  const wains = mesh(new G.BoxGeometry(30, 0.9, 0.08), 0x6b3a1e, { outline: false, shadow: false, receive: true });
  wains.position.set(0, 0.45, -3.46);
  const rail = mesh(new G.BoxGeometry(30, 0.08, 0.14), 0x4a2612, { outline: false, shadow: false });
  rail.position.set(0, 0.92, -3.44);
  const rug = mesh(new G.CircleGeometry(1.9, 40), 0xa8202e, { outline: false, shadow: false, receive: true });
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.006;
  const rugIn = mesh(new G.RingGeometry(1.45, 1.6, 40), 0xf2b632, { outline: false, shadow: false, receive: true });
  rugIn.rotation.x = -Math.PI / 2;
  rugIn.position.y = 0.008;
  root.add(floor, wall, wains, rail, rug, rugIn);

  // fireplace
  const fp = new G.Group();
  fp.position.set(-2.7, 0, -3.25);
  const brick = mesh(new G.BoxGeometry(1.9, 1.6, 0.5), 0x9b3b2b, { shadow: false, outline: 1.02 });
  brick.position.y = 0.8;
  const hole = mesh(new G.BoxGeometry(1.1, 0.9, 0.06), 0x140806, { basic: true });
  hole.position.set(0, 0.5, 0.25);
  const mantel = mesh(new G.BoxGeometry(2.2, 0.12, 0.65), 0x4a2612, { shadow: false, outline: 1.02 });
  mantel.position.y = 1.66;
  fp.add(brick, hole, mantel);
  w.flames = [];
  for (const [x, s, col] of [[-0.25, 0.9, 0xff6a1a], [0.05, 1.2, 0xffa21a], [0.3, 0.8, 0xff6a1a], [0.05, 0.6, 0xfff07a]]) {
    const f = mesh(new G.ConeGeometry(0.16, 0.5, 10), col, { basic: true, mat: { transparent: true, opacity: 0.9 } });
    f.position.set(x, 0.3, 0.3);
    f.userData.s = s;
    fp.add(f);
    w.flames.push(f);
  }
  for (const [x, col] of [[-0.55, 0xc8102e], [0.55, 0x1f7a40]]) {
    const st = new G.Group();
    st.position.set(x, 1.4, 0.36);
    const leg = mesh(new G.CapsuleGeometry(0.09, 0.22, 4, 8), col, { shadow: false });
    const foot = mesh(new G.SphereGeometry(0.1, 10, 8), col, { shadow: false });
    foot.scale.set(1.4, 0.9, 0.9);
    foot.position.set(0.08, -0.18, 0);
    const cuff = mesh(new G.CylinderGeometry(0.11, 0.11, 0.08, 12), 0xffffff, { shadow: false });
    cuff.position.y = 0.17;
    st.add(leg, foot, cuff);
    fp.add(st);
  }
  root.add(fp);

  // window with snow
  const win = new G.Group();
  win.position.set(1.4, 2.0, -3.44);
  const pane = mesh(new G.PlaneGeometry(1.4, 1.5), 0x1d3566, { basic: true });
  win.add(pane);
  for (const [x, y, ww, hh] of [[0, 0.8, 1.6, 0.1], [0, -0.8, 1.7, 0.14], [-0.75, 0, 0.1, 1.7], [0.75, 0, 0.1, 1.7], [0, 0, 0.06, 1.5], [0, 0, 1.4, 0.06]]) {
    const b = mesh(new G.BoxGeometry(ww, hh, 0.08), 0xf4efe4, { outline: false, shadow: false });
    b.position.set(x, y, 0.04);
    win.add(b);
  }
  const snowGeo = new G.BufferGeometry();
  const snowPos = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    snowPos[i * 3] = rand(-0.68, 0.68);
    snowPos[i * 3 + 1] = rand(-0.72, 0.72);
    snowPos[i * 3 + 2] = 0.02;
  }
  snowGeo.setAttribute('position', new G.BufferAttribute(snowPos, 3));
  w.snow = new G.Points(snowGeo, new G.PointsMaterial({ color: 0xffffff, size: 0.035 }));
  win.add(w.snow);
  w.pane = pane;
  root.add(win);

  // tree
  const tree = new G.Group();
  tree.position.set(3.5, 0, -2.6);
  const trunk = mesh(new G.CylinderGeometry(0.1, 0.12, 0.4, 10), 0x5a3418);
  trunk.position.y = 0.2;
  tree.add(trunk);
  [[0.95, 1.0, 0.75], [0.75, 0.9, 1.3], [0.5, 0.75, 1.8]].forEach(([r, h, y]) => {
    const cone = mesh(new G.ConeGeometry(r, h, 14), 0x1f6b3a, { outline: 1.03 });
    cone.position.y = y;
    tree.add(cone);
  });
  w.ornaments = [];
  const ornCols = [0xc8102e, 0xf2b632, 0x3a7bd5, 0xffffff];
  for (let i = 0; i < 16; i++) {
    const y = rand(0.45, 1.9), r = (2.2 - y) * 0.42;
    const a = rand(-1.3, 1.3);
    const o = mesh(new G.SphereGeometry(0.05, 10, 8), ornCols[i % 4], { basic: true });
    o.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    tree.add(o);
    w.ornaments.push(o);
  }
  const star = mesh(new G.OctahedronGeometry(0.14), 0xffd84a, { basic: true });
  star.position.y = 2.25;
  tree.add(star);
  w.star = star;
  root.add(tree);

  // table
  const pivot = new G.Group();
  pivot.position.set(0, 0, 0.6);
  const table = new G.Group();
  table.position.set(0, 0, -0.6);
  pivot.add(table);
  root.add(pivot);
  w.pivot = pivot;
  w.table = table;
  const top = mesh(new G.CylinderGeometry(0.9, 0.9, 0.08, 40), 0xb5793f, { outline: 1.02 });
  top.position.y = 0.7;
  const cloth = mesh(new G.CylinderGeometry(0.96, 0.98, 0.2, 40, 1, true), 0xc8102e, { outline: false, mat: { side: G.DoubleSide } });
  cloth.position.y = 0.66;
  const clothTop = mesh(new G.CylinderGeometry(0.96, 0.96, 0.02, 40), 0xc8102e, { outline: false });
  clothTop.position.y = 0.755;
  const lace = mesh(new G.TorusGeometry(0.97, 0.025, 6, 48), 0xffffff, { outline: false });
  lace.rotation.x = Math.PI / 2;
  lace.position.y = 0.56;
  table.add(top, cloth, clothTop, lace);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const leg = mesh(new G.CylinderGeometry(0.05, 0.04, 0.66, 10), 0x8a5528);
    leg.position.set(Math.cos(a) * 0.6, 0.33, Math.sin(a) * 0.6);
    table.add(leg);
  }
  const plate = mesh(new G.CylinderGeometry(0.4, 0.32, 0.04, 30), 0xffffff, { outline: 1.03 });
  plate.position.set(-0.18, 0.785, 0.12);
  plate.userData.r = 0.02;
  table.add(plate);
  w.items.push(plate);
  for (let i = 0; i < 6; i++) {
    const ck = makeCookie();
    if (i < 5) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      ck.position.set(-0.18 + Math.cos(a) * 0.18, 0.825, 0.12 + Math.sin(a) * 0.18);
      ck.rotation.set(rand(-0.08, 0.08), rand(0, 6), rand(-0.08, 0.08));
    } else {
      ck.position.set(-0.18, 0.86, 0.12);
      ck.rotation.set(0.15, 0, 0.1);
    }
    table.add(ck);
    w.cookies.push(ck);
    w.items.push(ck);
  }
  const glass = new G.Group();
  glass.position.set(0.4, 0.905, 0.15);
  const glassShell = mesh(new G.CylinderGeometry(0.09, 0.075, 0.28, 20, 1, true), 0xdff2ff, {
    outline: false, shadow: false, mat: { transparent: true, opacity: 0.35, side: G.DoubleSide },
  });
  const milk = mesh(new G.CylinderGeometry(0.082, 0.07, 0.24, 20), 0xfbfbf6, { outline: false });
  milk.position.y = -0.01;
  glass.add(milk, glassShell);
  glass.userData.r = 0.08;
  glass.userData.isGlass = true;
  table.add(glass);
  w.glass = glass;
  w.milk = milk;
  w.items.push(glass);
  const note = mesh(new G.PlaneGeometry(0.34, 0.21), 0xffffff, { outline: false, mat: { map: noteTex, side: G.DoubleSide } });
  note.position.set(0.32, 0.85, -0.42);
  note.rotation.set(-0.35, -0.2, 0);
  note.userData.r = 0.01;
  table.add(note);
  w.items.push(note);

  // characters
  w.hans = makeKid({ name: 'hans', shirt: 0xf2ede0, legs: 0xd8d0c0, shoe: 0x4a2a16, hair: 0x7a4422 });
  w.greta = makeKid({ name: 'greta', girl: true, shirt: 0x9c1f2e, skirt: 0x2e7d4f, legs: 0xffffff, shoe: 0x1a1a1a, hair: 0xf0c45a });
  w.hans.root.scale.setScalar(1.18);
  w.greta.root.scale.setScalar(1.18);
  w.hans.root.position.set(-0.78, 0, -1.2);
  w.hans.root.rotation.y = 0.18;
  w.greta.root.position.set(0.78, 0, -1.2);
  w.greta.root.rotation.y = -0.18;
  w.merkel = makeMerkel();
  w.merkel.root.position.set(7, 0, -0.9);
  w.merkel.root.visible = false;
  w.chars = [w.hans, w.greta, w.merkel];
  for (const c of w.chars) root.add(c.root);
  return w;
}

function resetWorld() {
  if (W) {
    scene.remove(W.root);
    W.root.traverse((o) => {
      if (o.geometry && !Object.values(sharedGeo).includes(o.geometry)) o.geometry.dispose();
      if (o.material && o.material !== outlineMat) o.material.dispose();
    });
  }
  tweens.length = 0;
  for (const b of bodies) b.dead = true;
  bodies.length = 0;
  for (const p of particles) scene.remove(p.mesh);
  particles.length = 0;
  bubblesEl.innerHTML = '';
  bubbles.length = 0;
  fx.krampus = 0; fx.flash = 0; fx.shake = 0; fx.chew = 0;
  stage.classList.remove('krampus');
  $('#horns').classList.remove('on');
  W = buildWorld();
}

/* ------------------------------------------------------------------ tweens */
const tweens = [];
function tween(dur, fn, e = ease.inOut) {
  return new Promise((res) => tweens.push({ t: 0, dur, fn, e, res }));
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(tw.t / tw.dur, 1);
    tw.fn(tw.e(k));
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}

/* ------------------------------------------------------------------ character animation */
let time = 0;
function updateChar(c, dt) {
  const t = time * 1 + c.phase;
  const P = { lax: 0, laz: -0.12, rax: 0, raz: 0.12, llx: 0, rlx: 0, by: 0, hz: 0, hx: 0, eye: 1, open: false, raute: 0, rz: 0 };
  switch (c.mode) {
    case 'idle':
      P.by = Math.sin(t * 2.2) * 0.012;
      P.hz = Math.sin(t * 1.3) * 0.07;
      P.laz = -0.14 - Math.sin(t * 2.2) * 0.04;
      P.raz = 0.14 + Math.sin(t * 2.2) * 0.04;
      break;
    case 'wave':
      P.by = Math.sin(t * 2.2) * 0.012;
      P.raz = 2.6 + Math.sin(t * 10) * 0.35;
      P.hz = -0.12;
      break;
    case 'cheer': {
      const j = Math.abs(Math.sin(t * 6));
      P.by = j * 0.2;
      P.laz = -2.6 - Math.sin(t * 12) * 0.25;
      P.raz = 2.6 + Math.sin(t * 12) * 0.25;
      P.llx = -j * 0.5; P.rlx = -j * 0.5;
      P.hz = Math.sin(t * 6) * 0.1;
      P.open = true;
      break;
    }
    case 'scared':
      P.by = Math.sin(t * 50) * 0.008;
      P.rz = Math.sin(t * 47) * 0.03;
      P.laz = -2.2; P.raz = 2.2; P.lax = -0.4; P.rax = -0.4;
      P.hx = -0.15;
      P.eye = 1.45;
      P.open = true;
      break;
    case 'lift':
      P.lax = -1.35; P.rax = -1.35; P.laz = 0.1; P.raz = -0.1;
      P.by = -0.06; P.hx = 0.15; P.eye = 1.3;
      break;
    case 'heave':
      P.lax = -2.7; P.rax = -2.7; P.laz = 0.05; P.raz = -0.05;
      P.by = 0.06; P.hx = -0.2; P.eye = 1.4; P.open = true;
      break;
    case 'run': {
      const s = Math.sin(t * 17);
      P.llx = s * 1.0; P.rlx = -s * 1.0;
      P.laz = -2.5 + s * 0.35; P.raz = 2.5 + s * 0.35;
      P.by = Math.abs(s) * 0.09;
      P.hz = s * 0.1; P.eye = 1.45; P.open = true;
      break;
    }
    case 'walk': {
      const s = Math.sin(t * 7);
      P.llx = s * 0.45; P.rlx = -s * 0.45;
      P.lax = -s * 0.35; P.rax = s * 0.35;
      P.by = Math.abs(s) * 0.03;
      break;
    }
    case 'raute':
      P.lax = -0.75; P.rax = -0.75; P.laz = 0.43; P.raz = -0.43;
      P.by = Math.sin(t * 2) * 0.01;
      P.hz = Math.sin(t * 1.4) * 0.06;
      P.raute = 1;
      break;
    case 'shrug':
      P.laz = -1.0; P.raz = 1.0; P.lax = -0.6; P.rax = -0.6;
      P.hz = Math.sin(t * 4) * 0.18;
      P.by = 0.03;
      break;
  }
  const k = 1 - Math.exp(-dt * 14);
  c.lArm.rotation.x += (P.lax - c.lArm.rotation.x) * k;
  c.lArm.rotation.z += (P.laz - c.lArm.rotation.z) * k;
  c.rArm.rotation.x += (P.rax - c.rArm.rotation.x) * k;
  c.rArm.rotation.z += (P.raz - c.rArm.rotation.z) * k;
  c.lLeg.rotation.x += (P.llx - c.lLeg.rotation.x) * k;
  c.rLeg.rotation.x += (P.rlx - c.rLeg.rotation.x) * k;
  c.body.position.y += (P.by - c.body.position.y) * k;
  c.body.rotation.z += (P.rz - c.body.rotation.z) * k;
  c.head.rotation.z += (P.hz - c.head.rotation.z) * k;
  c.head.rotation.x += (P.hx - c.head.rotation.x) * k;
  c.head.rotation.y += (c.lookY - c.head.rotation.y) * k;
  if (c.raute) {
    const s = lerp(c.raute.scale.x, P.raute || 0.001, k);
    c.raute.scale.setScalar(s);
  }
  // eyes + blinking
  c.blinkT -= dt;
  if (c.blinkT < 0) { c.blinkLeft = 0.12; c.blinkT = rand(2, 5); }
  c.blinkLeft -= dt;
  const ey = c.blinkLeft > 0 ? 0.1 : P.eye;
  for (const e of c.eyes) {
    e.scale.x += (P.eye - e.scale.x) * k;
    e.scale.y += (ey - e.scale.y) * 0.5;
  }
  // mouth
  const open = P.open || c.talking;
  c.mouth.visible = open;
  c.smile.visible = !open;
  if (open) c.mouth.scale.y = c.talking ? 0.5 + Math.abs(Math.sin(t * 17)) * 0.9 : 1.2;
}

/* ------------------------------------------------------------------ physics + particles */
const V = (x, y, z) => new G.Vector3(x, y, z);
function launch(obj, v, w, onLand) {
  bodies.push({ obj, v, w, r: obj.userData.r ?? 0.03, onLand, landed: false, rest: false });
}
function updateBodies(dt) {
  for (const b of bodies) {
    if (b.rest || b.dead) continue;
    b.v.y -= 9.8 * dt;
    b.obj.position.addScaledVector(b.v, dt);
    b.obj.rotation.x += b.w.x * dt;
    b.obj.rotation.y += b.w.y * dt;
    b.obj.rotation.z += b.w.z * dt;
    if (b.obj.position.y < b.r) {
      b.obj.position.y = b.r;
      if (!b.landed) { b.landed = true; b.onLand?.(b); }
      b.v.y = Math.abs(b.v.y) * 0.35;
      b.v.x *= 0.55; b.v.z *= 0.55;
      b.w.multiplyScalar(0.45);
      if (b.v.y > 0.6) sfx.tick();
      if (b.v.lengthSq() < 0.4) {
        b.rest = true;
        const o = b.obj, rx = o.rotation.x, rz = o.rotation.z;
        const tx = o.userData.isGlass ? Math.PI / 2 : Math.round(rx / Math.PI) * Math.PI;
        const tz = o.userData.isGlass ? rz : Math.round(rz / Math.PI) * Math.PI;
        tween(0.25, (k) => { o.rotation.x = lerp(rx, tx, k); o.rotation.z = lerp(rz, tz, k); }, ease.out);
      }
    }
  }
}

const matCache = {};
const pMat = (color, opts = {}) =>
  (matCache[color + JSON.stringify(opts)] ||= new G.MeshBasicMaterial({ color, side: G.DoubleSide, ...opts }));

function emit(geo, color, pos, v, o = {}) {
  const m = new G.Mesh(geo, pMat(color));
  m.position.copy(pos);
  m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
  if (o.scale) m.scale.setScalar(o.scale);
  scene.add(m);
  particles.push({ mesh: m, v, life: o.life ?? 2, g: o.g ?? 9.8, drag: o.drag ?? 0, spin: o.spin ?? 0, onFloor: o.onFloor });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.v.y -= p.g * dt;
    if (p.drag) p.v.multiplyScalar(1 - p.drag * dt);
    p.mesh.position.addScaledVector(p.v, dt);
    if (p.spin) { p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.y += p.spin * 0.7 * dt; }
    let dead = p.life <= 0;
    if (p.mesh.position.y < 0.01) {
      if (p.onFloor) { p.onFloor(p); dead = true; }
      else { p.mesh.position.y = 0.01; p.v.set(0, 0, 0); p.g = 0; p.spin = 0; }
    }
    if (dead) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
}
function crumbs(pos, n = 10) {
  for (let i = 0; i < n; i++)
    emit(sharedGeo.crumb, i % 3 ? 0xd9984f : 0x3b1e0e, pos, V(rand(-0.8, 0.8), rand(0.2, 1.2), rand(-0.3, 0.6)), { life: 1.2, scale: rand(0.6, 1.4), spin: 8 });
}
function confetti(center, n = 120) {
  const cols = [0x111111, 0xdd0000, 0xffcc00];
  for (let i = 0; i < n; i++) {
    const p = center.clone().add(V(rand(-2.2, 2.2), rand(2.6, 3.6), rand(-1.5, 1.2)));
    emit(sharedGeo.confetti, cols[i % 3], p, V(rand(-0.4, 0.4), rand(-0.3, 0.6), rand(-0.3, 0.3)), { life: 6, g: 1.2, drag: 1.2, spin: rand(4, 9) });
  }
}
function milkSplash(pos, v) {
  for (let i = 0; i < 45; i++) {
    emit(sharedGeo.drop, 0xfbfbf6, pos, v.clone().add(V(rand(-1.2, 1.2), rand(-0.3, 1.6), rand(-0.8, 1.2))), {
      life: 3, scale: rand(0.6, 1.6),
      onFloor: (p) => growPuddle(p.mesh.position),
    });
  }
}
function growPuddle(at) {
  if (!W.puddle) {
    W.puddle = mesh(new G.CircleGeometry(0.5, 28), 0xf6f6ee, { outline: false, shadow: false, receive: true });
    W.puddle.rotation.x = -Math.PI / 2;
    W.puddle.position.set(at.x, 0.012, at.z);
    W.puddle.scale.setScalar(0.1);
    W.puddle.userData.target = 0.1;
    W.root.add(W.puddle);
  }
  W.puddle.userData.target = Math.min(W.puddle.userData.target + 0.04, 1.5);
}

/* ------------------------------------------------------------------ environment fx */
const fx = { krampus: 0, flash: 0, shake: 0, chew: 0 };
const camOffset = new G.Vector3();
function updateEnv(dt) {
  const fl = 0.8 + Math.sin(time * 13) * 0.12 + Math.sin(time * 31) * 0.08;
  fireLight.intensity = 9 * fl * (1 + fx.krampus * 1.5);
  fireLight.color.copy(COL.fireWarm).lerp(COL.fireRed, fx.krampus);
  for (const [i, f] of W.flames.entries()) {
    const s = f.userData.s * (0.85 + Math.sin(time * (9 + i * 3) + i) * 0.18) * (1 + fx.krampus * 0.6);
    f.scale.set(1, s, 1);
    f.position.y = 0.12 + 0.25 * s;
  }
  hemi.color.copy(COL.skyWarm).lerp(COL.skyRed, fx.krampus);
  hemi.intensity = 1.1 - fx.krampus * 0.4 + fx.flash * 5;
  sun.intensity = 2.2 * (1 - fx.krampus * 0.7) + fx.flash * 3;
  W.pane.material.color.setHex(fx.flash > 0.2 ? 0xe8f0ff : fx.krampus > 0.5 ? 0x3a0a14 : 0x1d3566);
  fx.flash = Math.max(0, fx.flash - dt * 3);
  const pos = W.snow.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) - dt * (0.15 + (i % 5) * 0.04);
    if (y < -0.72) y = 0.72;
    pos.setY(i, y);
    pos.setX(i, pos.getX(i) + Math.sin(time * 2 + i) * 0.0008);
  }
  pos.needsUpdate = true;
  W.star.rotation.y += dt * 1.5;
  W.star.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
  W.ornaments.forEach((o, i) => o.scale.setScalar(0.85 + Math.max(0, Math.sin(time * 2 + i * 1.7)) * 0.4));
  if (W.puddle) {
    const s = lerp(W.puddle.scale.x, W.puddle.userData.target, 1 - Math.exp(-dt * 3));
    W.puddle.scale.setScalar(s);
  }
  // camera: shake + chewing bob
  fx.shake = Math.max(0, fx.shake - dt * 2.2);
  fx.chew = Math.max(0, fx.chew - dt * 3);
  camOffset.set(rand(-1, 1) * fx.shake * 0.12, rand(-1, 1) * fx.shake * 0.12 + Math.sin(time * 30) * fx.chew * 0.025, 0);
  camera.position.copy(CAM_POS).add(camOffset);
  camera.lookAt(CAM_LOOK);
}
function shake(amount = 1) {
  fx.shake = Math.max(fx.shake, amount);
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}

/* ------------------------------------------------------------------ speech bubbles */
const bubbles = [];
const tmpV = new G.Vector3();
function bubble(c, de, en, cls = '') {
  const el = document.createElement('div');
  el.className = `bubble ${cls}`;
  el.innerHTML = `${de}${en ? `<small>${en}</small>` : ''}`;
  bubblesEl.appendChild(el);
  const b = { el, c, remove: () => { el.remove(); const i = bubbles.indexOf(b); if (i >= 0) bubbles.splice(i, 1); } };
  bubbles.push(b);
  positionBubble(b);
  return b;
}
function positionBubble(b) {
  b.c.head.getWorldPosition(tmpV);
  tmpV.y += b.c.bubbleY;
  tmpV.project(camera);
  const w = stage.clientWidth, h = stage.clientHeight;
  if (b.c.side) {
    const px = (tmpV.x + 1) / 2 * w, py = (1 - tmpV.y) / 2 * h;
    b.el.style.left = `${Math.min(Math.max(px - 30, b.el.offsetWidth + 6), w - 6)}px`;
    b.el.style.top = `${Math.max(py - 50, b.el.offsetHeight + 8)}px`;
    return;
  }
  const half = b.el.offsetWidth / 2 + 6;
  const x = Math.min(Math.max((tmpV.x + 1) / 2 * w, half), w - half);
  const y = Math.max((1 - tmpV.y) / 2 * h, b.el.offsetHeight + 8);
  b.el.style.left = `${x}px`;
  b.el.style.top = `${y}px`;
}
let subTimer;
function subtitle(text, s = 2) {
  const el = $('#subtitle');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(subTimer);
  subTimer = setTimeout(() => el.classList.remove('on'), s * 1000);
}

/* ------------------------------------------------------------------ audio */
const A = { ctx: null, master: null, noise: null, muted: false, unlocked: false };
function ensureAudio() {
  if (!A.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.9;
    const comp = A.ctx.createDynamicsCompressor();
    A.master.connect(comp).connect(A.ctx.destination);
    const len = A.ctx.sampleRate * 2;
    A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (A.ctx.state === 'suspended') A.ctx.resume();
  return A.ctx;
}
function envGain(t0, attack, dur, peak) {
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  return g;
}
function tone({ f, f2, dur = 0.3, type = 'sine', vol = 0.3, at = 0, attack = 0.005, dest, detune = 0 }) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime + at;
  const o = A.ctx.createOscillator();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  o.connect(envGain(t, attack, dur, vol)).connect(dest || A.master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise({ dur = 0.2, vol = 0.3, at = 0, type = 'bandpass', f = 1000, f2, q = 1, attack = 0.003 }) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime + at;
  const src = A.ctx.createBufferSource();
  src.buffer = A.noise;
  src.loop = true;
  const fl = A.ctx.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  src.connect(fl).connect(envGain(t, attack, dur, vol)).connect(A.master);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}
const sfx = {
  crunch() { for (let i = 0; i < 3; i++) noise({ dur: rand(0.05, 0.1), f: rand(1500, 4000), q: 1.4, vol: 0.55, at: i * 0.06 + rand(0, 0.02) }); },
  gulp(at = 0) { tone({ f: 380, f2: 130, dur: 0.17, vol: 0.45, at }); noise({ dur: 0.12, type: 'lowpass', f: 400, vol: 0.2, at }); },
  clink() { tone({ f: 2500, dur: 0.5, vol: 0.1 }); tone({ f: 3800, dur: 0.35, vol: 0.06 }); },
  tick() { noise({ dur: 0.04, f: rand(2500, 5000), q: 5, vol: 0.12 }); },
  whoosh(at = 0) { noise({ dur: 0.45, f: 300, f2: 2400, q: 2, vol: 0.25, attack: 0.15, at }); },
  jingle() {
    for (let i = 0; i < 16; i++) {
      const at = i * 0.07 + rand(0, 0.03);
      tone({ f: rand(2300, 4800), dur: 0.3, type: 'triangle', vol: 0.06, at });
      noise({ dur: 0.05, type: 'highpass', f: 7000, vol: 0.06, at });
    }
  },
  crash() {
    noise({ dur: 1.0, type: 'lowpass', f: 2500, f2: 180, vol: 0.9, attack: 0.002 });
    tone({ f: 110, f2: 38, dur: 0.6, vol: 0.9 });
    for (let i = 0; i < 12; i++) noise({ dur: 0.05, f: rand(2500, 6500), q: 6, vol: 0.35, at: 0.05 + rand(0, 0.7) });
  },
  shatter() {
    noise({ dur: 0.3, type: 'highpass', f: 3000, vol: 0.3 });
    for (let i = 0; i < 10; i++) tone({ f: rand(3000, 6500), dur: 0.15, type: 'triangle', vol: 0.06, at: rand(0, 0.35) });
  },
  thunder() {
    noise({ dur: 0.35, type: 'highpass', f: 800, vol: 0.5 });
    noise({ dur: 3, type: 'lowpass', f: 500, f2: 50, vol: 1, attack: 0.08 });
    tone({ f: 60, f2: 30, dur: 2, vol: 0.5, attack: 0.1 });
  },
  chains() {
    for (let i = 0; i < 22; i++) {
      const at = 0.2 + i * 0.065 + rand(0, 0.05);
      noise({ dur: 0.04, f: rand(3500, 7000), q: 9, vol: 0.3, at });
      tone({ f: rand(1600, 2800), dur: 0.08, type: 'square', vol: 0.025, at });
    }
  },
  growl() {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + 0.15;
    const lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = envGain(t, 0.25, 2.2, 0.5);
    lp.connect(g).connect(A.master);
    for (const d of [-14, 0, 11]) {
      const o = A.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(72, t);
      o.frequency.linearRampToValueAtTime(52, t + 2.2);
      o.detune.value = d * 3;
      const lfo = A.ctx.createOscillator();
      const lg = A.ctx.createGain();
      lfo.frequency.value = 9; lg.gain.value = 8;
      lfo.connect(lg).connect(o.frequency);
      o.connect(lp);
      o.start(t); lfo.start(t);
      o.stop(t + 2.3); lfo.stop(t + 2.3);
    }
  },
  patter(n = 12, gap = 0.11) { for (let i = 0; i < n; i++) noise({ dur: 0.045, type: 'lowpass', f: 600, vol: 0.4, at: i * gap }); },
  fanfare() {
    if (!A.ctx) return;
    const lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    lp.connect(A.master);
    [[523, 0, 0.18], [659, 0.15, 0.18], [784, 0.3, 0.18], [1047, 0.45, 0.9]].forEach(([f, at, dur]) => {
      tone({ f, dur, type: 'sawtooth', vol: 0.14, at, attack: 0.02, dest: lp });
      tone({ f: f * 1.003, dur, type: 'square', vol: 0.05, at, attack: 0.02, dest: lp });
    });
    [523, 659, 784].forEach((f) => tone({ f, dur: 0.9, type: 'sawtooth', vol: 0.06, at: 0.45, attack: 0.02, dest: lp }));
  },
  pop() { tone({ f: 500, f2: 1400, dur: 0.12, type: 'triangle', vol: 0.2 }); },
  boing() { tone({ f: 220, f2: 520, dur: 0.25, type: 'triangle', vol: 0.2 }); },
};

// music box "O Tannenbaum"
const NOTE = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
const MELODY = [['G4', 1], ['C5', 0.75], ['C5', 0.25], ['C5', 1.5], ['D5', 0.5], ['E5', 0.75], ['E5', 0.25], ['E5', 1.5],
  ['E5', 0.5], ['D5', 0.5], ['E5', 0.5], ['F5', 1], ['B4', 1], ['D5', 1], ['C5', 2.5]];
const music = { on: false, timer: 0, gain: null };
function startMusic() {
  if (!A.ctx || music.on) return;
  music.on = true;
  music.gain = A.ctx.createGain();
  music.gain.gain.value = 0.9;
  music.gain.connect(A.master);
  const loop = () => {
    if (!music.on) return;
    let t = 0;
    const beat = 0.45;
    for (const [n, d] of MELODY) {
      const f = NOTE[n];
      tone({ f, dur: 1.4, vol: 0.07, at: t, dest: music.gain });
      tone({ f: f * 2, dur: 0.5, vol: 0.025, at: t, dest: music.gain });
      tone({ f: f * 3.01, dur: 0.25, type: 'triangle', vol: 0.01, at: t, dest: music.gain });
      t += d * beat;
    }
    music.timer = setTimeout(loop, (t + 1.5) * 1000);
  };
  loop();
}
function stopMusic() {
  music.on = false;
  clearTimeout(music.timer);
  if (music.gain && A.ctx) music.gain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.15);
}

// voices
const VOICES = {
  hans: { lang: 'de', pitch: 1.7, rate: 1.12, prefer: ['Eddy', 'Anna', 'Google Deutsch', 'Markus'] },
  greta: { lang: 'de', pitch: 1.95, rate: 1.12, prefer: ['Flo', 'Anna', 'Google Deutsch', 'Helena'] },
  merkel: { lang: 'de', pitch: 0.82, rate: 0.9, prefer: ['Petra', 'Helena', 'Anna', 'Google Deutsch'] },
  santa: { lang: 'en', pitch: 0.2, rate: 0.75, prefer: ['Daniel', 'Fred', 'Google UK English Male', 'Alex'] },
};
const synth = window.speechSynthesis;
const liveUtterances = new Set(); // Chrome drops onend for GC'd utterances
let lastCancel = 0;
function pickVoice(lang, prefer) {
  const vs = synth?.getVoices() || [];
  for (const n of prefer) {
    const v = vs.find((v) => v.name.includes(n) && v.lang.toLowerCase().startsWith(lang));
    if (v) return v;
  }
  return vs.find((v) => v.lang.toLowerCase().startsWith(lang)) || null;
}
synth?.getVoices();
function say(text, who) {
  const est = 0.7 + text.length * 0.065;
  return new Promise((res) => {
    if (!A.unlocked || A.muted || !synth) return setTimeout(res, est * 1000);
    const cfg = VOICES[who];
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(cfg.lang, cfg.prefer);
    if (v) u.voice = v;
    u.lang = v?.lang || (cfg.lang === 'de' ? 'de-DE' : 'en-US');
    u.pitch = cfg.pitch;
    u.rate = cfg.rate;
    let done = false;
    const fin = () => { if (!done) { done = true; liveUtterances.delete(u); res(); } };
    u.onend = fin;
    u.onerror = fin;
    u.onstart = () => setTimeout(fin, (est * 2 + 1) * 1000);
    setTimeout(fin, (est * 2 + 8) * 1000); // in case it never starts
    liveUtterances.add(u);
    const gap = 80 - (performance.now() - lastCancel);
    if (gap > 0) setTimeout(() => synth.speak(u), gap); else synth.speak(u);
  });
}
async function line(c, de, en, { cls = '', hold = 0.5, who = c.name } = {}) {
  const b = bubble(c, de, en, cls);
  const tok = (c.talkTok = (c.talkTok || 0) + 1);
  c.talking = true;
  await say(de.replace(/<[^>]+>/g, ''), who);
  if (c.talkTok === tok) c.talking = false;
  await wait(hold);
  b.remove();
}

/* ------------------------------------------------------------------ sequences */
let busy = false;
let chatter = 0; // >0 while an interruptible intro/prefs bit is running
let introDone = false;
// A real choice (accept/reject) always wins over the kids' small talk.
function claim() {
  if (busy && !chatter) return false;
  if (chatter) {
    chatter = 0;
    synth?.cancel();
    lastCancel = performance.now();
    for (const b of [...bubbles]) b.remove();
    for (const c of [W.hans, W.greta]) { c.talking = false; c.mode = 'idle'; }
  }
  busy = true;
  return true;
}
const btns = ['#accept', '#reject', '#prefs'].map((s) => $(s));
const lockButtons = (on) => btns.forEach((b) => (b.disabled = on));

function mouthPoint(down = 0.22) {
  const dir = new G.Vector3().subVectors(CAM_LOOK, CAM_POS).normalize();
  return CAM_POS.clone().addScaledVector(dir, 0.8).add(V(0, -down, 0));
}

async function intro(withVoice) {
  if (busy) return;
  busy = true;
  const id = (chatter = Date.now());
  W.greta.mode = 'wave';
  await line(W.greta, 'Hallo Sinterklaus!', 'Hello, Sinterklaus!', { hold: 0.2 });
  if (chatter !== id) return;
  W.greta.mode = 'idle';
  W.hans.mode = 'wave';
  await line(W.hans, 'Wir haben Kekse für dich!', 'We left cookies for you!', { hold: 0.2 });
  if (chatter !== id) return;
  W.hans.mode = 'idle';
  busy = false;
  chatter = 0;
  if (withVoice) introDone = true;
}

async function eatCookie(ck) {
  W.root.attach(ck);
  const from = ck.position.clone();
  const r0 = ck.rotation.clone();
  const to = mouthPoint();
  sfx.whoosh();
  await tween(0.5, (k) => {
    ck.position.lerpVectors(from, to, k);
    ck.position.y += Math.sin(k * Math.PI) * 0.35;
    ck.rotation.set(lerp(r0.x, Math.PI / 2, k), r0.y * (1 - k), r0.z + k * 2);
  }, ease.inOut);
  for (let i = 0; i < 3; i++) {
    sfx.crunch();
    fx.chew = 1;
    crumbs(ck.position, 9);
    ck.scale.multiplyScalar(0.68);
    await wait(0.17);
  }
  ck.visible = false;
}

async function drinkMilk() {
  const g = W.glass;
  W.root.attach(g);
  const from = g.position.clone();
  const r0 = g.rotation.clone();
  const to = mouthPoint(0.32);
  await tween(0.55, (k) => { g.position.lerpVectors(from, to, k); g.rotation.x = lerp(r0.x, 0.9, k); });
  for (let i = 0; i < 4; i++) {
    sfx.gulp();
    fx.chew = 0.6;
    const s0 = 1 - i * 0.24, s1 = Math.max(0.04, 1 - (i + 1) * 0.24);
    await tween(0.28, (k) => {
      const s = lerp(s0, s1, k);
      W.milk.scale.y = s;
      W.milk.position.y = -0.13 + 0.12 * s;
    });
  }
  subtitle('🥛 *aaah*', 1.2);
  await tween(0.55, (k) => { g.position.lerpVectors(to, from, k); g.rotation.x = lerp(0.9, r0.x, k); });
  sfx.clink();
}

async function accept() {
  if (!claim()) return;
  lockButtons(true);
  setConsent('accepted');
  sfx.jingle();
  subtitle('🎅 Ho ho ho!', 2);
  say('Ho ho ho!', 'santa');
  W.greta.mode = 'cheer';
  W.hans.mode = 'cheer';
  await wait(0.6);
  W.greta.mode = 'idle';
  W.hans.mode = 'idle';
  const order = [...W.cookies].reverse();
  for (const [i, ck] of order.entries()) {
    if (i === 1) line(W.greta, 'Er isst sie!', "He's eating them!", { hold: 0.3 });
    if (i === 3) line(W.hans, 'Alle?!', 'ALL of them?!', { hold: 0.3 });
    await eatCookie(ck);
  }
  await drinkMilk();
  W.greta.mode = 'cheer';
  W.hans.mode = 'cheer';
  sfx.boing();
  await line(W.greta, 'Danke, Sinterklaus!', 'Thank you, Sinterklaus!', { cls: 'yell', hold: 0.2 });

  // enter Merkel
  const M = W.merkel;
  const mx = camera.aspect < 1 ? 1.4 : 2.05;
  M.root.visible = true;
  M.root.position.set(6.5, 0, -0.85);
  M.root.rotation.y = -Math.PI / 2;
  M.mode = 'walk';
  W.greta.mode = 'idle';
  W.hans.mode = 'idle';
  W.greta.lookY = -0.9;
  W.hans.lookY = -0.5;
  subtitle('👀 Who is that?', 2);
  sfx.patter(18, 0.13);
  await tween(2.3, (k) => (M.root.position.x = lerp(6.5, mx, k)), ease.out);
  M.mode = 'idle';
  await tween(0.4, (k) => (M.root.rotation.y = lerp(-Math.PI / 2, -0.3, k)));
  M.mode = 'raute';
  sfx.fanfare();
  sfx.pop();
  confetti(V(0, 0, -0.5));
  W.greta.lookY = 0.6;
  W.hans.lookY = 0.5;
  await line(M, 'Vielen Dank, Herr Weihnachtsmann.', 'Thank you very much, Mr. Santa.', { cls: 'merkel', hold: 0.15 });
  await line(M, 'Sie haben die Cookies akzeptiert. <b>Wir schaffen das!</b>', 'You accepted the cookies. We can do this!', { cls: 'merkel', hold: 0.4 });
  W.greta.mode = 'cheer';
  W.hans.mode = 'cheer';
  W.greta.lookY = W.hans.lookY = 0;
  await line(W.hans, 'Frohe Weihnachten!', 'Merry Christmas!', { cls: 'yell', hold: 1.2 });
  finish('🍪 Cookies accepted. Frohe Weihnachten, Santa!');
}

function flipTable() {
  const p = W.pivot;
  for (const o of W.items) {
    W.root.attach(o);
    const isGlass = o.userData.isGlass;
    launch(
      o,
      V(rand(-1.6, 1.6), rand(3.2, 4.6), rand(2, 3.6)),
      V(rand(-14, 14), rand(-6, 6), rand(-14, 14)),
      isGlass ? (b) => { sfx.shatter(); milkSplash(b.obj.position, V(b.v.x * 0.4, 0.5, b.v.z * 0.4)); } : null,
    );
    if (isGlass) {
      const b = bodies[bodies.length - 1];
      setTimeout(() => milkSplash(o.position.clone(), b.v.clone().multiplyScalar(0.7)), 120);
    }
  }
  sfx.whoosh();
  return tween(0.85, (k) => {
    p.rotation.x = k * Math.PI;
    p.position.y = k * 0.8 + Math.sin(k * Math.PI) * 0.9;
    p.position.z = 0.6 + k * 0.45;
  }, ease.linear).then(() => { sfx.crash(); shake(1.2); });
}

async function reject() {
  if (!claim()) return;
  lockButtons(true);
  setConsent('rejected');
  stopMusic();
  sfx.thunder();
  sfx.chains();
  sfx.growl();
  fx.flash = 1;
  shake(0.6);
  stage.classList.add('krampus');
  $('#horns').classList.add('on');
  tween(0.7, (k) => (fx.krampus = k));
  subtitle('⛓️ *chains rattle*', 2);
  W.greta.mode = 'scared';
  W.hans.mode = 'scared';
  W.greta.lookY = W.hans.lookY = 0;
  await wait(0.5);
  await line(W.greta, 'NEIN!! Das ist nicht Sinterklaus!', "NO!! It's not Sinterklaus!", { cls: 'yell', hold: 0.05 });
  setTimeout(() => (fx.flash = 0.8), 300);
  await line(W.hans, 'Das ist KRAMPUS!!!', "It's KRAMPUS!!!", { cls: 'yell', hold: 0.05 });

  // Hans charges the table
  const H = W.hans;
  const hx = H.root.position.x;
  H.mode = 'run';
  sfx.patter(3, 0.1);
  await tween(0.3, (k) => {
    H.root.position.x = lerp(hx, -0.32, k);
    H.root.position.z = lerp(-1.2, -1.02, k);
    H.root.rotation.y = lerp(0.18, 0.1, k);
  });
  H.mode = 'lift';
  await wait(0.35);
  H.mode = 'heave';
  const flip = flipTable();
  await wait(0.25);
  const b = bubble(W.greta, 'AAAAAH!', 'AAAAAH!', 'yell');
  say('Aaaaaaah! Lauf!', 'greta');
  await flip;
  await wait(0.2);

  // run away
  const G2 = W.greta;
  H.mode = G2.mode = 'run';
  sfx.patter(14, 0.09);
  tween(0.15, (k) => { H.root.rotation.y = lerp(0.1, -Math.PI / 2, k); G2.root.rotation.y = lerp(-0.18, Math.PI / 2, k); });
  const hz = H.root.position.z, gx = G2.root.position.x;
  await tween(1.5, (k) => {
    H.root.position.x = lerp(-0.32, -8, k);
    H.root.position.z = lerp(hz, -0.4, k);
    G2.root.position.x = lerp(gx, 8, k);
    G2.root.position.z = lerp(-1.2, -0.5, k);
  }, ease.in);
  b.remove();
  await wait(1.2);
  subtitle('🌬️ …the children have fled.', 2.5);
  await wait(1.8);
  finish('👹 Cookies rejected. The children have fled.');
}

async function prefs() {
  if (busy) return;
  busy = true;
  const id = (chatter = Date.now());
  W.greta.mode = 'shrug';
  W.hans.mode = 'shrug';
  await line(W.greta, 'Einstellungen?', 'Preferences?', { hold: 0.1 });
  if (chatter !== id) return;
  await line(W.hans, 'Es gibt nur Kekse… oder Krampus.', 'There are only cookies… or Krampus.', { hold: 0.4 });
  if (chatter !== id) return;
  W.greta.mode = W.hans.mode = 'idle';
  busy = false;
  chatter = 0;
}

/* ------------------------------------------------------------------ consent + UI */
function setConsent(v) {
  document.cookie = `santa_consent=${v}; max-age=31536000; path=/; SameSite=Lax`;
  try { localStorage.setItem('santa_consent', v); } catch {}
}
function getConsent() {
  const m = document.cookie.match(/santa_consent=(\w+)/);
  if (m) return m[1];
  try { return localStorage.getItem('santa_consent'); } catch { return null; }
}
let rendering = true;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 4000);
}
let renderOff = 0;
let toastTimer = 0;
function finish(msg) {
  consentEl.classList.add('hidden');
  stopMusic();
  toast(msg);
  renderOff = setTimeout(() => { rendering = false; busy = false; }, 600);
}
function openBanner() {
  clearTimeout(renderOff);
  clearTimeout(toastTimer);
  $('#toast').classList.remove('on');
  $('#subtitle').classList.remove('on');
  stage.classList.remove('shake');
  resetWorld();
  rendering = true;
  consentEl.classList.remove('hidden');
  const card = $('.card');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
  lockButtons(false);
  if (A.unlocked) startMusic();
  setTimeout(() => intro(A.unlocked), 700);
}

function unlock(e) {
  if (A.unlocked) return;
  const ctx = ensureAudio();
  // iOS only unlocks Web Audio on touchend/click; keep trying until it's running
  if (ctx && ctx.state !== 'running') {
    ctx.resume().then(() => { if (ctx.state === 'running') unlock(e); }).catch(() => {});
    return;
  }
  A.unlocked = true;
  $('#tapHint').classList.add('gone');
  if (!consentEl.classList.contains('hidden')) startMusic();
  // first tap anywhere: replay the greeting with real voices
  if (e?.target?.closest?.('button')) return;
  const tryIntro = () => {
    if (introDone || consentEl.classList.contains('hidden')) return;
    if (busy) return setTimeout(tryIntro, 300);
    intro(true);
  };
  setTimeout(tryIntro, 50);
}
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });
window.addEventListener('touchend', unlock, { capture: true });
window.addEventListener('click', unlock, { capture: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && A.ctx?.state === 'suspended') A.ctx.resume(); });

$('#accept').addEventListener('click', accept);
$('#reject').addEventListener('click', reject);
$('#prefs').addEventListener('click', prefs);
$('#replay').addEventListener('click', () => { if (!busy) openBanner(); });
$('#mute').addEventListener('click', (e) => {
  A.muted = !A.muted;
  e.currentTarget.textContent = A.muted ? '🔇' : '🔊';
  if (A.master) A.master.gain.value = A.muted ? 0 : 0.9;
  if (A.muted) synth?.cancel();
});

/* ------------------------------------------------------------------ main loop */
const clock = new G.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!rendering) return;
  time += dt;
  updateTweens(dt);
  for (const c of W.chars) updateChar(c, dt);
  updateBodies(dt);
  updateParticles(dt);
  updateEnv(dt);
  for (const b of bubbles) positionBubble(b);
  renderer.render(scene, camera);
}

resetWorld();
resize();
frame();

const auto = params.get('auto');
if (auto) {
  setTimeout(() => ({ accept, reject, prefs })[auto]?.(), 400);
} else if (getConsent() && !params.has('fresh')) {
  consentEl.classList.add('hidden');
  rendering = false;
  toast(`Your cookie choice: ${getConsent()}. Tap “Replay banner” to see it again.`);
} else {
  setTimeout(() => intro(false), 900);
}
