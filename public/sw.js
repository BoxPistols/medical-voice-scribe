// Service Worker for Medical Scribe Flow
// Enables showNotification on iOS PWA and handles scheduled timer notifications

const TIMER_CACHE = {};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Listen for messages from the main thread
self.addEventListener("message", (e) => {
  const { type } = e.data;

  if (type === "SCHEDULE_NOTIFICATION") {
    // Schedule a notification at a future time
    const { endTime, title, body } = e.data;
    const delay = endTime - Date.now();
    if (delay <= 0) return;

    // Clear any existing timer
    if (TIMER_CACHE.pomodoroTimer) clearTimeout(TIMER_CACHE.pomodoroTimer);

    TIMER_CACHE.pomodoroTimer = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: "/apple-icon",
        badge: "/icon",
        tag: "pomodoro",
        renotify: true,
      });
      TIMER_CACHE.pomodoroTimer = null;
    }, delay);
  }

  if (type === "CANCEL_NOTIFICATION") {
    if (TIMER_CACHE.pomodoroTimer) {
      clearTimeout(TIMER_CACHE.pomodoroTimer);
      TIMER_CACHE.pomodoroTimer = null;
    }
  }
});

// Handle notification click – focus the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
