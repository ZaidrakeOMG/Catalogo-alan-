# GRIPXELL - GitHub
El repositorio del catalogo esta en:
https://github.com/ZaidrakeOMG/Catalogo-alan-

## Primer uso en Windows
1. Instala Git: https://git-scm.com/downloads/win
2. Clona con `git clone https://github.com/ZaidrakeOMG/Catalogo-alan-.git`.
3. Abre la carpeta `Catalogo-alan-` en Visual Studio Code.
4. Copia `.env.example` a `.env` y configura solamente las claves PUBLIC_ de Supabase.
5. Ejecuta `npm install` y `npm run dev`.

## Subir tus cambios
Desde el clon:
```bash
git add -A
git commit -m "Actualizar catalogo"
git pull --rebase origin main
git push origin main
```
Tambien puedes usar `SUBIR_A_GITHUB.bat` desde una carpeta ya clonada.

**No vuelvas a hacer `git init` ni `git push --force` sobre el repositorio existente.** No subas `.env`, contraseñas, ni `sb_secret_`. Para publicar consulta `DESPLEGAR_EN_VERCEL.md`.
