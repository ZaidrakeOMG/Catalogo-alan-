import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { gestureAxis, tiltFromDrag, rotationFromDrag, swipeDirection, isBackFacing } from '../src/lib/visor-touch.js';

test('un toque pequeño no gira la imagen accidentalmente', () => {
  assert.equal(gestureAxis(2, 1), 'pending');
  assert.equal(swipeDirection(12, 1, 'touch'), 0);
});

test('el scroll vertical en móvil sigue siendo vertical, no cambia de teléfono', () => {
  assert.equal(gestureAxis(9, 55), 'vertical');
  assert.equal(swipeDirection(9, 55, 'touch'), 0);
});

test('arrastrar horizontal en iPhone y Android cambia perspectivas', () => {
  assert.equal(gestureAxis(-95, 10), 'horizontal');
  assert.equal(swipeDirection(-95, 10, 'touch'), 1);
  assert.equal(swipeDirection(95, 10, 'touch'), -1);
});

test('la inclinación con una sola foto es visible pero limitada, sin fingir 360°', () => {
  const right = tiltFromDrag(0, 0, 120, 10, 'touch');
  assert.ok(right.y > 25 && right.y <= 32);
  assert.ok(Math.abs(right.x) < 12);
  assert.equal(tiltFromDrag(0, 0, 900, 500, 'touch').y, 32);
  assert.equal(tiltFromDrag(0, 0, -900, -500, 'touch').y, -32);
});

test('el giro con dos fotos conserva ángulo y reconoce tapa trasera', () => {
  assert.equal(rotationFromDrag(30, 160, 'touch'), 183.6);
  assert.equal(isBackFacing(183.6), true);
  assert.equal(isBackFacing(0), false);
  assert.equal(isBackFacing(-180), true);
});
