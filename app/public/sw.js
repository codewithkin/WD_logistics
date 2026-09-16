// Web push service worker. Must live at the site root (/sw.js) so its
// default scope covers the whole app — see src/lib/use-push-notifications.ts
// for where it's registered.

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
      tag, // a repeat notification with the same tag replaces the old one
      data: { url: url || "/dashboard" },
      // No icon/badge set — there's no app icon asset in public/ yet.
      // Add one and reference it here (e.g. icon: "/icon.png") once there is.
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
