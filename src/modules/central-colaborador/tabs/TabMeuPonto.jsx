// src/modules/central-colaborador/tabs/TabMeuPonto.jsx
// "Meu Ponto Eletrônico" — visão do COLABORADOR do seu próprio ponto:
//  • saldo do banco (horas positivas/negativas) por mês — fonte: ponto_presenca
//    (resumo mensal em MINUTOS, gravado pelo RH ao processar o AFD).
//  • justificativas registradas — fonte: ponto_justificativas.
import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser, supabase as _supabase } from '../../../contexts/user';
import { Card, StarDivider } from '../../../shared/components';

const onlyDigits = s => (s || '').replace(/\D/g, '');
const fmtMin = m => { const a = Math.abs(Math.round(m)), h = Math.floor(a / 60), mm = a % 60; return `${m < 0 ? '-' : ''}${h}h${mm.toString().padStart(2, '0')}`; };
const fmtData = iso => { if (!iso) return '—'; try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return iso; } };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = ym => { if (!ym) return ym; const [y, m] = ym.split('-'); return `${MESES[(+m) - 1] || m}/${y}`; };

const Ico = ({ d, size = 14, stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const TabMeuPonto = () => {
  const cpf = onlyDigits(getAuthUser()?.cpf || USER.cpf);
  const [presenca, setPresenca] = useState([]);
  const [justifs, setJustifs]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!cpf) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [pres, just] = await Promise.all([
          _supabase.from('ponto_presenca').select('month,saldo,issues').eq('cpf', cpf).order('month', { ascending: false }),
          _supabase.from('ponto_justificativas').select('data,texto,abonado,autor,updated_at').eq('cpf', cpf).order('data', { ascending: false }),
        ]);
        if (!alive) return;
        setPresenca(pres.data || []);
        setJustifs(just.data || []);
      } catch {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [cpf]);

  const totalSaldo = presenca.reduce((a, r) => a + Number(r.saldo || 0), 0);
  const positivas  = presenca.reduce((a, r) => (Number(r.saldo) > 0 ? a + Number(r.saldo) : a), 0);
  const negativas  = presenca.reduce((a, r) => (Number(r.saldo) < 0 ? a + Number(r.saldo) : a), 0); // <= 0
  const totalIssues = presenca.reduce((a, r) => a + Number(r.issues || 0), 0);
  const positivo = totalSaldo >= 0;

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── BANNER: saldo atual ── */}
      <div style={{
        background: positivo ? 'linear-gradient(135deg,#1A9C70,#27C08A)' : 'linear-gradient(135deg,#C04050,#E0697A)',
        borderRadius: 18, padding: '28px 30px', marginBottom: 18, textAlign: 'center',
        boxShadow: `0 8px 28px ${positivo ? 'rgba(26,156,112,0.25)' : 'rgba(192,64,80,0.25)'}`,
      }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '.08em', marginBottom: 8 }}>
          MEU PONTO ELETRÔNICO
        </div>
        <div style={{ width: 250, margin: '0 auto 12px' }}><StarDivider /></div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', marginBottom: 4 }}>Saldo atual do banco</div>
        <div style={{ fontSize: 44, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', lineHeight: 1 }}>
          {positivo ? '+' : ''}{fmtMin(totalSaldo)}
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', marginTop: 10 }}>
          {presenca.length} {presenca.length === 1 ? 'mês' : 'meses'} processado{presenca.length === 1 ? '' : 's'} · {totalIssues} ocorrência{totalIssues === 1 ? '' : 's'}
        </div>
      </div>

      {/* ── Cards positivas / negativas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#1A9C70' }}>
            <Ico d={<><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>} size={16} stroke="#1A9C70" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Horas positivas</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1A9C70' }}>{fmtMin(positivas)}</div>
          <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>crédito acumulado</div>
        </Card>
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#C04050' }}>
            <Ico d={<><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>} size={16} stroke="#C04050" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Horas negativas</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#C04050' }}>{fmtMin(negativas)}</div>
          <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>débito acumulado</div>
        </Card>
      </div>

      {loading ? (
        <Card style={{ padding: 48, textAlign: 'center', color: T.textT }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.blue}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
          Carregando seu ponto...
        </Card>
      ) : !cpf ? (
        <Card style={{ padding: '32px 26px', textAlign: 'center', color: T.textT }}>
          <div style={{ fontSize: 13 }}>Preencha seu <strong>CPF</strong> em “Seus Dados” para ver seu ponto.</div>
        </Card>
      ) : (
        <>
          {/* ── Saldo por mês ── */}
          <Card style={{ padding: '22px 24px', marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>Saldo por mês</div>
            <StarDivider my={4} />
            {presenca.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '34px 0', color: T.textT }}>
                <Ico d={<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>} size={34} stroke={T.textD} />
                <div style={{ fontSize: 13, marginTop: 10 }}>Seu ponto ainda não foi processado pelo RH.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {presenca.map((r, i) => {
                  const s = Number(r.saldo || 0), pos = s >= 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'rgba(0,0,0,0.02)', border: `1px solid ${T.border}`, borderRadius: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, textTransform: 'capitalize', flex: 1 }}>{monthLabel(r.month)}</div>
                      {Number(r.issues) > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#D89030', background: 'rgba(216,144,48,0.12)', borderRadius: 6, padding: '2px 8px' }}>
                          {r.issues} ocorrência{Number(r.issues) === 1 ? '' : 's'}
                        </span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: pos ? '#1A9C70' : '#C04050', background: pos ? 'rgba(26,156,112,0.10)' : 'rgba(192,64,80,0.10)', borderRadius: 7, padding: '4px 11px', minWidth: 78, textAlign: 'right' }}>
                        {pos ? '+' : ''}{fmtMin(s)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Justificativas ── */}
          <Card style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Justificativas</div>
              <span style={{ fontSize: 12, color: T.textT }}>· {justifs.length}</span>
            </div>
            <StarDivider my={4} />
            {justifs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: T.textT, fontSize: 13 }}>
                Nenhuma justificativa registrada.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {justifs.map((j, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'rgba(0,0,0,0.02)', border: `1px solid ${T.border}`, borderRadius: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: j.abonado ? 'rgba(26,156,112,0.12)' : 'rgba(216,144,48,0.12)', color: j.abonado ? '#1A9C70' : '#D89030', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ico d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>} size={18} stroke="currentColor" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{fmtData(j.data)}</span>
                        {j.abonado && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1A9C70', background: 'rgba(26,156,112,0.12)', borderRadius: 5, padding: '1px 7px' }}>Abonado</span>}
                      </div>
                      <div style={{ fontSize: 13, color: T.textS, lineHeight: 1.5 }}>{j.texto}</div>
                      {j.autor && <div style={{ fontSize: 11, color: T.textD, marginTop: 4 }}>por {j.autor}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export { TabMeuPonto };
