# Seguridad del catálogo

La app puede leer productos con la **publishable key**, pero **no confía en ella para autorizar modificaciones**. Supabase RLS exige un JWT válido de un usuario que aparece en `public.gripxell_administradores`.

Las tablas públicas solo exponen productos `publicado=true` y la configuración de la tienda. El administrador puede leer borradores y modificar productos tras autenticación.

El bucket `gripxell-celulares` es público para la visualización de imágenes. Las políticas de Storage restringen escrituras a administradores. No utilices el mismo bucket para datos privados.

Las claves `sb_secret` / `service_role` dan accesos privilegiados; **nunca deben colocarse en JavaScript de navegador, `PUBLIC_` variables o archivos servidos públicamente**. Si se compartieron por error, rótalas.

Las tablas y el bucket llevan prefijo GRIPXELL para evitar modificar otros proyectos que compartan la misma cuenta Supabase.
