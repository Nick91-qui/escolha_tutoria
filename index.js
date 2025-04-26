const clusterConfig = require('./src/config/cluster');

if (clusterConfig.initialize()) {
    require('./server');
}