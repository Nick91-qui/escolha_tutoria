@echo off
echo ===================================
echo    Checklist de Preparação
echo ===================================
echo.

:: Verificar requisitos
echo Verificando requisitos do sistema...

:: Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js não encontrado
) else (
    echo [✓] Node.js instalado: 
    node --version
)

:: MongoDB
where mongod >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] MongoDB não encontrado
) else (
    echo [✓] MongoDB instalado
)

:: NPM
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] NPM não encontrado
) else (
    echo [✓] NPM instalado: 
    npm --version
)

:: Verificar arquivos necessários
echo.
echo Verificando arquivos do sistema...

if exist "server.js" (
    echo [✓] server.js encontrado
) else (
    echo [X] server.js não encontrado
)

if exist "package.json" (
    echo [✓] package.json encontrado
) else (
    echo [X] package.json não encontrado
)

if exist "data\alunos.csv" (
    echo [✓] alunos.csv encontrado
) else (
    echo [X] alunos.csv não encontrado
)

:: Verificar dependências
echo.
echo Verificando dependências...
npm list --depth=0

echo.
echo Checklist concluído!
pause