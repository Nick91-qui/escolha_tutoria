// limpar-dados.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function limparDados() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Conectado ao MongoDB com sucesso!");

        const db = client.db("escola");
        const collection = db.collection('alunos');

        console.log("\nIniciando limpeza dos dados...");

        // 1. Encontrar duplicatas
        const duplicatas = await collection.aggregate([
            {
                $group: {
                    _id: { nome: "$nome", turma: "$turma" },
                    count: { $sum: 1 },
                    ids: { $push: "$_id" }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]).toArray();

        // 2. Remover duplicatas
        for (const dup of duplicatas) {
            // Manter o primeiro registro e remover os outros
            const idsParaRemover = dup.ids.slice(1);
            await collection.deleteMany({ _id: { $in: idsParaRemover } });
            console.log(`Removidas ${idsParaRemover.length} duplicatas de ${dup._id.nome}`);
        }

        // 3. Mostrar estatísticas finais
        const estatisticas = await collection.aggregate([
            {
                $group: {
                    _id: "$turma",
                    total: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log("\nEstatísticas após limpeza:");
        estatisticas.forEach(turma => {
            console.log(`Turma ${turma._id}: ${turma.total} alunos`);
        });

        const totalFinal = await collection.countDocuments();
        console.log(`\nTotal final de alunos: ${totalFinal}`);

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

limparDados();