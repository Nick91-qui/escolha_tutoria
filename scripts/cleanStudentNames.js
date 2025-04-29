const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'data', 'alunos.csv');
const outputFile = path.join(__dirname, '..', 'data', 'alunos_clean.csv');

// Strings to remove with correct encoding
const stringsToRemove = [
    '(Vice Líder)',
    '(Líder)',
    '(L\u00edder)', // Unicode for í
    '(L�der)',
    '(transf.)',
    '(Ativa)',
    '(Transferido)'
];

// Read the CSV file with latin1 encoding for special characters
let data = fs.readFileSync(inputFile, 'latin1');

// Remove specific strings
stringsToRemove.forEach(str => {
    data = data.replace(new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
});

// Split into lines, clean each line and rejoin
const lines = data.split('\n').map(line => {
    return line.trim().replace(/\s+/g, ' ');
});

// Join back with newlines
const cleanedData = lines.join('\n');

// Write the cleaned data
fs.writeFileSync(outputFile, cleanedData, 'latin1');

console.log('CSV file cleaned successfully!');