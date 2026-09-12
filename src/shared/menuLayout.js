/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT DO MENU DE MÓDULOS — qual desenho a tela de escolher módulo usa

   A tela de módulos sempre foi a ÓRBITA (o anel de bolhas com o Uniko no
   meio). Este arquivo existe pra podermos DESENHAR UM LAYOUT NOVO sem tirar
   a órbita do caminho: ela continua inteira, guardada aqui como uma opção
   ('orbita'), e o layout novo nasce ao lado dela ('novo').

   O interruptor mora no Dashboard RH → Configurações e é TEMPORÁRIO: é uma
   chave de teste pra comparar os dois lado a lado enquanto o layout novo não
   está pronto. Quando ele estiver, um dos dois vira o padrão e este arquivo
   (e o cartão no Dashboard) saem.

   Guardado no localStorage do NAVEGADOR, não no servidor nem por usuário —
   de propósito. Não é preferência de ninguém: é o que a pessoa que está
   testando quer ver na máquina dela, sem mexer no que a empresa inteira vê.

   Quem lê o valor usa `useMenuLayout()`, que também escuta a troca — assim o
   seletor de módulos já aberto em outra aba/tela muda na hora, sem F5.
══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';

export const MENU_LAYOUT_KEY   = 'uniko_menu_layout';
export const MENU_LAYOUT_EVENT = 'uniko-menu-layout:mudou';

export const MENU_LAYOUTS = [
  { id:'orbita', label:'Órbita',
    desc:'O anel de bolhas com o Uniko no centro — o layout que está no ar hoje.' },
  { id:'novo',   label:'Layout novo',
    desc:'Módulos à esquerda e widgets à direita: acesso rápido, check-in e novidades.' },
];

export const LAYOUT_PADRAO = 'orbita';

const valido = (v) => MENU_LAYOUTS.some(l => l.id === v);

export const getMenuLayout = () => {
  try { const v = localStorage.getItem(MENU_LAYOUT_KEY); return valido(v) ? v : LAYOUT_PADRAO; }
  catch { return LAYOUT_PADRAO; }
};

export const setMenuLayout = (id) => {
  const v = valido(id) ? id : LAYOUT_PADRAO;
  try { localStorage.setItem(MENU_LAYOUT_KEY, v); } catch { /* modo anônimo, storage cheio */ }
  try { window.dispatchEvent(new CustomEvent(MENU_LAYOUT_EVENT, { detail: v })); } catch { /* SSR/teste */ }
  return v;
};

/* Re-renderiza quem depende do layout. Escuta os dois avisos: o CustomEvent
   (troca feita nesta aba) e o `storage` do navegador (troca feita em OUTRA
   aba do mesmo navegador — o Dashboard costuma estar numa janela separada). */
export const useMenuLayout = () => {
  const [layout, setLayout] = useState(getMenuLayout);
  useEffect(() => {
    const local  = (e) => setLayout(e.detail || getMenuLayout());
    const outraAba = (e) => { if (!e.key || e.key === MENU_LAYOUT_KEY) setLayout(getMenuLayout()); };
    window.addEventListener(MENU_LAYOUT_EVENT, local);
    window.addEventListener('storage', outraAba);
    return () => { window.removeEventListener(MENU_LAYOUT_EVENT, local); window.removeEventListener('storage', outraAba); };
  }, []);
  return layout;
};
