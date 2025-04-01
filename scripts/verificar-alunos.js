// verificar-alunos.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function verificarAlunos() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Conectado ao MongoDB com sucesso!");

        const db = client.db("escola");
        const collection = db.collection('alunos');

        // Contar total de alunos
        const total = await collection.countDocuments();
        console.log(`\nTotal de alunos no banco: ${total}`);

        // Listar alunos agrupados por turma
        console.log('\nAlunos por turma:');
        const alunosPorTurma = await collection.aggregate([
            {
                $group: {
                    _id: "$turma",
                    total: { $sum: 1 },
                    alunos: { $push: "$nome" }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        alunosPorTurma.forEach(turma => {
            console.log(`\nTurma: ${turma._id}`);
            console.log(`Total de alunos: ${turma.total}`);
            console.log('Primeiros 5 alunos:');
            turma.alunos.slice(0, 5).forEach(aluno => {
                console.log(`- ${aluno}`);
            });
        });

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

verificarAlunos();