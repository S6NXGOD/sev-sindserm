/*
 * Service Worker do SEV SINDSERM — habilita a instalação como PWA (Android).
 *
 * IMPORTANTE: este SW NÃO faz cache de respostas. Um sistema de votação e
 * apuração precisa de dados SEMPRE atuais; servir conteúdo em cache poderia
 * exibir resultados desatualizados. Por isso o handler de fetch apenas existe
 * (requisito do Chrome para instalação) e deixa o navegador buscar na rede.
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
