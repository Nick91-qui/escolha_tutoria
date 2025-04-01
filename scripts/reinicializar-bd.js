// scripts/reinicializar-bd.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function reinicializarBD() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Conectado ao MongoDB");

        const db = client.db("escola");

        // 1. Limpar dados existentes
        console.log("Limpando dados existentes...");
        await db.collection('alunos').deleteMany({});
        await db.collection('preferencias').deleteMany({});
        await db.collection('professores').deleteMany({});

        // 2. Recriar índices
        console.log("Recriando índices...");
        await db.collection('alunos').createIndex({ turma: 1, nome: 1 }, { unique: true });
        await db.collection('preferencias').createIndex({ turma: 1, nome: 1 });

        console.log("Banco de dados reinicializado!");
        
        // 3. Importar dados novamente
        console.log("Execute os scripts de importação:");
        console.log("1. node scripts/importar-alunos.js");
        console.log("2. node scripts/importar-professores.js");

    } catch (error) {
        console.error("Erro:", error);
    } finally {
        await client.close();
        console.log("Conexão fechada");
    }
}

reinicializarBD();