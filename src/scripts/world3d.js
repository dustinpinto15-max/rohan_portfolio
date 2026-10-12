// ============================================================================
// The 3D world: one fixed WebGL scene behind the whole site.
//
// Each section shows one glossy 3D object that tells a growth marketing story.
// A section picks its object with data attributes, for example:
//   <section data-shape="target" data-side="left" data-scale=".9" data-opacity=".5">
//
// Objects:  chart      rising bars with a growth arrow (hero)
//           megaphone  reach and awareness (clients)
//           rocket     scaling up (experience)
//           target     an arrow in the bullseye (case studies)
//           funnel     leads go in, revenue comes out (skills)
//           plane      a paper plane, "send a message" (contact)
//
// The scene is kept calm on purpose, so the words on the page stay the focus:
// small objects, slow motion, and they fade back while you read.
// Mouse: the object leans a little toward the mouse circle and grows when the
// circle is on it. Click it and it spins once.
// Scroll: the object hands over to the next one. (To make it livelier, raise CALM.)
// ============================================================================
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BufferGeometry, BufferAttribute,
  MeshPhysicalMaterial, MeshBasicMaterial, ShaderMaterial, AmbientLight, PointLight, DirectionalLight,
  PMREMGenerator, MathUtils, Vector3, Vector2, Color, DoubleSide, ACESFilmicToneMapping,
  BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry, LatheGeometry, TubeGeometry,
  OctahedronGeometry, PlaneGeometry, ExtrudeGeometry, Shape, CatmullRomCurve3, Quaternion,
  CustomBlending, AddEquation, ZeroFactor, SrcAlphaFactor,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const NAMES = ['chart', 'megaphone', 'rocket', 'target', 'funnel', 'plane'];
// Old names from earlier versions still work
const ALIAS = { gem: 'chart', ring: 'megaphone', helix: 'rocket', bars: 'chart' };
const TAU = Math.PI * 2;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const UP = new Vector3(0, 1, 0);
// 0 = very still, 1 = lively. Scales idle motion, scroll spin and how much the mouse pulls.
const CALM = 0.35;

/* ------------------------------------------------------------------------ */
/* Materials: red, a neutral that swaps with the theme, chrome, gold        */
/* ------------------------------------------------------------------------ */
function makeMaterials() {
  const phys = (o) => new MeshPhysicalMaterial({ envMapIntensity: 1.15, ...o });
  return {
    red: phys({ color: 0xf5232e, roughness: 0.22, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x8a0008, emissiveIntensity: 0.18, side: DoubleSide }),
    neutral: phys({ color: 0xf3f4f7, roughness: 0.3, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2, side: DoubleSide }),
    deep: phys({ color: 0x3a3e4a, roughness: 0.35, metalness: 0.55, clearcoat: 0.6, side: DoubleSide }),
    chrome: phys({ color: 0xdfe3ea, roughness: 0.12, metalness: 1, envMapIntensity: 1.5 }),
    gold: phys({ color: 0xffc457, roughness: 0.22, metalness: 1, envMapIntensity: 1.4, emissive: 0x6b3a00, emissiveIntensity: 0.25 }),
    glass: phys({ color: 0x1b2233, roughness: 0.05, metalness: 0.9, clearcoat: 1, envMapIntensity: 1.8 }),
    paper: phys({ color: 0xffffff, roughness: 0.55, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.32, side: DoubleSide }),
    flame: new MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.95 }),
    flameCore: new MeshBasicMaterial({ color: 0xfff1c9 }),
  };
}

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); return m; };

function coin(M, r = 0.2) {
  const g = new Group();
  const disc = mesh(new CylinderGeometry(r, r, r * 0.22, 40), M.gold);
  disc.rotation.x = Math.PI / 2;
  const rim = mesh(new TorusGeometry(r * 0.72, r * 0.07, 10, 40), M.gold, 0, 0, r * 0.11);
  const rim2 = rim.clone(); rim2.position.z = -r * 0.11;
  g.add(disc, rim, rim2);
  return g;
}

/* ------------------------------------------------------------------------ */
/* Objects. Each returns { group, update(t), radius }                        */
/* ------------------------------------------------------------------------ */
function buildChart(M) {
  const g = new Group();
  g.add(mesh(new RoundedBoxGeometry(3.5, 0.16, 1.5, 4, 0.08), M.deep, 0, -1.45, 0));
  const heights = [0.75, 1.25, 1.85, 2.6];
  const bars = heights.map((h, i) => {
    const pivot = new Group();
    pivot.position.set(-1.2 + i * 0.8, -1.37, 0);
    pivot.add(mesh(new RoundedBoxGeometry(0.52, h, 0.52, 4, 0.1), i === 3 ? M.red : M.neutral, 0, h / 2, 0));
    g.add(pivot);
    return pivot;
  });
  // Growth arrow in front of the bars
  const pts = [[-1.75, -0.75], [-1.05, -0.05], [-0.4, -0.3], [0.45, 0.75], [1.45, 1.75]].map(([x, y]) => new Vector3(x, y, 0.55));
  const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  g.add(mesh(new TubeGeometry(curve, 64, 0.075, 12), M.red));
  const head = mesh(new ConeGeometry(0.21, 0.5, 24), M.red);
  const end = curve.getPoint(1), dir = curve.getTangent(1).normalize();
  head.position.copy(end).addScaledVector(dir, 0.2);
  head.quaternion.setFromUnitVectors(UP, dir);
  g.add(head);
  g.add(mesh(new SphereGeometry(0.13, 20, 16), M.chrome, pts[0].x, pts[0].y, pts[0].z));
  const coins = [coin(M, 0.24), coin(M, 0.17)];
  coins[0].position.set(-1.25, 1.2, 0.2); coins[1].position.set(-0.45, 1.75, -0.3);
  g.add(...coins);
  return {
    group: g, radius: 2.1,
    update(t) {
      bars.forEach((b, i) => { b.scale.y = 1 + 0.05 * Math.sin(t * 1.4 + i * 0.9); });
      coins.forEach((c, i) => { c.rotation.y = t * (1.1 + i * 0.5); c.position.y += Math.sin(t * 1.3 + i * 2) * 0.0015; });
    },
  };
}

function buildMegaphone(M) {
  const g = new Group();
  const horn = new Group();
  const cone = mesh(new CylinderGeometry(1.1, 0.34, 1.9, 56, 1, true), M.red);
  cone.rotation.z = -Math.PI / 2;
  const rim = mesh(new TorusGeometry(1.1, 0.075, 14, 56), M.neutral, 0.95, 0, 0);
  rim.rotation.y = Math.PI / 2;
  const inner = mesh(new CylinderGeometry(0.34, 0.34, 0.02, 32), M.deep, -0.9, 0, 0);
  inner.rotation.z = Math.PI / 2;
  const body = mesh(new CylinderGeometry(0.36, 0.36, 0.62, 40), M.neutral, -1.22, 0, 0);
  body.rotation.z = Math.PI / 2;
  const cap = mesh(new SphereGeometry(0.36, 32, 16, 0, TAU, 0, Math.PI / 2), M.neutral, -1.53, 0, 0);
  cap.rotation.z = Math.PI / 2; cap.scale.y = 0.5;
  const band = mesh(new TorusGeometry(0.37, 0.05, 10, 40), M.chrome, -0.93, 0, 0);
  band.rotation.y = Math.PI / 2;
  const handle = mesh(new RoundedBoxGeometry(0.26, 0.95, 0.3, 4, 0.1), M.deep, -1.15, -0.72, 0);
  handle.rotation.z = 0.22;
  horn.add(cone, rim, inner, body, cap, band, handle);
  // Sound waves
  const waves = [0, 1, 2].map((i) => {
    const mat = M.neutral.clone(); mat.transparent = true;
    const arc = 1.5;
    const w = mesh(new TorusGeometry(0.75 + i * 0.42, 0.055, 10, 40, arc), mat);
    w.rotation.z = -arc / 2;
    w.userData.mat = mat;
    horn.add(w);
    return w;
  });
  horn.rotation.z = 0.38;
  horn.position.x = -0.35;
  g.add(horn);
  g.scale.setScalar(0.82);
  return {
    group: g, radius: 2.2, mats: waves.map((w) => w.userData.mat),
    update(t) {
      waves.forEach((w, i) => {
        const k = (t * 0.55 + i / 3) % 1;
        w.position.x = 0.75 + k * 1.15;
        w.scale.setScalar(0.75 + k * 0.6);
        w.userData.mat.opacity = Math.sin(k * Math.PI);
      });
      horn.rotation.z = 0.38 + Math.sin(t * 1.1) * 0.035;
    },
  };
}

function buildRocket(M) {
  const g = new Group();
  const r = new Group();
  const prof = [[0, -1.25], [0.4, -1.25], [0.56, -0.7], [0.6, 0.0], [0.54, 0.6], [0.44, 0.95]].map(([x, y]) => new Vector2(x, y));
  r.add(mesh(new LatheGeometry(prof, 48), M.neutral));
  const nose = [[0.44, 0.95], [0.34, 1.3], [0.2, 1.6], [0.08, 1.78], [0, 1.82]].map(([x, y]) => new Vector2(x, y));
  r.add(mesh(new LatheGeometry(nose, 48), M.red));
  r.add(mesh(new TorusGeometry(0.445, 0.035, 10, 48), M.chrome, 0, 0.95, 0).rotateX(Math.PI / 2));
  // Window
  const ring = mesh(new TorusGeometry(0.21, 0.05, 12, 36), M.chrome, 0, 0.3, 0.56);
  const pane = mesh(new SphereGeometry(0.19, 24, 16), M.glass, 0, 0.3, 0.5); pane.scale.z = 0.45;
  r.add(ring, pane);
  // Fins
  const s = new Shape(); s.moveTo(0, 0); s.lineTo(0.62, -0.55); s.lineTo(0.62, -0.95); s.lineTo(0, -0.62); s.closePath();
  const finGeo = new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
  finGeo.translate(0, 0, -0.04);
  for (let i = 0; i < 3; i++) {
    const p = new Group(); p.rotation.y = (i / 3) * TAU + 0.5;
    p.add(mesh(finGeo, M.red, 0.5, -0.45, 0));
    r.add(p);
  }
  r.add(mesh(new CylinderGeometry(0.3, 0.4, 0.28, 32), M.deep, 0, -1.37, 0));
  const flame = mesh(new ConeGeometry(0.3, 1.1, 24), M.flame, 0, -2.0, 0); flame.rotation.x = Math.PI;
  const core = mesh(new ConeGeometry(0.15, 0.6, 20), M.flameCore, 0, -1.78, 0); core.rotation.x = Math.PI;
  r.add(flame, core);
  r.rotation.z = -0.55;
  r.position.set(0.25, 0.2, 0);
  g.add(r);
  // Smoke puffs behind the rocket
  const puffs = [0, 1, 2, 3].map((i) => { const p = mesh(new SphereGeometry(0.2, 18, 14), M.neutral); g.add(p); return p; });
  const back = new Vector3(Math.sin(-0.55), -Math.cos(-0.55), 0);
  return {
    group: g, radius: 2.3,
    update(t) {
      const f = 0.85 + Math.sin(t * 23) * 0.1 + Math.sin(t * 37) * 0.06;
      flame.scale.set(1, f, 1); flame.position.y = -1.45 - 0.55 * f;
      core.scale.y = 0.9 + Math.sin(t * 31) * 0.12;
      r.position.y = 0.2 + Math.sin(t * 1.2) * 0.08;
      r.position.x = 0.25 + Math.sin(t * 0.9) * 0.04;
      puffs.forEach((p, i) => {
        const k = (t * 0.7 + i / 4) % 1;
        p.position.copy(r.position).addScaledVector(back, 2.45 + k * 1.2);
        p.position.x += Math.sin(i * 2.4 + k * 4) * 0.18 * k;
        p.scale.setScalar((0.35 + k * 0.9) * (1 - k * k));
      });
    },
  };
}

function buildTarget(M) {
  const g = new Group();
  const board = new Group();
  const rings = [[1.65, M.red], [1.3, M.neutral], [0.95, M.red], [0.6, M.neutral], [0.26, M.red]];
  rings.forEach(([rad, mat], i) => {
    const d = mesh(new CylinderGeometry(rad, rad, 0.16, 64), mat, 0, 0, i * 0.045);
    d.rotation.x = Math.PI / 2;
    board.add(d);
  });
  board.add(mesh(new TorusGeometry(1.65, 0.07, 12, 72), M.chrome, 0, 0, 0.02));
  // Arrow in the bullseye
  const arrow = new Group();
  arrow.add(mesh(new CylinderGeometry(0.05, 0.05, 1.9, 16), M.deep, 0, 1.0, 0));
  const tip = mesh(new ConeGeometry(0.11, 0.3, 20), M.chrome, 0, 0.1, 0); tip.rotation.x = Math.PI;
  arrow.add(tip);
  for (let i = 0; i < 3; i++) {
    const p = new Group(); p.rotation.y = (i / 3) * TAU; p.position.y = 1.72;
    p.add(mesh(new BoxGeometry(0.02, 0.42, 0.2), M.red, 0, 0, 0.13));
    arrow.add(p);
  }
  arrow.add(mesh(new SphereGeometry(0.07, 14, 10), M.red, 0, 1.96, 0));
  const dir = new Vector3(0.42, 0.34, 1).normalize();
  const baseQ = new Quaternion().setFromUnitVectors(UP, dir);
  arrow.quaternion.copy(baseQ);
  arrow.position.set(0, 0, 0.22);
  board.add(arrow);
  board.rotation.set(-0.08, -0.38, 0);
  g.add(board);
  const coins = [coin(M, 0.2), coin(M, 0.15)];
  coins[0].position.set(1.75, 1.35, 0.5); coins[1].position.set(-1.7, -1.3, 0.6);
  g.add(...coins);
  const wob = new Quaternion(), ax = new Vector3(1, 0, 0);
  return {
    group: g, radius: 2.2,
    update(t, hit = 0) {
      // The arrow quivers after it lands
      wob.setFromAxisAngle(ax, Math.sin(t * 26) * 0.09 * hit + Math.sin(t * 1.7) * 0.012);
      arrow.quaternion.copy(baseQ).multiply(wob);
      coins.forEach((c, i) => { c.rotation.y = t * (1 + i * 0.6); c.position.y += Math.sin(t * 1.2 + i * 3) * 0.0015; });
    },
  };
}

function buildFunnel(M) {
  const g = new Group();
  const tier = (rt, rb, h, y, mat) => {
    const t = new Group();
    t.add(mesh(new CylinderGeometry(rt, rb, h, 56, 1, true), mat, 0, y, 0));
    t.add(mesh(new TorusGeometry(rt, 0.055, 12, 56), M.chrome, 0, y + h / 2, 0).rotateX(Math.PI / 2));
    g.add(t);
  };
  tier(1.6, 1.12, 0.72, 0.95, M.red);
  tier(1.05, 0.68, 0.62, 0.2, M.neutral);
  tier(0.62, 0.3, 0.56, -0.47, M.red);
  g.add(mesh(new CylinderGeometry(0.3, 0.3, 0.4, 32, 1, true), M.chrome, 0, -0.94, 0));
  // Leads spiral in at the top
  const leads = Array.from({ length: 9 }, (_, i) => {
    const m = mesh(new SphereGeometry(0.105, 18, 14), i % 3 === 0 ? M.red : M.neutral);
    m.userData.o = i / 9; g.add(m); return m;
  });
  // Revenue drops out at the bottom
  const out = [0, 1, 2].map((i) => { const c = coin(M, 0.19); c.userData.o = i / 3; g.add(c); return c; });
  g.position.y = 0.25;
  return {
    group: g, radius: 2.3,
    update(t) {
      leads.forEach((m) => {
        const k = (t * 0.22 + m.userData.o) % 1;
        const rad = 1.75 * (1 - k) + 0.25, a = k * 9 + m.userData.o * TAU;
        m.position.set(Math.cos(a) * rad, 2.0 - k * 1.1 + Math.sin(a * 2) * 0.05, Math.sin(a) * rad);
        m.scale.setScalar(Math.min(1, k * 6) * (1 - Math.max(0, k - 0.85) / 0.15));
      });
      out.forEach((c) => {
        const k = (t * 0.45 + c.userData.o) % 1;
        c.position.set(Math.sin(c.userData.o * 9) * 0.08, -1.15 - k * 1.25, 0);
        c.rotation.set(k * 5 + c.userData.o * 3, t * 2, 0);
        c.scale.setScalar(Math.sin(Math.min(1, k * 1.15) * Math.PI) ** 0.5);
      });
    },
  };
}

function buildPlane(M) {
  const g = new Group();
  const p = new Group();
  const N = [1.9, 0, 0], L = [-1.3, 0.28, 1.2], R = [-1.3, 0.28, -1.2], K = [-1.15, -0.55, 0];
  const cl = [-1.3, 0.24, 0.14], cr = [-1.3, 0.24, -0.14];
  const tri = (list) => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(list.flat(2)), 3));
    geo.computeVertexNormals();
    return geo;
  };
  p.add(mesh(tri([[N, L, cl], [N, cr, R]]), M.paper));            // wings
  p.add(mesh(tri([[N, cl, K], [N, K, cr]]), M.red));              // body fold
  p.rotation.set(0.25, -0.55, 0.3);
  g.add(p);
  // Dotted trail
  const curve = new CatmullRomCurve3([[-1.6, -0.5, 0.6], [-2.3, -1.1, 0.2], [-1.9, -1.9, -0.5], [-0.8, -2.1, -0.6]].map((a) => new Vector3(...a)));
  const dots = Array.from({ length: 9 }, (_, i) => { const d = mesh(new SphereGeometry(0.06, 12, 10), i % 2 ? M.red : M.neutral); g.add(d); return d; });
  return {
    group: g, radius: 2.2,
    update(t) {
      p.position.set(0.3 + Math.sin(t * 0.8) * 0.12, 0.25 + Math.sin(t * 1.3) * 0.14, 0);
      p.rotation.set(0.25 + Math.sin(t * 1.3 + 1) * 0.07, -0.55 + Math.sin(t * 0.6) * 0.1, 0.3 + Math.sin(t * 0.8 + 0.5) * 0.08);
      dots.forEach((d, i) => {
        const k = ((i / 9) + t * 0.08) % 1;
        d.position.copy(curve.getPoint(k)).add(p.position);
        d.scale.setScalar(Math.sin(k * Math.PI) * (1.3 - k * 0.5));
      });
    },
  };
}

const BUILDERS = { chart: buildChart, megaphone: buildMegaphone, rocket: buildRocket, target: buildTarget, funnel: buildFunnel, plane: buildPlane };

/* ------------------------------------------------------------------------ */
/* Main                                                                      */
/* ------------------------------------------------------------------------ */
export function initWorld(canvas, { reduced = false } = {}) {
  const html = document.documentElement;
  const isSmall = () => window.innerWidth < 768;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const amb = new AmbientLight(0xffffff, 0.35); scene.add(amb);
  const key = new DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 6); scene.add(key);
  const warm = new PointLight(0xff4b55, 60, 30); warm.position.set(4, 2, 5); scene.add(warm);
  const cool = new PointLight(0x7f9bff, 40, 30); cool.position.set(-5, -2, 4); scene.add(cool);

  const M = makeMaterials();
  const rig = new Group();
  scene.add(rig);
  const objects = {};
  NAMES.forEach((n) => {
    const o = BUILDERS[n](M);
    const holder = new Group();       // scale in / out
    holder.add(o.group);
    holder.visible = false;
    rig.add(holder);
    objects[n] = { ...o, holder, hit: 0 };
  });

  // ---- Small floating pieces around the page (coins, sparks, rings)
  const bits = [];
  const bitRig = new Group();
  scene.add(bitRig);
  const bitCount = isSmall() ? 0 : 5;
  for (let i = 0; i < bitCount; i++) {
    const kind = i % 4;
    let m;
    if (kind === 0) m = coin(M, rand(0.09, 0.12));
    else if (kind === 1) m = mesh(new SphereGeometry(rand(0.045, 0.07), 20, 16), M.red);
    else if (kind === 2) m = mesh(new TorusGeometry(0.09, 0.025, 10, 28), M.chrome);
    else m = mesh(new OctahedronGeometry(0.075, 0), M.red);
    const side = i % 2 ? 1 : -1;
    bits.push({
      m, side, fx: rand(0.94, 1.05), fy: -1 + ((i + rand(0.1, 0.9)) / bitCount) * 2, z: rand(-5, -0.8), speed: rand(0.5, 1.4),
      spin: new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)), phase: rand(0, TAU), ox: 0, oy: 0,
    });
    bitRig.add(m);
  }

  // ---- A final pass that fades the whole picture (so objects never fight with text)
  const fade = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
    uniforms: { uA: { value: 1 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uA; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, uA); }',
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    blending: CustomBlending, blendEquation: AddEquation, blendSrc: ZeroFactor, blendDst: SrcAlphaFactor,
    blendSrcAlpha: ZeroFactor, blendDstAlpha: SrcAlphaFactor,
  }));
  fade.frustumCulled = false; fade.renderOrder = 999;
  scene.add(fade);

  // ---- Theme
  let theme = html.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const applyTheme = (t) => {
    theme = t;
    const day = t === 'light';
    M.neutral.color.set(day ? 0x1f2937 : 0xf3f4f7);
    M.neutral.roughness = day ? 0.26 : 0.3;
    M.paper.color.set(day ? 0x1f2937 : 0xffffff);
    M.paper.emissive.set(day ? 0x1f2937 : 0xffffff);
    M.paper.emissiveIntensity = day ? 0.5 : 0.32;
    M.deep.color.set(day ? 0xcfd6e1 : 0x3a3e4a);
    M.deep.metalness = day ? 0.2 : 0.55;
    M.red.emissiveIntensity = day ? 0.08 : 0.18;
    amb.intensity = day ? 0.7 : 0.35;
    key.intensity = day ? 2.6 : 2.2;
    warm.intensity = day ? 25 : 60;
    cool.intensity = day ? 15 : 40;
    Object.values(objects).forEach((o) => (o.mats || []).forEach((m) => m.color.copy(M.neutral.color)));
  };
  applyTheme(theme);
  document.addEventListener('themechange', (e) => { applyTheme(e.detail === 'light' ? 'light' : 'dark'); if (reduced) render(); });

  // ---- Sections that drive the objects
  let stops = [];
  const readStops = () => {
    const els = [...document.querySelectorAll('[data-shape]')];
    const old = new Map(stops.map((s) => [s.el, s.pin]));
    stops = els.map((el) => {
      const r = el.getBoundingClientRect();
      const name = ALIAS[el.dataset.shape] || el.dataset.shape;
      return {
        shape: NAMES.includes(name) ? name : 'chart',
        side: el.dataset.side || 'center',
        scale: parseFloat(el.dataset.scale || '1'),
        opacity: parseFloat(el.dataset.opacity || '1'),
        // Optional: a box on the page that the object should sit inside (it follows the box while scrolling)
        anchor: el.dataset.anchor ? document.querySelector(el.dataset.anchor) : el.querySelector('[data-shape-spot]'),
        el, pin: old.has(el) ? old.get(el) : -1,
        top: r.top + window.scrollY,
        height: r.height,
      };
    }).sort((a, b) => a.top - b.top);
    if (!stops.length) stops = [{ shape: 'chart', side: 'center', scale: 1, opacity: 1, top: 0, height: 1 }];
  };

  let viewW = 10, viewH = 6;
  const layout = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    viewH = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    viewW = viewH * camera.aspect;
    readStops();
  };
  layout();

  // An object has two homes:
  //   1. its "spot": a box beside the section heading, where it is shown big and clear
  //   2. the side of the screen, where it waits (dimmed, behind the cards) while you read
  const sidePlace = (s) => {
    const small = isSmall();
    const unit = small ? Math.min(viewW / 7.5, 0.62) : Math.min(viewW / 12, 1.0);
    let x = 0;
    if (!small) {
      if (s.side === 'right') x = viewW * 0.3;
      if (s.side === 'left') x = -viewW * 0.31;
    }
    // While it waits behind the cards it is small and faint
    return { x, y: 0, scale: unit * s.scale * 0.8, opacity: s.opacity * (small ? 0.3 : 0.5) };
  };
  const spotPlace = (s) => {
    if (!s.anchor) return null;
    const r = s.anchor.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return {
      x: (cx / window.innerWidth - 0.5) * viewW,
      y: (0.5 - cy / window.innerHeight) * viewH,
      // Objects are about 4 units tall; fit them to the box
      scale: Math.min((r.height / window.innerHeight) * viewH, (r.width / window.innerWidth) * viewW * 1.05) / 4.1,
      opacity: 0.92,
      seen: cy > -0.06 * window.innerHeight && cy < 0.94 * window.innerHeight,
    };
  };
  const placeFor = (s, dt = 0) => {
    const side = sidePlace(s), spot = spotPlace(s);
    if (!spot) { s.pin = 0; return { ...side, pin: 0 }; }
    if (s.pin < 0) s.pin = spot.seen ? 1 : 0;      // first look: no animation
    s.pin += ((spot.seen ? 1 : 0) - s.pin) * (dt ? 1 - Math.exp(-dt * 4.5) : 1);
    const k = smooth(clamp01(s.pin));
    return {
      x: side.x + (spot.x - side.x) * k, y: side.y + (spot.y - side.y) * k,
      scale: side.scale + (spot.scale - side.scale) * k, opacity: side.opacity + (spot.opacity - side.opacity) * k, pin: k,
    };
  };

  // Progress along the stops: 0 = first section, 1 = second, ...
  const targetProgress = () => {
    if (stops.length < 2) return 0;
    const vh = window.innerHeight;
    const y = window.scrollY + vh * 0.5;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      const edge = (a.top + a.height + b.top) / 2;
      const win = Math.max(80, Math.min(vh * 0.3, a.height * 0.35, b.height * 0.35));
      if (y < edge - win) return i;
      if (y < edge + win) return i + (y - (edge - win)) / (2 * win);
    }
    return stops.length - 1;
  };

  // ---- Pointer
  const ndc = new Vector2(0, 0);
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let pointerActive = false;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    tilt.tx = ndc.x; tilt.ty = ndc.y;
    pointerActive = true;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointerActive = false; });

  let hover = false, hoverK = 0;
  let spinV = 0;       // extra spin speed (from scroll and clicks)
  let pulse = 0;
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, textarea, select, label, [data-sphere], .marquee, [data-char]')) return;
    if (hover) { spinV += 9; pulse = 1; }
  });

  // ---- Frame
  let progress = targetProgress();
  let lastScroll = window.scrollY;
  let spin = 0, time = 0, prev = performance.now();
  let running = false;
  const cur = { x: 0, y: 0, scale: 1, opacity: 1 };
  { const p0 = placeFor(stops[0]); cur.x = p0.x; cur.y = p0.y; cur.scale = p0.scale; cur.opacity = p0.opacity; }

  function render() {
    const now = performance.now();
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (!reduced) time += dt;

    const tp = targetProgress();
    progress += (tp - progress) * (reduced ? 1 : 1 - Math.exp(-dt * 7));
    const k = Math.min(Math.floor(progress), stops.length - 1);
    const m = progress - k;
    const A = stops[k], B = stops[Math.min(k + 1, stops.length - 1)];

    // Scroll adds spin
    const sy = window.scrollY;
    const dScroll = sy - lastScroll; lastScroll = sy;
    if (!reduced) spinV += MathUtils.clamp(dScroll, -120, 120) * 0.012 * CALM * 0.6;
    spinV *= Math.pow(0.04, dt);
    spin += spinV * dt;
    // Ease back so the object faces the front again
    const rest = Math.round(spin / TAU) * TAU;
    spin += (rest - spin) * Math.min(1, dt * 1.6) * (1 - clamp01(Math.abs(spinV) / 3));

    // Where the active object sits
    const pa = placeFor(A, reduced ? 0 : dt), pb = A === B ? pa : placeFor(B, reduced ? 0 : dt);
    const mm = smooth(m);
    const tx = pa.x + (pb.x - pa.x) * mm, ty = pa.y + (pb.y - pa.y) * mm;
    const ts = pa.scale + (pb.scale - pa.scale) * mm, to = pa.opacity + (pb.opacity - pa.opacity) * mm;
    // On its spot the object must stay glued to the page while it scrolls
    const pinW = pa.pin * (1 - mm) + pb.pin * mm;
    const ease = reduced ? 1 : 1 - Math.exp(-dt * (5 + pinW * pinW * 55));
    cur.x += (tx - cur.x) * ease; cur.y += (ty - cur.y) * ease; cur.scale += (ts - cur.scale) * ease; cur.opacity += (to - cur.opacity) * ease;

    // Mouse: lean toward the circle, and come a little closer to it
    const te = 1 - Math.exp(-dt * 4.5);
    tilt.x += (tilt.tx - tilt.x) * te; tilt.y += (tilt.ty - tilt.y) * te;
    const mxW = ndc.x * viewW / 2, myW = ndc.y * viewH / 2;
    const dist = Math.hypot(mxW - cur.x, myW - cur.y);
    const reach = 2.2 * cur.scale;
    const nowHover = pointerActive && !reduced && dist < reach && cur.opacity > 0.3;
    if (nowHover !== hover) { hover = nowHover; html.classList.toggle('is-3d-hover', hover); }
    hoverK += ((hover ? 1 : 0) - hoverK) * (1 - Math.exp(-dt * 7));
    const pull = pointerActive && !reduced ? Math.exp(-dist / (4 * Math.max(cur.scale, 0.3))) * 0.18 * CALM : 0;
    rig.position.set(cur.x + (mxW - cur.x) * pull, cur.y + (myW - cur.y) * pull + (reduced ? 0 : Math.sin(time * 0.7) * 0.05 * cur.scale), 0);
    pulse *= Math.pow(0.006, dt);
    rig.scale.setScalar(cur.scale * (1 + hoverK * 0.1 + pulse * 0.06));
    const sway = reduced ? 0 : Math.sin(time * 0.35) * 0.3 * CALM;
    rig.rotation.set(-tilt.y * 0.32 * (0.4 + CALM) + 0.1, spin + sway + tilt.x * 0.55 * (0.4 + CALM) - 0.2, 0);
    M.red.emissiveIntensity = (theme === 'light' ? 0.08 : 0.18) + hoverK * 0.25;

    // Hand over between two objects: the old one shrinks, the new one pops in
    const wA = A === B ? 1 : 1 - smooth(clamp01(m / 0.48));
    const wB = A === B ? 0 : smooth(clamp01((m - 0.52) / 0.48));
    NAMES.forEach((n) => {
      const o = objects[n];
      let w = 0;
      if (A.shape === n) w = Math.max(w, A.shape === B.shape ? 1 : wA);
      if (B.shape === n && A !== B) w = Math.max(w, A.shape === B.shape ? 1 : wB);
      const was = o.holder.visible;
      o.holder.visible = w > 0.002;
      if (!o.holder.visible) return;
      if (!was) o.hit = 1;                         // just arrived
      o.hit *= Math.pow(0.12, dt);
      // A small overshoot when it pops in
      const pop = w;
      o.holder.scale.setScalar(pop);
      o.holder.rotation.y = (1 - w) * (A.shape === n && A !== B ? 0.7 : -0.7);
      o.update(time * (0.45 + CALM * 0.55), o.hit * CALM);
    });

    // Floating pieces
    const range = viewH * 1.5;
    for (const b of bits) {
      const par = 1 + (b.z + 5) * 0.16;                           // near pieces move faster
      let y = b.fy * range * 0.5 + (sy * 0.0032 * par) + (reduced ? 0 : Math.sin(time * 0.3 * b.speed + b.phase) * 0.1);
      y = ((y + range / 2) % range + range) % range - range / 2;
      const x = b.side * b.fx * (viewW / 2) * (1 - b.z * 0.09);
      // Move away from the mouse circle
      let ox = 0, oy = 0;
      if (pointerActive && !reduced) {
        const dx = x - mxW, dy = y - myW, d = Math.hypot(dx, dy) || 0.001;
        if (d < 1.6) { const f = (1 - d / 1.6) ** 2 * 0.9; ox = (dx / d) * f; oy = (dy / d) * f; }
      }
      const be = 1 - Math.exp(-dt * 5);
      b.ox += (ox - b.ox) * be; b.oy += (oy - b.oy) * be;
      b.m.position.set(x + b.ox, y + b.oy, b.z);
      if (!reduced) { b.m.rotation.x += b.spin.x * dt * 0.25; b.m.rotation.y += b.spin.y * dt * 0.25; b.m.rotation.z += b.spin.z * dt * 0.15; }
      // Fade near the top and bottom edge so nothing pops
      const edge = clamp01((range / 2 - Math.abs(y)) / 0.8);
      b.m.scale.setScalar(edge);
    }
    bitRig.position.set(-tilt.x * 0.25, -tilt.y * 0.15, 0);

    fade.material.uniforms.uA.value = clamp01(cur.opacity);
    fade.visible = cur.opacity < 0.995;
    renderer.render(scene, camera);
  }

  const loop = () => { if (!running) return; render(); requestAnimationFrame(loop); };
  const start = () => { if (running || reduced) return; running = true; prev = performance.now(); requestAnimationFrame(loop); };
  const stop = () => { running = false; };

  let resizeT;
  const remeasure = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { layout(); if (reduced) render(); }, 120); };
  window.addEventListener('resize', remeasure);
  new ResizeObserver(remeasure).observe(document.body);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (reduced) {
    window.addEventListener('scroll', () => render(), { passive: true });
    render();
  } else {
    start();
  }

  canvas.classList.add('is-on');
  return { stop, start };
}
