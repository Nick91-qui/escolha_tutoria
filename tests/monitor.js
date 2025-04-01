// scripts/monitor.js
const os = require('os');
const { MongoClient } = require('mongodb');

async function monitorar() {
    console.log('Iniciando monitoramento...');
    
    setInterval(() => {
        const cpuUsage = os.loadavg()[0];
        const memUsage = process.memoryUsage();
        
        console.log('\n--- Status do Servidor ---');
        console.log(`CPU Load: ${cpuUsage.toFixed(2)}`);
        console.log(`Memória: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log('------------------------\n');
    }, 1000);
}

monitorar();