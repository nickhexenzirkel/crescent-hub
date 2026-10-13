---
name: nova-aba-portal
description: Como criar uma nova aba (tab) ou jogo no Portal do Colaborador — onde registrar no menu lateral (sidebar) e na rota
metadata:
  type: project
---

Passo a passo para acrescentar uma **aba (tab) / jogo / tela nova** no Portal do Colaborador (menu lateral, "sidebar"). São 3 lugares — use operações POR LINHA (insert_after) nos arquivos existentes e `create` para o componente novo:

1. **Componente novo** (arquivo novo, use `create`): `src/modules/central-colaborador/tabs/TabNome.jsx`, com `export const TabNome = () => { ... }`. Estilos inline; tema: `import { T } from '../../../contexts/theme';`. Jogo simples = componente com `useState`/`useEffect` e um `<canvas>` ou grade de `<div>`.
2. **Menu lateral**: `src/modules/central-colaborador/Sidebar.jsx`, lista `NAV` — cada item é UMA linha como `  {id:'unikofaster',label:'Uniko Speed',   icon:<I><path d="..."/></I>},`. Para ficar "debaixo do Uniko Speed", insira a linha nova (`insert_after`) logo DEPOIS dela. Use um ícone simples, ex.: `icon:<I><rect x="4" y="4" width="16" height="16" rx="2"/></I>`. Depois, no mesmo arquivo, o objeto de títulos (`const nm={... unikofaster:'Uniko Speed',unikosuspect:'Uniko Detetive'}`, ~linha 235): acrescente `novoid:'Nome'` (uma edição curta dentro da linha, com old_string/new_string).
3. **Rota**: `src/modules/central-colaborador/index.jsx` — no topo, junto dos outros `import { TabUnikoFaster } from './tabs/TabUnikoFaster';` acrescente `import { TabNome } from './tabs/TabNome';`; e junto das linhas `if(tab==='unikofaster') return <TabUnikoFaster/>;` (~linha 247) acrescente `if(tab==='novoid') return <TabNome/>;`.

O menu do celular usa `NAV_FOR` e pega o item novo sozinho. O `id` da aba é minúsculo, sem espaço (ex.: `tetris`).
