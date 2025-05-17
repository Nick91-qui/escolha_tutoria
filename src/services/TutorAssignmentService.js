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
            // Certificar que estamos trabalhando com strings de ID
            if (studentId && typeof studentId !== 'string') {
                if (studentId._id) {
                    studentId = studentId._id.toString();
                } else if (studentId.toString) {
                    studentId = studentId.toString();
                } else {
                    logger.error(`Tipo inválido de studentId: ${typeof studentId}`);
                    return false;
                }
            }
            
            if (tutorId && typeof tutorId !== 'string') {
                if (tutorId._id) {
                    tutorId = tutorId._id.toString();
                } else if (tutorId.toString) {
                    tutorId = tutorId.toString();
                }
            }

            // Converter para ObjectId agora que temos strings válidas
            const studentObjId = new ObjectId(studentId);
            const tutorObjId = new ObjectId(tutorId);

            // Verificar limite de alunos do tutor
            const maxStudents = await this.getTutorMaxStudents(tutorId);
            const currentCount = await this.getTutorCurrentCount(tutorId);
            
            logger.info(`Tentando atribuir aluno ${studentId} ao tutor ${tutorId} (${currentCount}/${maxStudents})`);
            
            if (currentCount >= maxStudents) {
                logger.info(`[CAPACITY_FULL] Tutor ${tutorId} está com capacidade máxima (${maxStudents} alunos)`);
                return false;
            }

            // Criar atribuição
            await this.db.collection('assignments').insertOne({
                studentId: studentObjId,
                tutorId: tutorObjId,
                assignmentType: preferenceNumber ? 'preference' : 'random',
                preferenceNumber,
                timestamp: new Date()
            });

            logger.info(`[SUCCESS] Atribuição criada: aluno ${studentId} -> tutor ${tutorId}`);
            return true;
        } catch (error) {
            logger.error(`[ERROR] Erro ao atribuir aluno ${studentId} ao tutor ${tutorId}: ${error.message}`);
            return false;
        }
    }

    async processStudentPreferences(preference) {
        try {
            // Encontrar o ID do aluno
            const aluno = await this.db.collection('alunos').findOne(
                { 
                    nome: preference.nome,
                    turma: preference.turma 
                },
                {
                    collation: { 
                        locale: 'pt',
                        strength: 1
                    }
                }
            );

            if (!aluno) {
                logger.error(`[NOT_FOUND] Aluno não encontrado: ${preference.nome} (${preference.turma})`);
                return false;
            }

            // Verificar se o aluno já está atribuído
            const existingAssignment = await this.db.collection('assignments')
                .findOne({ studentId: aluno._id });

            if (existingAssignment) {
                logger.info(`[SKIP] ${preference.nome} já está atribuído ao tutor ${existingAssignment.tutorId}`);
                return true;
            }

            // Garantir que temos um ID válido
            const studentId = aluno._id.toString();
            
            // Processar preferências com tratamento de erro consistente
            for (const tutorId of preference.preferencias) {
                try {
                    const assigned = await this.assignStudentToTutor(
                        studentId,
                        tutorId.toString(),
                        preference.preferencias.indexOf(tutorId) + 1
                    );

                    if (assigned) {
                        return true;
                    }
                } catch (prefError) {
                    logger.warn(`Erro ao tentar preferência ${tutorId} para aluno ${studentId}: ${prefError.message}`);
                    // Continue para a próxima preferência
                }
            }

            // Atribuição aleatória com melhor tratamento de erro
            return await this.assignRandomTutor(preference, studentId);
        } catch (error) {
            logger.error(`[PROCESS_ERROR] Erro ao processar preferências: ${error.message}`);
            return false;
        }
    }

    // Separar a atribuição aleatória em um método próprio para melhor organização
    async assignRandomTutor(preference, studentId) {
        try {
            logger.warn(`[RANDOM_START] Iniciando atribuição aleatória para ${preference.nome}`);
            
            const availableTutors = await this.getAvailableTutors();
            if (availableTutors.length === 0) {
                logger.error(`[NO_TUTORS] Não há tutores disponíveis para ${preference.nome}`);
                return false;
            }

            // Ordenar tutores por número de alunos (menor para maior)
            const sortedTutors = await this.getSortedTutorsByLoad(availableTutors);
            
            // Tentar atribuir ao tutor com menor carga
            for (const tutor of sortedTutors) {
                const tutorId = tutor._id.toString();
                const assigned = await this.assignStudentToTutor(studentId, tutorId, null);
                
                if (assigned) {
                    logger.info(`[RANDOM_SUCCESS] ${preference.nome} atribuído ao tutor ${tutor.nome}`);
                    return true;
                }
            }

            logger.error(`[ASSIGNMENT_FAILED] ${preference.nome} não pôde ser atribuído a nenhum tutor`);
            return false;
        } catch (error) {
            logger.error(`[RANDOM_ERROR] Erro na atribuição aleatória: ${error.message}`);
            return false;
        }
    }

    // Método para ordenar tutores por carga
    async getSortedTutorsByLoad(tutors) {
        // Adicionar contagem de alunos a cada tutor
        const tutorsWithCount = await Promise.all(
            tutors.map(async (tutor) => {
                const count = await this.getTutorCurrentCount(tutor._id);
                return { ...tutor, count };
            })
        );
        
        // Ordenar por menor carga primeiro
        return tutorsWithCount.sort((a, b) => a.count - b.count);
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
            // 1. Limpar assignments existentes
            await this.clearAllAssignments();
            logger.info('Assignments anteriores removidos');

            // 2. Buscar preferências únicas (sem o lookup desnecessário)
            const preferences = await this.db.collection('preferencias')
                .aggregate([
                    {
                        $match: {
                            preferencias: { $exists: true, $ne: [] }
                        }
                    },
                    {
                        $sort: { dataRegistro: -1 }  // Pega o registro mais recente
                    },
                    {
                        $group: {
                            _id: { 
                                nome: { $toLower: "$nome" }, 
                                turma: "$turma" 
                            },
                            doc: { $first: "$$ROOT" }  // Pega o primeiro doc (mais recente)
                        }
                    },
                    {
                        $replaceRoot: { newRoot: "$doc" }
                    }
                ]).toArray();

            logger.info(`Processando ${preferences.length} alunos`);
            
            // 3. Manter track de alunos já atribuídos
            const assignedStudents = new Set();
            const unassignedStudents = [];

            // 4. Processar preferências
            for (const preference of preferences) {
                const studentKey = `${preference.nome.toLowerCase()}-${preference.turma}`;
                
                if (assignedStudents.has(studentKey)) {
                    logger.info(`Aluno ${preference.nome} já foi atribuído, pulando...`);
                    continue;
                }

                const success = await this.processStudentPreferences(preference);
                
                if (success) {
                    assignedStudents.add(studentKey);
                    logger.info(`Aluno ${preference.nome} atribuído com sucesso`);
                } else {
                    unassignedStudents.push(preference);
                    logger.info(`Aluno ${preference.nome} não atribuído, adicionado à lista de espera`);
                }
            }

            // 5. Processar alunos não atribuídos
            if (unassignedStudents.length > 0) {
                logger.info(`Tentando atribuição aleatória para ${unassignedStudents.length} alunos`);
                for (const student of unassignedStudents) {
                    if (assignedStudents.has(`${student.nome.toLowerCase()}-${student.turma}`)) {
                        continue;
                    }
                    await this.processRandomAssignments([student]);
                }
            }

            // 6. Gerar relatório final
            const report = await this.generateAssignmentReport();
            logger.info(`Processamento concluído. Relatório: ${JSON.stringify(report)}`);
            return report;

        } catch (error) {
            logger.error('Erro no processamento das atribuições:', error);
            throw error;
        }
    }

    // Este método está incorreto - estamos passando objetos mas tratando como IDs
    async findAndFormatStudentId(nome, turma) {
        try {
            const aluno = await this.db.collection('alunos').findOne(
                { 
                    nome: nome,
                    turma: turma 
                },
                {
                    collation: { 
                        locale: 'pt',
                        strength: 1
                    }
                }
            );
    
            if (!aluno) {
                logger.error(`Aluno não encontrado: ${nome} (${turma})`);
                return null;
            }
    
            // Garantir que o ID seja string
            const studentId = aluno._id.toString();
            logger.info(`ID do aluno ${nome} formatado corretamente: ${studentId}`);
            return studentId;
        } catch (error) {
            logger.error(`Erro ao buscar aluno ${nome}: ${error.message}`);
            return null;
        }
    }
    
    // Modifique o método processRandomAssignments para ser mais simples e direto
    async processRandomAssignments(unassignedStudents) {
        try {
            for (const preference of unassignedStudents) {
                // Passo 1: Encontrar o ID do aluno
                const aluno = await this.db.collection('alunos').findOne(
                    { 
                        nome: preference.nome,
                        turma: preference.turma 
                    },
                    {
                        collation: { 
                            locale: 'pt',
                            strength: 1
                        }
                    }
                );
                
                if (!aluno) {
                    logger.error(`[RANDOM_FAILED] Aluno não encontrado: ${preference.nome} (${preference.turma})`);
                    continue;
                }
                
                // Passo 2: Obter o ID como string
                const studentId = aluno._id.toString();
                logger.info(`Tentando atribuição para ${preference.nome} com ID: ${studentId}`);
                
                // Passo 3: Obter tutores com espaço, ordenados por menor carga
                const tutores = await this.db.collection('professores').find().toArray();
                const tutoresComContagem = [];
                
                for (const tutor of tutores) {
                    const count = await this.getTutorCurrentCount(tutor._id);
                    const max = await this.getTutorMaxStudents(tutor._id);
                    
                    if (count < max) {
                        tutoresComContagem.push({
                            ...tutor,
                            count,
                            max
                        });
                    }
                }
                
                // Ordenar por menor carga
                tutoresComContagem.sort((a, b) => a.count - b.count);
                
                if (tutoresComContagem.length === 0) {
                    logger.error(`[RANDOM_FAILED] Não há tutores disponíveis para ${preference.nome}`);
                    continue;
                }
                
                // Passo 4: Tentar atribuir ao tutor com menor carga
                let atribuido = false;
                
                for (const tutor of tutoresComContagem) {
                    try {
                        const tutorId = tutor._id.toString();
                        
                        logger.info(`Tentando atribuir ${preference.nome} ao tutor ${tutor.nome} (${tutor.count}/${tutor.max})`);
                        
                        const success = await this.assignStudentToTutor(
                            studentId, 
                            tutorId,
                            null
                        );
                        
                        if (success) {
                            logger.info(`[RANDOM_SUCCESS] ${preference.nome} atribuído ao tutor ${tutor.nome}`);
                            atribuido = true;
                            break;
                        }
                    } catch (err) {
                        logger.error(`Erro ao tentar atribuir ${preference.nome} ao tutor ${tutor.nome}: ${err.message}`);
                    }
                }
                
                if (!atribuido) {
                    logger.error(`[RANDOM_FAILED] ${preference.nome} não pôde ser atribuído a nenhum tutor`);
                }
            }
        } catch (error) {
            logger.error(`[RANDOM_ERROR] Erro ao processar atribuições aleatórias: ${error.message}`);
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