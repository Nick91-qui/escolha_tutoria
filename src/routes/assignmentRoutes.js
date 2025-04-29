const express = require('express');
const router = express.Router();
const { 
    processAssignments, 
    getAssignments, 
    clearAssignments,
    getAssignmentStats 
} = require('../controllers/assignmentController');

// Rotas protegidas por autenticação de admin
router.post('/process', processAssignments);
router.get('/list', getAssignments);
router.get('/stats', getAssignmentStats);
router.delete('/clear', clearAssignments);

module.exports = router;