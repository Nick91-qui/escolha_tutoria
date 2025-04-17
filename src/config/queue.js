const Queue = require('bull');
const Redis = require('ioredis');
const escolhaModel = require('../models/escolha');
const { logger } = require('./monitor');

// Configuração do Redis
const redisConfig = {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false
};

// Criar instância do Redis
const redis = new Redis(redisConfig);

// Configuração das filas
const escolhaQueue = new Queue('escolha-tutoria', {
    redis: redisConfig,
    limiter: {
        max: 50, // Máximo de 50 requisições por vez
        duration: 1000 // Em 1 segundo
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
    }
});

// Configuração de eventos da fila
escolhaQueue.on('completed', (job) => {
    logger.info(`Job ${job.id} completado com sucesso`);
});

escolhaQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} falhou:`, err);
});

escolhaQueue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} parou de responder`);
});

// Configuração de processamento
escolhaQueue.process(50, async (job) => {
    try {
        const { alunoId, dadosEscolha } = job.data;
        
        // Verificar se o aluno já fez a escolha
        const alunoExistente = await escolhaModel.verificarAluno(alunoId);
        if (alunoExistente && alunoExistente.status === 'processado') {
            throw new Error('Aluno já processado');
        }

        // Processar a escolha
        const resultado = await escolhaModel.processarEscolha(alunoId, dadosEscolha);
        
        return {
            success: true,
            data: resultado
        };
    } catch (error) {
        logger.error('Erro no processamento da fila:', error);
        throw error;
    }
});

// Função para adicionar job à fila
async function adicionarNaFila(alunoId, dadosEscolha) {
    try {
        const job = await escolhaQueue.add({
            alunoId,
            dadosEscolha
        }, {
            priority: 1,
            timeout: 30000 // 30 segundos de timeout
        });

        return job;
    } catch (error) {
        logger.error('Erro ao adicionar na fila:', error);
        throw error;
    }
}

// Função para obter status da fila
async function getStatusFila() {
    try {
        const counts = await escolhaQueue.getJobCounts();
        return {
            waiting: counts.waiting,
            active: counts.active,
            completed: counts.completed,
            failed: counts.failed,
            delayed: counts.delayed
        };
    } catch (error) {
        logger.error('Erro ao obter status da fila:', error);
        throw error;
    }
}

module.exports = {
    redis,
    escolhaQueue,
    adicionarNaFila,
    getStatusFila
}; 