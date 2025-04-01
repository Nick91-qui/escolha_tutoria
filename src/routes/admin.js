const express = require('express');
const router = express.Router();
const { conectar } = require('../config/db');
const XLSX = require('xlsx');

// Rota para estatísticas gerais
router.get('/estatisticas', async (req, res) => {
    try {
        const db = await conectar();
        
        const totalAlunos = await db.collection('alunos').countDocuments();
        const totalEscolhas = await db.collection('preferencias').countDocuments();

        // Estatísticas por turma
        const estatisticasTurmas = await db.collection('alunos')
            .aggregate([
                {
                    $lookup: {
                        from: 'preferencias',
                        localField: 'nome',
                        foreignField: 'nome',
                        as: 'preferencia'
                    }
                },
                {
                    $group: {
                        _id: '$turma',
                        total: { $sum: 1 },
                        escolheram: { 
                            $sum: { 
                                $cond: [{ $gt: [{ $size: '$preferencia' }, 0] }, 1, 0]
                            }
                        }
                    }
                },
                {
                    $project: {
                        turma: '$_id',
                        total: 1,
                        escolheram: 1
                    }
                }
            ]).toArray();

        res.json({
            totalAlunos,
            totalEscolhas,
            estatisticasTurmas
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
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
                        localField: 'nome',
                        foreignField: 'nome',
                        as: 'preferencia'
                    }
                },
                {
                    $match: {
                        preferencia: { $size: 0 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        nome: 1,
                        turma: 1
                    }
                }
            ]).toArray();

        res.json({ alunos: alunosPendentes });

    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar alunos pendentes' });
    }
});

// Exportar para CSV
router.get('/exportar-csv', async (req, res) => {
    try {
        const db = await conectar();
        const preferencias = await db.collection('preferencias').find().toArray();

        const csv = preferencias.map(p => 
            `${p.turma},${p.nome},${p.preferencias.join(',')}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=preferencias.csv');
        res.send(csv);

    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao exportar CSV' });
    }
});

module.exports = router;