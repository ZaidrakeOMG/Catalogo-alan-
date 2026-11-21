import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFichaOCR } from '../src/lib/ficha-automatica.js';

test('Reconoce marca, modelo y características Motorola', () => {
  const x = parseFichaOCR('MOTOROLA G06\nRed\n4G\nCámara\nFrontal: 8\nTrasera: 50\nPantalla\n6.8\nProcesador\nMediatek Helio G81 Extreme\nMemoria\n64 GB\nSistema Operativo\nAndroid 15');
  assert.equal(x.marca,'Motorola');assert.equal(x.modelo,'G06');
  assert.equal(x.especificaciones['Cámara trasera'],'50');
  assert.equal(x.capacidad,'64 GB');
});
test('Reconoce teléfono básico y su RAM',()=>{
  const x=parseFichaOCR('NAOMICASE ROMY V2\nTamaño de pantalla: 1.77"\nSistema Operativo: Propietario.\nRed:2g.\nMemoria interna real: 32 MB.\nMemoria RAM: 32 MB\nLinterna: Si\nLector de MicroSD: Sí');
  assert.equal(x.marca,'Naomicase');assert.equal(x.modelo,'ROMY V2');
  assert.equal(x.especificaciones['Memoria RAM'],'32 MB');
});
test('No fabrica características cuando no existen',()=>{
  const x=parseFichaOCR('FOTO DE MODELO\nInformación no disponible');
  assert.equal(x.descripcion,'');assert.equal(x.modelo,'');
});
