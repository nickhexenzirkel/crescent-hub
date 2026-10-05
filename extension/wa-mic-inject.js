// Roda DENTRO da página do WhatsApp Web (world: MAIN, document_start) — antes do WhatsApp pedir o
// microfone da ligação. Intercepta navigator.mediaDevices.getUserMedia e entrega à ligação um
// microfone "misturado": a sua voz (microfone real, com os mesmos filtros de eco/ruído) + o áudio
// do aviso prévio, quando o botão "Tocar aviso" da extensão é acionado.
//
// Segurança: se QUALQUER coisa falhar aqui, devolve o stream original do microfone — a ligação
// nunca fica sem áudio por causa deste script. Só o áudio de ligações (audio: true) é mexido.
// Só vale pra ligações iniciadas DEPOIS de este script carregar (dê F5 no WhatsApp antes de ligar).
(() => {
  if (window.__unikoMicInjected) return;
  window.__unikoMicInjected = true;
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  const orig = md.getUserMedia.bind(md);
  const mixers = []; // { ctx, dest, track }

  md.getUserMedia = async function (constraints) {
    const stream = await orig(constraints);
    try {
      if (!constraints || !constraints.audio) return stream;
      const micTracks = stream.getAudioTracks();
      if (!micTracks.length) return stream;
      const ctx = new AudioContext();
      await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(new MediaStream(micTracks));
      const dest = ctx.createMediaStreamDestination();
      src.connect(dest);
      const outTrack = dest.stream.getAudioTracks()[0];
      const mixer = { ctx, dest, track: outTrack };
      mixers.push(mixer);
      // Quando o WhatsApp encerra a ligação (stop no track), libera também o microfone real.
      const origStop = outTrack.stop.bind(outTrack);
      outTrack.stop = () => {
        origStop();
        micTracks.forEach((t) => t.stop());
        ctx.close().catch(() => {});
        const i = mixers.indexOf(mixer); if (i >= 0) mixers.splice(i, 1);
      };
      return new MediaStream([outTrack, ...stream.getVideoTracks()]);
    } catch (e) {
      console.warn('[uniko-call] mic mixer falhou, usando o microfone normal:', e);
      return stream;
    }
  };

  const reply = (data) => window.postMessage({ source: 'uniko-mic', ...data }, '*');

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.target !== 'uniko-mic') return;
    if (e.data.type === 'PING') { reply({ type: 'READY', id: e.data.id, active: mixers.some(m => m.track.readyState === 'live') }); return; }
    if (e.data.type === 'PLAY') {
      const id = e.data.id;
      const m = [...mixers].reverse().find((x) => x.track.readyState === 'live');
      if (!m) { reply({ type: 'PLAYED', id, ok: false, error: 'Nenhuma ligação com microfone ativo. Dê F5 no WhatsApp ANTES de atender/ligar e tente de novo.' }); return; }
      try {
        const buf = await m.ctx.decodeAudioData(e.data.buf.slice(0));
        const node = m.ctx.createBufferSource();
        node.buffer = buf;
        node.connect(m.dest);
        node.onended = () => reply({ type: 'PLAY_ENDED', id });
        node.start();
        reply({ type: 'PLAYED', id, ok: true, seconds: buf.duration });
      } catch (err) {
        reply({ type: 'PLAYED', id, ok: false, error: 'Falha ao tocar o aviso: ' + (err?.message || err) });
      }
    }
  });
  reply({ type: 'READY', id: 0, active: false });
})();
