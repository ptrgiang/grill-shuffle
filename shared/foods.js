// Food catalog: gameplay identity only. Rendering reads `color`/`shape`, but rules only ever compare ids.
// `code` is a single character used in compact serialization and canonical hashes; never reuse or change one.

export const FOODS = Object.freeze({
  beef: { id: 'beef', code: 'b', name: 'Steak', color: '#a8402c', accent: '#f3d3c0', shape: 'steak', category: 'meat' },
  shrimp: { id: 'shrimp', code: 's', name: 'Shrimp', color: '#ff7b54', accent: '#fff1e6', shape: 'shrimp', category: 'seafood' },
  chicken: { id: 'chicken', code: 'c', name: 'Drumstick', color: '#d9902f', accent: '#fbf3e2', shape: 'drumstick', category: 'meat' },
  corn: { id: 'corn', code: 'k', name: 'Corn', color: '#f5c518', accent: '#7cb342', shape: 'cob', category: 'veg' },
  carrot: { id: 'carrot', code: 'r', name: 'Carrot', color: '#ff8f1f', accent: '#4caf50', shape: 'cone', category: 'veg' },
  salmon: { id: 'salmon', code: 'l', name: 'Salmon', color: '#f7a38c', accent: '#ffffff', shape: 'fillet', category: 'seafood' },
  bread: { id: 'bread', code: 'd', name: 'Bread', color: '#d7a25e', accent: '#8a5a2b', shape: 'loaf', category: 'grain' },
});

export const FOOD_IDS = Object.freeze(Object.keys(FOODS));

const BY_CODE = Object.fromEntries(Object.values(FOODS).map((f) => [f.code, f.id]));

export const isFood = (id) => Object.prototype.hasOwnProperty.call(FOODS, id);
export const foodCode = (id) => FOODS[id].code;
export const foodFromCode = (c) => BY_CODE[c] ?? null;
