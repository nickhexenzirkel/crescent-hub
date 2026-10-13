// Avisa quando o site foi atualizado (nova versão publicada na Vercel) e oferece
// recarregar — assim ninguém fica com a versão velha aberta sem saber. É o que
// faz uma mudança do agente chegar a todo mundo sem precisar "lembrar de dar F5".
// Compara o script principal que a página carregou com o do index.html atual.
import { useEffect, useState } from 'react';
import { T } from '../contexts/theme';

const INTERVALO_MS = 90 * 1000;
const scriptAtual = () => document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') || null;

const AtualizacaoDisponivel = () => {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    const meu = scriptAtual();
    if (!meu) return undefined;             // modo dev (sem hash): nada a comparar
    let vivo = true;
    const checar = async () => {
      try {
        const r = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' });
        const html = await r.text();
        const novo = (html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
        if (vivo && novo && novo !== meu) setNova(true);
      } catch { /* sem rede: tenta de novo depois */ }
    };
    const t = setInterval(checar, INTERVALO_MS);
    const aoVoltar = () => { if (document.visibilityState === 'visible') checar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, []);

  if (!nova) return null;
  return (
    <div role="status" style={{ position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 100000, maxWidth: 'calc(100vw - 24px)',
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: T.surface, color: T.text,
      border: `1px solid ${T.border}`, boxShadow: '0 10px 40px rgba(0,0,0,.35)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
      <span>✨ O Uniko foi atualizado.</span>
      <button onClick={() => window.location.reload()} style={{ padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: T.gold, color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>Atualizar agora</button>
      <button onClick={() => setNova(false)} aria-label="Dispensar" style={{ border: 'none', background: 'transparent', color: T.textT, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  );
};

export default AtualizacaoDisponivel;
