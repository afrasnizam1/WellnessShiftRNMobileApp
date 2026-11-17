/// <reference lib="dom" />
/**
 * Wellness sphere — the particle globe from wellnesshift.co.uk (public/health-3d.html),
 * ported for the in-app Body HUD WebView.
 *
 * Eight longitude segments — the same wellness categories as the home score
 * (physical, nutrition, mental, social, environment, fitness, sleep, mindfulness) —
 * fill bottom-to-top to that category's score, around a pulsing core with neural
 * sparks, one faint wireframe and a few data arcs. The score itself is drawn by the
 * app as text over the sphere; the core glow follows its score band.
 *
 * Bundled by `npm run bundle:sphere` into src/components/home/bodyHud/wellnessSphereHtml.ts.
 *
 * Bridge
 *   RN → web:  window.wsSphere.update({ pcts?, colors?, sel?, paused?, active?, core? })
 *   web → RN:  { type: 'ready' } | { type: 'pick', index } | { type: 'error', message }
 */
import * as THREE from 'three';

type SphereState = {
  pcts: number[];
  colors: string[];
  sel: number;
  paused: boolean;
  active: boolean;
  /** Centre glow colour — follows the overall score band, set by the app. */
  core?: string;
};

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __WS_SPHERE_INIT__?: Partial<SphereState>;
    wsSphere?: { update: (patch: Partial<SphereState>) => void };
  }
}

const post = (msg: Record<string, unknown>) => {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
  } catch {
    /* not inside RN (e.g. preview in a browser) */
  }
};

/* ---------- Shaders (verbatim from the website) ---------- */
const ORB_VS = [
  'attribute float aSector; attribute float aLat; attribute float aPhase;',
  'uniform float uPct[8]; uniform vec3 uCol[8]; uniform float uSel; uniform float uTime; uniform float uFill; uniform float uPR;',
  'varying vec3 vC; varying float vA;',
  'void main(){',
  ' float pct = 0.0; vec3 col = vec3(1.0);',
  ' for (int i = 0; i < 8; i++) { if (abs(float(i) - aSector) < 0.5) { pct = uPct[i]; col = uCol[i]; } }',
  ' pct *= uFill;',
  ' float isSel = 1.0 - step(0.5, abs(aSector - uSel));',
  ' float filled = step(aLat, pct);',
  ' float edge = (1.0 - smoothstep(0.0, 0.02, abs(aLat - pct))) * step(0.02, pct);',
  ' vec3 p = position;',
  ' float wave = sin(uTime * 1.6 + aPhase * 6.283 + p.y * 7.0) * 0.014 + sin(uTime * 0.9 + p.x * 5.0 + p.z * 3.0) * 0.01;',
  ' p *= 1.0 + wave * filled + isSel * 0.04 * filled + edge * 0.02;',
  ' vec4 mv = modelViewMatrix * vec4(p, 1.0);',
  ' gl_Position = projectionMatrix * mv;',
  ' float sz = mix(0.85, 1.2 + isSel * 0.28, filled) * (1.0 + edge * 0.4);',
  ' gl_PointSize = uPR * sz * (4.6 / -mv.z);',
  ' vec3 lit = clamp(col * mix(1.0, 1.12, isSel), 0.0, 1.0);',
  ' vec3 base = mix(vec3(0.05, 0.06, 0.09), lit, filled);',
  ' base = mix(base, vec3(1.0), edge * 0.28);',
  ' vC = base;',
  ' vec3 nv = normalize(normalMatrix * position);',
  ' float facing = 0.48 + 0.52 * smoothstep(-0.2, 0.6, nv.z);',
  ' vA = mix(0.4, 0.88, filled) * (0.94 + 0.06 * sin(uTime * 3.0 + aPhase * 40.0)) * facing;',
  '}',
].join('\n');
const ORB_FS = [
  'varying vec3 vC; varying float vA;',
  'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;',
  ' float core = 1.0 - smoothstep(0.0, 0.5, d); gl_FragColor = vec4(vC * (0.82 + core * 0.4), vA * core); }',
].join('\n');
const CORE_VS = [
  'varying vec3 vN; varying vec3 vV;',
  'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
].join('\n');
const CORE_FS = [
  'uniform vec3 uCol; uniform float uTime; uniform float uPow; uniform float uGain;',
  'varying vec3 vN; varying vec3 vV;',
  'void main(){ float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uPow);',
  ' float pulse = 0.85 + 0.15 * sin(uTime * 2.2);',
  ' gl_FragColor = vec4(mix(uCol, vec3(1.0), f * 0.18) * uGain * pulse, f * pulse * 0.95); }',
].join('\n');
const ARC_VS = [
  'attribute float aT; attribute float aOff; attribute vec3 aCol; uniform float uTime; varying float vA; varying vec3 vC;',
  'void main(){ vC = aCol; float h = fract(uTime * 0.22 + aOff);',
  ' float d = aT - h; float head = smoothstep(-0.18, 0.0, d) * (1.0 - smoothstep(0.0, 0.016, d));',
  ' vA = 0.035 + head * 0.96; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
].join('\n');
const ARC_FS = 'varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, vA * 0.5); }'; // softer arcs
const NEU_LVS = [
  'attribute float aT; attribute float aOff; attribute float aSpd; attribute vec3 aCol; uniform float uTime;',
  'varying float vT; varying float vOff; varying float vSpd; varying vec3 vC;',
  'void main(){ vT = aT; vOff = aOff; vSpd = aSpd; vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
].join('\n');
const NEU_LFS = [
  'uniform float uTime; uniform float uBurst; uniform vec3 uTint;',
  'varying float vT; varying float vOff; varying float vSpd; varying vec3 vC;',
  'void main(){ float cyc = uTime * vSpd + vOff; float head = fract(cyc);',
  ' float on = step(0.18, fract(cyc * 0.37 + vOff * 3.1));',
  ' float d = vT - head;',
  ' float spark = (1.0 - smoothstep(0.0, 0.04, abs(d))) + smoothstep(-0.2, 0.0, d) * (1.0 - step(0.0, d)) * 0.4;',
  ' spark = max(spark, uBurst * 0.22);',
  ' vec3 shot = mix(vC, vec3(1.0), 0.55 + 0.45 * spark);',
  ' shot = mix(shot, uTint, uBurst * 0.35);',
  ' gl_FragColor = vec4(shot * (0.85 + spark * 0.3), (0.46 + spark * on * 0.4 + uBurst * 0.1) * 0.4); }',
].join('\n');
const NEU_PVS = [
  'attribute float aPhase; attribute float aRate; attribute vec3 aCol;',
  'uniform float uTime; uniform float uPR; uniform float uBurst; uniform vec3 uTint;',
  'varying float vF; varying vec3 vC;',
  'void main(){ float f = pow(0.5 + 0.5 * sin(uTime * aRate + aPhase), 16.0); f = max(f, uBurst * 0.22); vF = f;',
  ' vC = mix(aCol, uTint, uBurst * 0.4);',
  ' vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;',
  ' gl_PointSize = uPR * (1.55 + f * 2.4) * (1.0 + uBurst * 0.35) * (4.6 / -mv.z); }',
].join('\n');
const NEU_PFS = [
  'varying float vF; varying vec3 vC;',
  'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;',
  ' float core = 1.0 - smoothstep(0.0, 0.5, d);',
  ' vec3 shot = mix(vC, vec3(1.0), 0.18 + vF * 0.12);',
  ' gl_FragColor = vec4(shot, core * (0.62 + vF * 0.2) * 0.45); }',
].join('\n');
const BURST_VS = [
  'attribute vec3 aDir; attribute float aPhase; attribute vec3 aCol;',
  'uniform float uBurst; uniform float uPR;',
  'varying float vA; varying vec3 vC;',
  'void main(){',
  // Fly out in the first part of the fade, then linger and dim.
  ' float travel = smoothstep(1.0, 0.84, uBurst);',
  ' vec3 p = aDir * travel * (0.16 + aPhase * 0.58);',
  ' vec4 mv = modelViewMatrix * vec4(p, 1.0);',
  ' gl_Position = projectionMatrix * mv;',
  ' float glow = uBurst * 0.5;',
  ' gl_PointSize = uPR * glow * (2.6 + aPhase * 4.2) * (4.6 / max(0.25, -mv.z));',
  ' vA = glow * (1.0 - smoothstep(0.72, 1.0, travel));',
  ' vC = aCol;',
  '}',
].join('\n');
const BURST_FS = [
  'varying float vA; varying vec3 vC;',
  'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;',
  ' float core = 1.0 - smoothstep(0.18, 0.5, d);',
  ' gl_FragColor = vec4(vC * (0.72 + core * 0.28), vA * core * 0.8); }',
].join('\n');

/** Same seeded RNG as the website so the globe looks identical. */
function rngOf(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** One segment per home wellness category (the first eight), in WELLNESS_CATEGORIES order. */
const SECTORS = 8;
/** Particle digits in the core. Off: the app overlays the score as real text instead. */
const SHOW_PARTICLE_SCORE = false;
/** Fallback only. The app sends the daily-ring colours. */
const SPHERE_COLORS = [
  '#FF4D8D',
  '#F0A04A',
  '#A78BFA',
  '#FF5C4A',
  '#3DCCF5',
  '#FFFFFF',
  '#5B8CFF',
  '#A78BFA',
];

function clamp01(v: number) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** Digit shapes as smooth strokes. Neurons sit evenly along these. */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
}
const loop = (cx: number, cy: number, rx: number, ry: number, n = 22) => arc(cx, cy, rx, ry, Math.PI / 2, Math.PI / 2 + Math.PI * 2, n);
const STROKES: Record<string, number[][][]> = {
  '0': [loop(0.5, 0.5, 0.36, 0.46)],
  '1': [[[0.4, 0.74], [0.58, 0.96], [0.58, 0.04]], [[0.34, 0.04], [0.82, 0.04]]],
  '2': [arc(0.5, 0.74, 0.34, 0.22, Math.PI * 0.95, -0.15, 12).concat([[0.16, 0.04], [0.86, 0.04]])],
  '3': [arc(0.46, 0.74, 0.34, 0.22, Math.PI * 0.9, -0.35, 10), arc(0.46, 0.26, 0.34, 0.22, 0.35, -Math.PI * 0.95, 10)],
  '4': [[[0.76, 0.02], [0.76, 0.98]], [[0.76, 0.96], [0.14, 0.4], [0.94, 0.4]]],
  '5': [[[0.82, 0.96], [0.22, 0.96], [0.18, 0.58]], arc(0.48, 0.3, 0.34, 0.26, Math.PI * 0.55, -Math.PI * 0.85, 12)],
  '6': [arc(0.5, 0.7, 0.34, 0.26, Math.PI * 0.15, Math.PI * 1.15, 8).concat(loop(0.5, 0.32, 0.32, 0.28, 16))],
  '7': [[[0.12, 0.94], [0.88, 0.94], [0.4, 0.04]]],
  '8': [loop(0.5, 0.73, 0.3, 0.23, 16), loop(0.5, 0.27, 0.32, 0.24, 16)],
  '9': [loop(0.5, 0.68, 0.32, 0.28, 16).concat(arc(0.5, 0.32, 0.34, 0.3, Math.PI * 0.15, -Math.PI * 0.65, 8))],
};

function walkStroke(pts: number[][], step: number) {
  const seg: { len: number; a: number[]; b: number[] }[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) || 1e-4;
    seg.push({ len, a: pts[i - 1], b: pts[i] });
    total += len;
  }
  const out: { x: number; y: number; tx: number; ty: number }[] = [];
  if (total < 1e-4) return out;
  let d = 0;
  let guard = 0;
  while (guard++ < 80) {
    let acc = 0;
    for (const s of seg) {
      if (acc + s.len >= d - 1e-6) {
        const t = Math.max(0, Math.min(1, (d - acc) / s.len));
        const dx = s.b[0] - s.a[0];
        const dy = s.b[1] - s.a[1];
        out.push({ x: s.a[0] + dx * t, y: s.a[1] + dy * t, tx: dx / s.len, ty: dy / s.len });
        break;
      }
      acc += s.len;
    }
    if (d >= total - 1e-4) break;
    d = Math.min(total, d + step);
  }
  return out;
}

function sectorPcts(src?: number[]) {
  const out = new Array<number>(SECTORS).fill(0);
  for (let i = 0; i < SECTORS; i++) out[i] = clamp01(src?.[i] ?? 0);
  return out;
}

const init = window.__WS_SPHERE_INIT__ ?? {};
const state: SphereState = {
  pcts: sectorPcts(init.pcts),
  colors: init.colors?.length === SECTORS ? init.colors : SPHERE_COLORS,
  sel: init.sel ?? 0,
  paused: !!init.paused,
  active: init.active !== false,
  core: init.core,
};

function start() {
  const canvas = document.getElementById('orb') as HTMLCanvasElement;
  // Phones: cap DPR at 2 (the site does too); keeps 14k points smooth on older devices.
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0.12, 4.35);
  camera.lookAt(0, 0, 0);
  const time = { value: 0 };
  const root = new THREE.Group();
  root.rotation.x = 0.08;
  scene.add(root);
  const spin = new THREE.Group();
  root.add(spin);

  const cols = state.colors.map((hex) => new THREE.Color(hex));
  const cur = state.pcts.slice();

  // Fibonacci globe split into one longitude segment per wellness category.
  const N = 9000; // calmer shell (was 14k)
  const gold = Math.PI * (3 - Math.sqrt(5));
  const seg = (Math.PI * 2) / SECTORS;
  const pos: number[] = [];
  const sec: number[] = [];
  const lat: number[] = [];
  const ph: number[] = [];
  const rng = rngOf(2026);
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const th = i * gold;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    let lon = Math.atan2(z, x);
    if (lon < 0) lon += Math.PI * 2;
    const within = lon % seg;
    if (within < 0.045 || within > seg - 0.045) continue;
    pos.push(x, y, z);
    sec.push(Math.floor(lon / seg));
    lat.push((y + 1) / 2);
    ph.push(rng());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSector', new THREE.Float32BufferAttribute(sec, 1));
  g.setAttribute('aLat', new THREE.Float32BufferAttribute(lat, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
  const pm = new THREE.ShaderMaterial({
    uniforms: {
      uPct: { value: cur },
      uCol: { value: cols },
      uSel: { value: state.sel },
      uTime: time,
      uFill: { value: 0 },
      uPR: { value: pr },
    },
    vertexShader: ORB_VS,
    fragmentShader: ORB_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  spin.add(new THREE.Points(g, pm));

  // Core: fresnel shell + inner glow, tinted by the focused ring.
  const coreCol = state.core ? new THREE.Color(state.core) : cols[Math.max(0, state.sel)].clone();
  const coreTarget = coreCol.clone();
  const coreMat = (pow: number, gain: number) =>
    new THREE.ShaderMaterial({
      uniforms: { uCol: { value: coreCol }, uTime: time, uPow: { value: pow }, uGain: { value: gain } },
      vertexShader: CORE_VS,
      fragmentShader: CORE_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  const coreGroup = new THREE.Group();
  coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 48), coreMat(2.4, 1.15)));
  coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 48, 32), coreMat(0.7, 1.15)));

  const neuNodeMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: coreCol }, uTime: time, uPR: { value: pr }, uBurst: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') } },
    vertexShader: NEU_PVS,
    fragmentShader: NEU_PFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const neuLineMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: coreCol }, uTime: time, uBurst: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') } },
    vertexShader: NEU_LVS,
    fragmentShader: NEU_LFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // A small bundle of double helices sitting in the core.
  const heart = new THREE.Group();
  const dnaSpins: THREE.Group[] = [];
  const dnaRng = rngOf(4711);
  const helixCount = 4;
  for (let h = 0; h < helixCount; h++) {
    const length = 0.78 + dnaRng() * 0.16;
    const radius = 0.1 + dnaRng() * 0.035;
    const turns = 2.15 + dnaRng() * 0.7;
    const phase = dnaRng() * Math.PI * 2;
    const steps = 52;
    const strandA: number[] = [];
    const strandB: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = (u - 0.5) * length;
      const ang = u * turns * Math.PI * 2 + phase;
      strandA.push(Math.cos(ang) * radius, y, Math.sin(ang) * radius);
      strandB.push(Math.cos(ang + Math.PI) * radius, y, Math.sin(ang + Math.PI) * radius);
    }
    const lpos: number[] = [];
    const lt: number[] = [];
    const loff: number[] = [];
    const lspd: number[] = [];
    const lcol: number[] = [];
    const npos: number[] = [];
    const nph: number[] = [];
    const nrate: number[] = [];
    const ncol: number[] = [];
    const cA = cols[h % SECTORS];
    const cB = cols[(h + 3) % SECTORS];
    const rung = cA.clone().lerp(cB, 0.5);
    const off = dnaRng();
    const spd = 0.28 + dnaRng() * 0.35;
    const pushStrand = (pts: number[], c: THREE.Color) => {
      const n = pts.length / 3;
      for (let i = 0; i < n - 1; i++) {
        const t0 = i / (n - 1);
        const t1 = (i + 1) / (n - 1);
        lpos.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], pts[(i + 1) * 3], pts[(i + 1) * 3 + 1], pts[(i + 1) * 3 + 2]);
        lt.push(t0, t1);
        loff.push(off, off);
        lspd.push(spd, spd);
        lcol.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      for (let i = 0; i < n; i++) {
        npos.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
        nph.push(dnaRng() * 6.283);
        nrate.push(0.5 + dnaRng());
        ncol.push(c.r, c.g, c.b);
      }
    };
    pushStrand(strandA, cA);
    pushStrand(strandB, cB);
    const samples = strandA.length / 3;
    for (let i = 0; i < samples; i += 3) {
      const t = i / (samples - 1);
      lpos.push(strandA[i * 3], strandA[i * 3 + 1], strandA[i * 3 + 2], strandB[i * 3], strandB[i * 3 + 1], strandB[i * 3 + 2]);
      lt.push(t, t);
      loff.push(off, off);
      lspd.push(spd, spd);
      lcol.push(rung.r, rung.g, rung.b, rung.r, rung.g, rung.b);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
    lg.setAttribute('aT', new THREE.Float32BufferAttribute(lt, 1));
    lg.setAttribute('aOff', new THREE.Float32BufferAttribute(loff, 1));
    lg.setAttribute('aSpd', new THREE.Float32BufferAttribute(lspd, 1));
    lg.setAttribute('aCol', new THREE.Float32BufferAttribute(lcol, 3));
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
    ng.setAttribute('aPhase', new THREE.Float32BufferAttribute(nph, 1));
    ng.setAttribute('aRate', new THREE.Float32BufferAttribute(nrate, 1));
    ng.setAttribute('aCol', new THREE.Float32BufferAttribute(ncol, 3));
    const spinH = new THREE.Group();
    spinH.add(new THREE.LineSegments(lg, neuLineMat));
    spinH.add(new THREE.Points(ng, neuNodeMat));
    spinH.userData.spin = (h % 2 ? 1 : -1) * (0.22 + dnaRng() * 0.28);
    const pivot = new THREE.Group();
    let ax = dnaRng() * 2 - 1;
    let ay = dnaRng() * 2 - 1;
    let az = dnaRng() * 2 - 1;
    const al = Math.hypot(ax, ay, az) || 1;
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ax / al, ay / al, az / al));
    pivot.position.set((dnaRng() - 0.5) * 0.22, (dnaRng() - 0.5) * 0.22, (dnaRng() - 0.5) * 0.22);
    pivot.add(spinH);
    heart.add(pivot);
    dnaSpins.push(spinH);
  }
  coreGroup.add(heart);

  // Tap burst: neurons flare out from the core, then fade.
  const burstN = 72;
  const bdir: number[] = [];
  const bph: number[] = [];
  const bcol = new Float32Array(burstN * 3);
  const brng = rngOf(9001);
  for (let i = 0; i < burstN; i++) {
    let x = brng() * 2 - 1;
    let y = brng() * 2 - 1;
    let z = brng() * 2 - 1;
    const len = Math.hypot(x, y, z) || 1;
    bdir.push(x / len, y / len, z / len);
    bph.push(brng());
    bcol[i * 3] = 1;
    bcol[i * 3 + 1] = 1;
    bcol[i * 3 + 2] = 1;
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bdir, 3));
  bg.setAttribute('aDir', new THREE.Float32BufferAttribute(bdir, 3));
  bg.setAttribute('aPhase', new THREE.Float32BufferAttribute(bph, 1));
  const burstCol = new THREE.Float32BufferAttribute(bcol, 3);
  bg.setAttribute('aCol', burstCol);
  const burstMat = new THREE.ShaderMaterial({
    uniforms: { uBurst: { value: 0 }, uPR: { value: pr } },
    vertexShader: BURST_VS,
    fragmentShader: BURST_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const burstPoints = new THREE.Points(bg, burstMat);
  burstPoints.visible = false;
  burstPoints.frustumCulled = false;
  coreGroup.add(burstPoints);

  // Focused category score, written in the core with neurons.
  const SCORE_VS = [
    'attribute float aPhase; attribute float aSize; attribute vec3 aCol; uniform float uTime; uniform float uPR;',
    'varying vec3 vC; varying float vF;',
    'void main(){ float f = 0.82 + 0.18 * sin(uTime * 1.2 + aPhase); vF = f; vC = mix(aCol, vec3(1.0), 0.48);',
    ' vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;',
    ' gl_PointSize = uPR * aSize * (0.8 + f * 0.3) * (4.6 / max(0.25, -mv.z)); }',
  ].join('\n');
  const SCORE_FS = [
    'varying vec3 vC; varying float vF;',
    'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;',
    ' float core = pow(1.0 - smoothstep(0.0, 0.5, d), 1.4);',
    ' gl_FragColor = vec4(vC * (0.86 + 0.14 * vF), core * 0.88); }',
  ].join('\n');
  const scoreMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uPR: { value: pr } },
    vertexShader: SCORE_VS,
    fragmentShader: SCORE_FS,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const scoreLineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  let scorePts: THREE.Points | null = null;
  let scoreLns: THREE.LineSegments | null = null;
  let shownScore = '';
  const layScore = (text: string, color: THREE.Color) => {
    if (scorePts) {
      coreGroup.remove(scorePts);
      scorePts.geometry.dispose();
    }
    if (scoreLns) {
      coreGroup.remove(scoreLns);
      scoreLns.geometry.dispose();
    }
    const H = 0.5;
    const unit = 0.24;
    const gap = 0.06;
    const widths = text.split('').map((ch) => unit * (ch === '1' ? 0.58 : 1));
    const width = widths.reduce((s, w) => s + w, 0) + gap * Math.max(0, text.length - 1);
    let cursor = -width / 2;
    const pts: { x: number; y: number; z: number; size: number }[] = [];
    const links: [number, number][] = [];
    for (let g = 0; g < text.length; g++) {
      const strokes = STROKES[text[g]];
      const gw = widths[g] ?? unit;
      if (strokes) {
        strokes.forEach((stroke) => {
          const samples = walkStroke(stroke, 0.12);
          const closed = Math.hypot(stroke[0][0] - stroke[stroke.length - 1][0], stroke[0][1] - stroke[stroke.length - 1][1]) < 0.06;
          let first = -1;
          let prev = -1;
          samples.forEach((s) => {
            const x = cursor + s.x * gw;
            const y = (s.y - 0.5) * H;
            const idx = pts.length;
            pts.push({ x, y, z: 0.8, size: 5.4 });
            if (first < 0) first = idx;
            if (prev >= 0) links.push([prev, idx]);
            prev = idx;
          });
          if (closed && first >= 0 && prev > first) links.push([prev, first]);
        });
      }
      cursor += gw + gap;
    }
    const pos: number[] = [];
    const phase: number[] = [];
    const size: number[] = [];
    const col: number[] = [];
    pts.forEach((p) => {
      pos.push(p.x, p.y, p.z);
      phase.push(Math.random() * 6.283);
      size.push(p.size);
      col.push(color.r, color.g, color.b);
    });
    const lpos: number[] = [];
    const lcol: number[] = [];
    for (const [a, b] of links) {
      lpos.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z);
      lcol.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pg.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    pg.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    pg.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    scorePts = new THREE.Points(pg, scoreMat);
    scorePts.frustumCulled = false;
    scorePts.renderOrder = 4;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lcol, 3));
    scoreLns = new THREE.LineSegments(lg, scoreLineMat);
    scoreLns.frustumCulled = false;
    scoreLns.renderOrder = 3;
    coreGroup.add(scoreLns);
    coreGroup.add(scorePts);
  };

  const wireMat = new THREE.LineBasicMaterial({
    color: 0xc5d2ff,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ico = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.72, 1)), wireMat);
  const wireMat2 = new THREE.LineBasicMaterial({
    color: 0x9aafef,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ico2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.9, 2)), wireMat2);
  coreGroup.add(ico);
  ico2.visible = false; // outer wireframe removed — too busy
  root.add(coreGroup);

  // Data arcs travelling between segments.
  const apos: number[] = [];
  const at: number[] = [];
  const aoff: number[] = [];
  const acol: number[] = [];
  const aidx: number[] = [];
  let base = 0;
  for (let a = 0; a < 6; a++) {
    const s1 = Math.floor(rng() * SECTORS);
    const s2 = (s1 + 1 + Math.floor(rng() * (SECTORS - 2))) % SECTORS;
    const pick = (s: number) => {
      const lo = s * seg + 0.12;
      const l = lo + rng() * (seg - 0.24);
      const yy = -0.85 + rng() * 1.7 * Math.min(1, state.pcts[s] + 0.05);
      const rr = Math.sqrt(1 - yy * yy);
      return new THREE.Vector3(Math.cos(l) * rr, yy, Math.sin(l) * rr);
    };
    const p1 = pick(s1);
    const p2 = pick(s2);
    const mid = p1.clone().add(p2);
    const lift = 1.18 + p1.distanceTo(p2) * 0.22;
    mid.normalize().multiplyScalar(lift);
    const cv = new THREE.QuadraticBezierCurve3(p1.multiplyScalar(1.01), mid, p2.multiplyScalar(1.01));
    const S = 64;
    const off = rng();
    const c1 = cols[Math.floor(rng() * SECTORS)];
    for (let k = 0; k <= S; k++) {
      const q = cv.getPoint(k / S);
      apos.push(q.x, q.y, q.z);
      at.push(k / S);
      aoff.push(off);
      acol.push(c1.r, c1.g, c1.b);
      if (k > 0) aidx.push(base + k - 1, base + k);
    }
    base += S + 1;
  }
  const ag = new THREE.BufferGeometry();
  ag.setAttribute('position', new THREE.Float32BufferAttribute(apos, 3));
  ag.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1));
  ag.setAttribute('aOff', new THREE.Float32BufferAttribute(aoff, 1));
  ag.setAttribute('aCol', new THREE.Float32BufferAttribute(acol, 3));
  ag.setIndex(aidx);
  const am = new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: ARC_VS,
    fragmentShader: ARC_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  spin.add(new THREE.LineSegments(ag, am));

  // Dust halo.
  const dpos: number[] = [];
  for (let d = 0; d < 160; d++) {
    const u = rng() * 2 - 1;
    const t2 = rng() * Math.PI * 2;
    const rad = 1.45 + rng() * 0.35;
    const rq = Math.sqrt(1 - u * u);
    dpos.push(Math.cos(t2) * rq * rad, u * rad, Math.sin(t2) * rq * rad);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  const dust = new THREE.Points(
    dg,
    new THREE.PointsMaterial({
      color: 0x8fa7c0,
      size: 1.15 * pr,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  dust.visible = false; // no background specks — kept off for a calmer card
  root.add(dust);

  /* ---------- Touch: horizontal drag spins; vertical swipes stay with the app's scroll ---------- */
  let rotY = 0;
  const rotX = 0.08;
  let velY = 0;
  // After a tap (or a category pick from the app), ease that wedge to the front and hold it there.
  let aim: number | null = null;
  let pinned = false;
  const TAU = Math.PI * 2;
  const wrapPi = (d: number) => {
    let x = (d + Math.PI) % TAU;
    if (x < 0) x += TAU;
    return x - Math.PI;
  };
  const faceSector = (index: number) => {
    const center = (index + 0.5) * seg;
    const target = center - Math.PI / 2;
    aim = rotY + wrapPi(target - rotY);
    pinned = true;
    velY = 0;
  };
  let drag: { x: number; y: number; moved: number; horiz: boolean | null } | null = null;
  // 1 on tap, then falls to 0. Drives the neuron flash inside the core.
  let burst = 0;
  const tint = new THREE.Color();
  // Each tap picks a new hue so the flash is never the same colour twice in a row.
  const paintBurst = () => {
    const hue = Math.random();
    const accent = (hue + 0.22 + Math.random() * 0.42) % 1;
    const arr = burstCol.array as Float32Array;
    for (let i = 0; i < burstN; i++) {
      const h = ((i % 4 === 0 ? accent : hue) + (Math.random() - 0.5) * 0.1 + 1) % 1;
      tint.setHSL(h, 0.48 + Math.random() * 0.22, 0.5 + Math.random() * 0.1);
      arr[i * 3] = tint.r;
      arr[i * 3 + 1] = tint.g;
      arr[i * 3 + 2] = tint.b;
    }
    burstCol.needsUpdate = true;
    tint.setHSL(hue, 0.5, 0.56);
    neuNodeMat.uniforms.uTint.value.copy(tint);
    neuLineMat.uniforms.uTint.value.copy(tint);
  };
  const ignite = () => {
    paintBurst();
    burst = 1;
  };

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0, horiz: null };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.horiz === null && drag.moved > 6) drag.horiz = Math.abs(dx) >= Math.abs(dy);
    if (drag.horiz) {
      aim = null;
      pinned = false;
      rotY += dx * 0.009;
      velY = dx * 0.009;
    }
  });
  const up = (e: PointerEvent) => {
    if (drag && drag.moved < 6) {
      ignite();
      // Tap → which segment? Ray-cast onto the globe and read its longitude.
      const b = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (rc.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1.05), hit)) {
        spin.updateMatrixWorld(true);
        spin.worldToLocal(hit);
        let lon = Math.atan2(hit.z, hit.x);
        if (lon < 0) lon += Math.PI * 2;
        const index = Math.min(SECTORS - 1, Math.floor(lon / seg));
        state.sel = index;
        faceSector(index);
        post({ type: 'pick', index });
      }
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => {
    drag = null;
  });

  /* ---------- Render loop ---------- */
  let w = 0;
  let h = 0;
  let born: number | null = null;
  let last: number | null = null;
  const t0 = performance.now();
  let raf = 0;

  const frame = () => {
    raf = 0;
    if (!state.active) return; // Home not visible — stop burning GPU until resumed.
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    for (let i = 0; i < SECTORS; i++) cur[i] += (state.pcts[i] - cur[i]) * 0.12;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (cw !== w || ch !== h) {
      w = cw;
      h = ch;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (born === null) born = t;
    const dt = last === null ? 0 : Math.min(0.05, t - last);
    last = t;
    const age = Math.max(0, t - born);
    // Opening sweep: segments rise, the globe pops in, then a fast spin settles.
    const intro = Math.min(1, age / 1.7);
    const ease = 1 - Math.pow(1 - intro, 3);
    let fill = Math.min(1, age / 1.25);
    fill = 1 - Math.pow(1 - fill, 2.4);
    pm.uniforms.uFill.value = fill;
    time.value = t;
    pm.uniforms.uSel.value = state.sel;
    coreCol.lerp(state.core ? coreTarget : cols[Math.max(0, state.sel)], 0.08);
    const focus = Math.max(0, Math.min(SECTORS - 1, state.sel));
    const raw = Math.max(0, Math.min(10, cur[focus] * 10));
    const scoreLabel = String(Math.round(raw));
    const scoreKey = focus + ':' + scoreLabel;
    // The app now draws the score as real text over the sphere, so no particle digits.
    if (SHOW_PARTICLE_SCORE && scoreKey !== shownScore) {
      shownScore = scoreKey;
      layScore(scoreLabel, cols[focus]);
    }
    if (!drag) {
      if (aim !== null) {
        const delta = aim - rotY;
        rotY += delta * Math.min(1, dt * 6);
        velY = 0;
        if (Math.abs(delta) < 0.012) {
          rotY = aim;
          aim = null;
        }
      } else if (!pinned && !state.paused) {
        const flourish = (1 - intro) * (1 - intro) * 3.4;
        rotY += (0.22 + flourish) * dt + velY;
        velY *= 0.94;
      } else {
        velY *= 0.94;
        rotY += velY;
      }
      const pop = state.paused ? 0.94 + 0.06 * ease : 0.46 + 0.6 * ease + Math.sin(intro * Math.PI) * 0.08;
      spin.scale.setScalar(pop);
    }
    spin.rotation.y = rotY;
    root.rotation.x = rotX;
    ico.rotation.y = -t * 0.25;
    ico.rotation.x = t * 0.12;
    ico2.rotation.y = t * 0.08;
    dust.rotation.y = t * 0.03;
    const beat = t % 1;
    const arrival = Math.sin(Math.min(age, 1.1) * 9.5) * Math.exp(-age * 1.7) * (state.paused ? 0.04 : 0.16);
    // Quick flare, then about three seconds to settle back to the resting sphere.
    burst = Math.max(0, burst - dt / 3);
    neuNodeMat.uniforms.uBurst.value = burst;
    neuLineMat.uniforms.uBurst.value = burst;
    burstMat.uniforms.uBurst.value = burst;
    burstPoints.visible = burst > 0.02;
    heart.scale.setScalar(0.55 * (1 + burst * 0.14));
    coreGroup.scale.setScalar((1 + Math.exp(-Math.pow((beat - 0.1) / 0.06, 2)) * 0.06 + arrival) * (1 + burst * 0.04));
    heart.rotation.y = t * 0.08;
    heart.rotation.x = Math.sin(t * 0.15) * 0.12;
    for (const strand of dnaSpins) strand.rotation.y += dt * (strand.userData.spin as number);
    renderer.render(scene, camera);
  };

  window.wsSphere = {
    update(patch) {
      if (patch.pcts) state.pcts = sectorPcts(patch.pcts);
      if (typeof patch.sel === 'number') {
        const next = Math.max(0, Math.min(SECTORS - 1, Math.round(patch.sel)));
        if (next !== state.sel) {
          state.sel = next;
          faceSector(next);
        }
      }
      if (typeof patch.paused === 'boolean') {
        if (state.paused && !patch.paused) pinned = false;
        state.paused = patch.paused;
      }
      if (typeof patch.core === 'string') {
        state.core = patch.core;
        coreTarget.set(patch.core);
      }
      if (patch.colors && patch.colors.length === SECTORS) {
        patch.colors.forEach((c, i) => cols[i].set(c));
      }
      if (typeof patch.active === 'boolean') {
        const wasActive = state.active;
        state.active = patch.active;
        if (state.active && !wasActive) born = null; // replay the opening move on every visit
        if (state.active && !raf) {
          last = null; // no jump after resume
          raf = requestAnimationFrame(frame);
        }
      }
    },
  };

  raf = requestAnimationFrame(frame);
  post({ type: 'ready' });
}

try {
  start();
} catch (e) {
  const fb = document.getElementById('fallback');
  if (fb) fb.style.display = 'flex';
  post({ type: 'error', message: String((e as Error)?.message ?? e) });
}
