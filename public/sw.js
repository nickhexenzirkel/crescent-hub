// Service Worker do Portal — hoje só existe pra permitir notificação push no
// celular (comentário/reação/mensagem novos no Uniko FIT), mesmo com o app
// fechado. Sem cache/offline de propósito (não é o objetivo aqui) — só os
// dois eventos que o Web Push precisa: `push` (mostrar a notificação) e
// `notificationclick` (focar/abrir o Portal ao tocar nela).
// Ver src/utils/pushNotify.js (quem registra este arquivo).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload não era JSON */ }
  const title = data.title || 'Uniko FIT';
  const options = {
    body: data.body || '',
    icon: data.icon || '/UNIKO_FRENTE_FRONTAL.png',
    badge: '/UNIKO_FRENTE_FRONTAL.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined, // notificações do mesmo `tag` se substituem em vez de empilhar
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clientsList.find((c) => c.url.includes(self.location.origin));
    if (existing) { existing.focus(); if ('navigate' in existing) existing.navigate(url); return; }
    await self.clients.openWindow(url);
  })());
});
