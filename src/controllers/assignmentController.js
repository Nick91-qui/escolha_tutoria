const TutorAssignmentService = require('../services/TutorAssignmentService');
const PDFGeneratorService = require('../services/PDFGeneratorService');
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

async function getAssignmentStats(req, res) {
    try {
        const service = new TutorAssignmentService();
        await service.initialize();
        
        const stats = await service.getDetailedStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function downloadTutorLists(req, res) {
    try {
        const service = new TutorAssignmentService();
        await service.initialize();
        
        const result = await service.generateTutorListsPDF();
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        const pdfGenerator = new PDFGeneratorService();
        
        // Configurar cabeçalhos para download do PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=listas-tutores.pdf');

        // Gerar PDF para cada tutor
        result.data.forEach(tutor => {
            pdfGenerator.generateTutorList(tutor);
        });

        // Finalizar e enviar o PDF
        const pdfDoc = pdfGenerator.finalize();
        pdfDoc.pipe(res);

    } catch (error) {
        logger.error('Erro ao gerar PDFs das listas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar PDFs das listas de tutores',
            details: error.message
        });
    }
}

async function downloadPreferencesList(req, res) {
    try {
        const service = new TutorAssignmentService();
        await service.initialize();
        
        const result = await service.generateStudentPreferencesList();
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        const pdfGenerator = new PDFGeneratorService();
        
        // Configure headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=lista-escolhas.pdf');

        // Generate PDF with student preferences
        result.data.forEach(student => {
            pdfGenerator.generateStudentPreference(student);
        });

        // Finalize and send PDF
        const pdfDoc = pdfGenerator.finalize();
        pdfDoc.pipe(res);

    } catch (error) {
        logger.error('Erro ao gerar PDF da lista de escolhas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar PDF da lista de escolhas',
            details: error.message
        });
    }
}

module.exports = {
    processAssignments,
    getAssignments,
    clearAssignments,
    getAssignmentStats,
    downloadTutorLists,
    downloadPreferencesList    // Add the new controller to exports
};