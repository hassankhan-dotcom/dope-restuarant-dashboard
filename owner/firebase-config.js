// Firebase config (these values are public, not secrets).
// Both the app and the service worker use this file, so change the values only here.
self.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSLWpQhnvbFl_x7ab5FzayK2_sVamQrfI",
  authDomain: "avalon-orders.firebaseapp.com",
  projectId: "avalon-orders",
  storageBucket: "avalon-orders.firebasestorage.app",
  messagingSenderId: "453245904546",
  appId: "1:453245904546:web:b646a6427ed9cfa73599fb"
};

// Cloud Messaging Web Push (VAPID) PUBLIC key
self.VAPID_KEY = "BAXI4sXkvNvv6BZ9mtDUiNi3TFs4snY80SZe3matVpU-KSiLzu1IsYGyGGLy9SW-i8Z7sKWiedJvjFVsgPxeByo";

// ---- Marketing follow-ups ----
// Price Meta charges per marketing template message, in PKR (check WhatsApp Manager > Pricing / rate card).
// While this is null the app shows "rate not set" instead of a cost estimate.
self.FOLLOWUP_RATE_PKR = null;
// n8n webhook that sends the template messages. Leave empty until the workflow is ready (Send stays disabled).
self.FOLLOWUP_WEBHOOK_URL = "https://143.110.190.102.sslip.io/webhook/followup-send";
// A customer who got a follow-up is skipped for this many days.
self.FOLLOWUP_COOLDOWN_DAYS = 7;
