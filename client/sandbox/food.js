// /sandbox/food - every procedural food, three seeded variants each, with live cook / char / grill-mark controls.
// ?seed=N picks the seeds, ?spin=0 freezes the turntable (deterministic screenshots), ?grills=1 puts them on grills,
// ?ui=0 hides the control panel (clean lineup shots, e.g. the 390 px readability check), ?theme=<id> lights it with a theme.
import * as THREE from 'three';
import { Stage } from '../render/stage.js';
import { IdleGate } from '../render/quality.js';
import { createFood, foodMaterial, FOOD_MODELS } from '../render/foods.js';
import { GrillView } from '../render/grill.js';
import { FOOD_IDS } from '../../shared/foods.js';
import { themeFromUrl } from './themes.js';

const params = new URLSearchParams(location.search);
let seedBase = Number(params.get('seed') ?? 1);
let spinning = params.get('spin') !== '0';
let onGrills = params.get('grills') === '1';

const stage = new Stage(document.getElementById('stage'), { theme: themeFromUrl(params) ?? {}, preserveDrawingBuffer: true });
const root = new THREE.Group();
stage.scene.add(root);
const items = [];

// Landscape: one column per food, variants down the column. Portrait (phones): one row per food, variants across,
// so the lineup stays readable at 360-430 px.
function build() {
  stage.invalidate();
  root.clear();
  items.length = 0;
  const n = FOOD_IDS.length;
  const portrait = innerWidth < innerHeight;
  const pitch = portrait ? 1.4 : 1.25; // long foods (drumstick, cob, carrot) lie along z
  FOOD_IDS.forEach((food, c) => {
    const along = (c - (n - 1) / 2) * pitch;
    if (onGrills) {
      const gv = new GrillView({ type: 'grill', slots: [null, null, null] });
      if (portrait) gv.group.position.set(0, 0, along);
      else {
        gv.group.rotation.y = Math.PI / 2;
        gv.group.position.set(along, 0, 0);
      }
      root.add(gv.group);
    }
    for (let v = 0; v < 3; v++) {
      const mesh = createFood(food, { seed: seedBase * 31 + c * 7 + v, variant: v });
      const across = (v - 1) * 1.08;
      if (portrait) mesh.position.set(across, 0, along);
      else mesh.position.set(along, 0, across);
      mesh.userData.baseYaw = mesh.rotation.y;
      root.add(mesh);
      items.push(mesh);
    }
  });
  if (portrait) stage.frame({ width: 3.6, depth: n * pitch, height: 0.6, marginTop: 0, marginBottom: 0 });
  else stage.frame({ width: n * pitch, depth: 3.6, height: 0.6, marginTop: 0, marginBottom: 0 });
}

const $ = (id) => document.getElementById(id);
if (params.get('ui') === '0') $('panel').hidden = true;
function bindSlider(id, apply) {
  const el = $(id);
  const out = $(id + 'V');
  const set = () => {
    out.textContent = Number(el.value).toFixed(2);
    apply(Number(el.value));
    stage.invalidate(); // a uniform changed: a frozen, idle stage draws again
  };
  el.addEventListener('input', set);
  set();
}
$('cook').value = 0.75;
bindSlider('cook', (v) => FOOD_IDS.forEach((f) => (foodMaterial(f).userData.uniforms.uCook.value = v)));
bindSlider('char', (v) => FOOD_IDS.forEach((f) => (foodMaterial(f).userData.uniforms.uChar.value = v)));
bindSlider('marks', (v) => FOOD_IDS.forEach((f) => (foodMaterial(f).userData.uniforms.uGrillMarkStrength.value = v * (FOOD_MODELS[f].material.marks ?? 0))));
$('reseed').onclick = () => {
  seedBase++;
  build();
};
$('spin').onclick = () => (spinning = !spinning);
$('grills').onclick = () => {
  onGrills = !onGrills;
  build();
};

build();
window.addEventListener('resize', () => {
  stage.resize();
  build();
});
const idle = stage.frozen ? IdleGate.for(true) : null; // frozen stills: on demand, see sandbox/board.js
stage.start(
  (dt) => {
    if (spinning) for (const m of items) m.rotation.y += dt * 0.6;
  },
  { gate: idle && ((dt) => idle.tick(dt, spinning || stage.busy)) },
);
window.__sandboxReady = true;
