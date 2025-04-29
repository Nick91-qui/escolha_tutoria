const { MongoClient } = require('mongodb');
const { logger } = require('../config/monitor');

class EscolhaModel {
    constructor() {
        this.client = new MongoClient(process.env.MONGODB_URI);
        this.db = null;
        this.collection = null;
        this.alunosCollection = null;
    }

    async conectar() {
        try {
            await this.client.connect();
            this.db = this.client.db('escolha_tutores');
            this.collection = this.db.collection('escolhas');
            this.alunosCollection = this.db.collection('alunos');
            logger.info('Conexão com MongoDB estabelecida');
        } catch (error) {
            logger.error('Erro ao conectar com MongoDB:', error);
            throw error;
        }
    }

    async verificarAluno(nomeCompleto, turma) {
        try {
            // Buscar aluno pelo nome completo e turma
            const aluno = await this.alunosCollection.findOne({
                nome: { $regex: new RegExp(nomeCompleto, 'i') },
                turma: turma
            });

            if (!aluno) {
                throw new Error('Aluno não encontrado');
            }

            // Verificar se já fez a escolha
            const escolha = await this.collection.findOne({ 
                alunoId: aluno._id,
                status: 'processado'
            });

            return {
                aluno,
                jaEscolheu: !!escolha
            };
        } catch (error) {
            logger.error(`Erro ao verificar aluno ${nomeCompleto}:`, error);
            throw error;
        }
    }

    async processarEscolha(alunoId, dadosEscolha) {
        try {
            // Primeiro verifica se já existe escolha processada
            const escolhaExistente = await this.collection.findOne({
                alunoId,
                status: 'processado'
            });

            if (escolhaExistente) {
                logger.warn(`Aluno ${alunoId} já possui escolha processada`);
                return {
                    acknowledged: false,
                    error: 'ESCOLHA_JA_EXISTE',
                    message: 'Aluno já realizou sua escolha'
                };
            }

            // Se não existe, processa a nova escolha
            const resultado = await this.collection.updateOne(
                { alunoId },
                { 
                    $set: { 
                        ...dadosEscolha,
                        timestamp: new Date(),
                        status: 'processado'
                    }
                },
                { upsert: true }
            );
            
            logger.info(`Escolha processada para aluno ${alunoId}`);
            return {
                ...resultado,
                success: true
            };
        } catch (error) {
            logger.error(`Erro ao processar escolha do aluno ${alunoId}:`, error);
            throw error;
        }
    }

    async getEstatisticas() {
        try {
            const total = await this.collection.countDocuments();
            const processados = await this.collection.countDocuments({ status: 'processado' });
            const pendentes = await this.collection.countDocuments({ status: { $ne: 'processado' } });
            
            return {
                total,
                processados,
                pendentes
            };
        } catch (error) {
            logger.error('Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    async fecharConexao() {
        try {
            await this.client.close();
            logger.info('Conexão com MongoDB fechada');
        } catch (error) {
            logger.error('Erro ao fechar conexão com MongoDB:', error);
            throw error;
        }
    }
}

module.exports = new EscolhaModel();