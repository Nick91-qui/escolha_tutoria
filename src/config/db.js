const { MongoClient } = require('mongodb');
require('dotenv').config();

// URL local do MongoDB com o novo nome do banco
const uri = "mongodb://localhost:27017/escola";

const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
});

let dbConnection;

async function criarIndices(db) {
    try {
        await db.collection('alunos').createIndex(
            { turma: 1, nome: 1 },
            { unique: true, background: true }
        );

        await db.collection('preferencias').createIndex(
            { turma: 1, nome: 1 },
            { background: true }
        );

        await db.collection('preferencias').createIndex(
            { timestamp: -1 },
            { background: true }
        );

        await db.collection('preferencias').createIndex(
            { dataCriacao: -1 },
            { background: true }
        );

        console.log("Índices criados/atualizados com sucesso!");
    } catch (error) {
        console.error("Erro ao criar índices:", error);
    }
}

async function conectar() {
    try {
        if (dbConnection) {
            return dbConnection;
        }

        await client.connect();
        console.log("Conectado ao MongoDB com sucesso!");
        
        dbConnection = client.db("escola");
        
        // Criar índices ao conectar
        await criarIndices(dbConnection);
        
        return dbConnection;
    } catch (error) {
        console.error("Erro ao conectar:", error);
        throw error;
    }
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

function gerarInfoTemporal() {
    const agora = new Date();
    return {
        timestamp: agora,         // Campo principal para Time-Series
        dataCriacao: agora,
        dataFormatada: agora.toLocaleDateString('pt-BR'),
        horaFormatada: agora.toLocaleTimeString('pt-BR'),
        semanaAno: getWeekNumber(agora)
    };
}

const db = {
    async verificarAluno(turma, nome) {
        try {
            const db = await conectar();
            const aluno = await db.collection('alunos').findOne({ 
                turma: turma.trim().toUpperCase(), 
                nome: nome.trim().toUpperCase() 
            });
            return { verificado: !!aluno };
        } catch (error) {
            console.error("Erro ao verificar aluno:", error);
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

            return { 
                success: true, 
                id: resultado.insertedId,
                timestamp: infoTemporal.timestamp
            };
        } catch (error) {
            console.error("Erro ao salvar preferências:", error);
            throw error;
        }
    },

    async buscarPreferencias(turma, nome) {
        try {
            const db = await conectar();
            return await db.collection('preferencias')
                .find({ 
                    turma: turma.trim().toUpperCase(), 
                    nome: nome.trim().toUpperCase() 
                })
                .sort({ timestamp: -1 })  // Ordenação pelo timestamp
                .limit(1)
                .toArray();
        } catch (error) {
            console.error("Erro ao buscar preferências:", error);
            throw error;
        }
    },

    async obterEstatisticas() {
        try {
            const db = await conectar();
            const stats = {
                totalAlunos: await db.collection('alunos').countDocuments(),
                totalPreferencias: await db.collection('preferencias').countDocuments(),
                
                // Estatísticas por turma
                preferenciasPorTurma: await db.collection('preferencias')
                    .aggregate([
                        { $group: { _id: "$turma", total: { $sum: 1 } } },
                        { $sort: { _id: 1 } }
                    ]).toArray(),
                
                // Estatísticas por período
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
            return stats;
        } catch (error) {
            console.error("Erro ao obter estatísticas:", error);
            throw error;
        }
    }
};

async function desconectar() {
    try {
        await client.close();
        dbConnection = null;
        console.log("Desconectado do MongoDB");
    } catch (error) {
        console.error("Erro ao desconectar:", error);
        throw error;
    }
}

process.on('SIGINT', async () => {
    await desconectar();
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('Erro não tratado:', error);
    await desconectar();
    process.exit(1);
});

module.exports = {
    conectar,
    desconectar,
    db,
    client
};