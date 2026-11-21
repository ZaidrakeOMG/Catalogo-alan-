# Publicar GRIPXELL Catálogo V2 en GitHub

Ya tienes conectada tu cuenta `ZaidrakeOMG` de GitHub. **No utilices el repositorio `GRIPXELL`**, porque aloja un proyecto independiente de créditos, clientes e IMEI.

## Primera subida (Windows)

1. Entra a https://github.com/new (con la cuenta **ZaidrakeOMG**).
2. **Repository name:** `GRIPXELL-CATALOGO`.
3. **Visibility:** Private (recomendado). NO habilites README, .gitignore o licencia: debe quedar vacío.
4. En esta misma carpeta descomprimida haz doble clic en `SUBIR_A_GITHUB.bat`.
5. Confirma el inicio de sesión de GitHub si se solicita.
6. Verifica que el proyecto aparezca en https://github.com/ZaidrakeOMG/GRIPXELL-CATALOGO

Si no tienes Git, descárgalo de https://git-scm.com/downloads/win. Si el commit falla por no tener configurados tu nombre y correo, ejecuta en CMD:

```
git config --global user.name "Tu Nombre"
git config --global user.email "tu_correo@ejemplo.com"
```

Después vuelve a ejecutar el BAT. El script no hace `push --force` ni modifica el repositorio original.

## Alternativa: comandos Git manuales

Desde la carpeta raíz del proyecto:

```powershell
git init -b main
git add .
git commit -m "Version inicial catalogo GRIPXELL Astro V2"
git remote add origin https://github.com/ZaidrakeOMG/GRIPXELL-CATALOGO.git
git push -u origin main
```

## Seguridad y publicación

- No subas `.env`, claves secretas (`sb_secret_...`), contraseñas, llaves de servicio, contraseñas de administración, ni copias de base de datos. El `.gitignore` lo impide para `.env`.
- `.env.example` contiene solo variables de ejemplo. Para ejecutar localmente, copia a `.env` y escribe solo la URL de Supabase y la **publishable key** pública; Astro utiliza las variables `PUBLIC_`.
- **Rota la clave secret de Supabase y cambia la contraseña de administrador que fueron compartidas en el chat.** Nunca incluyas una clave `sb_secret_` en Astro del lado del navegador.
- Para Netlify configura `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY` en Environment variables, y usa `npm run build` con carpeta `dist`.
- Para que ChatGPT pueda leer y actualizar directamente el nuevo repositorio a través de GitHub, autoriza el repositorio en la conexión de GitHub de ChatGPT si la instalación tiene acceso restringido.

## Trabajo futuro

Con el enlace de GitHub podremos revisar el código, crear ramas y publicar commits o solicitudes de cambios sin enviarte nuevos ZIP cada vez. No es necesario dar contraseñas ni tokens de GitHub por el chat.
