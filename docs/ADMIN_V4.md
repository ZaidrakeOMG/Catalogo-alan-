# GRIPXELL Studio — Administrador V4

Panel responsive ubicado en `/admin/` (PC, tablet, Android y iPhone).

## Inventario

- Cuatro indicadores: modelos totales, publicados, borradores y agotados.
- Búsqueda por marca, modelo, capacidad y color.
- Filtros por estado: todos / publicados / borradores / agotados.
- Orden por fecha de creación, nombre o precio.
- Acciones por producto: abrir ficha pública, publicar/ocultar, editar y eliminar.
- **Publicar** requiere descripción y al menos una fotografía. Si falta información, se abre el editor para completarla.
- **Actualizar** consulta los registros de Supabase sin recargar toda la página.

## Editor de productos

- Importación de ficha horizontal: recorte de teléfono en PNG transparente + OCR orientativo.
- Campos: marca, modelo, color, capacidad, precio MXN y orden.
- Imágenes opcionales de frente, reverso y ambos costados.
- Descripción y especificaciones en formato `Característica: valor`.
- Visibilidad: publicado, disponible y destacado.
- **Vista previa reactiva** de la tarjeta que verá el cliente; progreso de preparación con tres comprobaciones.
- Los datos de OCR se deben revisar contra la ficha original antes de publicar.

## Configuración

Personaliza el nombre comercial, subtítulo, logotipo y número de WhatsApp. El catálogo construye un enlace individual por modelo y prepara el mensaje en WhatsApp para que el visitante lo envíe.

## Acceso y base de datos

El usuario debe existir en Supabase Auth y estar en `gripxell_administradores`. El panel utiliza la URL y clave **pública** configuradas en Vercel. No es necesario agregar variables nuevas para la V4.

Para los siete modelos, el script `supabase/06_REPARAR_CATALOGO_SIN_MODELOS.sql` prepara columnas V2 y publica los registros faltantes. Ejecutarlo en la base que apunta Vercel.

## Pruebas realizadas

- `npm run check:js`: correcto.
- `npm test`: 3 pruebas superadas.
- Vistas locales representativas de escritorio 1440 px y móvil 390 px: sin desplazamiento horizontal.
- No se ha verificado en esta sesión el acceso de Supabase Auth contra el servidor en producción ni la compilación completa de Astro.

Los cambios están en `src/pages/admin.astro`, `src/scripts/admin.js` y `src/styles/admin-premium.css`. El catálogo público no fue rediseñado.
