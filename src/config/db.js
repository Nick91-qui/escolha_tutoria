const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || "mongodb+srv://nicholascm:vQlI9iXWgmyTO5YB@cluster0.rpdnmdb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let dbConnection;

// Função para criar índices necessários
async function criarIndices(db) {
    try {
        // Índice para alunos (turma + nome)
        await db.collection('alunos').createIndex(
            { turma: 1, nome: 1 },
            { unique: true, background: true }
        );

        // Índice para preferências (turma + nome + data)
        await db.collection('preferencias').createIndex(
            { turma: 1, nome: 1 },
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
        await client.db("admin").command({ ping: 1 });
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

// Função auxiliar para gerar informações temporais
function gerarInfoTemporal() {
    const agora = new Date();
    return {
        dataCriacao: agora,
        dataFormatada: agora.toLocaleDateString('pt-BR'),
        horaFormatada: agora.toLocaleTimeString('pt-BR'),
        timestamp: agora.getTime(),
        semanaAno: getWeekNumber(agora)
    };
}

// Função para calcular a semana do ano
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
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
            
            // Verificar se já existe preferência para este aluno
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

            const resultado = await db.collection('preferencias').insertOne({
                ...dados,
                turma: dados.turma.trim().toUpperCase(),
                nome: dados.nome.trim().toUpperCase(),
                ...gerarInfoTemporal()
            });

            return { 
                success: true, 
                id: resultado.insertedId,
                timestamp: new Date()
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
                .sort({ dataCriacao: -1 })
                .limit(1)
                .toArray();
        } catch (error) {
            console.error("Erro ao buscar preferências:", error);
            throw error;
        }
    },

    // Nova função para estatísticas
    async obterEstatisticas() {
        try {
            const db = await conectar();
            const stats = {
                totalAlunos: await db.collection('alunos').countDocuments(),
                totalPreferencias: await db.collection('preferencias').countDocuments(),
                preferenciasPorTurma: await db.collection('preferencias')
                    .aggregate([
                        { $group: { _id: "$turma", total: { $sum: 1 } } },
                        { $sort: { _id: 1 } }
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

// Tratamento de erros do processo
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