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
