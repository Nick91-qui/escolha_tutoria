const express = require('express');
const { conectar } = require('./config/db');
const routes = require('./routes');
const path = require('path');
const adminRoutes = require('./routes/admin');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static('public'));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100 // limite por IP
});

app.use(limiter);

// Cache para respostas estáticas
app.use(express.static('public', {
    maxAge: '1h'
}));

// Middleware para logs
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Middleware para CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Middleware para verificar autenticação admin
const verificarAdmin = (req, res, next) => {
    // TODO: Implementar autenticação real
    next();
};

// Conectar ao banco e iniciar servidor
async function iniciarServidor() {
    try {
        // Conectar ao MongoDB
        const db = await conectar();
        console.log('Conexão com MongoDB estabelecida');

        // Rotas da API principal
        app.use('/api', routes);

        // Rotas administrativas
        app.use('/api/admin', verificarAdmin, adminRoutes);

        // Rota para a página principal
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // Rota para o dashboard administrativo
        app.get('/admin', verificarAdmin, (req, res) => {
            res.sendFile(path.join(__dirname, '../public/admin.html'));
        });
        // Rota para estatísticas
        app.get('/api/admin/estatisticas', verificarAdmin, async (req, res) => {
            try {
                const totalAlunos = await db.collection('alunos').countDocuments();
                const totalEscolhas = await db.collection('preferencias').countDocuments();

                // Estatísticas por turma
                const estatisticasTurmas = await db.collection('alunos').aggregate([
                    {
                        $group: {
                            _id: "$turma",
                            total: { $sum: 1 }
                        }
                    }
                ]).toArray();

                // Estatísticas de preferências com timestamp
                const estatisticasPreferencias = await db.collection('preferencias').aggregate([
                    { $unwind: "$preferencias" },
                    {
                        $group: {
                            _id: "$preferencias",
                            totalEscolhas: { $sum: 1 }
                        }
                    },
                    { $sort: { totalEscolhas: -1 } }
                ]).toArray();

                // Estatísticas por período
                const estatisticasPorPeriodo = await db.collection('preferencias').aggregate([
                    {
                        $group: {
                            _id: {
                                $dateToString: { 
                                    format: "%Y-%m-%d", 
                                    date: "$timestamp" 
                                }
                            },
                            total: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id": 1 } }
                ]).toArray();

                res.json({
                    totalAlunos,
                    totalEscolhas,
                    estatisticasTurmas,
                    estatisticasPreferencias,
                    estatisticasPorPeriodo
                });
            } catch (error) {
                console.error('Erro ao buscar estatísticas:', error);
                res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
            }
        });

        // Rota para listar alunos pendentes
        app.get('/api/admin/alunos-pendentes', verificarAdmin, async (req, res) => {
            try {
                const alunosPendentes = await db.collection('alunos').aggregate([
                    {
                        $lookup: {
                            from: 'preferencias',
                            localField: 'nome',
                            foreignField: 'nome',
                            as: 'preferencias'
                        }
                    },
                    {
                        $match: {
                            'preferencias': { $size: 0 }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            nome: 1,
                            turma: 1
                        }
                    }
                ]).toArray();

                res.json({ alunos: alunosPendentes });
            } catch (error) {
                console.error('Erro ao buscar alunos pendentes:', error);
                res.status(500).json({ erro: 'Erro ao buscar alunos pendentes' });
            }
        });

        // Rota para exportar dados
        app.get('/api/admin/exportar', verificarAdmin, async (req, res) => {
            try {
                const preferencias = await db.collection('preferencias').find().toArray();

                const csv = [
                    ['Turma', 'Nome', 'Preferências', 'Data de Escolha', 'Timestamp'].join(','),
                    ...preferencias.map(p => [
                        p.turma,
                        p.nome,
                        p.preferencias.join(';'),
                        new Date(p.dataCriacao).toLocaleString(),
                        p.timestamp.toISOString()
                    ].join(','))
                ].join('\n');

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=preferencias.csv');
                res.send(csv);
            } catch (error) {
                console.error('Erro ao exportar dados:', error);
                res.status(500).json({ erro: 'Erro ao exportar dados' });
            }
        });

        // Middleware para tratamento de erros
        app.use((err, req, res, next) => {
            console.error('Erro:', err);
            res.status(500).json({
                erro: 'Erro interno do servidor',
                mensagem: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno'
            });
        });

        // Middleware para rotas não encontradas
        app.use((req, res) => {
            res.status(404).json({
                erro: 'Rota não encontrada',
                url: req.originalUrl
            });
        });

        // Iniciar servidor
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log(`Acesse: http://localhost:${PORT}`);
            console.log(`Dashboard Admin: http://localhost:${PORT}/admin`);
        });

    } catch (error) {
        console.error("Falha ao iniciar servidor:", error);
        process.exit(1);
    }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('Promise rejeitada não tratada:', error);
    process.exit(1);
});

// Tratamento de sinais de término
process.on('SIGTERM', () => {
    console.log('Recebido SIGTERM. Encerrando graciosamente...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Recebido SIGINT. Encerrando graciosamente...');
    process.exit(0);
});

// Iniciar servidor
iniciarServidor().catch(error => {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
});        