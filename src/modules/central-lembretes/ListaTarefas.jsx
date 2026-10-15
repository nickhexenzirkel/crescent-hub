import React, { useState, useEffect, useMemo, useRef } from 'react';
import { T } from '../../contexts/theme';
import { Card } from '../../shared/components';
import {
  DIAS_SEMANA, DIAS_CURTO, MESES, hojeIso, daIso, addDias, iso,
  ehDoFaturamento, carregarLista, salvarLista, carregarTodasListas, carregarCronograma,
  itensDoDia, alternarFeita, resumoDia, resumoPeriodo, pct, serie, listaVazia,
} from '../../shared/listaTarefas';

const VERDE = '#1A9060';
const VERM = '#C04050';

const inputSt = { padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' };
const btnGold = { padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)' };
const btnGhost = { padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 12.5, fontFamily: 'var(--font-body)' };

const dataBr = (s) => { const d = daIso(s); return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`; };

const dataCurta = (s) => { const d = daIso(s); return `${DIAS_CURTO[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

const Check = ({ on, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} aria-label={on ? 'Desmarcar' : 'Marcar como feita'}
    style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, cursor: disabled ? 'default' : 'pointer', outline: 'none',
      border: `2px solid ${on ? VERDE : T.border}`, background: on ? VERDE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
    {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
  </button>
);

const Barra = ({ valor, cor = VERDE, alt = 8 }) => (
  <div style={{ height: alt, borderRadius: alt, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
    <div style={{ width: `${valor}%`, height: '100%', background: cor, borderRadius: alt, transition: 'width .3s' }} />
  </div>
);

const corPct = (p, total) => (!total ? T.textD : p >= 80 ? VERDE : p >= 50 ? '#C8960A' : VERM);

const Kpi = ({ titulo, r }) => {
  const p = pct(r);
  return (
    <Card style={{ padding: '14px 16px', flex: '1 1 150px', minWidth: 150 }} elevated>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textD, textTransform: 'uppercase', letterSpacing: '.08em' }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: corPct(p, r.total), margin: '4px 0 6px' }}>{r.total ? `${p}%` : '—'}</div>
      <Barra valor={p} cor={corPct(p, r.total)} alt={6} />
      <div style={{ fontSize: 11.5, color: T.textT, marginTop: 6 }}>{r.feitas} de {r.total} concluídas</div>
    </Card>
  );
};

/* Gráfico de barras: cada coluna = total planejado (cinza) com a parte concluída (verde) por cima. */
const Grafico = ({ dados }) => {
  const max = Math.max(1, ...dados.map((d) => d.total));
  const H = 150;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minWidth: dados.length * 44, height: H + 56 }}>
        {dados.map((d, i) => {
          const p = pct(d);
          return (
            <div key={i} title={`${d.rotulo} ${d.sub}: ${d.feitas} de ${d.total} (${p}%)`}
              style={{ flex: 1, minWidth: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: corPct(p, d.total), marginBottom: 3 }}>{d.total ? `${p}%` : ''}</div>
              <div style={{ width: '100%', maxWidth: 38, height: H, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${(d.total / max) * 100}%`, background: 'rgba(0,0,0,0.09)', borderRadius: '6px 6px 2px 2px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden', minHeight: d.total ? 3 : 0 }}>
                  <div style={{ width: '100%', height: `${d.total ? (d.feitas / d.total) * 100 : 0}%`, background: VERDE }} />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textS, marginTop: 5 }}>{d.rotulo}</div>
              <div style={{ fontSize: 10, color: T.textD, height: 12 }}>{d.sub}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: T.textT, marginTop: 8 }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: VERDE, marginRight: 5 }} />Concluídas</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'rgba(0,0,0,0.15)', marginRight: 5 }} />Previstas (altura = quantidade)</span>
      </div>
    </div>
  );
};

const ListaTarefas = ({ userName, podeVerEquipe }) => {
  const [alvo, setAlvo] = useState(userName);          // de quem é a lista que está na tela
  const [lista, setLista] = useState(listaVazia());
  const [crono, setCrono] = useState(null);
  const [fat, setFat] = useState(false);               // pertence ao setor de faturamento
  const [carregando, setCarregando] = useState(true);
  const [dia, setDia] = useState(hojeIso());
  const [visao, setVisao] = useState('dia');
  const [equipe, setEquipe] = useState([]);
  const [erro, setErro] = useState('');
  const [semFixo, setSemFixo] = useState(false);
  const [grafOpen, setGrafOpen] = useState(false);
  const [novo, setNovo] = useState({ titulo: '', freq: 'diaria', dias: [1, 2, 3, 4, 5], data: hojeIso() });
  const salvando = useRef(0);

  /* Passou da meia-noite com a tela aberta: se estava olhando "hoje", acompanha o dia novo. */
  const hojeRef = useRef(hojeIso());
  useEffect(() => {
    const id = setInterval(() => {
      const novo = hojeIso();
      if (novo !== hojeRef.current) { const antigo = hojeRef.current; hojeRef.current = novo; setDia((d) => (d === antigo ? novo : d)); }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const meu = alvo === userName;
  const hoje = hojeIso();

  /* Quem é do faturamento: o cronograma só aparece para esse setor. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [l, c, f] = await Promise.all([carregarLista(alvo), carregarCronograma(alvo), ehDoFaturamento(alvo)]);
      if (!vivo) return;
      setLista(l); setCrono(f ? c : null); setFat(f); setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [alvo]);

  useEffect(() => {
    if (!podeVerEquipe) return;
    carregarTodasListas().then(setEquipe);
  }, [podeVerEquipe]);

  const gravar = async (nova) => {
    setLista(nova);
    const n = ++salvando.current;
    const ok = await salvarLista(alvo, nova);
    if (n === salvando.current) setErro(ok ? '' : 'Não consegui salvar agora. Confira a internet e tente de novo.');
  };

  const marcar = (item) => {
    if (!meu || dia > hoje) return;
    gravar(alternarFeita(lista, item, dia));
  };

  const addTarefa = () => {
    const titulo = novo.titulo.trim();
    if (!titulo) return;
    if (novo.freq === 'semana' && !novo.dias.length) return;
    const t = { id: 't' + Date.now().toString(36), titulo, freq: novo.freq, criada: hoje };
    if (novo.freq === 'semana') t.dias = novo.dias;
    if (novo.freq === 'unica') t.data = novo.data || hoje;
    gravar({ ...lista, tarefas: [...lista.tarefas, t] });
    setNovo((n) => ({ ...n, titulo: '' }));
  };

  /* Remove da lista de hoje em diante; o histórico (e os gráficos) dos dias passados continua igual. */
  const removerTarefa = (id) => {
    if (!window.confirm('Remover esta tarefa daqui para frente? O histórico dos dias passados continua nos gráficos.')) return;
    gravar({ ...lista, tarefas: lista.tarefas.map((t) => (t.id === id ? { ...t, removida: hoje } : t)) });
  };

  const { pessoais, fat: itensFat } = useMemo(() => itensDoDia(lista, crono, dia), [lista, crono, dia]);
  const r = resumoDia(lista, crono, dia);
  const rMes = useMemo(() => { const d = daIso(hoje); return resumoPeriodo(lista, crono, iso(new Date(d.getFullYear(), d.getMonth(), 1)), hoje); }, [lista, crono, hoje]);
  const rAno = useMemo(() => resumoPeriodo(lista, crono, `${daIso(hoje).getFullYear()}-01-01`, hoje), [lista, crono, hoje]);
  const dados = useMemo(() => serie(lista, crono, visao), [lista, crono, visao]);
  const tarefasAtivas = lista.tarefas.filter((t) => !t.removida);
  const semDiaFixo = crono ? crono.itens.filter((i) => !(i.dias || []).length && !(i.diasMes || []).length) : [];

  const rankingEquipe = useMemo(() => {
    const d = daIso(hoje); const ini = iso(new Date(d.getFullYear(), d.getMonth(), 1));
    return equipe.map(({ nome, lista: l }) => ({ nome, ...resumoPeriodo(l, null, ini, hoje) }))
      .filter((x) => x.total > 0).sort((a, b) => pct(b) - pct(a));
  }, [equipe, hoje]);

  const nomesEquipe = useMemo(() => [...new Set([userName, ...equipe.map((e) => e.nome)])], [equipe, userName]);

  if (carregando) {
    return <div style={{ textAlign: 'center', padding: 60, color: T.textT }}>Carregando tarefas...</div>;
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`.lt-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:18px;align-items:start}@media(max-width:900px){.lt-grid{grid-template-columns:1fr}}`}</style>
      {podeVerEquipe && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textD, textTransform: 'uppercase', letterSpacing: '.08em' }}>Ver lista de</span>
          <select value={alvo} onChange={(e) => setAlvo(e.target.value)} style={{ ...inputSt, padding: '7px 10px' }}>
            {nomesEquipe.map((n) => <option key={n} value={n}>{n === userName ? `${n} (eu)` : n}</option>)}
          </select>
          {!meu && <span style={{ fontSize: 12, color: T.textT }}>Somente leitura.</span>}
        </div>
      )}

      {erro && <div style={{ fontSize: 12.5, color: VERM, padding: '8px 12px', borderRadius: 8, background: 'rgba(192,64,80,0.07)' }}>{erro}</div>}

      <div className={meu ? 'lt-grid' : ''}>
      {/* ── checklist do dia ── */}
      <Card style={{ padding: '18px 20px' }} elevated>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={() => setGrafOpen(true)} title="Ver gráficos e porcentagens" aria-label="Ver gráficos"
            style={{ ...btnGhost, padding: '6px 10px', display: 'flex', alignItems: 'center', color: T.gold, borderColor: T.gold }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
          </button>
          <button onClick={() => setDia(addDias(dia, -1))} style={{ ...btnGhost, padding: '6px 10px' }} aria-label="Dia anterior">‹</button>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 700, color: T.text }}>{dia === hoje ? 'Hoje' : dataBr(dia)}</div>
            {dia === hoje && <div style={{ fontSize: 12.5, color: T.textT }}>{dataBr(dia)}</div>}
          </div>
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} style={{ ...inputSt, padding: '6px 10px' }} />
          <button onClick={() => setDia(addDias(dia, 1))} style={{ ...btnGhost, padding: '6px 10px' }} aria-label="Próximo dia">›</button>
          {dia > hoje && <span style={{ fontSize: 12, color: T.textT }}>Dia futuro: só para consulta.</span>}
          {dia !== hoje && <button onClick={() => setDia(hoje)} style={btnGhost}>Voltar para hoje</button>}
        </div>

        <div style={{ maxHeight: 'calc(100vh - 340px)', minHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
        {fat && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2E8DD4', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Faturamento · {DIAS_SEMANA[daIso(dia).getDay()]}
            </div>
            {!crono
              ? <div style={{ fontSize: 13, color: T.textT, lineHeight: 1.6 }}>
                  Ainda não há cronograma. Monte sua carteira em <b>Oficina Estelar → Controle de Clientes</b> e os clientes de cada dia aparecem aqui sozinhos.
                </div>
              : itensFat.length === 0
                ? <div style={{ fontSize: 13, color: T.textT }}>{[0, 6].includes(daIso(dia).getDay()) ? 'Fim de semana: nenhum cliente para faturar.' : 'Nenhum cliente para faturar neste dia.'}</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {itensFat.map((it) => (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, opacity: it.feita ? 0.62 : 1 }}>
                        <Check on={it.feita} onClick={() => marcar(it)} disabled={!meu || dia > hoje} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, textDecoration: it.feita ? 'line-through' : 'none' }}>{it.titulo}</div>
                          <div style={{ fontSize: 11.5, color: T.textT }}>{it.detalhe}{it.obs ? ` — ${it.obs}` : ''}</div>
                          {it.atrasada && <div style={{ fontSize: 11, fontWeight: 700, color: '#D9822B', marginTop: 2 }}>Acumulada · venceu {dataCurta(it.due)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>}
            {semDiaFixo.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setSemFixo((v) => !v)} style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }}>
                  {semFixo ? 'Esconder' : 'Ver'} {semDiaFixo.length} sem dia fixo (solicitação)
                </button>
                {semFixo && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {semDiaFixo.map((it) => (
                      <div key={it.k} style={{ fontSize: 12.5, color: T.textS }}><b>{it.cliente}</b> · {[it.categoria, it.periodo].filter(Boolean).join(' · ')}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Minhas tarefas</div>
        {pessoais.length === 0
          ? <div style={{ fontSize: 13, color: T.textT }}>Nenhuma tarefa para este dia. Crie uma nova.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pessoais.map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, opacity: it.feita ? 0.62 : 1 }}>
                  <Check on={it.feita} onClick={() => marcar(it)} disabled={!meu || dia > hoje} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: T.text, textDecoration: it.feita ? 'line-through' : 'none', wordBreak: 'break-word' }}>{it.titulo}</div>
                </div>
              ))}
            </div>}
        </div>
      </Card>

      {/* ── nova tarefa / tarefas cadastradas ── */}
      {meu && (
        <Card style={{ padding: '18px 20px' }} elevated>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}>Nova tarefa</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={novo.titulo} onChange={(e) => setNovo((n) => ({ ...n, titulo: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addTarefa()}
              placeholder="Ex: Conferir e-mails de medição" style={{ ...inputSt, flex: '1 1 240px' }} />
            <select value={novo.freq} onChange={(e) => setNovo((n) => ({ ...n, freq: e.target.value }))} style={inputSt}>
              <option value="diaria">Todo dia</option>
              <option value="semana">Dias da semana</option>
              <option value="unica">Uma vez só</option>
            </select>
            {novo.freq === 'unica' && <input type="date" value={novo.data} onChange={(e) => setNovo((n) => ({ ...n, data: e.target.value }))} style={inputSt} />}
            <button onClick={addTarefa} style={btnGold}>Adicionar</button>
          </div>
          {novo.freq === 'semana' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {DIAS_CURTO.map((nm, i) => {
                const on = novo.dias.includes(i);
                return (
                  <button key={i} onClick={() => setNovo((n) => ({ ...n, dias: on ? n.dias.filter((x) => x !== i) : [...n.dias, i] }))}
                    style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)', outline: 'none',
                      border: `1.5px solid ${on ? T.gold : T.border}`, background: on ? `${T.gold}22` : 'transparent', color: on ? T.gold : T.textS }}>{nm}</button>
                );
              })}
            </div>
          )}

          {tarefasAtivas.length > 0 && (
            <div style={{ marginTop: 16, maxHeight: 'calc(100vh - 520px)', minHeight: 120, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textD, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Tarefas cadastradas</div>
              {tarefasAtivas.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${T.border}` }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text, wordBreak: 'break-word' }}>{t.titulo}</div>
                  <span style={{ fontSize: 11.5, color: T.textT, whiteSpace: 'nowrap' }}>
                    {t.freq === 'diaria' ? 'Todo dia' : t.freq === 'semana' ? (t.dias || []).map((d) => DIAS_CURTO[d]).join(', ') : daIso(t.data).toLocaleDateString('pt-BR')}
                  </span>
                  <button onClick={() => removerTarefa(t.id)} title="Remover" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(192,64,80,0.25)', background: 'rgba(192,64,80,0.05)', color: VERM, cursor: 'pointer', outline: 'none' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      </div>

      {/* ── tela de gráficos (fundo desfocado) ── */}
      {grafOpen && (
        <div onClick={() => setGrafOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(10,15,25,0.38)', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 860, maxHeight: '92vh', overflowY: 'auto', borderRadius: 20, padding: '22px 22px 26px',
              background: T.surface || 'white', border: `1px solid ${T.border}`, boxShadow: '0 24px 70px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 700, color: T.text }}>Desempenho das tarefas</div>
                <div style={{ fontSize: 12.5, color: T.textT }}>{meu ? 'Você' : alvo}</div>
              </div>
              <button onClick={() => setGrafOpen(false)} aria-label="Fechar" style={{ ...btnGhost, padding: '6px 12px' }}>✕</button>
            </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Kpi titulo={dia === hoje ? 'Hoje' : 'Dia selecionado'} r={r} />
          <Kpi titulo="Este mês" r={rMes} />
          <Kpi titulo="Este ano" r={rAno} />
        </div>


        {/* ── gráficos ── */}
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text, flex: 1 }}>
              Tarefas concluídas{!meu ? ` — ${alvo}` : ''}
            </div>
            {[['dia', 'Diário'], ['mes', 'Mensal'], ['ano', 'Anual']].map(([id, nm]) => (
              <button key={id} onClick={() => setVisao(id)} style={{ ...btnGhost, padding: '6px 14px', fontWeight: visao === id ? 700 : 400,
                color: visao === id ? T.gold : T.textS, borderColor: visao === id ? T.gold : T.border }}>{nm}</button>
            ))}
          </div>
          {dados.every((d) => !d.total)
            ? <div style={{ fontSize: 13, color: T.textT, padding: '20px 0', textAlign: 'center' }}>Ainda não há tarefas previstas neste período.</div>
            : <Grafico dados={dados} />}
          <div style={{ fontSize: 11.5, color: T.textD, marginTop: 10 }}>
            {visao === 'dia' ? 'Últimos 14 dias.' : visao === 'mes' ? 'Últimos 12 meses.' : 'Um ano por barra.'} Dias futuros não entram na conta. Clientes do faturamento contam no dia do vencimento: se não deu para fazer, ficam acumulados (semanal 1 dia útil, decendial 5, quinzenal 7, mensal 10) e só viram "não feitos" depois do prazo.
          </div>
        </Card>

        {/* ── equipe (admin/moderador) ── */}
        {podeVerEquipe && rankingEquipe.length > 0 && (
          <Card style={{ padding: '18px 20px' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}>Equipe · {MESES[daIso(hoje).getMonth()]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rankingEquipe.map((x) => (
                <div key={x.nome} onClick={() => { setAlvo(x.nome); setGrafOpen(false); }} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.text, marginBottom: 4 }}>
                    <span>{x.nome}</span><span style={{ color: corPct(pct(x), x.total), fontWeight: 700 }}>{pct(x)}% · {x.feitas}/{x.total}</span>
                  </div>
                  <Barra valor={pct(x)} cor={corPct(pct(x), x.total)} alt={6} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: T.textD, marginTop: 10 }}>Conta só as tarefas pessoais de cada pessoa; clique em um nome para ver a lista e os gráficos dela.</div>
          </Card>
        )}

          </div>
        </div>
      )}
    </div>
  );
};

export default ListaTarefas;
