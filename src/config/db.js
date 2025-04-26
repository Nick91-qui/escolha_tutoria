const { MongoClient } = require('mongodb');
require('dotenv').config();

// Usar a URI do ambiente
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    monitorCommands: true,
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
    }
});

// Adicionar após a criação do client
client.on('commandStarted', (event) => {
    console.debug('MongoDB comando iniciado:', event.commandName);
});

client.on('commandFailed', (event) => {
    console.error('MongoDB comando falhou:', event.commandName);
});

let dbConnection;

// Cache para otimização
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutos em millisegundos
const MAX_CACHE_SIZE = 1000;

// Adicionar no início do arquivo, após as constantes
function limparCacheSeNecessario() {
    if (cache.size > MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(cache.keys())
            .slice(0, Math.floor(MAX_CACHE_SIZE / 2));
        keysToDelete.forEach(key => cache.delete(key));
    }
}

async function criarIndices(db) {
    try {
        await Promise.all([
            db.collection('alunos').createIndex(
                { turma: 1, nome: 1 },
                { unique: true, background: true }
            ),
            db.collection('preferencias').createIndex(
                { turma: 1, nome: 1 },
                { background: true }
            ),
            db.collection('preferencias').createIndex(
                { timestamp: -1 },
                { background: true }
            ),
            db.collection('preferencias').createIndex(
                { dataCriacao: -1 },
                { background: true }
            )
        ]);

        console.log("✅ Índices criados/atualizados com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao criar índices:", error);
    }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function conectarComRetry(tentativa = 1) {
    try {
        if (dbConnection) {
            return dbConnection;
        }

        await client.connect();
        console.log("✅ Conectado ao MongoDB com sucesso!");
        
        const dbName = new URL(uri).pathname.substr(1) || 'escola';
        dbConnection = client.db(dbName);
        
        await criarIndices(dbConnection);
        
        return dbConnection;
    } catch (error) {
        if (tentativa < MAX_RETRIES) {
            console.log(`Tentativa ${tentativa} falhou, tentando novamente em ${RETRY_DELAY/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return conectarComRetry(tentativa + 1);
        }
        console.error("❌ Erro ao conectar após várias tentativas:", error);
        throw error;
    }
}

async function conectar() {
    return conectarComRetry();
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
}

function gerarInfoTemporal() {
    const agora = new Date();
    return {
        timestamp: agora,
        dataCriacao: agora,
        dataFormatada: agora.toLocaleDateString('pt-BR'),
        horaFormatada: agora.toLocaleTimeString('pt-BR'),
        semanaAno: getWeekNumber(agora)
    };
}

const db = {
    async verificarAluno(turma, nome) {
        try {
            const cacheKey = `aluno:${turma}:${nome}`;
            const cachedResult = cache.get(cacheKey);
            
            if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
                return cachedResult.data;
            }

            const db = await conectar();
            const aluno = await db.collection('alunos').findOne({ 
                turma: turma.trim().toUpperCase(), 
                nome: nome.trim().toUpperCase() 
            });

            const result = { verificado: !!aluno };
            cache.set(cacheKey, { data: result, timestamp: Date.now() });
            limparCacheSeNecessario();
            return result;
        } catch (error) {
            console.error("❌ Erro ao verificar aluno:", error);
            throw error;
        }
    },

    async salvarPreferencias(dados) {
        try {
            const db = await conectar();
            
            const existente = await db.collection('preferencias').findOne({
                turma: dados.turma.trim().toUpperCase(),
                nome: dados.nome.trim().toUpperCase()
            });

            if (existente) {
                return { 
                    success: false, 
                    error: "Preferências já registradas",
                    dataRegistro: existente.dataFormatada
                };
            }

            const infoTemporal = gerarInfoTemporal();
            const resultado = await db.collection('preferencias').insertOne({
                ...dados,
                turma: dados.turma.trim().toUpperCase(),
                nome: dados.nome.trim().toUpperCase(),
                ...infoTemporal
            });

            // Limpar cache relacionado
            cache.clear();

            return { 
                success: true, 
                id: resultado.insertedId,
                timestamp: infoTemporal.timestamp
            };
        } catch (error) {
            console.error("❌ Erro ao salvar preferências:", error);
            throw error;
        }
    },

    async salvarPreferenciasComTransacao(dados) {
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                const db = await conectar();
                const existente = await db.collection('preferencias').findOne({
                    turma: dados.turma.trim().toUpperCase(),
                    nome: dados.nome.trim().toUpperCase()
                });

                if (existente) {
                    return { 
                        success: false, 
                        error: "Preferências já registradas",
                        dataRegistro: existente.dataFormatada
                    };
                }

                const infoTemporal = gerarInfoTemporal();
                const resultado = await db.collection('preferencias').insertOne({
                    ...dados,
                    turma: dados.turma.trim().toUpperCase(),
                    nome: dados.nome.trim().toUpperCase(),
                    ...infoTemporal
                });

                // Limpar cache relacionado
                cache.clear();

                return { 
                    success: true, 
                    id: resultado.insertedId,
                    timestamp: infoTemporal.timestamp
                };
            });
        } finally {
            await session.endSession();
        }
    },

    async buscarPreferencias(turma, nome) {
        try {
            const cacheKey = `pref:${turma}:${nome}`;
            const cachedResult = cache.get(cacheKey);
            
            if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
                return cachedResult.data;
            }

            const db = await conectar();
            const result = await db.collection('preferencias')
                .find({ 
                    turma: turma.trim().toUpperCase(), 
                    nome: nome.trim().toUpperCase() 
                })
                .sort({ timestamp: -1 })
                .limit(1)
                .toArray();

            cache.set(cacheKey, { data: result, timestamp: Date.now() });
            limparCacheSeNecessario();
            return result;
        } catch (error) {
            console.error("❌ Erro ao buscar preferências:", error);
            throw error;
        }
    },

    async obterEstatisticas() {
        try {
            const cacheKey = 'estatisticas';
            const cachedStats = cache.get(cacheKey);
            
            if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL) {
                return cachedStats.data;
            }

            const db = await conectar();
            const stats = {
                totalAlunos: await db.collection('alunos').countDocuments(),
                totalPreferencias: await db.collection('preferencias').countDocuments(),
                
                preferenciasPorTurma: await db.collection('preferencias')
                    .aggregate([
                        { $group: { _id: "$turma", total: { $sum: 1 } } },
                        { $sort: { _id: 1 } }
                    ]).toArray(),
                
                preferenciasPorPeriodo: await db.collection('preferencias')
                    .aggregate([
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
                    ]).toArray()
            };

            cache.set(cacheKey, { data: stats, timestamp: Date.now() });
            limparCacheSeNecessario();
            return stats;
        } catch (error) {
            console.error("❌ Erro ao obter estatísticas:", error);
            throw error;
        }
    },

    async verificarSaude() {
        try {
            const db = await conectar();
            await db.command({ ping: 1 });
            return {
                status: 'healthy',
                latencia: await this.medirLatencia(),
                cacheSize: cache.size,
                connected: !!dbConnection
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                connected: false
            };
        }
    },

    async medirLatencia() {
        const inicio = Date.now();
        await this.client.db().command({ ping: 1 });
        return Date.now() - inicio;
    }
};

async function desconectar() {
    try {
        await client.close();
        dbConnection = null;
        cache.clear();
        console.log("✅ Desconectado do MongoDB");
    } catch (error) {
        console.error("❌ Erro ao desconectar:", error);
        throw error;
    }
}

// Tratamento de encerramento
process.on('SIGINT', async () => {
    await desconectar();
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('❌ Erro não tratado:', error);
    await desconectar();
    process.exit(1);
});

module.exports = {
    conectar,
    desconectar,
    db,
    client
};