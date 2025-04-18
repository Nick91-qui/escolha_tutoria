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

let dbConnection;

// Cache para otimização
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutos em millisegundos

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

async function conectar() {
    try {
        if (dbConnection) {
            return dbConnection;
        }

        await client.connect();
        console.log("✅ Conectado ao MongoDB com sucesso!");
        
        // Usar o nome do banco do ambiente
        const dbName = new URL(uri).pathname.substr(1) || 'escola';
        dbConnection = client.db(dbName);
        
        // Criar índices ao conectar
        await criarIndices(dbConnection);
        
        return dbConnection;
    } catch (error) {
        console.error("❌ Erro ao conectar:", error);
        throw error;
    }
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
            return stats;
        } catch (error) {
            console.error("❌ Erro ao obter estatísticas:", error);
            throw error;
        }
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