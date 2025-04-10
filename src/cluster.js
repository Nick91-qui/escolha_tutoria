const cluster = require('cluster');
const os = require('os');
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} iniciando`);
    
    // Criar workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} morreu`);
        // Substituir worker morto
        cluster.fork();
    });
} else {
    require('./server.js');
}