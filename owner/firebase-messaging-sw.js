// Background notifications (jab app band ho ya screen lock ho).
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
importScripts("./firebase-config.js");

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// Agar n8n "notification" payload bhejta hai to browser khud dikha deta hai.
// Agar sirf "data" payload aaye to hum yahan khud notification dikhate hain.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const d = payload.data || {};
  return self.registration.showNotification(d.title || "🔔 New Order Received", {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
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
