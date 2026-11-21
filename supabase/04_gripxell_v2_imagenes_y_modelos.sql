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
