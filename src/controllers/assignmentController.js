const TutorAssignmentService = require('../services/TutorAssignmentService');
const { logger } = require('../config/monitor');

async function processAssignments(req, res) {
    try {
        const assignmentService = new TutorAssignmentService();
        await assignmentService.initialize();
        const report = await assignmentService.processAssignments();
        
        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        logger.error('Erro ao processar atribuições:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar atribuições de tutores',
            details: error.message
        });
    }
}

async function getAssignments(req, res) {
    try {
        const assignmentService = new TutorAssignmentService();
        await assignmentService.initialize();
        const assignments = await assignmentService.generateAssignmentReport();
        
        res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        logger.error('Erro ao buscar atribuições:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar atribuições',
            details: error.message
        });
    }
}

async function clearAssignments(req, res) {
    try {
        const service = new TutorAssignmentService();
        const result = await service.clearAllAssignments();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    processAssignments,
    getAssignments,
    clearAssignments
};