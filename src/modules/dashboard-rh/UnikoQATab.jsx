// Dashboard RH → aba "Perguntas do UNIKO".
// Mostra o que o assistente aprendeu (tabela uniko_qa_cache): perguntas que caíram na IA (Groq)
// + a resposta, ordenadas pelas mais perguntadas. Dá pra EDITAR a resposta, marcar como "no FAQ",
// APAGAR, e ADICIONAR manualmente uma pergunta+resposta (que o UNIKO passa a responder na hora,
// sem gastar requisição de IA).
import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase } from '../../contexts/user';
import { Card, Moon } from '../../shared/components';

// MESMA normalização do servidor (crescent-hub-server) — a qkey precisa bater pro cache acertar.
const qkeyOf = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`,
  background: T.surface, fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)',
};

const UnikoQATab = ({ cardBg }) => {
  const bg = cardBg || T.surface;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(null);     // { qkey, answer }
  const [search, setSearch] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2800); };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await _supabase.from('uniko_qa_cache').select('*')
        .order('hits', { ascending: false }).order('last_asked', { ascending: false }).limit(500);
      setRows(data || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addManual = async () => {
    const question = q.trim(), answer = a.trim();
    if (!question || !answer) { flash('Preencha a pergunta e a resposta'); return; }
    const qkey = qkeyOf(question);
    if (!qkey) { flash('Pergunta inválida'); return; }
    setSaving(true);
    try {
      await _supabase.from('uniko_qa_cache').upsert(
        { qkey, question, answer, in_faq: true, last_asked: new Date().toISOString() },
        { onConflict: 'qkey' });
      setQ(''); setA(''); flash('✅ Adicionada! O UNIKO já responde isso sem gastar IA.');
      load();
    } catch { flash('Erro ao salvar'); }
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!edit || !edit.answer.trim()) return;
    try { await _supabase.from('uniko_qa_cache').update({ answer: edit.answer.trim() }).eq('qkey', edit.qkey); setEdit(null); load(); }
    catch { flash('Erro ao salvar'); }
  };

  const toggleFaq = async (row) => {
    try { await _supabase.from('uniko_qa_cache').update({ in_faq: !row.in_faq }).eq('qkey', row.qkey); load(); } catch {}
  };

  const remove = async (row) => {
    if (!window.confirm('Apagar essa pergunta aprendida? O UNIKO vai precisar perguntar à IA de novo se ela voltar.')) return;
    try { await _supabase.from('uniko_qa_cache').delete().eq('qkey', row.qkey); load(); } catch {}
  };

  const filtered = rows.filter(r => {
    const s = search.trim().toLowerCase();
    return !s || (`${r.question} ${r.answer}`).toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Cabeçalho */}
      <div style={{ padding: '14px 20px', borderRadius: 13, background: bg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${T.border}`, boxShadow: T.shM, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: '.04em' }}>Perguntas do UNIKO</div>
          <div style={{ fontSize: 13, color: T.textS, marginTop: 2 }}>O que o assistente aprendeu com a IA. Quanto mais vira FAQ, menos requisições ele gasta.</div>
        </div>
        <Moon size={24} color={T.goldL} opacity={0.35} float />
      </div>

      {/* Adicionar manualmente */}
      <Card style={{ padding: '22px 26px', background: bg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }} elevated>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>Adicionar pergunta e resposta</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Pergunta (como a pessoa perguntaria)</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex: como faço para tirar férias?" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Resposta do UNIKO</div>
          <textarea value={a} onChange={e => setA(e.target.value)} rows={3} placeholder="O que o UNIKO deve responder..." style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        {msg && <div style={{ fontSize: 12, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', marginBottom: 10, padding: '7px 12px', borderRadius: 7, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{msg}</div>}
        <button onClick={addManual} disabled={saving || !q.trim() || !a.trim()}
          style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)', opacity: (q.trim() && a.trim()) ? 1 : 0.5 }}>
          {saving ? 'Salvando...' : 'Adicionar ao UNIKO'}
        </button>
      </Card>

      {/* Lista de aprendidas */}
      <Card style={{ padding: 0, overflow: 'hidden', background: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} elevated>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>Aprendidas ({rows.length})</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, padding: '6px 10px', flex: 1, maxWidth: 280 }} />
          <button onClick={load} title="Recarregar" style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T.textS, fontFamily: 'var(--font-body)', outline: 'none' }}>↻</button>
        </div>
        {loading
          ? <div style={{ padding: 32, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando...</div>
          : filtered.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: T.textT, fontSize: 13 }}>{rows.length === 0 ? 'Nada aprendido ainda — quando alguém perguntar algo fora da FAQ, aparece aqui.' : 'Nenhuma corresponde à busca.'}</div>
            : filtered.map(r => (
              <div key={r.qkey} style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: T.gold, background: T.goldGl, padding: '1px 8px', borderRadius: 10 }}>{r.hits}× perguntada</span>
                      {r.in_faq && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16a34a', background: 'rgba(34,197,94,0.1)', padding: '1px 8px', borderRadius: 10 }}>no FAQ</span>}
                      <span style={{ fontSize: 11, color: T.textT }}>{r.last_asked ? new Date(r.last_asked).toLocaleDateString('pt-BR') : ''}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{r.question}</div>
                    {edit && edit.qkey === r.qkey
                      ? <textarea value={edit.answer} onChange={e => setEdit({ ...edit, answer: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical', marginTop: 6 }} />
                      : <div style={{ fontSize: 13, color: T.textS, marginTop: 3, lineHeight: 1.5 }}>{r.answer}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {edit && edit.qkey === r.qkey
                      ? <>
                          <button onClick={saveEdit} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: T.gold, color: 'white', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>Salvar</button>
                          <button onClick={() => setEdit(null)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-body)' }}>Cancelar</button>
                        </>
                      : <>
                          <button onClick={() => setEdit({ qkey: r.qkey, answer: r.answer })} title="Editar resposta" style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-body)' }}>Editar</button>
                          <button onClick={() => toggleFaq(r)} title="Marcar/desmarcar como já no FAQ" style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${r.in_faq ? 'rgba(34,197,94,0.4)' : T.border}`, background: r.in_faq ? 'rgba(34,197,94,0.07)' : 'transparent', color: r.in_faq ? '#16a34a' : T.textS, cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-body)' }}>{r.in_faq ? '✓ FAQ' : 'FAQ'}</button>
                          <button onClick={() => remove(r)} title="Apagar" style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(192,64,80,0.25)', background: 'rgba(192,64,80,0.05)', color: '#C04050', cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-body)' }}>Apagar</button>
                        </>}
                  </div>
                </div>
              </div>
            ))
        }
      </Card>
    </div>
  );
};

export default UnikoQATab;
