# Importación de fichas de GRIPXELL

Para una ficha con el teléfono a la izquierda y el texto a la derecha, abre `/admin/`, inicia sesión, y pulsa "Agregar celular". Sube la ficha a **Seleccionar ficha de proveedor**. El navegador genera una PNG con transparencia y ejecuta OCR local de texto mediante Tesseract.js (descarga de idiomas al primer uso). Muestra progreso, la vista previa y texto leído. Revisa marca, modelo y especificaciones; ajusta "Ancho de la zona del teléfono" y reprocesa si se recorta algo del equipo. Guarda y publica.

Si proporcionas una foto de cada lado puedes cargar Portada, Frente, Lado derecho, Tapa trasera, Lado izquierdo. No se inventan imágenes ocultas; con una sola foto el visor hace inclinación visual 3D, no rotación física completa.

Los siete modelos de demostración se extrajeron manualmente de las fichas originales del propietario y fueron guardados como PNG transparentes en `public/demo/`. Los modelos reales del catálogo viven en Supabase y se editan desde Admin.

**WhatsApp**: en `Configuración` agrega el número con prefijo de país. Al pulsar "Consultar / comprar", WhatsApp abre un borrador que incluye el nombre y URL exacta del modelo, de forma que el vendedor puede pulsar el link y abrir la ficha.

**Seguridad**: el administrador requiere Supabase Auth más registro de UID; RLS restringe escritura. Sin número WhatsApp el botón de compra queda deshabilitado.
