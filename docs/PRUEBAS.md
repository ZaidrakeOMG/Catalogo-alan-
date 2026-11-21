# Lista de comprobación GRIPXELL V2

## Base y acceso

- [ ] Ejecutar `supabase/00_INSTALAR_GRIPXELL_COMPLETO.sql` desde SQL Editor (o `01` + `04` si se prefiere).
- [ ] Confirmar siete modelos con `supabase/03_verificacion.sql`.
- [ ] Crear usuario en Auth y agregar su UUID a `gripxell_administradores`.
- [ ] Sin sesión, `/admin/` solicita correo y contraseña.
- [ ] Un usuario sin rol administrador no puede leer borradores ni escribir datos.
- [ ] No publicar contraseñas ni claves secretas en repositorio, Netlify o navegador.

## Catálogo

- [ ] Las tarjetas muestran marca y modelo correctos.
- [ ] Filtrar por marca y buscar por nombre.
- [ ] Abrir Motorola G06, Naomicase Romy V2, Samsung A08, Redmi A7 Pro, Naomicase Sena, ZTE Blade A56, ZTE Blade V70 Max.
- [ ] En modelos con frente/reverso: arrastrar para girar el teléfono, usar flechas y giro automático.
- [ ] En modelos con solo portada: inclinar la imagen sin inventar lados que no existen.
- [ ] Verificar ficha de características y botón de compartir.
- [ ] Con WhatsApp configurado: validar enlace wa.me y nombre del modelo en el mensaje.

## Administración

- [ ] Agregar modelo sin foto como borrador.
- [ ] Publicar modelo con una sola portada.
- [ ] Subir una ficha horizontal y activar recorte automático; revisar el recorte antes de guardar.
- [ ] Subir cuatro fotos opcionales: frente, derecha, atrás, izquierda.
- [ ] Editar modelo, foto, descripción, precio, disponibilidad y estado publicado.
- [ ] Confirmar eliminación y comprobar que el registro deja de aparecer.

## Responsive

- [x] Se renderizó una vista estática de ejemplo en 1440 px y 390 px, con 7 tarjetas y sin desplazamiento horizontal.
- [x] Se renderizó el panel y editor móvil (390 px) de manera estática.
- [ ] Confirmar navegación, cargas y formularios en iPhone Safari, Android Chrome y PC con datos reales.
- [ ] Ejecutar `npm install`, `npm run build` y `npm run dev` en un entorno con Internet.
