// Dashboard RH → aba "Uniko Suspect".
// Editor visual do mapa do jogo: pintar/apagar parede direto em cima da arte
// real (substitui o editor standalone em public/uniko-suspect-editor.html —
// esse aqui salva no Supabase em vez de um arquivo estático, então nunca
// mais cai no problema de cache do navegador servindo a máscara velha), mais
// marcar onde vão ficar as TAREFAS e a posição/ícone do BOTÃO DE EMERGÊNCIA.
// Tudo numa linha só (uniko_suspect_map, id=1) — rodar
// supabase_uniko_suspect_map.sql antes (idempotente).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase } from '../../contexts/user';
import { Card, Moon } from '../../shared/components';
import { MAPA_IMG, MAP_W, MAP_H } from '../central-colaborador/tabs/TabUnikoSuspect';

const BUCKET = 'uniko-suspect-map';
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

const modeBtnStyle = (on, color) => ({
  flex: 1, padding: '10px 8px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
  fontFamily: 'var(--font-body)', border: `1.5px solid ${on ? color : T.border}`,
  background: on ? `${color}18` : 'transparent', color: on ? color : T.textS,
});

const UnikoSuspectMapTab = ({ cardBg, adminName }) => {
  const bg = cardBg || T.surface;
  const bgCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null); // offscreen — fonte de verdade da máscara
  const emergencyIconInputRef = useRef(null);
  const drawingRef = useRef(false);
  const historyRef = useRef([]);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('paredes'); // 'paredes' | 'tarefas' | 'emergencia'
  const [paintMode, setPaintMode] = useState('paint'); // 'paint' | 'erase'
  const [brush, setBrush] = useState(18);
  const [zoom, setZoom] = useState(55);
  const [opacity, setOpacity] = useState(55);
  const [showMask, setShowMask] = useState(true);
  const [coords, setCoords] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [emergency, setEmergency] = useState(null); // {x,y} | null
  const [emergencyIconUrl, setEmergencyIconUrl] = useState('');
  const [emergencyIconUploading, setEmergencyIconUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4500); };

  const composite = useCallback(() => {
    const overlay = overlayCanvasRef.current, mc = maskCanvasRef.current;
    if (!overlay || !mc) return;
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, MAP_W, MAP_H);
    if (showMask) {
      octx.globalAlpha = opacity / 100;
      octx.drawImage(mc, 0, 0);
      octx.globalAlpha = 1;
    }
    tasks.forEach((t, i) => {
      octx.beginPath(); octx.arc(t.x, t.y, 15, 0, Math.PI * 2);
      octx.fillStyle = 'rgba(37,99,235,.92)'; octx.fill();
      octx.lineWidth = 3; octx.strokeStyle = '#fff'; octx.stroke();
      octx.fillStyle = '#fff'; octx.font = 'bold 15px sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillText(String(i + 1), t.x, t.y);
    });
    if (emergency) {
      octx.beginPath(); octx.arc(emergency.x, emergency.y, 19, 0, Math.PI * 2);
      octx.fillStyle = 'rgba(220,38,38,.92)'; octx.fill();
      octx.lineWidth = 3; octx.strokeStyle = '#fff'; octx.stroke();
      octx.fillStyle = '#fff'; octx.font = 'bold 19px sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillText('!', emergency.x, emergency.y);
    }
  }, [showMask, opacity, tasks, emergency]);

  useEffect(() => { composite(); }, [composite]);

  // ── Carrega mapa base + linha do banco (máscara/tarefas/emergência) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      const mc = document.createElement('canvas');
      mc.width = MAP_W; mc.height = MAP_H;
      maskCanvasRef.current = mc;

      const rowP = _supabase.from('uniko_suspect_map').select('*').eq('id', 1).maybeSingle();

      const bgImg = new Image();
      await new Promise((resolve) => { bgImg.onload = resolve; bgImg.onerror = resolve; bgImg.src = MAPA_IMG; });
      if (!alive) return;
      const bgCanvas = bgCanvasRef.current;
      bgCanvas.width = MAP_W; bgCanvas.height = MAP_H;
      bgCanvas.getContext('2d').drawImage(bgImg, 0, 0);
      overlayCanvasRef.current.width = MAP_W; overlayCanvasRef.current.height = MAP_H;

      let row = null;
      try { const { data } = await rowP; row = data; } catch {}
      if (!alive) return;
      if (row) {
        setTasks(Array.isArray(row.tasks) ? row.tasks : []);
        if (row.emergency_x != null && row.emergency_y != null) setEmergency({ x: row.emergency_x, y: row.emergency_y });
        if (row.emergency_icon_url) setEmergencyIconUrl(row.emergency_icon_url);
        setUpdatedAt(row.updated_at || null);
        setUpdatedBy(row.updated_by || '');
      }

      const maskUrl = row?.wall_mask_url || '/uniko-suspect-wallmask.png';
      await new Promise((resolve) => {
        const mImg = new Image();
        mImg.crossOrigin = 'anonymous';
        mImg.onload = () => {
          try {
            const tmp = document.createElement('canvas'); tmp.width = MAP_W; tmp.height = MAP_H;
            const tctx = tmp.getContext('2d'); tctx.drawImage(mImg, 0, 0);
            const data = tctx.getImageData(0, 0, MAP_W, MAP_H);
            const mctx = mc.getContext('2d');
            const out = mctx.createImageData(MAP_W, MAP_H);
            for (let i = 0; i < data.data.length; i += 4) {
              const isWall = data.data[i] > 128;
              out.data[i] = 220; out.data[i + 1] = 38; out.data[i + 2] = 38;
              out.data[i + 3] = isWall ? 255 : 0;
            }
            mctx.putImageData(out, 0, 0);
          } catch (e) { console.error('[uniko-suspect-map]', e); }
          resolve();
        };
        mImg.onerror = resolve;
        mImg.src = maskUrl + (maskUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      });
      if (!alive) return;
      setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapPoint = (e) => {
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width, scaleY = MAP_H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const pushHistory = () => {
    try {
      const snap = maskCanvasRef.current.getContext('2d').getImageData(0, 0, MAP_W, MAP_H);
      historyRef.current.push(snap);
      if (historyRef.current.length > 25) historyRef.current.shift();
    } catch {}
  };
  const undo = () => {
    const snap = historyRef.current.pop();
    if (!snap) { flash('Nada pra desfazer.'); return; }
    maskCanvasRef.current.getContext('2d').putImageData(snap, 0, 0);
    composite();
  };

  const paintAt = (x, y) => {
    const mctx = maskCanvasRef.current.getContext('2d');
    mctx.beginPath(); mctx.arc(x, y, brush, 0, Math.PI * 2);
    if (paintMode === 'paint') { mctx.globalCompositeOperation = 'source-over'; mctx.fillStyle = 'rgba(220,38,38,1)'; }
    else { mctx.globalCompositeOperation = 'destination-out'; mctx.fillStyle = 'rgba(0,0,0,1)'; }
    mctx.fill();
    mctx.globalCompositeOperation = 'source-over';
  };

  const onPointerDown = (e) => {
    if (!ready) return;
    const p = mapPoint(e);
    if (mode === 'paredes') {
      drawingRef.current = true;
      pushHistory();
      paintAt(p.x, p.y);
      composite();
      try { overlayCanvasRef.current.setPointerCapture(e.pointerId); } catch {}
    } else if (mode === 'tarefas') {
      const near = tasks.find(t => Math.hypot(t.x - p.x, t.y - p.y) < 22);
      if (near) {
        if (window.confirm(`Remover a tarefa "${near.label}"?`)) setTasks(ts => ts.filter(t => t.id !== near.id));
      } else {
        const label = window.prompt('Nome da tarefa:', `Tarefa ${tasks.length + 1}`);
        if (label && label.trim()) setTasks(ts => [...ts, { id: uid(), label: label.trim(), x: Math.round(p.x), y: Math.round(p.y) }]);
      }
    } else if (mode === 'emergencia') {
      setEmergency({ x: Math.round(p.x), y: Math.round(p.y) });
    }
  };
  const onPointerMove = (e) => {
    if (!ready) return;
    const p = mapPoint(e);
    setCoords(p);
    if (!drawingRef.current || mode !== 'paredes') return;
    paintAt(p.x, p.y);
    composite();
  };
  const onPointerUp = () => { drawingRef.current = false; };

  const uploadEmergencyIcon = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { flash('⚠️ Escolha um arquivo de imagem.'); return; }
    if (file.size > 6 * 1024 * 1024) { flash('⚠️ Imagem maior que 6MB.'); return; }
    setEmergencyIconUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `emergency-icon-${Date.now()}-${uid()}.${ext}`;
      const { error } = await _supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = _supabase.storage.from(BUCKET).getPublicUrl(path);
      setEmergencyIconUrl(data.publicUrl);
      flash('✅ Imagem enviada — clica em Salvar pra confirmar.');
    } catch (e) { flash('⚠️ ' + (e.message || 'Erro ao enviar imagem')); }
    setEmergencyIconUploading(false);
  };

  const salvar = async () => {
    setSaving(true); setMsg('');
    try {
      const data = maskCanvasRef.current.getContext('2d').getImageData(0, 0, MAP_W, MAP_H);
      const out = document.createElement('canvas'); out.width = MAP_W; out.height = MAP_H;
      const octx = out.getContext('2d');
      const res = octx.createImageData(MAP_W, MAP_H);
      for (let i = 0; i < data.data.length; i += 4) {
        const v = data.data[i + 3] > 30 ? 255 : 0;
        res.data[i] = v; res.data[i + 1] = v; res.data[i + 2] = v; res.data[i + 3] = 255;
      }
      octx.putImageData(res, 0, 0);
      const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
      const path = `wallmask-${Date.now()}-${uid()}.png`;
      const { error: upErr } = await _supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = _supabase.storage.from(BUCKET).getPublicUrl(path);

      const now = new Date().toISOString();
      const { error: saveErr } = await _supabase.from('uniko_suspect_map').upsert({
        id: 1,
        wall_mask_url: urlData.publicUrl,
        tasks,
        emergency_x: emergency?.x ?? null,
        emergency_y: emergency?.y ?? null,
        emergency_icon_url: emergencyIconUrl || null,
        updated_by: adminName,
        updated_at: now,
      });
      if (saveErr) throw saveErr;
      setUpdatedAt(now); setUpdatedBy(adminName || '');
      flash('✅ Mapa salvo! Já vale pra quem entrar no jogo.');
    } catch (e) { flash('⚠️ ' + (e.message || 'Erro ao salvar')); }
    setSaving(false);
  };

  const cssW = Math.round(MAP_W * zoom / 100), cssH = Math.round(MAP_H * zoom / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '14px 20px', borderRadius: 13, background: bg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${T.border}`, boxShadow: T.shM, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: '.04em' }}>Uniko Suspect — Editor de Mapa</div>
          <div style={{ fontSize: 13, color: T.textS, marginTop: 2 }}>
            Pinte a parede direto em cima do mapa real, marque onde ficam as tarefas e a posição do botão de emergência.
            {updatedAt && <> Última vez salvo {updatedBy ? `por ${updatedBy} ` : ''}em {new Date(updatedAt).toLocaleString('pt-BR')}.</>}
          </div>
        </div>
        <Moon size={24} color={T.goldL} opacity={0.35} float />
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── Painel lateral ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em', marginBottom: 8 }}>MODO</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={modeBtnStyle(mode === 'paredes', '#DC2626')} onClick={() => setMode('paredes')}>🧱 Paredes</button>
              <button style={modeBtnStyle(mode === 'tarefas', '#2563EB')} onClick={() => setMode('tarefas')}>📋 Tarefas</button>
              <button style={modeBtnStyle(mode === 'emergencia', '#D97706')} onClick={() => setMode('emergencia')}>🚨 Emergência</button>
            </div>
          </Card>

          {mode === 'paredes' && (
            <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>PINCEL</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={modeBtnStyle(paintMode === 'paint', '#DC2626')} onClick={() => setPaintMode('paint')}>🔴 Pintar</button>
                <button style={modeBtnStyle(paintMode === 'erase', '#16A34A')} onClick={() => setPaintMode('erase')}>🟢 Apagar</button>
              </div>
              <label style={{ fontSize: 12, color: T.textS, display: 'flex', justifyContent: 'space-between' }}>Tamanho <b>{brush}px</b></label>
              <input type="range" min="2" max="80" value={brush} onChange={e => setBrush(+e.target.value)} />
              <label style={{ fontSize: 12, color: T.textS, display: 'flex', justifyContent: 'space-between' }}>Opacidade <b>{opacity}%</b></label>
              <input type="range" min="10" max="100" value={opacity} onChange={e => { setOpacity(+e.target.value); }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="sus-btn" onClick={() => setShowMask(v => !v)} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 12, cursor: 'pointer' }}>{showMask ? 'Esconder' : 'Mostrar'} máscara</button>
                <button className="sus-btn" onClick={undo} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 12, cursor: 'pointer' }}>↶ Desfazer</button>
              </div>
            </Card>
          )}

          {mode === 'tarefas' && (
            <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>TAREFAS ({tasks.length})</div>
              <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.5 }}>Clique num ponto vazio do mapa pra adicionar; clique em cima de um pino pra remover.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {tasks.length === 0 && <div style={{ fontSize: 12, color: T.textD, padding: '8px 0' }}>Nenhuma tarefa marcada ainda.</div>}
                {tasks.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.2)' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                    <button onClick={() => setTasks(ts => ts.filter(x => x.id !== t.id))} title="Remover" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C04050', fontSize: 14, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {mode === 'emergencia' && (
            <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>BOTÃO DE EMERGÊNCIA</div>
              <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.5 }}>Clique no mapa pra posicionar (clicar de novo move pra outro lugar).</div>
              <div style={{ fontSize: 12.5, color: T.text }}>{emergency ? `Posição: x=${emergency.x}, y=${emergency.y}` : 'Ainda sem posição definida.'}</div>
              {emergency && (
                <button onClick={() => setEmergency(null)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(192,64,80,0.3)', background: 'rgba(192,64,80,0.06)', color: '#C04050', fontSize: 12, cursor: 'pointer' }}>Remover posição</button>
              )}
              <div style={{ height: 1, background: T.border, margin: '4px 0' }} />
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>IMAGEM DO BOTÃO</div>
              <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.5 }}>Anexa como o botão de emergência vai ser visualmente (referência de arte).</div>
              {emergencyIconUrl && (
                <img src={emergencyIconUrl} alt="" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 10, background: 'rgba(0,0,0,0.04)', border: `1px solid ${T.border}`, alignSelf: 'center' }} />
              )}
              <button onClick={() => emergencyIconInputRef.current?.click()} disabled={emergencyIconUploading}
                style={{ padding: '9px 10px', borderRadius: 9, border: `1.5px dashed ${T.border}`, background: 'transparent', color: T.textS, fontSize: 12.5, cursor: emergencyIconUploading ? 'not-allowed' : 'pointer' }}>
                {emergencyIconUploading ? 'Enviando...' : (emergencyIconUrl ? '🖼️ Trocar imagem' : '🖼️ Anexar imagem')}
              </button>
              <input ref={emergencyIconInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { uploadEmergencyIcon(e.target.files?.[0]); e.target.value = ''; }} />
            </Card>
          )}

          <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>ZOOM · {zoom}%</div>
            <input type="range" min="30" max="200" value={zoom} onChange={e => setZoom(+e.target.value)} />
            {coords && <div style={{ fontSize: 11, color: T.textD, fontFamily: 'monospace' }}>x: {Math.round(coords.x)} · y: {Math.round(coords.y)}</div>}
          </Card>

          {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', padding: '9px 12px', borderRadius: 9, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(34,197,94,0.25)' : 'rgba(192,64,80,0.2)'}` }}>{msg}</div>}

          <button onClick={salvar} disabled={saving || !ready}
            style={{ padding: '13px', borderRadius: 12, border: 'none', color: '#fff', fontWeight: 800, fontSize: 14, cursor: (saving || !ready) ? 'not-allowed' : 'pointer',
              background: (saving || !ready) ? T.textD : 'linear-gradient(135deg,#7C3AED,#C026D3)', boxShadow: (saving || !ready) ? 'none' : '0 8px 24px rgba(124,58,237,.4)' }}>
            {saving ? 'Salvando...' : '💾 Salvar mapa'}
          </button>
        </div>

        {/* ── Canvas ── */}
        <div style={{ flex: 1, minWidth: 320, maxWidth: '100%', overflow: 'auto', maxHeight: '78vh', borderRadius: 14, border: `1px solid ${T.border}`, background: '#0a0a10' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas ref={bgCanvasRef} style={{ width: cssW, height: cssH, display: 'block', imageRendering: 'pixelated' }} />
            <canvas ref={overlayCanvasRef}
              style={{ position: 'absolute', left: 0, top: 0, width: cssW, height: cssH, cursor: mode === 'paredes' ? 'crosshair' : 'pointer', touchAction: 'none' }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} />
            {!ready && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>Carregando mapa...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnikoSuspectMapTab;
