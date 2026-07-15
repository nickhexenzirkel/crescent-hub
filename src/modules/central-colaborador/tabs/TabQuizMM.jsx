// src/modules/central-colaborador/tabs/TabQuizMM.jsx
// ═══════════════════════════════════════════════════════════════════════════
// QUIZ DO M&M — o M&M monta um quiz, marca a hora do lançamento e oferece um
// prêmio. Quando dá o horário, todo mundo corre: o PRIMEIRO que acertar todas
// leva. Errou, pode refazer quantas vezes quiser (o que premia quem sabe E é
// rápido, sem eliminar ninguém por um clique errado).
//
// QUEM MONTA: administradores e o Marcos Mota (CPF fixo abaixo).
//
// SEGURANÇA — o prêmio é de verdade, então o gabarito NUNCA chega no navegador:
//   • as perguntas vêm da RPC `mm_quiz_abrir`, que só entrega depois da hora;
//   • as respostas são conferidas dentro do banco (`mm_quiz_responder`);
//   • a tabela do conteúdo não tem policy de SELECT — nem a chave anônima lê.
// Ver supabase_quiz_mm.sql. Sem isso, bastaria abrir o devtools pra ganhar.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER } from '../../../contexts/user';

const MM = '/quiz-mm.png';
/* Marcos Mota — o dono do quiz. Além dos admins, só ele monta. */
const CPF_MARCOS = '01778594310';
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
// Sem `export`: exportar algo que não é componente quebra o fast refresh do Vite.
const podeCriarQuiz = () => {
  const a = getAuthUser();
  return a?.role === 'admin' || soDigitos(a?.cpf) === CPF_MARCOS;
};

const MIN_OPCOES = 2, MAX_OPCOES = 5, MAX_PERGUNTAS = 15;

/* Paleta do M&M: prata do terno + azul da gravata. */
const MMC = {
  azul:  '#1466D8',
  azulL: '#3D93FF',
  prata: '#C7CCD6',
  prataL: '#EEF1F6',
  escuro: '#151A24',
  ouro:  '#FFC93B',
};
const MM_CSS = `
@keyframes mmFloat { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-7px) rotate(1deg); } }
@keyframes mmGlow {
  0%,100% { filter: drop-shadow(0 10px 22px rgba(0,0,0,.4)) drop-shadow(0 0 16px ${MMC.azul}66); }
  50%     { filter: drop-shadow(0 10px 22px rgba(0,0,0,.4)) drop-shadow(0 0 24px ${MMC.azulL}88); }
}
@keyframes mmSpin { to { transform: rotate(360deg); } }
@keyframes mmPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes mmFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes mmPop { 0% { transform: scale(.7); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
@keyframes mmShine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.mm-boneco { animation: mmFloat 4.5s ease-in-out infinite, mmGlow 5s ease-in-out infinite; }
.mm-halo { position: relative; }
.mm-halo::before {
  content: ''; position: absolute; left: 50%; top: 52%; width: 78%; height: 78%;
  transform: translate(-50%,-50%); border-radius: 50%; z-index: -1;
  background: conic-gradient(${MMC.azul}, ${MMC.prata}, ${MMC.azulL}, ${MMC.ouro}, ${MMC.azul});
  filter: blur(26px); opacity: .5; animation: mmSpin 8s linear infinite;
}
.mm-fade { animation: mmFade .4s ease both; }
.mm-pop { animation: mmPop .34s cubic-bezier(.2,1.4,.4,1) both; }
.mm-pulse { animation: mmPulse 1.8s ease-in-out infinite; }
.mm-btn { transition: transform .12s, box-shadow .12s, filter .12s; }
.mm-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.07); }
.mm-btn:active:not(:disabled) { transform: translateY(1px) scale(.99); }
.mm-premio {
  background: linear-gradient(100deg, ${MMC.ouro}, #fff6d0 40%, ${MMC.ouro} 60%, #fff6d0);
  background-size: 200% 100%; animation: mmShine 3.5s linear infinite;
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
@media (prefers-reduced-motion: reduce) {
  .mm-boneco, .mm-halo::before, .mm-pulse, .mm-premio { animation: none !important; }
}
`;

const Svg = ({ children, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...p}>{children}</svg>
);
const IcoTrofeu = (p) => <Svg {...p}><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.7V17c0 .6-.1 1.1-.6 1.4L8 19h8l-1.4-.6c-.5-.3-.6-.8-.6-1.4v-2.3"/><path d="M18 2H6v7a6 6 0 0012 0z"/></Svg>;
const IcoRelogio = (p) => <Svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></Svg>;
const IcoMais = (p) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
const IcoLixo = (p) => <Svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></Svg>;
const IcoCheck = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12"/></Svg>;
const IcoX = (p) => <Svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
const IcoSeta = (p) => <Svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></Svg>;

const Boneco = ({ size = 150, halo = true, style }) => (
  <div className={halo ? 'mm-halo' : undefined} style={{ position: 'relative', width: size, flexShrink: 0, ...style }}>
    <img src={MM} alt="M&M" className="mm-boneco" style={{ width: '100%', display: 'block' }} />
  </div>
);

const meuNome = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
/* Tabela não existe? O PostgREST devolve PGRST205, não o 42P01 do Postgres. */
const semTabela = (e) => !!e && (e.code === 'PGRST205' || e.code === '42P01'
  || /Could not find the table|does not exist|schema cache/i.test(e.message || ''));

const fmtData = (iso) => {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};
/* Contagem regressiva legível: "2h 14min", "45s"... */
const faltam = (ms) => {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}min`;
  if (m) return `${m}min ${ss}s`;
  return `${ss}s`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   CRIAR QUIZ — só admin e Marcos chegam aqui.
   ═══════════════════════════════════════════════════════════════════════════ */
const CriarQuiz = ({ onPronto, onCancelar }) => {
  const [titulo, setTitulo] = useState('');
  const [premio, setPremio] = useState('');
  const [quando, setQuando] = useState('');
  const [perguntas, setPerguntas] = useState([{ q: '', opcoes: ['', ''], correta: 0 }]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const cardBg = T.surface || '#fff';

  const mexer = (i, muda) => setPerguntas(ps => ps.map((p, j) => (j === i ? { ...p, ...muda } : p)));
  const addPergunta = () => setPerguntas(ps => (ps.length >= MAX_PERGUNTAS ? ps : [...ps, { q: '', opcoes: ['', ''], correta: 0 }]));
  const delPergunta = (i) => setPerguntas(ps => (ps.length <= 1 ? ps : ps.filter((_, j) => j !== i)));
  const addOpcao = (i) => mexer(i, { opcoes: [...perguntas[i].opcoes, ''] });
  const delOpcao = (i, k) => {
    const p = perguntas[i];
    if (p.opcoes.length <= MIN_OPCOES) return;
    const opcoes = p.opcoes.filter((_, j) => j !== k);
    // se a correta era a removida (ou veio depois dela), reajusta o índice
    const correta = p.correta === k ? 0 : p.correta > k ? p.correta - 1 : p.correta;
    mexer(i, { opcoes, correta });
  };
  const setOpcao = (i, k, v) => mexer(i, { opcoes: perguntas[i].opcoes.map((o, j) => (j === k ? v : o)) });

  const validar = () => {
    if (!titulo.trim()) return 'Dê um título pro quiz.';
    if (!premio.trim()) return 'Qual é o prêmio?';
    if (!quando) return 'Escolha o horário do lançamento.';
    if (new Date(quando).getTime() < Date.now() - 60_000) return 'O horário já passou.';
    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i];
      if (!p.q.trim()) return `A pergunta ${i + 1} está vazia.`;
      if (p.opcoes.some(o => !o.trim())) return `A pergunta ${i + 1} tem alternativa em branco.`;
      const vistas = new Set(p.opcoes.map(o => o.trim().toLowerCase()));
      if (vistas.size !== p.opcoes.length) return `A pergunta ${i + 1} tem alternativas repetidas.`;
    }
    return '';
  };

  const salvar = async () => {
    const e = validar();
    if (e) { setErro(e); return; }
    setErro(''); setSalvando(true);
    const { data, error } = await supabase.from('mm_quiz').insert({
      titulo: titulo.trim(), premio: premio.trim(),
      lanca_em: new Date(quando).toISOString(),
      total: perguntas.length, criador: meuNome(),
    }).select('id').single();
    if (error) {
      setSalvando(false);
      setErro(semTabela(error) ? 'Falta rodar supabase_quiz_mm.sql no Supabase.' : 'Não deu pra criar o quiz.');
      console.error('[quiz-mm] criar:', error);
      return;
    }
    // Perguntas e gabarito vão pra tabela protegida (ninguém lê pela API).
    const { error: e2 } = await supabase.from('mm_quiz_conteudo').insert({
      quiz_id: data.id,
      perguntas: perguntas.map(p => ({ q: p.q.trim(), opcoes: p.opcoes.map(o => o.trim()) })),
      gabarito: perguntas.map(p => p.correta),
    });
    setSalvando(false);
    if (e2) {
      // Sem conteúdo o quiz não serve pra nada — não deixa o registro órfão.
      await supabase.from('mm_quiz').delete().eq('id', data.id);
      setErro('Não deu pra salvar as perguntas.');
      console.error('[quiz-mm] conteudo:', e2);
      return;
    }
    onPronto();
  };

  const inputCss = {
    width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${T.border}`,
    background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 13.5,
    fontFamily: 'var(--font-body)', outline: 'none',
  };

  return (
    <div className="mm-fade" style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16,
      padding: 20, boxShadow: T.sh, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Boneco size={56} halo={false} />
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text }}>
            Montar um quiz
          </div>
          <div style={{ fontSize: 12, color: T.textT }}>
            Quem acertar todas primeiro leva o prêmio.
          </div>
        </div>
      </div>

      <label style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>TÍTULO</label>
      <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={70}
        placeholder="Ex.: Quiz relâmpago de sexta" style={{ ...inputCss, marginTop: 5, marginBottom: 13 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, marginBottom: 13 }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>🏆 PRÊMIO</label>
          <input value={premio} onChange={e => setPremio(e.target.value)} maxLength={90}
            placeholder="Ex.: Vale um café + folga de 1h" style={{ ...inputCss, marginTop: 5 }} />
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em' }}>⏰ LANÇA EM</label>
          <input type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)}
            style={{ ...inputCss, marginTop: 5 }} />
        </div>
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em', margin: '18px 0 8px' }}>
        PERGUNTAS ({perguntas.length})
      </div>

      {perguntas.map((p, i) => (
        <div key={i} className="mm-fade" style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 13,
          marginBottom: 10, background: T.surfaceSub || 'rgba(0,0,0,.02)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: MMC.azul, color: '#fff',
              fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {i + 1}
            </span>
            <input value={p.q} onChange={e => mexer(i, { q: e.target.value })} maxLength={160}
              placeholder="Escreva a pergunta..." style={{ ...inputCss, flex: 1 }} />
            {perguntas.length > 1 && (
              <button className="mm-btn" onClick={() => delPergunta(i)} title="Remover pergunta"
                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent',
                  color: T.textT, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IcoLixo size={14} />
              </button>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: T.textT, marginBottom: 6, marginLeft: 32 }}>
            Marque a alternativa <b style={{ color: '#28a060' }}>certa</b>:
          </div>
          {p.opcoes.map((o, k) => (
            <div key={k} style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 5, marginLeft: 32 }}>
              <button onClick={() => mexer(i, { correta: k })} title="Esta é a certa"
                style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  border: `2px solid ${p.correta === k ? '#28a060' : T.border}`,
                  background: p.correta === k ? '#28a060' : 'transparent', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.correta === k && <IcoCheck size={12} />}
              </button>
              <input value={o} onChange={e => setOpcao(i, k, e.target.value)} maxLength={90}
                placeholder={`Alternativa ${k + 1}`}
                style={{ ...inputCss, flex: 1, padding: '7px 10px', fontSize: 12.5,
                  borderColor: p.correta === k ? '#28a06066' : T.border }} />
              {p.opcoes.length > MIN_OPCOES && (
                <button className="mm-btn" onClick={() => delOpcao(i, k)} title="Remover alternativa"
                  style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent',
                    color: T.textD, cursor: 'pointer' }}><IcoX size={13} /></button>
              )}
            </div>
          ))}
          {p.opcoes.length < MAX_OPCOES && (
            <button className="mm-btn" onClick={() => addOpcao(i)}
              style={{ marginLeft: 32, marginTop: 3, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700,
                border: `1px dashed ${T.border}`, background: 'transparent', color: T.textT, cursor: 'pointer' }}>
              + alternativa
            </button>
          )}
        </div>
      ))}

      {perguntas.length < MAX_PERGUNTAS && (
        <button className="mm-btn" onClick={addPergunta}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, fontSize: 13,
            fontWeight: 700, border: `1.5px dashed ${MMC.azul}66`, background: `${MMC.azul}0d`, color: MMC.azul,
            cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <IcoMais size={15} />Adicionar pergunta
        </button>
      )}

      {erro && (
        <div className="mm-pop" style={{ marginTop: 13, padding: '9px 12px', borderRadius: 9, fontSize: 12.5,
          background: '#E6394614', border: '1px solid #E6394644', color: '#E63946', fontWeight: 600 }}>{erro}</div>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
        <button className="mm-btn" onClick={salvar} disabled={salvando}
          style={{ padding: '11px 24px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800,
            cursor: salvando ? 'wait' : 'pointer',
            background: `linear-gradient(135deg, ${MMC.azul}, ${MMC.azulL})`, boxShadow: `0 6px 18px ${MMC.azul}44` }}>
          {salvando ? 'Salvando...' : 'Agendar quiz'}
        </button>
        <button className="mm-btn" onClick={onCancelar}
          style={{ padding: '11px 18px', borderRadius: 999, border: `1px solid ${T.border}`, background: 'transparent',
            color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RESPONDER — uma pergunta por vez; confere tudo no fim (no banco).
   ═══════════════════════════════════════════════════════════════════════════ */
const Responder = ({ quiz, onSair, onVencedor }) => {
  const [perguntas, setPerguntas] = useState(null);
  const [erro, setErro] = useState('');
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);   // {acertou, erradas, ganhou, vencedor}
  const nome = useMemo(() => meuNome(), []);
  const cardBg = T.surface || '#fff';

  useEffect(() => {
    let vivo = true;
    supabase.rpc('mm_quiz_abrir', { p_quiz: quiz.id }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setErro(semTabela(error) ? 'Falta rodar supabase_quiz_mm.sql.' : 'Não deu pra abrir o quiz.'); return; }
      if (data?.erro) { setErro(data.erro); return; }
      setPerguntas(data?.perguntas || []);
      setRespostas(new Array((data?.perguntas || []).length).fill(null));
    });
    return () => { vivo = false; };
  }, [quiz.id]);

  const escolher = (k) => setRespostas(r => r.map((v, j) => (j === i ? k : v)));
  const enviar = async () => {
    setEnviando(true);
    const { data, error } = await supabase.rpc('mm_quiz_responder', {
      p_quiz: quiz.id, p_player: nome, p_respostas: respostas,
    });
    setEnviando(false);
    if (error || data?.erro) { setErro('Não deu pra enviar. Tente de novo.'); return; }
    setResultado(data);
    if (data?.vencedor) onVencedor?.();
  };
  const refazer = () => { setResultado(null); setI(0); setRespostas(new Array(perguntas.length).fill(null)); };

  if (erro) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <Boneco size={110} />
      <div style={{ fontSize: 14, color: T.textT, marginTop: 16 }}>{erro}</div>
      <button className="mm-btn" onClick={onSair} style={{ marginTop: 14, padding: '9px 18px', borderRadius: 999,
        border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontWeight: 700, cursor: 'pointer' }}>Voltar</button>
    </div>
  );
  if (!perguntas) return <div style={{ textAlign: 'center', padding: 60, color: T.textD }}>Abrindo o quiz...</div>;

  /* ── Resultado ── */
  if (resultado) {
    const ganhou = resultado.ganhou;
    const acertouMasPerdeu = resultado.acertou && !ganhou;
    return (
      <div className="mm-pop" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center',
        background: cardBg, border: `1px solid ${T.border}`, borderRadius: 18, padding: 28, boxShadow: T.sh }}>
        {ganhou ? (
          <>
            <Boneco size={150} />
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 26, fontWeight: 800, color: T.text, marginTop: 10 }}>
              🏆 Você ganhou!
            </div>
            <div style={{ fontSize: 14, color: T.textT, marginTop: 8, lineHeight: 1.6 }}>
              Acertou todas em primeiro lugar. O prêmio é seu:
            </div>
            <div className="mm-premio" style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, marginTop: 8 }}>
              {quiz.premio}
            </div>
            <div style={{ fontSize: 12, color: T.textT, marginTop: 14 }}>Fale com o M&M pra receber 😎</div>
          </>
        ) : acertouMasPerdeu ? (
          <>
            <Boneco size={120} halo={false} />
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 21, fontWeight: 800, color: T.text, marginTop: 10 }}>
              Acertou tudo! Mas...
            </div>
            <div style={{ fontSize: 14, color: T.textT, marginTop: 8, lineHeight: 1.6 }}>
              <b style={{ color: T.text }}>{resultado.vencedor?.split(' ')[0]}</b> chegou primeiro e levou o prêmio.
              Fica pro próximo! 🏃
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 46 }}>🤔</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 21, fontWeight: 800, color: T.text, marginTop: 6 }}>
              Ainda não!
            </div>
            <div style={{ fontSize: 14, color: T.textT, marginTop: 8, lineHeight: 1.6 }}>
              Você errou <b style={{ color: '#E63946' }}>{resultado.erradas}</b>{' '}
              {resultado.erradas === 1 ? 'pergunta' : 'perguntas'}.
              {resultado.vencedor
                ? <> E <b style={{ color: T.text }}>{resultado.vencedor.split(' ')[0]}</b> já levou o prêmio.</>
                : ' Dá pra tentar de novo — ninguém ganhou ainda!'}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 20 }}>
          {!resultado.acertou && !resultado.vencedor && (
            <button className="mm-btn" onClick={refazer}
              style={{ padding: '11px 24px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', background: `linear-gradient(135deg, ${MMC.azul}, ${MMC.azulL})`,
                boxShadow: `0 6px 18px ${MMC.azul}44` }}>
              Tentar de novo
            </button>
          )}
          <button className="mm-btn" onClick={onSair}
            style={{ padding: '11px 20px', borderRadius: 999, border: `1px solid ${T.border}`, background: 'transparent',
              color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  /* ── Perguntas, uma por vez ── */
  const p = perguntas[i];
  const ultima = i === perguntas.length - 1;
  const respondidas = respostas.filter(r => r !== null).length;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* progresso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 99, background: T.surfaceSub || 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ width: `${(respondidas / perguntas.length) * 100}%`, height: '100%', borderRadius: 99,
            background: `linear-gradient(90deg, ${MMC.azul}, ${MMC.azulL})`, transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: T.textT, whiteSpace: 'nowrap' }}>
          {i + 1} / {perguntas.length}
        </span>
      </div>

      <div key={i} className="mm-fade" style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 22, boxShadow: T.sh }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text,
          lineHeight: 1.4, marginBottom: 16 }}>
          {p.q}
        </div>
        {p.opcoes.map((o, k) => {
          const sel = respostas[i] === k;
          return (
            <button key={k} className="mm-btn" onClick={() => escolher(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '12px 14px', borderRadius: 11, marginBottom: 8, cursor: 'pointer', fontSize: 14,
                fontWeight: sel ? 700 : 500, color: T.text,
                border: `2px solid ${sel ? MMC.azul : T.border}`,
                background: sel ? `${MMC.azul}12` : 'transparent' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${sel ? MMC.azul : T.border}`, background: sel ? MMC.azul : 'transparent',
                color: sel ? '#fff' : T.textT }}>
                {String.fromCharCode(65 + k)}
              </span>
              {o}
            </button>
          );
        })}

        <div style={{ display: 'flex', gap: 9, marginTop: 16, alignItems: 'center' }}>
          {i > 0 && (
            <button className="mm-btn" onClick={() => setI(i - 1)}
              style={{ padding: '10px 16px', borderRadius: 999, border: `1px solid ${T.border}`, background: 'transparent',
                color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Voltar
            </button>
          )}
          <div style={{ flex: 1 }} />
          {!ultima ? (
            <button className="mm-btn" onClick={() => setI(i + 1)} disabled={respostas[i] === null}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 999, border: 'none',
                color: '#fff', fontSize: 13.5, fontWeight: 800,
                cursor: respostas[i] === null ? 'not-allowed' : 'pointer',
                background: respostas[i] === null ? T.textD : `linear-gradient(135deg, ${MMC.azul}, ${MMC.azulL})` }}>
              Próxima <IcoSeta size={14} />
            </button>
          ) : (
            <button className="mm-btn" onClick={enviar} disabled={respostas.some(r => r === null) || enviando}
              style={{ padding: '11px 26px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800,
                cursor: (respostas.some(r => r === null) || enviando) ? 'not-allowed' : 'pointer',
                background: (respostas.some(r => r === null) || enviando) ? T.textD : `linear-gradient(135deg, #28a060, #34c97a)`,
                boxShadow: respostas.some(r => r === null) ? 'none' : '0 6px 18px #28a06044' }}>
              {enviando ? 'Enviando...' : 'Enviar respostas'}
            </button>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button onClick={onSair} style={{ background: 'none', border: 'none', color: T.textT, fontSize: 12,
          cursor: 'pointer', textDecoration: 'underline' }}>Sair do quiz</button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RAIZ
   ═══════════════════════════════════════════════════════════════════════════ */
const TabQuizMM = () => {
  const [quizzes, setQuizzes] = useState(null);
  const [criando, setCriando] = useState(false);
  const [jogando, setJogando] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [faltaSql, setFaltaSql] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const podeCriar = useMemo(() => podeCriarQuiz(), []);
  const nome = useMemo(() => meuNome(), []);
  const cardBg = T.surface || '#fff';
  const vivoRef = useRef(true);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('mm_quiz')
      .select('*').order('lanca_em', { ascending: false }).limit(20);
    if (!vivoRef.current) return;
    if (semTabela(error)) { setFaltaSql(true); return; }
    if (error) { console.error('[quiz-mm]', error.message); return; }
    setQuizzes(data || []);
  }, []);

  useEffect(() => {
    vivoRef.current = true;
    // `carregar` é async: o setState só roda depois do await, nunca síncrono no
    // effect — o compiler não distingue e acusa cascata de render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    const ch = supabase.channel('mm-quiz')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm_quiz' }, carregar)
      .subscribe();
    const poll = setInterval(carregar, 10_000);          // fallback do realtime
    const tick = setInterval(() => setAgora(Date.now()), 1000);  // contagem regressiva
    return () => { vivoRef.current = false; supabase.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, [carregar]);

  const excluir = async (id) => {
    setConfirmDel(null);
    await supabase.from('mm_quiz').delete().eq('id', id);   // conteúdo cai junto (cascade)
    carregar();
  };

  if (faltaSql) return (
    <div style={{ maxWidth: 620, margin: '40px auto', background: cardBg, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: T.sh }}>
      <style>{MM_CSS}</style>
      <Boneco size={130} style={{ margin: '0 auto' }} />
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, margin: '14px 0 8px' }}>
        Falta rodar a migração
      </div>
      <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.6 }}>
        O Quiz do M&M precisa das tabelas dele. Rode <b style={{ color: T.text }}>supabase_quiz_mm.sql</b> no
        SQL Editor do Supabase e recarregue esta página.
      </div>
    </div>
  );

  if (criando) return (
    <>
      <style>{MM_CSS}</style>
      <CriarQuiz onPronto={() => { setCriando(false); carregar(); }} onCancelar={() => setCriando(false)} />
    </>
  );

  if (jogando) return (
    <>
      <style>{MM_CSS}</style>
      <Responder quiz={jogando} onSair={() => { setJogando(null); carregar(); }} onVencedor={carregar} />
    </>
  );

  const abertos = (quizzes || []).filter(q => new Date(q.lanca_em).getTime() <= agora);
  const agendados = (quizzes || []).filter(q => new Date(q.lanca_em).getTime() > agora);
  const emJogo = abertos.filter(q => !q.vencedor);
  const encerrados = abertos.filter(q => q.vencedor);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 20 }}>
      <style>{MM_CSS}</style>

      {/* Cabeçalho com o M&M em destaque */}
      <div style={{ borderRadius: 18, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 20,
        background: `linear-gradient(120deg, ${MMC.escuro} 0%, #232c3d 45%, ${MMC.azul} 140%)`,
        boxShadow: `0 12px 34px rgba(0,0,0,.28)`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .5, pointerEvents: 'none',
          background: `radial-gradient(circle at 8% 20%, ${MMC.azul}55 0%, transparent 42%),
                       radial-gradient(circle at 92% 90%, ${MMC.prata}22 0%, transparent 40%)` }} />
        <Boneco size={116} />
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 27, fontWeight: 800, color: '#fff',
            letterSpacing: '.01em', textShadow: '0 3px 14px rgba(0,0,0,.5)' }}>
            Quiz do M&M
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)', marginTop: 4, lineHeight: 1.5 }}>
            O M&M monta o quiz e escolhe o prêmio. Quando lança, é corrida:{' '}
            <b style={{ color: MMC.ouro }}>quem acertar todas primeiro leva</b>.
          </div>
        </div>
        {podeCriar && (
          <button className="mm-btn" onClick={() => setCriando(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', borderRadius: 999, border: 'none',
              background: `linear-gradient(135deg, ${MMC.prataL}, ${MMC.prata})`, color: MMC.escuro,
              fontSize: 13.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 5px 16px rgba(0,0,0,.3)',
              position: 'relative', whiteSpace: 'nowrap' }}>
            <IcoMais size={15} />Criar quiz
          </button>
        )}
      </div>

      {quizzes === null ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.textD }}>Carregando...</div>
      ) : !quizzes.length ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', background: cardBg, borderRadius: 16,
          border: `1px solid ${T.border}`, boxShadow: T.sh }}>
          <Boneco size={110} style={{ margin: '0 auto' }} />
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text, marginTop: 14 }}>
            Nenhum quiz por aqui ainda
          </div>
          <div style={{ fontSize: 13, color: T.textT, marginTop: 6 }}>
            {podeCriar ? 'Monte o primeiro e escolha o prêmio 😎' : 'Fique de olho — o M&M vai soltar um em breve.'}
          </div>
        </div>
      ) : (
        <>
          {/* ── Abertos agora ── */}
          {emJogo.map(q => (
            <div key={q.id} className="mm-fade" style={{ background: cardBg, borderRadius: 16, padding: 20,
              border: `2px solid ${MMC.azul}55`, boxShadow: `0 8px 26px ${MMC.azul}1e`, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="mm-pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 999, background: '#28a06018', color: '#28a060',
                    fontSize: 10.5, fontWeight: 800, marginBottom: 7 }}>
                    ● NO AR AGORA
                  </div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text }}>
                    {q.titulo}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, fontSize: 13.5 }}>
                    <IcoTrofeu size={15} style={{ color: MMC.ouro }} />
                    <span style={{ color: T.textT }}>Prêmio:</span>
                    <b style={{ color: T.text }}>{q.premio}</b>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textT, marginTop: 4 }}>
                    {q.total} {q.total === 1 ? 'pergunta' : 'perguntas'} · por {q.criador?.split(' ')[0]}
                  </div>
                </div>
                <button className="mm-btn" onClick={() => setJogando(q)}
                  style={{ padding: '13px 30px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 15,
                    fontWeight: 800, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${MMC.azul}, ${MMC.azulL})`, boxShadow: `0 7px 20px ${MMC.azul}55` }}>
                  Responder agora
                </button>
                {podeCriar && (
                  <button className="mm-btn" onClick={() => setConfirmDel(q.id)} title="Excluir quiz"
                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`,
                      background: 'transparent', color: T.textT, cursor: 'pointer' }}><IcoLixo size={15} /></button>
                )}
              </div>
              {confirmDel === q.id && (
                <div className="mm-pop" style={{ position: 'absolute', inset: 0, borderRadius: 16, zIndex: 2,
                  background: 'rgba(255,255,255,.97)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, flexWrap: 'wrap', padding: 16 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A2E' }}>Excluir este quiz?</span>
                  <button className="mm-btn" onClick={() => excluir(q.id)} style={{ padding: '7px 16px', borderRadius: 8,
                    border: 'none', background: '#E63946', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
                  <button className="mm-btn" onClick={() => setConfirmDel(null)} style={{ padding: '7px 16px', borderRadius: 8,
                    border: '1px solid #d1d5db', background: 'transparent', color: '#374151', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                </div>
              )}
            </div>
          ))}

          {/* ── Agendados ── */}
          {agendados.map(q => {
            const falta = faltam(new Date(q.lanca_em).getTime() - agora);
            return (
              <div key={q.id} className="mm-fade" style={{ background: cardBg, borderRadius: 16, padding: 18,
                border: `1px solid ${T.border}`, boxShadow: T.sh, display: 'flex', alignItems: 'center',
                gap: 14, flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
                    background: `${MMC.azul}14`, color: MMC.azul, fontSize: 10.5, fontWeight: 800, marginBottom: 7 }}>
                    <IcoRelogio size={11} /> EM BREVE
                  </div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text }}>
                    {q.titulo}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13 }}>
                    <IcoTrofeu size={14} style={{ color: MMC.ouro }} />
                    <b style={{ color: T.text }}>{q.premio}</b>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mm-pulse" style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 800, color: MMC.azul }}>
                    {falta || 'já vai...'}
                  </div>
                  <div style={{ fontSize: 11, color: T.textT }}>abre {fmtData(q.lanca_em)}</div>
                </div>
                {podeCriar && (
                  <button className="mm-btn" onClick={() => setConfirmDel(q.id)} title="Excluir quiz"
                    style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`,
                      background: 'transparent', color: T.textT, cursor: 'pointer' }}><IcoLixo size={14} /></button>
                )}
                {confirmDel === q.id && (
                  <div className="mm-pop" style={{ position: 'absolute', inset: 0, borderRadius: 16, zIndex: 2,
                    background: 'rgba(255,255,255,.97)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 10, flexWrap: 'wrap', padding: 16 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A2E' }}>Excluir este quiz?</span>
                    <button className="mm-btn" onClick={() => excluir(q.id)} style={{ padding: '7px 16px', borderRadius: 8,
                      border: 'none', background: '#E63946', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
                    <button className="mm-btn" onClick={() => setConfirmDel(null)} style={{ padding: '7px 16px', borderRadius: 8,
                      border: '1px solid #d1d5db', background: 'transparent', color: '#374151', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Encerrados ── */}
          {encerrados.length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.08em', marginTop: 6 }}>
                JÁ ROLARAM
              </div>
              {encerrados.map(q => {
                const euGanhei = q.vencedor === nome;
                return (
                  <div key={q.id} style={{ background: cardBg, borderRadius: 14, padding: '14px 18px',
                    border: `1px solid ${euGanhei ? `${MMC.ouro}77` : T.border}`, boxShadow: T.sh,
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', opacity: euGanhei ? 1 : .85 }}>
                    <span style={{ fontSize: 22 }}>{euGanhei ? '🏆' : '✅'}</span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>{q.titulo}</div>
                      <div style={{ fontSize: 12, color: T.textT, marginTop: 2 }}>
                        <b style={{ color: euGanhei ? MMC.ouro : T.text }}>
                          {euGanhei ? 'Você' : q.vencedor?.split(' ')[0]}
                        </b>{' '}
                        levou <b style={{ color: T.text }}>{q.premio}</b>
                        {q.vencedor_em && ` · ${fmtData(q.vencedor_em)}`}
                      </div>
                    </div>
                    {podeCriar && (
                      <button className="mm-btn" onClick={() => setConfirmDel(q.id)} title="Excluir quiz"
                        style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${T.border}`,
                          background: 'transparent', color: T.textD, cursor: 'pointer' }}><IcoLixo size={13} /></button>
                    )}
                    {confirmDel === q.id && (
                      <div className="mm-pop" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                        <button className="mm-btn" onClick={() => excluir(q.id)} style={{ padding: '5px 12px', borderRadius: 7,
                          border: 'none', background: '#E63946', color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
                        <button className="mm-btn" onClick={() => setConfirmDel(null)} style={{ padding: '5px 12px', borderRadius: 7,
                          border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Não</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
};

export { TabQuizMM };
export default TabQuizMM;
