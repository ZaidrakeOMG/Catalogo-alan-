/**
 * Gestos del visor GRIPXELL para ratón, Android y Safari en iPhone.
 * Funciones puras, probables sin DOM ni conexión a Supabase.
 */
export function gestureAxis(dx, dy, threshold = 7) {
  if (Math.hypot(dx, dy) < threshold) return 'pending';
  return Math.abs(dx) >= Math.abs(dy) * 1.12 ? 'horizontal' : 'vertical';
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function tiltFromDrag(baseY, baseX, dx, dy, pointerType = 'mouse') {
  const factor = pointerType === 'touch' ? 0.29 : 0.22;
  return {
    y: clamp(baseY + dx * factor, -32, 32),
    x: clamp(baseX - dy * 0.13, -12, 12),
  };
}

export function rotationFromDrag(baseAngle, dx, pointerType = 'mouse') {
  return baseAngle + dx * (pointerType === 'touch' ? 0.96 : 0.77);
}

export function swipeDirection(dx, dy, pointerType = 'mouse') {
  const threshold = pointerType === 'touch' ? 42 : 55;
  return Math.abs(dx) >= threshold && Math.abs(dx) >= Math.abs(dy) * 1.12
    ? (dx < 0 ? 1 : -1)
    : 0;
}

export function isBackFacing(angle) {
  const normalized = ((angle % 360) + 360) % 360;
  return normalized > 90 && normalized < 270;
}
