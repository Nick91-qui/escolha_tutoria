const serverConfig = {
    // Configurações de timeout
    timeout: 120000, // 2 minutos
    keepAliveTimeout: 120000,
    headersTimeout: 120000,
    
    // Configurações de conexão
    maxConnections: 1000,
    
    // Configurações de cabeçalhos
    setHeaders: (res) => {
        res.setHeader('X-Powered-By', 'Escolha Tutoria Server');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
};

module.exports = { serverConfig };