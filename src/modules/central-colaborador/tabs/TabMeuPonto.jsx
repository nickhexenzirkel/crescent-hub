// src/modules/central-colaborador/tabs/TabMeuPonto.jsx
// "Ponto Eletrônico" (visão do COLABORADOR):
//  • saldo do banco (positivas/negativas) por mês — ponto_presenca
//  • PONTOS BATIDOS por dia — ponto_marcacoes (mostra os dias negativos)
//  • SOLICITAR JUSTIFICATIVA — título + descrição + ANEXO; o RH recebe na Dashboard
//    (ponto_solicitacoes + bucket ponto-anexos)
//  • justificativas já abonadas pelo RH — ponto_justificativas
import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser, supabase as _supabase } from '../../../contexts/user';
import { Card, StarDivider } from '../../../shared/components';

const onlyDigits = s => (s || '').replace(/\D/g, '');
const fmtMin = m => { const a = Math.abs(Math.round(m)), h = Math.floor(a / 60), mm = a % 60; return `${m < 0 ? '-' : ''}${h}h${mm.toString().padStart(2, '0')}`; };
const fmtData = iso => { if (!iso) return '—'; try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return iso; } };
const diaSemana = iso => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }); } catch { return ''; } };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = ym => { if (!ym) return ym; const [y, m] = ym.split('-'); return `${MESES[(+m) - 1] || m}/${y}`; };

const Ico = ({ d, size = 14, stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const STATUS_S = {
  pendente:  { bg: 'rgba(216,144,48,0.14)', color: '#D89030', label: 'Pendente' },
  resolvido: { bg: 'rgba(26,156,112,0.12)', color: '#1A9C70', label: 'Resolvido' },
};

const TabMeuPonto = () => {
  const cpf = onlyDigits(getAuthUser()?.cpf || USER.cpf);
  const [presenca, setPresenca]   = useState([]);
  const [marcacoes, setMarcacoes] = useState([]);
  const [negDays, setNegDays]     = useState([]);
  const [justifs, setJustifs]     = useState([]);
  const [solics, setSolics]       = useState([]);
  const [loading, setLoading]     = useState(true);

  // modal de solicitação
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ titulo: '', descricao: '', data_ref: '' });
  const [file, setFile]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');
  const fileRef = useRef(null);

  const loadSolics = async () => {
    const { data } = await _supabase.from('ponto_solicitacoes').select('*').eq('cpf', cpf).order('created_at', { ascending: false });
    setSolics(data || []);
  };

  useEffect(() => {
    if (!cpf) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [pres, mar, neg, just, sol] = await Promise.all([
          _supabase.from('ponto_presenca').select('month,saldo,issues').eq('cpf', cpf).order('month', { ascending: false }),
          _supabase.from('ponto_marcacoes').select('data,hora').eq('cpf', cpf).order('data', { ascending: false }).limit(1000),
          _supabase.from('ponto_negativos').select('data,saldo').eq('cpf', cpf),
          _supabase.from('ponto_justificativas').select('data,texto,abonado,autor').eq('cpf', cpf).order('data', { ascending: false }),
          _supabase.from('ponto_solicitacoes').select('*').eq('cpf', cpf).order('created_at', { ascending: false }),
        ]);
        if (!alive) return;
        setPresenca(pres.data || []);
        setMarcacoes(mar.data || []);
        setNegDays(neg.data || []);
        setJustifs(just.data || []);
        setSolics(sol.data || []);
      } catch {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [cpf]);

  const totalSaldo = presenca.reduce((a, r) => a + Number(r.saldo || 0), 0);
  const positivas  = presenca.reduce((a, r) => (Number(r.saldo) > 0 ? a + Number(r.saldo) : a), 0);
  const negativas  = presenca.reduce((a, r) => (Number(r.saldo) < 0 ? a + Number(r.saldo) : a), 0);
  const positivo   = totalSaldo >= 0;

  // saldo negativo por dia (pra marcar no registro de ponto)
  const negMap = {}; negDays.forEach(d => { negMap[d.data] = Number(d.saldo || 0); });

  // pontos batidos agrupados por dia (mais recente primeiro)
  const byDay = {};
  for (const m of marcacoes) { (byDay[m.data] = byDay[m.data] || []).push(m.hora); }
  const dias = Object.entries(byDay)
    .map(([data, horas]) => ({ data, horas: horas.slice().sort() }))
    .sort((a, b) => (a.data < b.data ? 1 : -1));

  const openModal = (dataRef = '') => { setForm({ titulo: '', descricao: '', data_ref: dataRef }); setFile(null); setMsg(''); setModal(true); };

  const submitSolic = async () => {
    if (!form.titulo.trim()) { setMsg('Informe um título'); return; }
    setSaving(true); setMsg('');
    try {
      let file_url = null, file_name = null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'dat').replace(/[^a-zA-Z0-9]/g, '');
        const path = `${cpf || 'anon'}/${Date.now()}.${ext}`;
        const { error: upErr } = await _supabase.storage.from('ponto-anexos').upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw new Error('Falha ao enviar o anexo: ' + upErr.message);
        const { data } = _supabase.storage.from('ponto-anexos').getPublicUrl(path);
        file_url = data.publicUrl; file_name = file.name;
      }
      const { error } = await _supabase.from('ponto_solicitacoes').insert({
        cpf, nome: USER.name, titulo: form.titulo.trim(), descricao: form.descricao.trim() || null,
        data_ref: form.data_ref || null, file_url, file_name, status: 'pendente',
      });
      if (error) throw new Error(error.message);
      setModal(false);
      await loadSolics();
    } catch (e) { setMsg('❌ ' + (e.message || 'Erro ao enviar')); }
    setSaving(false);
  };

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── BANNER: saldo ── */}
      <div style={{
        background: positivo ? 'linear-gradient(135deg,#1A9C70,#27C08A)' : 'linear-gradient(135deg,#C04050,#E0697A)',
        borderRadius: 18, padding: '26px 30px', marginBottom: 16, textAlign: 'center',
        boxShadow: `0 8px 28px ${positivo ? 'rgba(26,156,112,0.25)' : 'rgba(192,64,80,0.25)'}`,
      }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '.08em', marginBottom: 8 }}>PONTO ELETRÔNICO</div>
        <div style={{ width: 240, margin: '0 auto 10px' }}><StarDivider /></div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', marginBottom: 4 }}>Saldo atual do banco</div>
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{positivo ? '+' : ''}{fmtMin(totalSaldo)}</div>
      </div>

      {/* ── positivas / negativas + botão solicitar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: '#1A9C70' }}>
            <Ico d={<><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>} size={15} stroke="#1A9C70" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Horas positivas</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1A9C70' }}>{fmtMin(positivas)}</div>
        </Card>
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: '#C04050' }}>
            <Ico d={<><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>} size={15} stroke="#C04050" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Horas negativas</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#C04050' }}>{fmtMin(negativas)}</div>
        </Card>
      </div>

      <button onClick={() => openModal()} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 18,
        padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg,${T.blue},${T.blueL})`, color: '#fff', fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-body)',
      }}>
        <Ico d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></>} size={16} stroke="white" />
        Solicitar justificativa
      </button>

      {loading ? (
        <Card style={{ padding: 44, textAlign: 'center', color: T.textT }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.blue}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
          Carregando seu ponto...
        </Card>
      ) : !cpf ? (
        <Card style={{ padding: '32px 26px', textAlign: 'center', color: T.textT }}>
          <div style={{ fontSize: 13 }}>Preencha seu <strong>CPF</strong> em “Seus Dados” para ver seu ponto.</div>
        </Card>
      ) : (
        <>
          {/* ── Minhas solicitações ── */}
          {solics.length > 0 && (
            <Card style={{ padding: '20px 24px', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>Minhas solicitações</div>
              <StarDivider my={4} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {solics.map(s => {
                  const st = STATUS_S[s.status] || STATUS_S.pendente;
                  return (
                    <div key={s.id} style={{ display: 'flex', gap: 12, padding: '12px 15px', background: 'rgba(0,0,0,0.02)', border: `1px solid ${T.border}`, borderRadius: 11 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{s.titulo}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 5, padding: '1px 7px' }}>{st.label}</span>
                          {s.data_ref && <span style={{ fontSize: 11, color: T.textD }}>· dia {fmtData(s.data_ref)}</span>}
                        </div>
                        {s.descricao && <div style={{ fontSize: 12.5, color: T.textS, lineHeight: 1.5 }}>{s.descricao}</div>}
                        {s.file_url && (
                          <a href={s.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.blue, marginTop: 5, textDecoration: 'none' }}>
                            <Ico d={<><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></>} size={13} stroke={T.blue} />
                            {s.file_name || 'Ver anexo'}
                          </a>
                        )}
                      </div>
                      <div style={{ fontSize: 10.5, color: T.textD, flexShrink: 0, textAlign: 'right' }}>{s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : ''}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ── Pontos batidos ── */}
          <Card style={{ padding: '20px 24px', marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>Pontos batidos</div>
            <StarDivider my={4} />
            {dias.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: T.textT, fontSize: 13 }}>Nenhuma marcação encontrada para o seu CPF.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                {dias.map((d, i) => {
                  const neg = negMap[d.data];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', background: neg ? 'rgba(192,64,80,0.05)' : 'rgba(0,0,0,0.02)', border: `1px solid ${neg ? 'rgba(192,64,80,0.2)' : T.border}`, borderRadius: 11 }}>
                      <div style={{ minWidth: 92 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fmtData(d.data)}</div>
                        <div style={{ fontSize: 11, color: T.textT, textTransform: 'capitalize' }}>{diaSemana(d.data)}</div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {d.horas.map((h, hi) => (
                          <span key={hi} style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: hi % 2 === 0 ? 'rgba(26,156,112,0.12)' : 'rgba(30,112,181,0.10)', color: hi % 2 === 0 ? '#1A9C70' : '#1E70B5' }}>{(h || '').slice(0, 5)}</span>
                        ))}
                      </div>
                      {neg && (
                        <button onClick={() => openModal(d.data)} title="Justificar este dia"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#C04050', background: 'rgba(192,64,80,0.10)', border: '1px solid rgba(192,64,80,0.25)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                          {fmtMin(neg)}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Saldo por mês ── */}
          <Card style={{ padding: '20px 24px', marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>Saldo por mês</div>
            <StarDivider my={4} />
            {presenca.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.textT, fontSize: 13 }}>Seu ponto ainda não foi processado pelo RH.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {presenca.map((r, i) => {
                  const s = Number(r.saldo || 0), pos = s >= 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 15px', background: 'rgba(0,0,0,0.02)', border: `1px solid ${T.border}`, borderRadius: 11 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, textTransform: 'capitalize', flex: 1 }}>{monthLabel(r.month)}</div>
                      {Number(r.issues) > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#D89030', background: 'rgba(216,144,48,0.12)', borderRadius: 6, padding: '2px 8px' }}>{r.issues} ocorr.</span>}
                      <span style={{ fontSize: 14, fontWeight: 700, color: pos ? '#1A9C70' : '#C04050', background: pos ? 'rgba(26,156,112,0.10)' : 'rgba(192,64,80,0.10)', borderRadius: 7, padding: '4px 11px', minWidth: 78, textAlign: 'right' }}>{pos ? '+' : ''}{fmtMin(s)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Justificativas abonadas pelo RH ── */}
          {justifs.length > 0 && (
            <Card style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>Justificativas abonadas</div>
              <StarDivider my={4} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {justifs.map((j, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 15px', background: 'rgba(0,0,0,0.02)', border: `1px solid ${T.border}`, borderRadius: 11 }}>
                    <div style={{ minWidth: 70 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A9C70' }}>{fmtData(j.data)}</div>
                      {j.abonado && <div style={{ fontSize: 10, color: T.textT }}>Abonado</div>}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: T.textS, lineHeight: 1.5, borderLeft: `2px solid rgba(26,156,112,0.4)`, paddingLeft: 12 }}>
                      {j.texto}{j.autor && <div style={{ fontSize: 11, color: T.textD, marginTop: 3 }}>— {j.autor}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── MODAL: solicitar justificativa ── */}
      {modal && (
        <div onClick={() => !saving && setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface || 'white', borderRadius: 20, padding: 28, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>Solicitar justificativa</div>
            <div style={{ fontSize: 12.5, color: T.textS, marginBottom: 18 }}>Explique por que precisa justificar e anexe um comprovante. O RH vai analisar.</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Título *</div>
              <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Atestado médico, consulta..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Dia que está justificando</div>
              <input type="date" value={form.data_ref} onChange={e => setForm(p => ({ ...p, data_ref: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Descrição</div>
              <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Descreva o motivo..."
                style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Anexo (atestado, comprovante...)</div>
              <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px dashed ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: file ? T.text : T.textT, fontFamily: 'var(--font-body)' }}>
                <Ico d={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>} size={15} stroke={T.textS} />
                {file ? file.name : 'Escolher arquivo'}
              </button>
            </div>

            {msg && <div style={{ fontSize: 12, color: '#C04050', marginBottom: 10, padding: '7px 12px', borderRadius: 7, background: 'rgba(192,64,80,0.06)' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(false)} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: T.textS, fontFamily: 'var(--font-body)' }}>Cancelar</button>
              <button onClick={submitSolic} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer', background: `linear-gradient(135deg,${T.blue},${T.blueL})`, color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)' }}>
                {saving ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { TabMeuPonto };
