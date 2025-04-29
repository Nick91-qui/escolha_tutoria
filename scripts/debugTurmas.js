const AlunoService = require('../src/services/alunoService');

async function debugTurmas() {
    const service = new AlunoService();
    await service.debugTurmas();
}

debugTurmas().catch(console.error);