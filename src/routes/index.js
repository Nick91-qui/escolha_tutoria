const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Middleware para verificar conexão com banco
async function conectarDB(req, res, next) {
    try {
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect();
        }
        req.db = client.db("escola");
        next();
    } catch (error) {
        console.error("Erro de conexão:", error);
        res.status(500).json({ erro: "Erro de conexão com o banco de dados" });
    }
}

// Middleware para validar dados do aluno
function validarDadosAluno(req, res, next) {
    const { turma, nome } = req.body;
    if (!turma || !nome) {
        return res.status(400).json({ 
            erro: "Turma e nome são obrigatórios",
            exemplo: {
                turma: "1I01",
                nome: "NOME DO ALUNO"
            }
        });
    }
    next();
}

// 1. Verificar aluno
router.post('/verificar-aluno', conectarDB, validarDadosAluno, async (req, res) => {
    try {
        const { turma, nome } = req.body;
        const aluno = await req.db.collection('alunos').findOne({ 
            turma: turma.trim().toUpperCase(),
            nome: nome.trim().toUpperCase()
        });

        res.json({
            verificado: !!aluno,
            aluno: aluno ? {
                turma: aluno.turma,
                nome: aluno.nome
            } : null
        });
    } catch (error) {
        console.error("Erro na verificação:", error);
        res.status(500).json({ erro: "Erro ao verificar aluno" });
    }
});

// 2. Salvar preferências
router.post('/preferencias', conectarDB, validarDadosAluno, async (req, res) => {
    try {
        const { turma, nome, preferencias } = req.body;

        // Validar lista de preferências
        if (!Array.isArray(preferencias) || preferencias.length === 0) {
            return res.status(400).json({ 
                erro: "Lista de preferências inválida",
                exemplo: {
                    turma: "1I01",
                    nome: "NOME DO ALUNO",
                    preferencias: ["Professor A", "Professor B", "Professor C"]
                }
            });
        }

        // Verificar se aluno existe
        const aluno = await req.db.collection('alunos').findOne({ 
            turma: turma.trim().toUpperCase(),
            nome: nome.trim().toUpperCase()
        });

        if (!aluno) {
            return res.status(404).json({ erro: "Aluno não encontrado" });
        }

        // Verificar se já existem preferências para este aluno
        const preferenciaExistente = await req.db.collection('preferencias').findOne({
            turma: turma.trim().toUpperCase(),
            nome: nome.trim().toUpperCase()
        });

        if (preferenciaExistente) {
            return res.status(400).json({ 
                sucesso: false,
                erro: "Preferências já foram registradas e não podem ser alteradas",
                preferenciasAtuais: preferenciaExistente.preferencias
            });
        }

        // Salvar preferências
        const resultado = await req.db.collection('preferencias').insertOne({
            alunoId: aluno._id,
            turma: aluno.turma,
            nome: aluno.nome,
            preferencias,
            dataCriacao: new Date()
        });

        res.json({
            sucesso: true,
            mensagem: "Preferências salvas com sucesso",
            dados: {
                id: resultado.insertedId,
                turma: aluno.turma,
                nome: aluno.nome,
                preferencias
            }
        });
    } catch (error) {
        console.error("Erro ao salvar preferências:", error);
        res.status(500).json({ erro: "Erro ao salvar preferências" });
    }
});

// 3. Buscar preferências do aluno
router.get('/preferencias/:turma/:nome', conectarDB, async (req, res) => {
    try {
        const { turma, nome } = req.params;
        const preferencias = await req.db.collection('preferencias')
            .find({ 
                turma: turma.trim().toUpperCase(),
                nome: nome.trim().toUpperCase()
            })
            .sort({ dataCriacao: -1 })
            .limit(1)
            .toArray();

        res.json({
            sucesso: true,
            preferencias: preferencias[0] || null
        });
    } catch (error) {
        console.error("Erro ao buscar preferências:", error);
        res.status(500).json({ erro: "Erro ao buscar preferências" });
    }
});

// 4. Listar alunos por turma
router.get('/alunos/:turma', conectarDB, async (req, res) => {
    try {
        const { turma } = req.params;
        const alunos = await req.db.collection('alunos')
            .find({ turma: turma.trim().toUpperCase() })
            .sort({ nome: 1 })
            .toArray();

        res.json({
            sucesso: true,
            total: alunos.length,
            alunos: alunos.map(a => ({ turma: a.turma, nome: a.nome }))
        });
    } catch (error) {
        console.error("Erro ao listar alunos:", error);
        res.status(500).json({ erro: "Erro ao listar alunos" });
    }
});

// 5. Listar professores
router.get('/professores', conectarDB, async (req, res) => {
    try {
        const professores = await req.db.collection('professores')
            .find({})
            .sort({ nome: 1 })
            .toArray();

        res.json({
            sucesso: true,
            professores: professores.map(p => ({
                nome: p.nome,
                disciplina: p.disciplina
            }))
        });
    } catch (error) {
        console.error("Erro ao listar professores:", error);
        res.status(500).json({ erro: "Erro ao listar professores" });
    }
});

// 6. Verificar status das preferências do aluno
router.get('/verificar-status/:turma/:nome', conectarDB, async (req, res) => {
    try {
        const { turma, nome } = req.params;
        const preferencia = await req.db.collection('preferencias').findOne({
            turma: turma.trim().toUpperCase(),
            nome: nome.trim().toUpperCase()
        });

        res.json({
            sucesso: true,
            jaEscolheu: !!preferencia,
            dataEscolha: preferencia ? preferencia.dataCriacao : null,
            preferencias: preferencia ? preferencia.preferencias : null
        });
    } catch (error) {
        console.error("Erro ao verificar status:", error);
        res.status(500).json({ erro: "Erro ao verificar status das preferências" });
    }
});

module.exports = router;