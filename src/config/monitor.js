const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf } = format;

// Formato personalizado para os logs
const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

// Criar logger
const logger = createLogger({
    format: combine(
        timestamp(),
        logFormat
    ),
    transports: [
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' }),
        new transports.Console()
    ]
});

// Classe de monitoramento
class Monitor {
    constructor() {
        this.inicio = Date.now();
        this.processados = 0;
        this.erros = 0;
        this.filaAtual = 0;
    }

    logProcessamento(alunoId, sucesso) {
        if (sucesso) {
            this.processados++;
        } else {
            this.erros++;
        }

        const status = this.getStatus();
        logger.info('Status do processamento:', status);
    }

    getStatus() {
        const tempoDecorrido = Date.now() - this.inicio;
        return {
            tempoDecorrido: Math.floor(tempoDecorrido / 1000),
            alunosProcessados: this.processados,
            taxaSucesso: (this.processados / (this.processados + this.erros)) * 100,
            alunosRestantes: 500 - this.processados,
            filaAtual: this.filaAtual
        };
    }

    atualizarFila(tamanho) {
        this.filaAtual = tamanho;
    }
}

module.exports = {
    logger,
    Monitor
}; 