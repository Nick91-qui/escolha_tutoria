@echo off
setlocal enabledelayedexpansion

echo ===================================
echo    Sistema de Tutoria - JCB
echo    Configuracao de Alta Performance
echo ===================================
echo.

:: Navegar para o diretório raiz (um nível acima do deploy)
cd /d "%~dp0.."
echo Diretorio atual: %CD%
echo.

:: Definir variáveis de ambiente
set NODE_ENV=production
set UV_THREADPOOL_SIZE=8
set NODE_OPTIONS=--max-old-space-size=2048

echo Verificando requisitos...

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js e tente novamente.
    pause
    exit /b 1
)

:: Verificar se package.json existe
if not exist "package.json" (
    echo [ERRO] package.json nao encontrado
    echo Diretorio atual: %CD%
    echo Certifique-se de estar no diretorio correto.
    echo.
    pause
    exit /b 1
)

:: Verificar porta 3000
echo Verificando porta 3000...
netstat -ano | findstr ":3000" >nul
if %ERRORLEVEL% EQU 0 (
    echo [AVISO] Porta 3000 ja esta em uso!
    echo Tentando liberar a porta...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

:: Criar diretórios necessários
if not exist "logs" (
    echo Criando diretorio de logs...
    mkdir logs
)

if not exist "logs\pm2" (
    echo Criando diretorio de logs do PM2...
    mkdir logs\pm2
)

:: Verificar e instalar dependências
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERRO] Falha ao instalar dependencias!
        pause
        exit /b 1
    )
)

:: Limpar a tela
cls

echo ===================================
echo    Iniciando Sistema de Tutoria
echo ===================================
echo.

:: Iniciar monitor em nova janela
echo Iniciando monitor do sistema...
start "Monitor do Sistema" cmd /c "node src/monitor-local.js"

:: Iniciar servidor
echo.
echo Iniciando servidor principal...
echo [Pressione Ctrl+C para encerrar]
echo.

:: Tentar iniciar o servidor
node src/server.js

:: Se o servidor fechar, mostrar mensagem
echo.
echo O servidor foi encerrado.
echo Verificando processos residuais...

:: Limpar processos Node.js residuais
taskkill /F /IM node.exe >nul 2>&1

echo.
echo Pressione qualquer tecla para fechar...
pause >nul