const TAU = Math.PI * 2;

// One gift in each angular sector preserves the complete ring while radial,
// angular, scale, color and rotation variation make it feel naturally scattered.
export function createGiftLayout({ mobile = false, random = Math.random } = {}) {
  const count = mobile ? 18 : 24, inner = mobile ? 2.9 : 3.15, outer = mobile ? 3.65 : 4.4;
  const between = (a, b) => a + random() * (b - a), layout = [];
  for (let i = 0; i < count; i++) {
    let gift;
    for (let attempt = 0; attempt < 240; attempt++) {
      const shrink = attempt < 60 ? 1 : attempt < 130 ? .8 : .6;
      const w = between(.43, mobile ? .79 : .99) * shrink, d = w * between(.72, 1.08);
      const angle = (i + between(.10, .90)) / count * TAU, radius = between(inner, outer);
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      const footprint = Math.hypot(w + .08, d + .08) * .5;
      if (layout.some(other => Math.hypot(x - other.x, z - other.z) < footprint + other.footprint + .055)) continue;
      gift = { x, z, angle, radius, w, d, h: between(.32, 1.04), footprint,
        rotation: between(-Math.PI, Math.PI), paper: Math.floor(between(0, 6)),
        ribbon: Math.floor(between(0, 3)), round: random() < .20 };
      break;
    }
    if (!gift) throw new Error('Could not find a clear spot for a Christmas gift');
    layout.push(gift);
  }
  return layout;
}
