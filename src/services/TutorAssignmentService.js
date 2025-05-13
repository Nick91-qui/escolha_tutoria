const { conectar } = require('../config/db');
const { logger } = require('../config/monitor');
const { ObjectId } = require('mongodb');

class TutorAssignmentService {
    constructor() {
        this.CONFIG = {
            MAX_STUDENTS_PER_TUTOR: 18,
            MAX_STUDENTS_PEDAGOGICAL: 6,
            MAX_PREFERENCES: 5,
            PEDAGOGICAL_ROLES: [
                'CASF',
                'COORDENADOR',
                'COORDENADORA',
                'PEDAGOGO',
                'PEDAGOGA',
                'DIRETORA',
                'DIRETOR',
                'COORDENADORA PEDAGOGICA',
                'COORDENADOR PEDAGOGICO'
            ]
        };
        this.db = null;
    }

    normalizarTexto(texto) {
        if (!texto) return '';
        return texto
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    async initialize() {
        try {
            this.db = await conectar();
            
            // Criar índices com collation para busca sem considerar acentos
            await this.db.collection('preferencias').createIndex(
                { nome: 1, turma: 1 }, 
                { 
                    collation: { 
                        locale: 'pt',
                        strength: 1,  // Ignora acentos e maiúsculas/minúsculas
                        alternate: 'shifted' // Ignora pontuação e espaços
                    }
                }
            );
            
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
                            _id: { 
                                nome: { $toLower: "$nome" },  // Converter para minúsculo
                                turma: "$turma" 
                            },
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
                                            $eq: [
                                                { $toLower: '$aluno.nome' }, 
                                                { $toLower: '$$aluno_nome' }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: 'assignment'
                        }
                    }
                ], 
                { 
                    collation: { 
                        locale: 'pt',
                        strength: 1,
                        alternate: 'shifted'
                    }
                }
            ).toArray();

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
            // Convert string IDs to ObjectId
            const studentObjId = new ObjectId(studentId);
            const tutorObjId = new ObjectId(tutorId);

            // Get tutor's max student limit
            const maxStudents = await this.getTutorMaxStudents(tutorId);
            const currentCount = await this.getTutorCurrentCount(tutorId);
            
            logger.info(`Tentando atribuir aluno ${studentId} ao tutor ${tutorId}`);
            logger.info(`Contagem atual do tutor: ${currentCount}/${maxStudents}`);
            
            if (currentCount >= maxStudents) {
                logger.info(`Tutor ${tutorId} está com capacidade máxima (${maxStudents} alunos)`);
                return false;
            }

            await this.db.collection('assignments').insertOne({
                studentId: studentObjId,
                tutorId: tutorObjId,
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
            // Find student ID usando collation
            const aluno = await this.db.collection('alunos').findOne(
                { 
                    nome: preference.nome,
                    turma: preference.turma 
                },
                {
                    collation: { 
                        locale: 'pt',
                        strength: 1,
                        alternate: 'shifted'
                    }
                }
            );

            if (!aluno) {
                logger.error(`[ASSIGNMENT_FAILED] Aluno não encontrado no banco: ${preference.nome} (${preference.turma})`);
                return false;
            }

            // Convert aluno._id to string if it's an ObjectId
            const studentId = aluno._id.toString();
            logger.info(`[ASSIGNMENT_START] Processando ${preference.nome} (${preference.turma}) - ID: ${studentId}`);

            // Verify preferences
            if (!preference.preferencias || !Array.isArray(preference.preferencias)) {
                logger.error(`[ASSIGNMENT_FAILED] Preferências inválidas para ${preference.nome}: ${JSON.stringify(preference.preferencias)}`);
                return false;
            }

            // Log current state of each preferred tutor
            for (let i = 0; i < preference.preferencias.length; i++) {
                const tutorId = preference.preferencias[i];
                const currentCount = await this.getTutorCurrentCount(tutorId);
                const maxStudents = await this.getTutorMaxStudents(tutorId);
                
                logger.info(`[TUTOR_STATUS] Opção ${i + 1}: Tutor ${tutorId} - ${currentCount}/${maxStudents} alunos`);
            }

            // Try preferred tutors first
            for (let i = 0; i < preference.preferencias.length; i++) {
                const tutorId = preference.preferencias[i];
                logger.info(`[ATTEMPT] Tentando atribuir ${preference.nome} ao tutor ${tutorId} (Opção ${i + 1})`);
                
                const assigned = await this.assignStudentToTutor(
                    studentId,  // Use string ID instead of object
                    tutorId,
                    i + 1
                );
                
                if (assigned) {
                    logger.info(`[ASSIGNMENT_SUCCESS] ${preference.nome} atribuído ao tutor ${tutorId} (${i + 1}ª opção)`);
                    return true;
                }
            }
            
            // If no preferred tutors available, try random assignment
            logger.warn(`[RANDOM_START] Iniciando atribuição aleatória para ${preference.nome}`);
            
            const availableTutors = await this.getAvailableTutors();
            logger.info(`[RANDOM_OPTIONS] ${availableTutors.length} tutores disponíveis para atribuição aleatória`);
            
            if (availableTutors.length > 0) {
                // Log available tutors for random assignment
                availableTutors.forEach(tutor => {
                    logger.info(`[RANDOM_TUTOR] Tutor disponível: ${tutor.nome} (${tutor.disciplina})`);
                });

                const randomIndex = Math.floor(Math.random() * availableTutors.length);
                const randomTutor = availableTutors[randomIndex];
                
                logger.info(`[RANDOM_ATTEMPT] Tentando atribuir ${preference.nome} ao tutor ${randomTutor.nome}`);
                
                const assigned = await this.assignStudentToTutor(
                    studentId,  // Use string ID instead of object
                    randomTutor._id.toString(),  // Convert tutor ID to string as well
                    null
                );
                
                if (assigned) {
                    logger.info(`[RANDOM_SUCCESS] ${preference.nome} atribuído aleatoriamente ao tutor ${randomTutor.nome}`);
                    return true;
                }
            } else {
                logger.error(`[ASSIGNMENT_FAILED] Não há tutores disponíveis para atribuição aleatória de ${preference.nome}`);
            }
            
            logger.error(`[ASSIGNMENT_FAILED] ${preference.nome} não pôde ser atribuído a nenhum tutor`);
            return false;
        } catch (error) {
            logger.error(`[ERROR] Erro ao processar preferências de ${preference.nome}:`, error);
            return false;
        }
    }

    async getAvailableTutors() {
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

        return await Promise.all(tutors.filter(async tutor => {
            const maxStudents = await this.getTutorMaxStudents(tutor._id);
            return (tutorCounts.get(tutor._id.toString()) || 0) < maxStudents;
        }));
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
                                { $unwind: { path: '$assignment', preserveNullAndEmptyArrays: false } },
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$assignment.tutorId', '$$tutorId']
                                        }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: 'preferencias',
                                        let: { aluno_nome: "$nome", aluno_turma: "$turma" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$nome", "$$aluno_nome"] },
                                                            { $eq: ["$turma", "$$aluno_turma"] }
                                                        ]
                                                    }
                                                }
                                            },
                                            { $sort: { dataRegistro: 1 } },
                                            { $limit: 1 }
                                        ],
                                        as: 'preferencia'
                                    }
                                },
                                {
                                    $addFields: {
                                        dataRegistro: { $arrayElemAt: ["$preferencia.dataRegistro", 0] }
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
                                        turma: '$$student.turma',
                                        dataRegistro: '$$student.dataRegistro'
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

    async generateTutorListsPDF() {
        try {
            logger.info('Buscando dados para gerar PDFs...');
            
            const tutorAssignments = await this.db.collection('professores')
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
                                },
                                {
                                    $sort: { 
                                        turma: 1,
                                        nome: 1
                                    }
                                }
                            ],
                            as: 'students'
                        }
                    },
                    {
                        $match: {
                            students: { $ne: [] }
                        }
                    },
                    {
                        $project: {
                            nome: 1,
                            disciplina: 1,
                            students: {
                                $map: {
                                    input: '$students',
                                    as: 'student',
                                    in: {
                                        nome: '$$student.nome',
                                        turma: '$$student.turma'
                                    }
                                }
                            }
                        }
                    }
                ]).toArray();

            if (!tutorAssignments.length) {
                logger.warn('Nenhuma atribuição encontrada para gerar PDFs');
                return { 
                    success: false, 
                    message: 'Não há atribuições para gerar PDFs' 
                };
            }

            return {
                success: true,
                data: tutorAssignments,
                message: `Dados preparados para ${tutorAssignments.length} tutores`
            };
        } catch (error) {
            logger.error('Erro ao buscar dados para PDFs:', error);
            throw error;
        }
    }

    async generateStudentPreferencesList() {
        try {
            logger.info('Gerando lista de escolhas dos alunos...');
            
            const studentPreferences = await this.db.collection('assignments')
                .aggregate([
                    {
                        $lookup: {
                            from: 'alunos',
                            localField: 'studentId',
                            foreignField: '_id',
                            as: 'aluno'
                        }
                    },
                    {
                        $lookup: {
                            from: 'professores',
                            localField: 'tutorId',
                            foreignField: '_id',
                            as: 'tutor'
                        }
                    },
                    {
                        $unwind: '$aluno'
                    },
                    {
                        $unwind: '$tutor'
                    },
                    {
                        $project: {
                            nome: '$aluno.nome',
                            turma: '$aluno.turma',
                            tutorNome: '$tutor.nome',
                            tutorDisciplina: '$tutor.disciplina',
                            preferenceNumber: 1
                        }
                    },
                    {
                        $sort: {
                            turma: 1,
                            nome: 1
                        }
                    }
                ]).toArray();

            if (!studentPreferences.length) {
                return {
                    success: false,
                    message: 'Não há escolhas de alunos para gerar PDF'
                };
            }

            return {
                success: true,
                data: studentPreferences,
                message: `Dados preparados para ${studentPreferences.length} alunos`
            };
        } catch (error) {
            logger.error('Erro ao gerar lista de escolhas:', error);
            throw error;
        }
    }

    isPedagogicalRole(disciplina) {
        if (!disciplina) return false;
        const disciplinaNormalizada = this.normalizarTexto(disciplina);
        return this.CONFIG.PEDAGOGICAL_ROLES.some(role => 
            disciplinaNormalizada.includes(this.normalizarTexto(role))
        );
    }

    getMaxStudents(disciplina) {
        return this.isPedagogicalRole(disciplina) 
            ? this.CONFIG.MAX_STUDENTS_PEDAGOGICAL 
            : this.CONFIG.MAX_STUDENTS_PER_TUTOR;
    }

    async getTutorMaxStudents(tutorId) {
        try {
            const tutor = await this.db.collection('professores').findOne(
                { _id: new ObjectId(tutorId) },
                { projection: { disciplina: 1 } }
            );

            if (!tutor) {
                logger.warn(`Tutor não encontrado: ${tutorId}`);
                return this.CONFIG.MAX_STUDENTS_PER_TUTOR;
            }

            const maxStudents = this.getMaxStudents(tutor.disciplina);

            logger.info(`Limite de alunos para ${tutor.disciplina}: ${maxStudents}`);
            return maxStudents;
        } catch (error) {
            logger.error('Erro ao obter limite de alunos do tutor:', error);
            return this.CONFIG.MAX_STUDENTS_PER_TUTOR;
        }
    }
}

module.exports = TutorAssignmentService;