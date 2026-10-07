// HUD icons rendered from the same procedural food models (one offscreen render per food, cached as data URLs),
// so goals in the HUD look exactly like the food on the grill.
import * as THREE from 'three';
import { createFood } from './foods.js';

const cache = new Map();

export function foodIcon(renderer, food, size = 96) {
  if (cache.has(food)) return cache.get(food);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4e6', '#5a3a40', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(-2, 5, 3);
  scene.add(key);
  const mesh = createFood(food, { seed: 3, variant: 0 });
  mesh.rotation.y = 0;
  scene.add(mesh);
  const box = new THREE.Box3().setFromObject(mesh);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 0.1, 20);
  cam.position.set(c.x, c.y + 3.2, c.z + 2.2);
  cam.lookAt(c);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearAlpha();
  const prevColor = renderer.getClearColor(new THREE.Color());
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevClear);
  rt.dispose();
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4); // flip Y
  g.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  cache.set(food, url);
  return url;
}
