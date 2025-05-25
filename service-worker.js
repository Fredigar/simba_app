const APP_CACHE = 'Nectar';
const BASE_URL_DEV = '/nectar/classic/www/';
const BASE_URL_PROD = '/demo/';

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

if (workbox.navigationPreload.isSupported()) {
    workbox.navigationPreload.enable();
}

workbox.routing.registerRoute(
    new RegExp('/*'),
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: APP_CACHE
    })
);

self.addEventListener('fetch', function(event) {
    console.log(event.request.url)
    if (event.request.url.includes('/wss2/.well-known/mercure')) {
        // Ignora la solicitud y no la manejes con el Service Worker
        console.log('mercure')
        return;
    }
    if (event.request.mode === 'navigate') {
        event.respondWith((async function() {
            try {
                const preloadResponse = await event.preloadResponse;
                if (preloadResponse) {
                    return preloadResponse;
                }
                const networkResponse = await fetch(event.request);
                return networkResponse;
            }
            catch(error) {

            }
        })());
    }
});

/* Handle Notifications API Demo */
self.addEventListener('notificationclick', function(event) {
    let url = null;
    if (event.action) {
        switch (event.action) {
            case 'demo':
                url = self.location.host === 'localhost' || self.location.host === '127.0.0.1' ? new URL(BASE_URL_DEV, self.location.origin).href : new URL(BASE_URL_PROD, self.location.origin).href;
                break;
            case 'buy':
                url = 'https://themeforest.net/item/nectar-mobile-web-app-kit/20466093?ref=pmsgz';
                break;
            default:
                url = 'https://nectar.website';
        }
        self.clients.openWindow(url);
    }
    else {
        url = self.location.host === 'localhost' || self.location.host === '127.0.0.1' ? new URL(BASE_URL_DEV, self.location.origin).href : new URL(BASE_URL_PROD, self.location.origin).href;
        let promise = self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then(function(windowClients) {
            let matchingClient = null;
            for (i=0; i<windowClients.length; i++) {
                let windowClient = windowClients[i];
                if (windowClient.url == url) {
                    matchingClient = windowClient;
                    break;
                }
            }
            if (matchingClient) {
                return matchingClient.focus();
            }
            else {
                return self.clients.openWindow(url);
            }
        });
        event.waitUntil(promise);
    }
});