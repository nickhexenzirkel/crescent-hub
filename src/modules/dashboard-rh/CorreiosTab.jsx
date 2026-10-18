// Dashboard RH → aba "Correios". O admin manda uma mensagem (título,
// descrição, imagem opcional) pra um ou vários colaboradores escolhidos —
// chega na Caixa de Entrada de cada um (ver shared/menuWidgets.js, itemCorreio
// e supabase_correios.sql). Uma linha por destinatário, mesmo padrão de
// game_invites/conexao_list_shares.
import { useState, useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';
import { supabase } from '../../contexts/user';

const CorreiosTab = ({ cardBg, empList, adminName }) => {
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [imgEnviando, setImgEnviando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState('');
  const [hist, setHist] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const imgInputRef = useRef(null);

  const ativos = (empList || []).filter(e => e.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const filtrados = busca.trim()
    ? ativos.filter(e => e.name.toLowerCase().includes(busca.trim().toLowerCase()))
    : ativos;

  const alternar = (nome) => setSelecionados(prev => {
    const n = new Set(prev);
    n.has(nome) ? n.delete(nome) : n.add(nome);
    return n;
  });
  const selecionarTodosFiltrados = () => setSelecionados(prev => {
    const n = new Set(prev);
    filtrados.forEach(e => n.add(e.name));
    return n;
  });
  const limparSelecao = () => setSelecionados(new Set());

  const uploadImagem = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg('⚠️ Escolha um arquivo de imagem.'); return; }
    if (file.size > 8 * 1024 * 1024) { setMsg('⚠️ Imagem maior que 8MB.'); return; }
    setImgEnviando(true); setMsg('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${Date.now()}-${rand}.${ext}`;
      const { error } = await supabase.storage.from('correios-imagens').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('correios-imagens').getPublicUrl(path);
      setImagemUrl(data.publicUrl);
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Erro ao enviar imagem')); }
    setImgEnviando(false);
  };

  const loadHist = async () => {
    setHistLoading(true);
    try {
      const { data } = await supabase.from('correios').select('*').order('created_at', { ascending: false }).limit(60);
      setHist(data || []);
    } catch {}
    setHistLoading(false);
  };
  useEffect(() => { loadHist(); }, []);

  const podeEnviar = titulo.trim() && selecionados.size > 0 && !enviando;

  const enviar = async () => {
    const t = titulo.trim();
    if (!t) { setMsg('⚠️ Escreva ao menos o título.'); return; }
    if (!selecionados.size) { setMsg('⚠️ Escolha pelo menos um destinatário.'); return; }
    setEnviando(true); setMsg('');
    try {
      const linhas = [...selecionados].map(to_name => ({
        from_name: adminName || 'RH', to_name, titulo: t,
        descricao: descricao.trim() || null, imagem_url: imagemUrl || null,
      }));
      const { error } = await supabase.from('correios').insert(linhas);
      if (error) throw error;
      setMsg(`✅ Enviado pra ${linhas.length} pessoa${linhas.length > 1 ? 's' : ''}!`);
      setTitulo(''); setDescricao(''); setImagemUrl(''); limparSelecao();
      await loadHist();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Erro ao enviar')); }
    setEnviando(false);
  };

  const remover = async (id) => {
    if (!window.confirm('Remover este correio (some da caixa de entrada da pessoa)?')) return;
    try { await supabase.from('correios').delete().eq('id', id); await loadHist(); } catch {}
  };

  const inputSt = {
    width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`,
    fontFamily: 'var(--font-body)', fontSize: 13, color: T.text, background: T.surface || '#fff', outline: 'none', boxSizing: 'border-box',
  };
  const labelSt = { fontSize: 11, fontWeight: 600, color: T.textD, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Correios</div>
        <div style={{ fontSize: 13, color: T.textT, marginTop: 4, lineHeight: 1.5 }}>
          Manda uma mensagem (título, descrição e imagem opcional) direto pra Caixa de Entrada de um ou vários
          colaboradores escolhidos — igual um aviso, só que só pra quem você selecionar.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Destinatários ── */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Destinatários ({selecionados.size})</div>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar funcionário..." style={inputSt}/>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={selecionarTodosFiltrados} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Selecionar {busca.trim() ? 'filtrados' : 'todos'}
            </button>
            <button onClick={limparSelecao} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Limpar
            </button>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
            {filtrados.map(e => {
              const on = selecionados.has(e.name);
              return (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px', cursor: 'pointer', borderRadius: 7,
                  background: on ? (T.goldGl || 'rgba(0,0,0,0.04)') : 'transparent' }}>
                  <input type="checkbox" checked={on} onChange={() => alternar(e.name)} style={{ accentColor: T.gold, flexShrink: 0 }}/>
                  <span style={{ fontSize: 12.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                </label>
              );
            })}
            {!filtrados.length && <div style={{ fontSize: 12, color: T.textT, padding: '8px 4px' }}>Nenhum funcionário encontrado.</div>}
          </div>
        </div>

        {/* ── Mensagem ── */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelSt}>Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Parabéns pelo seu aniversário!" style={inputSt}/>
          </div>
          <div>
            <label style={labelSt}>Descrição (opcional)</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Escreva a mensagem..."
              rows={5} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }}/>
          </div>
          <div>
            <label style={labelSt}>Imagem (opcional)</label>
            <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f); e.target.value = ''; }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => imgInputRef.current?.click()} disabled={imgEnviando}
                style={{ padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 12.5, cursor: imgEnviando ? 'wait' : 'pointer', fontFamily: 'var(--font-body)' }}>
                {imgEnviando ? 'Enviando...' : imagemUrl ? 'Trocar imagem' : 'Escolher imagem'}
              </button>
              {imagemUrl && <img src={imagemUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}` }}/>}
              {imagemUrl && <button onClick={() => setImagemUrl('')} style={{ background: 'none', border: 'none', color: T.danger, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Remover</button>}
            </div>
          </div>

          {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('✅') ? '#16a34a' : '#C04050', padding: '8px 12px', borderRadius: 9, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)' }}>{msg}</div>}

          <button onClick={enviar} disabled={!podeEnviar}
            style={{ padding: '12px', borderRadius: 10, border: 'none', cursor: podeEnviar ? 'pointer' : 'not-allowed',
              background: podeEnviar ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : T.border, color: podeEnviar ? '#fff' : T.textT,
              fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)', opacity: enviando ? 0.7 : 1 }}>
            {enviando ? 'Enviando…' : `✉️ Enviar pra ${selecionados.size || 0} pessoa${selecionados.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {/* ── Histórico ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Enviados recentemente</div>
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {histLoading ? (
            <div style={{ padding: 20, fontSize: 13, color: T.textT, textAlign: 'center' }}>Carregando...</div>
          ) : !hist.length ? (
            <div style={{ padding: 20, fontSize: 13, color: T.textT, textAlign: 'center' }}>Nenhum correio enviado ainda.</div>
          ) : hist.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
              {h.imagem_url && <img src={h.imagem_url} alt="" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}`, flexShrink: 0 }}/>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.titulo}</div>
                <div style={{ fontSize: 11.5, color: T.textT, marginTop: 1 }}>
                  pra <strong>{h.to_name}</strong> · {h.created_at ? new Date(h.created_at).toLocaleString('pt-BR') : ''}
                </div>
              </div>
              <button onClick={() => remover(h.id)} title="Remover"
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(192,64,80,0.25)', background: 'rgba(192,64,80,0.05)', cursor: 'pointer', color: '#C04050', flexShrink: 0 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CorreiosTab;
