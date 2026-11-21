import { supabase, TABLES, BUCKET, publicImageUrl, currency, slugify, cleanPhone, toast } from '../lib/supabase.js';
import { recortarTelefonoPNG, isHorizontalSheet } from '../lib/recorte-png.js';
import { parseFichaOCR } from '../lib/ficha-automatica.js';

const $ = (id) => document.getElementById(id);
const state = { products: [], settings: null, user: null, editId: null, filter: '', statusFilter: 'all', sort: 'newest', importedCover: null, analyzing: false };
const previewObjectUrls = new Map();
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const PHOTO_TYPES = { cover:'foto_portada_path', front:'foto_frontal_path', right:'foto_lateral_derecha_path', back:'foto_trasera_path', left:'foto_lateral_izquierda_path' };
const PHOTO_LABELS = { cover:'portada', front:'frente',right:'derecha',back:'reverso',left:'izquierda' };
const ownedImage = (path) => typeof path === 'string' && /^(celulares|logos)\//.test(path);

function el(tag, cls, content) {
  const item = document.createElement(tag);
  if (cls) item.className = cls;
  if (content !== undefined) item.textContent = content;
  return item;
}
function errorText(err) { return err?.message || 'Ocurrió un problema inesperado.'; }
function showError(where, message) { const node = $(where); node.textContent = message; node.hidden = false; }
function hideError(where) { const node = $(where); node.textContent = ''; node.hidden = true; }
function setButtonBusy(button, busy, label) {
  if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.originalLabel;
}

async function validateAdmin(user) {
  if (!user?.id) return false;
  const { data, error } = await supabase().from(TABLES.admins).select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data?.user_id === user.id);
}
async function switchToDashboard(user) {
  state.user = user;
  $('admin-user-email').textContent = user.email || 'Administrador';
  $('admin-login').hidden = true;
  $('admin-app').hidden = false;
  await refreshDashboard();
}
async function ensureSession() {
  try {
    const { data: { user }, error } = await supabase().auth.getUser();
    if (error && !/session missing/i.test(error.message)) throw error;
    if (!user) return;
    if (!(await validateAdmin(user))) {
      await supabase().auth.signOut();
      showError('login-error', 'Este correo no está autorizado para administrar GRIPXELL. Registra su User UID en gripxell_administradores.');
      return;
    }
    await switchToDashboard(user);
  } catch (err) { showError('login-error', `No se pudo comprobar el acceso: ${errorText(err)}`); }
}
async function handleLogin(event) {
  event.preventDefault(); hideError('login-error');
  const button = $('login-submit'); setButtonBusy(button, true, 'Comprobando acceso...');
  try {
    const { data, error } = await supabase().auth.signInWithPassword({
      email: $('login-email').value.trim(), password: $('login-password').value,
    });
    if (error) throw error;
    if (!data.user || !(await validateAdmin(data.user))) {
      await supabase().auth.signOut();
      throw new Error('Tu cuenta inició sesión pero no está autorizada. Agrega su UID en la tabla gripxell_administradores.');
    }
    $('login-password').value = '';
    await switchToDashboard(data.user);
    toast('Bienvenido al panel de GRIPXELL.');
  } catch (err) { showError('login-error', errorText(err)); }
  finally { setButtonBusy(button, false); }
}
async function handleLogout() {
  await supabase().auth.signOut();
  state.user = null; state.products = []; state.settings = null;
  $('admin-app').hidden = true;
  $('admin-login').hidden = false;
  toast('Sesión cerrada correctamente.');
}

async function refreshDashboard() {
  const [productsResponse, settingsResponse] = await Promise.all([
    supabase().from(TABLES.products).select('*').order('creado_en', { ascending: false }),
    supabase().from(TABLES.settings).select('*').eq('id', 1).single(),
  ]);
  if (productsResponse.error || settingsResponse.error) {
    const msg = errorText(productsResponse.error || settingsResponse.error);
    toast(`No se pudieron cargar los datos: ${msg}`, 'error');
    throw new Error(msg);
  }
  state.products = productsResponse.data || [];
  state.settings = settingsResponse.data || {};
  $('stat-total').textContent = state.products.length;
  $('stat-published').textContent = state.products.filter((p) => p.publicado).length;
  $('stat-drafts').textContent = state.products.filter((p) => !p.publicado).length;
  $('stat-unavailable').textContent = state.products.filter((p) => !p.disponible).length;
  for (const [key, predicate] of Object.entries({all: () => true, published: (p) => p.publicado, draft: (p) => !p.publicado, unavailable: (p) => !p.disponible})) {
    $(`filter-count-${key}`).textContent = state.products.filter(predicate).length;
  }
  renderProductList();
  fillSettings();
}

function renderProductList() {
  const root = $('admin-products'); root.replaceChildren();
  const query = state.filter.toLocaleLowerCase('es-MX').trim();
  const products = state.products.filter((p) => {
    const matchesStatus = state.statusFilter === 'all' ||
      (state.statusFilter === 'published' && p.publicado) ||
      (state.statusFilter === 'draft' && !p.publicado) ||
      (state.statusFilter === 'unavailable' && !p.disponible);
    return matchesStatus && [p.marca, p.modelo, p.capacidad, p.color]
      .filter(Boolean).join(' ').toLocaleLowerCase('es-MX').includes(query);
  });
  if (state.sort === 'name') products.sort((a,b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, 'es-MX'));
  else if (state.sort === 'price') products.sort((a,b) => Number(b.precio_mxn || 0) - Number(a.precio_mxn || 0));
  else products.sort((a,b) => new Date(b.creado_en || 0) - new Date(a.creado_en || 0));
  $('admin-results-summary').textContent = `${products.length} de ${state.products.length} ${state.products.length === 1 ? 'modelo' : 'modelos'} en tu inventario`;
  if (!products.length) {
    const empty = el('div', 'empty-state');
    empty.append(el('div', 'empty-state__icon', '＋'), el('strong', '', query ? 'Sin resultados' : 'Todavía no hay modelos'),
      el('p', '', query ? 'Prueba con otro término de búsqueda.' : 'Selecciona “Agregar celular” para empezar tu catálogo.'));
    root.append(empty); return;
  }
  for (const product of products) {
    const row = el('article', 'admin-product');
    const visual = el('div', 'admin-product__image');
    if (product.foto_portada_path || product.foto_frontal_path || product.foto_trasera_path) {
      const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.src = publicImageUrl(product.foto_portada_path || product.foto_frontal_path || product.foto_trasera_path); visual.append(img);
    } else visual.append(el('span', '', '▣'));
    const info = el('div', 'admin-product__info');
    info.append(el('strong', '', [product.marca, product.modelo].filter(Boolean).join(' ')));
    info.append(el('small', '', [product.capacidad, product.color].filter(Boolean).join(' · ') || 'Sin datos adicionales'));
    const meta = el('div', 'admin-product__meta');
    meta.append(el('span', `status-pill${product.publicado ? '' : ' status-pill--draft'}`, product.publicado ? 'Publicado' : 'Borrador'));
    if (!product.disponible) meta.append(el('span', 'status-pill status-pill--unavailable', 'Agotado'));
    if (product.destacado) meta.append(el('span', 'status-pill', 'Destacado'));
    if (!product.foto_portada_path && !product.foto_frontal_path && !product.foto_trasera_path) meta.append(el('span', 'status-pill status-pill--draft', 'Sin foto'));
    info.append(meta);
    const price = el('div', 'admin-product__price', currency(product.precio_mxn));
    const actions = el('div', 'admin-product__actions');
    const edit = el('button', 'icon-action', 'Editar'); edit.type = 'button';
    edit.addEventListener('click', () => openEditor(product));
    const remove = el('button', 'icon-action icon-action--danger', 'Eliminar'); remove.type = 'button';
    remove.addEventListener('click', () => deleteProduct(product));
    const toggle = el('button','icon-action icon-action--publish', product.publicado ? 'Ocultar' : 'Publicar');
    toggle.type = 'button'; toggle.title = product.publicado ? 'Quitar de la tienda pública' : 'Mostrar en la tienda pública';
    toggle.addEventListener('click', () => toggleProductVisibility(product));
    const open = el('a','icon-action icon-action--view','Ver');
    open.href = `/?modelo=${encodeURIComponent(product.slug)}`; open.target = '_blank'; open.rel = 'noopener noreferrer';
    open.setAttribute('aria-label', `Ver ${product.marca} ${product.modelo} en el catálogo`);
    actions.append(open, toggle, edit, remove);
    row.append(visual, info, price, actions);
    root.append(row);
  }
}

async function toggleProductVisibility(product) {
  if (!product.publicado && (!product.descripcion?.trim() || ![product.foto_portada_path,product.foto_frontal_path,product.foto_trasera_path].some(Boolean))) {
    toast('Para publicar necesitas una descripción y al menos una fotografía. Completa la ficha.', 'error');
    openEditor(product);
    return;
  }
  try {
    const { error } = await supabase().from(TABLES.products).update({publicado: !product.publicado}).eq('id', product.id);
    if (error) throw error;
    toast(product.publicado ? 'Modelo oculto del catálogo.' : 'Modelo publicado en el catálogo.');
    await refreshDashboard();
  } catch (error) { toast(`No se pudo actualizar: ${errorText(error)}`, 'error'); }
}
function switchTab(which) {
  const isInventory = which === 'inventory';
  $('admin-inventory-panel').hidden = !isInventory;
  $('admin-settings-panel').hidden = isInventory;
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    const isActive = button.dataset.adminTab === which;
    button.classList.toggle('is-current', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}
function clearObjectPreviews() {
  for (const url of previewObjectUrls.values()) URL.revokeObjectURL(url);
  previewObjectUrls.clear();
}
function renderPhotoPreview(side, source) {
  const node = $(`preview-${side}`);
  node.replaceChildren();
  if (source) {
    const img = el('img'); img.alt = `Imagen ${PHOTO_LABELS[side]} del equipo`; img.src = source; node.append(img);
  } else {
    const placeholder = el('span', 'upload-placeholder', '＋');
    placeholder.append(el('small', '', `Subir ${PHOTO_LABELS[side]}`));
    node.append(placeholder);
  }
  updateEditorPreview();
}
async function handlePreview(side) {
  const file = $(`image-${side}`).files?.[0];
  if (previewObjectUrls.has(side)) URL.revokeObjectURL(previewObjectUrls.get(side));
  try {
    if (file) {
      const previewBlob = await getImageBlob(file, 1000, side === 'cover' && $('crop-provider-sheet').checked);
      const url = URL.createObjectURL(previewBlob); previewObjectUrls.set(side, url);
      renderPhotoPreview(side, url);
    } else {
      const existing = state.products.find((p) => p.id === state.editId);
      renderPhotoPreview(side, existing ? publicImageUrl(existing[PHOTO_TYPES[side]]) : '');
    }
  } catch (error) {
    renderPhotoPreview(side, '');
    showError('editor-error', errorText(error));
  }
}
function updateEditorPreview() {
  const form = $('editor-form');
  if (!form) return;
  const field = (key) => form.elements.namedItem(key)?.value?.trim() || '';
  const existing = state.products.find(p => p.id === state.editId);
  const name = [field('marca'), field('modelo')].filter(Boolean).join(' ');
  const coverImg = ['cover','front','back','right','left'].map(side => $(`preview-${side}`).querySelector('img')?.src).find(Boolean) ||
    (existing ? publicImageUrl(existing.foto_portada_path || existing.foto_frontal_path || existing.foto_trasera_path) : '');
  const previewImg = $('editor-live-image');
  previewImg.src = coverImg || '/demo/zte-blade-a56-pendiente.svg';
  $('editor-live-brand').textContent = field('marca').toUpperCase() || 'MARCA';
  $('editor-live-model').textContent = field('modelo') || 'Nombre del modelo';
  $('editor-live-capacity').textContent = [field('capacidad'), field('color')].filter(Boolean).join(' · ') || 'Memoria y color';
  $('editor-live-price').textContent = currency(field('precio_mxn'));
  const publication = form.elements.namedItem('publicado').checked;
  $('preview-publication-label').textContent = publication ? 'PUBLICADO' : 'BORRADOR';
  $('preview-publication-label').classList.toggle('is-published', publication);
  const checks = [Boolean(field('marca') && field('modelo')), Boolean(field('descripcion')), Boolean(coverImg || Object.keys(PHOTO_TYPES).some(side => $(`image-${side}`).files?.[0]))];
  ['name','description','image'].forEach((key, index) => $('editor-check-' + key).classList.toggle('is-done', checks[index]));
  const count = checks.filter(Boolean).length;
  $('editor-live-progress-text').textContent = `${count} de 3`;
  $('editor-live-progress-bar').style.width = `${Math.round(count / 3 * 100)}%`;
}
function openEditor(product = null) {
  const form = $('editor-form'); form.reset();
  clearObjectPreviews(); hideError('editor-error');
  state.editId = product?.id ?? null; state.importedCover = null;
  $('provider-sheet').value = ''; $('import-ocr-details').hidden = true; $('import-ocr-text').textContent = '';
  $('import-result-preview').textContent = 'Tu teléfono sin fondo aparecerá aquí.'; updateImportStatus('El recorte y el OCR se realizan al elegir la imagen.');
  $('editor-title').textContent = product ? `Editar ${product.modelo}` : 'Agregar celular';
  if (product) {
    for (const key of ['marca', 'modelo', 'color', 'capacidad', 'orden', 'descripcion']) {
      form.elements.namedItem(key).value = product[key] ?? '';
    }
    form.elements.namedItem('precio_mxn').value = product.precio_mxn ?? '';
    for (const key of ['publicado', 'disponible', 'destacado']) form.elements.namedItem(key).checked = Boolean(product[key]);
  } else {
    form.elements.namedItem('disponible').checked = true;
    form.elements.namedItem('orden').value = '0';
  }
  for (const [side, column] of Object.entries(PHOTO_TYPES)) renderPhotoPreview(side, product?.[column] ? publicImageUrl(product[column]) : '');
  $('editor-dialog').showModal();
  document.body.classList.add('dialog-open');
  updateEditorPreview();
}
function closeEditor() {
  if ($('editor-dialog').open) $('editor-dialog').close();
  document.body.classList.remove('dialog-open');
  clearObjectPreviews();
}

function parseDescription(description) {
  const result = {};
  for (const line of String(description).split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const name = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!name || !value) continue;
    const key = slugify(name).replaceAll('-', '_');
    if (key) result[key] = value;
  }
  return result;
}

async function getImageBlob(file, maxDimension = 1560, autoCropSheet = false, isLogo = false) {
  if (file.type === 'image/png' && file.name.startsWith('gripxell-recortado-')) return file;
  const isSheet = autoCropSheet && await isHorizontalSheet(file);
  return recortarTelefonoPNG(file, {
    isSheet, cropPercent: Number($('crop-sheet-percent').value) || 62,
    maxDimension, removeWhite: !isLogo,
  });
}

let ocrScriptPromise;
function loadOcrScript() {
  if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract);
  if (ocrScriptPromise) return ocrScriptPromise;
  ocrScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // Se descarga solo si el admin importa una ficha; no afecta a los visitantes.
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => window.Tesseract?.createWorker ? resolve(window.Tesseract) : reject(new Error('No se pudo iniciar OCR.'));
    script.onerror = () => reject(new Error('No se pudo descargar el motor OCR. Revisa tu conexión.'));
    document.head.append(script);
  }).catch(error => { ocrScriptPromise = null; throw error; });
  return ocrScriptPromise;
}
function updateImportStatus(message) { $('import-status').textContent = message; }
function setImportPreview(blob) {
  if (previewObjectUrls.has('import')) URL.revokeObjectURL(previewObjectUrls.get('import'));
  if (previewObjectUrls.has('cover')) URL.revokeObjectURL(previewObjectUrls.get('cover'));
  const url = URL.createObjectURL(blob);
  previewObjectUrls.set('import', url);
  previewObjectUrls.set('cover', URL.createObjectURL(blob));
  const node = $('import-result-preview'); node.replaceChildren();
  const image = el('img'); image.src = url; image.alt = 'Teléfono recortado sin fondo, vista previa'; node.append(image);
  renderPhotoPreview('cover', previewObjectUrls.get('cover'));
  updateEditorPreview();
}
async function runOCR(file) {
  const Tesseract = await loadOcrScript();
  const worker = await Tesseract.createWorker('spa+eng', 1, {
    logger: progress => {
      if (progress.status === 'recognizing text') updateImportStatus(`Leyendo características... ${Math.round((progress.progress || 0)*100)} %`);
    },
  });
  try { const response = await worker.recognize(file); return response.data.text || ''; }
  finally { await worker.terminate(); }
}
async function processSupplierSheet(file) {
  if (!file || state.analyzing) return;
  state.analyzing = true;
  $('import-retry').disabled = true;
  hideError('editor-error');
  try {
    updateImportStatus('Recortando el teléfono y creando PNG transparente...');
    const cropped = await recortarTelefonoPNG(file, {isSheet:await isHorizontalSheet(file),cropPercent:Number($('crop-sheet-percent').value),maxDimension:1560});
    state.importedCover = new File([cropped], `gripxell-recortado-${Date.now()}.png`, {type:'image/png'});
    setImportPreview(state.importedCover);
    updateImportStatus('PNG creado. Iniciando reconocimiento OCR de la ficha...');
    try {
      const rawText = await runOCR(file);
      $('import-ocr-text').textContent = rawText || 'El OCR no devolvió texto legible.';
      $('import-ocr-details').hidden = false;
      const found = parseFichaOCR(rawText);
      const form = $('editor-form');
      const mayReplace = !state.editId || $('import-overwrite').checked;
      for (const field of ['marca','modelo','capacidad','descripcion']) {
        if (!found[field]) continue;
        const input = form.elements.namedItem(field);
        if (!input.value.trim() || mayReplace) input.value = found[field];
      }
      const count = Object.keys(found.especificaciones).length;
      updateImportStatus(`PNG listo · ${count} características reconocidas${found.modelo ? ` · ${found.marca} ${found.modelo}` : ''}. Revisa y guarda.`);
      updateEditorPreview();
    } catch(error) {
      updateImportStatus(`PNG listo. El OCR no pudo completarse (${errorText(error)}). Puedes escribir la descripción manualmente.`);
    }
  } catch(error) {
    showError('editor-error', errorText(error));
    updateImportStatus('No se pudo procesar la ficha. Usa otra foto o carga una PNG manualmente.');
  } finally { state.analyzing = false; $('import-retry').disabled = false; }
}
async function handleSupplierUpload(event) {
  const file = event.target.files?.[0];
  if(file) await processSupplierSheet(file);
}
async function handleCoverSelected() {
  const file = $('image-cover').files?.[0];
  state.importedCover = null;
  if (file && $('crop-provider-sheet').checked && await isHorizontalSheet(file)) {
    await processSupplierSheet(file);
  } else await handlePreview('cover');
}

async function uploadImage(file, directory, label, autoCropSheet = false) {
  const blob = await getImageBlob(file, directory === 'logos' ? 900 : 1560, autoCropSheet, directory === 'logos');
  const extension = blob.type === 'image/webp' ? 'webp' : (blob.type === 'image/png' ? 'png' : blob.type === 'image/avif' ? 'avif' : 'jpg');
  const name = `${label}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const path = `${directory}/${name}`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600', contentType: blob.type, upsert: false,
  });
  if (error) throw error;
  return path;
}

async function saveProduct(event) {
  event.preventDefault(); hideError('editor-error');
  const button = $('editor-save');
  if (state.analyzing) { showError('editor-error', 'Espera a que termine el procesamiento de la ficha.'); return; }
  const form = $('editor-form');
  const value = (name) => form.elements.namedItem(name).value.trim();
  const checked = (name) => form.elements.namedItem(name).checked;
  const existing = state.products.find((p) => p.id === state.editId) || null;
  const id = existing?.id ?? crypto.randomUUID();
  const files = Object.fromEntries(Object.keys(PHOTO_TYPES).map(side => [side, $(`image-${side}`).files?.[0] || null]));
  if (state.importedCover) files.cover = state.importedCover;
  const paths = Object.fromEntries(Object.entries(PHOTO_TYPES).map(([side,column]) => [side, existing?.[column] || null]));
  const uploaded = [];
  let saved = false;
  try {
    if (checked('publicado') && !Object.keys(PHOTO_TYPES).some(side => files[side] || paths[side])) throw new Error('Para publicar necesitas al menos una fotografía del celular.');
    if (!value('descripcion')) throw new Error('Escribe las características y especificaciones en la descripción.');
    const price = value('precio_mxn') === '' ? null : Number(value('precio_mxn'));
    const order = Number(value('orden') || 0);
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error('Introduce un precio válido o déjalo vacío.');
    if (!Number.isSafeInteger(order)) throw new Error('El orden debe ser un número entero.');
    setButtonBusy(button, true, 'Guardando fotos...');
    for (const side of Object.keys(PHOTO_TYPES)) {
      if (files[side]) {
        paths[side] = await uploadImage(files[side], `celulares/${id}`, PHOTO_LABELS[side], side === 'cover' && $('crop-provider-sheet').checked);
        uploaded.push(paths[side]);
      }
    }
    const row = {
      marca: value('marca'), modelo: value('modelo'), color: value('color') || null,
      capacidad: value('capacidad') || null, precio_mxn: price, orden: order,
      descripcion: value('descripcion'), especificaciones: parseDescription(value('descripcion')),
      disponible: checked('disponible'), publicado: checked('publicado'), destacado: checked('destacado'),
      ...Object.fromEntries(Object.entries(PHOTO_TYPES).map(([side, column]) => [column, paths[side]])),
    };
    setButtonBusy(button, true, 'Guardando modelo...');
    const operation = existing
      ? supabase().from(TABLES.products).update(row).eq('id', id).select('id').single()
      : supabase().from(TABLES.products).insert({ ...row, id, slug: `${slugify(`${row.marca}-${row.modelo}`) || 'celular'}-${id.slice(0, 8)}` }).select('id').single();
    const { error } = await operation;
    if (error) throw error;
    saved = true;
    closeEditor(); toast(existing ? 'Modelo actualizado correctamente.' : 'Modelo agregado al catálogo.');
    // Elimina versiones anteriores únicamente después de guardar los cambios.
    const oldPaths = Object.values(PHOTO_TYPES).map(col => existing?.[col]).filter(path => ownedImage(path) && !Object.values(paths).includes(path));
    if (oldPaths.length) supabase().storage.from(BUCKET).remove(oldPaths).then(({ error }) => { if (error) console.warn('No se pudo limpiar foto anterior', error); });
    await refreshDashboard();
  } catch (err) {
    if (uploaded.length && !saved) {
      try { await supabase().storage.from(BUCKET).remove(uploaded); } catch (cleanupError) { console.warn('Limpieza de fotos fallida', cleanupError); }
    }
    if (saved) toast(`El modelo se guardó, pero no se pudo actualizar la lista: ${errorText(err)}`, 'error');
    else showError('editor-error', errorText(err));
  } finally { setButtonBusy(button, false); }
}

async function deleteProduct(product) {
  if (!window.confirm(`¿Eliminar definitivamente ${product.marca} ${product.modelo}? Esta acción no se puede deshacer.`)) return;
  try {
    const { error } = await supabase().from(TABLES.products).delete().eq('id', product.id);
    if (error) throw error;
    const paths = Object.values(PHOTO_TYPES).map(col => product[col]).filter(ownedImage);
    if (paths.length) {
      const { error: storageError } = await supabase().storage.from(BUCKET).remove(paths);
      if (storageError) console.warn('No se pudieron borrar algunas fotografías', storageError);
    }
    toast('Celular eliminado.'); await refreshDashboard();
  } catch (err) { toast(`No se pudo eliminar: ${errorText(err)}`, 'error'); }
}

function fillSettings() {
  if (!state.settings) return;
  $('setting-name').value = state.settings.nombre_tienda || 'GRIPXELL';
  $('setting-subtitle').value = state.settings.subtitulo || 'SMART PHONES Y MÁS';
  $('setting-whatsapp').value = state.settings.whatsapp_numero || '';
  const preview = $('setting-logo-preview'); preview.replaceChildren();
  if (state.settings.logo_path) {
    const img = el('img'); img.alt = 'Logo actual de GRIPXELL'; img.src = publicImageUrl(state.settings.logo_path); preview.append(img);
  } else preview.append(el('small', '', 'Se utilizará el logotipo tipográfico incluido en el diseño.'));
}

async function saveSettings(event) {
  event.preventDefault();
  const button = $('settings-submit');
  const file = $('setting-logo').files?.[0];
  const number = cleanPhone($('setting-whatsapp').value);
  if (number && !/^[1-9][0-9]{7,14}$/.test(number)) { toast('El WhatsApp debe incluir código de país y tener de 8 a 15 dígitos.', 'error'); return; }
  const name = $('setting-name').value.trim();
  if (!name) { toast('El nombre comercial es obligatorio.', 'error'); return; }
  let newLogo = null;
  try {
    setButtonBusy(button, true, 'Guardando...');
    if (file) newLogo = await uploadImage(file, 'logos', 'gripxell');
    const oldLogo = state.settings?.logo_path || null;
    const updates = {
      nombre_tienda: name,
      subtitulo: $('setting-subtitle').value.trim() || 'SMART PHONES Y MÁS',
      whatsapp_numero: number || null,
      logo_path: newLogo || oldLogo,
    };
    const { data, error } = await supabase().from(TABLES.settings).update(updates).eq('id', 1).select('*').single();
    if (error) throw error;
    state.settings = data;
    $('setting-logo').value = '';
    fillSettings();
    if (newLogo && oldLogo && newLogo !== oldLogo) supabase().storage.from(BUCKET).remove([oldLogo]);
    $('settings-status').textContent = 'Cambios guardados';
    toast('Configuración actualizada.');
  } catch (err) {
    if (newLogo) { try { await supabase().storage.from(BUCKET).remove([newLogo]); } catch {} }
    toast(`No se pudo guardar: ${errorText(err)}`, 'error');
  } finally { setButtonBusy(button, false); }
}

function init() {
  $('login-form').addEventListener('submit', handleLogin);
  $('logout-button').addEventListener('click', handleLogout);
  $('new-product').addEventListener('click', () => openEditor());
  $('refresh-products').addEventListener('click', async () => {
    const b = $('refresh-products'); setButtonBusy(b, true, 'Actualizando...');
    try { await refreshDashboard(); toast('Inventario actualizado.'); }
    catch (error) { toast('No se pudo actualizar el inventario: ' + errorText(error), 'error'); }
    finally { setButtonBusy(b, false); }
  });
  $('admin-sort').addEventListener('change', event => { state.sort = event.target.value; renderProductList(); });
  document.querySelectorAll('[data-admin-filter]').forEach(button => button.addEventListener('click', () => {
    state.statusFilter = button.dataset.adminFilter;
    document.querySelectorAll('[data-admin-filter]').forEach(b => {
      const active = b === button; b.classList.toggle('is-active', active); b.setAttribute('aria-pressed', String(active));
    });
    renderProductList();
  }));
  $('editor-form').addEventListener('input', updateEditorPreview);
  $('editor-form').addEventListener('change', updateEditorPreview);
  $('admin-search').addEventListener('input', (event) => { state.filter = event.target.value; renderProductList(); });
  document.querySelectorAll('[data-admin-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.adminTab)));
  $('editor-form').addEventListener('submit', saveProduct);
  $('editor-close').addEventListener('click', closeEditor);
  $('editor-cancel').addEventListener('click', closeEditor);
  $('editor-dialog').addEventListener('click', (event) => { if (event.target === $('editor-dialog')) closeEditor(); });
  $('editor-dialog').addEventListener('close', () => { clearObjectPreviews(); document.body.classList.remove('dialog-open'); });
  for (const side of Object.keys(PHOTO_TYPES)) $(`image-${side}`).addEventListener('change', () => side === 'cover' ? void handleCoverSelected() : void handlePreview(side));
  $('provider-sheet').addEventListener('change', (event) => { void handleSupplierUpload(event); });
  $('import-retry').addEventListener('click', () => { const file = $('provider-sheet').files?.[0] || $('image-cover').files?.[0]; if(file) void processSupplierSheet(file); else toast('Primero selecciona una ficha de proveedor.', 'error'); });
  $('crop-sheet-percent').addEventListener('input', (e) => { $('crop-sheet-value').textContent = `${e.target.value} % del ancho de la ficha`; });
  $('crop-provider-sheet').addEventListener('change', () => { if ($('image-cover').files?.[0]) void handlePreview('cover'); });
  $('settings-form').addEventListener('submit', saveSettings);
  void ensureSession();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
