// /sandbox/food - every procedural food, three seeded variants each, with live cook / char / grill-mark controls.
// ?seed=N picks the seeds, ?spin=0 freezes the turntable (deterministic screenshots), ?grills=1 puts them on grills.
import * as THREE from 'three';
import { Stage } from '../render/stage.js';
import { createFood, foodMaterial, FOOD_MODELS } from '../render/foods.js';
import { GrillView } from '../render/grill.js';
import { FOOD_IDS } from '../../shared/foods.js';

const params = new URLSearchParams(location.search);
let seedBase = Number(params.get('seed') ?? 1);
let spinning = params.get('spin') !== '0';
let onGrills = params.get('grills') === '1';

const stage = new Stage(document.getElementById('stage'), { preserveDrawingBuffer: true });
const root = new THREE.Group();
stage.scene.add(root);
const items = [];

function build() {
  root.clear();
  items.length = 0;
  const cols = FOOD_IDS.length;
  FOOD_IDS.forEach((food, c) => {
    const x = (c - (cols - 1) / 2) * 1.25;
    if (onGrills) {
      const gv = new GrillView({ type: 'grill', slots: [null, null, null] });
      gv.group.rotation.y = Math.PI / 2;
      gv.group.position.set(x, 0, 0);
      root.add(gv.group);
    }
    for (let v = 0; v < 3; v++) {
      const mesh = createFood(food, { seed: seedBase * 31 + c * 7 + v, variant: v });
      mesh.position.set(x, 0, (v - 1) * 1.08);
      mesh.userData.baseYaw = mesh.rotation.y;
      root.add(mesh);
      items.push(mesh);
    }
  });
  stage.frame({ width: cols * 1.25, depth: 3.6, height: 0.6, marginTop: 0, marginBottom: 0 });
}

const $ = (id) => document.getElementById(id);
function bindSlider(id, apply) {
  const el = $(id);
  const out = $(id + 'V');
  const set = () => {
    out.textContent = Number(el.value).toFixed(2);
    apply(Number(el.value));
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
window.addEventListener('resize', () => stage.resize());
stage.start((dt) => {
  if (spinning) for (const m of items) m.rotation.y += dt * 0.6;
});
window.__sandboxReady = true;
