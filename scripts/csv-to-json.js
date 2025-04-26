const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'data', 'professores.csv');
const outputFile = path.join(__dirname, '..', 'data', 'professores_com_foto.json');

const alunos = [];

fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (row) => {
        alunos.push({
            disciplina: row.disciplina?.trim(),
            nome: row.nome?.trim()
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