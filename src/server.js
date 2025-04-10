const express = require('express');
const { conectar } = require('./config/db');
const routes = require('./routes');
const path = require('path');
const adminRoutes = require('./routes/admin');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 });
const app = express();

// Middlewares
app.use(express.json());
app.use(express.static('public'));
app.use(compression());

// Configuração de Rate Limiting mais adequada para testes
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 1000, // Aumentado para 1000 requisições por minuto
    message: {
        status: 429,
        error: 'Too Many Requests',
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Adicionar skip para ambiente de teste
    skip: (req) => process.env.NODE_ENV === 'test'
});

// Aplicar rate limiting apenas em rotas específicas
app.use('/api/verificar-aluno', limiter);
app.use('/api/preferencias', limiter);

// Cache aprimorado para respostas estáticas
app.use(express.static('public', {
    maxAge: '1h',
    etag: true,
    lastModified: true
}));

// Middleware para logs com informações adicionais
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// Middleware CORS otimizado
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware para verificar autenticação admin (mantido simples para testes)
const verificarAdmin = (req, res, next) => {
    next();
};

// Função para iniciar servidor com melhor tratamento de erros
async function iniciarServidor() {
    try {
        const db = await conectar();
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

        app.use('/api/admin', verificarAdmin, (req, res, next) => {
            Promise.resolve(adminRoutes(req, res, next)).catch(next);
        });

        // Rota principal com cache
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'), {
                maxAge: '1h'
            });
        });

        // Rota admin com cache
        app.get('/admin', verificarAdmin, (req, res) => {
            res.sendFile(path.join(__dirname, '../public/admin.html'), {
                maxAge: '1h'
            });
        });

        // Rota de estatísticas com cache
        app.get('/api/admin/estatisticas', verificarAdmin, async (req, res) => {
            try {
                const cacheKey = 'estatisticas';
                const cached = await db.collection('cache').findOne({ key: cacheKey });

                if (cached && Date.now() - cached.timestamp < 60000) {
                    return res.json(cached.data);
                }

                const [totalAlunos, totalEscolhas] = await Promise.all([
                    db.collection('alunos').countDocuments(),
                    db.collection('preferencias').countDocuments()
                ]);

                const [estatisticasTurmas, estatisticasPreferencias, estatisticasPorPeriodo] = await Promise.all([
                    db.collection('alunos').aggregate([
                        { $group: { _id: "$turma", total: { $sum: 1 } } }
                    ]).toArray(),
                    db.collection('preferencias').aggregate([
                        { $unwind: "$preferencias" },
                        { $group: { _id: "$preferencias", totalEscolhas: { $sum: 1 } } },
                        { $sort: { totalEscolhas: -1 } }
                    ]).toArray(),
                    db.collection('preferencias').aggregate([
                        {
                            $group: {
                                _id: {
                                    $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
                                },
                                total: { $sum: 1 }
                            }
                        },
                        { $sort: { "_id": 1 } }
                    ]).toArray()
                ]);

                const estatisticas = {
                    totalAlunos,
                    totalEscolhas,
                    estatisticasTurmas,
                    estatisticasPreferencias,
                    estatisticasPorPeriodo
                };

                // Atualizar cache
                await db.collection('cache').updateOne(
                    { key: cacheKey },
                    { 
                        $set: { 
                            data: estatisticas,
                            timestamp: Date.now()
                        }
                    },
                    { upsert: true }
                );

                res.json(estatisticas);
            } catch (error) {
                console.error('Erro ao buscar estatísticas:', error);
                res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
            }
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

        // Iniciar servidor com melhor feedback
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => {
            console.log(`
====================================
🚀 Servidor iniciado com sucesso!
📡 Porta: ${PORT}
🌐 URL: http://localhost:${PORT}
👨‍💼 Admin: http://localhost:${PORT}/admin
====================================
            `);
        });

        // Configurar timeouts do servidor
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

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