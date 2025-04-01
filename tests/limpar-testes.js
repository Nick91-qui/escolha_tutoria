// scripts/limpar-testes.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function limparDadosTeste() {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db("escola");

        // Remover alunos de teste
        const resultAlunos = await db.collection('alunos').deleteMany({
            nome: /^TESTE ALUNO/
        });

        // Remover preferências de teste
        const resultPrefs = await db.collection('preferencias').deleteMany({
            nome: /^TESTE ALUNO/
        });

        console.log(`Removidos ${resultAlunos.deletedCount} alunos de teste`);
        console.log(`Removidas ${resultPrefs.deletedCount} preferências de teste`);

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await client.close();
    }
}

limparDadosTeste();