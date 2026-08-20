// Notificações PUSH no CELULAR (Uniko FIT: comentário/reação no seu check-in
// + mensagem nova no Bate-Papo), mesmo com o app fechado — diferente de
// `desktopNotify.js` (que só funciona com a aba/app aberto).
//
// Precisa de HTTPS + Service Worker (`public/sw.js`) + o navegador aceitar
// notificação. No iPhone, só funciona depois que a pessoa "Adiciona à Tela
// de Início" (Safari) e abre o Portal por esse ícone — Safari normal (aba)
// não entrega push no iOS. `needsIosInstall()` existe pra distinguir esse
// caso e mostrar instrução em vez do botão de ativar.
//
// Quem manda o push de verdade é o crescent-hub-server (repo separado, roda
// na VPS) — aqui só registra a "inscrição" (endpoint + chaves) na tabela
// uniko_fit_push_subscriptions (rodar supabase_uniko_fit_push.sql antes).
import { supabase } from '../contexts/user';

// Chave pública VAPID — só a metade PÚBLICA fica no client (a privada mora
// no .env do servidor, nunca aqui). Gerada uma vez com `web-push generate-vapid-keys`.
const VAPID_PUBLIC_KEY = 'BHj6RDAsWUSUo96d7SJ6N_Ny4wSWXJ933jUzPlb1GzARwiE8-XZANnwZO_XCoOAng5KbnY3a0r3OTj8ApWAh2zM';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iOS só entrega push pro app "instalado" (aberto a partir do ícone da Tela
// de Início) — `navigator.standalone` é a forma (não-padrão, só Safari/iOS)
// de saber se está rodando assim.
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
const isStandalone = () =>
  window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
export const needsIosInstall = () => isIos() && !isStandalone();

export const pushPermission = () => (pushSupported() ? Notification.permission : 'unsupported');

// Chame só dentro de um gesto do usuário (clique/toque) — navegador exige.
export const ensurePushSubscription = async (playerName) => {
  if (!pushSupported()) throw new Error('Este navegador não suporta notificação push.');
  if (needsIosInstall()) throw new Error('No iPhone, primeiro adicione o Portal à Tela de Início e abra por lá.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada.');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from('uniko_fit_push_subscriptions').upsert({
    player: playerName,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
  }, { onConflict: 'endpoint' });
  if (error) throw error;

  return sub;
};
