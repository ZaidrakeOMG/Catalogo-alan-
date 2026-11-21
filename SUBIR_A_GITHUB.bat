@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "REPO=https://github.com/ZaidrakeOMG/GRIPXELL-CATALOGO.git"

echo.
echo ================================================
echo  GRIPXELL - Subir catalogo a GitHub (rama main)
echo ================================================
echo.
echo Antes debes crear un repositorio PRIVADO y VACIO:
echo https://github.com/new
 echo Nombre: GRIPXELL-CATALOGO
 echo Propietario: ZaidrakeOMG
 echo No marques README, .gitignore ni licencia.
echo.
pause

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git no esta instalado. https://git-scm.com/downloads/win
  pause
  exit /b 1
)
if not exist ".git\" (
  git init -b main
  if errorlevel 1 goto :error
)
git check-ignore -q .env
if errorlevel 1 (
  echo ERROR DE SEGURIDAD: El archivo .env NO esta ignorado.
  pause
  exit /b 1
)
git add --all
if errorlevel 1 goto :error
git ls-files --cached --error-unmatch .env >nul 2>&1
if not errorlevel 1 (
  echo ERROR DE SEGURIDAD: .env esta incluido en Git. No se subira.
  pause
  exit /b 1
)
set "ORIGIN="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "ORIGIN=%%R"
if not defined ORIGIN (
  git remote add origin "%REPO%"
  if errorlevel 1 goto :error
) else (
  if /I not "%ORIGIN%"=="%REPO%" (
    echo ERROR: Ya existe un remote origin diferente: %ORIGIN%
    echo Revisa Git: no se reemplaza ni se hace push forzado.
    pause
    exit /b 1
  )
)
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Version inicial catalogo GRIPXELL Astro V2"
  if errorlevel 1 (
    echo.
    echo Si Git pide identidad, ejecuta estos comandos con tus datos:
    echo git config --global user.name "Tu Nombre"
    echo git config --global user.email "tu@email.com"
    goto :error
  )
)
git branch -M main
if errorlevel 1 goto :error
echo.
echo Subiendo a: %REPO%
git push -u origin main
if errorlevel 1 (
  echo.
  echo No se subio. Si GitHub pide credenciales, inicia sesion.
  echo Si el repo tiene un commit previo, no hagas force-push.
  goto :error
)
echo.
echo LISTO! Abre https://github.com/ZaidrakeOMG/GRIPXELL-CATALOGO
pause
exit /b 0
:error
echo.
echo Hubo un error. Tu codigo local sigue intacto.
pause
exit /b 1
