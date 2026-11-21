-- GRIPXELL INSTALACIÓN COMPLETA (BASE V1 + MIGRACIÓN V2)
-- Puede ejecutarse con la aplicación ya instalada. Respeta registros existentes.

-- GRIPXELL | Catálogo de celulares con Astro y Supabase
-- Ejecutar una sola vez en Supabase > SQL Editor > New query > Run.
-- No modifica tablas ajenas al prefijo gripxell_.

begin;

-- 1) Usuarios autorizados para administrar la tienda.
-- Por seguridad NO existe política de INSERT/UPDATE/DELETE para usuarios web.
create table if not exists public.gripxell_administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now()
);

-- 2) Productos, con fotografías frontal y trasera en Supabase Storage.
create table if not exists public.gripxell_celulares (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  marca text not null check (length(btrim(marca)) > 0),
  modelo text not null check (length(btrim(modelo)) > 0),
  color text,
  capacidad text,
  descripcion text not null default '',
  especificaciones jsonb not null default '{}'::jsonb
    check (jsonb_typeof(especificaciones) = 'object'),
  precio_mxn numeric(12,2) check (precio_mxn >= 0),
  foto_frontal_path text,
  foto_trasera_path text,
  disponible boolean not null default true,
  destacado boolean not null default false,
  publicado boolean not null default false,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint gripxell_publicacion_completa check (
    publicado = false or (
      length(btrim(descripcion)) > 0
      and nullif(btrim(foto_frontal_path), '') is not null
      and nullif(btrim(foto_trasera_path), '') is not null
    )
  )
);

create index if not exists gripxell_celulares_publicados_idx
  on public.gripxell_celulares (publicado, orden, creado_en desc);

-- 3) Datos públicos de GRIPXELL; el WhatsApp se configura después.
create table if not exists public.gripxell_configuracion (
  id smallint primary key default 1 check (id = 1),
  nombre_tienda text not null default 'GRIPXELL',
  subtitulo text not null default 'SMART PHONES Y MÁS',
  whatsapp_numero text check (
    whatsapp_numero is null or whatsapp_numero ~ '^[1-9][0-9]{7,14}$'
  ),
  logo_path text,
  actualizado_en timestamptz not null default now()
);

insert into public.gripxell_configuracion (id)
values (1)
on conflict (id) do nothing;

-- 4) Actualizar fecha automáticamente al editar.
create or replace function public.gripxell_actualizar_fecha()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

-- Se recrean únicamente nuestros triggers para permitir repetir el script.
drop trigger if exists gripxell_celulares_fecha on public.gripxell_celulares;
create trigger gripxell_celulares_fecha
before update on public.gripxell_celulares
for each row execute function public.gripxell_actualizar_fecha();

drop trigger if exists gripxell_configuracion_fecha on public.gripxell_configuracion;
create trigger gripxell_configuracion_fecha
before update on public.gripxell_configuracion
for each row execute function public.gripxell_actualizar_fecha();

revoke all on function public.gripxell_actualizar_fecha() from public, anon, authenticated;

-- 5) Seguridad RLS: visitantes solo leen publicados.
alter table public.gripxell_administradores enable row level security;
alter table public.gripxell_celulares enable row level security;
alter table public.gripxell_configuracion enable row level security;

-- Permisos de API. Las políticas RLS limitan las filas accesibles.
revoke all on public.gripxell_administradores from anon, authenticated;
grant select on public.gripxell_administradores to authenticated;

revoke all on public.gripxell_celulares from anon, authenticated;
grant select on public.gripxell_celulares to anon, authenticated;
grant insert, update, delete on public.gripxell_celulares to authenticated;

revoke all on public.gripxell_configuracion from anon, authenticated;
grant select on public.gripxell_configuracion to anon, authenticated;
grant update on public.gripxell_configuracion to authenticated;

-- Administrador: solo ve su propio registro, nunca puede autoasignarse el rol.
drop policy if exists "gripxell_admin_lee_su_registro" on public.gripxell_administradores;
create policy "gripxell_admin_lee_su_registro"
on public.gripxell_administradores for select to authenticated
using (user_id = (select auth.uid()));

-- Catálogo: modelos publicados para cualquiera y borradores para admins.
drop policy if exists "gripxell_publico_lee_publicados" on public.gripxell_celulares;
create policy "gripxell_publico_lee_publicados"
on public.gripxell_celulares for select to anon, authenticated
using (publicado = true);

drop policy if exists "gripxell_admin_lee_todos" on public.gripxell_celulares;
create policy "gripxell_admin_lee_todos"
on public.gripxell_celulares for select to authenticated
using (exists (
  select 1 from public.gripxell_administradores a
  where a.user_id = (select auth.uid())
));

drop policy if exists "gripxell_admin_inserta" on public.gripxell_celulares;
create policy "gripxell_admin_inserta"
on public.gripxell_celulares for insert to authenticated
with check (exists (
  select 1 from public.gripxell_administradores a
  where a.user_id = (select auth.uid())
));

drop policy if exists "gripxell_admin_actualiza" on public.gripxell_celulares;
create policy "gripxell_admin_actualiza"
on public.gripxell_celulares for update to authenticated
using (exists (
  select 1 from public.gripxell_administradores a
  where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.gripxell_administradores a
  where a.user_id = (select auth.uid())
));

drop policy if exists "gripxell_admin_elimina" on public.gripxell_celulares;
create policy "gripxell_admin_elimina"
on public.gripxell_celulares for delete to authenticated
using (exists (
  select 1 from public.gripxell_administradores a
  where a.user_id = (select auth.uid())
));

-- Configuración pública: el WhatsApp se lee pero solo los admins lo cambian.
drop policy if exists "gripxell_publico_lee_config" on public.gripxell_configuracion;
create policy "gripxell_publico_lee_config"
on public.gripxell_configuracion for select to anon, authenticated
using (true);

drop policy if exists "gripxell_admin_actualiza_config" on public.gripxell_configuracion;
create policy "gripxell_admin_actualiza_config"
on public.gripxell_configuracion for update to authenticated
using (exists (
  select 1 from public.gripxell_administradores a
  where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.gripxell_administradores a
  where a.user_id = (select auth.uid())
));

-- 6) Storage público para imágenes de producto y logotipo.
-- 8 MiB máx. por imagen; solo formatos de imagen habituales.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gripxell-celulares', 'gripxell-celulares', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Archivos públicos para visualizar, pero solo admins pueden subirlos/modificarlos.
-- El bucket PUBLIC permite mostrar URLs públicas sin política de SELECT para visitantes.
drop policy if exists "gripxell_admin_storage_select" on storage.objects;
create policy "gripxell_admin_storage_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'gripxell-celulares'
  and exists (
    select 1 from public.gripxell_administradores a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "gripxell_admin_storage_insert" on storage.objects;
create policy "gripxell_admin_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'gripxell-celulares'
  and exists (
    select 1 from public.gripxell_administradores a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "gripxell_admin_storage_update" on storage.objects;
create policy "gripxell_admin_storage_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'gripxell-celulares'
  and exists (
    select 1 from public.gripxell_administradores a
    where a.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'gripxell-celulares'
  and exists (
    select 1 from public.gripxell_administradores a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "gripxell_admin_storage_delete" on storage.objects;
create policy "gripxell_admin_storage_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'gripxell-celulares'
  and exists (
    select 1 from public.gripxell_administradores a
    where a.user_id = (select auth.uid())
  )
);

-- 7) Primer producto de ejemplo, basado en la ficha que compartiste.
-- Queda como BORRADOR hasta que el administrador suba dos fotografías y lo publique.
insert into public.gripxell_celulares (
  slug, marca, modelo, color, capacidad, descripcion, especificaciones, publicado
) values (
  'motorola-g06-64gb',
  'Motorola',
  'G06',
  'Verde azulado',
  '64 GB',
  E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 50 MP\nPantalla: 6.8 pulgadas\nProcesador: MediaTek Helio G81 Extreme (2x A75 a 2.0 GHz + 6x A55 a 1.7 GHz)\nAlmacenamiento: 64 GB\nSistema operativo: Android 15',
  '{"red":"4G", "camara_frontal":"8 MP", "camara_trasera":"50 MP", "pantalla":"6.8 pulgadas", "procesador":"MediaTek Helio G81 Extreme", "almacenamiento":"64 GB", "sistema_operativo":"Android 15"}'::jsonb,
  false
)
on conflict (slug) do nothing;

-- 8) Comprobación rápida de tablas y bucket.
select 'gripxell_administradores' as recurso, count(*) as registros
  from public.gripxell_administradores
union all
select 'gripxell_celulares', count(*) from public.gripxell_celulares
union all
select 'gripxell_configuracion', count(*) from public.gripxell_configuracion
union all
select 'storage:gripxell-celulares', count(*)
  from storage.buckets where id = 'gripxell-celulares';

commit;

-- PASO ADICIONAL (NO ejecutar sin reemplazar el UUID):
-- 1. Supabase > Authentication > Users > Add user: crea tu usuario admin.
-- 2. Copia el User UID real.
-- 3. Ejecuta esta consulta REEMPLAZANDO el UUID:
-- insert into public.gripxell_administradores (user_id)
-- values ('AQUI-EL-UUID-REAL-DEL-USUARIO')
-- on conflict (user_id) do nothing;

-- OPCIONAL: configura el WhatsApp en formato internacional SIN signo +.
-- Ejemplo México: 52 + 10 dígitos.
-- update public.gripxell_configuracion
-- set whatsapp_numero = '52XXXXXXXXXX'
-- where id = 1;


-- GRIPXELL V2 / MIGRACIÓN NO DESTRUCTIVA
-- Ejecutar DESPUÉS de 01_gripxell_inicial.sql.
-- No borra productos, usuarios ni fotografías existentes.
begin;

alter table public.gripxell_celulares
  add column if not exists foto_portada_path text,
  add column if not exists foto_lateral_derecha_path text,
  add column if not exists foto_lateral_izquierda_path text;

-- Una foto de portada alcanza para publicar; las 2/4 perspectivas son opcionales.
-- Cuando existen varias vistas el sitio habilita la rotación por ángulos.
alter table public.gripxell_celulares
  drop constraint if exists gripxell_publicacion_completa;
alter table public.gripxell_celulares
  add constraint gripxell_publicacion_completa check (
    not publicado or (
      length(btrim(descripcion)) > 0
      and (
        nullif(btrim(foto_portada_path), '') is not null
        or nullif(btrim(foto_frontal_path), '') is not null
        or nullif(btrim(foto_trasera_path), '') is not null
      )
    )
  );

-- Solo se completan datos del ejemplo original de Motorola cuando aún está intacto.
update public.gripxell_celulares
set foto_portada_path = '/demo/motorola-g06-conjunto.webp', publicado = true
where slug = 'motorola-g06-64gb'
  and foto_portada_path is null and foto_frontal_path is null
  and foto_trasera_path is null and descripcion like 'Red: 4G%';

-- Modelos de las fichas que proporcionó el propietario.
-- Las versiones de SO y otros datos se transcriben de las fichas del proveedor.
insert into public.gripxell_celulares
(slug,marca,modelo,color,capacidad,descripcion,especificaciones,foto_portada_path,disponible,publicado,orden)
values
('naomicase-romy-v2','Naomicase','Romy V2','Rojo','32 MB',
 E'Pantalla: 1.77 pulgadas\nSistema operativo: Propietario\nRed: 2G\nMemoria interna: 32 MB\nMemoria RAM: 32 MB\nLinterna: Sí\nLector de MicroSD: Sí',
 '{}'::jsonb,'/demo/naomicase-romy-v2.webp',true,true,1),
('samsung-a08','Samsung','A08',null,'64 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 50 MP\nPantalla: 6.7 pulgadas\nProcesador: MediaTek Helio G99+ (MT6789X), 2x 2.2 GHz + 6x 2.0 GHz\nMemoria: 64 GB\nSistema operativo: Android 17 (según ficha proporcionada)',
 '{}'::jsonb,'/demo/samsung-a08.webp',true,true,2),
('xiaomi-redmi-a7-pro','Xiaomi','Redmi A7 Pro','Azul','64 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 13 MP + QVGA\nPantalla: 6.9 pulgadas\nProcesador: Unisoc T7250, 2x A75 1.8 GHz + 6x A55 1.6 GHz\nMemoria: 64 GB\nSistema operativo: Android 16 (según ficha proporcionada)',
 '{}'::jsonb,'/demo/xiaomi-redmi-a7-pro.webp',true,true,3),
('naomicase-sena','Naomicase','Sena','Negro','4 GB ROM / 512 MB RAM',
 E'Red: 3G\nCámara frontal: 0.3 MP\nCámara trasera: 0.3 MP\nPantalla: 4.0 pulgadas\nProcesador: Quad-Core MTK6572\nMemoria: ROM 4 GB, RAM 512 MB',
 '{}'::jsonb,'/demo/naomicase-sena.webp',true,true,4),
('zte-blade-a56','ZTE','Blade A56','Plata','128 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 13 MP + AI Cam + AI Cam\nPantalla: 6.8 pulgadas\nProcesador: Unisoc T7200 Octa-Core 2x A75 1.6 GHz + 6x A55 1.6 GHz\nMemoria: 128 GB\nSistema operativo: Android 15',
 '{}'::jsonb,'/demo/zte-blade-a56.webp',true,true,5),
('zte-blade-v70-max','ZTE','Blade V70 Max','Azul / Verde','256 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 50 MP + 2 MP\nPantalla: 6.9 pulgadas\nProcesador: Unisoc T606 Octa-Core, 2x A75 1.6 GHz + 6x A55 1.6 GHz\nMemoria: 256 GB\nSistema operativo: Android 15',
 '{}'::jsonb,'/demo/zte-blade-v70-max.webp',true,true,6)
on conflict (slug) do nothing;

commit;

select slug,marca,modelo,publicado,
  coalesce(foto_portada_path, foto_frontal_path, foto_trasera_path) as portada
from public.gripxell_celulares
order by orden, modelo;

-- Opcional: alimentar vistas demostrativas frente / reverso con recortes
-- de las fichas del propietario. No reemplaza fotos subidas por admins.
-- Se limita a filas que continúan usando portadas de ejemplo.
begin;
update public.gripxell_celulares
  set foto_frontal_path = coalesce(foto_frontal_path, '/demo/naomicase-romy-v2-frente.webp'),
      foto_trasera_path = coalesce(foto_trasera_path, '/demo/naomicase-romy-v2-trasera.webp')
  where slug='naomicase-romy-v2' and foto_portada_path='/demo/naomicase-romy-v2.webp';
update public.gripxell_celulares
  set foto_frontal_path = coalesce(foto_frontal_path, '/demo/samsung-a08-frente.webp'),
      foto_trasera_path = coalesce(foto_trasera_path, '/demo/samsung-a08-trasera.webp')
  where slug='samsung-a08' and foto_portada_path='/demo/samsung-a08.webp';
update public.gripxell_celulares
  set foto_frontal_path = coalesce(foto_frontal_path, '/demo/xiaomi-redmi-a7-pro-frente.webp'),
      foto_trasera_path = coalesce(foto_trasera_path, '/demo/xiaomi-redmi-a7-pro-trasera.webp')
  where slug='xiaomi-redmi-a7-pro' and foto_portada_path='/demo/xiaomi-redmi-a7-pro.webp';
update public.gripxell_celulares
  set foto_frontal_path = coalesce(foto_frontal_path, '/demo/naomicase-sena-frente.webp'),
      foto_trasera_path = coalesce(foto_trasera_path, '/demo/naomicase-sena-trasera.webp')
  where slug='naomicase-sena' and foto_portada_path='/demo/naomicase-sena.webp';
update public.gripxell_celulares
  set foto_frontal_path = coalesce(foto_frontal_path, '/demo/zte-blade-a56-frente.webp'),
      foto_trasera_path = coalesce(foto_trasera_path, '/demo/zte-blade-a56-trasera.webp')
  where slug='zte-blade-a56' and foto_portada_path='/demo/zte-blade-a56.webp';
update public.gripxell_celulares
  set foto_frontal_path = coalesce(foto_frontal_path, '/demo/motorola-g06-frente.webp'),
      foto_trasera_path = coalesce(foto_trasera_path, '/demo/motorola-g06-trasera.webp')
  where slug='motorola-g06-64gb' and foto_portada_path='/demo/motorola-g06-conjunto.webp';
commit;


-- NUEVO V3: conversión a PNG recortados del catálogo.
-- GRIPXELL V3: fichas transparentes PNG, 7 modelos.
-- Ejecutar DESPUÉS de supabase/00_INSTALAR_GRIPXELL_COMPLETO.sql.
-- Idempotente: conserva precios, teléfonos, textos y fotos subidas por administradores.
-- Las imágenes /demo/ se sirven desde el proyecto Astro en Vercel, no se suben a Storage.
begin;

-- Actualiza únicamente imágenes demo antiguas; nunca reemplaza una ruta Storage.
update public.gripxell_celulares as p
set foto_portada_path = '/demo/' || v.slug_imagen || '.png',
    foto_frontal_path = case when p.foto_frontal_path like '/demo/%' then null else p.foto_frontal_path end,
    foto_trasera_path = case when p.foto_trasera_path like '/demo/%' then null else p.foto_trasera_path end,
    foto_lateral_derecha_path = case when p.foto_lateral_derecha_path like '/demo/%' then null else p.foto_lateral_derecha_path end,
    foto_lateral_izquierda_path = case when p.foto_lateral_izquierda_path like '/demo/%' then null else p.foto_lateral_izquierda_path end
from (values
 ('motorola-g06-64gb','motorola-g06'),
 ('naomicase-romy-v2','naomicase-romy-v2'),
 ('naomicase-sena','naomicase-sena'),
 ('samsung-a08','samsung-a08'),
 ('xiaomi-redmi-a7-pro','xiaomi-redmi-a7-pro'),
 ('zte-blade-a56','zte-blade-a56'),
 ('zte-blade-v70-max','zte-blade-v70-max')
) as v(slug,slug_imagen)
where p.slug=v.slug and (
  p.foto_portada_path like '/demo/%'
  or (p.foto_portada_path is null and p.foto_frontal_path like '/demo/%')
);

commit;

select marca, modelo, publicado, foto_portada_path
from public.gripxell_celulares
where slug in (
 'motorola-g06-64gb','naomicase-romy-v2','naomicase-sena',
 'samsung-a08','xiaomi-redmi-a7-pro','zte-blade-a56','zte-blade-v70-max'
)
order by marca, modelo;
