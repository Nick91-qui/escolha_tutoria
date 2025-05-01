const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = 'mongodb://localhost:27017';
const dbName = 'escola';

async function updateProfessorPhotos() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('📀 Conectado ao MongoDB');

        const db = client.db(dbName);
        const professoresCollection = db.collection('professores');

        // Ler o arquivo JSON com as fotos
        const fotosPath = path.join(__dirname, '..', 'data', 'professores_com_foto.json');
        const professoresComFoto = JSON.parse(fs.readFileSync(fotosPath, 'utf-8'));

        console.log(`📝 Encontrados ${professoresComFoto.length} professores para atualizar`);

        // Atualizar cada professor
        for (const professor of professoresComFoto) {
            const result = await professoresCollection.updateOne(
                { 
                    nome: professor.nome,
                    disciplina: professor.disciplina
                },
                {
                    $set: { foto: professor.foto }
                }
            );

            console.log(`🔄 Professor ${professor.nome} (${professor.disciplina}):`, 
                result.matchedCount ? '✅ Atualizado' : '❌ Não encontrado');
        }

        console.log('✨ Processo de atualização concluído!');

    } catch (error) {
        console.error('❌ Erro durante a atualização:', error);
    } finally {
        await client.close();
        console.log('🔌 Conexão com MongoDB fechada');
    }
}

updateProfessorPhotos().catch(console.error);