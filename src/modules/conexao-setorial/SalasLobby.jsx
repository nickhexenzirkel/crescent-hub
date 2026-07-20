// src/modules/conexao-setorial/SalasLobby.jsx
// Lobby das salas da Conexão Setorial: lista as salas, pede a senha pra entrar e
// (pro admin) permite criar sala, trocar a senha e excluir.
//
// A senha é comparada por hash SHA-256 no cliente — ver o aviso de segurança em
// supabase_conexao_setorial_salas.sql. Ela organiza o acesso entre colegas, não
// é um cofre.
import React, { useState } from 'react';
import { T } from '../../contexts/theme';

const GRAD = 'linear-gradient(135deg,#E0559A 0%,#A24CE0 100%)';
const CORES = ['#A24CE0', '#E0559A', '#5B8DEF', '#22B8A6', '#E67E22', '#E0345A'];

const Ico = ({ d, size = 16, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>{d}</svg>
);
const IcoLock = <><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>;
const IcoOpen = <><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.5-2" /></>;
const IcoPlus = <><path d="M12 5v14" /><path d="M5 12h14" /></>;
const IcoBack = <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>;
const IcoKey = <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3" /><path d="M16 7l3 3" /></>;
const IcoTrash = <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>;

export default function SalasLobby({
  rooms, loading, isAdmin, brd, onBack, jaAberta,
  onEntrar, onCriar, onSenha, onExcluir,
}) {
  const [senhaDe, setSenhaDe] = useState(null);   // sala com o prompt de senha aberto
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ name: '', descricao: '', senha: '', color: CORES[0] });
  const [salvando, setSalvando] = useState(false);

  const cardBg = T.surface || '#fff';

  const tentarEntrar = async (sala) => {
    // sala aberta, ou já destravada nesta sessão → entra direto
    if (!sala.pass_hash || jaAberta?.(sala.id)) { onEntrar(sala, '', true); return; }
    setSenhaDe(sala); setSenha(''); setErro('');
  };

  const confirmarSenha = async () => {
    setEntrando(true); setErro('');
    const ok = await onEntrar(senhaDe, senha);
    setEntrando(false);
    if (!ok) { setErro('Senha incorreta.'); setSenha(''); }
  };

  const salvarSala = async () => {
    if (!form.name.trim()) return;
    setSalvando(true);
    await onCriar(form);
    setSalvando(false);
    setCriando(false);
    setForm({ name: '', descricao: '', senha: '', color: CORES[0] });
  };

  const trocarSenha = async (sala) => {
    const nova = window.prompt(
      `Nova senha da sala "${sala.name}".\n\nDeixe em branco para remover a senha (sala aberta a todos).`, '');
    if (nova === null) return;                    // cancelou
    await onSenha(sala.id, nova.trim());
  };

  const inSt = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${brd}`,
    background: T.page, color: T.text, fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'var(--font-body)',
  };

  return (
    <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '26px 22px 40px' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={onBack} className="cs-btn cs-ghost"
            style={{ background: 'transparent', color: T.text, width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center' }}>
            <Ico d={IcoBack} size={20} />
          </button>
          <div>
            <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 24, background: GRAD,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Salas</div>
            <div style={{ fontSize: 13, color: T.textT }}>
              Escolha uma sala para ver as anotações e os cards dela.
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => setCriando(true)} className="cs-btn"
              style={{ marginLeft: 'auto', background: GRAD, color: '#fff', borderRadius: 12, padding: '10px 18px',
                fontWeight: 700, fontSize: 13.5, display: 'flex', gap: 7, alignItems: 'center' }}>
              <Ico d={IcoPlus} size={16} /> Nova sala
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: T.textT, fontWeight: 600 }}>Carregando salas…</div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: T.textT }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhuma sala ainda.</div>
            <div style={{ fontSize: 13 }}>
              {isAdmin ? 'Crie a primeira em “Nova sala”.' : 'Peça para um administrador criar a primeira.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 16, marginTop: 22 }}>
            {rooms.map(sala => (
              <div key={sala.id} className="cs-card"
                onClick={() => tentarEntrar(sala)}
                style={{ background: cardBg, border: `1px solid ${brd}`, borderRadius: 16, padding: 18,
                  cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                {/* faixa de cor da sala */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: sala.color || '#A24CE0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 6 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: sala.color || '#A24CE0',
                    display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
                    <Ico d={sala.pass_hash ? IcoLock : IcoOpen} size={19} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15.5, color: T.text, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sala.name}</div>
                    <div style={{ fontSize: 11.5, color: T.textT, fontWeight: 600 }}>
                      {sala.pass_hash ? 'Protegida por senha' : 'Aberta'}
                    </div>
                  </div>
                </div>

                {sala.descricao && (
                  <div style={{ fontSize: 12.5, color: T.textT, marginTop: 10, lineHeight: 1.5 }}>{sala.descricao}</div>
                )}

                {isAdmin && (
                  <div style={{ display: 'flex', gap: 7, marginTop: 14 }} onClick={e => e.stopPropagation()}>
                    <button className="cs-btn" onClick={() => trocarSenha(sala)} title="Definir ou remover a senha"
                      style={{ background: T.surfaceSub || 'rgba(120,60,180,.08)', color: T.text, borderRadius: 9,
                        padding: '6px 11px', fontSize: 11.5, fontWeight: 700, display: 'flex', gap: 5, alignItems: 'center' }}>
                      <Ico d={IcoKey} size={13} /> Senha
                    </button>
                    <button className="cs-btn" onClick={() => onExcluir(sala.id)} title="Excluir a sala"
                      style={{ background: 'rgba(224,52,90,.09)', color: '#E0345A', borderRadius: 9,
                        padding: '6px 11px', fontSize: 11.5, fontWeight: 700, display: 'flex', gap: 5, alignItems: 'center' }}>
                      <Ico d={IcoTrash} size={13} /> Excluir
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Prompt de senha ── */}
      {senhaDe && (
        <div onClick={() => !entrando && setSenhaDe(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: cardBg, borderRadius: 18, padding: 26, width: 'min(380px, 92vw)',
              border: `1px solid ${brd}`, boxShadow: '0 24px 60px rgba(0,0,0,.3)', animation: 'csPop .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: senhaDe.color || '#A24CE0',
                display: 'grid', placeItems: 'center', color: '#fff' }}><Ico d={IcoLock} size={18} /></div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: T.text }}>{senhaDe.name}</div>
                <div style={{ fontSize: 12, color: T.textT }}>Digite a senha para entrar</div>
              </div>
            </div>
            <input type="password" value={senha} autoFocus
              onChange={e => { setSenha(e.target.value); setErro(''); }}
              onKeyDown={e => e.key === 'Enter' && !entrando && confirmarSenha()}
              placeholder="Senha da sala" style={{ ...inSt, marginTop: 16 }} />
            {erro && <div style={{ fontSize: 12.5, color: '#E0345A', marginTop: 8, fontWeight: 600 }}>{erro}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="cs-btn" onClick={() => setSenhaDe(null)}
                style={{ flex: 1, background: T.surfaceSub || 'rgba(120,60,180,.08)', color: T.text,
                  borderRadius: 11, padding: '11px', fontWeight: 700, fontSize: 13 }}>Cancelar</button>
              <button className="cs-btn" onClick={confirmarSenha} disabled={entrando}
                style={{ flex: 1, background: GRAD, color: '#fff', borderRadius: 11, padding: '11px',
                  fontWeight: 800, fontSize: 13 }}>{entrando ? 'Entrando…' : 'Entrar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Criar sala (admin) ── */}
      {criando && (
        <div onClick={() => !salvando && setCriando(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: cardBg, borderRadius: 18, padding: 26, width: 'min(430px, 92vw)',
              border: `1px solid ${brd}`, boxShadow: '0 24px 60px rgba(0,0,0,.3)', animation: 'csPop .2s ease' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 16 }}>
              Nova sala
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textT, marginBottom: 5 }}>NOME *</div>
            <input value={form.name} autoFocus onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Fechamento, Diretoria, Projetos…" style={inSt} />

            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textT, margin: '13px 0 5px' }}>DESCRIÇÃO</div>
            <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Do que essa sala trata" style={inSt} />

            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textT, margin: '13px 0 5px' }}>SENHA</div>
            <input type="text" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
              placeholder="Deixe em branco para sala aberta" style={inSt} />
            <div style={{ fontSize: 11, color: T.textT, marginTop: 6, lineHeight: 1.5 }}>
              Guardamos só o hash da senha — depois de criar, ela não pode ser consultada, só redefinida.
              A senha organiza o acesso entre colegas; não use a sala para segredo de verdade.
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textT, margin: '13px 0 7px' }}>COR</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {CORES.map(c => (
                <div key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  style={{ width: 30, height: 30, borderRadius: 9, background: c, cursor: 'pointer',
                    outline: form.color === c ? `2px solid ${T.text}` : 'none', outlineOffset: 2 }} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="cs-btn" onClick={() => setCriando(false)}
                style={{ flex: 1, background: T.surfaceSub || 'rgba(120,60,180,.08)', color: T.text,
                  borderRadius: 11, padding: '11px', fontWeight: 700, fontSize: 13 }}>Cancelar</button>
              <button className="cs-btn" onClick={salvarSala} disabled={salvando || !form.name.trim()}
                style={{ flex: 1, background: GRAD, color: '#fff', borderRadius: 11, padding: '11px',
                  fontWeight: 800, fontSize: 13, opacity: form.name.trim() ? 1 : .5 }}>
                {salvando ? 'Criando…' : 'Criar sala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
