// Utilidades puras: interpretar fichas de proveedor en español; no se inventan datos.
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

const brands = [
  ['NAOMICASE', /naomi\s*case|naomicase/i],
  ['MOTOROLA', /motorola|moto\s+g/i],
  ['SAMSUNG', /samsung/i],
  ['XIAOMI', /xiaomi|redmi/i],
  ['ZTE', /\bzte\b/i],
  ['APPLE', /apple|iphone/i],
  ['HONOR', /\bhonor\b/i],
  ['HUAWEI', /huawei/i],
  ['OPPO', /\boppo\b/i],
  ['VIVO', /\bvivo\b/i],
  ['TECNO', /\btecno\b/i],
  ['REALME', /realme/i],
  ['INFINIX', /infinix/i]
];

function findTitle(lines) {
  for (const candidate of lines.slice(0, 15)) {
    if (candidate.length > 70 || candidate.length < 5) continue;
    if (/caracteristicas|especificaciones|distribuidor|telefonia movil|cellstop|smart phones|tama.no de pantalla/i.test(normalize(candidate))) continue;
    for (const [brand, expression] of brands) {
      if (!expression.test(candidate)) continue;
      let model = candidate.replace(expression, ' ').replace(/\b(telefonos?|smart\s*phones?)\b/ig, '').replace(/^[\s:—-]+|[\s:—-]+$/g, '').trim();
      if (brand === 'XIAOMI' && /redmi/i.test(candidate) && !/redmi/i.test(model)) model = `Redmi ${model}`;
      if (brand === 'MOTOROLA' && /moto\s+/i.test(candidate) && !/moto/i.test(model)) model = `Moto ${model}`;
      if (!model || model.length > 50) continue;
      return { marca: brand.charAt(0) + brand.slice(1).toLowerCase(), modelo: model.replace(/\s+/g, ' ') };
    }
  }
  return { marca: '', modelo: '' };
}

const categories = [
  { key: 'Pantalla', re: /^(?:tamano de pantalla|pantalla|display)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Red', re: /^(?:red|conectividad movil|red movil)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Cámara frontal', re: /^(?:camara frontal|frontal|camara selfie)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Cámara trasera', re: /^(?:camara trasera|trasera|principal)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Procesador', re: /^(?:procesador|chipset|cpu)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Memoria interna', re: /^(?:memoria interna real|memoria interna|almacenamiento|rom)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Memoria RAM', re: /^(?:memoria ram|ram)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Memoria', re: /^(?:memoria)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Sistema operativo', re: /^(?:sistema operativo|sistema|s\.o\.)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Linterna', re: /^(?:linterna)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Lector de MicroSD', re: /^(?:lector de microsd|lector microsd|micro\s*sd)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Conexiones inalámbricas', re: /^(?:conexiones inalambricas|wifi|bluetooth)\b\s*[:.-]?\s*(.*)$/i },
  { key: 'Batería', re: /^(?:bateria)\b\s*[:.-]?\s*(.*)$/i },
];
const normalizeValue = (text) => String(text).replace(/^[\s:.,;-]+|[\s;]+$/g, '').replace(/\s+/g, ' ').trim();
const ignore = (line) => /caracteristicas y especificaciones|distribuidor autorizado|servicios de telefonia|cellstop|naomicase.*smart phones/i.test(normalize(line));

export function parseFichaOCR(text) {
  const lines = String(text || '').split(/\r?\n/).map(x => x.replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
  const title = findTitle(lines);
  const specs = new Map();
  let pending = null;
  for (const line of lines) {
    if (ignore(line)) continue;
    const simplified = normalize(line);
    if (simplified === 'camara' || simplified === 'camaras') { pending = null; continue; }
    let category = null, value = '';
    for (const c of categories) {
      const m = simplified.match(c.re);
      if (m) { category = c.key; value = normalizeValue(line.slice(line.length - m[1].length)); break; }
    }
    if (category) {
      pending = category;
      if (value && !/^(si|no|a elegir)$/i.test(value) || (value && ['Linterna', 'Lector de MicroSD'].includes(category))) {
        specs.set(category, value); pending = null;
      }
      continue;
    }
    if (!pending) continue;
    if (/^\s*(caracteristicas|especificaciones|red|camara|memoria|sistema operativo|pantalla|procesador)\b/i.test(simplified)) continue;
    if (line.length > 120 || /(distribuidor|cellstop)/i.test(simplified)) { pending = null; continue; }
    if (/^(\d|android\b|propietario|unisoc|mediatek|quad-core|octa-core|si\b|no\b|rom\b|total\b)/i.test(simplified)) {
      specs.set(pending, normalizeValue(line)); pending = null;
    }
  }
  // Algunos folletos imprimen 'Cámara' y debajo 'Frontal: 8', 'Trasera: 50'.
  const detectedCapacity = specs.get('Memoria interna') || specs.get('Memoria') || '';
  const capacity = detectedCapacity.match(/(\d+(?:[,.]\d+)?\s*(?:GB|MB|TB))/i)?.[1] || '';
  const description = [...specs].map(([key, value]) => `${key}: ${value}`).join('\n');
  return { ...title, capacidad: capacity, descripcion: description, especificaciones: Object.fromEntries(specs), textoOriginal: text };
}
