// Small 2D food glyphs (order bubbles, plates on the counter), from the food catalog's colour / accent / shape, so
// a customer's order reads as the same food that sits on the grill.
import { FOODS } from '../../shared/foods.js';

const INK = 'rgba(40,20,20,.7)';

/** Draw food `id` centred at (x, y), about 2r across. */
export function foodGlyph(ctx, id, x, y, r) {
  const f = FOODS[id];
  if (!f) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = INK;
  const fill = (c) => {
    ctx.fillStyle = c;
    ctx.fill();
    ctx.stroke();
  };
  const path = () => ctx.beginPath();
  switch (f.shape) {
    case 'shrimp':
      path();
      ctx.arc(0, 0, r * 0.7, Math.PI * 0.15, Math.PI * 1.7);
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.5;
      ctx.strokeStyle = f.color;
      ctx.stroke();
      path();
      ctx.arc(r * 0.55, -r * 0.45, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#d33';
      ctx.fill();
      break;
    case 'drumstick':
      path();
      ctx.ellipse(-r * 0.15, -r * 0.2, r * 0.55, r * 0.72, 0.6, 0, Math.PI * 2);
      fill(f.color);
      path();
      ctx.rect(r * 0.2, r * 0.25, r * 0.22, r * 0.6);
      fill(f.accent);
      break;
    case 'cob':
      path();
      ctx.ellipse(0, 0, r * 0.4, r * 0.95, 0.4, 0, Math.PI * 2);
      fill(f.color);
      path();
      ctx.moveTo(-r * 0.4, r * 0.9);
      ctx.lineTo(0, r * 0.3);
      ctx.lineTo(r * 0.1, r * 1.05);
      fill(f.accent);
      break;
    case 'cone':
      path();
      ctx.moveTo(-r * 0.35, -r * 0.7);
      ctx.lineTo(r * 0.35, -r * 0.7);
      ctx.lineTo(0, r);
      ctx.closePath();
      fill(f.color);
      path();
      ctx.ellipse(0, -r * 0.85, r * 0.3, r * 0.18, 0, 0, Math.PI * 2);
      fill(f.accent);
      break;
    case 'kebab':
      ctx.fillStyle = '#7a5428';
      ctx.fillRect(-r * 0.06, -r, r * 0.12, r * 2);
      for (const [dy, c] of [[-0.55, f.color], [0, f.accent], [0.55, f.color]]) {
        path();
        ctx.rect(-r * 0.35, dy * r - r * 0.22, r * 0.7, r * 0.44);
        fill(c);
      }
      break;
    case 'mantle':
      path();
      ctx.ellipse(0, -r * 0.25, r * 0.4, r * 0.7, 0, 0, Math.PI * 2);
      fill(f.color);
      ctx.strokeStyle = f.accent;
      ctx.lineWidth = r * 0.1;
      for (const dx of [-0.25, 0, 0.25]) {
        path();
        ctx.moveTo(dx * r, r * 0.4);
        ctx.lineTo(dx * r * 1.4, r);
        ctx.stroke();
      }
      break;
    case 'shell':
      path();
      ctx.moveTo(0, r * 0.7);
      ctx.arc(0, r * 0.7, r * 0.95, Math.PI * 1.15, Math.PI * 1.85);
      ctx.closePath();
      fill(f.color);
      break;
    case 'ring':
      path();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2, true);
      fill(f.color);
      break;
    case 'cap':
      path();
      ctx.rect(-r * 0.18, 0, r * 0.36, r * 0.75);
      fill(f.accent);
      path();
      ctx.ellipse(0, 0, r * 0.8, r * 0.5, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      fill(f.color);
      break;
    case 'bell':
      path();
      ctx.ellipse(0, r * 0.1, r * 0.7, r * 0.75, 0, 0, Math.PI * 2);
      fill(f.color);
      ctx.fillStyle = f.accent;
      ctx.fillRect(-r * 0.08, -r * 0.85, r * 0.16, r * 0.3);
      break;
    case 'link':
      path();
      ctx.roundRect(-r * 0.9, -r * 0.35, r * 1.8, r * 0.7, r * 0.35);
      fill(f.color);
      break;
    case 'fillet':
      path();
      ctx.roundRect(-r * 0.9, -r * 0.5, r * 1.8, r, r * 0.3);
      fill(f.color);
      ctx.strokeStyle = f.accent;
      ctx.lineWidth = r * 0.1;
      for (const dx of [-0.4, 0, 0.4]) {
        path();
        ctx.moveTo(dx * r, -r * 0.4);
        ctx.lineTo(dx * r + r * 0.2, r * 0.4);
        ctx.stroke();
      }
      break;
    case 'loaf':
      path();
      ctx.roundRect(-r * 0.85, -r * 0.6, r * 1.7, r * 1.2, [r * 0.6, r * 0.6, r * 0.15, r * 0.15]);
      fill(f.color);
      break;
    default: // steak
      path();
      ctx.ellipse(0, 0, r * 0.95, r * 0.65, 0, 0, Math.PI * 2);
      fill(f.accent);
      path();
      ctx.ellipse(-r * 0.05, -r * 0.05, r * 0.78, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
  }
  ctx.restore();
}
