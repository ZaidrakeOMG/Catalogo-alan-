@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "REPO=https://github.com/ZaidrakeOMG/Catalogo-alan-.git"
echo.
echo ==== GRIPXELL: Actualizar GitHub ====
where git >nul 2>&1
if errorlevel 1 (
  echo Instala Git: https://git-scm.com/downloads/win
  pause
  exit /b 1
)
if not exist ".git\" (
  echo Esta carpeta no contiene el historial de Git.
  echo Clona primero el proyecto:
  echo git clone %REPO%
  echo Abre esa carpeta clonada para hacer cambios.
  pause
  exit /b 1
)
git remote -v
echo.
echo Confirma que ORIGIN es %REPO%
pause
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Actualizar catalogo GRIPXELL"
  if errorlevel 1 goto error
)
git pull --rebase origin main
if errorlevel 1 goto error
git push origin main
if errorlevel 1 goto error
echo.
echo Listo: https://github.com/ZaidrakeOMG/Catalogo-alan-
pause
exit /b 0
:error
echo Hubo un conflicto o error. No se forzo ningun push.
pause
exit /b 1
