// Web push service worker. Must live at the site root (/sw.js) so its
// default scope covers the whole app — see src/lib/use-push-notifications.ts
// for where it's registered on demand, and components/providers/push-sync.tsx
// for the registration that happens on every load for a signed-in user.

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every tab to close; an
  // update to this file otherwise sits unused until the user quits the
  // browser, which is how a fixed worker can appear not to be fixed.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "WD Logistics", body: event.data.text() };
  }

  const { title, body, url, tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "WD Logistics", {
      body,
      // Android and desktop Chrome show a blank square without these, which
      // reads as a broken notification even when delivery worked.
      icon: "/web-app-manifest-192x192.png",
      badge: "/web-app-manifest-192x192.png",
      // A repeat notification with the same tag replaces the old one, so a
      // task updated three times leaves one entry rather than three.
      tag,
      // Keeps a replaced notification from re-alerting on every update.
      renotify: Boolean(tag),
      data: { url: url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Prefer focusing a tab that is already on the target page; failing
        // that, reuse any open tab and navigate it, so clicking a
        // notification never leaves a pile of duplicate windows behind.
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clients) {
          if ("navigate" in client && "focus" in client) {
            return client.navigate(url).then((c) => c && c.focus());
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
