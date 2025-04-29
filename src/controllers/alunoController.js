const AlunoService = require('../services/alunoService');

class AlunoController {
    constructor() {
        this.alunoService = new AlunoService();
        // Bind all methods to preserve 'this' context
        this.verificarAluno = this.verificarAluno.bind(this);
        this.salvarPreferencias = this.salvarPreferencias.bind(this);
        this.buscarPreferencias = this.buscarPreferencias.bind(this);
        this.listarAlunosPorTurma = this.listarAlunosPorTurma.bind(this);
        this.listarProfessores = this.listarProfessores.bind(this);
        this.verificarStatusPreferencias = this.verificarStatusPreferencias.bind(this);
    }

    async verificarAluno(req, res) {
        try {
            const { turma, nome } = req.body;
            
            if (!turma || !nome) {
                return res.status(400).json({
                    verificado: false,
                    erro: "Turma e nome são obrigatórios"
                });
            }

            const resultado = await this.alunoService.verificarAluno(turma, nome);
            res.json(resultado);
        } catch (error) {
            console.error("Erro na verificação:", error);
            res.status(500).json({ 
                verificado: false,
                erro: "Erro ao verificar aluno",
                detalhes: error.message 
            });
        }
    }

    async salvarPreferencias(req, res) {
        try {
            const { turma, nome, preferencias } = req.body;

            if (!Array.isArray(preferencias) || preferencias.length !== 5) {
                return res.status(400).json({ 
                    erro: "Lista de preferências inválida",
                    exemplo: {
                        turma: "1I1",
                        nome: "NOME DO ALUNO",
                        preferencias: ["1", "2", "3", "4", "5"] // IDs dos professores
                    },
                    detalhes: "É necessário enviar exatamente 5 IDs de professores"
                });
            }

            // Validar se todos os elementos são strings de IDs
            if (!preferencias.every(id => typeof id === 'string')) {
                return res.status(400).json({
                    erro: "Formato inválido",
                    detalhes: "Todos os elementos devem ser IDs de professores em formato string"
                });
            }

            const dados = {
                turma,
                nome,
                preferencias
            };

            const resultado = await this.alunoService.salvarPreferencias(dados);
            
            if (!resultado.sucesso) {
                return res.status(400).json(resultado);
            }

            res.json(resultado);
        } catch (error) {
            console.error("Erro ao salvar preferências:", error);
            res.status(500).json({ 
                erro: "Erro ao salvar preferências",
                detalhes: error.message 
            });
        }
    }

    async buscarPreferencias(req, res) {
        try {
            const { turma, nome } = req.params;
            const resultado = await this.alunoService.buscarPreferencias(turma, nome);
            res.json(resultado);
        } catch (error) {
            console.error("Erro ao buscar preferências:", error);
            res.status(500).json({ erro: "Erro ao buscar preferências" });
        }
    }

    async listarAlunosPorTurma(req, res) {
        try {
            const { turma } = req.params;
            const resultado = await this.alunoService.listarAlunosPorTurma(turma);
            res.json(resultado);
        } catch (error) {
            console.error("Erro ao listar alunos:", error);
            res.status(500).json({ erro: "Erro ao listar alunos" });
        }
    }

    async listarProfessores(req, res) {
        try {
            const resultado = await this.alunoService.listarProfessores();
            res.json(resultado);
        } catch (error) {
            console.error("Erro ao listar professores:", error);
            res.status(500).json({ erro: "Erro ao listar professores" });
        }
    }

    async verificarStatusPreferencias(req, res) {
        try {
            const { turma, nome } = req.params;
            const resultado = await this.alunoService.verificarStatusPreferencias(turma, nome);
            res.json(resultado);
        } catch (error) {
            console.error("Erro ao verificar status:", error);
            res.status(500).json({ erro: "Erro ao verificar status das preferências" });
        }
    }
}

// Export singleton instance
module.exports = new AlunoController();