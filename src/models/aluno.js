const { db } = require('../config/db');

class Aluno {
    constructor(turma, nome) {
        this.turma = turma;
        this.nome = nome;
    }

    // Validar dados do aluno
    static validar(turma, nome) {
        const erros = [];

        if (!turma || typeof turma !== 'string' || turma.trim().length === 0) {
            erros.push('Turma é obrigatória');
        }

        if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
            erros.push('Nome é obrigatório');
        }

        return {
            valido: erros.length === 0,
            erros
        };
    }

    // Buscar aluno por turma e nome
    static async buscar(turma, nome) {
        try {
            const database = await db.conectar();
            return await database.collection('alunos').findOne({ 
                turma: turma.trim(), 
                nome: nome.trim() 
            });
        } catch (error) {
            console.error('Erro ao buscar aluno:', error);
            throw new Error('Erro ao buscar aluno no banco de dados');
        }
    }

    // Criar novo aluno
    static async criar(turma, nome) {
        // Validar dados
        const validacao = this.validar(turma, nome);
        if (!validacao.valido) {
            throw new Error(validacao.erros.join(', '));
        }

        try {
            const database = await db.conectar();
            const resultado = await database.collection('alunos').insertOne({
                turma: turma.trim(),
                nome: nome.trim(),
                dataCriacao: new Date()
            });

            return {
                id: resultado.insertedId,
                turma,
                nome
            };
        } catch (error) {
            console.error('Erro ao criar aluno:', error);
            throw new Error('Erro ao criar aluno no banco de dados');
        }
    }

    // Salvar preferências do aluno
    static async salvarPreferencias(turma, nome, preferencias) {
        try {
            // Verificar se aluno existe
            const aluno = await this.buscar(turma, nome);
            if (!aluno) {
                throw new Error('Aluno não encontrado');
            }

            // Validar preferências
            if (!Array.isArray(preferencias) || preferencias.length === 0) {
                throw new Error('Lista de preferências inválida');
            }

            const database = await db.conectar();
            const resultado = await database.collection('preferencias').insertOne({
                alunoId: aluno._id,
                turma: turma.trim(),
                nome: nome.trim(),
                preferencias,
                dataCriacao: new Date()
            });

            return {
                id: resultado.insertedId,
                preferencias
            };
        } catch (error) {
            console.error('Erro ao salvar preferências:', error);
            throw new Error('Erro ao salvar preferências no banco de dados');
        }
    }

    // Buscar preferências do aluno
    static async buscarPreferencias(turma, nome) {
        try {
            const database = await db.conectar();
            return await database.collection('preferencias')
                .find({ 
                    turma: turma.trim(), 
                    nome: nome.trim() 
                })
                .sort({ dataCriacao: -1 })
                .limit(1)
                .toArray();
        } catch (error) {
            console.error('Erro ao buscar preferências:', error);
            throw new Error('Erro ao buscar preferências no banco de dados');
        }
    }

    // Listar todos os alunos de uma turma
    static async listarPorTurma(turma) {
        try {
            const database = await db.conectar();
            return await database.collection('alunos')
                .find({ turma: turma.trim() })
                .sort({ nome: 1 })
                .toArray();
        } catch (error) {
            console.error('Erro ao listar alunos:', error);
            throw new Error('Erro ao listar alunos da turma');
        }
    }

    // Atualizar dados do aluno
    static async atualizar(turma, nome, novosDados) {
        try {
            const database = await db.conectar();
            const resultado = await database.collection('alunos').updateOne(
                { turma: turma.trim(), nome: nome.trim() },
                { $set: { ...novosDados, dataAtualizacao: new Date() } }
            );

            return resultado.modifiedCount > 0;
        } catch (error) {
            console.error('Erro ao atualizar aluno:', error);
            throw new Error('Erro ao atualizar dados do aluno');
        }
    }

    // Remover aluno
    static async remover(turma, nome) {
        try {
            const database = await db.conectar();
            const resultado = await database.collection('alunos').deleteOne({
                turma: turma.trim(),
                nome: nome.trim()
            });

            return resultado.deletedCount > 0;
        } catch (error) {
            console.error('Erro ao remover aluno:', error);
            throw new Error('Erro ao remover aluno');
        }
    }
}

module.exports = Aluno;