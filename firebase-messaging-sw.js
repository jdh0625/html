/* Da Hoon Planner - FCM 백그라운드 메시지 처리 서비스워커
   앱이 닫혀 있거나 백그라운드일 때 오는 푸시 알림을 표시 */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCrlpcWXEQLFH0OPyFxlH-W1utLaHHZxoQ",
  authDomain: "dahoon-planner.firebaseapp.com",
  databaseURL: "https://dahoon-planner-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dahoon-planner",
  storageBucket: "dahoon-planner.firebasestorage.app",
  messagingSenderId: "131654263299",
  appId: "1:131654263299:web:c4ca0c81ce7aebf4f46436"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const n = (payload && (payload.data || payload.notification)) || {};
  self.registration.showNotification(n.title || '다훈 플래너', {
    body: n.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'dahoon-push'
  });
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (const c of list) { if (c.url.includes('/html/') && 'focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
