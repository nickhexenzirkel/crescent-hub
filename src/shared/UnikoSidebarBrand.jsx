/* ══════════════════════════════════════════════════════════════════════════
   CABEÇALHO DA SIDEBAR dos módulos de conversa (Uniko Call, Uniko WhatsApp):
   mascote centralizado + UNIKO em SVG + legenda, blobs de luz no fundo e star
   divider — tudo na cor do módulo. Mesmo visual do cabeçalho do Portal do
   Colaborador (central-colaborador/Sidebar.jsx), num componente só pra os
   módulos não desandarem uns dos outros.
     cor      — tom claro (blobs, ex.: '#22c55e')
     corForte — tom escuro (legenda e star divider, ex.: '#16a34a')
══════════════════════════════════════════════════════════════════════════ */
import { T } from '../contexts/theme';
import { UnikoBrandArt } from './UnikoBrand';
import { StarDivider } from './components';
import { bolhaGradiente } from './bolhas';

const UnikoSidebarBrand = ({ legenda, logo = '/UNIKO_LOGO.png', cor, corForte, tamanhoLogo = 72 }) => (
  <div style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '20px 16px 12px', borderBottom: `1px solid ${corForte}24` }}>
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', background: bolhaGradiente(cor + '55'), top: '-80px', left: '-70px', animation: 'brandBlob1 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: bolhaGradiente(corForte + '44'), top: '-55px', right: '-60px', animation: 'brandBlob2 8s ease-in-out infinite' }} />
    </div>
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
      <UnikoBrandArt legenda={legenda} logo={logo} tamanhoLogo={tamanhoLogo} alturaNome={28} vertical legendaCentrada tamanhoLegenda={13} cores={{ texto: T.text, destaque: corForte }} />
    </div>
    <StarDivider my={0} color={corForte} />
  </div>
);

export default UnikoSidebarBrand;
