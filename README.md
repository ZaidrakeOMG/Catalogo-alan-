# GRIPXELL · Catálogo de celulares V2

Proyecto web con **Astro (estático) + Supabase (Auth, PostgreSQL, Storage)**, diseñado para móvil, tablet y escritorio. Incluye catálogo por modelo, fichas técnicas, fotografías de frente/reverso, vista con arrastre y animación, búsqueda y filtros, y compra por WhatsApp.


## NUEVO — V3: panel Admin, importación de fichas, PNG y enlaces WhatsApp

**Panel:** abre `https://TU-DOMINIO.vercel.app/admin/`. Acceso con usuario y contraseña de **Supabase Authentication**, y su User UID en `gripxell_administradores`. No existe contraseña fija en el código.

- **Subir una ficha del distribuidor:** Administrador → Inventario → Agregar celular → **Seleccionar ficha de proveedor**. Se crea la portada PNG sin fondo mediante recorte automático del sector izquierdo. La plantilla de proveedor debe ser blanca y con el teléfono a la izquierda. Si el recorte no queda bien, ajusta el control de ancho y presiona **Reprocesar imagen**, o sube una PNG manual.
- **OCR en el navegador:** Tesseract.js 6.0.1 se carga desde CDN únicamente cuando importas una ficha; intenta leer marca, modelo, memoria y características y llena los campos. Debes revisar los datos antes de publicar; no se garantiza lectura correcta ni se corrigen valores automáticamente. Si no hay conexión para cargar OCR, el PNG puede generarse, y puedes capturar la descripción a mano.
- **Fotos independientes:** al subir imágenes a Portada / Frente / Tapa trasera / Costados, el administrador intenta borrar el blanco exterior y sube un PNG. Si la foto tiene fondo complejo, agrega una PNG con transparencia manualmente. Las fichas que contienen frente y reverso juntos NO se convierten en un modelo 3D geométrico real: el visor crea una **inclinación tipo 3D**; con varias fotos reales puedes cambiar la perspectiva y usar giro automático.
- **WhatsApp de compra:** Configuración → número internacional, ejemplo `52` + 10 dígitos. Cada modelo manda un mensaje con enlace `?modelo=slug` para que el vendedor abra exactamente ese celular. WhatsApp abre con el mensaje preparado; el comprador debe tocar Enviar.
- **Modelos iniciales:** siete teléfonos extraídos de las fichas suministradas, en `/public/demo/*.png`. Sus características se transcribieron de las fichas; no se verificaron contra fabricantes. El usuario puede corregirlas en Admin.

### Base de datos: actualización necesaria

Si nunca ejecutaste SQL, utiliza `supabase/00_INSTALAR_GRIPXELL_COMPLETO.sql` (ahora incluye V3). Si ya instalaste la versión anterior, **ejecuta únicamente** `supabase/05_actualizar_fichas_png.sql` para convertir las rutas de imágenes demo a PNG sin pisar imágenes ni datos que hayas cambiado desde Admin. El catálogo incluye compatibilidad con rutas antiguas mientras realizas ese paso.

### Variables de Vercel

`PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La clave secreta `sb_secret_` no se usa en esta aplicación estática y nunca debe publicarse. Configura `Framework: Astro`, `Root Directory: ./`, `Build: npm run build`, `Output: dist`.

### Pruebas

`npm run check:js && npm test`; se validaron la sintaxis de los archivos JavaScript y la lectura de ejemplos de fichas. La compilación Astro en red y el guardado real en Supabase deben probarse con el deploy de Vercel y el usuario administrador existente.

## Configuración rápida

**1. Base de datos**

En Supabase > SQL Editor ejecuta **`supabase/00_INSTALAR_GRIPXELL_COMPLETO.sql`**. Es el script único, incluye la base inicial y el cambio a V2 y respeta los productos existentes. Como alternativa, corre en orden `01_gripxell_inicial.sql` y `04_gripxell_v2_imagenes_y_modelos.sql`. Después ejecuta `03_verificacion.sql` para comprobar tablas y permisos.

La nueva migración suma `foto_portada_path`, `foto_lateral_derecha_path` y `foto_lateral_izquierda_path`, y flexibiliza la publicación para aceptar **al menos una imagen**. También precarga las fichas de **Motorola G06, Naomicase Romy V2, Samsung A08, Xiaomi Redmi A7 Pro, Naomicase Sena, ZTE Blade A56 y ZTE Blade V70 Max**. Evita duplicados mediante `slug`.

**2. Administrador seguro**

- Supabase > Authentication > Users > Add user (correo + contraseña fuerte, distinta de la compartida en un chat).
- Copia el UUID del usuario creado.
- En `supabase/02_autorizar_admin.sql`, sustituye el UUID de ejemplo y ejecuta ese SQL.
- Entra a `https://TU-DOMINIO/admin/` e inicia sesión con ese correo y contraseña.

**Importante:** NO hay contraseña fija en el proyecto. No hay una `sb_secret`, `service_role`, ni clave de acceso servidor en ningún archivo. La autenticación se verifica con Supabase Auth y la tabla `gripxell_administradores` bajo políticas RLS. Si la contraseña o secret key del proyecto fueron compartidas públicamente, cámbialas/rotálas antes de publicar.

**3. Variables públicas**

El archivo `.env` suministrado configura la URL del proyecto y una **publishable key** de navegador. Puedes reemplazarlas copiando `.env.example` a `.env`:

```dotenv
PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXX
```

Nunca pongas `sb_secret_...` ni `service_role` en `.env`, en las variables `PUBLIC_`, en el repositorio ni en Netlify.

**4. Arranque local**

```bash
npm install
npm run dev
```

Abre `http://localhost:4321/` (catálogo) y `http://localhost:4321/admin/` (administrador).

**5. Publicación**

Para Netlify, conecta este repositorio y usa `npm run build` y directorio de publicación `dist`. Ya incluye `netlify.toml`. Configura las dos variables `PUBLIC_` en Netlify si no subes `.env`.

> En este entorno no fue posible ejecutar `npm install` por un bloqueo de red, así que hace falta realizar la compilación en tu equipo antes de publicar. `node --check` sí valida los scripts JavaScript.

## Fotografías y visor por ángulos

En **Admin > Inventario > Agregar celular** encontrarás:

- Portada del modelo: una imagen con el teléfono, o una ficha horizontal de proveedor.
- Frente, lado derecho, reverso y lado izquierdo: imágenes opcionales para incrementar el realismo del giro.
- Opción de **recorte automático para ficha horizontal**: al subir la portada de una diapositiva de proveedor con proporción ancha, utiliza el área donde normalmente está el equipo, eliminando título y marca del distribuidor. Ajusta o desmarca la opción si el formato es diferente.

**Con una portada** se muestra una vista con inclinación 3D; no se inventa una fotografía del reverso. **Con frente + reverso** se utiliza un modelo CSS tridimensional básico, con costados estilizados y fotografías reales. **Con los cuatro ángulos** se puede recorrer una secuencia fotográfica al arrastrar o activar el avance automático. Para una reconstrucción 3D fotorrealista de 360° hace falta grabar/tomar muchas más vistas o subir un modelo tridimensional.

El catálogo trae varias fotos recortadas de las fichas proporcionadas por el propietario, dentro de `public/demo/`. Esas rutas locales se pueden sustituir por imágenes cargadas en Supabase Storage desde el administrador. Los recortes son demostrativos; hay que revisar modelo, memoria y especificaciones contra las fichas oficiales antes de anunciar productos para su venta.

## Administrador

- Buscar por marca, modelo, color o capacidad.
- Agregar, editar y borrar productos con confirmación.
- Publicar/ocultar, marcar agotado o destacado.
- Capturar precio en MXN opcional, color, memoria y orden.
- Escribir especificaciones en líneas `Campo: valor`, que se convierten en ficha visible.
- Comprimir fotografías a WebP antes de enviarlas; subir y reemplazar archivos del bucket privado para escritura.
- En **Configuración**: nombre, logotipo y WhatsApp de ventas. Sin WhatsApp configurado, el botón de consulta estará desactivado.

## Seguridad

El esquema `public.gripxell_*` tiene **RLS habilitado**. Los visitantes ven únicamente modelos publicados y configuración pública. Los usuarios autenticados solo pueden cambiar productos/configuración o subir fotografías si están dados de alta en `gripxell_administradores`. En Storage las imágenes se leen públicamente, pero la escritura requiere autenticación y rol administrador. Revisa `docs/SEGURIDAD.md`.

## Estructura

- `src/pages/index.astro`: catálogo
- `src/pages/admin.astro`: panel de administrador
- `src/scripts/catalog.js`: búsqueda, vistas 3D por imágenes y WhatsApp
- `src/scripts/admin.js`: sesión, editor, compresión y subida de imágenes
- `src/styles/v2.css`: diseño actualizado y responsive
- `supabase/01_gripxell_inicial.sql`: tablas iniciales y RLS
- `supabase/04_gripxell_v2_imagenes_y_modelos.sql`: migración V2 y los siete modelos
- `public/demo/`: fotografías de ejemplo recortadas de las fichas proporcionadas
