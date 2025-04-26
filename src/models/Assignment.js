const { MongoClient, ObjectId } = require('mongodb');
const { logger } = require('../config/monitor');

class AssignmentModel {
    constructor() {
        this.client = new MongoClient(process.env.MONGODB_URI);
        this.db = null;
        this.collection = null;
    }

    async conectar() {
        try {
            await this.client.connect();
            this.db = this.client.db('escolha_tutores');
            this.collection = this.db.collection('assignments');
            logger.info('Conexão com MongoDB (assignments) estabelecida');
        } catch (error) {
            logger.error('Erro ao conectar com MongoDB (assignments):', error);
            throw error;
        }
    }

    async createAssignment(data, session) {
        try {
            const assignment = {
                studentId: new ObjectId(data.studentId),
                tutorId: new ObjectId(data.tutorId),
                assignmentType: data.assignmentType,
                preferenceNumber: data.preferenceNumber,
                timestamp: new Date()
            };

            const result = await this.collection.insertOne(assignment, { session });
            logger.info(`Nova atribuição criada: ${result.insertedId}`);
            return result;
        } catch (error) {
            logger.error('Erro ao criar atribuição:', error);
            throw error;
        }
    }

    async getAssignments(tutorId, session) {
        try {
            return await this.collection.countDocuments(
                { tutorId: new ObjectId(tutorId) },
                { session }
            );
        } catch (error) {
            logger.error(`Erro ao contar atribuições do tutor ${tutorId}:`, error);
            throw error;
        }
    }

    async fecharConexao() {
        try {
            await this.client.close();
            logger.info('Conexão com MongoDB (assignments) fechada');
        } catch (error) {
            logger.error('Erro ao fechar conexão:', error);
            throw error;
        }
    }
}

module.exports = new AssignmentModel();