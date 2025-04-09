const os = require('os');
const http = require('http');
const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');

// Configurações
const CONFIG = {
    checkInterval: 5000,
    serverUrl: 'http://localhost:3000',
    rootDir: ROOT_DIR,
    warningThresholds: {
        cpu: 80,
        memory: 80,
        disk: 90
    }
};

// Cores para console
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Estatísticas globais
let stats = {
    startTime: Date.now(),
    requests: 0,
    errors: 0,
    lastCheck: null
};

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function getSystemStats() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    let cpuUsage = 0;
    for (let cpu of cpus) {
        const total = Object.values(cpu.times).reduce((acc, val) => acc + val, 0);
        const idle = cpu.times.idle;
        cpuUsage += ((total - idle) / total) * 100;
    }
    cpuUsage /= cpus.length;

    return {
        cpu: cpuUsage.toFixed(2),
        memory: {
            total: formatBytes(totalMemory),
            used: formatBytes(usedMemory),
            free: formatBytes(freeMemory),
            percentage: memoryUsage.toFixed(2)
        },
        uptime: formatUptime(os.uptime()),
        platform: `${os.platform()} ${os.release()}`
    };
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function checkServerHealth() {
    http.get(CONFIG.serverUrl, (res) => {
        stats.requests++;
        stats.lastCheck = new Date();
        if (res.statusCode !== 200) stats.errors++;
    }).on('error', (err) => {
        stats.errors++;
        console.log(`${colors.red}[ERRO] Servidor não responde: ${err.message}${colors.reset}`);
    });
}

function displayStats() {
    console.clear();
    const sysStats = getSystemStats();
    
    console.log(`
${colors.cyan}=== Monitor do Sistema de Tutoria ===${colors.reset}
${colors.blue}Tempo de Execução: ${formatUptime((Date.now() - stats.startTime) / 1000)}${colors.reset}

${colors.magenta}Sistema:${colors.reset}
• Platform: ${sysStats.platform}
• CPU Usage: ${sysStats.cpu}%
• Memória Total: ${sysStats.memory.total}
• Memória Usada: ${sysStats.memory.used} (${sysStats.memory.percentage}%)
• Memória Livre: ${sysStats.memory.free}

${colors.magenta}Servidor:${colors.reset}
• URL: ${CONFIG.serverUrl}
• Requisições: ${stats.requests}
• Erros: ${stats.errors}
• Última Verificação: ${stats.lastCheck ? stats.lastCheck.toLocaleTimeString() : 'N/A'}

${colors.yellow}Pressione Ctrl+C para encerrar${colors.reset}
`);

    // Alertas
    if (sysStats.cpu > CONFIG.warningThresholds.cpu) {
        console.log(`${colors.red}[ALERTA] CPU uso alto: ${sysStats.cpu}%${colors.reset}`);
    }
    if (sysStats.memory.percentage > CONFIG.warningThresholds.memory) {
        console.log(`${colors.red}[ALERTA] Memória uso alto: ${sysStats.memory.percentage}%${colors.reset}`);
    }
}

// Iniciar monitoramento
setInterval(() => {
    checkServerHealth();
    displayStats();
}, CONFIG.checkInterval);

// Primeira execução
checkServerHealth();
displayStats();