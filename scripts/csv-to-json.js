const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'data', 'alunos.csv');
const outputFile = path.join(__dirname, '..', 'data', 'alunos.json');

const alunos = [];

fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (row) => {
        alunos.push({
            turma: row.turma?.trim(),
            nome: row.nomeAluno?.trim()
        });
    })
    .on('end', () => {
        fs.writeFileSync(
            outputFile, 
            JSON.stringify(alunos, null, 2),
            'utf8'
        );
        console.log(`✅ Arquivo JSON criado com ${alunos.length} alunos`);
    });