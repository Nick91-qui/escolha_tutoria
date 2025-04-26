const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Rotas administrativas
router.get('/estatisticas', adminController.getEstatisticas);
router.get('/alunos-pendentes', adminController.getAlunosPendentes);
router.get('/exportar-csv', adminController.exportarCSV);
router.get('/exportar-excel', adminController.exportarExcel);

module.exports = router;