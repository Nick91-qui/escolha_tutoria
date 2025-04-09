// teste-carga-tutoria.js
const fs = require('fs');
const path = require('path');

// Lista de professores tutores
const PROFESSORES = [
    "Alan Siqueira Ribeiro Pimentel",
    "Ailton Luiz Silva",
    "André Freitas Miranda",
    "Bruna Spadeto Oliveira",
    "Felipe dos Santos Guasti",
    "Gabriel Schmith dos Santos",
    "Gerlândia Estevam do Nascimento",
    "Giovana Manzoli Monteiro",
    "João Francisco Alves Mendes",
    "Kely de Jesus do Nascimento",
    "Maria Aparecida Rosa Meneguelli",
    "Nicholas Contijo Moreira",
    "Patricia Calaffi Simões Moreira",
    "Pedro Henrique Santos Oliveira",
    "Richardson Sant'Ana Pimentel",
    "Rondineli Schulthais Leite",
    "Samantha de Barbi Vieira",
    "Simone Motta",
    "Tatiana Ferreira Reis Rainha",
    "Vitoria Rodrigues Santos",
    "Wyller Carlos Silva Oliveira"
];

// Variáveis globais
let alunosCarregados = null;
let alunosProcessados = new Set();
let estatisticas = {
    totalRequests: 0,
    sucessos: 0,
    falhas: 0,
    tempoMedioResposta: 0,
    erros: {},
    inicioTeste: Date.now()
};

// Função para dormir/esperar
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para carregar alunos do CSV
function carregarAlunosDoCSV() {
    try {
        const csvPath = path.join(process.cwd(), 'data', 'alunos.csv');
        console.log('📂 Tentando ler arquivo:', csvPath);

        const conteudo = fs.readFileSync(csvPath, 'utf-8');
        const linhas = conteudo.split('\n');
        const alunos = [];

        // Pular a primeira linha (cabeçalho)
        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            if (linha) {
                const [turma, nomeAluno] = linha.split(',');
                if (turma && nomeAluno) {
                    alunos.push({
                        turma: turma.trim(),
                        nome: nomeAluno.trim()
                    });
                }
            }
        }

        console.log(`📋 Total de alunos carregados do CSV: ${alunos.length}`);
        return alunos;
    } catch (error) {
        console.error('❌ Erro ao ler arquivo CSV:', error);
        return [];
    }
}

// Função para gerar preferências aleatórias
function gerarPreferencias() {
    const professoresDisponiveis = [...PROFESSORES];
    const preferencias = [];
    
    for (let i = 0; i < 3; i++) {
        const index = Math.floor(Math.random() * professoresDisponiveis.length);
        preferencias.push(professoresDisponiveis.splice(index, 1)[0]);
    }
    
    return preferencias;
}

// Função para formatar tempo
function formatarTempo(ms) {
    const segundos = Math.floor(ms / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    
    return `${horas}h ${minutos % 60}m ${segundos % 60}s`;
}

module.exports = {
    selecionarAluno: function(userContext, events, done) {
        try {
            // Carregar alunos apenas uma vez
            if (!alunosCarregados) {
                alunosCarregados = carregarAlunosDoCSV();
                if (alunosCarregados.length === 0) {
                    return done(new Error('Nenhum aluno carregado do CSV'));
                }
            }

            // Encontrar próximo aluno não processado
            let alunoSelecionado = null;
            for (const aluno of alunosCarregados) {
                const chaveAluno = `${aluno.turma}-${aluno.nome}`;
                if (!alunosProcessados.has(chaveAluno)) {
                    alunoSelecionado = aluno;
                    alunosProcessados.add(chaveAluno);
                    break;
                }
            }

            // Se todos os alunos foram processados, reiniciar
            if (!alunoSelecionado) {
                console.log('⚠️ Todos os alunos foram processados, reiniciando lista...');
                alunosProcessados.clear();
                alunoSelecionado = alunosCarregados[0];
                alunosProcessados.add(`${alunoSelecionado.turma}-${alunoSelecionado.nome}`);
            }

            // Configurar variáveis do contexto
            userContext.vars = {
                ...userContext.vars,
                turma: alunoSelecionado.turma,
                nome: alunoSelecionado.nome,
                preferencias: gerarPreferencias()
            };

            console.log(`📝 Testando: ${alunoSelecionado.nome} (${alunoSelecionado.turma})`);
            return done();
        } catch (error) {
            console.error('❌ Erro ao selecionar aluno:', error);
            return done(error);
        }
    },

    beforeRequest: async function(requestParams, context, ee, next) {
        // Adicionar delay aleatório para evitar rajadas de requisições
        await sleep(Math.random() * 500); // Delay de até 500ms
        return next();
    },

    afterResponse: async function(requestParams, response, context, ee, next) {
        try {
            if (response.statusCode === 429) {
                const retryAfter = parseInt(response.headers['retry-after'] || '10');
                console.log(`⚠️ Rate limit atingido para ${context.vars.nome}, aguardando ${retryAfter}s...`);
                await sleep(retryAfter * 1000);
                return next(new Error('Retry needed'));
            }

            // Registrar estatísticas
            this.registrarEstatisticas(requestParams, response, context, ee, next);
            return next();
        } catch (error) {
            console.error('❌ Erro no afterResponse:', error);
            return next(error);
        }
    },

    registrarEstatisticas: function(requestParams, response, context, ee, next) {
        try {
            if (!response) return next();

            const statusCode = response.statusCode;
            const aluno = `${context.vars.nome} (${context.vars.turma})`;
            const tempoDecorrido = Date.now() - estatisticas.inicioTeste;

            // Registrar resultado
            if (statusCode === 200) {
                console.log(`✅ ${aluno}: Sucesso`);
            } else if (statusCode !== 429) {
                console.log(`❌ ${aluno}: Erro ${statusCode}`);
            }

            // Atualizar estatísticas
            estatisticas.totalRequests++;
            if (statusCode === 200) {
                estatisticas.sucessos++;
            } else {
                estatisticas.falhas++;
                estatisticas.erros[statusCode] = (estatisticas.erros[statusCode] || 0) + 1;
            }

            // Atualizar tempo médio de resposta
            if (response.timings && response.timings.elapsed) {
                const tempoAtual = response.timings.elapsed;
                estatisticas.tempoMedioResposta = (
                    (estatisticas.tempoMedioResposta * (estatisticas.totalRequests - 1) + tempoAtual) /
                    estatisticas.totalRequests
                );
            }

            // Log periódico
            if (estatisticas.totalRequests % 20 === 0) {
                this.mostrarEstatisticas(tempoDecorrido);
            }

            return next();
        } catch (error) {
            console.error('❌ Erro ao registrar estatísticas:', error);
            return next();
        }
    },

    mostrarEstatisticas: function(tempoDecorrido) {
        console.log('\n=== Estatísticas Atuais ===');
        console.log(`⏱️  Tempo de teste: ${formatarTempo(tempoDecorrido)}`);
        console.log(`📊 Total de requisições: ${estatisticas.totalRequests}`);
        console.log(`✅ Sucessos: ${estatisticas.sucessos}`);
        console.log(`❌ Falhas: ${estatisticas.falhas}`);
        console.log(`⚡ Tempo médio de resposta: ${estatisticas.tempoMedioResposta.toFixed(2)}ms`);
        
        if (Object.keys(estatisticas.erros).length > 0) {
            console.log('🚫 Erros por status:', estatisticas.erros);
        }

        const taxaSucesso = ((estatisticas.sucessos / estatisticas.totalRequests) * 100).toFixed(2);
        console.log(`📈 Taxa de sucesso: ${taxaSucesso}%`);
        console.log('========================\n');
    }
};