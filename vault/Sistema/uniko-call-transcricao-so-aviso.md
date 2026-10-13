---
name: uniko-call-transcricao-so-aviso
description: Uniko Call 08/out/2026 — transcrição das ligações do financeiro (Karina/Rian) saía só com o aviso; rota aviso-audio restaurada; fix fe1d605 PRECISA deploy e reteste
metadata:
  type: project
---

Em 08/out/2026: (1) rota `/api/uniko-call/aviso-audio` tinha sido apagada sem querer no commit do `whoami` (70af60d) → 404 no "Ouvir o aviso"; restaurada em 608c33a, funcionou. (2) Gravações 59 e 61 (ligações do financeiro, Karina no Chrome / Rian no Edge, WhatsApp Web, extensão 1.7.4) transcreveram só o aviso, mas o áudio tinha 20–28 s de sinal forte depois do aviso (medido baixando do Storage público com ffmpeg-static de Music/doko-call) → captura OK, falha na transcrição. Fix fe1d605: transcreve SÓ a ligação (req.file.buffer) e prefixa AVISO_TEXTO; PRECISA `git pull` + `pm2 restart --update-env` na VPS e reteste.

**Why:** hipótese não confirmada (não ouvi o áudio); o usuário ia ouvir 59/61 no player pra ver se há as duas vozes. Se só uma ponta aparecer, o problema é captura na máquina, não o servidor. Gravação 60 (sem aviso, 39 KB) → "context:" alucinado e apagada por falta de consentimento = esperado. O usuário citou um "segundo erro" que ainda não descreveu.

**How to apply:** ao retomar o assunto, pedir o resultado do reteste e o segundo erro. Eu não tenho SSH na VPS (pede chave/senha) — o usuário roda `pm2 logs ... | grep -i uniko-call` e cola. Ver [[uniko-call-transcricao]] e [[hostinger-vps-deploy]]. Também: ícone "!" amarelo da extensão = ligação detectada aguardando iniciar gravação (♪ aviso tocando, ✔ aviso acabou, ● gravando). Extensão e servidor não se atualizam sozinhos (sem update_url; servidor precisa git pull + pm2 restart).
