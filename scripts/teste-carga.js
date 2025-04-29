const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Configurações do teste
const CONFIG = {
    URL_SISTEMA: 'http://localhost:3001',
    TOTAL_ALUNOS_TESTE: 5,       // Apenas 5 alunos para teste
    TIMEOUT_NAVEGACAO: 120000,    // 2 minutos de timeout
    DELAY_ENTRE_ACOES: 2000      // 2 segundos entre ações
};

// Estatísticas do teste
let estatisticas = {
    sucessos: 0,
    falhas: 0,
    temposResposta: [],
    erros: {}
};

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function carregarAlunos() {
    const csvPath = path.join(__dirname, '..', 'data', 'alunos.csv');
    const data = await fs.readFile(csvPath, 'utf-8');
    const linhas = data.split('\n').slice(1); // Remove o cabeçalho
    return linhas
        .filter(linha => linha.trim())
        .map(linha => {
            const [turma, nome] = linha.split(',').map(item => item.trim());
            return { nome, turma };
        })
        .slice(0, CONFIG.TOTAL_ALUNOS_TESTE);
}

async function simularEscolha(aluno) {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--window-size=1366,768']
    });

    try {
        console.log(`🔄 Iniciando teste para ${aluno.nome} (${aluno.turma})`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setDefaultNavigationTimeout(CONFIG.TIMEOUT_NAVEGACAO);

        const inicio = Date.now();

        // Login
        await page.goto(CONFIG.URL_SISTEMA);
        await delay(CONFIG.DELAY_ENTRE_ACOES);

        await page.type('#nome', aluno.nome, { delay: 100 });
        await delay(CONFIG.DELAY_ENTRE_ACOES);

        await page.select('#turma', aluno.turma);
        await delay(CONFIG.DELAY_ENTRE_ACOES);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('.btn')
        ]);
        console.log(`👤 Login realizado: ${aluno.nome}`);
        await delay(CONFIG.DELAY_ENTRE_ACOES);

        // Aguarda carregamento da página de escolhas
        await page.waitForSelector('.lista-tutores', { visible: true });
        console.log(`📋 Página de escolhas carregada: ${aluno.nome}`);
        await delay(CONFIG.DELAY_ENTRE_ACOES);

        // Seleciona 3 professores aleatoriamente
        const professores = await page.$$('.card-professor');
        console.log(`Found ${professores.length} professores`);

        // Garantir que temos professores para selecionar
        if (professores.length === 0) {
            throw new Error('Nenhum professor encontrado para seleção');
        }

        // Seleciona 3 professores aleatoriamente
        const indices = Array.from({ length: professores.length }, (_, i) => i)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        for (const indice of indices) {
            // Rola até o professor estar visível
            await professores[indice].evaluate(el => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            await delay(1000);

            // Tenta clicar de diferentes maneiras
            try {
                await professores[indice].click({ delay: 100 });
            } catch (error) {
                try {
                    // Tenta clicar usando JavaScript
                    await page.evaluate(element => {
                        element.click();
                    }, professores[indice]);
                } catch (error2) {
                    console.error(`Erro ao clicar no professor ${indice}:`, error2);
                    throw error2;
                }
            }
            await delay(CONFIG.DELAY_ENTRE_ACOES);
        }
        console.log(`✏️ Professores selecionados: ${aluno.nome}`);

        // Verifica se há professores selecionados
        const selecionados = await page.$$('.lista-escolhas .card-professor');
        if (selecionados.length === 0) {
            throw new Error('Nenhum professor foi selecionado com sucesso');
        }
        console.log(`Número de professores selecionados: ${selecionados.length}`);

        // Rola até o botão confirmar
        await page.evaluate(() => {
            const btn = document.querySelector('#btn-confirmar');
            if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await delay(1000);

        // Confirma as escolhas
        const btnConfirmar = await page.$('#btn-confirmar');
        if (!btnConfirmar) {
            throw new Error('Botão confirmar não encontrado');
        }

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            btnConfirmar.click({ delay: 100 })
        ]);
        await delay(CONFIG.DELAY_ENTRE_ACOES);

        const tempoResposta = Date.now() - inicio;
        estatisticas.temposResposta.push(tempoResposta);
        estatisticas.sucessos++;

        console.log(`✅ Sucesso - Aluno: ${aluno.nome} - Tempo: ${tempoResposta}ms`);
    } catch (error) {
        const errorMsg = error.message.split('\n')[0];
        estatisticas.falhas++;
        estatisticas.erros[errorMsg] = (estatisticas.erros[errorMsg] || 0) + 1;
        console.error(`❌ Erro - Aluno: ${aluno.nome} - ${errorMsg}`);

        // Tira screenshot em caso de erro
        try {
            const screenshotPath = path.join(__dirname, '..', 'screenshots');
            if (!fs.existsSync(screenshotPath)) {
                await fs.mkdir(screenshotPath);
            }
            await page.screenshot({
                path: path.join(screenshotPath, `erro_${aluno.nome.replace(/\s+/g, '_')}_${Date.now()}.png`),
                fullPage: true
            });
        } catch (screenshotError) {
            console.error('Erro ao salvar screenshot:', screenshotError);
        }
    } finally {
        await browser.close();
    }
}

async function executarTesteCarga() {
    console.log('🚀 Iniciando teste de carga...');
    console.log(`📊 Configurações:
    - Total de alunos: ${CONFIG.TOTAL_ALUNOS_TESTE}
    - Timeout de navegação: ${CONFIG.TIMEOUT_NAVEGACAO}ms
    - Delay entre ações: ${CONFIG.DELAY_ENTRE_ACOES}ms
    `);
    console.time('Tempo total do teste');

    const alunos = await carregarAlunos();
    console.log(`📚 ${alunos.length} alunos carregados`);

    // Executa um aluno por vez
    for (let i = 0; i < alunos.length; i++) {
        const aluno = alunos[i];
        await simularEscolha(aluno);
        console.log(`\n📈 Progresso: ${i + 1}/${alunos.length} (${((i + 1) / alunos.length * 100).toFixed(2)}%)\n`);
        await delay(5000); // 5 segundos entre cada aluno
    }

    // Calcula e exibe estatísticas
    const tempoMedioResposta = estatisticas.temposResposta.reduce((a, b) => a + b, 0) / estatisticas.temposResposta.length;
    console.log('\n📊 Estatísticas do Teste:');
    console.log(`Total de requisições: ${estatisticas.sucessos + estatisticas.falhas}`);
    console.log(`Sucessos: ${estatisticas.sucessos}`);
    console.log(`Falhas: ${estatisticas.falhas}`);
    console.log(`Tempo médio de resposta: ${tempoMedioResposta.toFixed(2)}ms`);
    
    if (Object.keys(estatisticas.erros).length > 0) {
        console.log('\n🔍 Detalhamento dos erros:');
        Object.entries(estatisticas.erros)
            .sort(([, a], [, b]) => b - a)
            .forEach(([erro, quantidade]) => {
                console.log(`${erro}: ${quantidade} ocorrências`);
            });
    }

    console.timeEnd('Tempo total do teste');
}

// Executa o teste
executarTesteCarga().catch(console.error); 