/// <reference lib="dom" />
/**
 * Wellness sphere — the particle globe from wellnesshift.co.uk (public/health-3d.html),
 * ported for the in-app Body HUD WebView.
 *
 * Eight longitude segments — the same wellness categories as the home score
 * (physical, nutrition, mental, social, environment, fitness, sleep, mindfulness) —
 * fill bottom-to-top to that category's score, around a pulsing core with neural
 * sparks, two wireframe icosahedra, data arcs and dust.
 *
 * Bundled by `npm run bundle:sphere` into src/components/home/bodyHud/wellnessSphereHtml.ts.
 *
 * Bridge
 *   RN → web:  window.wsSphere.update({ pcts?, colors?, sel?, paused?, active? })
 *   web → RN:  { type: 'ready' } | { type: 'pick', index } | { type: 'error', message }
 */
import * as THREE from 'three';

type SphereState = {
  pcts: number[];
  colors: string[];
  sel: number;
  paused: boolean;
  active: boolean;
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
  'uniform float uPct[10]; uniform vec3 uCol[10]; uniform float uSel; uniform float uTime; uniform float uFill; uniform float uPR;',
  'varying vec3 vC; varying float vA;',
  'void main(){',
  ' float pct = 0.0; vec3 col = vec3(1.0);',
  ' for (int i = 0; i < 10; i++) { if (abs(float(i) - aSector) < 0.5) { pct = uPct[i]; col = uCol[i]; } }',
  ' pct *= uFill;',
  ' float isSel = 1.0 - step(0.5, abs(aSector - uSel));',
  ' float filled = step(aLat, pct);',
  ' float edge = (1.0 - smoothstep(0.0, 0.02, abs(aLat - pct))) * step(0.02, pct);',
  ' vec3 p = position;',
  ' float wave = sin(uTime * 1.6 + aPhase * 6.283 + p.y * 7.0) * 0.014 + sin(uTime * 0.9 + p.x * 5.0 + p.z * 3.0) * 0.01;',
  ' p *= 1.0 + wave * filled + isSel * 0.16 * filled + edge * 0.035 + isSel * 0.04;',
  ' vec4 mv = modelViewMatrix * vec4(p, 1.0);',
  ' gl_Position = projectionMatrix * mv;',
  ' float sz = mix(1.3, 2.45 + isSel * 0.75, filled) * (1.0 + edge * 1.7);',
  ' gl_PointSize = uPR * sz * (4.6 / -mv.z);',
  ' vec3 vivid = clamp(col * 1.35, 0.0, 1.0);',
  ' vec3 base = mix(vec3(0.08, 0.10, 0.14), vivid * (1.05 + 0.28 * isSel), filled);',
  ' base = mix(base, vec3(1.0), edge * 0.92);',
  ' base *= mix(1.0, 0.92, (1.0 - isSel) * filled);',
  ' vC = base;',
  ' vec3 nv = normalize(normalMatrix * position);',
  ' float facing = 0.55 + 0.45 * smoothstep(-0.2, 0.65, nv.z);',
  ' vA = mix(0.38, 1.0, filled) * (0.9 + 0.1 * sin(uTime * 3.0 + aPhase * 40.0)) * facing;',
  '}',
].join('\n');
const ORB_FS = [
  'varying vec3 vC; varying float vA;',
  'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;',
  ' float core = 1.0 - smoothstep(0.0, 0.5, d); gl_FragColor = vec4(vC * (0.7 + core * 0.6), vA * core); }',
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
  ' gl_FragColor = vec4(mix(uCol, vec3(1.0), f * 0.35) * uGain * pulse, f * pulse); }',
].join('\n');
const ARC_VS = [
  'attribute float aT; attribute float aOff; attribute vec3 aCol; uniform float uTime; varying float vA; varying vec3 vC;',
  'void main(){ vC = aCol; float h = fract(uTime * 0.22 + aOff);',
  ' float d = aT - h; float head = smoothstep(-0.16, 0.0, d) * (1.0 - smoothstep(0.0, 0.015, d));',
  ' vA = 0.07 + head * 0.95; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
].join('\n');
const ARC_FS = 'varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * 1.3, vA); }';
const NEU_LVS = [
  'attribute float aT; attribute float aOff; attribute float aSpd; uniform float uTime; varying float vT; varying float vOff; varying float vSpd;',
  'void main(){ vT = aT; vOff = aOff; vSpd = aSpd; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
].join('\n');
const NEU_LFS = [
  'uniform vec3 uCol; uniform float uTime; varying float vT; varying float vOff; varying float vSpd;',
  'void main(){ float cyc = uTime * vSpd + vOff; float head = fract(cyc); float on = step(0.45, fract(cyc * 0.37 + vOff * 3.1));',
  ' float d = vT - head; float spark = (1.0 - smoothstep(0.0, 0.05, abs(d))) + smoothstep(-0.3, 0.0, d) * (1.0 - step(0.0, d)) * 0.5;',
  ' gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.6 * spark) * 1.3, 0.18 + spark * on * 1.0); }',
].join('\n');
const NEU_PVS = [
  'attribute float aPhase; attribute float aRate; uniform float uTime; uniform float uPR; varying float vF;',
  'void main(){ float f = pow(0.5 + 0.5 * sin(uTime * aRate + aPhase), 14.0); vF = f;',
  ' vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPR * (3.0 + f * 8.0) * (4.6 / -mv.z); }',
].join('\n');
const NEU_PFS = [
  'uniform vec3 uCol; varying float vF;',
  'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float core = 1.0 - smoothstep(0.0, 0.5, d);',
  ' gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.45 + vF * 0.55) * 1.3, core * (0.6 + vF * 0.4)); }',
].join('\n');

/** Same seeded RNG as the website so the globe looks identical. */
function rngOf(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** One segment per home wellness category (all ten), in WELLNESS_CATEGORIES order. */
const SECTORS = 10;
const DEFAULT_COLORS = [
  '#389EFA',
  '#2EDBBD',
  '#946BFA',
  '#FF8561',
  '#2EDBBD',
  '#389EFA',
  '#946BFA',
  '#2EDBBD',
  '#FA5C94',
  '#FF8561',
];

function clamp01(v: number) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

function sectorPcts(src?: number[]) {
  const out = new Array<number>(SECTORS).fill(0);
  for (let i = 0; i < SECTORS; i++) out[i] = clamp01(src?.[i] ?? 0);
  return out;
}

const init = window.__WS_SPHERE_INIT__ ?? {};
const state: SphereState = {
  pcts: sectorPcts(init.pcts),
  colors: init.colors?.length === SECTORS ? init.colors : DEFAULT_COLORS,
  sel: init.sel ?? 0,
  paused: !!init.paused,
  active: init.active !== false,
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
  camera.position.set(0, 0.35, 4.9);
  camera.lookAt(0, 0, 0);
  const time = { value: 0 };
  const root = new THREE.Group();
  root.rotation.x = 0.22;
  scene.add(root);
  const spin = new THREE.Group();
  root.add(spin);

  const cols = state.colors.map((c) => new THREE.Color(c));
  const cur = state.pcts.slice();

  // Fibonacci globe split into one longitude segment per wellness category.
  const N = 14000;
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
  const coreCol = cols[state.sel].clone();
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
  coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 64, 48), coreMat(2.2, 1.2)));
  coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), coreMat(0.6, 1.6)));

  // Neural sparks inside the core.
  const nrng = rngOf(4711);
  const nodes: THREE.Vector3[] = [];
  while (nodes.length < 90) {
    const nx = nrng() * 2 - 1;
    const ny = nrng() * 2 - 1;
    const nz = nrng() * 2 - 1;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl > 1 || nl < 0.25) continue;
    nodes.push(new THREE.Vector3(nx, ny, nz).multiplyScalar(0.41));
  }
  const npos: number[] = [];
  const nph: number[] = [];
  const nrate: number[] = [];
  nodes.forEach((v) => {
    npos.push(v.x, v.y, v.z);
    nph.push(nrng() * 6.283);
    nrate.push(0.8 + nrng() * 2.4);
  });
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
  ng.setAttribute('aPhase', new THREE.Float32BufferAttribute(nph, 1));
  ng.setAttribute('aRate', new THREE.Float32BufferAttribute(nrate, 1));
  const neuNodeMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: coreCol }, uTime: time, uPR: { value: pr } },
    vertexShader: NEU_PVS,
    fragmentShader: NEU_PFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lpos: number[] = [];
  const lt: number[] = [];
  const loff: number[] = [];
  const lspd: number[] = [];
  const seen: Record<string, 1> = {};
  nodes.forEach((v, i) => {
    const near = nodes
      .map((w, j) => ({ j, d: v.distanceTo(w) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    near.forEach((x) => {
      const key = Math.min(i, x.j) + '-' + Math.max(i, x.j);
      if (seen[key]) return;
      seen[key] = 1;
      const w = nodes[x.j];
      const fwd = nrng() > 0.5;
      const A = fwd ? v : w;
      const B = fwd ? w : v;
      const off = nrng();
      const spd = 0.35 + nrng() * 0.9;
      lpos.push(A.x, A.y, A.z, B.x, B.y, B.z);
      lt.push(0, 1);
      loff.push(off, off);
      lspd.push(spd, spd);
    });
  });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
  lg.setAttribute('aT', new THREE.Float32BufferAttribute(lt, 1));
  lg.setAttribute('aOff', new THREE.Float32BufferAttribute(loff, 1));
  lg.setAttribute('aSpd', new THREE.Float32BufferAttribute(lspd, 1));
  const neuLineMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: coreCol }, uTime: time },
    vertexShader: NEU_LVS,
    fragmentShader: NEU_LFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const heart = new THREE.Group();
  heart.add(new THREE.LineSegments(lg, neuLineMat));
  heart.add(new THREE.Points(ng, neuNodeMat));
  coreGroup.add(heart);

  const wireMat = new THREE.LineBasicMaterial({
    color: coreCol,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ico = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 1)), wireMat);
  const wireMat2 = new THREE.LineBasicMaterial({
    color: 0x9fb3c8,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ico2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.82, 2)), wireMat2);
  coreGroup.add(ico);
  coreGroup.add(ico2);
  root.add(coreGroup);

  // Data arcs travelling between segments.
  const apos: number[] = [];
  const at: number[] = [];
  const aoff: number[] = [];
  const acol: number[] = [];
  const aidx: number[] = [];
  let base = 0;
  for (let a = 0; a < 22; a++) {
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
    const c1 = cols[s1];
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
  for (let d = 0; d < 700; d++) {
    const u = rng() * 2 - 1;
    const t2 = rng() * Math.PI * 2;
    const rad = 1.45 + rng() * 0.9;
    const rq = Math.sqrt(1 - u * u);
    dpos.push(Math.cos(t2) * rq * rad, u * rad, Math.sin(t2) * rq * rad);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  const dust = new THREE.Points(
    dg,
    new THREE.PointsMaterial({
      color: 0x8fa7c0,
      size: 1.4 * pr,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  root.add(dust);

  /* ---------- Touch: horizontal drag spins; vertical swipes stay with the app's scroll ---------- */
  let rotY = 0;
  const rotX = 0.22;
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
    coreCol.lerp(cols[state.sel], 0.08);
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
    coreGroup.scale.setScalar(1 + Math.exp(-Math.pow((beat - 0.1) / 0.06, 2)) * 0.06 + arrival);
    heart.rotation.y = t * 0.12;
    heart.rotation.x = Math.sin(t * 0.2) * 0.2;
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
