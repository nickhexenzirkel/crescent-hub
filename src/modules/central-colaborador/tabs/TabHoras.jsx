import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser, supabase as _supabase } from '../../../contexts/user';
import { Card, StarDivider } from '../../../shared/components';

const BRL = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Ico = ({ d, size = 14, stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const calcHoras = (inicio, fim) => {
  if (!inicio || !fim) return 0;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fim.split(':').map(Number);
  return Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
};

const fmtHoras = h => {
  if (!h || h <= 0) return '0h';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2, '0')}` : `${hh}h`;
};

const fmtData = iso => {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
};

const nowTime = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  pendente:  { bg: 'rgba(216,144,48,0.15)',  color: '#D89030' },
  aprovado:  { bg: 'rgba(26,156,112,0.12)',  color: '#1A9C70' },
  rejeitado: { bg: 'rgba(192,64,80,0.12)',   color: '#C04050' },
};

const TabHoras = () => {
  const authData  = getAuthUser();
  const salario   = USER.salary || authData?.salary || 0;
  const valorHora = salario > 0 ? salario / 240 : 0;

  const [registros, setRegistros] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [modal,     setModal]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');
  const [search,    setSearch]    = useState('');
  const [form,      setForm]      = useState({
    data: new Date().toISOString().slice(0, 10),
    descricao: '',
    hora_inicio: '',
    hora_fim: '',
    feriado_domingo: false,
  });

  const loadRegistros = async () => {
    setLoading(true);
    const { data } = await _supabase.from('banco_horas')
      .select('*').eq('created_by', USER.name)
      .order('created_at', { ascending: false });
    setRegistros(data || []);
    setLoading(false);
  };

  useEffect(() => { loadRegistros(); }, []);

  const delRegistro = async (id) => {
    if (!window.confirm('Remover este registro?')) return;
    await _supabase.from('banco_horas').delete().eq('id', id);
    await loadRegistros();
  };

  const totalHorasCalc = registros.reduce((a, r) => a + Number(r.horas_calculadas || 0), 0);
  const totalValor     = registros.reduce((a, r) => a + Number(r.valor_total || 0), 0);

  const previewTotal = calcHoras(form.hora_inicio, form.hora_fim);
  const previewCalc  = previewTotal * (form.feriado_domingo ? 2 : 1);
  const previewMult  = form.feriado_domingo ? 2.0 : 1.5;
  const previewValor = valorHora > 0 ? previewTotal * valorHora * previewMult : null;

  const openModal = () => {
    setForm({ data: new Date().toISOString().slice(0, 10), descricao: '', hora_inicio: '', hora_fim: '', feriado_domingo: false });
    setMsg('');
    setModal(true);
  };

  const saveRegistro = async () => {
    if (!form.descricao.trim())    { setMsg('Informe a descrição do serviço'); return; }
    if (!form.hora_inicio || !form.hora_fim) { setMsg('Informe hora início e hora fim'); return; }
    if (form.data === todayIso() && form.hora_fim > nowTime()) { setMsg('Hora fim não pode ser no futuro'); return; }
    const total = calcHoras(form.hora_inicio, form.hora_fim);
    if (total <= 0) { setMsg('Hora fim deve ser maior que hora início'); return; }
    setSaving(true); setMsg('');
    const calc         = total * (form.feriado_domingo ? 2 : 1);
    const multiplicador = form.feriado_domingo ? 2.0 : 1.5;
    const vH   = valorHora > 0 ? valorHora : null;
    const vT   = vH ? total * vH * multiplicador : null;
    const { error } = await _supabase.from('banco_horas').insert({
      created_by:       USER.name,
      data:             form.data,
      descricao:        form.descricao,
      hora_inicio:      form.hora_inicio,
      hora_fim:         form.hora_fim,
      total_horas:      total,
      feriado_domingo:  form.feriado_domingo,
      horas_calculadas: calc,
      valor_hora:       vH,
      valor_total:      vT,
      status:           'pendente',
    });
    if (error) { setMsg('Erro: ' + error.message); setSaving(false); return; }
    await loadRegistros();
    setModal(false);
    setSaving(false);
  };

  const filtrados = registros.filter(r =>
    r.descricao.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── BANNER ── */}
      <div style={{
        background: `linear-gradient(135deg,${T.blue},${T.blueL})`,
        borderRadius: 18, padding: '28px 30px', marginBottom: 22,
        textAlign: 'center', boxShadow: `0 8px 28px rgba(78,143,168,0.25)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '.08em', marginBottom: 8 }}>
            BANCO DE HORAS
          </div>
          <div style={{ width: 250, margin: '0 auto 12px' }}><StarDivider /></div>
          <div style={{ fontSize: 44, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', lineHeight: 1, marginBottom: 6 }}>
            {fmtHoras(totalHorasCalc)}
          </div>
          {valorHora > 0 && totalValor > 0 && (
            <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginBottom: 8 }}>
              ≈ {BRL(totalValor)}
            </div>
          )}
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginBottom: 16 }}>
            Total acumulado · {registros.length} registro{registros.length !== 1 ? 's' : ''}
          </div>
          <button onClick={openModal} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 22px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.15)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-body)', outline: 'none',
          }}>
            <Ico d={<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>} size={13} stroke="white" />
            Registrar Horas
          </button>
        </div>
      </div>

      {/* ── HISTÓRICO ── */}
      <Card style={{ padding: '24px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Histórico</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            style={{ background: 'rgba(0,0,0,0.03)', border: `1.5px solid ${T.border}`, borderRadius: 9, padding: '7px 12px', color: T.text, fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', width: 180 }} />
        </div>
        <StarDivider my={4} />

        {loading
          ? <div style={{ textAlign: 'center', padding: 48, color: T.textT }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.blue}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
              Carregando...
            </div>
          : filtrados.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px 0', color: T.textT }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.2" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 12px', opacity: .4 }}>
                  <circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <div style={{ fontSize: 13 }}>Nenhuma hora registrada ainda.</div>
                <div style={{ fontSize: 12, marginTop: 4, opacity: .7 }}>Use o botão acima para registrar suas horas extras.</div>
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {filtrados.map(r => {
                  const ss = STATUS_STYLE[r.status] || STATUS_STYLE.pendente;
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(0,0,0,0.02)', border: `1px solid ${T.border}`, borderRadius: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${T.blue},${T.blueL})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>{fmtHoras(Number(r.horas_calculadas))}</div>
                        {r.feriado_domingo && <div style={{ fontSize: 8, opacity: .85 }}>×2</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao}</div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: T.textD }}>{fmtData(r.data)}</span>
                          <span style={{ fontSize: 11, color: T.textD }}>{r.hora_inicio} → {r.hora_fim}</span>
                          {r.feriado_domingo && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#D89030', background: 'rgba(216,144,48,0.12)', borderRadius: 5, padding: '1px 6px' }}>Feriado/Dom</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: T.textS, marginTop: 3 }}>
                          {fmtHoras(Number(r.total_horas))} trabalhadas → {fmtHoras(Number(r.horas_calculadas))} no banco
                          {r.valor_total > 0 && ` · ${BRL(r.valor_total)}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: ss.bg, color: ss.color, textTransform: 'capitalize' }}>
                          {r.status}
                        </span>
                        {r.status === 'rejeitado' && (
                          <button onClick={() => delRegistro(r.id)} title="Excluir"
                            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(192,64,80,0.25)', background: 'rgba(192,64,80,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C04050', outline: 'none' }}>
                            <Ico d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></>} size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
        }
      </Card>

      {/* ── MODAL REGISTRO ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: T.surface || 'white', borderRadius: 20, padding: 32, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${T.border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 20 }}>
              Registrar Horas Extras
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Data</div>
              <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Descrição do serviço *</div>
              <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Plantão, reunião extra, entrega de relatório..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Hora início *</div>
                <input type="time" value={form.hora_inicio} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Hora fim *</div>
                <input type="time" value={form.hora_fim}
                  max={form.data === todayIso() ? nowTime() : undefined}
                  onChange={e => setForm(p => ({ ...p, hora_fim: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Toggle Feriado/Domingo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(216,144,48,0.08)', border: '1px solid rgba(216,144,48,0.22)', marginBottom: 16, cursor: 'pointer' }}
              onClick={() => setForm(p => ({ ...p, feriado_domingo: !p.feriado_domingo }))}>
              <div style={{ width: 38, height: 22, borderRadius: 11, border: 'none', outline: 'none', flexShrink: 0, background: form.feriado_domingo ? '#D89030' : 'rgba(0,0,0,0.15)', position: 'relative', transition: 'background .2s', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', left: form.feriado_domingo ? 19 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#D89030' }}>Feriado / Domingo</div>
                <div style={{ fontSize: 11, color: T.textS }}>Horas contadas em dobro no banco (×2)</div>
              </div>
            </div>

            {/* Preview do cálculo */}
            {previewTotal > 0 && (
              <div style={{ padding: '14px 16px', borderRadius: 10, background: `rgba(78,143,168,0.08)`, border: `1px solid rgba(78,143,168,0.22)`, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.blue || '#2A6FB5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Estimativa do cálculo</div>

                {/* Fórmula detalhada */}
                {valorHora > 0 && (
                  <div style={{ fontSize: 12.5, color: T.text, marginBottom: 12, padding: '8px 10px', background: 'rgba(26,156,112,0.07)', borderRadius: 7, border: '1px solid rgba(26,156,112,0.18)', fontFamily: 'monospace', lineHeight: 1.7 }}>
                    {form.hora_inicio} — {form.hora_fim} = <strong>{previewTotal.toFixed(2)}h</strong> × <strong>{BRL(valorHora)}</strong> × <strong style={{ color: form.feriado_domingo ? '#D89030' : T.blue }}>{form.feriado_domingo ? '200% (base + 100%)' : '150% (base + 50%)'}</strong> = <strong style={{ color: '#1A9C70', fontSize: 14 }}>{BRL(previewValor)}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.textD, marginBottom: 2 }}>Horas trabalhadas</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{fmtHoras(previewTotal)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textD, marginBottom: 2 }}>No banco {form.feriado_domingo ? '(×2)' : '(×1)'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: form.feriado_domingo ? '#D89030' : T.text }}>{fmtHoras(previewCalc)}</div>
                  </div>
                  {previewValor !== null && (
                    <div>
                      <div style={{ fontSize: 11, color: T.textD, marginBottom: 2 }}>Valor a receber</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1A9C70' }}>{BRL(previewValor)}</div>
                    </div>
                  )}
                </div>
                {valorHora <= 0 && (
                  <div style={{ fontSize: 11, color: T.textD, marginTop: 8, opacity: .7 }}>
                    Salário não configurado — o valor em reais não está disponível.
                  </div>
                )}
              </div>
            )}

            {msg && <div style={{ fontSize: 12, color: '#C04050', marginBottom: 10, padding: '7px 12px', borderRadius: 7, background: 'rgba(192,64,80,0.06)' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: T.textS, fontFamily: 'var(--font-body)', outline: 'none' }}>Cancelar</button>
              <button onClick={saveRegistro} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer', background: `linear-gradient(135deg,${T.blue},${T.blueL})`, color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}>
                {saving ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { TabHoras };
