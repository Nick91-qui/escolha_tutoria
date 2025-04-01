// importar-professores.js
const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function importarProfessores() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Conectado ao MongoDB com sucesso!");

        const db = client.db("escola");
        const collection = db.collection('professores');

        // Limpar coleção existente
        await collection.deleteMany({});
        console.log("Coleção de professores limpa. Iniciando importação...");

        const professores = [];
        
        // Ler CSV
        await new Promise((resolve, reject) => {
            fs.createReadStream('professores.csv')
                .pipe(csv())
                .on('data', (row) => {
                    professores.push({
                        nome: row.nome.trim(),
                        disciplina: row.disciplina.trim(),
                        dataCriacao: new Date()
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (professores.length > 0) {
            await collection.insertMany(professores);
            console.log(`\nProfessores importados com sucesso!`);
            console.log('\nLista de professores:');
            professores.forEach(prof => {
                console.log(`- ${prof.nome} (${prof.disciplina})`);
            });
        }

        console.log(`\nTotal de professores importados: ${professores.length}`);

    } catch (error) {
        console.error('Erro durante a importação:', error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

importarProfessores();