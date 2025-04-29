@echo off
echo ===================================
echo    Verificação de Rede - Tutoria
echo ===================================
echo.

:: Verificar conexão de rede
echo Testando conexão de rede...
ping 8.8.8.8 -n 1 > nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Sem conexão com a internet!
) else (
    echo [OK] Conexão com a internet estabelecida
)

:: Informações de rede
echo.
echo === Informações de Rede ===
ipconfig | findstr IPv4
ipconfig | findstr Máscara
ipconfig | findstr Gateway

:: Verificar porta 3000
echo.
echo === Status da Porta 3000 ===
netstat -ano | findstr :3000

:: Testar servidor local
echo.
echo === Teste do Servidor Local ===
curl -I http://localhost:3000

:: Verificar processos Node.js
echo.
echo === Processos Node.js Ativos ===
tasklist | findstr node.exe

echo.
echo Verificação concluída!
pause