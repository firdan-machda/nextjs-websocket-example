const activateSw = () => {
  self.addEventListener('activate', () => {
    console.log('service worker activated')
  });
}

const installSw = () => {
  self.addEventListener('install', () => {
    console.log('service worker installed')
  });
}

// push eventListener from:
// https://www.digitalocean.com/community/tutorials/how-to-send-web-push-notifications-from-django-applications
const pushSw = () => {
  self.addEventListener('push', function (event) {
    // Retrieve the textual payload from event.data (a PushMessageData object).
    // Other formats are supported (ArrayBuffer, Blob, JSON), check out the documentation
    // on https://developer.mozilla.org/en-US/docs/Web/API/PushMessageData.
    const eventInfo = event.data.text();
    const data = JSON.parse(eventInfo);
    const head = data.head || 'New Notification';
    const body = data.body || 'This is default content.';

    console.debug("new push event", event)
    // Keep the service worker alive until the notification is created.
    event.waitUntil(
      // Show a notification with title 'ServiceWorker Cookbook' and use the payload
      // as the body.
      self.registration.showNotification(head, {
        body: body,
        icon: 'https://picsum.photos/id/82/1500/997'
      })
    );
  });
}

installSw()
activateSw()
pushSw()