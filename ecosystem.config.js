module.exports = {
    apps: [{
      name: "sistema-tutoria",
      script: "./server.js",  // Apontar diretamente para o server.js em vez do cluster.js
      instances: "max",       // Usa o número máximo de CPUs disponíveis
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=4096", // Configuração de memória adicionada aqui
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production"
      },
      error_file: "./logs/pm2/error.log",
      out_file: "./logs/pm2/out.log",
      log_file: "./logs/pm2/combined.log",
      time: true,
      
      // Configurações de monitoramento
      monitor: true,
      max_restarts: 10,
      min_uptime: "10s",
      
      // Configurações de cluster
      instance_var: 'INSTANCE_ID',
      
      // Configurações otimizadas para alta carga
      wait_ready: true,
      listen_timeout: 3000,
      kill_timeout: 5000,
      
      // Configurações de deploy
      autorestart: true,
      exp_backoff_restart_delay: 100,
      
      // Configurações de logs
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    }]
  };