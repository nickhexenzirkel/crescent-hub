// Dashboard RH → "Imagens do Site" (só admin).
// Troca uma imagem do Uniko (mascote, logo, cards…) por outra: vale pra todo mundo,
// na hora, sem mexer em código e sem esperar deploy. Ver src/shared/siteImagens.js.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { T } from '../../contexts/theme';
import { USER } from '../../contexts/user';
import { SLOTS, carregarSiteImagens, salvarSiteImagem, restaurarSiteImagem } from '../../shared/siteImagens';

const quando = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
// A original sempre vem com ?__orig pra NÃO ser trocada pelo próprio sistema.
const original = (path) => `${path}?__orig=1`;

const ImagensSiteTab = ({ cardBg }) => {
  const bg = cardBg || T.surface;
  const [linhas, setLinhas] = useState(null);   // linhas da tabela (trocas ativas)
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(null); // path em andamento
  const [extra, setExtra] = useState('');       // caminho digitado à mão
  const fileRef = useRef(null);
  const alvoRef = useRef(null);                 // path escolhido ao clicar "Trocar"

  const load = useCallback(async () => {
    const d = await carregarSiteImagens();
    if (d === null) setErro('Não consegui ler as trocas. Rode supabase_site_imagens.sql no Supabase principal e atualize.');
    else { setErro(''); setLinhas(d); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const trocadas = new Map((linhas || []).map(r => [r.path, r]));
  // Slots fixos + os caminhos extras que já foram trocados antes.
  const todos = [...SLOTS, ...(linhas || []).filter(r => !SLOTS.some(s => s.path === r.path)).map(r => ({ path: r.path, label: r.label || r.path, onde: 'Caminho personalizado', dica: '' }))];

  const escolher = (path) => { alvoRef.current = path; fileRef.current?.click(); };
  const aoEscolherArquivo = async (e) => {
    const file = e.target.files?.[0]; const path = alvoRef.current;
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !path) return;
    setOcupado(path); setErro(''); setMsg('');
    try {
      const slot = todos.find(s => s.path === path);
      await salvarSiteImagem(path, file, { label: slot?.label, usuario: USER?.name });
      setMsg(`Imagem trocada! Quem está com o Uniko aberto recebe em até 3 minutos (ou ao atualizar a página).`);
      await load();
    } catch (err) { setErro(err.message || 'Falha ao enviar a imagem.'); }
    setOcupado(null);
  };
  const restaurar = async (path) => {
    if (!window.confirm('Voltar para a imagem original?')) return;
    setOcupado(path); setErro(''); setMsg('');
    try { await restaurarSiteImagem(path); setMsg('Voltou para a imagem original.'); await load(); }
    catch (err) { setErro(err.message || 'Falha ao restaurar.'); }
    setOcupado(null);
  };
  const adicionarCaminho = () => {
    const p = extra.trim();
    if (!/^\/[^\s?#]+\.(png|jpe?g|webp|gif|svg)$/i.test(p)) { setErro('Digite o caminho como aparece no site, ex.: /UNIKO_PISCA.png'); return; }
    setErro(''); setExtra(''); escolher(p);
  };

  const btn = (primario) => ({ padding: '7px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
    border: `1px solid ${primario ? T.gold : T.border}`, background: primario ? T.gold : 'transparent', color: primario ? '#fff' : T.textS });
  const miniatura = { width: 84, height: 84, objectFit: 'contain', borderRadius: 12, border: `1px solid ${T.border}`, background: 'repeating-conic-gradient(#8881 0% 25%, transparent 0% 50%) 50% / 14px 14px', flexShrink: 0 };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Imagens do Site</div>
      <div style={{ fontSize: 12.5, color: T.textT, margin: '2px 0 16px', lineHeight: 1.5 }}>
        Troque uma imagem do Uniko por outra e ela muda <b>para todo mundo</b>, sem deploy. Dá pra voltar para a original a qualquer momento.
        As imagens são reduzidas automaticamente (máx. 1400 px) e a transparência é mantida.
      </div>

      {erro && <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: T.danger, background: `${T.danger}18`, border: `1px solid ${T.danger}44` }}>{erro}</div>}
      {msg && <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: '#1d7a52', background: 'rgba(40,168,112,.12)', border: '1px solid rgba(40,168,112,.35)' }}>{msg}</div>}

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={aoEscolherArquivo} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
        {todos.map(s => {
          const t = trocadas.get(s.path);
          return (
            <div key={s.path} style={{ background: bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, boxShadow: T.sh }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <img src={t ? t.url : original(s.path)} alt="" style={miniatura} />
                  <div style={{ fontSize: 10, color: t ? T.gold : T.textT, marginTop: 3, fontWeight: 700 }}>{t ? 'TROCADA' : 'ORIGINAL'}</div>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2, lineHeight: 1.4 }}>{s.onde}</div>
                  <div style={{ fontSize: 10.5, color: T.textT, marginTop: 4, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.path}</div>
                  {s.dica && <div style={{ fontSize: 11, color: T.textT, marginTop: 4 }}>Dica: {s.dica}</div>}
                  {t && <div style={{ fontSize: 10.5, color: T.textT, marginTop: 4 }}>Trocada {t.updated_by ? `por ${t.updated_by} ` : ''}em {quando(t.updated_at)}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button disabled={ocupado === s.path} onClick={() => escolher(s.path)} style={btn(true)}>{ocupado === s.path ? 'Enviando…' : t ? 'Trocar de novo' : 'Trocar imagem'}</button>
                {t && <button disabled={ocupado === s.path} onClick={() => restaurar(s.path)} style={btn(false)}>Voltar à original</button>}
                {t && <a href={t.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: T.textT, marginLeft: 'auto' }}>abrir ↗</a>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, background: bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>Outra imagem</div>
        <div style={{ fontSize: 12, color: T.textT, marginBottom: 10, lineHeight: 1.5 }}>
          Digite o caminho de qualquer imagem da pasta pública do site (ex.: <code>/UNIKO_PISCA.png</code>) e escolha a nova. Só funciona para imagens que o site carrega por esse caminho.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="/nome-da-imagem.png"
            style={{ flex: 1, padding: '9px 11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }} />
          <button onClick={adicionarCaminho} disabled={!extra.trim()} style={{ ...btn(true), opacity: extra.trim() ? 1 : .5 }}>Escolher imagem</button>
        </div>
      </div>
    </div>
  );
};

export default ImagensSiteTab;
