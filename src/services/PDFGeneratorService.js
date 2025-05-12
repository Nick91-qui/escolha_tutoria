const PDFDocument = require('pdfkit');
const { logger } = require('../config/monitor');

class PDFGeneratorService {
    constructor() {
        this.doc = new PDFDocument({
            size: 'A4',
            margin: 50
        });
    }

    generateTutorList(tutorData) {
        try {
            // Configurações da fonte e estilos
            this.doc.font('Helvetica-Bold')
                .fontSize(16)
                .text('Lista de Alunos por Tutor', { align: 'center' })
                .moveDown();

            // Informações do tutor
            this.doc.fontSize(14)
                .text(`Tutor: ${tutorData.nome}`)
                .text(`Disciplina: ${tutorData.disciplina}`)
                .moveDown();

            // Cabeçalho da lista
            this.doc.fontSize(12)
                .text('Alunos:', { underline: true })
                .moveDown(0.5);

            // Lista de alunos agrupados por turma
            const alunosPorTurma = this.agruparPorTurma(tutorData.students);
            
            Object.entries(alunosPorTurma).forEach(([turma, alunos]) => {
                this.doc.font('Helvetica-Bold')
                    .text(`Turma: ${turma}`)
                    .font('Helvetica');

                alunos.forEach((aluno, index) => {
                    this.doc.text(`${index + 1}. ${aluno.nome}`);
                });
                
                this.doc.moveDown();
            });

            // Rodapé
            this.doc.moveDown()
                .fontSize(10)
                .text(`Total de alunos: ${tutorData.students.length}`, { align: 'right' })
                .text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'right' });

            // Nova página para próximo tutor
            this.doc.addPage();

        } catch (error) {
            logger.error('Erro ao gerar PDF para tutor:', error);
            throw error;
        }
    }

    agruparPorTurma(students) {
        return students.reduce((acc, student) => {
            const turma = student.turma || 'Sem Turma';
            if (!acc[turma]) {
                acc[turma] = [];
            }
            acc[turma].push(student);
            return acc;
        }, {});
    }

    generateStudentPreference(student) {
        try {
            this.doc.font('Helvetica-Bold')
                .fontSize(14)
                .text(`Aluno: ${student.nome}`)
                .text(`Turma: ${student.turma}`)
                .moveDown();

            this.doc.font('Helvetica')
                .fontSize(12)
                .text(`Tutor Atribuído: ${student.tutorNome}`)
                .text(`Disciplina: ${student.tutorDisciplina}`)
                .text(`Ordem de Preferência: ${student.preferenceNumber}`)
                .moveDown();

            // Adiciona linha divisória
            this.doc.moveTo(50, this.doc.y)
                .lineTo(this.doc.page.width - 50, this.doc.y)
                .stroke();

            this.doc.moveDown();

        } catch (error) {
            logger.error('Erro ao gerar página do aluno:', error);
            throw error;
        }
    }

    finalize() {
        this.doc.end();
        return this.doc;
    }
}

module.exports = PDFGeneratorService;