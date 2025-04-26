const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');
const { conectar } = require('./src/config/db');
const { serverConfig } = require('./src/config/serverConfig');
const { requestLogger } = require('./src/middlewares/logger');
const { corsMiddleware } = require('./src/middlewares/cors');
const { limiter } = require('./src/middlewares/rateLimiter');
const { configurarSocketHandlers } = require('./src/socket/handlers');
const { Monitor } = require('./src/config/monitor');
const escolhaModel = require('./src/models/escolha');
const path = require('path');
const assignmentRoutes = require('./src/routes/assignmentRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middlewares
app.use(express.json());
// Servir arquivos estáticos com cache
app.use(express.static(path.join(__dirname, 'src/public'), {
    maxAge: '1d', // Cache por 1 dia
    etag: true,
    lastModified: true
}));
app.use(compression());
app.use(requestLogger);
app.use(corsMiddleware);

// Aplicar configurações ao servidor
Object.entries(serverConfig).forEach(([key, value]) => {
    server[key] = value;
});

// Rate limiting
app.use('/api/verificar-aluno', limiter);
app.use('/api/preferencias', limiter);

// Rotas
app.use('/api', require('./src/routes'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/assignments', assignmentRoutes);


// Socket.IO
const monitor = new Monitor();
configurarSocketHandlers(io, monitor);

// Rota para status
app.get('/status', async (req, res) => {
    try {
        const status = monitor.getStatus();
        const estatisticas = await escolhaModel.getEstatisticas();
        const statusFila = await getStatusFila();
        
        res.json({
            ...status,
            ...estatisticas,
            fila: statusFila
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao obter status' });
    }
});

// Função para iniciar servidor com melhor tratamento de erros
async function iniciarServidor() {
    try {
        const db = await conectar();
        await escolhaModel.conectar();
        console.log('Conexão com MongoDB estabelecida');

        // Configurar timeout para requisições longas
        app.use((req, res, next) => {
            req.setTimeout(5000, () => {
                res.status(408).send('Request timeout');
            });
            next();
        });

        // Rotas principais com melhor tratamento de erros
        app.use('/api', (req, res, next) => {
            Promise.resolve(routes(req, res, next)).catch(next);
        });

        app.use('/api/admin', (req, res, next) => {
            Promise.resolve(adminRoutes(req, res, next)).catch(next);
        });

        // Rota principal com cache
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/public/index.html'), {
                maxAge: '0h'
            });
        });

        // Rota admin com cache
        app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/public/admin.html'), {
                maxAge: '0h'
            });
        });

         // Rota admin com cache
         app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/public/dashboard.html'), {
                maxAge: '0h'
            });
        });

        // Middleware melhorado para tratamento de erros
        app.use((err, req, res, next) => {
            console.error('Erro:', err);
            const statusCode = err.statusCode || 500;
            res.status(statusCode).json({
                erro: statusCode === 500 ? 'Erro interno do servidor' : err.message,
                detalhes: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        });

        // Iniciar servidor HTTP
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`
====================================
🚀 Servidor iniciado com sucesso!
📡 Porta: ${PORT}
🌐 URL: http://localhost:${PORT}
👨‍💼 Admin: http://localhost:${PORT}/admin
====================================
            `);
        });

        // Tratamento gracioso de desligamento
        const gracefulShutdown = () => {
            console.log('\nIniciando desligamento gracioso...');
            server.close(async () => {
                console.log('Fechando conexões HTTP...');
                await db.client.close();
                console.log('Conexões do banco fechadas.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error) {
        console.error("❌ Falha ao iniciar servidor:", error);
        process.exit(1);
    }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rejeitada não tratada:', error);
    process.exit(1);
});

// Iniciar servidor
iniciarServidor().catch(error => {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
});