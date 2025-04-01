const CACHE_NAME = 'preferencias-v1';
const DATA_CACHE_NAME = 'data-cache-v1';

// Arquivos para cache estático
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/offline.html' // Página para quando estiver offline
];

// URLs de API que não devem ser cacheadas
const API_URLS = [
    '/api/verificar-aluno',
    '/api/salvar-preferencias'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            // Cache arquivos estáticos
            caches.open(CACHE_NAME).then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            }),
            // Cache para dados dinâmicos
            caches.open(DATA_CACHE_NAME)
        ])
        .then(() => self.skipWaiting()) // Ativa o novo SW imediatamente
    );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // Limpar caches antigos
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            return (cacheName !== CACHE_NAME && 
                                   cacheName !== DATA_CACHE_NAME);
                        })
                        .map(cacheName => {
                            console.log('Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            }),
            // Tomar controle de todas as abas abertas
            self.clients.claim()
        ])
    );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
    // Verifica se é uma requisição para API
    if (API_URLS.some(url => event.request.url.includes(url))) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache da resposta da API
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(DATA_CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(async err => {
                    // Tenta retornar do cache em caso de falha
                    const response = await caches.match(event.request);
                    if (response) {
                        return response;
                    }
                    
                    // Se não houver cache, retorna erro personalizado
                    return new Response(
                        JSON.stringify({
                            error: 'Não foi possível conectar ao servidor.',
                            offline: true
                        }),
                        {
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
    } else {
        // Para arquivos estáticos, usa estratégia Cache First
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    
                    // Se não estiver no cache, busca na rede
                    return fetch(event.request)
                        .then(response => {
                            // Verifica se é uma resposta válida
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }

                            // Cache da nova resposta
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });

                            return response;
                        })
                        .catch(() => {
                            // Se offline e for uma página HTML, mostra página offline
                            if (event.request.headers.get('accept').includes('text/html')) {
                                return caches.match('/offline.html');
                            }
                        });
                })
        );
    }
});

// Sincronização em background
self.addEventListener('sync', event => {
    if (event.tag === 'sync-preferencias') {
        event.waitUntil(
            // Tenta sincronizar dados pendentes
            syncDadosPendentes()
        );
    }
});

// Função para sincronizar dados pendentes
async function syncDadosPendentes() {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const requests = await cache.keys();
        
        const syncPromises = requests
            .filter(request => request.url.includes('/api/salvar-preferencias'))
            .map(async request => {
                try {
                    const response = await fetch(request.clone());
                    if (response.ok) {
                        await cache.delete(request);
                    }
                } catch (error) {
                    console.error('Erro na sincronização:', error);
                }
            });

        await Promise.all(syncPromises);
    } catch (error) {
        console.error('Erro ao sincronizar dados pendentes:', error);
    }
}

// Notificações push
self.addEventListener('push', event => {
    const options = {
        body: event.data.text(),
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Ver preferências'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Sistema de Preferências', options)
    );
});