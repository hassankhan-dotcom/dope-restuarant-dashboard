// Background notifications (when the app is closed or the screen is locked).
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
importScripts("./firebase-config.js");

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// If n8n sends a "notification" payload, the browser shows it by itself.
// If only a "data" payload arrives, we show the notification here.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const d = payload.data || {};
  return self.registration.showNotification(d.title || "🔔 New Order Received", {
    body: d.body || "",
    icon: "icon-192.png?v=2",
    badge: "icon-192.png?v=2",
    tag: d.orderId || "new-order",
    data: { own: true }
  });
});

self.addEventListener("notificationclick", (event) => {
  if (!event.notification.data || !event.notification.data.own) return;
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow("./");
    })
  );
});
