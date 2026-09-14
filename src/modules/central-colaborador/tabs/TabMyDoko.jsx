// src/modules/central-colaborador/tabs/TabMyDoko.jsx
// COLEÇÃO — duas sub-abas: Unikos (substitui o antigo "My Uniko"/pet-tamagotchi; os
// CAPTURADOS no Portal viram cards com vantagens visuais + botões "Usar como foto de
// perfil"/"Usar como assistente") e Números (Capture o Número — grid 1-100, só mostra
// quais a pessoa já capturou, sem essas ações — número não vira assistente nem foto).
import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { Card } from '../../../shared/components';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { USER, saveUserPhoto, getAuthUser, supabase } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection, syncCollectionFromServer, getCustomUnikos, loadCustomUnikos } from '../../../shared/captureUniko';
import { getCapturedNumeros, syncNumeroCollectionFromServer } from '../../../shared/captureNumero';
import {
  hasAssistantSkin, getActiveAssistantSkinId, setActiveAssistantSkin, getAssistantSkin, onAssistantSkinChange, getSkinVariations,
  getFalasAutomaticas, setFalasAutomaticas, onFalasAutomaticasChange,
  getAssistantScale, setAssistantScale, ASSISTANT_SCALE_MIN, ASSISTANT_SCALE_MAX, ASSISTANT_SCALE_STEP,
} from '../../../shared/assistantSkin';

/* Mantém a MESMA chave do antigo My Uniko — TabGames/TabInicio ainda a importam. */
export const DOKO_KEY = (() => {
  try { const auth = getAuthUser(); return auth?.cpf ? `uniko_doko_${auth.cpf}` : 'uniko_doko'; }
  catch { return 'uniko_doko'; }
})();

/* Ícones SVG (substituem os emojis na coleção). */
const Svg = ({ children, size = 14, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...p}>{children}</svg>
);
const IcoCam   = (p) => <Svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></Svg>;
const IcoBot   = (p) => <Svg {...p}><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 2h6"/><circle cx="9" cy="14" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.4" fill="currentColor" stroke="none"/></Svg>;
const IcoEye   = (p) => <Svg {...p}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></Svg>;
const IcoSpark = (p) => <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></Svg>;
const IcoCheck = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12"/></Svg>;
const IcoUndo  = (p) => <Svg {...p}><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></Svg>;
const IcoCal   = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>;

/* UNIKO padrão (assistente do sistema) — sempre na coleção, não precisa capturar. */
const DEFAULT_UNIKO = {
  id: 'default', name: 'UNIKO', img: '/UNIKO_NEW.png',
  tagline: 'Assistente padrão do sistema',
  perks: ['Assistente padrão (pisca, dá dicas e avisa)', 'Foto de perfil clássica do UNIKO'],
  canBeAssistant: true, alwaysOwned: true,
  theme: { accent: '#2196F3', accent2: '#1565C0', deep: '#0c1c2e',
    scene: 'radial-gradient(120% 90% at 50% 0%, #16314d 0%, #0c1c2e 45%, #060d16 100%)' },
};

// Compara nomes ignorando maiúscula/minúscula e acento (ex.: "sereia" acha "Sereia").
const normSearch = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

const ColecaoUnikos = ({ onPhotoChange }) => {
  const isMobile = useIsMobile();
  const [captured, setCaptured] = useState(() => getCapturedCollection());
  const [activeAssistant, setActiveAssistant] = useState(getActiveAssistantSkinId);
  const [photoOk, setPhotoOk] = useState(null); // id com feedback "Salvo!"
  const [detail, setDetail] = useState(null);   // uniko aberto no modal de variações
  const [customUnikos, setCustomUnikos] = useState(() => getCustomUnikos()); // Unikos da Oficina
  const [search, setSearch] = useState(''); // busca por nome na coleção
  const [filtro, setFiltro] = useState('todos'); // todos | obtidos | faltam
  const [ordenar, setOrdenar] = useState('nome'); // nome | recentes|antigos (obtenção) | criados_recentes|criados_antigos (criação do Uniko)
  const [assistantScale, setAssistantScaleState] = useState(getAssistantScale); // tamanho pessoal do assistente ativo
  // Falas automáticas do assistente (dicas etc.) — liga/desliga por conta; ouve a
  // troca feita em outro dispositivo (chega pelo sync da skin).
  const [falas, setFalasState] = useState(getFalasAutomaticas);
  useEffect(() => onFalasAutomaticasChange(setFalasState), []);
  // Atualização funcional — clique duplo/rápido não deve usar um `assistantScale` da
  // closure já desatualizado (senão dois cliques em sequência "empatam" no mesmo valor).
  const bumpAssistantScale = (delta) => setAssistantScaleState(prev => setAssistantScale(prev + delta));

  const [resyncing, setResyncing] = useState(false);
  // Re-sincroniza a coleção com o servidor (fonte da verdade: reflete presentes
  // do RH e reset do admin). Também recarrega os Unikos da Oficina, pra um
  // presente de Uniko CUSTOM já entrar no roster. Usada no mount, no foco da
  // aba, no realtime e no botão "Atualizar".
  const resync = React.useCallback(async () => {
    setResyncing(true);
    try {
      // Carrega os Unikos da Oficina PRIMEIRO — pra o admin (que tem tudo) e o
      // syncCollectionFromServer (getAllUnikos) já verem o roster completo.
      const customs = await loadCustomUnikos();
      if (Array.isArray(customs)) setCustomUnikos(customs);
      const list = await syncCollectionFromServer();
      if (Array.isArray(list)) setCaptured(list);
    } finally { setResyncing(false); }
  }, []);

  useEffect(() => {
    const refresh = () => setCaptured(getCapturedCollection());
    window.addEventListener('uniko-collection:changed', refresh);
    resync();
    // Sem isto, um presente enviado pelo RH só aparecia recarregando a página (a
    // sync só rodava no mount). Agora re-sincroniza quando o usuário volta pra
    // aba/janela e em tempo real quando chega uma captura/presente pra ele.
    const onVis = () => { if (document.visibilityState === 'visible') resync(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', resync);
    const me = getAuthUser()?.name;
    let ch;
    try {
      ch = supabase.channel('mydoko-captures')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'capture_uniko_captures', filter: me ? `player=eq.${me}` : undefined }, resync)
        .subscribe();
    } catch {}
    return () => {
      window.removeEventListener('uniko-collection:changed', refresh);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', resync);
      try { supabase.removeChannel(ch); } catch {}
    };
  }, []);
  useEffect(() => onAssistantSkinChange((id) => setActiveAssistant(id || 'default')), []);

  const isCaptured = (id) => captured.some(c => c.id === id);

  // Salva a imagem do Uniko como foto de perfil (canvas 300x300; fallback = URL direta).
  const setAsPhoto = (imgUrl, id) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (val) => {
      saveUserPhoto(val);
      if (onPhotoChange) onPhotoChange(val);
      try { const a = getAuthUser(); localStorage.setItem(a?.cpf ? `uniko_photo_${a.cpf}` : `uniko_photo_${USER.name}`, val); } catch {}
      setPhotoOk(id); setTimeout(() => setPhotoOk(null), 2500);
    };
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 300;
        const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, 300, 300);
        done(c.toDataURL('image/png'));
      } catch { done(imgUrl); }
    };
    img.onerror = () => done(imgUrl);
    img.src = imgUrl;
  };

  // Admin tem TODA a coleção liberada (regra do RH). isAdminUser cobre o card na
  // hora, além do syncCollectionFromServer já marcar tudo como possuído.
  const isAdminUser = getAuthUser()?.role === 'admin';
  const owns = (u) => isAdminUser || u.alwaysOwned || isCaptured(u.id);
  // 'uniko-comum' é o mesmo UNIKO clássico do DEFAULT_UNIKO (mesma arte) — existe só como
  // opção de recompensa "menor" pro admin escolher no evento (Dashboard RH), NÃO deve
  // aparecer aqui como um "???" bloqueado duplicado do padrão que todo mundo já tem.
  const roster = [DEFAULT_UNIKO, ...Object.values(CAPTURE_UNIKOS).filter(u => u.id !== 'uniko-comum'), ...customUnikos];
  const ownedCount = roster.filter(owns).length;
  const activeSkin = getAssistantSkin(activeAssistant);
  const q = normSearch(search);
  // Data de aquisição (ISO) do Uniko na coleção — só existe pra capturas de verdade.
  const atOf = (id) => captured.find(c => c.id === id)?.at || null;
  // Data de CRIAÇÃO (ISO) do Uniko em si — só os da Oficina têm (`created_at` da tabela
  // custom_unikos); os fixos do roster (Vampire-Robot, Sereia...) são hardcoded no código
  // e não têm timestamp, então ficam de fora dessa ordenação (igual um "sem data").
  const criadoAtOf = (u) => u.createdAt || null;
  const visibleRoster = roster.filter(u => {
    if (q && !(normSearch(u.name).includes(q) || normSearch(u.shortName).includes(q))) return false;
    if (filtro === 'obtidos' && !owns(u)) return false;   // só os já obtidos
    if (filtro === 'faltam' && owns(u)) return false;      // só os que faltam
    return true;
  });
  // Ordenação por data de obtenção OU de criação (ISO compara cronologicamente). Unikos
  // sem a data escolhida (padrão/fixos do roster, ou ainda não obtidos) vão pro fim.
  // 'nome' mantém a ordem original do roster.
  const isOrdCriado = ordenar === 'criados_recentes' || ordenar === 'criados_antigos';
  const orderedRoster = ordenar === 'nome' ? visibleRoster : [...visibleRoster].sort((a, b) => {
    const getAt = isOrdCriado ? criadoAtOf : (u) => atOf(u.id);
    const ta = getAt(a), tb = getAt(b);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    const maisRecentesPrimeiro = ordenar === 'recentes' || ordenar === 'criados_recentes';
    return maisRecentesPrimeiro ? tb.localeCompare(ta) : ta.localeCompare(tb);
  });

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{`@keyframes colIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '.02em' }}>Coleção de Unikos</div>
          <div style={{ fontSize: 13, color: T.textT, marginTop: 3 }}>
            Capture Unikos no Portal e use as vantagens visuais aqui — {ownedCount}/{roster.length} desbloqueado{ownedCount === 1 ? '' : 's'}.
          </div>
        </div>
        {/* Força buscar a coleção no servidor de novo (ex.: acabou de ganhar um
            presente do RH e não apareceu ainda). */}
        <button onClick={resync} disabled={resyncing} title="Atualizar coleção"
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
            border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)', color: T.text, cursor: resyncing ? 'wait' : 'pointer',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', opacity: resyncing ? 0.6 : 1 }}>
          <span style={{ display: 'inline-block', transformOrigin: 'center', animation: resyncing ? 'colRot .8s linear infinite' : 'none' }}>↻</span>
          {resyncing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      <style>{`@keyframes colRot{to{transform:rotate(360deg)}}`}</style>

      {/* Assistente ativo — no celular essa fileira (avatar+nome+controle de
          tamanho+botão) não cabia numa linha só e os botões −/+ do tamanho
          ficavam cortados/inalcançáveis; agora empilha em 2 linhas. */}
      <Card style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: isMobile ? 'none' : 1 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: T.surfaceSub || 'rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}` }}>
            <img src={activeSkin.blink.open} alt={activeSkin.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: T.textT, fontWeight: 600, letterSpacing: '.04em' }}>ASSISTENTE ATUAL</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{activeSkin.name}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
          {/* Tamanho do assistente — preferência pessoal (só nesse dispositivo), qualquer usuário pode ajustar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)' }}
            title="Tamanho do assistente flutuante">
            <button onClick={() => bumpAssistantScale(-ASSISTANT_SCALE_STEP)} disabled={assistantScale <= ASSISTANT_SCALE_MIN}
              style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: T.surface, color: T.text, cursor: assistantScale <= ASSISTANT_SCALE_MIN ? 'default' : 'pointer', fontSize: 15, fontWeight: 800, lineHeight: 1, opacity: assistantScale <= ASSISTANT_SCALE_MIN ? .4 : 1 }}>−</button>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textS, width: 38, textAlign: 'center' }}>{Math.round(assistantScale * 100)}%</span>
            <button onClick={() => bumpAssistantScale(ASSISTANT_SCALE_STEP)} disabled={assistantScale >= ASSISTANT_SCALE_MAX}
              style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: T.surface, color: T.text, cursor: assistantScale >= ASSISTANT_SCALE_MAX ? 'default' : 'pointer', fontSize: 15, fontWeight: 800, lineHeight: 1, opacity: assistantScale >= ASSISTANT_SCALE_MAX ? .4 : 1 }}>+</button>
          </div>

          {/* Falas automáticas: interruptor estilo iOS. Desligado, o Uniko para de
              dar dicas e comentários sozinho — avisos do RH, lembretes pedidos,
              Capture o Uniko e prismas recebidos continuam chegando. */}
          <button onClick={() => { setFalasAutomaticas(!falas); setFalasState(!falas); }}
            role="switch" aria-checked={falas}
            title={falas ? 'Desligar dicas e falas automáticas do Uniko' : 'Ligar dicas e falas automáticas do Uniko'}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 6px 12px', borderRadius: 10,
              border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', textAlign: 'left' }}>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Falas automáticas</span>
              <span style={{ fontSize: 10.5, color: T.textT }}>{falas ? 'Dicas e comentários ligados' : 'Só avisos importantes'}</span>
            </span>
            <span aria-hidden="true" style={{ position: 'relative', width: 38, height: 22, borderRadius: 11, flexShrink: 0,
              background: falas ? '#34C759' : 'rgba(120,120,128,.36)', transition: 'background .2s' }}>
              <span style={{ position: 'absolute', top: 2, left: falas ? 18 : 2, width: 18, height: 18, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s cubic-bezier(.16,1,.3,1)' }}/>
            </span>
          </button>

          {activeAssistant !== 'default' && (
            <button onClick={() => setActiveAssistantSkin('default')}
              style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              Voltar ao UNIKO padrão
            </button>
          )}
        </div>
      </Card>

      {/* Busca por nome */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar Uniko pelo nome..."
          style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)', fontSize: 13, color: T.text, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}/>
        {search && (
          <button onClick={() => setSearch('')} title="Limpar busca"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: T.textT, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
        )}
      </div>

      {/* Filtro: todos / obtidos / faltam */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['todos', 'Todos', roster.length], ['obtidos', '✓ Obtidos', ownedCount], ['faltam', 'Faltam', roster.length - ownedCount]].map(([id, label, n]) => {
          const sel = filtro === id;
          return (
            <button key={id} onClick={() => setFiltro(id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                border: `1.5px solid ${sel ? T.text : T.border}`,
                background: sel ? T.text : (T.surfaceSub || 'rgba(0,0,0,.04)'),
                color: sel ? T.surface : T.textS }}>
              {label}
              <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
                background: sel ? 'rgba(255,255,255,.2)' : T.border, color: sel ? T.surface : T.textT }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Ordenar por data de obtenção */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.textT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IcoCal size={13}/>Ordenar:
        </span>
        {[
          ['nome', 'Nome (A–Z)'],
          ['recentes', '↓ Obtidos: mais recentes'], ['antigos', '↑ Obtidos: mais antigos'],
          ['criados_recentes', '↓ Criados: mais recentes'], ['criados_antigos', '↑ Criados: mais antigos'],
        ].map(([id, label]) => {
          const sel = ordenar === id;
          return (
            <button key={id} onClick={() => setOrdenar(id)}
              style={{ padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
                border: `1.5px solid ${sel ? T.text : T.border}`,
                background: sel ? T.text : (T.surfaceSub || 'rgba(0,0,0,.04)'),
                color: sel ? T.surface : T.textS }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Grade da coleção */}
      {visibleRoster.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 13, color: T.textT }}>
          {search ? `Nenhum Uniko encontrado pra "${search}".`
            : filtro === 'obtidos' ? 'Você ainda não obteve nenhum Uniko — capture no Portal! 🎯'
            : filtro === 'faltam' ? '🎉 Parabéns! Você já obteve todos os Unikos.'
            : 'Nenhum Uniko na coleção.'}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {orderedRoster.map(u => {
          const owned = owns(u);
          const th = u.theme;
          const canAssist = u.canBeAssistant && hasAssistantSkin(u.id);
          const isActive = activeAssistant === u.id;
          const okPhoto = photoOk === u.id;

          if (!owned) {
            // ── Bloqueado — mostra a arte e as informações normalmente (não é mais um
            // "???" misterioso), só o NOME vira um aviso de bloqueio. ──
            return (
              <Card key={u.id} style={{ padding: 0, overflow: 'hidden', opacity: .85 }}>
                <div style={{ position: 'relative', height: 168, background: th.scene || 'radial-gradient(120% 90% at 50% 0%, #20242c, #0d0f13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={u.img} alt={u.name} style={{ width: 128, height: 128, objectFit: 'contain', filter: `grayscale(.55) drop-shadow(0 0 14px ${th.accent || '#888'}55)` }}/>
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,.25)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.textT, fontFamily: 'var(--font-brand)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Você ainda não tem
                  </div>
                  <div style={{ fontSize: 12, color: T.textT, marginBottom: criadoAtOf(u) ? 6 : 10 }}>{u.tagline}</div>

                  {criadoAtOf(u) && (
                    <div style={{ fontSize: 11.5, color: T.textT, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: T.surfaceSub || 'rgba(0,0,0,.04)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '3px 9px' }}>
                      <IcoCal size={12}/>Criado em {new Date(criadoAtOf(u)).toLocaleDateString('pt-BR')}
                    </div>
                  )}

                  {(u.perks || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                      {u.perks.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: T.textT, lineHeight: 1.4 }}>
                          <span style={{ color: T.textT, marginTop: 1, opacity: .7 }}><IcoSpark size={13}/></span>{p}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 11.5, color: T.textT, fontStyle: 'italic' }}>Capture no Portal para desbloquear</div>
                </div>
              </Card>
            );
          }

          // ── Capturado (card completo) ──
          return (
            <Card key={u.id} style={{ padding: 0, overflow: 'hidden', animation: 'colIn .35s ease', border: `1px solid ${th.accent}55` }}>
              <div onClick={() => setDetail(u)} title="Ver variações"
                style={{ position: 'relative', height: 180, background: th.scene || 'radial-gradient(120% 90% at 50% 0%, #2a0810, #0b0204)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <img src={u.img} alt={u.name} style={{ width: 140, height: 140, objectFit: 'contain', filter: `drop-shadow(0 0 20px ${th.accent})` }}/>
                {isActive && (
                  <div style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 999, background: th.accent, color: '#fff', fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4 }}><IcoCheck size={11}/>ASSISTENTE</div>
                )}
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10.5, color: '#fff', opacity: .85, fontWeight: 600 }}><IcoEye size={13}/>Ver variações</div>
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: 'var(--font-brand)' }}>{u.shortName || u.name}</div>
                <div style={{ fontSize: 12, color: T.textT, marginBottom: (atOf(u.id) && !isAdminUser) || criadoAtOf(u) ? 6 : 10 }}>{u.tagline}</div>

                {/* data de obtenção (só pra capturas de verdade — admin tem tudo liberado) e/ou
                    data de criação do Uniko (só os da Oficina têm) */}
                {((atOf(u.id) && !isAdminUser) || criadoAtOf(u)) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {atOf(u.id) && !isAdminUser && (
                      <div style={{ fontSize: 11.5, color: T.textT, display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: T.surfaceSub || 'rgba(0,0,0,.04)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '3px 9px' }}>
                        <IcoCal size={12}/>Obtido em {new Date(atOf(u.id)).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    {criadoAtOf(u) && (
                      <div style={{ fontSize: 11.5, color: T.textT, display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: T.surfaceSub || 'rgba(0,0,0,.04)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '3px 9px' }}>
                        <IcoCal size={12}/>Criado em {new Date(criadoAtOf(u)).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}

                {/* vantagens visuais */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                  {(u.perks || []).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: T.textS, lineHeight: 1.4 }}>
                      <span style={{ color: th.accent, marginTop: 1 }}><IcoSpark size={13}/></span>{p}
                    </div>
                  ))}
                </div>

                {/* ações */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setAsPhoto(u.img, u.id)}
                    style={{ flex: 1, minWidth: 120, padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: okPhoto ? 'rgba(40,200,112,.15)' : (T.surfaceSub || 'rgba(0,0,0,.04)'), color: okPhoto ? (T.success || '#28a060') : T.text, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {okPhoto ? <><IcoCheck/>Foto salva!</> : <><IcoCam/>Usar como foto</>}
                  </button>
                  {canAssist && (
                    <button onClick={() => { if (!(isActive && u.id === 'default')) setActiveAssistantSkin(isActive ? 'default' : u.id); }}
                      style={{ flex: 1, minWidth: 120, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: (isActive && u.id === 'default') ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: isActive ? (T.surfaceSub || 'rgba(0,0,0,.06)') : `linear-gradient(135deg,${th.accent2},${th.accent})`,
                        color: isActive ? T.textS : '#fff' }}>
                      {isActive ? (u.id === 'default' ? <><IcoCheck/>Assistente ativo</> : <><IcoUndo/>Remover assistente</>) : <><IcoBot/>Usar como assistente</>}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Modal de VARIAÇÕES (carinhas/sprites do Uniko) ── */}
      {detail && (() => {
        const vars = getSkinVariations(detail.id);
        const th = detail.theme || {};
        return (
          <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(6,8,14,.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, width: 'min(560px,94vw)', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.5)' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, background: `linear-gradient(135deg,${th.accent}22,transparent)` }}>
                <img src={detail.img} alt={detail.name} style={{ width: 42, height: 42, objectFit: 'contain' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: 'var(--font-brand)' }}>{detail.shortName || detail.name}</div>
                  <div style={{ fontSize: 11.5, color: T.textT }}>Variações da carinha</div>
                </div>
                <button onClick={() => setDetail(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 22, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: 18, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 12 }}>
                {vars.map((v, i) => (
                  <div key={i} style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.border}`, background: th.scene || (T.surfaceSub || 'rgba(0,0,0,.04)') }}>
                    <div style={{ height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={v.img} alt={v.label} style={{ width: 72, height: 72, objectFit: 'contain', filter: th.accent ? `drop-shadow(0 0 8px ${th.accent}aa)` : 'none' }}/>
                    </div>
                    <div style={{ padding: '7px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: T.text, background: T.surface }}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

/* ── COLEÇÃO DE NÚMEROS (Capture o Número) — grid 1 a 100, só mostra quais a pessoa
   já capturou. Sem "usar como assistente"/"usar como foto": número não vira nenhum
   dos dois, é só coleção (o sorteio/prêmio de verdade fica pra depois). ── */
const ColecaoNumeros = () => {
  const isMobile = useIsMobile();
  const [captured, setCaptured] = useState(() => getCapturedNumeros());
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | obtidos | faltam
  const [resyncing, setResyncing] = useState(false);
  const [detail, setDetail] = useState(null); // número aberto no modal (mostra a data de captura)

  const resync = React.useCallback(async () => {
    setResyncing(true);
    try {
      const list = await syncNumeroCollectionFromServer();
      if (Array.isArray(list)) setCaptured(list);
    } finally { setResyncing(false); }
  }, []);

  useEffect(() => {
    const refresh = () => setCaptured(getCapturedNumeros());
    window.addEventListener('numero-collection:changed', refresh);
    resync();
    const onVis = () => { if (document.visibilityState === 'visible') resync(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', resync);
    const me = getAuthUser()?.name;
    let ch;
    try {
      ch = supabase.channel('mynumeros-captures')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'capture_numero_captures', filter: me ? `player=eq.${me}` : undefined }, resync)
        .subscribe();
    } catch {}
    return () => {
      window.removeEventListener('numero-collection:changed', refresh);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', resync);
      try { supabase.removeChannel(ch); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownedSet = new Set(captured.map(c => c.value));
  const owns = (n) => ownedSet.has(n);
  const atOf = (n) => captured.find(c => c.value === n)?.at || null;
  const ownedCount = ownedSet.size;
  const all = Array.from({ length: 100 }, (_, i) => i + 1);
  const q = search.trim();
  const visible = all.filter(n => {
    if (q && !String(n).includes(q)) return false;
    if (filtro === 'obtidos' && !owns(n)) return false;
    if (filtro === 'faltam' && owns(n)) return false;
    return true;
  });

  return (
    <div>
      <style>{`@keyframes numIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}@keyframes colRot{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '.02em' }}>Coleção de Números</div>
          <div style={{ fontSize: 13, color: T.textT, marginTop: 3 }}>
            Capture números da sorte no Portal — {ownedCount}/100 desbloqueado{ownedCount === 1 ? '' : 's'}.
          </div>
        </div>
        <button onClick={resync} disabled={resyncing} title="Atualizar coleção"
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
            border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)', color: T.text, cursor: resyncing ? 'wait' : 'pointer',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', opacity: resyncing ? 0.6 : 1 }}>
          <span style={{ display: 'inline-block', transformOrigin: 'center', animation: resyncing ? 'colRot .8s linear infinite' : 'none' }}>↻</span>
          {resyncing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {/* Busca por número */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="Buscar número..." inputMode="numeric"
          style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)', fontSize: 13, color: T.text, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}/>
        {search && (
          <button onClick={() => setSearch('')} title="Limpar busca"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: T.textT, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
        )}
      </div>

      {/* Filtro: todos / obtidos / faltam */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['todos', 'Todos', 100], ['obtidos', '✓ Obtidos', ownedCount], ['faltam', 'Faltam', 100 - ownedCount]].map(([id, label, n]) => {
          const sel = filtro === id;
          return (
            <button key={id} onClick={() => setFiltro(id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                border: `1.5px solid ${sel ? T.text : T.border}`,
                background: sel ? T.text : (T.surfaceSub || 'rgba(0,0,0,.04)'),
                color: sel ? T.surface : T.textS }}>
              {label}
              <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
                background: sel ? 'rgba(255,255,255,.2)' : T.border, color: sel ? T.surface : T.textT }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Grade 1-100 */}
      {visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 13, color: T.textT }}>
          {search ? `Nenhum número encontrado pra "${search}".`
            : filtro === 'obtidos' ? 'Você ainda não capturou nenhum número — fica de olho no Portal! 🎯'
            : '🎉 Parabéns! Você já capturou todos os números.'}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? 56 : 68}px,1fr))`, gap: 10 }}>
        {visible.map(n => {
          const owned = owns(n);
          return (
            <button key={n} onClick={() => owned && setDetail(n)} disabled={!owned}
              style={{ aspectRatio: '1', borderRadius: 14, border: `1.5px solid ${owned ? '#ffb02066' : T.border}`,
                background: owned ? 'linear-gradient(160deg,#ffd873,#ffb020 55%,#c97a00)' : (T.surfaceSub || 'rgba(0,0,0,.04)'),
                color: owned ? '#3a2400' : T.textD, fontSize: isMobile ? 15 : 17, fontWeight: 900, fontFamily: 'var(--font-brand)',
                cursor: owned ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: owned ? '0 4px 14px rgba(255,176,32,.35)' : 'none', animation: owned ? 'numIn .3s ease' : 'none', padding: 0 }}>
              {owned ? n : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".5">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal de detalhe — data de captura */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(6,8,14,.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, width: 'min(320px,94vw)', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,.5)', textAlign: 'center', padding: '28px 24px' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', margin: '0 auto 14px', background: 'linear-gradient(160deg,#ffd873,#ffb020 55%,#c97a00)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, color: '#3a2400', fontFamily: 'var(--font-brand)', boxShadow: '0 4px 20px rgba(255,176,32,.4)' }}>{detail}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontFamily: 'var(--font-brand)', marginBottom: 4 }}>Número {detail}</div>
            {atOf(detail) && <div style={{ fontSize: 12.5, color: T.textT }}>Capturado em {new Date(atOf(detail)).toLocaleDateString('pt-BR')}</div>}
            <button onClick={() => setDetail(null)} style={{ marginTop: 18, padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${T.gold},${T.gold}cc)`, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Aba "Coleção" — duas sub-abas clicáveis (mesmo padrão de pills usado no
   Dashboard RH → Capture o Uniko: evento/oficina/enviar). ── */
const TabMyDoko = ({ onPhotoChange }) => {
  const [sub, setSub] = useState('unikos'); // unikos | numeros

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['unikos', 'Coleção de Unikos'], ['numeros', 'Coleção de Números']].map(([id, label]) => {
          const sel = sub === id;
          return (
            <button key={id} onClick={() => setSub(id)}
              style={{ padding: '10px 18px', borderRadius: 12, cursor: 'pointer', fontSize: 13.5, fontWeight: 800,
                fontFamily: 'var(--font-brand)', letterSpacing: '.01em',
                border: `1.5px solid ${sel ? T.gold : T.border}`,
                background: sel ? T.goldGl : (T.surfaceSub || 'rgba(0,0,0,.04)'),
                color: sel ? T.gold : T.textS }}>
              {label}
            </button>
          );
        })}
      </div>
      {sub === 'unikos' ? <ColecaoUnikos onPhotoChange={onPhotoChange} /> : <ColecaoNumeros />}
    </div>
  );
};

export { TabMyDoko };
