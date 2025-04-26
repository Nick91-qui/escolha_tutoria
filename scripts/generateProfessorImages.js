const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

// Read the CSV file
const csvFilePath = path.join(__dirname, '..', 'data', 'professores.csv');
const imageBasePath = '/images/professores/';

try {
    // Read and parse CSV
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records = csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    // Transform data to include image URL
    const professoresComFoto = records.map(professor => ({
        nome: professor.nome,
        disciplina: professor.disciplina,
        foto: `${imageBasePath}${professor.nome.toLowerCase()}_${professor.disciplina.toLowerCase().replace(/ /g, '_')}.jpg`
    }));

    // Save as JSON for database import
    const outputPath = path.join(__dirname, '..', 'data', 'professores_com_foto.json');
    fs.writeFileSync(
        outputPath,
        JSON.stringify(professoresComFoto, null, 2)
    );

    console.log('Arquivo gerado com sucesso!');
    console.log('Exemplo de registro:');
    console.log(professoresComFoto[0]);

} catch (error) {
    console.error('Erro ao processar arquivo:', error);
}