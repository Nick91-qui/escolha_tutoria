const express = require('express');
const router = express.Router();
const alunoController = require('../controllers/alunoController');
const { validarDadosAluno } = require('../middlewares/validations');

// Rotas de alunos e preferências
router.post('/verificar-aluno', validarDadosAluno, alunoController.verificarAluno);
router.post('/preferencias', validarDadosAluno, alunoController.salvarPreferencias);
router.get('/preferencias/:turma/:nome', alunoController.buscarPreferencias);
router.get('/alunos/:turma', alunoController.listarAlunosPorTurma);
router.get('/professores', alunoController.listarProfessores);
router.get('/verificar-status/:turma/:nome', alunoController.verificarStatusPreferencias);

module.exports = router;