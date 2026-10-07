// Shared materials. One material per look, created once; meshes share them.
//
// Food material = MeshStandardMaterial + a small shader patch:
//   uCook, uChar (0..1)       cooked tint / charring (edges darken first)
//   uGrillMarkStrength        dark sear lines on the top faces only
//   uGrillMarkAngle, uMarkFreq
//   uStripe, uStripeAngle, uStripeFreq   light bands (salmon fat lines) in object space
// The per-vertex attribute aSear (0..1) says which parts can sear: meat yes, bone / husk / leaves no.
// No textures per food variant: everything is computed from object-space position and normal.
import * as THREE from 'three';
import { embers, brushedMetal, woodPlanks } from './textures.js';

const FOOD_VERT_DECL = `attribute float aSear;
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying float vSear;
`;
const FOOD_FRAG_DECL = `varying vec3 vObjPos;
varying vec3 vObjNormal;
varying float vSear;
uniform float uCook, uChar, uGrillMarkStrength, uGrillMarkAngle, uMarkFreq, uStripe, uStripeAngle, uStripeFreq;
float gsBand(vec2 p, float ang, float freq, float halfWidth) {
  float u = (cos(ang) * p.x + sin(ang) * p.y) * freq;
  float d = abs(fract(u) - 0.5);
  return 1.0 - smoothstep(halfWidth, halfWidth + 0.06, d);
}
`;
const FOOD_FRAG_BODY = `
  {
    float top = smoothstep(0.35, 0.85, vObjNormal.y);
    float mark = gsBand(vObjPos.xz, uGrillMarkAngle, uMarkFreq, 0.09) * top * uGrillMarkStrength * uCook * vSear;
    float stripe = gsBand(vObjPos.xz, uStripeAngle, uStripeFreq, 0.08) * uStripe * step(0.5, vSear) * top;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.95, 0.9), stripe * 0.75);
    diffuseColor.rgb *= 1.0 - 0.6 * mark;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.72, 0.58), uCook * 0.22 + uChar * 0.5);
    diffuseColor.rgb *= 1.0 - uChar * (0.35 + 0.4 * (1.0 - top)) * (0.3 + 0.7 * vSear);
  }
`;

/**
 * @param opts { color, roughness, metalness, vertexColors, cook, char, marks, markAngle, markFreq, stripe, stripeAngle, stripeFreq }
 */
export function createFoodMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0,
    vertexColors: !!opts.vertexColors,
  });
  const uniforms = {
    uCook: { value: opts.cook ?? 0.75 },
    uChar: { value: opts.char ?? 0 },
    uGrillMarkStrength: { value: opts.marks ?? 0 },
    uGrillMarkAngle: { value: opts.markAngle ?? 0.6 },
    uMarkFreq: { value: opts.markFreq ?? 4.2 },
    uStripe: { value: opts.stripe ?? 0 },
    uStripeAngle: { value: opts.stripeAngle ?? -0.5 },
    uStripeFreq: { value: opts.stripeFreq ?? 6 },
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = FOOD_VERT_DECL + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;\n  vObjNormal = normal;\n  vSear = aSear;');
    shader.fragmentShader = FOOD_FRAG_DECL + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>' + FOOD_FRAG_BODY);
  };
  m.customProgramCacheKey = () => 'gs-food-1';
  return m;
}

/** Glowing coals under a grate. Shared by every grill; `heat` (0..1) is per material (hot / locked). */
function createEmberMaterial(heat) {
  const map = embers();
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 }, uHeat: { value: heat } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime; uniform float uHeat; varying vec2 vUv;
      void main() {
        vec2 uv = vUv * vec2(1.6, 0.8);
      #ifdef EMBER_LOW
        vec3 c = texture2D(uMap, uv * 1.15 + vec2(0.0, 0.15)).rgb * 0.78; // one still layer, about as bright as the two
      #else
        vec3 a = texture2D(uMap, uv + vec2(uTime * 0.013, uTime * 0.005)).rgb;
        vec3 b = texture2D(uMap, uv * 1.3 + vec2(-uTime * 0.009, 0.31)).rgb;
        float flick = 0.82 + 0.18 * sin(uTime * 3.1 + vUv.x * 9.0) * sin(uTime * 2.3 + vUv.y * 7.0);
        vec3 c = (a * 0.65 + b * 0.55) * flick;
      #endif
        c = mix(c * vec3(0.35, 0.4, 0.55) * 0.5, c * 1.05, uHeat);
        // fade at the edges of the fire box
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        gl_FragColor = vec4(c * (0.25 + 0.75 * edge), 1.0);
      }`,
    toneMapped: false,
  });
}

let shared = null;
/** The shared non-food materials. */
export function materials() {
  if (shared) return shared;
  const metalMap = brushedMetal();
  const wood = woodPlanks();
  shared = {
    grillBody: new THREE.MeshStandardMaterial({ color: 0x3a3440, map: metalMap, metalness: 0.55, roughness: 0.42 }),
    grillRim: new THREE.MeshStandardMaterial({ color: 0x2a252e, metalness: 0.6, roughness: 0.35 }),
    grate: new THREE.MeshStandardMaterial({ color: 0x1e1b20, metalness: 0.7, roughness: 0.35, emissive: 0x3a0f00, emissiveIntensity: 0.6 }),
    handle: new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.6 }),
    slotPad: new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.0, depthWrite: false }),
    emberHot: createEmberMaterial(1),
    emberCold: createEmberMaterial(0.15),
    tray: new THREE.MeshStandardMaterial({ color: 0xc89660, map: wood, roughness: 0.75 }),
    trayRim: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.7 }),
    table: new THREE.MeshStandardMaterial({ color: 0x9a8070, map: wood, roughness: 0.85 }),
    chain: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.3 }),
    lid: new THREE.MeshStandardMaterial({ color: 0x5c6670, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.38, depthWrite: false }),
    layerPlate: new THREE.MeshStandardMaterial({ color: 0x4a4250, metalness: 0.4, roughness: 0.5 }),
    shadowBlob: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    highlight: new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    target: new THREE.MeshBasicMaterial({ color: 0x9cff9c, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  };
  return shared;
}

/** Ember shader detail (quality tier): 1 = two drifting layers + flicker, 0 = one still layer. */
export function setEmberDetail(level) {
  const m = materials();
  for (const mat of [m.emberHot, m.emberCold]) {
    const low = level < 1;
    if (!!mat.defines.EMBER_LOW === low) continue;
    if (low) mat.defines.EMBER_LOW = 1;
    else delete mat.defines.EMBER_LOW;
    mat.needsUpdate = true;
  }
}

/** Advance time-driven shader uniforms. */
export function tickMaterials(t) {
  const m = materials();
  m.emberHot.uniforms.uTime.value = t;
  m.emberCold.uniforms.uTime.value = t;
}
