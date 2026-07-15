@echo off
chcp 65001 >nul
title Tunel Uniko Wave - NAO FECHE ESTA JANELA
color 0B

set VPS=root@187.127.27.98
set PORTA=18080

echo ============================================================
echo   TUNEL DO UNIKO WAVE
echo ============================================================
echo.
echo   Este tunel faz o servidor baixar as musicas do YouTube
echo   saindo pela internet DAQUI (o YouTube nao aceita o IP
echo   da VPS sozinho).
echo.
echo   - Vai pedir a senha do root, as vezes DUAS vezes.
echo   - Depois que conectar, a janela fica PARADA e sem texto.
echo     Isso e o normal: significa que esta funcionando.
echo   - DEIXE ESTA JANELA ABERTA. Se fechar, o Uniko Wave
echo     para de analisar o ritmo das musicas.
echo   - Para encerrar de proposito: feche a janela ou Ctrl+C.
echo.
echo ============================================================
echo.

echo [1/3] Conferindo o IPv6 (precisa preferir IPv4)...
netsh interface ipv6 show prefixpolicies | findstr /C:"::ffff:0:0/96" >nul 2>&1
for /f "tokens=1" %%A in ('netsh interface ipv6 show prefixpolicies ^| findstr /C:"::ffff:0:0/96"') do set PREC=%%A
if "%PREC%"=="60" (
  echo       OK - IPv4 tem prioridade.
) else (
  echo       ATENCAO: o IPv4 NAO esta com prioridade ^(valor atual: %PREC%^).
  echo       Sem isso o tunel conecta mas nao baixa nada.
  echo       Corrija UMA VEZ, num PowerShell como ADMINISTRADOR:
  echo.
  echo         netsh interface ipv6 set prefixpolicy ::ffff:0:0/96 60 4
  echo.
  pause
)

echo [2/3] Liberando a porta %PORTA% na VPS ^(pode pedir a senha^)...
ssh -o ConnectTimeout=15 %VPS% "fuser -k %PORTA%/tcp 2>/dev/null; sleep 2; echo porta liberada"

echo.
echo [3/3] Abrindo o tunel. A partir daqui a janela fica quieta.
echo.

:LOOP
echo [%time:~0,8%] conectando...
ssh -N -R %PORTA% -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o ConnectTimeout=15 %VPS%
echo.
echo [%time:~0,8%] O tunel caiu ou foi fechado.
echo Reabrindo em 10 segundos... ^(feche a janela para parar de vez^)
timeout /t 10 >nul
goto LOOP
