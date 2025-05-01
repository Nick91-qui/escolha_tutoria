const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function importarTodosAlunos() {
    const client = new MongoClient(uri);

    try {
        // Ler arquivo JSON
        console.log('📖 Lendo arquivo de alunos...');
        const alunosJson = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'data', 'alunos.json'),
                'utf8'
            )
        );
        
        console.log(`📊 Total de alunos no arquivo: ${alunosJson.length}`);

        // Normalizar dados
        const alunosNormalizados = alunosJson.map(aluno => ({
            turma: normalizarTexto(aluno.turma),
            nome: normalizarTexto(aluno.nome)
        }));

        // Conectar ao MongoDB
        await client.connect();
        console.log("✅ Conectado ao MongoDB com sucesso!");

        const targetDb = client.db('escola');
        
        // Limpar coleção de destino
        await targetDb.collection('alunos').deleteMany({});
        console.log("🗑️ Coleção de destino limpa");

        // Importar em lotes
        const BATCH_SIZE = 50;
        const totalBatches = Math.ceil(alunosNormalizados.length / BATCH_SIZE);

        for (let i = 0; i < alunosNormalizados.length; i += BATCH_SIZE) {
            const batch = alunosNormalizados.slice(i, i + BATCH_SIZE);
            await targetDb.collection('alunos').insertMany(batch);
            console.log(`📦 Importado lote ${Math.ceil((i + 1) / BATCH_SIZE)} de ${totalBatches}`);
        }

        // Criar índices
        await targetDb.collection('alunos').createIndex(
            { turma: 1, nome: 1 },
            { unique: true, background: true }
        );

        // Verificar resultados
        const totalImportado = await targetDb.collection('alunos').countDocuments();
        console.log(`\n✨ Total de alunos importados: ${totalImportado}`);

        if (totalImportado === alunosJson.length) {
            console.log("✅ Importação concluída com sucesso!");
        } else {
            console.log("⚠️ Alguns alunos podem não ter sido importados.");
        }

    } catch (error) {
        console.error('❌ Erro durante a importação:', error);
        console.error(error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

importarTodosAlunos();