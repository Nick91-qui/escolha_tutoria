const estatisticasService = require('../services/estatisticasService');
const exportacaoService = require('../services/exportacaoService');

class AdminController {
    async getEstatisticas(req, res) {
        try {
            const estatisticas = await estatisticasService.getEstatisticasGerais();
            res.json(estatisticas);
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            res.status(500).json({ 
                erro: 'Erro ao buscar estatísticas',
                detalhes: error.message 
            });
        }
    }

    async getAlunosPendentes(req, res) {
        try {
            const alunosPendentes = await estatisticasService.getAlunosPendentes();
            res.json({ alunos: alunosPendentes });
        } catch (error) {
            console.error('Erro ao buscar alunos pendentes:', error);
            res.status(500).json({ erro: 'Erro ao buscar alunos pendentes' });
        }
    }

    async exportarCSV(req, res) {
        try {
            const { content, filename, contentType } = await exportacaoService.exportarParaCSV();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            res.send(content);
        } catch (error) {
            console.error('Erro ao exportar CSV:', error);
            res.status(500).json({ erro: 'Erro ao exportar CSV' });
        }
    }

    async exportarExcel(req, res) {
        try {
            const { content, filename, contentType } = await exportacaoService.exportarParaExcel();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            res.send(content);
        } catch (error) {
            console.error('Erro ao exportar Excel:', error);
            res.status(500).json({ erro: 'Erro ao exportar Excel' });
        }
    }
}

module.exports = new AdminController();