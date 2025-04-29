const puppeteer = require('puppeteer');
const { Cluster } = require('puppeteer-cluster');
const fs = require('fs');
const csv = require('csv-parser');

const BASE_URL = 'http://localhost:3000';

// Função para esperar um tempo específico
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para ler o arquivo CSV de alunos
async function lerAlunos() {
    const alunos = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream('data/alunos.csv')
            .pipe(csv())
            .on('data', (data) => {
                alunos.push({
                    nome: data.nomeAluno.trim(),
                    turma: data.turma.trim()
                });
            })
            .on('end', () => resolve(alunos))
            .on('error', reject);
    });
}

async function simularAluno(page, aluno) {
    try {
        console.log(`Iniciando simulação para ${aluno.nome} (${aluno.turma})`);
        
        // Navegar para a página
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        
        // Preencher formulário de login
        await page.type('#nome', aluno.nome);
        await page.select('#turma', aluno.turma);
        await page.click('form#form-login button[type="submit"]');
        
        // Aguardar carregamento da página de escolhas
        await page.waitForSelector('.professor-card', { timeout: 5000 });
        
        // Fazer escolhas aleatórias
        console.log(`${aluno.nome} fará 3 escolhas`);
        
        for (let i = 0; i < 3; i++) {
            // Aguardar cards de professores
            await page.waitForSelector('.professor-card:not(.disabled)', { timeout: 5000 });
            
            // Selecionar um professor aleatório
            const professores = await page.$$('.professor-card:not(.disabled)');
            if (professores.length === 0) {
                console.error(`Não há professores disponíveis para ${aluno.nome}`);
                return false;
            }
            
            const professorAleatorio = professores[Math.floor(Math.random() * professores.length)];
            const btnAdicionar = await professorAleatorio.$('.acao');
            await btnAdicionar.click();
            
            // Aguardar um pouco entre cada escolha
            await sleep(500);
        }
        
        // Confirmar escolhas
        await page.click('#btn-confirmar');
        await sleep(1000);
        
        return true;
    } catch (error) {
        console.error(`Erro com ${aluno.nome}: ${error.message}`);
        return false;
    }
}

async function runLoadTest() {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 5,
        monitor: true,
        puppeteerOptions: {
            headless: 'new',
            args: ['--no-sandbox']
        }
    });

    let sucessos = 0;
    let falhas = 0;
    const inicio = new Date();

    // Ler alunos do CSV
    const alunos = await lerAlunos();
    console.log(`Total de alunos encontrados: ${alunos.length}`);

    // Selecionar 50 alunos aleatórios
    const alunosSelecionados = alunos
        .sort(() => Math.random() - 0.5)
        .slice(0, 50);
    
    console.log(`Iniciando teste com ${alunosSelecionados.length} alunos`);

    // Executar teste para cada aluno
    await cluster.task(async ({ page, data: aluno }) => {
        const sucesso = await simularAluno(page, aluno);
        if (sucesso) sucessos++;
        else falhas++;
    });

    // Adicionar alunos à fila
    for (const aluno of alunosSelecionados) {
        cluster.queue(aluno);
    }

    // Aguardar conclusão
    await cluster.idle();
    await cluster.close();

    // Calcular estatísticas
    const fim = new Date();
    const tempoTotal = (fim - inicio) / 1000; // em segundos
    const taxaSucesso = (sucessos / alunosSelecionados.length) * 100;
    const processamentoPorSegundo = alunosSelecionados.length / tempoTotal;

    console.log('\nResultados do Teste de Carga:');
    console.log(`Total de alunos: ${alunosSelecionados.length}`);
    console.log(`Sucessos: ${sucessos}`);
    console.log(`Falhas: ${falhas}`);
    console.log(`Tempo total: ${tempoTotal.toFixed(2)} segundos`);
    console.log(`Taxa de sucesso: ${taxaSucesso.toFixed(2)}%`);
    console.log(`Taxa de processamento: ${processamentoPorSegundo.toFixed(2)} alunos/segundo`);
}

// Executar o teste
runLoadTest().catch(console.error); 