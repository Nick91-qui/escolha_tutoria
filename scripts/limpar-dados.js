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
        
        console.log("\nIniciando limpeza dos dados...");

        // 1. Backup das coleções (opcional)
        const backupAlunos = await db.collection('alunos').find({}).toArray();
        const backupPreferencias = await db.collection('preferencias').find({}).toArray();
        const backupProfessores = await db.collection('professores').find({}).toArray();

        console.log("\nStatus antes da limpeza:");
        console.log(`Alunos: ${backupAlunos.length}`);
        console.log(`Preferências: ${backupPreferencias.length}`);
        console.log(`Professores: ${backupProfessores.length}`);

        // 2. Limpar todas as coleções
        await db.collection('alunos').deleteMany({});
        await db.collection('preferencias').deleteMany({});
        await db.collection('professores').deleteMany({});

        console.log("\nTodas as coleções foram limpas!");

        // 3. Remover índices existentes
        await db.collection('alunos').dropIndexes();
        await db.collection('preferencias').dropIndexes();
        await db.collection('professores').dropIndexes();

        console.log("Índices removidos!");

        // 4. Recriar índices necessários
        await db.collection('alunos').createIndex(
            { turma: 1, nome: 1 },
            { unique: true }
        );

        await db.collection('preferencias').createIndex(
            { turma: 1, nome: 1 }
        );

        console.log("Novos índices criados!");

        // 5. Verificar estado final
        const estatisticasFinal = {
            alunos: await db.collection('alunos').countDocuments(),
            preferencias: await db.collection('preferencias').countDocuments(),
            professores: await db.collection('professores').countDocuments()
        };

        console.log("\nStatus final do banco:");
        console.log(`Alunos: ${estatisticasFinal.alunos}`);
        console.log(`Preferências: ${estatisticasFinal.preferencias}`);
        console.log(`Professores: ${estatisticasFinal.professores}`);

        console.log("\nLimpeza concluída com sucesso!");
        console.log("Para recarregar os dados, execute:");
        console.log("1. node scripts/importar-alunos.js");
        console.log("2. node scripts/importar-professores.js");

    } catch (error) {
        console.error('Erro durante a limpeza:', error);
    } finally {
        await client.close();
        console.log("\nConexão com o banco fechada");
        process.exit(0);
    }
}

// Adicionar confirmação antes de limpar
console.log("⚠️  ATENÇÃO: Este script irá limpar todos os dados do banco!");
console.log("Digite 'CONFIRMAR' para prosseguir...");

process.stdin.on('data', data => {
    const input = data.toString().trim();
    if (input === 'CONFIRMAR') {
        limparDados();
    } else {
        console.log("Operação cancelada!");
        process.exit(0);
    }
});