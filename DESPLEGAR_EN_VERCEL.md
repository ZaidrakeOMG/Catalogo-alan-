# Publicar GRIPXELL en Vercel

1. Abre https://vercel.com/new e inicia sesion con GitHub.
2. Selecciona `ZaidrakeOMG/Catalogo-alan-`, rama `main`.
3. Framework Preset: **Astro**.
4. Root Directory: **./** (raiz del repositorio).
5. Install Command: `npm install`.
6. Build Command: `npm run build`.
7. Output Directory: `dist`.
8. Node.js: version **22** (si Vercel ofrece seleccion).
9. Agrega **Environment Variables** antes de pulsar Deploy:

| Nombre | Valor |
|---|---|
| PUBLIC_SUPABASE_URL | https://oozojlbjzitwtlegianm.supabase.co |
| PUBLIC_SUPABASE_PUBLISHABLE_KEY | La clave `sb_publishable_` del proyecto Supabase |

Usa las variables para Production y Preview; tambien Development si usaras `vercel dev`.

**No agregues** `sb_secret_`, `service_role` ni la contrasena del administrador en Vercel. Este sitio es Astro estatico y las variables `PUBLIC_` van al navegador; Supabase RLS protege la escritura.

El proyecto no usa un adaptador de servidor de Vercel, ni necesita `SUPABASE_SECRET_KEY` para funcionar.

## Despues del despliegue
1. En Supabase SQL Editor del proyecto `oozojlbjzitwtlegianm`, ejecuta `supabase/00_INSTALAR_GRIPXELL_COMPLETO.sql` si aun no se ha instalado. Revisa antes si ya tienes datos.
2. Crea un usuario en Supabase Authentication (correo y contrasena nueva).
3. En `supabase/02_autorizar_admin.sql` reemplaza el UUID y ejecuta el SQL.
4. Abre `https://tu-dominio.vercel.app/admin/` y entra como administrador.
5. Configura el numero de WhatsApp desde el panel.

La llave `sb_secret_` y la contrasena compartidas en una conversacion deben rotarse. No deben quedar en el codigo fuente.
