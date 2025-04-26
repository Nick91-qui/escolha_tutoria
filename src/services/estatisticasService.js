const { conectar } = require('../config/db');

class EstatisticasService {
    async getEstatisticasGerais() {
        const db = await conectar();
        
        const [totalAlunos, totalEscolhas] = await Promise.all([
            db.collection('alunos').countDocuments(),
            db.collection('preferencias').countDocuments()
        ]);

        const estatisticasTurmas = await db.collection('alunos')
            .aggregate([
                {
                    $lookup: {
                        from: "preferencias",
                        localField: "nome",
                        foreignField: "nome",
                        as: "preferencias"
                    }
                },
                {
                    $group: {
                        _id: "$turma",
                        total: { $sum: 1 },
                        alunosComEscolha: {
                            $sum: {
                                $cond: [
                                    { $gt: [{ $size: "$preferencias" }, 0] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                },
                {
                    $project: {
                        turma: "$_id",
                        total: 1,
                        alunosComEscolha: 1,
                        alunosSemEscolha: {
                            $subtract: ["$total", "$alunosComEscolha"]
                        },
                        percentualConcluido: {
                            $multiply: [
                                { $divide: ["$alunosComEscolha", "$total"] },
                                100
                            ]
                        }
                    }
                },
                { $sort: { turma: 1 } }
            ]).toArray();

        const estatisticasProfessores = await db.collection('preferencias')
            .aggregate([
                { $unwind: { path: '$preferencias', includeArrayIndex: 'posicao' }},
                {
                    $lookup: {
                        from: "professores",
                        localField: "preferencias",
                        foreignField: "_id",
                        as: "professorInfo"
                    }
                },
                {
                    $unwind: "$professorInfo"
                },
                {
                    $group: {
                        _id: {
                            professor: "$preferencias",
                            professorNome: "$professorInfo.nome",
                            professorDisciplina: "$professorInfo.disciplina",
                            posicao: "$posicao"
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: {
                            id: "$_id.professor",
                            nome: "$_id.professorNome",
                            disciplina: "$_id.professorDisciplina"
                        },
                        escolhas: {
                            $push: {
                                posicao: "$_id.posicao",
                                count: "$count"
                            }
                        },
                        total: { $sum: "$count" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        professor: {
                            id: "$_id.id",
                            nome: "$_id.nome",
                            disciplina: "$_id.disciplina"
                        },
                        escolhas: 1,
                        total: 1
                    }
                },
                { $sort: { total: -1 } }
            ]).toArray();

        return {
            totalAlunos,
            totalEscolhas,
            percentualConcluido: totalAlunos ? (totalEscolhas / totalAlunos) * 100 : 0,
            estatisticasTurmas,
            estatisticasProfessores
        };
    }

    async getAlunosPendentes() {
        const db = await conectar();
        
        return await db.collection('alunos')
            .aggregate([
                {
                    $lookup: {
                        from: "preferencias",
                        localField: "nome",
                        foreignField: "nome",
                        as: "escolhas"
                    }
                },
                {
                    $match: {
                        escolhas: { $size: 0 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        nome: 1,
                        turma: 1,
                        dataCriacao: 1
                    }
                },
                { $sort: { turma: 1, nome: 1 } }
            ]).toArray();
    }

    async getEstatisticasPorPeriodo(dataInicio, dataFim) {
        const db = await conectar();
        
        return await db.collection('preferencias')
            .aggregate([
                {
                    $match: {
                        dataCriacao: {
                            $gte: new Date(dataInicio),
                            $lte: new Date(dataFim)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$dataCriacao"
                            }
                        },
                        total: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]).toArray();
    }

    async getDashboardData() {
        const [estatisticasGerais, alunosPendentes] = await Promise.all([
            this.getEstatisticasGerais(),
            this.getAlunosPendentes()
        ]);

        return {
            ...estatisticasGerais,
            alunosPendentes: alunosPendentes.length,
            listaAlunosPendentes: alunosPendentes
        };
    }
}

module.exports = new EstatisticasService();