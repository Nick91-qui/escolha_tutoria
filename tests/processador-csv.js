// processador-csv.js
const fs = require('fs');
const csv = require('csv-parse/sync');
const path = require('path');

// Variáveis de controle
let alunosProcessados = new Set();
let totalAlunos = 0;
let processados = 0;
let alunosCarregados = null; // Declaração movida para o escopo global

// Lista fixa de professores
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

// Função para carregar alunos do CSV
function carregarAlunosDoCSV() {
    try {
        const csvPath = path.join(process.cwd(), 'data', 'alunos.csv');
        console.log('Tentando ler arquivo:', csvPath);

        if (!fs.existsSync(csvPath)) {
            throw new Error(`Arquivo não encontrado: ${csvPath}`);
        }

        const csvFile = fs.readFileSync(csvPath, 'utf-8');
        const alunos = csv.parse(csvFile, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        return alunos.map(aluno => ({
            turma: aluno.turma.trim().toUpperCase(),
            nome: aluno.nomeAluno.trim().toUpperCase()
        }));
    } catch (error) {
        console.error('Erro ao ler arquivo CSV:', error);
        return [];
    }
}

// Função para gerar preferências
function gerarPreferenciasFormatadas() {
    const preferencias = PROFESSORES.map((professor, index) => ({
        professor,
        ordem: index + 1
    }));

    for (let i = preferencias.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [preferencias[i], preferencias[j]] = [preferencias[j], preferencias[i]];
    }

    return preferencias.slice(0, 3);
}

// Funções exportadas
// processador-csv.js
// ... (manter o início do arquivo igual) ...

module.exports = {
    inicializarDados: function(userContext, events, done) {
        try {
            console.log('Iniciando carregamento de dados...');

            if (!alunosCarregados) {
                console.log('Carregando alunos do CSV pela primeira vez...');
                alunosCarregados = carregarAlunosDoCSV();
                totalAlunos = alunosCarregados.length;
                console.log(`Total de alunos carregados: ${totalAlunos}`);
            }

            if (!alunosCarregados || alunosCarregados.length === 0) {
                throw new Error('Nenhum aluno foi carregado do CSV');
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
                return done(new Error('Não há mais alunos para processar'));
            }

            userContext.vars = {
                ...userContext.vars,
                turma: alunoSelecionado.turma,
                nome: alunoSelecionado.nome,
                preferencias: gerarPreferenciasFormatadas()
            };

            console.log(`Processando aluno: ${alunoSelecionado.turma} - ${alunoSelecionado.nome}`);
            return done();
        } catch (error) {
            console.error('Erro na inicialização:', error);
            return done(error);
        }
    },

    registrarResultado: function(requestParams, response, context, ee, next) {
        try {
            if (!response) {
                console.error('Resposta não disponível');
                return next();
            }

            const statusCode = response.statusCode;
            console.log(`Status da resposta: ${statusCode}`);

            if (response.body) {
                let dados;
                if (typeof response.body === 'string') {
                    dados = JSON.parse(response.body);
                } else {
                    dados = response.body;
                }

                console.log(`Resultado para ${context.vars.turma} - ${context.vars.nome}:`);
                console.log(`Status: ${statusCode}`);
                if (dados.sucesso !== undefined) {
                    console.log(`Sucesso: ${dados.sucesso}`);
                    if (!dados.sucesso && dados.erro) {
                        console.log(`Erro: ${dados.erro}`);
                    }
                } else {
                    console.log('Resposta:', dados);
                }
            }

            return next();
        } catch (error) {
            console.error('Erro ao processar resposta:', error);
            return next();
        }
    }
};