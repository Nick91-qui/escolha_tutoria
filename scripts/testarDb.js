const AlunoService = require('../src/services/alunoService');

async function testarConexao() {
    const service = new AlunoService();
    const status = await service.verificarConexao();
    console.log('Status da conexão:', status);
}

testarConexao().catch(console.error);