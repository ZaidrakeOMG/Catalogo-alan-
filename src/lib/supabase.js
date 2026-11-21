import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.PUBLIC_SUPABASE_URL;
const KEY = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const BUCKET = 'gripxell-celulares';
// WhatsApp de ventas predeterminado (México: +52 1 871 328 5416).
// Los administradores pueden sustituirlo desde Configuración.
export const DEFAULT_WHATSAPP = '5218713285416';
export const TABLES = Object.freeze({
  products: 'gripxell_celulares',
  settings: 'gripxell_configuracion',
  admins: 'gripxell_administradores',
});
let client;

export function supabase() {
  if (!URL || !KEY) throw new Error('Configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'x-application-name': 'gripxell-catalogo-astro' } },
    });
  }
  return client;
}

export function publicImageUrl(path) {
  if (!path) return '';
  // Assets de muestra incluidos en el propio sitio, nunca son rutas de Storage.
  if (String(path).startsWith('/demo/')) {
    const demo=String(path);
    const slugs=['motorola-g06','naomicase-romy-v2','naomicase-sena','samsung-a08','xiaomi-redmi-a7-pro','zte-blade-a56','zte-blade-v70-max'];
    const hit=slugs.find(slug=>demo===`/demo/${slug}.webp` || (slug==='motorola-g06' && demo==='/demo/motorola-g06-conjunto.webp'));
    return hit ? `/demo/${hit}.png` : demo;
  }
  return supabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function currency(value) {
  if (value === null || value === undefined || value === '') return 'Consultar precio';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(value));
}

export function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export function toast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--on'));
  window.setTimeout(() => { el.classList.remove('toast--on'); window.setTimeout(() => el.remove(), 300); }, 3800);
}

export function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}
