const fs = require('fs');
const path = require('path');

function normalizarTexto(texto) {
    return texto
        .normalize('NFD')               // decompose characters with accents
        .replace(/[\u0300-\u036f]/g, '') // remove accent marks
        .replace(/\s+/g, ' ')           // replace multiple spaces with single space
        .trim();                        // remove leading/trailing spaces
}

async function corrigirAcentos() {
    const caminhoArquivo = path.join(__dirname, '..', 'data', 'alunos.csv');
    
    try {
        console.log('📖 Lendo arquivo CSV...');
        const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
        
        console.log('🔄 Processando linhas...');
        const linhas = conteudo.split('\n');
        const linhasCorrigidas = linhas.map(linha => {
            if (!linha.trim()) return linha;
            
            const [turma, nome] = linha.split(',');
            if (!nome) return linha;
            
            return `${turma},${normalizarTexto(nome)}`;
        });

        console.log('💾 Salvando arquivo corrigido...');
        const conteudoCorrigido = linhasCorrigidas.join('\n');
        fs.writeFileSync(caminhoArquivo, conteudoCorrigido, 'utf8');
        
        // Mostrar estatísticas
        const totalLinhas = linhasCorrigidas.length;
        console.log(`\n✅ Arquivo corrigido com sucesso!`);
        console.log(`📊 Total de linhas processadas: ${totalLinhas}`);
        
        // Mostrar algumas linhas como exemplo
        console.log('\n📝 Exemplos de linhas corrigidas:');
        console.log('Primeiras 5 linhas:');
        linhasCorrigidas.slice(0, 5).forEach(l => console.log(l));
        console.log('\nÚltimas 5 linhas:');
        linhasCorrigidas.slice(-5).forEach(l => console.log(l));
        
    } catch (error) {
        console.error('❌ Erro ao corrigir arquivo:', error);
        console.error(error);
    }
}

corrigirAcentos();