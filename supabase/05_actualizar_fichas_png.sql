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
