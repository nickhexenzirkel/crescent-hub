import { useEffect, useState } from 'react';
import { T } from '../../contexts/theme';
import {
  DEFAULT_NOTIFICATION_MODES,
  NOTIFICATION_CATEGORIES,
  notificationModesForCategory,
} from '../../shared/notificationPreferences';
import {
  GLOBAL_NOTIFICATION_PREFERENCES_CHANGED_EVENT,
  loadGlobalNotificationPreferences,
  saveGlobalNotificationPreferences,
} from '../../shared/globalNotificationPreferences';

export default function NotificacoesGeraisTab() {
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_MODES);
  const [carregando, setCarregando] = useState(true);
  const [configDisponivel, setConfigDisponivel] = useState(false);
  const [salvando, setSalvando] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let active = true;
    const atualizar = event => {
      if (active) setPreferences(event.detail.preferences);
    };
    window.addEventListener(GLOBAL_NOTIFICATION_PREFERENCES_CHANGED_EVENT, atualizar);
    loadGlobalNotificationPreferences()
      .then(valor => {
        if (!active) return;
        setPreferences(valor);
        setConfigDisponivel(true);
      })
      .catch(error => {
        console.error('[notificações gerais] Falha ao carregar o padrão compartilhado do Supabase.', {
          name: error?.name,
          message: error?.message || String(error),
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        });
        if (active) setErro(`Não foi possível carregar as configurações compartilhadas: ${error.message || 'erro desconhecido'}. Verifique se a migração de notificações foi aplicada no Supabase principal.`);
      })
      .finally(() => { if (active) setCarregando(false); });
    return () => {
      active = false;
      window.removeEventListener(GLOBAL_NOTIFICATION_PREFERENCES_CHANGED_EVENT, atualizar);
    };
  }, []);

  const alterar = async (category, mode) => {
    console.info('[notificações gerais] Clique em opção de padrão da empresa.', { category, mode });
    setSalvando(category);
    setErro('');
    setMensagem('');
    try {
      const resultado = await saveGlobalNotificationPreferences({ ...preferences, [category]: mode });
      setPreferences(resultado);
      setConfigDisponivel(true);
      setMensagem(`Padrão de “${NOTIFICATION_CATEGORIES.find(item => item.id === category)?.label}” salvo e sincronizado.`);
      console.info('[notificações gerais] Padrão salvo e sincronizado.', { category, mode });
    } catch (error) {
      console.error('[notificações gerais] Falha ao salvar o padrão no Supabase.', {
        category,
        mode,
        name: error?.name,
        message: error?.message || String(error),
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      setErro(`Não foi possível salvar. ${error.message || 'Erro desconhecido.'}`);
    } finally {
      setSalvando('');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ padding: '18px 20px', borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
        <h2 style={{ margin: 0, color: T.text, fontSize: 18 }}>Gerenciar notificações gerais</h2>
        <p style={{ margin: '7px 0 0', color: T.textS, fontSize: 12.5, lineHeight: 1.6 }}>
          Defina o padrão da empresa para cada tipo de aviso. As alterações são sincronizadas com os dispositivos conectados; preferências pessoais já escolhidas continuam valendo como exceções.
        </p>
        <p style={{ margin: '6px 0 0', color: T.textT, fontSize: 11.5, lineHeight: 1.5 }}>
          “Desktop” depende da permissão do navegador e da extensão em cada dispositivo. Quem entrar depois também receberá o padrão atualizado.
        </p>
      </section>

      {carregando && <div role="status" style={{ color: T.textS, fontSize: 12 }}>Carregando padrão compartilhado…</div>}
      {!carregando && erro && (
        <div role="alert" style={{ padding: 13, borderRadius: 10, color: T.danger || '#C04050', background: T.surface, border: `1px solid ${T.border}`, fontSize: 12 }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'grid', gap: 11 }}>
        {NOTIFICATION_CATEGORIES.map(category => (
          <section key={category.id} style={{ padding: '15px 17px', borderRadius: 12, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: T.text, fontSize: 14 }}>{category.label}</h3>
              <p style={{ margin: '4px 0 0', color: T.textS, fontSize: 11.5 }}>{category.description}</p>
            </div>
            <div role="radiogroup" aria-label={`Padrão: ${category.label}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {notificationModesForCategory(category.id).map(mode => {
                const selected = preferences[category.id] === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={Boolean(salvando) || carregando || Boolean(erro && !configDisponivel)}
                    onClick={() => alterar(category.id, mode.id)}
                    style={{
                      padding: '8px 11px',
                      border: `1px solid ${selected ? T.gold : T.border}`,
                      borderRadius: 9,
                      color: selected ? T.gold : T.textS,
                      background: selected ? T.goldGl : 'transparent',
                      cursor: salvando || carregando ? 'wait' : 'pointer',
                      opacity: salvando && salvando !== category.id ? 0.6 : 1,
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      fontWeight: selected ? 800 : 600,
                    }}
                  >
                    {salvando === category.id ? 'Salvando… ' : ''}{mode.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div role={erro ? 'alert' : 'status'} style={{ minHeight: 18, color: erro ? (T.danger || '#C04050') : T.success, fontSize: 12 }}>
        {erro || mensagem}
      </div>
    </div>
  );
}
