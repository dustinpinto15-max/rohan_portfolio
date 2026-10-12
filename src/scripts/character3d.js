// ============================================================================
// Hero character: a real head turn, drawn with WebGL.
//
// The picture is split into three layers (see public/character/):
//   body.webp  the desk scene, without the head and the neck
//   neck.webp  the neck, drawn under the body so it can twist with the head
//   head.webp  the head, smiling; head-depth.png gives it real depth (nose near, ears far)
//   head-calm.webp  the same head with a calm, closed mouth (his face while he works)
//   head-oo.webp, head-ah.webp  two talking mouths, used for lip sync with the speech bubble
//
// The head is a 3D relief that rotates around the neck, so the nose, glasses
// and ears move at different speeds, the way a real head turns.
//
// Two moods:
//   follow  the mouse moved lately: head and eyes look at the mouse circle.
//           First a small "oh!", then a smile. He smiles while the circle is near him.
//   talk    when a speech bubble line types out, his mouth moves with the words (lip sync).
//   work    the mouse is still: calm face, eyes on the laptop, fingers typing one by one.
//           Now and then he looks up and says the next speech bubble line.
// ============================================================================
import {
  WebGLRenderer, Scene, Camera, Mesh, BufferGeometry, BufferAttribute, ShaderMaterial,
  TextureLoader, LinearFilter, Vector2, Vector3, Vector4,
} from 'three';

// Size of the picture and where things are in it (pixels of the picture)
const W = 1850, H = 1510;
const HEAD = { x: 790, y: 0, w: 430, h: 480 };
const NECK = { x: 930, y: 330, w: 210, h: 220 };
const PIVOT = { x: 1012, y: 428 };          // where the head sits on the neck
const HEAD_CENTER = { x: 1008, y: 262 };    // between the eyes: this point "looks" at the mouse
const VIEW = { x: -0.05 * W, y: -0.09 * H, w: 1.10 * W, h: 1.12 * H }; // canvas is a bit bigger than the picture

const MAX_YAW = 0.36;    // left / right, in radians (about 20 degrees)
const MAX_PITCH_UP = 0.2;
const MAX_PITCH_DOWN = 0.26;
const IDLE_AFTER = 2200; // ms without mouse movement before he goes back to work

const COMMON = /* glsl */ `
  uniform vec4 uView;
  uniform vec2 uTilt;
  uniform float uBreath;
  vec4 place(vec2 p) {
    return vec4((p.x - uView.x) / uView.z * 2.0 - 1.0, 1.0 - (p.y - uView.y) / uView.w * 2.0, 0.0, 1.0);
  }
  float chest(vec2 p) {
    vec2 c = (p - vec2(1035.0, 640.0)) / vec2(240.0, 200.0);
    return exp(-dot(c, c));
  }
`;

function grid(box, nx, ny) {
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
  const uv = new Float32Array((nx + 1) * (ny + 1) * 2);
  let k = 0, u = 0;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    pos[k++] = box.x + (i / nx) * box.w; pos[k++] = box.y + (j / ny) * box.h; pos[k++] = 0;
    uv[u++] = i / nx; uv[u++] = j / ny;
  }
  const idx = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A soft spring: smooth start, smooth stop, no jumps
class Spring {
  constructor(value = 0, stiffness = 40, damping = 1) { this.x = value; this.v = 0; this.t = value; this.k = stiffness; this.z = damping; }
  step(dt) {
    const c = 2 * Math.sqrt(this.k) * this.z;
    // Small fixed steps keep it stable on slow frames
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 120);
      this.v += (this.k * (this.t - this.x) - c * this.v) * h;
      this.x += this.v * h;
      left -= h;
    }
    return this.x;
  }
}

const loadTex = (loader, url, { mip = true } = {}) => new Promise((res, rej) => {
  loader.load(url, (t) => {
    t.flipY = false;
    t.premultiplyAlpha = true;
    t.generateMipmaps = mip;
    if (!mip) t.minFilter = LinearFilter;
    t.anisotropy = 4;
    t.needsUpdate = true;
    res(t);
  }, undefined, rej);
});

// One mouth shape for every letter of a line: 0 calm (closed), 1 "oo", 2 "ah", 3 smile (teeth).
// Each word is cut into sound groups. The vowel picks the shape; m, b and p close the lips.
function mouthShapes(text) {
  const chars = Array.from(text);
  const out = new Array(chars.length).fill(0);
  let i = 0;
  while (i < chars.length) {
    if (!/[a-z]/i.test(chars[i])) { i++; continue; }           // spaces, marks and emoji: mouth closed
    let j = i, vowel = '';
    while (j < chars.length && /[a-z]/i.test(chars[j]) && !/[aeiouy]/i.test(chars[j])) j++;   // leading consonants
    while (j < chars.length && /[aeiouy]/i.test(chars[j])) { vowel = vowel || chars[j].toLowerCase(); j++; }
    // one closing consonant, if a new sound group does not start right after it
    if (j < chars.length && /[a-z]/i.test(chars[j]) && !(j + 1 < chars.length && /[aeiouy]/i.test(chars[j + 1]))) j++;
    const shape = 'ou'.includes(vowel) && vowel ? 1 : 'aei'.includes(vowel) && vowel ? 2 : 3;
    for (let k = i; k < j; k++) out[k] = shape;
    if (/[mbp]/i.test(chars[i])) out[i] = 0;
    if (j - i > 2 && /[mbpfv]/i.test(chars[j - 1])) out[j - 1] = 0;
    i = Math.max(j, i + 1);
  }
  return out;
}

export async function initCharacter3D({ stage, canvas, base = '/character/', touch = false, onSpeak = null }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const loader = new TextureLoader();
  const [tBody, tNeck, tHead, tHeadCalm, tHeadOo, tHeadAh, tHeadDepth, tData] = await Promise.all([
    loadTex(loader, base + 'body.webp'),
    loadTex(loader, base + 'neck.webp'),
    loadTex(loader, base + 'head.webp'),
    loadTex(loader, base + 'head-calm.webp'),
    loadTex(loader, base + 'head-oo.webp'),
    loadTex(loader, base + 'head-ah.webp'),
    loadTex(loader, base + 'head-depth.png', { mip: false }),
    loadTex(loader, base + 'body-data.png', { mip: false }),
  ]);

  const shared = {
    uView: { value: new Vector4(VIEW.x, VIEW.y, VIEW.w, VIEW.h) },
    uTilt: { value: new Vector2() },
    uBreath: { value: 0 },
  };
  const scene = new Scene();
  const camera = new Camera();
  const matOpts = { transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false };

  // ---- Neck: leans and twists with the head, fixed at the collar
  const uNeck = { value: new Vector2() };
  const neck = new Mesh(grid(NECK, 8, 14), new ShaderMaterial({
    ...matOpts,
    uniforms: { ...shared, uMap: { value: tNeck }, uNeck },
    vertexShader: /* glsl */ `
      ${COMMON}
      uniform vec2 uNeck;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec2 p = position.xy;
        float k = smoothstep(516.0, 420.0, p.y);
        p += uNeck * k * k;
        p.y -= uBreath * chest(position.xy);
        gl_Position = place(p);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; varying vec2 vUv;
      void main() { gl_FragColor = texture2D(uMap, vUv); }`,
  }));

  // ---- Body: the desk scene, with soft depth, breathing and a typing hand
  const uHand = { value: new Vector2() };
  const uFing = { value: new Vector3() };
  const body = new Mesh(grid({ x: 0, y: 0, w: W, h: H }, 56, 46), new ShaderMaterial({
    ...matOpts,
    uniforms: { ...shared, uMap: { value: tBody }, uData: { value: tData }, uHand, uFing },
    vertexShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D uData;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec2 p = position.xy;
        float z = texture2D(uData, uv).r;
        p += uTilt * (z - 0.45);
        p.y -= uBreath * chest(position.xy);
        gl_Position = place(p);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform sampler2D uData;
      uniform vec2 uHand;   // the whole hand slides a little over the keys
      uniform vec3 uFing;   // how far each of the three fingers is lifted, in pixels
      varying vec2 vUv;
      const vec2 SIZE = vec2(${W}.0, ${H}.0);
      // 0 at the knuckle, 1 at the fingertip, and only close to that finger
      float finger(vec2 p, vec2 a, vec2 b) {
        vec2 ab = b - a;
        float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.2);
        float d = length(p - (a + ab * t));
        return smoothstep(0.0, 1.0, min(t, 1.0)) * (1.0 - smoothstep(8.0, 20.0, d));
      }
      void main() {
        vec2 p = vUv * SIZE;
        float w = texture2D(uData, vUv).g;
        float lift = uFing.x * finger(p, vec2(852.0, 738.0), vec2(807.0, 782.0))
                   + uFing.y * finger(p, vec2(888.0, 748.0), vec2(830.0, 802.0))
                   + uFing.z * finger(p, vec2(918.0, 762.0), vec2(860.0, 804.0));
        vec2 move = vec2(0.3, -1.0) * lift + uHand * smoothstep(1004.0, 900.0, p.x);
        p -= move * w;
        gl_FragColor = texture2D(uMap, p / SIZE);
      }`,
  }));

  // ---- Head: a relief that really rotates
  const uRot = { value: new Vector3() };
  const uOff = { value: new Vector2() };
  const uGaze = { value: new Vector2() };
  const uLid = { value: 0 };
  const uMouth = { value: new Vector4(1, 0, 0, 0) };   // how much of each mouth: calm, oo, ah, smile
  const uBrow = { value: 0 };
  const head = new Mesh(grid(HEAD, 64, 72), new ShaderMaterial({
    ...matOpts,
    uniforms: { ...shared, uMap: { value: tHead }, uCalm: { value: tHeadCalm }, uOo: { value: tHeadOo }, uAh: { value: tHeadAh }, uDepth: { value: tHeadDepth }, uRot, uOff, uGaze, uLid, uMouth, uBrow },
    vertexShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D uDepth;
      uniform vec3 uRot;   // x = left/right, y = up/down, z = tilt
      uniform vec2 uOff;
      varying vec2 vUv;
      varying float vShade;
      const vec2 PIVOT = vec2(${PIVOT.x}.0, ${PIVOT.y}.0);
      void main() {
        vUv = uv;
        float z = texture2D(uDepth, uv).r * 205.0 - 48.0;   // nose is near, ears and hair are far
        vec3 p = vec3(position.xy - PIVOT, z);
        float cy = cos(uRot.x), sy = sin(uRot.x);
        p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
        float cp = cos(uRot.y), sp = sin(uRot.y);
        p = vec3(p.x, p.y * cp + p.z * sp, -p.y * sp + p.z * cp);
        float cr = cos(uRot.z), sr = sin(uRot.z);
        p.xy = vec2(p.x * cr - p.y * sr, p.x * sr + p.y * cr);
        float persp = 1.0 + p.z * 0.0006;
        vec2 o = PIVOT + p.xy * persp + uOff;
        o.y -= uBreath * 0.5;
        // The side that turns away gets a little darker
        vShade = 1.0 - 0.5 * uRot.x * (uv.x - 0.5) - 0.3 * uRot.y * (uv.y - 0.45);
        gl_Position = place(o);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec2 uGaze;   // where the pupils sit, in pixels
      uniform float uLid;   // 0 = open, 1 = closed
      uniform sampler2D uCalm; uniform sampler2D uOo; uniform sampler2D uAh;
      uniform vec4 uMouth;  // mix of the four mouths: calm, oo, ah, smile
      uniform float uBrow;  // 1 = eyebrows raised
      varying vec2 vUv;
      varying float vShade;
      const vec2 SIZE = vec2(${HEAD.w}.0, ${HEAD.h}.0);

      vec3 eye(vec3 base, vec2 p, vec2 c, vec2 r, out float m) {
        vec2 e = (p - c) / r;
        float d = length(e);
        m = 1.0 - smoothstep(0.95, 1.06, d);
        vec3 col = vec3(0.985, 0.975, 0.965);
        col *= 1.0 - 0.2 * smoothstep(0.1, -1.0, e.y);                    // shadow from the upper lid
        col = mix(col, vec3(0.20, 0.09, 0.06), smoothstep(0.9, 1.02, d) * 0.85);
        // Pupil
        vec2 pe = (p - c - uGaze) / vec2(16.6, 18.2);
        float pd = length(pe);
        vec3 pc = mix(vec3(0.035, 0.025, 0.025), vec3(0.33, 0.17, 0.09), smoothstep(0.5, 1.0, pd) * 0.85);
        float h1 = 1.0 - smoothstep(0.20, 0.31, length(pe - vec2(-0.34, -0.42)));
        float h2 = 1.0 - smoothstep(0.07, 0.14, length(pe - vec2(0.38, 0.36)));
        pc = mix(pc, vec3(1.0), max(h1, h2 * 0.75));
        col = mix(col, pc, 1.0 - smoothstep(0.92, 1.06, pd));
        // Eyelid
        float ly = mix(-1.25, 1.12, uLid);
        float lid = 1.0 - smoothstep(ly - 0.07, ly + 0.07, e.y);
        vec3 skin = mix(vec3(0.90, 0.52, 0.32), vec3(0.97, 0.63, 0.40), smoothstep(-1.0, 1.0, e.y));
        vec3 lidc = mix(skin, vec3(0.17, 0.08, 0.05), smoothstep(ly - 0.2, ly - 0.02, e.y) * step(0.03, uLid));
        col = mix(col, lidc, lid);
        return mix(base, col, m);
      }

      void main() {
        vec2 p = vUv * SIZE;
        // Raise the eyebrows a little: sample the picture from slightly lower
        vec2 bl = (p - vec2(150.0, 224.0)) / vec2(50.0, 13.0), br = (p - vec2(275.0, 210.0)) / vec2(50.0, 13.0);
        vec2 uv = vUv + vec2(0.0, uBrow * 3.6 * (exp(-dot(bl, bl)) + exp(-dot(br, br))) / SIZE.y);
        vec4 t = texture2D(uCalm, uv) * uMouth.x + texture2D(uOo, uv) * uMouth.y + texture2D(uAh, uv) * uMouth.z + texture2D(uMap, uv) * uMouth.w;
        float m1, m2;
        vec3 col = t.rgb;
        col = eye(col, p, vec2(160.5, 274.0), vec2(22.4, 23.4), m1);
        col = eye(col, p, vec2(270.5, 264.7), vec2(21.6, 23.6), m2);
        gl_FragColor = vec4(col * vShade, t.a);
      }`,
  }));

  [neck, body, head].forEach((m, i) => { m.frustumCulled = false; m.renderOrder = i; scene.add(m); });

  // ---------------------------------------------------------------- motion
  const yaw = new Spring(0, 46, 0.86), pitch = new Spring(0, 46, 0.86), roll = new Spring(0, 30, 0.9);
  const gx = new Spring(0, 190, 0.9), gy = new Spring(0, 190, 0.9);
  const lidBase = new Spring(0, 60, 1);
  const type = new Spring(0, 22, 1);
  const brow = new Spring(0, 90, 0.8);
  const mouth = [1, 0, 0, 0];                 // calm, oo, ah, smile
  let speech = null;                          // { shapes: one mouth per letter, t0, per, end, ask }
  const fingers = [0, 1, 2].map(() => new Spring(0, 1100, 0.62));
  const strokes = [-1e9, -1e9, -1e9];
  const drift = new Spring(0, 26, 1);
  let nextKey = 0, lastFinger = -1;
  let greetAt = -1e9, happyUntil = 0, near = false, lastSpoke = performance.now() - 2500;
  const say = (now) => { lastSpoke = now; if (onSpeak) onSpeak(); };
  const tiltX = new Spring(0, 14, 1), tiltY = new Spring(0, 14, 1);

  let px = 0, py = 0, hasPointer = false, lastMove = -1e9;
  let nodAt = -1e9;
  let blinkAt = performance.now() + 1800, blinkEnd = 0;
  let glanceAt = performance.now() + 5200, glanceEnd = 0;
  let workSince = performance.now();
  let wasWork = true;
  let time = 0, prev = performance.now(), running = false, visible = true;

  const look = (x, y) => { px = x; py = y; hasPointer = true; lastMove = performance.now(); };
  if (!touch) {
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') look(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener('pointerleave', () => { lastMove = performance.now() - IDLE_AFTER + 500; });
  }
  const onTouch = (e) => { const t = e.touches[0]; if (t) look(t.clientX, t.clientY); };
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });

  const soft = (v) => Math.tanh(v * 1.25);
  let rect = stage.getBoundingClientRect();

  function size() {
    rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(rect.width * (VIEW.w / W))), h = Math.max(2, Math.round(rect.height * (VIEW.h / H)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
  }

  function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now; time += dt;
    rect = stage.getBoundingClientRect();

    const work = !hasPointer || now - lastMove > IDLE_AFTER;
    if (work && !wasWork) { workSince = now; glanceAt = now + 3800 + Math.random() * 2500; }
    if (!work && wasWork) greetAt = now;                      // he notices you: "oh!", then a smile
    wasWork = work;

    let lidT = 0;
    if (!work) {
      // Look at the mouse circle
      const hx = rect.left + (HEAD_CENTER.x / W) * rect.width;
      const hy = rect.top + (HEAD_CENTER.y / H) * rect.height;
      const dx = (px - hx) / Math.max(360, window.innerWidth * 0.46);
      const dy = (py - hy) / Math.max(300, window.innerHeight * 0.5);
      const sx = soft(dx), sy = soft(dy);
      yaw.t = sx * MAX_YAW;
      pitch.t = sy * (sy > 0 ? MAX_PITCH_DOWN : MAX_PITCH_UP);
      roll.t = sx * 0.07 * (1 - Math.abs(sy) * 0.4);
      // The eyes go first and go further than the head
      gx.t = soft(dx * 2.6) * 6.2;
      gy.t = soft(dy * 2.6) * 5.2;
      lidT = Math.max(0, sy) * 0.16;
      type.t = 0;
      // Close to him = a happy face (a little slack so it does not flicker at the edge)
      const dist = Math.hypot(px - hx, py - hy), reach = Math.max(230, rect.width * 0.32);
      near = dist < reach * (near ? 1.2 : 1);
      // While you keep moving the mouse, he says a new line every few seconds
      if (now - lastSpoke > 6500 && !speech) say(now);
    } else {
      // Back to work: eyes on the laptop, hands typing
      const glancing = now < glanceEnd;
      if (!glancing && now > glanceAt) {
        glanceEnd = now + 1900; glanceAt = now + 7500 + Math.random() * 4000; blinkAt = now + 120;
        setTimeout(() => say(performance.now()), 380);       // he looks up first, then speaks
      }
      near = false;
      if (glancing) {
        yaw.t = 0.02; pitch.t = -0.02; roll.t = 0.03;
        gx.t = 0; gy.t = 0; lidT = 0;
      } else {
        const read = Math.sin(time * 0.9);                      // eyes move along a line of text
        yaw.t = -0.2 + read * 0.022;
        pitch.t = 0.25 + Math.sin(time * 0.53) * 0.012;
        roll.t = -0.035 + Math.sin(time * 0.37) * 0.012;
        gx.t = -3.4 + read * 1.5;
        gy.t = 5;
        lidT = 0.3;
      }
      type.t = now - workSince > 420 && !glancing ? 1 : 0;
    }

    // Blink
    if (now > blinkAt) { blinkEnd = now + 170; blinkAt = now + 2400 + Math.random() * 3400; }
    const b = blinkEnd > now ? Math.sin(((170 - (blinkEnd - now)) / 170) * Math.PI) : 0;

    // ---- Face
    // Work: calm. He notices you: a short "oh!" with raised eyebrows, then a smile.
    // Mouse circle near him: smile. Speaking: the mouth follows the letters being typed.
    const glanceNow = work && now < glanceEnd;
    const sinceGreet = now - greetAt;
    let shape = 0, rate = 11, browT = 0, tiltT = 0;
    if (speech) {
      const i = Math.floor((now - speech.t0) / speech.per);
      if (i < speech.shapes.length) {
        shape = speech.shapes[Math.max(0, i)]; rate = 30; browT = 0.45;
        if (speech.ask && i > speech.shapes.length - 9) { browT = 1; tiltT = 0.05; }   // a question: eyebrows up, head tilts
        if (work) glanceEnd = Math.max(glanceEnd, speech.end + 500);                    // he keeps looking at you while he speaks
      } else {
        happyUntil = now + 1400; lastSpoke = now; speech = null;
      }
    }
    if (!speech) {
      if (!work && sinceGreet < 330) { shape = 1; rate = 26; browT = 1; }
      else if ((!work && (near || sinceGreet < 1900)) || now < happyUntil || glanceNow) { shape = 3; browT = sinceGreet < 900 ? 0.8 : 0.3; }
    }
    const mk = 1 - Math.exp(-dt * rate);
    let sum = 0;
    for (let i = 0; i < 4; i++) { mouth[i] += ((i === shape ? 1 : 0) - mouth[i]) * mk; sum += mouth[i]; }
    uMouth.value.set(mouth[0] / sum, mouth[1] / sum, mouth[2] / sum, mouth[3] / sum);
    brow.t = browT;
    if (tiltT) roll.t += tiltT;
    if (shape === 3 && !speech) lidT = Math.max(lidT, 0.1);     // eyes narrow a little in a real smile
    lidBase.t = lidT;

    // A quick nod when he is clicked
    const nt = (now - nodAt) / 620;
    const nod = nt >= 0 && nt < 1 ? Math.sin(nt * Math.PI * 2) * (1 - nt) * 0.16 : 0;

    const y = yaw.step(dt), p = pitch.step(dt), r = roll.step(dt);
    const ty = type.step(dt);
    const breath = Math.sin(time * 1.55);
    uRot.value.set(y, p + nod + breath * 0.004, r);
    uNeck.value.set(y * 34 + r * -30, p * 5);
    uOff.value.set(y * 30 + r * -26, p * 5);
    uGaze.value.set(gx.step(dt), gy.step(dt));
    uLid.value = Math.max(lidBase.step(dt), b);
    uBrow.value = brow.step(dt);
    shared.uBreath.value = 2.2 + breath * 2.2;

    // Typing: one finger at a time. It lifts, hits the key, and comes back to rest.
    // Keys come in short bursts with small pauses, like real typing.
    const typing = ty > 0.6;
    if (typing && now >= nextKey) {
      let f = Math.floor(Math.random() * 3);
      if (f === lastFinger) f = (f + 1 + Math.floor(Math.random() * 2)) % 3;
      lastFinger = f; strokes[f] = now;
      drift.t = (Math.random() * 2 - 1) * 3.2;
      nextKey = now + 95 + Math.random() * 115 + (Math.random() < 0.13 ? 380 + Math.random() * 700 : 0);
    }
    for (let i = 0; i < 3; i++) {
      const age = now - strokes[i];
      fingers[i].t = !typing ? 0 : age < 75 ? 1 : age < 150 ? -0.28 : 0.2;
      fingers[i].step(dt);
    }
    if (!typing) drift.t = 0;
    uFing.value.set(fingers[0].x * 11 * ty, fingers[1].x * 11 * ty, fingers[2].x * 11 * ty);
    uHand.value.set(drift.step(dt), 0);

    // The whole scene leans a little with the mouse (near things move more)
    if (hasPointer) {
      tiltX.t = -((px - (rect.left + rect.width / 2)) / window.innerWidth) * 46;
      tiltY.t = -((py - (rect.top + rect.height / 2)) / window.innerHeight) * 26;
    }
    shared.uTilt.value.set(tiltX.step(dt), tiltY.step(dt));

    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  }

  const start = () => { if (running) return; running = true; prev = performance.now(); requestAnimationFrame(frame); };
  const stop = () => { running = false; };
  const check = () => (visible && !document.hidden ? start() : stop());

  size();
  new ResizeObserver(size).observe(stage);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; check(); }, { rootMargin: '80px' }).observe(stage);
  document.addEventListener('visibilitychange', check);

  // Draw one frame before showing the canvas, so there is no flash
  prev = performance.now();
  frame(prev);
  check();

  return {
    nod() { nodAt = performance.now(); blinkAt = nodAt + 80; },
    // He says a line. `per` is the time per letter, the same speed the bubble types at,
    // so the mouth and the text stay together.
    speak(text, per = 58) {
      const n = performance.now();
      const shapes = mouthShapes(text);
      speech = { shapes, per, t0: n, end: n + shapes.length * per, ask: /\?\s*\S{0,3}$/.test(text) };
      lastSpoke = n;
    },
    // For testing: hold a pose
    _pose(yawV, pitchV) { yaw.x = yaw.t = yawV; pitch.x = pitch.t = pitchV; },
  };
}
