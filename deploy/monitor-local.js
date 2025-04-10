const os = require('os');
const http = require('http');
const path = require('path');
const NodeCache = require('node-cache');

// Cache para armazenar métricas temporárias
const metricsCache = new NodeCache({ stdTTL: 60 });

// Configurações
const CONFIG = {
    checkInterval: 10000, // 10 segundos
    serverUrl: 'http://localhost:3000',
    rootDir: path.join(__dirname, '..'),
    warningThresholds: {
        cpu: 80,
        memory: 80,
        disk: 90,
        requests: 1000
    },
    logRetention: 24 * 60 * 60 * 1000, // 24 horas em ms
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
const stats = {
    startTime: Date.now(),
    requests: {
        total: 0,
        success: 0,
        errors: 0,
        lastMinute: 0
    },
    system: {
        cpu: [],
        memory: [],
        lastUpdate: null
    },
    alerts: [],
    workers: new Set()
};

// Função para formatar bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Função para formatar tempo de atividade
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// Coleta de métricas do sistema otimizada
function getSystemStats() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    // Cálculo otimizado de CPU
    let cpuUsage = 0;
    if (stats.system.cpu.length > 0) {
        const previousCpu = stats.system.cpu[stats.system.cpu.length - 1];
        const currentCpu = process.cpuUsage(previousCpu);
        cpuUsage = ((currentCpu.user + currentCpu.system) / 1000000) * 100;
    } else {
        cpuUsage = process.cpuUsage().user / 1000000;
    }

    // Manter histórico limitado
    stats.system.cpu.push(cpuUsage);
    if (stats.system.cpu.length > 60) stats.system.cpu.shift();

    stats.system.memory.push(memoryUsage);
    if (stats.system.memory.length > 60) stats.system.memory.shift();

    return {
        cpu: cpuUsage.toFixed(2),
        memory: {
            total: formatBytes(totalMemory),
            used: formatBytes(usedMemory),
            free: formatBytes(freeMemory),
            percentage: memoryUsage.toFixed(2)
        },
        platform: `${os.platform()} ${os.release()}`,
        loadAverage: os.loadavg(),
        uptime: formatUptime(os.uptime() * 1000)
    };
}

// Verificação de saúde do servidor otimizada
function checkServerHealth() {
    const startTime = Date.now();
    http.get(CONFIG.serverUrl, (res) => {
        const responseTime = Date.now() - startTime;
        
        stats.requests.total++;
        if (res.statusCode === 200) {
            stats.requests.success++;
            metricsCache.set('lastResponseTime', responseTime);
        } else {
            stats.requests.errors++;
            addAlert(`Resposta não-200 do servidor: ${res.statusCode}`);
        }
        
        stats.system.lastUpdate = new Date();
    }).on('error', (err) => {
        stats.requests.errors++;
        addAlert(`Erro de conexão com servidor: ${err.message}`);
    });
}

// Gerenciamento de alertas
function addAlert(message) {
    const alert = {
        timestamp: new Date(),
        message: message
    };
    stats.alerts.unshift(alert);
    
    // Manter apenas alertas das últimas 24 horas
    const cutoff = Date.now() - CONFIG.logRetention;
    stats.alerts = stats.alerts.filter(a => a.timestamp.getTime() > cutoff);
}

// Exibição de estatísticas otimizada
function displayStats() {
    const sysStats = getSystemStats();
    const responseTime = metricsCache.get('lastResponseTime') || 0;
    
    console.clear();
    console.log(`
${colors.cyan}=== Monitor do Sistema de Tutoria ===${colors.reset}
${colors.blue}Tempo de Execução: ${formatUptime(Date.now() - stats.startTime)}${colors.reset}

${colors.magenta}Sistema:${colors.reset}
• Platform: ${sysStats.platform}
• CPU Usage: ${sysStats.cpu}%
• Load Average: ${sysStats.loadAverage.map(v => v.toFixed(2)).join(', ')}
• Memória Total: ${sysStats.memory.total}
• Memória Usada: ${sysStats.memory.used} (${sysStats.memory.percentage}%)
• Memória Livre: ${sysStats.memory.free}

${colors.magenta}Servidor:${colors.reset}
• URL: ${CONFIG.serverUrl}
• Requisições Totais: ${stats.requests.total}
• Requisições com Sucesso: ${stats.requests.success}
• Erros: ${stats.requests.errors}
• Último Tempo de Resposta: ${responseTime}ms
• Última Verificação: ${stats.system.lastUpdate ? stats.system.lastUpdate.toLocaleTimeString() : 'N/A'}

${colors.yellow}Alertas Recentes:${colors.reset}
${stats.alerts.slice(0, 5).map(a => 
    `[${a.timestamp.toLocaleTimeString()}] ${a.message}`
).join('\n')}

${colors.yellow}Pressione Ctrl+C para encerrar${colors.reset}
`);

    // Verificação de limites
    if (parseFloat(sysStats.cpu) > CONFIG.warningThresholds.cpu) {
        console.log(`${colors.red}[ALERTA] CPU uso alto: ${sysStats.cpu}%${colors.reset}`);
    }
    if (parseFloat(sysStats.memory.percentage) > CONFIG.warningThresholds.memory) {
        console.log(`${colors.red}[ALERTA] Memória uso alto: ${sysStats.memory.percentage}%${colors.reset}`);
    }
    if (stats.requests.lastMinute > CONFIG.warningThresholds.requests) {
        console.log(`${colors.red}[ALERTA] Alto número de requisições: ${stats.requests.lastMinute}/min${colors.reset}`);
    }
}

// Limpeza periódica de métricas antigas
function cleanupOldMetrics() {
    const cutoff = Date.now() - CONFIG.logRetention;
    stats.alerts = stats.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
}

// Inicialização do monitor
function initializeMonitor() {
    console.log(`${colors.green}Iniciando monitor do sistema...${colors.reset}`);
    
    // Verificação inicial
    checkServerHealth();
    displayStats();

    // Agendamento de verificações periódicas
    setInterval(checkServerHealth, CONFIG.checkInterval);
    setInterval(displayStats, CONFIG.checkInterval);
    setInterval(cleanupOldMetrics, CONFIG.checkInterval * 6); // Limpar a cada minuto

    // Tratamento de encerramento gracioso
    process.on('SIGINT', () => {
        console.log(`\n${colors.yellow}Encerrando monitor...${colors.reset}`);
        process.exit(0);
    });
}

// Iniciar monitoramento
initializeMonitor();