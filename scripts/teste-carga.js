const { Cluster } = require('puppeteer-cluster');
const fs = require('fs').promises;
const path = require('path');

// Configurações do teste
const CONFIG = {
    USUARIOS_SIMULTANEOS: 5,      // Reduzido para 5 usuários simultâneos
    TEMPO_ENTRE_USUARIOS: 1000,   // Aumentado para 1 segundo
    URL_SISTEMA: 'http://localhost:3001',
    HEADLESS: true,
    TOTAL_ALUNOS_TESTE: 20,      // Reduzido para 20 alunos inicialmente
    TIMEOUT_NAVEGACAO: 60000,     // 1 minuto de timeout
    RETRY_LIMIT: 3               // Número de tentativas por aluno
};

// Estatísticas do teste
let estatisticas = {
    sucessos: 0,
    falhas: 0,
    tempoMedioResposta: 0,
    temposResposta: [],
    erros: {},
    tentativas: {}
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
        .slice(0, CONFIG.TOTAL_ALUNOS_TESTE); // Limita o número de alunos
}

async function simularEscolha(page, aluno) {
    const inicio = Date.now();
    
    // Inicializa contador de tentativas
    if (!estatisticas.tentativas[aluno.nome]) {
        estatisticas.tentativas[aluno.nome] = 0;
    }
    estatisticas.tentativas[aluno.nome]++;

    try {
        console.log(`🔄 Iniciando teste para ${aluno.nome} (${aluno.turma}) - Tentativa ${estatisticas.tentativas[aluno.nome]}`);
        
        // Configurações iniciais da página
        await page.setDefaultNavigationTimeout(CONFIG.TIMEOUT_NAVEGACAO);
        await page.setViewport({ width: 1366, height: 768 });

        // Login
        await page.goto(CONFIG.URL_SISTEMA, { 
            waitUntil: 'networkidle0',
            timeout: CONFIG.TIMEOUT_NAVEGACAO
        });
        
        await page.waitForSelector('#nome', { timeout: 10000 });
        await page.type('#nome', aluno.nome);
        await page.waitForSelector('#turma', { timeout: 10000 });
        await page.select('#turma', aluno.turma);
        
        await Promise.all([
            page.waitForNavigation({ 
                waitUntil: 'networkidle0',
                timeout: CONFIG.TIMEOUT_NAVEGACAO
            }),
            page.click('.btn')
        ]);
        console.log(`👤 Login realizado: ${aluno.nome}`);

        // Aguarda carregamento da página de escolhas
        await page.waitForSelector('.lista-tutores', { 
            visible: true,
            timeout: CONFIG.TIMEOUT_NAVEGACAO
        });
        console.log(`📋 Página de escolhas carregada: ${aluno.nome}`);

        // Aguarda um momento para garantir que os professores estão carregados
        await delay(2000);

        // Seleciona 3 professores aleatoriamente
        const professores = await page.$$('.card-professor');
        const indices = Array.from({ length: professores.length }, (_, i) => i)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        for (const indice of indices) {
            await professores[indice].evaluate(el => el.click());
            await delay(1000);
        }
        console.log(`✏️ Professores selecionados: ${aluno.nome}`);

        // Confirma as escolhas
        await Promise.all([
            page.waitForNavigation({ 
                waitUntil: 'networkidle0',
                timeout: CONFIG.TIMEOUT_NAVEGACAO
            }),
            page.click('#btn-confirmar')
        ]);
        await delay(2000);

        const tempoResposta = Date.now() - inicio;
        estatisticas.temposResposta.push(tempoResposta);
        estatisticas.sucessos++;

        console.log(`✅ Sucesso - Aluno: ${aluno.nome} - Tempo: ${tempoResposta}ms`);
        return true;
    } catch (error) {
        const errorMsg = error.message.split('\n')[0];
        console.error(`❌ Erro - Aluno: ${aluno.nome} - ${errorMsg}`);
        
        // Se ainda não atingiu o limite de tentativas, retorna false para tentar novamente
        if (estatisticas.tentativas[aluno.nome] < CONFIG.RETRY_LIMIT) {
            await delay(5000); // Espera 5 segundos antes de tentar novamente
            return false;
        }
        
        // Se atingiu o limite de tentativas, registra como falha
        estatisticas.falhas++;
        estatisticas.erros[errorMsg] = (estatisticas.erros[errorMsg] || 0) + 1;
        return true;
    }
}

async function executarTesteCarga() {
    console.log('🚀 Iniciando teste de carga...');
    console.log(`📊 Configurações:
    - Usuários simultâneos: ${CONFIG.USUARIOS_SIMULTANEOS}
    - Tempo entre usuários: ${CONFIG.TEMPO_ENTRE_USUARIOS}ms
    - Total de alunos: ${CONFIG.TOTAL_ALUNOS_TESTE}
    - Timeout de navegação: ${CONFIG.TIMEOUT_NAVEGACAO}ms
    - Limite de tentativas: ${CONFIG.RETRY_LIMIT}
    `);
    console.time('Tempo total do teste');

    const alunos = await carregarAlunos();
    console.log(`📚 ${alunos.length} alunos carregados`);

    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: CONFIG.USUARIOS_SIMULTANEOS,
        puppeteerOptions: {
            headless: CONFIG.HEADLESS,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1366,768'
            ]
        },
        monitor: true,
        timeout: CONFIG.TIMEOUT_NAVEGACAO
    });

    // Evento para quando uma tarefa falhar
    cluster.on('taskerror', (err, data) => {
        console.error(`Erro na tarefa para ${data.nome}: ${err.message}`);
    });

    let completados = 0;
    const total = alunos.length;

    // Adiciona as tarefas ao cluster
    for (const aluno of alunos) {
        let concluido = false;
        while (!concluido) {
            concluido = await cluster.execute(aluno, async ({ page, data: aluno }) => {
                return await simularEscolha(page, aluno);
            });
            
            if (concluido) {
                completados++;
                const porcentagem = ((completados / total) * 100).toFixed(2);
                console.log(`\n📈 Progresso: ${completados}/${total} (${porcentagem}%)\n`);
            }
        }
        await delay(CONFIG.TEMPO_ENTRE_USUARIOS);
    }

    await cluster.idle();
    await cluster.close();

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

    console.log('\n📊 Tentativas por aluno:');
    Object.entries(estatisticas.tentativas)
        .forEach(([aluno, tentativas]) => {
            console.log(`${aluno}: ${tentativas} tentativa(s)`);
        });

    console.timeEnd('Tempo total do teste');
}

// Executa o teste
executarTesteCarga().catch(console.error); 