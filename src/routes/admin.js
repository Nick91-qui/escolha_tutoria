const express = require('express');
const router = express.Router();
const { conectar } = require('../config/db');
const ExcelJS = require('exceljs');

// Rota para estatísticas gerais
router.get('/estatisticas', async (req, res) => {
    try {
        console.log('Iniciando busca de estatísticas...');
        const db = await conectar();
        
        // Total de alunos e escolhas
        const totalAlunos = await db.collection('alunos').countDocuments();
        const totalEscolhas = await db.collection('preferencias').countDocuments();

        console.log(`Totais - Alunos: ${totalAlunos}, Escolhas: ${totalEscolhas}`);

        // Estatísticas por turma
        const estatisticasTurmas = await db.collection('alunos')
            .aggregate([
                {
                    $group: {
                        _id: "$turma",
                        total: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'preferencias',
                        localField: '_id',
                        foreignField: 'turma',
                        as: 'preferencias'
                    }
                },
                {
                    $project: {
                        turma: '$_id',
                        total: 1,
                        escolheram: { $size: '$preferencias' },
                        _id: 0
                    }
                },
                { $sort: { turma: 1 } }
            ]).toArray();

        // Estatísticas por professor
        const estatisticasProfessores = await db.collection('preferencias')
            .aggregate([
                { $unwind: { 
                    path: '$preferencias',
                    includeArrayIndex: 'posicao'
                }},
                {
                    $group: {
                        _id: {
                            professor: '$preferencias',
                            posicao: '$posicao'
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: '$_id.professor',
                        escolhas: {
                            $push: {
                                posicao: '$_id.posicao',
                                quantidade: '$count'
                            }
                        }
                    }
                },
                {
                    $project: {
                        nome: '$_id',
                        primeira: {
                            $ifNull: [{
                                $first: {
                                    $filter: {
                                        input: '$escolhas',
                                        as: 'escolha',
                                        cond: { $eq: ['$$escolha.posicao', 0] }
                                    }
                                }
                            }, { quantidade: 0 }]
                        },
                        segunda: {
                            $ifNull: [{
                                $first: {
                                    $filter: {
                                        input: '$escolhas',
                                        as: 'escolha',
                                        cond: { $eq: ['$$escolha.posicao', 1] }
                                    }
                                }
                            }, { quantidade: 0 }]
                        },
                        terceira: {
                            $ifNull: [{
                                $first: {
                                    $filter: {
                                        input: '$escolhas',
                                        as: 'escolha',
                                        cond: { $eq: ['$$escolha.posicao', 2] }
                                    }
                                }
                            }, { quantidade: 0 }]
                        }
                    }
                },
                {
                    $project: {
                        nome: 1,
                        primeira: '$primeira.quantidade',
                        segunda: '$segunda.quantidade',
                        terceira: '$terceira.quantidade'
                    }
                },
                { $sort: { nome: 1 } }
            ]).toArray();

        const resultado = {
            totalAlunos,
            totalEscolhas,
            estatisticasTurmas,
            estatisticasProfessores
        };

        console.log('Resultado das estatísticas:', resultado);
        res.json(resultado);

    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ 
            erro: 'Erro ao buscar estatísticas',
            detalhes: error.message 
        });
    }
});

// Rota para alunos pendentes
router.get('/alunos-pendentes', async (req, res) => {
    try {
        const db = await conectar();
        
        const alunosPendentes = await db.collection('alunos')
            .aggregate([
                {
                    $lookup: {
                        from: 'preferencias',
                        let: { 
                            alunoNome: '$nome',
                            alunoTurma: '$turma'
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$nome', '$$alunoNome'] },
                                            { $eq: ['$turma', '$$alunoTurma'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'preferencias'
                    }
                },
                {
                    $match: {
                        'preferencias': { $size: 0 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        nome: 1,
                        turma: 1
                    }
                },
                { $sort: { turma: 1, nome: 1 } }
            ]).toArray();

        console.log(`Encontrados ${alunosPendentes.length} alunos pendentes`);
        res.json({ alunos: alunosPendentes });

    } catch (error) {
        console.error('Erro ao buscar alunos pendentes:', error);
        res.status(500).json({ erro: 'Erro ao buscar alunos pendentes' });
    }
});

// Exportar para CSV
router.get('/exportar-csv', async (req, res) => {
    try {
        console.log('Iniciando exportação CSV...');
        const db = await conectar();
        const preferencias = await db.collection('preferencias').find().toArray();

        // Criar cabeçalho do CSV
        const cabecalho = ['Turma', 'Nome', 'Data de Registro'];
        // Encontrar o número máximo de preferências
        const maxPreferencias = Math.max(...preferencias.map(p => p.preferencias.length));
        for (let i = 0; i < maxPreferencias; i++) {
            cabecalho.push(`${i + 1}ª Escolha`);
        }
        
        // Criar linhas de dados
        const linhas = preferencias.map(p => {
            const dataRegistro = new Date(p.dataCriacao).toLocaleString('pt-BR');
            const linha = [
                p.turma,
                p.nome,
                dataRegistro,
                ...p.preferencias.map(pref => pref || '') // Preenche com vazio se não houver preferência
            ];
            // Preencher com vazios se houver menos preferências que o máximo
            while (linha.length < cabecalho.length) {
                linha.push('');
            }
            return linha.join(',');
        });

        // Juntar cabeçalho e linhas
        const csv = [cabecalho.join(','), ...linhas].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=preferencias.csv');
        res.send(csv);

        console.log('CSV exportado com sucesso');
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
        res.status(500).json({ erro: 'Erro ao exportar CSV' });
    }
});

// Exportar para Excel
router.get('/exportar-excel', async (req, res) => {
    try {
        console.log('Iniciando exportação Excel...');
        const db = await conectar();
        
        // Buscar dados
        const preferencias = await db.collection('preferencias').find().toArray();
        const alunos = await db.collection('alunos').find().toArray();

        // Preparar dados para o Excel
        const dadosPreferencias = preferencias.map(p => {
            const linha = {
                Turma: p.turma,
                Nome: p.nome,
                'Data de Registro': new Date(p.dataCriacao).toLocaleString('pt-BR')
            };

            // Adicionar preferências
            p.preferencias.forEach((pref, index) => {
                linha[`${index + 1}ª Escolha`] = pref;
            });

            return linha;
        });

        // Criar planilha de preferências
        const wb = new ExcelJS.Workbook();
        const wsPreferencias = wb.addWorksheet('Preferências');
        wsPreferencias.addRows(dadosPreferencias);

        // Preparar dados de alunos pendentes
        const alunosPendentes = alunos.filter(aluno => 
            !preferencias.some(p => 
                p.turma === aluno.turma && p.nome === aluno.nome
            )
        );

        // Criar planilha de alunos pendentes
        const wsAlunosPendentes = wb.addWorksheet('Alunos Pendentes');
        wsAlunosPendentes.addRows(
            alunosPendentes.map(a => ({
                Turma: a.turma,
                Nome: a.nome
            }))
        );

        // Gerar arquivo
        const buffer = await wb.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=preferencias.xlsx');
        res.send(buffer);

        console.log('Excel exportado com sucesso');
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        res.status(500).json({ erro: 'Erro ao exportar Excel' });
    }
});

module.exports = router;