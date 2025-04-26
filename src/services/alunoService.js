const { conectar } = require('../config/db');

class AlunoService {
    // Helper method for string normalization
    normalizeString(str) {
        return str.trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');  // Remove accents
    }

    // Add this method to check DB connection and collection
    async verificarConexao() {
        try {
            const db = await conectar();
            const collections = await db.listCollections().toArray();
            
            
            // Check alunos collection
            const alunosCount = await db.collection('alunos').countDocuments();
            
            // Show sample data if exists
            if (alunosCount > 0) {
                const sample = await db.collection('alunos').find().limit(1).toArray();
            }
            
            return {
                connected: true,
                collectionsCount: collections.length,
                alunosCount,
                collections: collections.map(c => c.name)
            };
        } catch (error) {
            console.error('Erro ao verificar conexão:', error);
            return {
                connected: false,
                error: error.message
            };
        }
    }

    async verificarAluno(turma, nome) {
        try {
            const db = await conectar();
            
            // Normalize input
            const turmaNormalizada = this.normalizeString(turma);
            const nomeNormalizado = this.normalizeString(nome);

            // First, let's see if we can find similar names
            const todosAlunos = await db.collection('alunos')
                .find({ turma: turmaNormalizada })
                .toArray();
            // Exact match search
            const aluno = await db.collection('alunos').findOne({ 
                turma: turmaNormalizada,
                nome: nomeNormalizado
            });
            
            return {
                verificado: !!aluno,
                mensagem: aluno ? "Aluno encontrado" : "Aluno não encontrado",
                debug: {
                    parametrosBusca: { 
                        turma: turmaNormalizada, 
                        nome: nomeNormalizado 
                    },
                    totalAlunosTurma: todosAlunos.length,
                    resultado: aluno
                }
            };
        } catch (error) {
            console.error('Erro ao verificar aluno:', error);
            throw error;
        }
    }

    async salvarPreferencias(dados) {
        try {
            const db = await conectar();
            
            // Add detailed debug logging
            console.log('📥 Dados recebidos:', {
                nome: dados?.nome,
                turma: dados?.turma,
                preferencias: dados?.preferencias
            });
            
            // Validate complete input
            if (!dados || !dados.nome || !dados.turma || !dados.preferencias) {
                console.error('❌ Dados incompletos:', dados);
                throw new Error('Dados incompletos para salvar preferências');
            }

            // Ensure preferencias is an array
            if (!Array.isArray(dados.preferencias)) {
                console.error('❌ Preferências não é um array:', dados.preferencias);
                throw new Error('Lista de preferências inválida');
            }

            // Validate array is not empty
            if (dados.preferencias.length === 0) {
                throw new Error('Lista de preferências está vazia');
            }

            // Convert string IDs to ObjectId
            const { ObjectId } = require('mongodb');
            const professorIds = dados.preferencias.map(id => {
                try {
                    return new ObjectId(id.toString().trim());
                } catch (error) {
                    console.error(`❌ Erro ao converter ID ${id}:`, error);
                    throw new Error(`ID de professor inválido: ${id}`);
                }
            });
            
            console.log('🔄 IDs convertidos:', professorIds);
            
            // Validar se todos os IDs de professores existem
            const professores = await db.collection('professores')
                .find({ 
                    _id: { $in: professorIds }
                })
                .toArray();

            console.log('🔍 Professores encontrados:', {
                enviados: professorIds.length,
                encontrados: professores.length,
                lista: professores.map(p => ({ id: p._id, nome: p.nome }))
            });

            if (professores.length !== dados.preferencias.length) {
                console.error('❌ Nem todos os professores foram encontrados', {
                    esperado: dados.preferencias.length,
                    encontrado: professores.length,
                    idsEnviados: dados.preferencias,
                    idsEncontrados: professores.map(p => p._id)
                });
                throw new Error('Um ou mais professores não foram encontrados');
            }

            // Salvar preferências usando IDs convertidos
            const preferencias = {
                nome: dados.nome.trim().toUpperCase(),
                turma: dados.turma.trim().toUpperCase(),
                preferencias: professorIds,
                dataRegistro: new Date()
            };

            const resultado = await db.collection('preferencias').insertOne(preferencias);
            console.log('✅ Preferências salvas com sucesso:', {
                id: resultado.insertedId,
                preferencias: preferencias
            });

            return {
                sucesso: true,
                mensagem: 'Preferências salvas com sucesso'
            };
        } catch (error) {
            console.error('❌ Erro ao salvar preferências:', error);
            return {
                sucesso: false,
                mensagem: error.message
            };
        }
    }

    async buscarPreferencias(turma, nome) {
        try {
            const db = await conectar();
            const { ObjectId } = require('mongodb');
            
            // Buscar preferências do aluno
            const preferencias = await db.collection('preferencias')
                .findOne({ 
                    turma: turma.toUpperCase(),
                    nome: nome.toUpperCase()
                });

            if (!preferencias) {
                return { 
                    sucesso: true,
                    preferencias: null 
                };
            }

            // Buscar professores pelos IDs
            const professoresEncontrados = await db.collection('professores')
                .find({ 
                    _id: { $in: preferencias.preferencias }
                })
                .toArray();

            console.log('🔍 Professores encontrados por ID:', {
                preferencias: preferencias.preferencias,
                encontrados: professoresEncontrados.map(p => ({
                    id: p._id,
                    nome: p.nome
                }))
            });

            // Mapear mantendo a ordem original das preferências
            const prefsCompletas = preferencias.preferencias
                .map(prefId => {
                    const prof = professoresEncontrados.find(p => p._id.toString() === prefId.toString());
                    if (!prof) {
                        console.warn(`Professor com ID ${prefId} não encontrado`);
                        return null;
                    }
                    return {
                        id: prof._id,
                        nome: prof.nome,
                        disciplina: prof.disciplina
                    };
                })
                .filter(Boolean); // Remove null entries

            return {
                sucesso: true,
                id: preferencias._id, // Incluindo o ID do documento de preferências
                preferencias: prefsCompletas
            };
        } catch (error) {
            console.error('❌ Erro ao buscar preferências:', error);
            return {
                sucesso: false,
                mensagem: error.message
            };
        }
    }

    async listarAlunosPorTurma(turma) {
        const db = await conectar();
        const alunos = await db.collection('alunos')
            .find({ turma: turma.trim().toUpperCase() })
            .sort({ nome: 1 })
            .toArray();

        return {
            total: alunos.length,
            alunos
        };
    }

    async listarProfessores() {
        try {
            const db = await conectar();
            console.log('📚 Buscando professores do banco...');
            
            // Get all professors
            const professores = await db.collection('professores')
                .find({})  // empty query to get all documents
                .sort({ nome: 1 })
                .toArray();
                
            console.log(`✅ Total de professores encontrados: ${professores.length}`);
            
            // Log some debug info
            if (professores.length === 0) {
                console.warn('⚠️ Nenhum professor encontrado no banco!');
            } else {
                console.log('📊 Exemplo do primeiro registro:', {
                    id: professores[0]._id,
                    nome: professores[0].nome,
                    disciplina: professores[0].disciplina
                });
            }

            return {
                sucesso: true,
                total: professores.length,
                professores: professores.map(prof => ({
                    id: prof._id,
                    nome: prof.nome,
                    disciplina: prof.disciplina,
                    // add any other relevant fields
                }))
            };
        } catch (error) {
            console.error('❌ Erro ao listar professores:', error);
            return {
                sucesso: false,
                erro: error.message,
                professores: []
            };
        }
    }

    async verificarStatusPreferencias(turma, nome) {
        const db = await conectar();
        const preferencias = await db.collection('preferencias')
            .findOne({ 
                turma: turma.trim().toUpperCase(), 
                nome: nome.trim().toUpperCase() 
            });

        return {
            jaEscolheu: !!preferencias,
            dataEscolha: preferencias?.dataCriacao,
            preferencias: preferencias?.preferencias || []
        };
    }

    async debugTurmas() {
        try {
            const db = await conectar();
            
            // Use aggregate instead of distinct
            const stats = await db.collection('alunos').aggregate([
                { 
                    $group: { 
                        _id: "$turma", 
                        count: { $sum: 1 },
                        alunos: { $push: "$nome" }
                    } 
                },
                { $sort: { _id: 1 } }
            ]).toArray();
            return stats;
        } catch (error) {
            console.error('Erro ao debugar turmas:', error);
            throw error;
        }
    }
}

module.exports = AlunoService;