// importar-todos-alunos.js
const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function importarTodosAlunos() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Conectado ao MongoDB com sucesso!");

        const db = client.db("escola");
        const collection = db.collection('alunos');

        // Limpar coleção existente
        await collection.deleteMany({});
        console.log("Coleção limpa. Iniciando nova importação...");

        const alunos = [];
        
        // Ler todo o CSV primeiro
        await new Promise((resolve, reject) => {
            fs.createReadStream('data/alunos.csv')
                .pipe(csv())
                .on('data', (row) => {
                    alunos.push({
                        turma: row.turma.trim(),
                        nome: row.nomeAluno.trim(),
                        dataCriacao: new Date()
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Total de alunos lidos do CSV: ${alunos.length}`);

        // Importar em lotes
        const BATCH_SIZE = 50;
        const totalBatches = Math.ceil(alunos.length / BATCH_SIZE);

        for (let i = 0; i < alunos.length; i += BATCH_SIZE) {
            const batch = alunos.slice(i, i + BATCH_SIZE);
            await collection.insertMany(batch);
            console.log(`Importado lote ${Math.ceil((i + 1) / BATCH_SIZE)} de ${totalBatches}`);
        }

        // Verificar resultados
        const estatisticas = await collection.aggregate([
            {
                $group: {
                    _id: "$turma",
                    total: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log("\nEstatísticas finais:");
        estatisticas.forEach(turma => {
            console.log(`Turma ${turma._id}: ${turma.total} alunos`);
        });

        const totalImportado = await collection.countDocuments();
        console.log(`\nTotal de alunos importados: ${totalImportado}`);

        if (totalImportado === alunos.length) {
            console.log("✅ Importação concluída com sucesso!");
        } else {
            console.log("⚠️ Alguns alunos podem não ter sido importados.");
        }

    } catch (error) {
        console.error('Erro durante a importação:', error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

importarTodosAlunos();