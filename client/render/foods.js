// Procedural food models. Every food is ONE merged, vertex-coloured geometry (one draw call per item) built from
// simple primitives, plus per-vertex `aSear` (where grill marks may land). Geometry is cached per (food, variant);
// materials per (food, cook, char). Item-level variation (rotation, scale) is applied by whoever places the mesh.
//
//   createShrimp({ seed, cook, char, scale, variant })  -> THREE.Mesh
//   ... createBeef, createChicken, createCorn, createCarrot, createSalmon, createBread,
//       createSausage, createMushroom, createPepper, createSkewer, createSquid, createScallop, createPineapple
//   createFood(foodId, opts)
//
// Every model sits on y = 0, is centred on x/z, and fits a ~0.95 x 1.2 footprint (x across the grill, z along it).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, hash2 } from '../../shared/rng.js';
import { createFoodMaterial } from './materials.js';

const TAU = Math.PI * 2;
const VARIANTS = 3;

// ------------------------------------------------------------------ geometry helpers

/** Prepare a part: non-indexed, colour + sear attributes. color: hex | (pos, normal, i) => THREE.Color */
function part(geo, color, sear = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  const cols = new Float32Array(n * 3);
  const sears = new Float32Array(n);
  const c = new THREE.Color();
  const p = new THREE.Vector3(), nr = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(g.attributes.position, i);
    nr.fromBufferAttribute(g.attributes.normal, i);
    if (typeof color === 'function') c.copy(color(p, nr, i));
    else c.set(color);
    cols.set([c.r, c.g, c.b], i * 3);
    sears[i] = typeof sear === 'function' ? sear(p, nr, i) : sear;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('aSear', new THREE.BufferAttribute(sears, 1));
  return g;
}

function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Shift so the model rests on y = 0 and is centred on x/z. */
function settle(g) {
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const col = (hex) => new THREE.Color(hex);
const mix = (a, b, t) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));

/** Extrude a flat outline (x right, y = away from the player) into a slab of thickness `depth` lying on the table. */
function slab(shape, depth, bevel, curveSegments = 18) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments, steps: 1 });
  g.rotateX(-Math.PI / 2); // shape plane -> table plane, extrusion -> up
  return g;
}

function blobShape(rx, rz, rng, { wobble = 0.1, points = 36, offX = 0, offZ = 0, scale = 1 } = {}) {
  const ph1 = rng() * TAU, ph2 = rng() * TAU;
  const s = new THREE.Shape();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU;
    const r = scale * (1 + wobble * Math.sin(2 * a + ph1) + wobble * 0.6 * Math.sin(3 * a + ph2));
    const x = offX + rx * r * Math.cos(a), y = offZ + rz * r * Math.sin(a);
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

// ------------------------------------------------------------------ the foods

function shrimpGeometry(rng) {
  const R = 0.27 + rng() * 0.02;
  const a0 = -0.2 * Math.PI, a1 = a0 + (1.32 + rng() * 0.08) * Math.PI;
  const curve = new (class extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) {
      const a = a0 + (a1 - a0) * t;
      return out.set(R * Math.cos(a), 0, R * Math.sin(a));
    }
  })();
  const TS = 48, RS = 14;
  const radius = (t) => {
    let r = 0.165 * (1 - 0.62 * t) + 0.02;
    const seg = (t * 6.5) % 1; // segment ridges
    r *= 1 - 0.09 * Math.exp(-Math.pow((seg - 0.02) / 0.06, 2));
    return r;
  };
  const tube = new THREE.TubeGeometry(curve, TS, 1, RS, false);
  const pos = tube.attributes.position;
  const centre = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= TS; i++) {
    const t = i / TS;
    curve.getPoint(t, centre);
    const r = radius(t);
    for (let j = 0; j <= RS; j++) {
      const k = i * (RS + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(r);
      v.y *= 0.82;
      v.add(centre);
      v.y += r * 0.82;
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  const shell = col('#ff6f45'), belly = col('#ffd2b8'), line = col('#c8442a');
  // colour by the vertex's position along the body (nearest t) and how much it faces up
  const tOf = (p) => {
    let a = Math.atan2(p.z, p.x);
    while (a < a0) a += TAU;
    return Math.max(0, Math.min(1, (a - a0) / (a1 - a0)));
  };
  const body = part(tube, (p, n) => {
    const t = tOf(p);
    const seg = (t * 6.5) % 1;
    let c = mix(belly, shell, (n.y + 0.35) * 1.4);
    if (seg < 0.08) c = mix(c, line, 0.55);
    return c;
  });
  const start = curve.getPoint(0), end = curve.getPoint(1);
  const head = new THREE.SphereGeometry(radius(0), 14, 10);
  head.scale(1, 0.82, 1);
  head.translate(start.x, radius(0) * 0.82, start.z);
  const eye = new THREE.SphereGeometry(0.03, 8, 6);
  eye.translate(start.x - 0.06, radius(0) * 1.45, start.z + 0.05);
  // tail fan: two flattened lobes continuing the curl
  const tan = curve.getTangent(1).normalize();
  const parts = [body, part(head, (p, n) => mix(belly, shell, (n.y + 0.4) * 1.4)), part(eye, '#1d1418', 0)];
  for (const side of [-1, 1]) {
    const lobe = new THREE.SphereGeometry(1, 12, 8);
    lobe.scale(0.15, 0.035, 0.075);
    lobe.translate(0.1, 0, 0);
    lobe.rotateY(-Math.atan2(tan.z, tan.x) + side * 0.45);
    lobe.translate(end.x, 0.06, end.z);
    parts.push(part(lobe, (p) => mix(col('#ff5a33'), col('#a8261a'), 0.3 + 0.7 * Math.min(1, p.distanceTo(end) / 0.22)), 0));
  }
  return settle(merge(parts));
}

function steakGeometry(rng) {
  const rx = 0.43 + rng() * 0.03, rz = 0.33 + rng() * 0.03;
  const outline = blobShape(rx, rz, rng, { wobble: 0.09 });
  const fat = slab(outline, 0.1, 0.035);
  // the meat follows the same outline, a little smaller and shifted: the fat cap shows along one edge
  const pts = outline.getPoints(36).map((p) => p.clone().multiplyScalar(0.88).add(new THREE.Vector2(-0.035, 0.03)));
  const meat = slab(new THREE.Shape(pts), 0.12, 0.035);
  meat.translate(0, 0.012, 0);
  const red = col('#93301f'), dark = col('#5e1c10');
  return settle(
    merge([
      part(fat, (p, n) => mix(col('#f3e2cf'), col('#d9ae8c'), n.y < 0.5 ? 0.6 : 0), 0.35),
      part(meat, (p, n) => mix(red, dark, n.y < 0.5 ? 0.75 : hash2(Math.floor(p.x * 30), Math.floor(p.z * 30), 9) * 0.3), 1),
    ]),
  );
}

function drumstickGeometry(rng) {
  const L = 0.66 + rng() * 0.05;
  const prof = [
    [0.0, 0.0], [0.065, 0.0], [0.075, 0.07], [0.11, 0.17], [0.18, 0.3], [0.225, 0.43], [0.225, 0.54], [0.17, 0.62], [0.06, 0.66], [0.0, 0.665],
  ].map(([r, h]) => new THREE.Vector2(r * (0.95 + rng() * 0.1), h * (L / 0.66)));
  const curve = new THREE.SplineCurve(prof);
  const meat = new THREE.LatheGeometry(curve.getPoints(28), 22);
  meat.scale(1, 1, 0.82);
  const bone = new THREE.CylinderGeometry(0.048, 0.055, 0.32, 10);
  bone.translate(0, -0.13, 0);
  const knobA = new THREE.SphereGeometry(0.072, 12, 8), knobB = new THREE.SphereGeometry(0.072, 12, 8);
  knobA.translate(0.045, -0.3, 0);
  knobB.translate(-0.045, -0.3, 0);
  const golden = col('#d4842e'), crisp = col('#9a5318');
  const g = merge([
    part(meat, (p, n) => mix(golden, crisp, hash2(Math.floor(p.y * 25), Math.floor(Math.atan2(p.z, p.x) * 6), 3) * 0.55 + (n.y < -0.2 ? 0.2 : 0))),
    part(bone, '#f4ebd9', 0),
    part(knobA, '#f7f0e2', 0),
    part(knobB, '#f7f0e2', 0),
  ]);
  g.rotateX(Math.PI / 2); // axis along +z (bone towards the player)
  g.rotateY(Math.PI);
  return settle(g);
}

function cornGeometry(rng) {
  const len = 0.6 + rng() * 0.05, r = 0.19;
  const cob = new THREE.CapsuleGeometry(r, len, 6, 30, 26);
  const pos = cob.attributes.position;
  const v = new THREE.Vector3();
  const ROWS = 12, COLS = 15;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (Math.abs(v.y) > len / 2 + 0.02) continue;
    const a = Math.atan2(v.z, v.x);
    const fr = (((v.y / len + 0.5) * ROWS) % 1 + 1) % 1, fc = (((a / TAU + 0.5) * COLS) % 1 + 1) % 1;
    const bump = Math.sqrt(Math.max(0, Math.sin(fr * Math.PI) * Math.sin(fc * Math.PI)));
    const k = 1 + 0.07 * bump - 0.03;
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  const yellow = col('#f7c623'), gap = col('#c98b0c'), toast = col('#9a5a12');
  const seedC = Math.floor(rng() * 1000);
  const kernels = part(cob, (p) => {
    if (Math.abs(p.y) > len / 2 + 0.02) return mix(yellow, gap, 0.3);
    const a = Math.atan2(p.z, p.x);
    const rowf = (p.y / len + 0.5) * ROWS, colf = (a / TAU + 0.5) * COLS;
    const fr = ((rowf % 1) + 1) % 1, fc = ((colf % 1) + 1) % 1;
    const edge = Math.min(fr, 1 - fr, fc, 1 - fc);
    let c = mix(gap, yellow, edge * 6);
    if (hash2(Math.floor(rowf), Math.floor(colf), seedC) < 0.12) c = mix(c, toast, 0.65);
    return c;
  }, 0.2);
  const parts = [kernels];
  const g = merge(parts);
  g.rotateX(Math.PI / 2); // cob axis along z
  // husk leaves peeled back, lying flat and fanning out from the far end
  const husk = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.12, 0.2, 0, 0.44);
    s.quadraticCurveTo(-0.12, 0.2, 0, 0);
    const leaf = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false, curveSegments: 8 });
    leaf.rotateX(-Math.PI / 2); // flat on the grate, pointing away (-z)
    leaf.scale(1.25, 1, 0.8);
    leaf.rotateY((i - 1) * 1.0);
    leaf.translate((i - 1) * 0.07, 0.02 + (i === 1 ? 0.03 : 0), -len / 2 - r * 0.4);
    husk.push(part(leaf, (p) => mix(col('#cfe39a'), col('#7a9a42'), Math.min(1, Math.abs(p.x) * 4 + 0.15)), 0));
  }
  const all = merge([g, ...husk]);
  return settle(all);
}

function carrotGeometry(rng) {
  const L = 0.72 + rng() * 0.05;
  const prof = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const r = 0.195 * Math.pow(t, 0.55) * (1 - 0.06 * Math.sin(t * 40)) * (t > 0.92 ? Math.sqrt(1 - (t - 0.92) / 0.08 * 0.9) : 1);
    prof.push(new THREE.Vector2(Math.max(0.004, r), t * L));
  }
  prof.push(new THREE.Vector2(0, L));
  const root = new THREE.LatheGeometry(prof, 18);
  const orange = col('#ff8410'), deep = col('#d65a06');
  const parts = [part(root, (p) => mix(orange, deep, (Math.sin(p.y * 46) * 0.5 + 0.5) * 0.45), 0.6)];
  for (let i = 0; i < 4; i++) {
    const stem = new THREE.CylinderGeometry(0.018, 0.024, 0.26, 6);
    stem.translate(0, 0.13, 0);
    stem.rotateZ((i - 1.5) * 0.35);
    stem.rotateX(0.25 * (i % 2 ? 1 : -1));
    stem.translate(0, L - 0.01, 0);
    parts.push(part(stem, '#4f9e2f', 0));
    const tuft = new THREE.SphereGeometry(0.09, 8, 6);
    tuft.scale(1, 0.55, 0.7);
    tuft.translate(0, 0.27, 0);
    tuft.rotateZ((i - 1.5) * 0.35);
    tuft.rotateX(0.25 * (i % 2 ? 1 : -1));
    tuft.translate(0, L - 0.01, 0);
    parts.push(part(tuft, '#5cc23a', 0));
  }
  const g = merge(parts);
  g.rotateX(-Math.PI / 2); // tip towards the player
  g.scale(1, 0.9, 0.95);
  return settle(g);
}

function salmonGeometry(rng) {
  // a fillet portion: rounded thick back edge (away from the player), flatter belly edge, the two cut ends slanted.
  // A dark silver skin rim shows all round: no other food has a dark outline (steak's rim is white fat).
  const w = 0.38 + rng() * 0.03, d = 0.26 + rng() * 0.03, slant = 0.08 + rng() * 0.04;
  const s = new THREE.Shape();
  s.moveTo(-w + slant, -d * 0.78); // belly edge, near the player
  s.bezierCurveTo(-w * 0.3, -d * 0.92, w * 0.3, -d * 0.92, w - slant, -d * 0.74);
  s.quadraticCurveTo(w + 0.02, -d * 0.7, w, -d * 0.4); // right cut
  s.lineTo(w - slant * 0.6, d * 0.45);
  s.bezierCurveTo(w * 0.7, d * 1.12, -w * 0.6, d * 1.18, -w + slant * 0.4, d * 0.55); // rounded back
  s.quadraticCurveTo(-w - 0.03, d * 0.2, -w, -d * 0.3); // left cut
  s.quadraticCurveTo(-w, -d * 0.72, -w + slant, -d * 0.78);
  const flesh = slab(s, 0.13, 0.04, 14);
  flesh.translate(0, 0.05, 0);
  const skin = slab(s, 0.07, 0.025, 14);
  skin.scale(1.13, 1, 1.17);
  const coral = col('#f98479'), side = col('#cf544c');
  return settle(merge([part(flesh, (p, n) => mix(coral, side, n.y < 0.5 ? 0.6 : 0)), part(skin, (p, n) => mix(col('#6b7480'), col('#3a3f49'), n.y < 0.5 ? 0.6 : 0.15), 0)]));
}

function breadGeometry(rng) {
  // a slice of toast: square body, two-lobed top crust
  const s = new THREE.Shape();
  const W = 0.37 + rng() * 0.02, B = 0.34;
  s.moveTo(-W + 0.06, -B);
  s.lineTo(W - 0.06, -B);
  s.quadraticCurveTo(W, -B, W, -B + 0.06);
  s.lineTo(W, 0.12);
  s.bezierCurveTo(W + 0.1, 0.42, 0.1, 0.48, 0, 0.36);
  s.bezierCurveTo(-0.1, 0.48, -W - 0.1, 0.42, -W, 0.12);
  s.lineTo(-W, -B + 0.06);
  s.quadraticCurveTo(-W, -B, -W + 0.06, -B);
  const crust = slab(s, 0.1, 0.03, 16);
  const pts = s.getPoints(40).map((p) => p.clone().multiplyScalar(0.86).add(new THREE.Vector2(0, -0.01)));
  const crumb = slab(new THREE.Shape(pts), 0.105, 0.025, 16);
  crumb.translate(0, 0.012, 0);
  return settle(
    merge([part(crust, (p, n) => mix(col('#b4702f'), col('#7e4a1c'), n.y < 0.5 ? 0.4 : 0.1), 0.2), part(crumb, (p) => mix(col('#f6e0a8'), col('#e9c57c'), hash2(Math.floor(p.x * 40), Math.floor(p.z * 40), 4) * 0.4))]),
  );
}

/** Tube along `curve` whose radius follows radius(t); returns the raw geometry and the per-ring t for colouring. */
function tubeAlong(curve, radius, TS, RS, squashY = 1) {
  const tube = new THREE.TubeGeometry(curve, TS, 1, RS, false);
  const pos = tube.attributes.position;
  const centre = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= TS; i++) {
    curve.getPoint(i / TS, centre);
    const r = radius(i / TS);
    for (let j = 0; j <= RS; j++) {
      const k = i * (RS + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(r);
      v.y *= squashY;
      v.add(centre);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return tube;
}

function sausageGeometry(rng) {
  // a gentle arc lying diagonally, rounded ends with a small twisted tie, scored across the top.
  // The only food that is long AND curved without a curl (shrimp curls into a C), and the only glossy dark red one.
  const L = 0.95 + rng() * 0.05, bend = 0.1 + rng() * 0.04, R = 0.145;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, -L / 2), new THREE.Vector3(bend * 2, 0, 0), new THREE.Vector3(0, 0, L / 2));
  const radius = (t) => {
    const e = Math.min(t, 1 - t) / 0.11; // rounded ends over the last 11 %
    return 0.004 + R * (e >= 1 ? 1 : Math.sqrt(1 - (1 - e) * (1 - e)));
  };
  const casing = col('#a8472c'), under = col('#6e2615'), score = col('#5a1c10'), shine = col('#c8684a');
  const tOf = (p) => Math.max(0, Math.min(1, p.z / L + 0.5));
  const body = part(tubeAlong(curve, radius, 40, 14, 0.85), (p, n) => {
    const t = tOf(p);
    let c = mix(under, casing, (n.y + 0.4) * 1.3);
    if (n.y > 0.75) c = mix(c, shine, 0.35);
    const cut = ((t * 5 + 0.5) % 1 + 1) % 1; // four diagonal scores on the top
    if (t > 0.15 && t < 0.85 && n.y > 0.45 && Math.abs(cut - 0.5 - p.x * 1.6) < 0.06) c = mix(c, score, 0.8);
    return c;
  });
  const parts = [body];
  for (const end of [0, 1]) {
    const tie = new THREE.ConeGeometry(0.028, 0.07, 6);
    const p = curve.getPoint(end), tan = curve.getTangent(end).normalize();
    tie.translate(0, 0.03, 0);
    tie.rotateX(Math.PI / 2); // cone axis y -> z, then aim z outward along the link
    tie.lookAt(tan.clone().multiplyScalar(end ? 1 : -1));
    tie.translate(p.x, 0, p.z);
    parts.push(part(tie, '#4a170d', 0));
  }
  const g = merge(parts);
  g.rotateY(0.55 + rng() * 0.1); // lies diagonally: the long foods all run straight along the grill
  return settle(g);
}

function mushroomGeometry(rng) {
  // a whole mushroom lying on its side: brown domed cap away from the player, cream gills and stem towards them.
  // Side-on is the shape everyone reads as "mushroom"; top-down it would be just a brown disc.
  const R = 0.38 + rng() * 0.025, H = 0.28 + rng() * 0.02;
  const prof = [
    [0.0, 0.06], [0.1, 0.055], [0.2, 0.04], [0.29, 0.02], [0.33, 0.04], [0.35, 0.09], [0.33, 0.16], [0.27, 0.22], [0.17, 0.27], [0.08, 0.29], [0.0, 0.3],
  ].map(([r, h]) => new THREE.Vector2((r * R) / 0.35, (h * H) / 0.3));
  const cap = new THREE.LatheGeometry(prof, 30);
  const capTop = col('#9a7258'), capRim = col('#c8a684'), gill = col('#dcc3a1'), gillLine = col('#a88566');
  const capPart = part(cap, (p, n) => {
    const a = Math.atan2(p.z, p.x), r = Math.hypot(p.x, p.z);
    if (n.y < 0.05 && p.y < H * 0.25) return (Math.sin(a * 28) > 0.55 ? gillLine : gill).clone(); // underside: gills
    let c = mix(capTop, capRim, Math.max(0, (r / R - 0.7) * 3));
    if (hash2(Math.floor(p.x * 18), Math.floor(p.z * 18), 5) > 0.88) c = mix(c, col('#e9d8bf'), 0.5); // a few flecks
    return c;
  }, 0.7);
  const stemR = 0.105 + rng() * 0.01, stemL = 0.3;
  const stem = new THREE.CylinderGeometry(stemR * 0.92, stemR * 1.05, stemL, 14, 1);
  stem.translate(0, 0.06 - stemL / 2, 0);
  const foot = new THREE.SphereGeometry(stemR * 1.05, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2);
  foot.translate(0, 0.06 - stemL, 0);
  const g = merge([capPart, part(stem, (p) => mix(col('#f3ead9'), col('#d9c8ad'), hash2(Math.floor(p.y * 30), 1, 2) * 0.4), 0.3), part(foot, '#cdb999', 0.2)]);
  g.rotateX(-Math.PI / 2 + 0.25); // on its side, cap away from the player, tipped a little so the dome faces the camera
  g.scale(1, 0.8, 1);
  return settle(g);
}

function pepperGeometry(rng) {
  // an upright green bell pepper: four lobes, a dark crease between them, a short stem on a calyx.
  // The only mostly-green food (corn's husk is pale, carrot's greens are small).
  const H = 0.4 + rng() * 0.03, W = 0.33 + rng() * 0.02, twist = rng() * TAU;
  const prof = [[0.0, 0.0], [0.6, 0.02], [0.88, 0.12], [1.0, 0.32], [0.98, 0.6], [0.9, 0.85], [0.62, 0.98], [0.3, 0.97], [0.12, 0.9], [0.0, 0.9]];
  const body = new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r * W, h * H)), 32);
  const pos = body.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x) + twist;
    const lobe = 1 + 0.1 * Math.cos(4 * a) - 0.04 * Math.cos(8 * a);
    const low = v.y < H * 0.15 ? 0.5 + 0.5 * Math.cos(4 * a) : 1; // lobed bottom, four feet
    pos.setXYZ(i, v.x * lobe, v.y * (v.y < H * 0.15 ? 0.6 + 0.4 * low : 1), v.z * lobe);
  }
  const green = col('#3c9a3a'), light = col('#7ccf5e'), crease = col('#1f5d22');
  const parts = [
    part(body, (p, n) => {
      const a = Math.atan2(p.z, p.x) + twist;
      let c = mix(green, light, Math.max(0, n.y - 0.3) * 1.2);
      return mix(c, crease, Math.max(0, -Math.cos(4 * a) - 0.55) * 1.6);
    }, 0.6),
  ];
  const calyx = new THREE.CylinderGeometry(0.09, 0.11, 0.03, 10);
  calyx.translate(0, H * 0.91, 0);
  const stem = new THREE.CylinderGeometry(0.03, 0.038, 0.13, 8);
  stem.translate(0, 0.065, 0);
  stem.rotateZ(0.35 + rng() * 0.2);
  stem.translate(0, H * 0.92, 0);
  parts.push(part(calyx, '#2f6b22', 0), part(stem, (p) => mix(col('#6f8a3a'), col('#a3b46a'), (p.y - H) * 6), 0));
  return settle(merge(parts));
}

function skewerGeometry(rng) {
  // a kebab: a thin wooden stick along the grill, pointed at the far end, threaded with meat, pepper and onion.
  // Long like drumstick / corn / carrot, but segmented into chunks and with bare stick at both ends.
  const len = 1.14, rs = 0.026;
  const stick = new THREE.CylinderGeometry(rs, rs, len - 0.08, 6);
  stick.rotateX(Math.PI / 2);
  stick.translate(0, 0, 0.04);
  const tip = new THREE.ConeGeometry(rs, 0.08, 6);
  tip.rotateX(-Math.PI / 2);
  tip.translate(0, 0, -len / 2 + 0.04);
  const wood = (p) => mix(col('#e2c08a'), col('#b58c55'), hash2(Math.floor(p.z * 40), 0, 7) * 0.5);
  const parts = [part(stick, wood, 0), part(tip, wood, 0)];
  const order = ['meat', 'pepper', 'meat', 'onion', 'meat'];
  const meat = col('#8b4a2b'), meatDark = col('#5e2c17');
  order.forEach((kind, i) => {
    const z = (i - 2) * 0.19 - 0.02;
    let g;
    if (kind === 'meat') {
      const s = 0.22 + rng() * 0.02;
      g = new THREE.BoxGeometry(s, s * 0.95, s * 0.9, 3, 3, 3);
      const p = g.attributes.position, v = new THREE.Vector3();
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        const n = v.clone().normalize().multiplyScalar(v.length());
        v.lerp(n.setLength(s * 0.62), 0.35); // round the cube a little
        p.setXYZ(k, v.x, v.y, v.z);
      }
      g.rotateZ((rng() - 0.5) * 0.5);
      g.rotateY((rng() - 0.5) * 0.4);
      g.translate(0, 0, z);
      parts.push(part(g, (q, n) => mix(meat, meatDark, n.y < 0.4 ? 0.55 : hash2(Math.floor(q.x * 30), Math.floor(q.z * 30), 11) * 0.35), 1));
    } else if (kind === 'pepper') {
      g = new THREE.BoxGeometry(0.27, 0.22, 0.07);
      g.rotateZ((rng() - 0.5) * 0.4);
      g.translate(0, 0, z);
      parts.push(part(g, (q, n) => mix(col('#e0402c'), col('#9e1f14'), n.y < 0.4 ? 0.5 : 0), 0.4));
    } else {
      g = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16, 1, false);
      g.rotateX(Math.PI / 2);
      g.rotateZ((rng() - 0.5) * 0.4);
      g.translate(0, 0, z);
      parts.push(part(g, (q, n) => (Math.abs(n.z) > 0.7 && Math.sin(Math.hypot(q.x, q.y) * 90) > 0.4 ? col('#d9cdb0') : col('#f4ecd8')), 0.3));
    }
  });
  return settle(merge(parts));
}

function squidGeometry(rng) {
  // a whole grilled squid: pale tapered mantle with side fins away from the player, head and curling tentacles
  // towards them. The only pale-white long food; purple flecks and tentacle tips set it apart from carrot and corn.
  const L = 0.62 + rng() * 0.05, R = 0.165;
  const prof = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18; // 0 = open end (near the head), 1 = tip
    const r = R * (t < 0.08 ? 0.86 + t * 1.75 : Math.pow(1 - (t - 0.08) / 0.92, 0.7)) * (1 + 0.03 * Math.sin(t * 30));
    prof.push(new THREE.Vector2(Math.max(0.004, r), t * L));
  }
  const mantle = new THREE.LatheGeometry(prof, 20);
  mantle.scale(1, 1, 0.72);
  const cream = col('#f4e6da'), blush = col('#e9c2c0'), fleck = col('#9a5a8a');
  const seedF = Math.floor(rng() * 1000);
  const parts = [
    part(mantle, (p, n) => {
      let c = mix(blush, cream, n.y * 0.5 + 0.6);
      if (hash2(Math.floor(p.y * 26), Math.floor(Math.atan2(p.z, p.x) * 4), seedF) > 0.8) c = mix(c, fleck, 0.55);
      return c;
    }, 0.9),
  ];
  // fins: two flat lobes either side of the tip
  for (const side of [-1, 1]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.2, 0.06, 0.03, 0.26);
    s.lineTo(0, 0.24);
    const fin = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 8 });
    fin.scale(side, 1, 1);
    fin.translate(side * 0.035, L * 0.62, -0.01);
    parts.push(part(fin, (p) => mix(cream, blush, 0.35), 0.6));
  }
  const head = new THREE.SphereGeometry(0.115, 14, 10);
  head.scale(1, 0.8, 0.75);
  head.translate(0, -0.06, 0);
  parts.push(part(head, (p, n) => mix(blush, cream, n.y * 0.5 + 0.5), 0.5));
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.026, 8, 6);
    eye.translate(side * 0.085, -0.06, 0.04);
    parts.push(part(eye, '#2a1a24', 0));
  }
  // tentacles: thin tubes fanning out towards the player, curling at the ends
  const N = 6;
  for (let i = 0; i < N; i++) {
    const a = (i / (N - 1) - 0.5) * 1.3 + (rng() - 0.5) * 0.12;
    const len = 0.3 + rng() * 0.06 + (i === 1 || i === N - 2 ? 0.08 : 0);
    const curl = (rng() < 0.5 ? -1 : 1) * 0.08;
    const pts = [0, 0.33, 0.66, 1].map((t) => new THREE.Vector3(Math.sin(a) * len * t + curl * t * t, -0.12 - Math.cos(a) * len * t, 0.02 * Math.sin(t * 3)));
    const tube = tubeAlong(new THREE.CatmullRomCurve3(pts), (t) => 0.028 * (1 - 0.75 * t) + 0.004, 12, 6);
    parts.push(part(tube, (p) => mix(col('#ecc9c6'), fleck, Math.min(1, Math.max(0, (-p.y - 0.25) * 3))), 0.3));
  }
  const g = merge(parts);
  g.rotateX(-Math.PI / 2); // tip away from the player, tentacles towards them
  g.scale(1.25, 0.85, 0.95);
  return settle(g);
}

function scallopGeometry(rng) {
  // a scallop on the half shell: a ribbed coral fan (hinge and two ears towards the player) holding a round white
  // muscle. The only fan shape; the ribs and the white puck keep it apart from salmon (coral slab) and steak.
  const R = 0.42 + rng() * 0.03, ribs = 13, hinge = -0.3;
  const s = new THREE.Shape();
  const arc = [];
  for (let i = 0; i <= 64; i++) {
    const a = Math.PI * (0.13 + 0.74 * (i / 64));
    const r = R * (1 + 0.035 * Math.cos(a * ribs * 2));
    arc.push(new THREE.Vector2(Math.cos(a) * r, hinge + 0.1 + Math.sin(a) * r * 0.95));
  }
  s.moveTo(0.2, hinge - 0.04); // right ear
  s.lineTo(0.2, hinge + 0.06);
  s.lineTo(arc[0].x, arc[0].y);
  for (const p of arc) s.lineTo(p.x, p.y);
  s.lineTo(-0.2, hinge + 0.06); // left ear
  s.lineTo(-0.2, hinge - 0.04);
  s.closePath();
  const shell = slab(s, 0.05, 0.02, 12);
  const coral = col('#f08a5d'), pale = col('#f8e4cf'), rib = col('#c9603f');
  const shellPart = part(shell, (p, n) => {
    const a = Math.atan2(-p.z - hinge, p.x);
    const d = Math.hypot(p.x, -p.z - hinge);
    let c = mix(pale, coral, Math.min(1, d / R) * 0.9 + 0.1);
    if (Math.cos(a * ribs * 2) > 0.55 && d > 0.12) c = mix(c, rib, 0.45);
    return n.y < 0.5 ? mix(c, rib, 0.4) : c;
  }, 0.2);
  const meatR = 0.16 + rng() * 0.015;
  const meat = new THREE.CylinderGeometry(meatR, meatR * 1.04, 0.12, 22, 2);
  meat.translate(0, 0.1, -(hinge + 0.1 + R * 0.42));
  const meatPart = part(meat, (p, n) => mix(col('#fbf3e6'), col('#e9d7c0'), n.y > 0.5 ? hash2(Math.floor(p.x * 30), Math.floor(p.z * 30), 13) * 0.4 : 0.3), 1);
  return settle(merge([shellPart, meatPart]));
}

function pineappleGeometry(rng) {
  // a grilled pineapple ring: a thick golden ring with a hole and an orange rind edge. The only food with a hole;
  // round and flat against corn's long cob.
  const R = 0.36 + rng() * 0.02, r = 0.09 + rng() * 0.01, squash = 0.94 + rng() * 0.06;
  const s = new THREE.Shape();
  s.absellipse(0, 0, R, R * squash, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path(Array.from({ length: 33 }, (_, i) => new THREE.Vector2(Math.cos((-i / 32) * TAU) * r, Math.sin((-i / 32) * TAU) * r)));
  s.holes.push(hole);
  const ring = slab(s, 0.1, 0.03, 40);
  const gold = col('#f7cf4a'), rind = col('#c98a1c'), core = col('#fbe9a6');
  // the pale woody core: its own thin ring around the hole (vertex colours cannot draw a smooth radial gradient on
  // the ring's long top triangles)
  const circle = (rad, n = 32, dir = 1) => Array.from({ length: n + 1 }, (_, i) => new THREE.Vector2(Math.cos((dir * i / n) * TAU) * rad, Math.sin((dir * i / n) * TAU) * rad));
  const coreShape = new THREE.Shape(circle(r + 0.06));
  coreShape.holes.push(new THREE.Path(circle(r, 32, -1)));
  const coreRing = slab(coreShape, 0.004, 0.0, 32);
  coreRing.translate(0, 0.128, 0);
  return settle(
    merge([
      part(ring, (p, n) => (n.y < 0.5 ? (Math.hypot(p.x, p.z / squash) > (R + r) / 2 ? rind.clone() : core.clone()) : mix(gold, rind, hash2(Math.floor(p.x * 24), Math.floor(p.z * 24), 17) * 0.12)), 1),
      part(coreRing, core, 0.4),
    ]),
  );
}

// ------------------------------------------------------------------ registry

export const FOOD_MODELS = Object.freeze({
  shrimp: { geometry: shrimpGeometry, material: { roughness: 0.45, marks: 0, cook: 0.6 } },
  beef: { geometry: steakGeometry, material: { roughness: 0.6, marks: 1, markAngle: 0.7, markFreq: 4.6, cook: 0.8 } },
  chicken: { geometry: drumstickGeometry, material: { roughness: 0.4, marks: 0.8, markAngle: 0.0, markFreq: 5.5, cook: 0.7 } },
  corn: { geometry: cornGeometry, material: { roughness: 0.5, marks: 0.6, markAngle: 1.57, markFreq: 3.2, cook: 0.6 } },
  carrot: { geometry: carrotGeometry, material: { roughness: 0.55, marks: 0.6, markAngle: 1.57, markFreq: 4, cook: 0.6 } },
  salmon: { geometry: salmonGeometry, material: { roughness: 0.38, marks: 0, cook: 0.45, stripe: 1, stripeAngle: -1.15, stripeFreq: 6 } },
  bread: { geometry: breadGeometry, material: { roughness: 0.75, marks: 1, markAngle: 0.8, markFreq: 4.4, cook: 0.9 } },
  sausage: { geometry: sausageGeometry, material: { roughness: 0.28, marks: 0.8, markAngle: 0.0, markFreq: 5, cook: 0.6 } },
  mushroom: { geometry: mushroomGeometry, material: { roughness: 0.65, marks: 0.5, markAngle: 1.2, markFreq: 5, cook: 0.5 } },
  pepper: { geometry: pepperGeometry, material: { roughness: 0.22, marks: 0.5, markAngle: 0.4, markFreq: 4.5, cook: 0.35 } },
  skewer: { geometry: skewerGeometry, material: { roughness: 0.5, marks: 0.7, markAngle: 1.57, markFreq: 9, cook: 0.6 } },
  squid: { geometry: squidGeometry, material: { roughness: 0.35, marks: 0.8, markAngle: 0.0, markFreq: 6, cook: 0.5 } },
  scallop: { geometry: scallopGeometry, material: { roughness: 0.45, marks: 0.6, markAngle: 0.8, markFreq: 9, cook: 0.6 } },
  pineapple: { geometry: pineappleGeometry, material: { roughness: 0.4, marks: 1, markAngle: 0.7, markFreq: 5, cook: 0.6 } },
});

const geoCache = new Map();
const matCache = new Map();

export function foodGeometry(food, variant = 0) {
  const key = `${food}:${variant % VARIANTS}`;
  if (!geoCache.has(key)) geoCache.set(key, FOOD_MODELS[food].geometry(mulberry32(1000 + (variant % VARIANTS) * 7919 + food.length * 31)));
  return geoCache.get(key);
}

/** `tint` (optional colour) multiplies the food's colour: used to blacken charred items. */
export function foodMaterial(food, { cook, char = 0, tint = null } = {}) {
  const base = FOOD_MODELS[food].material;
  const c = cook ?? base.cook;
  const key = `${food}:${c.toFixed(2)}:${char.toFixed(2)}${tint ? `:${tint}` : ''}`;
  const color = tint ? new THREE.Color(base.color ?? 0xffffff).multiply(new THREE.Color(tint)) : base.color;
  if (!matCache.has(key)) matCache.set(key, createFoodMaterial({ ...base, cook: c, char, color, vertexColors: true }));
  return matCache.get(key);
}

/** Per-item deterministic look from its seed: variant, small rotation and size jitter. */
export function itemLook(seed) {
  const r = mulberry32(seed * 2654435761);
  return { variant: Math.floor(r() * VARIANTS), yaw: (r() - 0.5) * 0.28, scale: 0.95 + r() * 0.08 };
}

export function createFood(food, { seed = 0, cook, char = 0, scale = 1, variant } = {}) {
  const look = itemLook(seed);
  const mesh = new THREE.Mesh(foodGeometry(food, variant ?? look.variant), foodMaterial(food, { cook, char }));
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.scale.setScalar(scale * look.scale);
  mesh.rotation.y = look.yaw;
  mesh.userData.food = food;
  return mesh;
}

export const createShrimp = (o) => createFood('shrimp', o);
export const createBeef = (o) => createFood('beef', o);
export const createChicken = (o) => createFood('chicken', o);
export const createCorn = (o) => createFood('corn', o);
export const createCarrot = (o) => createFood('carrot', o);
export const createSalmon = (o) => createFood('salmon', o);
export const createBread = (o) => createFood('bread', o);
export const createSausage = (o) => createFood('sausage', o);
export const createMushroom = (o) => createFood('mushroom', o);
export const createPepper = (o) => createFood('pepper', o);
export const createSkewer = (o) => createFood('skewer', o);
export const createSquid = (o) => createFood('squid', o);
export const createScallop = (o) => createFood('scallop', o);
export const createPineapple = (o) => createFood('pineapple', o);
