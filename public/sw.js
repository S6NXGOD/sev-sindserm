/*
 * Service Worker do SEV SINDSERM.
 *
 * 1) PWA: permite instalar na tela inicial (Android/desktop; iOS 16.4+).
 * 2) SEM CACHE: um sistema de votação/apuração precisa de dados SEMPRE atuais —
 *    o handler de fetch existe (requisito do Chrome) mas não intercepta nada.
 * 3) PUSH: recebe as notificações (eleições prestes a começar/encerradas/
 *    agendadas) e abre a página certa ao clicar.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Sem interceptação nem cache: a requisição segue normalmente para a rede.
});

// Recebe o push e mostra a notificação.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "SEV SINDSERM", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "SEV SINDSERM";
  const options = {
    body: data.body || "",
    icon: "/logos/logo_default.png",
    badge: "/logos/logo_default.png",
    tag: data.tag || undefined, // mesma tag substitui a notificação anterior
    data: { url: data.url || "/admin" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Ao clicar, foca uma aba existente do app ou abre a URL da notificação.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
