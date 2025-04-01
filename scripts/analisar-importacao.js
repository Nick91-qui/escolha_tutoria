// analisar-importacao.js
const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function analisarImportacao() {
    const client = new MongoClient(uri);
    const csvAlunos = [];
    
    try {
        await client.connect();
        console.log("Conectado ao MongoDB com sucesso!");

        const db = client.db("escola");
        const collection = db.collection('alunos');

        // Ler CSV
        console.log("\nLendo arquivo CSV...");
        await new Promise((resolve, reject) => {
            fs.createReadStream('alunos.csv')
                .pipe(csv())
                .on('data', (row) => {
                    csvAlunos.push({
                        turma: row.turma.trim(),
                        nome: row.nomeAluno.trim()
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Total de alunos no CSV: ${csvAlunos.length}`);

        // Dados do MongoDB
        const mongoAlunos = await collection.find({}).toArray();
        console.log(`Total de alunos no MongoDB: ${mongoAlunos.length}`);

        // Análise por turma
        const turmasCSV = {};
        csvAlunos.forEach(aluno => {
            turmasCSV[aluno.turma] = (turmasCSV[aluno.turma] || 0) + 1;
        });

        const turmasMongo = {};
        mongoAlunos.forEach(aluno => {
            turmasMongo[aluno.turma] = (turmasMongo[aluno.turma] || 0) + 1;
        });

        console.log("\nDistribuição por turma:");
        console.log("Turma | CSV | MongoDB");
        console.log("-".repeat(30));
        
        const todasTurmas = [...new Set([...Object.keys(turmasCSV), ...Object.keys(turmasMongo)])].sort();
        todasTurmas.forEach(turma => {
            console.log(`${turma} | ${turmasCSV[turma] || 0} | ${turmasMongo[turma] || 0}`);
        });

        // Encontrar alunos não importados
        console.log("\nVerificando alunos não importados...");
        const naoImportados = csvAlunos.filter(csvAluno => {
            return !mongoAlunos.some(mongoAluno => 
                mongoAluno.turma === csvAluno.turma && 
                mongoAluno.nome === csvAluno.nome
            );
        });

        if (naoImportados.length > 0) {
            console.log(`\nAlunos não importados (primeiros 10):`);
            naoImportados.slice(0, 10).forEach(aluno => {
                console.log(`- ${aluno.nome} (Turma: ${aluno.turma})`);
            });
            console.log(`... e mais ${naoImportados.length - 10} alunos`);
        }

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

analisarImportacao();