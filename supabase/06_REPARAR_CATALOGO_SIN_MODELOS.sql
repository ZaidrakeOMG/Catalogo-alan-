-- GRIPXELL | Reparación de catálogo vacío
-- Ejecuta en el proyecto Supabase que utiliza Vercel.
-- Requiere haber ejecutado 00_INSTALAR_GRIPXELL_COMPLETO.sql.
-- Inserta los 7 modelos faltantes, publica los existentes y preserva precios/fotos personales.
-- Se puede ejecutar varias veces sin duplicar productos.
BEGIN;

INSERT INTO public.gripxell_celulares
(slug, marca, modelo, color, capacidad, descripcion, especificaciones, foto_portada_path, disponible, publicado, orden)
VALUES
('motorola-g06-64gb','Motorola','G06','Verde azulado','64 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 50 MP\nPantalla: 6.8 pulgadas\nProcesador: MediaTek Helio G81 Extreme (2x A75 2.0 GHz + 6x A55 1.7 GHz)\nMemoria: 64 GB\nSistema operativo: Android 15',
 '{"red":"4G","camara_frontal":"8 MP","camara_trasera":"50 MP","pantalla":"6.8 pulgadas","procesador":"MediaTek Helio G81 Extreme","almacenamiento":"64 GB","sistema_operativo":"Android 15"}'::jsonb,
 '/demo/motorola-g06.png',true,true,0),
('naomicase-romy-v2','Naomicase','Romy V2','Rojo','32 MB',
 E'Pantalla: 1.77 pulgadas\nSistema operativo: Propietario\nRed: 2G\nMemoria interna: 32 MB\nMemoria RAM: 32 MB\nLinterna: Sí\nLector de MicroSD: Sí',
 '{}'::jsonb,'/demo/naomicase-romy-v2.png',true,true,1),
('samsung-a08','Samsung','A08',null,'64 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 50 MP\nPantalla: 6.7 pulgadas\nProcesador: MediaTek Helio G99+ (MT6789X), 2x 2.2 GHz + 6x 2.0 GHz\nMemoria: 64 GB\nSistema operativo: Android 17 (según ficha del proveedor)',
 '{}'::jsonb,'/demo/samsung-a08.png',true,true,2),
('xiaomi-redmi-a7-pro','Xiaomi','Redmi A7 Pro','Azul','64 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 13 MP + QVGA\nPantalla: 6.9 pulgadas\nProcesador: Unisoc T7250, 2x A75 1.8 GHz + 6x A55 1.6 GHz\nMemoria: 64 GB\nSistema operativo: Android 16 (según ficha del proveedor)',
 '{}'::jsonb,'/demo/xiaomi-redmi-a7-pro.png',true,true,3),
('naomicase-sena','Naomicase','Sena','Negro','4 GB ROM / 512 MB RAM',
 E'Red: 3G\nCámara frontal: 0.3 MP\nCámara trasera: 0.3 MP\nPantalla: 4.0 pulgadas\nProcesador: Quad-Core MTK6572\nMemoria: ROM 4 GB, RAM 512 MB',
 '{}'::jsonb,'/demo/naomicase-sena.png',true,true,4),
('zte-blade-a56','ZTE','Blade A56','Plata','128 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 13 MP + AI Cam + AI Cam\nPantalla: 6.8 pulgadas\nProcesador: Unisoc T7200 Octa-Core 2x A75 1.6 GHz + 6x A55 1.6 GHz\nMemoria: 128 GB\nSistema operativo: Android 15',
 '{}'::jsonb,'/demo/zte-blade-a56.png',true,true,5),
('zte-blade-v70-max','ZTE','Blade V70 Max','Azul / Verde','256 GB',
 E'Red: 4G\nCámara frontal: 8 MP\nCámara trasera: 50 MP + 2 MP\nPantalla: 6.9 pulgadas\nProcesador: Unisoc T606 Octa-Core 2x A75 1.6 GHz + 6x A55 1.6 GHz\nMemoria: 256 GB\nSistema operativo: Android 15',
 '{}'::jsonb,'/demo/zte-blade-v70-max.png',true,true,6)
ON CONFLICT (slug) DO UPDATE SET
  publicado = true,
  -- Conserva fotos personales (rutas Storage), reemplaza únicamente fotos de ejemplo.
  foto_portada_path = CASE
    WHEN nullif(btrim(public.gripxell_celulares.foto_portada_path),'') IS NULL
      OR public.gripxell_celulares.foto_portada_path LIKE '/demo/%'
    THEN EXCLUDED.foto_portada_path
    ELSE public.gripxell_celulares.foto_portada_path
  END,
  descripcion = CASE
    WHEN length(btrim(public.gripxell_celulares.descripcion)) = 0 THEN EXCLUDED.descripcion
    ELSE public.gripxell_celulares.descripcion
  END,
  especificaciones = CASE
    WHEN public.gripxell_celulares.especificaciones = '{}'::jsonb THEN EXCLUDED.especificaciones
    ELSE public.gripxell_celulares.especificaciones
  END;

-- Si faltaba el registro de configuración, se repone sin modificar datos existentes.
INSERT INTO public.gripxell_configuracion (id)
VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Debe mostrar siete registros con publicado = true.
SELECT slug, marca, modelo, publicado, foto_portada_path
FROM public.gripxell_celulares
WHERE slug IN (
'motorola-g06-64gb','naomicase-romy-v2','naomicase-sena',
'samsung-a08','xiaomi-redmi-a7-pro','zte-blade-a56','zte-blade-v70-max'
)
ORDER BY orden, modelo;

-- Conteo: un visitante solo verá publicado = true.
SELECT COUNT(*) AS modelos_totales,
       COUNT(*) FILTER (WHERE publicado = true) AS modelos_publicados
FROM public.gripxell_celulares;
