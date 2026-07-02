// src/modules/central-colaborador/tabs/TabMyDoko.jsx
// COLEÇÃO DE UNIKOS — substitui o antigo "My Uniko" (pet/tamagotchi). Aqui o colaborador
// vê os Unikos colecionáveis: os CAPTURADOS (no Portal) viram cards com suas vantagens
// visuais + botões "Usar como foto de perfil" e "Usar como assistente" (troca o robô do
// canto pela carinha do Uniko). Os ainda não capturados aparecem como silhueta bloqueada.
import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { Card } from '../../../shared/components';
import { USER, saveUserPhoto, getAuthUser } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection, syncCollectionFromServer, getCustomUnikos, loadCustomUnikos } from '../../../shared/captureUniko';
import {
  hasAssistantSkin, getActiveAssistantSkinId, setActiveAssistantSkin, getAssistantSkin, onAssistantSkinChange, getSkinVariations,
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

const TabMyDoko = ({ onPhotoChange }) => {
  const [captured, setCaptured] = useState(() => getCapturedCollection());
  const [activeAssistant, setActiveAssistant] = useState(getActiveAssistantSkinId);
  const [photoOk, setPhotoOk] = useState(null); // id com feedback "Salvo!"
  const [detail, setDetail] = useState(null);   // uniko aberto no modal de variações
  const [customUnikos, setCustomUnikos] = useState(() => getCustomUnikos()); // Unikos da Oficina
  const [search, setSearch] = useState(''); // busca por nome na coleção
  const [assistantScale, setAssistantScaleState] = useState(getAssistantScale); // tamanho pessoal do assistente ativo
  // Atualização funcional — clique duplo/rápido não deve usar um `assistantScale` da
  // closure já desatualizado (senão dois cliques em sequência "empatam" no mesmo valor).
  const bumpAssistantScale = (delta) => setAssistantScaleState(prev => setAssistantScale(prev + delta));

  useEffect(() => {
    const refresh = () => setCaptured(getCapturedCollection());
    window.addEventListener('uniko-collection:changed', refresh);
    // sincroniza com o servidor ao abrir a coleção (reflete reset do admin)
    syncCollectionFromServer().then(list => { if (Array.isArray(list)) setCaptured(list); });
    // Unikos da Oficina já são carregados no login (App.jsx); recarrega aqui de novo pra
    // pegar os que foram criados DEPOIS do login, sem precisar dar F5.
    loadCustomUnikos().then(list => { if (Array.isArray(list)) setCustomUnikos(list); });
    return () => window.removeEventListener('uniko-collection:changed', refresh);
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

  const owns = (u) => u.alwaysOwned || isCaptured(u.id);
  // 'uniko-comum' é o mesmo UNIKO clássico do DEFAULT_UNIKO (mesma arte) — existe só como
  // opção de recompensa "menor" pro admin escolher no evento (Dashboard RH), NÃO deve
  // aparecer aqui como um "???" bloqueado duplicado do padrão que todo mundo já tem.
  const roster = [DEFAULT_UNIKO, ...Object.values(CAPTURE_UNIKOS).filter(u => u.id !== 'uniko-comum'), ...customUnikos];
  const ownedCount = roster.filter(owns).length;
  const activeSkin = getAssistantSkin(activeAssistant);
  const q = normSearch(search);
  const visibleRoster = q ? roster.filter(u => normSearch(u.name).includes(q) || normSearch(u.shortName).includes(q)) : roster;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{`@keyframes colIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '.02em' }}>Coleção de Unikos</div>
        <div style={{ fontSize: 13, color: T.textT, marginTop: 3 }}>
          Capture Unikos no Portal e use as vantagens visuais aqui — {ownedCount}/{roster.length} desbloqueado{ownedCount === 1 ? '' : 's'}.
        </div>
      </div>

      {/* Assistente ativo */}
      <Card style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: T.surfaceSub || 'rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}` }}>
          <img src={activeSkin.blink.open} alt={activeSkin.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.textT, fontWeight: 600, letterSpacing: '.04em' }}>ASSISTENTE ATUAL</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{activeSkin.name}</div>
        </div>

        {/* Tamanho do assistente — preferência pessoal (só nesse dispositivo), qualquer usuário pode ajustar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)' }}
          title="Tamanho do assistente flutuante">
          <button onClick={() => bumpAssistantScale(-ASSISTANT_SCALE_STEP)} disabled={assistantScale <= ASSISTANT_SCALE_MIN}
            style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: T.surface, color: T.text, cursor: assistantScale <= ASSISTANT_SCALE_MIN ? 'default' : 'pointer', fontSize: 15, fontWeight: 800, lineHeight: 1, opacity: assistantScale <= ASSISTANT_SCALE_MIN ? .4 : 1 }}>−</button>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textS, width: 38, textAlign: 'center' }}>{Math.round(assistantScale * 100)}%</span>
          <button onClick={() => bumpAssistantScale(ASSISTANT_SCALE_STEP)} disabled={assistantScale >= ASSISTANT_SCALE_MAX}
            style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: T.surface, color: T.text, cursor: assistantScale >= ASSISTANT_SCALE_MAX ? 'default' : 'pointer', fontSize: 15, fontWeight: 800, lineHeight: 1, opacity: assistantScale >= ASSISTANT_SCALE_MAX ? .4 : 1 }}>+</button>
        </div>

        {activeAssistant !== 'default' && (
          <button onClick={() => setActiveAssistantSkin('default')}
            style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            Voltar ao UNIKO padrão
          </button>
        )}
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

      {/* Grade da coleção */}
      {visibleRoster.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 13, color: T.textT }}>
          Nenhum Uniko encontrado pra "{search}".
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {visibleRoster.map(u => {
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
                  <div style={{ fontSize: 12, color: T.textT, marginBottom: 10 }}>{u.tagline}</div>

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
                <div style={{ fontSize: 12, color: T.textT, marginBottom: 10 }}>{u.tagline}</div>

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

export { TabMyDoko };
