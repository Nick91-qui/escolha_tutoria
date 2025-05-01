const cluster = require('cluster');
const os = require('os');

class ClusterConfig {
    constructor() {
        this.numCPUs = os.cpus().length;
    }

    initialize() {
        if (cluster.isPrimary) {
            console.log(`🚀 Master ${process.pid} iniciando`);
            
            // Criar workers
            for (let i = 0; i < this.numCPUs; i++) {
                cluster.fork();
            }

            cluster.on('exit', (worker, code, signal) => {
                console.log(`⚠️ Worker ${worker.process.pid} morreu`);
                console.log('🔄 Criando novo worker...');
                cluster.fork();
            });

            cluster.on('online', (worker) => {
                console.log(`✅ Worker ${worker.process.pid} está online`);
            });

            return false; // indica que é o processo master
        } else {
            console.log(`👷 Worker ${process.pid} iniciando`);
            
            // Importar e iniciar o servidor quando for um worker
            require('../../server');
            
            return true; // indica que é um worker
        }
    }
}

module.exports = new ClusterConfig();