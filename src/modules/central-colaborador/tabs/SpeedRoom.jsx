// src/modules/central-colaborador/tabs/SpeedRoom.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO SPEED — MULTIPLAYER: salas com código pra competir com os colegas.
//
// Mesma arquitetura já em produção no Uniko Paint (TabUnikoPaint.jsx) — sem
// nenhum servidor de jogo dedicado:
//   • Uma tabela (`uniko_speed_state`), uma linha por sala, lida com
//     postgres_changes + poll de reforço.
//   • Presence (quem está em cada sala) + um canal de BROADCAST por sala pra
//     posição dos carros (efêmero, nunca toca no banco — ver Corrida/onPosTick).
//   • Host eleito de forma DETERMINÍSTICA (mesmo cliente decide igual em toda
//     tela): quem criou a sala manda enquanto estiver presente; se sair, quem
//     entrou primeiro; nome só desempata. NÃO usar "menor nome alfabético"
//     como regra principal (bug já corrigido no Paint: deixava o host trocar
//     sozinho no meio da partida).
//
// FASES DA SALA (deliberadamente só DUAS, mais simples que o plano original
// de 4 fases — "countdown" não precisa existir no banco porque a Corrida já
// desenha o "3,2,1,JÁ!" sozinha a partir de um `countdownEndsAt` compartilhado):
//   'waiting'  — lobby da sala, esperando o host apertar "Iniciar corrida"
//   'racing'   — corrida rolando; cada cliente decide sozinho quando A SUA
//                própria corrida termina (a pista/duração são idênticas pra
//                todos, então "quem terminou" não precisa ser sincronizado)
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, getAuthUser, USER } from '../../../contexts/user';
import { Corrida, TRACADOS, MAPAS, MAPA_PADRAO, TRACADO_PADRAO, TRILHAS, hashSeed, PreviaPista,
  CARROS, getCarroEscolhido } from './TabUnikoFaster';

const TABLE = 'uniko_speed_state';
const GERAL = 'geral';
const ROOM_TTL_MS = 20 * 60_000;      // sala vazia e parada há mais de 20min é lixo
const COUNTDOWN_MS = 3200;            // mesma duração do "3,2,1,JÁ!" do solo
// tamanho do grid (humanos + bots até completar) é decidido dentro de Corrida,
// a partir de `humanPlayers.length` — nada pra configurar aqui.
const LAP_OPTIONS = [1, 2, 3, 5];
const DEFAULT_LAPS = 2;

const meuNome = () => (getAuthUser()?.name || USER?.name || 'Piloto').trim();

// PostgREST devolve PGRST205 ("Could not find the table") pra tabela ausente,
// não o 42P01 cru do Postgres — aceita os dois (mesmo helper do Uniko Paint).
const semTabela = (erro) => !!erro && (erro.code === 'PGRST205' || erro.code === '42P01'
  || /Could not find the table|does not exist/i.test(erro.message || ''));

const gerarCodigo = () => Math.random().toString(36).slice(2, 8);

const ACCENT = '#22d3ee';
const btnPrimario = { padding: '11px 22px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800,
  fontSize: 14, cursor: 'pointer', background: 'linear-gradient(135deg,#7c3aed,#db2777)' };
const btnGhost = { padding: '10px 20px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,.25)',
  color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', background: 'rgba(255,255,255,.06)' };
const cardSt = { borderRadius: 16, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', padding: 18 };
const inputSt = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.18)',
  background: 'rgba(0,0,0,.25)', color: '#fff', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' };

/* ═══════════════════════════════════════════════════════════════════════════
   RAIZ — alterna entre o Lobby (lista de salas) e a Sala escolhida. Sair de
   uma sala é só desmontar <Sala/> (mesmo truque do Uniko Paint: reseta canais
   e estado de graça, sem precisar limpar nada manualmente).
   ═══════════════════════════════════════════════════════════════════════════ */
export default function SpeedRoom({ onSair }) {
  const [sqlMissing, setSqlMissing] = useState(false);
  const [checando, setChecando] = useState(true);
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    supabase.from(TABLE).select('id').limit(1).then(({ error }) => {
      if (semTabela(error)) setSqlMissing(true);
      setChecando(false);
    });
  }, []);

  // position:'relative' (não 'absolute') de propósito: o pai (rootRef, em
  // TabUnikoFaster.jsx) não define position nenhum, então um filho absolute
  // aqui ancorava num ancestral mais acima na árvore (o container da aba no
  // Portal) em vez desta tela — é isso que cortava os botões pela margem.
  // 'relative' + 100%/100% se auto-contém, igual ao que a <Corrida> já faz.
  const shellSt = { position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: 'radial-gradient(ellipse at 50% -10%, #241a4a, #0a0616 60%)', color: '#fff',
    fontFamily: 'var(--font-body)', overflow: 'hidden' };

  if (checando) {
    return <div style={shellSt}><div style={{ margin: 'auto', color: 'rgba(255,255,255,.6)' }}>Carregando…</div></div>;
  }
  if (sqlMissing) {
    return (
      <div style={shellSt}>
        <div style={{ margin: 'auto', maxWidth: 460, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛠️</div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, marginBottom: 8 }}>
            Falta configurar o multiplayer
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.75)', lineHeight: 1.6, marginBottom: 18 }}>
            Peça pro admin rodar <code style={{ background: 'rgba(0,0,0,.35)', padding: '2px 6px', borderRadius: 6 }}>supabase_uniko_speed.sql</code> no
            SQL Editor do Supabase — depois disso essa tela funciona sozinha.
          </div>
          <button style={btnGhost} onClick={onSair}>◂ Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={shellSt}>
      {roomId
        ? <Sala roomId={roomId} onSairDaSala={() => setRoomId(null)} onSairApp={onSair} />
        : <Lobby onEntrar={setRoomId} onSair={onSair} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY — lista/cria/entra em salas. Estrutura quase idêntica ao Lobby do
   Uniko Paint (TabUnikoPaint.jsx), só trocando "tema de desenho" por
   "traçado/mapa/música/voltas" na criação.
   ═══════════════════════════════════════════════════════════════════════════ */
function Lobby({ onEntrar, onSair }) {
  const [rooms, setRooms] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(TABLE).select('id, state, updated_at').order('updated_at', { ascending: false });
    if (error) { console.error('[uniko-speed] lobby:', error); setCarregando(false); return; }
    setRooms(data || []);
    setCarregando(false);
    // Faxina: sala (que não a Geral) parada e sem ninguém dentro há >20min é lixo.
    // Não sabemos "quem está dentro" sem presence — critério mais simples e
    // seguro aqui: só apaga sala em 'waiting' (nunca uma em 'racing') parada
    // há muito tempo, já que uma corrida em andamento nunca deveria ser
    // apagada por engano por quem só está olhando o lobby.
    const velhas = (data || []).filter(r => r.id !== GERAL && r.state?.phase === 'waiting'
      && Date.now() - new Date(r.updated_at).getTime() > ROOM_TTL_MS);
    if (velhas.length) {
      await supabase.from(TABLE).delete().in('id', velhas.map(r => r.id));
      setRooms(rs => rs.filter(r => !velhas.some(v => v.id === r.id)));
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('uniko-speed-lobby-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, load)
      .subscribe();
    const poll = setInterval(load, 5000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [load]);

  const excluirSala = async (id) => {
    if (id === GERAL) return;
    if (!window.confirm('Excluir esta sala?')) return;
    await supabase.from(TABLE).delete().eq('id', id);
    await load();
  };

  return (
    <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '26px 22px 40px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <button style={{ ...btnGhost, flexShrink: 0 }} onClick={onSair}>◂ Voltar</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 22 }}>Uniko Speed — Multiplayer</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)' }}>Entre numa sala ou crie a sua e chame os colegas.</div>
          </div>
          <button style={{ ...btnPrimario, marginLeft: 'auto', flexShrink: 0 }} onClick={() => setCriando(true)}>＋ Nova sala</button>
        </div>

        {carregando ? (
          <div style={{ textAlign: 'center', padding: 50, color: 'rgba(255,255,255,.5)' }}>Carregando salas…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
            {rooms.map(r => (
              <div key={r.id} style={cardSt}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#7c3aed,#db2777)',
                    display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>🏁</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.state?.nome || (r.id === GERAL ? 'Sala Geral' : r.id)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>
                      {r.state?.phase === 'racing' ? '🏎️ Corrida em andamento' : 'Esperando corredores'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button style={{ ...btnPrimario, flex: 1, padding: '8px 0', fontSize: 12.5 }} onClick={() => onEntrar(r.id)}>Entrar</button>
                  {r.id !== GERAL && (
                    <button style={{ ...btnGhost, padding: '8px 12px', fontSize: 12.5 }} onClick={() => excluirSala(r.id)} title="Excluir sala">🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {criando && (
        <CriarSalaModal onFechar={() => setCriando(false)} onCriada={(id) => { setCriando(false); onEntrar(id); }} erro={erro} setErro={setErro} />
      )}
    </div>
  );
}

function CriarSalaModal({ onFechar, onCriada, erro, setErro }) {
  const [nome, setNome] = useState(`Sala do ${meuNome().split(' ')[0]}`);
  const [tracado, setTracado] = useState(TRACADO_PADRAO);
  const [mapa, setMapa] = useState(MAPA_PADRAO);
  const [trilhaIdx, setTrilhaIdx] = useState(0);
  const [laps, setLaps] = useState(DEFAULT_LAPS);
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    const n = nome.trim(); if (!n) return;
    setSalvando(true); setErro('');
    const id = gerarCodigo();
    const trilha = TRILHAS[trilhaIdx];
    const { error } = await supabase.from(TABLE).insert({
      id, state: { phase: 'waiting', nome: n, criador: meuNome(), tracado, mapa, trilha, laps, raceCounter: 0 },
    });
    setSalvando(false);
    if (error) { setErro('Não deu pra criar a sala. Tente de novo.'); console.error('[uniko-speed] criar:', error); return; }
    onCriada(id);
  };

  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 90 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardSt, width: 'min(480px, 92vw)', maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 17, marginBottom: 16 }}>Nova sala</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', marginBottom: 5 }}>NOME DA SALA</div>
        <input value={nome} onChange={e => setNome(e.target.value)} style={inputSt} />

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', margin: '14px 0 6px' }}>TRAÇADO</div>
        <PreviaPista tracado={tracado} cor={ACCENT} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {TRACADOS.map(t => (
            <button key={t.id} onClick={() => setTracado(t.id)}
              style={{ padding: '6px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: tracado === t.id ? `1.5px solid ${ACCENT}` : '1px solid rgba(255,255,255,.2)',
                background: tracado === t.id ? `${ACCENT}22` : 'transparent', color: '#fff' }}>
              {t.emoji} {t.nome}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', margin: '14px 0 6px' }}>MAPA</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.values(MAPAS).map(m => (
            <button key={m.id} onClick={() => setMapa(m.id)}
              style={{ padding: '6px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: mapa === m.id ? `1.5px solid ${ACCENT}` : '1px solid rgba(255,255,255,.2)',
                background: mapa === m.id ? `${ACCENT}22` : 'transparent', color: '#fff' }}>
              {m.emoji} {m.nome}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', margin: '14px 0 6px' }}>MÚSICA</div>
        <select value={trilhaIdx} onChange={e => setTrilhaIdx(Number(e.target.value))} style={inputSt}>
          {TRILHAS.map((t, i) => <option key={t.vid} value={i}>{t.title}</option>)}
        </select>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', margin: '14px 0 6px' }}>VOLTAS</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {LAP_OPTIONS.map(n => (
            <button key={n} onClick={() => setLaps(n)}
              style={{ minWidth: 40, padding: '7px 0', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                border: laps === n ? `1.5px solid ${ACCENT}` : '1px solid rgba(255,255,255,.2)',
                background: laps === n ? `${ACCENT}22` : 'transparent', color: '#fff' }}>
              {n}×
            </button>
          ))}
        </div>

        {erro && <div style={{ fontSize: 12.5, color: '#f87171', marginTop: 12, fontWeight: 600 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button style={{ ...btnGhost, flex: 1 }} onClick={onFechar}>Cancelar</button>
          <button style={{ ...btnPrimario, flex: 1, opacity: nome.trim() ? 1 : .5 }} disabled={salvando || !nome.trim()} onClick={criar}>
            {salvando ? 'Criando…' : 'Criar sala'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Config da corrida, editável pelo host dentro da sala de espera (não só
   na criação) — é isso que corrige a Sala Geral: ela nasce sem traçado/mapa/
   música/voltas definidos (linha semeada só com phase/nome), e sem uma forma
   de configurar isso DEPOIS de criada, a corrida caía sempre nos valores
   padrão escondidos dentro da Corrida — inclusive o nº de voltas, que sem
   valor nenhum nunca fazia a corrida terminar (ficava "presa" contando volta
   atrás de volta). Cada clique grava direto na sala (pushState). ── */
function ConfigCorrida({ state, onMudar }) {
  const tracado = state?.tracado ?? TRACADO_PADRAO;
  const mapa = state?.mapa || MAPA_PADRAO;
  const laps = state?.laps || DEFAULT_LAPS;
  const trilhaIdx = Math.max(0, TRILHAS.findIndex(t => t.vid === state?.trilha?.vid));
  const pillSt = (ativo) => ({
    padding: '6px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    border: ativo ? `1.5px solid ${ACCENT}` : '1px solid rgba(255,255,255,.2)',
    background: ativo ? `${ACCENT}22` : 'transparent', color: '#fff',
  });
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.14)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.55)', marginBottom: 8 }}>
        CONFIGURAR CORRIDA (host)
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {TRACADOS.map(t => (
          <button key={t.id} style={pillSt(tracado === t.id)} onClick={() => onMudar({ tracado: t.id })}>{t.emoji} {t.nome}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.values(MAPAS).map(m => (
          <button key={m.id} style={pillSt(mapa === m.id)} onClick={() => onMudar({ mapa: m.id })}>{m.emoji} {m.nome}</button>
        ))}
      </div>
      <select value={trilhaIdx} onChange={e => onMudar({ trilha: TRILHAS[Number(e.target.value)] })}
        style={{ ...inputSt, marginBottom: 10 }}>
        {TRILHAS.map((t, i) => <option key={t.vid} value={i}>{t.title}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6 }}>
        {LAP_OPTIONS.map(n => (
          <button key={n} style={{ ...pillSt(laps === n), minWidth: 40, padding: '7px 0', textAlign: 'center' }}
            onClick={() => onMudar({ laps: n })}>{n}×</button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALA — depois de entrar: espera na sala (phase 'waiting') ou corrida rolando
   (phase 'racing'). Dona da presence, do canal de posição e da eleição de host.
   ═══════════════════════════════════════════════════════════════════════════ */
function Sala({ roomId, onSairDaSala, onSairApp }) {
  const nome = meuNome();
  const [state, setState] = useState(null);
  const [players, setPlayers] = useState([]);       // presence: quem está NESTA sala agora
  const [iniciando, setIniciando] = useState(false);
  const [meuFimHouve, setMeuFimHouve] = useState(false);   // pra liberar "Nova corrida" pro host

  const stateRef = useRef(null);
  const entrouEmRef = useRef(Date.now());
  const remoteRivaisRef = useRef({});      // name -> último pacote de posição recebido
  const chanRef = useRef(null);            // canal de broadcast (posição)

  // HUD/recorde da Corrida — precisam existir INCONDICIONALMENTE aqui em cima
  // (não dentro do JSX condicional abaixo), senão o nº de hooks chamados muda
  // entre um render em 'waiting' e um em 'racing' e quebra o React. `uf_best`
  // é o MESMO recorde local do solo — multiplayer também atualiza ele.
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('uf_best') || 0); } catch { return 0; } });
  const bestRef = useRef(best);
  const [hud, setHud] = useState({ vel: 0, dist: 0, best, rank: 1, nitro: 1, volta: 1, boost: false, campo: 0 });
  const [pausado, setPausado] = useState(false);

  /* ── Estado da sala: postgres_changes + poll, com guarda de `ts` (mesmo
     motivo do Uniko Paint: uma resposta atrasada do banco pode "rebobinar" a
     sala pra fase anterior se não descartarmos estado mais velho). ── */
  const aplicaEstado = useCallback((st) => {
    if (!st) return;
    const atual = stateRef.current;
    if (atual?.ts != null && st.ts != null && st.ts < atual.ts) return;   // atrasado — descarta
    stateRef.current = st; setState(st);
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from(TABLE).select('state').eq('id', roomId).maybeSingle();
    if (data?.state) aplicaEstado(data.state);
  }, [roomId, aplicaEstado]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`uniko-speed-state-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${roomId}` },
        ({ new: row }) => aplicaEstado(row?.state))
      .subscribe();
    const poll = setInterval(load, 4000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [roomId, load]);

  const pushState = useCallback(async (patch) => {
    const base = stateRef.current || {};
    const ts = (base.ts || 0) + 1;
    const novo = { ...base, ...patch, ts };
    aplicaEstado(novo);   // otimista — não espera o round-trip
    await supabase.from(TABLE).update({ state: novo, updated_at: new Date().toISOString() }).eq('id', roomId);
  }, [roomId, aplicaEstado]);

  /* ── Presence: quem está NESTA sala. Canal recriado sempre que nome/sala
     mudam — NUNCA um track() novo no mesmo canal, porque ele não propaga pros
     outros clientes (bug já medido e corrigido no Uniko Paint). ── */
  useEffect(() => {
    const ch = supabase.channel('uniko-speed-presence', { config: { presence: { key: nome } } });
    const refresh = () => {
      const list = Object.values(ch.presenceState())
        .map(arr => arr[arr.length - 1])   // a ÚLTIMA entrada de cada key, nunca a primeira
        .filter(Boolean)
        .filter(p => p.room === roomId);
      const seen = new Set();
      setPlayers(list.filter(p => p?.name && (seen.has(p.name) ? false : (seen.add(p.name), true))));
    };
    ch.on('presence', { event: 'sync' }, refresh)
      .on('presence', { event: 'join' }, refresh)
      .on('presence', { event: 'leave' }, refresh)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        // `carro` é só o ID curto (ex.: 'kawaii'), nunca a imagem em si — mesma
        // regra do Uniko Paint pra payload de presence (nunca um blob grande).
        const r = await ch.track({ name: nome, room: roomId, entrouEm: entrouEmRef.current, carro: getCarroEscolhido().id });
        if (r !== 'ok') console.error('[uniko-speed] presence track falhou:', r);
      });
    const poll = setInterval(refresh, 2000);   // rede de segurança (é leitura LOCAL, não vai à rede)
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [nome, roomId]);

  /* ── Host: criador manda enquanto presente; senão, quem entrou primeiro;
     nome só desempata. NÃO usar "menor nome alfabético" como regra principal
     (ver comentário no topo do arquivo). ── */
  const host = useMemo(() => {
    if (!players.length) return undefined;
    const criador = state?.criador;
    if (criador && players.some(p => p.name === criador)) return criador;
    return [...players].sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name))[0]?.name;
  }, [players, state?.criador]);
  const isHost = host === nome;

  /* ── Canal de broadcast da sala: posição de cada carro (efêmero). Só marca
     `chanRef.current` DEPOIS de 'SUBSCRIBED' — mandar (`send`) num canal que
     ainda não terminou de inscrever pode ser descartado em silêncio pelo
     cliente do Supabase; melhor perder o 1º pacote (autocorrige no próximo,
     ~80ms depois) do que arriscar. Erro de inscrição vai pro console (mesmo
     cuidado do Uniko Paint com o retorno do `track()` da presence). ── */
  useEffect(() => {
    chanRef.current = null;
    const ch = supabase.channel(`uniko-speed-room-${roomId}`);
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload?.name || payload.name === nome) return;   // meu próprio pacote já está aplicado localmente
      remoteRivaisRef.current[payload.name] = { ...payload, recebidoEm: performance.now() };
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') chanRef.current = ch;
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.error('[uniko-speed] canal de posição da sala falhou:', status);
      }
    });
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
  }, [roomId, nome]);

  const onPosTick = useCallback((payload) => {
    chanRef.current?.send({ type: 'broadcast', event: 'pos', payload: { ...payload, name: nome } });
  }, [nome]);

  const onRaceEnd = useCallback(() => { setMeuFimHouve(true); }, []);

  /* ── Iniciar corrida (só o host): sorteia a seed compartilhada, monta a
     lista de jogadores (cada um com o PRÓPRIO carro, não mais um sorteio
     genérico de RIVAL_DEFS — isso é o que deixa dar pra diferenciar gente de
     bot só de olhar o carro) e grava tudo na sala de uma vez — é essa "foto"
     que vira `humanPlayers` pra TODO cliente, em vez de cada um derivar
     "quem está aqui" da própria presence (que pode divergir por alguns
     instantes entre clientes — a sala é a fonte única).
     IMPORTANTE: preenche tracado/mapa/trilha/laps com um padrão explícito
     aqui, mesmo que a sala já tenha algo salvo — a Sala Geral nasce sem
     nenhum desses campos (linha semeada só com phase/nome), e sem esse
     preenchimento a corrida nunca terminava no nº de voltas certo (laps
     ficava undefined e a condição de fim nunca virava verdadeira). ── */
  const iniciarCorrida = async () => {
    if (!isHost || iniciando) return;
    setIniciando(true);
    const raceCounter = (state?.raceCounter || 0) + 1;
    const tracado = state?.tracado ?? TRACADO_PADRAO;
    const mapa = state?.mapa || MAPA_PADRAO;
    const trilha = state?.trilha || TRILHAS[0];
    const laps = state?.laps || DEFAULT_LAPS;
    const seed = hashSeed(`${roomId}|${tracado}|${raceCounter}`);
    const jogadores = players.map(p => {
      const carro = CARROS.find(c => c.id === p.carro) || CARROS[0];
      return { name: p.name, cor: carro.cor, spr: carro.spr };
    });
    await pushState({
      phase: 'racing', raceCounter, seed, tracado, mapa, trilha, laps,
      countdownEndsAt: Date.now() + COUNTDOWN_MS,
      jogadores,
    });
    setMeuFimHouve(false);
    setIniciando(false);
  };

  // Sair da tela de corrida: o HOST encerra a corrida pra SALA TODA (grava
  // phase:'waiting', e todo mundo volta junto); qualquer outro jogador só sai
  // da SUA PRÓPRIA tela (saiLocalmente) — a sala continua 'racing' pros
  // demais, e ele volta a ver a tela de espera normalmente quando o host
  // iniciar a próxima corrida. Sem isso, o botão "Sair" não fazia NADA pra
  // quem não é host (só o host tem permissão de escrever o estado da sala).
  const [saiLocalmente, setSaiLocalmente] = useState(false);
  useEffect(() => { setSaiLocalmente(false); }, [state?.raceCounter]);   // nova corrida = reset
  const sairDaCorrida = async () => {
    if (isHost) await pushState({ phase: 'waiting' });
    else setSaiLocalmente(true);
  };

  const brd = 'rgba(255,255,255,.14)';

  // ── Corrida rolando: monta a mesma <Corrida> do solo, em modo multiplayer ──
  if (state?.phase === 'racing' && !saiLocalmente) {
    const humanPlayers = (state.jogadores || []).filter(p => p.name !== nome);
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Corrida
          multiplayer roomId={roomId} seed={state.seed} laps={state.laps}
          countdownEndsAt={state.countdownEndsAt} humanPlayers={humanPlayers}
          remoteRivaisRef={remoteRivaisRef} onPosTick={onPosTick} onRaceEnd={onRaceEnd}
          trilha={state.trilha} mapa={state.mapa || MAPA_PADRAO} tracado={state.tracado ?? TRACADO_PADRAO}
          bestRef={bestRef} setBest={setBest} hud={hud} setHud={setHud}
          pausado={pausado} setPausado={setPausado}
          onSair={sairDaCorrida} onReiniciar={() => {}}
        />
        {isHost && meuFimHouve && (
          <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
            <button style={btnPrimario} onClick={iniciarCorrida}>🔁 Nova corrida (mesma sala)</button>
          </div>
        )}
      </div>
    );
  }

  // ── Esperando na sala (phase 'waiting') ──
  return (
    <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '26px 22px 40px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* flexWrap + minWidth:0 no título: nome de sala comprido ou tela
            estreita quebra pra 2ª linha em vez de empurrar os botões pra fora
            e cortar (era o bug reportado). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <button style={{ ...btnGhost, flexShrink: 0 }} onClick={onSairDaSala}>◂ Salas</button>
          <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 19, flex: '1 1 auto', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state?.nome || roomId}</div>
          <button style={{ ...btnGhost, fontSize: 12, flexShrink: 0 }} onClick={onSairApp}>✕ Sair do multiplayer</button>
        </div>

        <div style={cardSt}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)', marginBottom: 10 }}>
            NA SALA — {players.length} {players.length === 1 ? 'pessoa' : 'pessoas'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map(p => {
              const carro = CARROS.find(c => c.id === p.carro) || CARROS[0];
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>
                  <img src={`/unikofaster/${carro.spr}.png`} alt="" style={{ width: 26, height: 26, objectFit: 'contain',
                    filter: `drop-shadow(0 0 5px ${carro.cor}88)` }} />
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: carro.cor, fontWeight: 700 }}>{carro.nome}</div>
                  {p.name === host && <div style={{ fontSize: 10.5, color: '#ffd166', fontWeight: 800, marginLeft: 'auto' }}>HOST</div>}
                </div>
              );
            })}
          </div>

          {/* Config da corrida: só o HOST edita (grava direto na sala); os
              demais só veem o resumo. Existe pra Sala Geral (e qualquer sala)
              poder trocar traçado/mapa/música/voltas sem precisar recriar a
              sala do zero. */}
          {isHost ? (
            <ConfigCorrida state={state} onMudar={pushState} />
          ) : (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${brd}`, fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.7 }}>
              🏁 {TRACADOS.find(t => t.id === state?.tracado)?.nome || '—'} · {MAPAS[state?.mapa]?.nome || '—'} ·{' '}
              {state?.laps || DEFAULT_LAPS}× voltas · 🎵 {state?.trilha?.title || 'música do host'}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            {isHost ? (
              <button style={{ ...btnPrimario, width: '100%' }} disabled={iniciando} onClick={iniciarCorrida}>
                {iniciando ? 'Iniciando…' : '▶ Iniciar corrida'}
              </button>
            ) : (
              <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.55)', padding: '10px 0' }}>
                Esperando <b style={{ color: '#fff' }}>{host || '...'}</b> iniciar a corrida.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
