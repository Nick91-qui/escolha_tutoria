const { conectar } = require('../config/db');
const { logger } = require('../config/monitor');
const { ObjectId } = require('mongodb');

class TutorAssignmentService {
    constructor() {
        this.CONFIG = {
            MAX_STUDENTS_PER_TUTOR: 19,
            MAX_PREFERENCES: 5
        };
        this.db = null;
    }

    async initialize() {
        try {
            this.db = await conectar();
            logger.info('TutorAssignmentService inicializado com sucesso');
        } catch (error) {
            logger.error('Erro ao inicializar TutorAssignmentService:', error);
            throw error;
        }
    }

    async getOrderedPreferences() {
        try {
            logger.info('Iniciando busca de preferências...');

            const preferences = await this.db.collection('preferencias')
                .aggregate([
                    {
                        $match: {
                            preferencias: { 
                                $exists: true, 
                                $ne: [] 
                            }
                        }
                    },
                    // Remover duplicatas por nome+turma
                    {
                        $group: {
                            _id: { nome: "$nome", turma: "$turma" },
                            // Pegar o registro mais recente em caso de duplicata
                            doc: { $first: "$$ROOT" },
                            dataRegistro: { $first: "$dataRegistro" }
                        }
                    },
                    {
                        $replaceRoot: { newRoot: "$doc" }
                    },
                    {
                        $lookup: {
                            from: 'assignments',
                            let: { aluno_nome: "$nome" },
                            pipeline: [
                                {
                                    $lookup: {
                                        from: 'alunos',
                                        localField: 'studentId',
                                        foreignField: '_id',
                                        as: 'aluno'
                                    }
                                },
                                { $unwind: '$aluno' },
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$aluno.nome', '$$aluno_nome']
                                        }
                                    }
                                }
                            ],
                            as: 'assignment'
                        }
                    },
                    {
                        $match: {
                            assignment: { $size: 0 }
                        }
                    },
                    {
                        $sort: { 
                            dataRegistro: 1,
                            _id: 1
                        }
                    }
                ]).toArray();

            logger.info(`Preferências encontradas: ${preferences.length}`);
            return preferences;
        } catch (error) {
            logger.error('Erro ao buscar preferências:', error);
            throw error;
        }
    }

    async getTutorCurrentCount(tutorId) {
        const count = await this.db.collection('assignments')
            .countDocuments({ tutorId: new ObjectId(tutorId) });
        return count || 0;
    }

    async assignStudentToTutor(studentId, tutorId, preferenceNumber) {
        try {
            const currentCount = await this.getTutorCurrentCount(tutorId);
            
            logger.info(`Tentando atribuir aluno ${studentId} ao tutor ${tutorId}`);
            logger.info(`Contagem atual do tutor: ${currentCount}/${this.CONFIG.MAX_STUDENTS_PER_TUTOR}`);
            
            if (currentCount >= this.CONFIG.MAX_STUDENTS_PER_TUTOR) {
                logger.info(`Tutor ${tutorId} está com capacidade máxima`);
                return false;
            }

            await this.db.collection('assignments').insertOne({
                studentId: new ObjectId(studentId),
                tutorId: new ObjectId(tutorId),
                assignmentType: preferenceNumber ? 'preference' : 'random',
                preferenceNumber,
                timestamp: new Date()
            });

            logger.info(`Atribuição criada com sucesso: aluno ${studentId} -> tutor ${tutorId}`);
            return true;
        } catch (error) {
            logger.error(`Erro ao atribuir aluno ${studentId} ao tutor ${tutorId}:`, error);
            return false;
        }
    }

    async processStudentPreferences(preference) {
        try {
            // Primeiro, buscar o ID do aluno pelo nome
            const aluno = await this.db.collection('alunos').findOne({ 
                nome: preference.nome,
                turma: preference.turma 
            });

            if (!aluno) {
                logger.error(`Aluno não encontrado: ${preference.nome} (${preference.turma})`);
                return false;
            }

            logger.info(`ID do aluno encontrado: ${aluno._id} para ${preference.nome}`);

            // Verifica preferências
            if (!preference.preferencias || !Array.isArray(preference.preferencias)) {
                logger.error(`Preferências inválidas para o aluno ${preference.nome}`);
                return false;
            }

            // Tenta atribuir para cada preferência
            for (let i = 0; i < preference.preferencias.length; i++) {
                const tutorId = preference.preferencias[i];
                const assigned = await this.assignStudentToTutor(
                    aluno._id,  // Usa o ID correto do aluno
                    tutorId,
                    i + 1
                );
                
                if (assigned) {
                    logger.info(`Aluno ${preference.nome} (${preference.turma}) atribuído ao tutor ${tutorId} como ${i + 1}ª opção`);
                    return true;
                }
            }
            
            logger.warn(`Aluno ${preference.nome} (${preference.turma}) não foi atribuído a nenhuma preferência`);
            return false;
        } catch (error) {
            logger.error(`Erro ao processar preferências do aluno ${preference.nome}:`, error);
            return false;
        }
    }

    async getAvailableTutors() {
        // Ajustado para usar campos corretos da collection professores
        const tutors = await this.db.collection('professores')
            .find({}, {
                projection: {
                    _id: 1,
                    nome: 1,
                    disciplina: 1
                }
            })
            .toArray();

        const assignments = await this.db.collection('assignments')
            .aggregate([
                {
                    $group: {
                        _id: '$tutorId',
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray();

        const tutorCounts = new Map(
            assignments.map(a => [a._id.toString(), a.count])
        );

        return tutors.filter(tutor => 
            (tutorCounts.get(tutor._id.toString()) || 0) < this.CONFIG.MAX_STUDENTS_PER_TUTOR
        );
    }

    async processAssignments() {
        if (!this.db) {
            await this.initialize();
        }
        
        try {
            // Debug: Verificar total de preferências antes do agrupamento
            const allPrefs = await this.db.collection('preferencias').find().toArray();
            logger.info(`Total de preferências antes do agrupamento: ${allPrefs.length}`);
            logger.info('Preferências brutas:', allPrefs.map(p => ({
                nome: p.nome,
                turma: p.turma,
                dataRegistro: p.dataRegistro
            })));

            // Get preferences (após agrupamento)
            const preferences = await this.getOrderedPreferences();
            logger.info(`Processando ${preferences.length} alunos após agrupamento`);
            logger.info('Preferências agrupadas:', preferences.map(p => ({
                nome: p.nome,
                turma: p.turma,
                dataRegistro: p.dataRegistro
            })));
            
            const unassignedStudents = [];
            
            // 2. Process each student
            for (const preference of preferences) {
                logger.info(`Processando aluno: ${preference.nome} (${preference.turma})`);
                logger.info(`Preferências: ${JSON.stringify(preference.preferencias)}`);
                
                const success = await this.processStudentPreferences(preference);
                
                if (!success) {
                    logger.info(`Aluno ${preference.nome} não foi atribuído, indo para lista de não atribuídos`);
                    unassignedStudents.push(preference._id);
                }
            }
            
            // 3. Handle unassigned
            logger.info(`Total de alunos não atribuídos: ${unassignedStudents.length}`);
            if (unassignedStudents.length > 0) {
                await this.processRandomAssignments(unassignedStudents);
            }

            // 4. Generate report
            const report = await this.generateAssignmentReport();
            logger.info(`Relatório final: ${JSON.stringify(report)}`);
            return report;
        } catch (error) {
            logger.error('Erro no processamento das atribuições:', error);
            throw error;
        }
    }

    async processRandomAssignments(unassignedStudents) {
        for (const studentId of unassignedStudents) {
            const availableTutors = await this.getAvailableTutors();
            
            if (availableTutors.length === 0) {
                throw new Error('Não há tutores disponíveis para atribuição aleatória');
            }

            // Escolha aleatória de tutor
            const randomIndex = Math.floor(Math.random() * availableTutors.length);
            const randomTutor = availableTutors[randomIndex];

            await this.assignStudentToTutor(
                studentId,
                randomTutor._id,
                null // preferenceNumber null indica atribuição aleatória
            );
        }
    }

    async generateAssignmentReport() {
        const assignments = await this.db.collection('assignments')
            .aggregate([
                {
                    $lookup: {
                        from: 'professores',
                        localField: 'tutorId',
                        foreignField: '_id',
                        as: 'tutor'
                    }
                },
                {
                    $lookup: {
                        from: 'alunos',
                        localField: 'studentId',
                        foreignField: '_id',
                        as: 'aluno'
                    }
                },
                {
                    $unwind: '$tutor'
                },
                {
                    $unwind: '$aluno'
                },
                {
                    $group: {
                        _id: '$tutorId',
                        tutor: { $first: '$tutor' },
                        studentCount: { $sum: 1 },
                        randomAssignments: {
                            $sum: { $cond: [{ $eq: ['$assignmentType', 'random'] }, 1, 0] }
                        },
                        students: {
                            $push: {
                                id: '$studentId',
                                nome: '$aluno.nome',
                                turma: '$aluno.turma'
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        'tutor.nome': 1,
                        'tutor.disciplina': 1,
                        studentCount: 1,
                        randomAssignments: 1,
                        students: 1
                    }
                }
            ]).toArray();

        return {
            totalAssignments: assignments.reduce((acc, curr) => acc + curr.studentCount, 0),
            randomAssignments: assignments.reduce((acc, curr) => acc + curr.randomAssignments, 0),
            tutorDistribution: assignments,
            timestamp: new Date()
        };
    }

    async clearAllAssignments() {
        try {
            if (!this.db) {
                await this.initialize();
            }

            const result = await this.db.collection('assignments').deleteMany({});
            
            logger.info(`Assignments removidos: ${result.deletedCount}`);
            
            return {
                success: true,
                deletedCount: result.deletedCount,
                message: `${result.deletedCount} assignments foram removidos com sucesso.`
            };
        } catch (error) {
            logger.error('Erro ao limpar assignments:', error);
            throw error;
        }
    }

    async getDetailedStats() {
        try {
            const stats = {
                total: {
                    students: await this.db.collection('alunos').countDocuments(),
                    assignedStudents: await this.db.collection('assignments').countDocuments(),
                    tutors: await this.db.collection('professores').countDocuments()
                },
                tutors: {
                    full: [],
                    available: [],
                    details: []
                },
                unassignedStudents: []
            };

            // Get tutor details with counts
            const tutorStats = await this.db.collection('professores')
                .aggregate([
                    {
                        $lookup: {
                            from: 'assignments',
                            localField: '_id',
                            foreignField: 'tutorId',
                            as: 'assignments'
                        }
                    },
                    {
                        $lookup: {
                            from: 'alunos',
                            let: { tutorId: '$_id' },
                            pipeline: [
                                {
                                    $lookup: {
                                        from: 'assignments',
                                        localField: '_id',
                                        foreignField: 'studentId',
                                        as: 'assignment'
                                    }
                                },
                                { $unwind: '$assignment' },
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$assignment.tutorId', '$$tutorId']
                                        }
                                    }
                                }
                            ],
                            as: 'students'
                        }
                    },
                    {
                        $project: {
                            nome: 1,
                            disciplina: 1,
                            currentCount: { $size: '$assignments' },
                            remaining: { 
                                $subtract: [
                                    this.CONFIG.MAX_STUDENTS_PER_TUTOR, 
                                    { $size: '$assignments' }
                                ]
                            },
                            students: {
                                $map: {
                                    input: '$students',
                                    as: 'student',
                                    in: {
                                        id: '$$student._id',
                                        nome: '$$student.nome',
                                        turma: '$$student.turma'
                                    }
                                }
                            }
                        }
                    }
                ]).toArray();

            // Categorize tutors
            stats.tutors.details = tutorStats;
            stats.tutors.full = tutorStats.filter(t => t.currentCount >= this.CONFIG.MAX_STUDENTS_PER_TUTOR);
            stats.tutors.available = tutorStats.filter(t => t.currentCount < this.CONFIG.MAX_STUDENTS_PER_TUTOR);

            // Get unassigned students using aggregation instead of distinct
            const assignedStudents = await this.db.collection('assignments')
                .aggregate([
                    {
                        $group: {
                            _id: null,
                            studentIds: { $addToSet: '$studentId' }
                        }
                    }
                ]).toArray();

            const assignedStudentIds = assignedStudents[0]?.studentIds || [];

            stats.unassignedStudents = await this.db.collection('alunos')
                .aggregate([
                    {
                        $match: {
                            _id: { $nin: assignedStudentIds }
                        }
                    },
                    {
                        $project: {
                            nome: 1,
                            turma: 1
                        }
                    }
                ]).toArray();

            return stats;
        } catch (error) {
            logger.error('Erro ao gerar estatísticas detalhadas:', error);
            throw error;
        }
    }
}

module.exports = TutorAssignmentService;