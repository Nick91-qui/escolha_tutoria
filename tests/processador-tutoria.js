// processador-tutoria.js
const fs = require('fs');
const readline = require('readline');
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

let alunosProcessados = new Set();
let totalAlunos = 0;
let alunosCarregados = null;

function gerarPreferencias() {
    const professoresDisponiveis = [...PROFESSORES];
    const preferencias = [];
    
    for (let i = 0; i < 3; i++) {
        const index = Math.floor(Math.random() * professoresDisponiveis.length);
        preferencias.push(professoresDisponiveis.splice(index, 1)[0]);
    }
    
    return preferencias;
}

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

        return alunos;
    } catch (error) {
        console.error('❌ Erro ao ler arquivo CSV:', error);
        return [];
    }
}

module.exports = {
    inicializarDados: function(userContext, events, done) {
        try {
            if (!alunosCarregados) {
                console.log('🔄 Carregando alunos do CSV pela primeira vez...');
                alunosCarregados = carregarAlunosDoCSV();
                totalAlunos = alunosCarregados.length;
                console.log(`📋 Total de alunos carregados: ${totalAlunos}`);
            }

            if (!alunosCarregados || alunosCarregados.length === 0) {
                return done(new Error('⚠️ Nenhum aluno foi carregado do CSV'));
            }

            let alunoSelecionado = null;
            for (const aluno of alunosCarregados) {
                const chaveAluno = `${aluno.turma}-${aluno.nome}`;
                if (!alunosProcessados.has(chaveAluno)) {
                    alunoSelecionado = aluno;
                    alunosProcessados.add(chaveAluno);
                    break;
                }
            }

            if (!alunoSelecionado) {
                console.log('✅ Todos os alunos foram processados!');
                return done(new Error('Processamento completo'));
            }

            const preferencias = gerarPreferencias();

            userContext.vars = {
                ...userContext.vars,
                turma: alunoSelecionado.turma,
                nome: alunoSelecionado.nome,
                preferencias: preferencias
            };

            console.log(`📝 Processando: ${alunoSelecionado.nome} (${alunoSelecionado.turma})`);
            console.log(`🎯 Preferências: ${preferencias.join(', ')}`);

            const processados = alunosProcessados.size;
            if (processados % 10 === 0 || processados === totalAlunos) {
                const percentual = ((processados / totalAlunos) * 100).toFixed(2);
                console.log(`📊 Progresso: ${processados}/${totalAlunos} (${percentual}%)`);
            }

            return done();
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            return done(error);
        }
    },

    registrarResultado: function(requestParams, response, context, ee, next) {
        try {
            if (!response) {
                console.error('❌ Resposta não disponível');
                return next();
            }

            const statusCode = response.statusCode;
            const aluno = `${context.vars.nome} (${context.vars.turma})`;

            if (statusCode === 200) {
                console.log(`✅ ${aluno}: Preferências registradas com sucesso`);
            } else {
                let mensagemErro = '';
                try {
                    const dados = JSON.parse(response.body);
                    mensagemErro = dados.erro || 'Erro desconhecido';
                } catch (e) {
                    mensagemErro = response.body || 'Erro desconhecido';
                }
                console.log(`❌ ${aluno}: Erro (${statusCode}) - ${mensagemErro}`);
            }

            return next();
        } catch (error) {
            console.error('❌ Erro ao processar resposta:', error);
            return next();
        }
    }
};