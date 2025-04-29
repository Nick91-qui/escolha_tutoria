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

module.exports = {
    validarDadosAluno
};