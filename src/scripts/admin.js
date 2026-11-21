import { supabase, TABLES, BUCKET, publicImageUrl, currency, slugify, cleanPhone, toast } from '../lib/supabase.js';

const $ = (id) => document.getElementById(id);
const state = { products: [], settings: null, user: null, editId: null, filter: '' };
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
  renderProductList();
  fillSettings();
}

function renderProductList() {
  const root = $('admin-products'); root.replaceChildren();
  const query = state.filter.toLocaleLowerCase('es-MX').trim();
  const products = state.products.filter((p) => [p.marca, p.modelo, p.capacidad, p.color]
    .join(' ').toLocaleLowerCase('es-MX').includes(query));
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
    info.append(meta);
    const price = el('div', 'admin-product__price', currency(product.precio_mxn));
    const actions = el('div', 'admin-product__actions');
    const edit = el('button', 'icon-action', 'Editar'); edit.type = 'button';
    edit.addEventListener('click', () => openEditor(product));
    const remove = el('button', 'icon-action icon-action--danger', 'Eliminar'); remove.type = 'button';
    remove.addEventListener('click', () => deleteProduct(product));
    actions.append(edit, remove);
    row.append(visual, info, price, actions);
    root.append(row);
  }
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
function openEditor(product = null) {
  const form = $('editor-form'); form.reset();
  clearObjectPreviews(); hideError('editor-error');
  state.editId = product?.id ?? null;
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

async function getImageBlob(file, maxDimension = 1560, autoCropSheet = false) {
  if (!MIME_TYPES.includes(file.type)) throw new Error('Solo se permiten fotografías JPG, PNG, WebP o AVIF.');
  if (file.size > 24 * 1024 * 1024) throw new Error('La foto original excede 24 MB. Reduce su tamaño antes de subirla.');
  let bitmap;
  let objectUrl;
  try {
    if (typeof createImageBitmap === 'function') {
      try { bitmap = await createImageBitmap(file); } catch { /* Safari puede decodificar HEIC con Image. */ }
    }
    if (!bitmap) {
      objectUrl = URL.createObjectURL(file);
      bitmap = new Image(); bitmap.src = objectUrl; await bitmap.decode();
    }
    const naturalWidth = bitmap.width;
    const naturalHeight = bitmap.height;
    // Recortar una diapositiva horizontal de proveedor: teléfono a la izquierda,
    // título arriba y publicidad al pie. Nunca se modifica el archivo de origen.
    const sheet = autoCropSheet && naturalWidth / naturalHeight > 1.46;
    const sourceX = sheet ? Math.round(naturalWidth * .015) : 0;
    const sourceY = sheet ? Math.round(naturalHeight * .14) : 0;
    const sourceWidth = sheet ? Math.round(naturalWidth * .51) : naturalWidth;
    const sourceHeight = sheet ? Math.round(naturalHeight * .76) : naturalHeight;
    const factor = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * factor));
    canvas.height = Math.max(1, Math.round(sourceHeight * factor));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tu navegador no pudo procesar la imagen.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .87));
    const result = blob?.type === 'image/webp' && blob.size <= 8 * 1024 * 1024 ? blob : file;
    if (['image/heic', 'image/heif'].includes(result.type)) throw new Error('No se pudo convertir esta foto HEIC/HEIF. Exporta la imagen como JPG desde tu iPhone e inténtalo de nuevo.');
    if (result.size > 8 * 1024 * 1024) throw new Error('La fotografía excede el límite de 8 MB incluso al comprimirla.');
    return result;
  } finally {
    if (typeof bitmap?.close === 'function') bitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function uploadImage(file, directory, label, autoCropSheet = false) {
  const blob = await getImageBlob(file, directory === 'logos' ? 900 : 1560, autoCropSheet);
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
  const form = $('editor-form');
  const value = (name) => form.elements.namedItem(name).value.trim();
  const checked = (name) => form.elements.namedItem(name).checked;
  const existing = state.products.find((p) => p.id === state.editId) || null;
  const id = existing?.id ?? crypto.randomUUID();
  const files = Object.fromEntries(Object.keys(PHOTO_TYPES).map(side => [side, $(`image-${side}`).files?.[0] || null]));
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
  $('admin-search').addEventListener('input', (event) => { state.filter = event.target.value; renderProductList(); });
  document.querySelectorAll('[data-admin-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.adminTab)));
  $('editor-form').addEventListener('submit', saveProduct);
  $('editor-close').addEventListener('click', closeEditor);
  $('editor-cancel').addEventListener('click', closeEditor);
  $('editor-dialog').addEventListener('click', (event) => { if (event.target === $('editor-dialog')) closeEditor(); });
  $('editor-dialog').addEventListener('close', () => { clearObjectPreviews(); document.body.classList.remove('dialog-open'); });
  for (const side of Object.keys(PHOTO_TYPES)) $(`image-${side}`).addEventListener('change', () => handlePreview(side));
  $('crop-provider-sheet').addEventListener('change', () => { if ($('image-cover').files?.[0]) void handlePreview('cover'); });
  $('settings-form').addEventListener('submit', saveSettings);
  void ensureSession();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
