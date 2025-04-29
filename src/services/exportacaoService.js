const ExcelJS = require('exceljs');
const { conectar } = require('../config/db');

class ExportacaoService {
    async exportarParaCSV() {
        const db = await conectar();
        const preferencias = await db.collection('preferencias').find().toArray();

        const cabecalho = ['Turma', 'Nome', 'Data de Registro'];
        const maxPreferencias = Math.max(...preferencias.map(p => p.preferencias.length));
        
        // Adicionar colunas dinâmicas para preferências
        for (let i = 1; i <= maxPreferencias; i++) {
            cabecalho.push(`Opção ${i}`);
        }

        // Criar linhas de dados
        const linhas = preferencias.map(p => {
            const linha = [
                p.turma,
                p.nome,
                new Date(p.dataCriacao).toLocaleString('pt-BR')
            ];

            // Adicionar preferências
            for (let i = 0; i < maxPreferencias; i++) {
                linha.push(p.preferencias[i] || '');
            }

            return linha;
        });

        // Montar CSV
        const csv = [
            cabecalho.join(','),
            ...linhas.map(l => l.join(','))
        ].join('\n');
        
        return {
            content: csv,
            filename: `preferencias_${new Date().toISOString().split('T')[0]}.csv`,
            contentType: 'text/csv'
        };
    }

    async exportarParaExcel() {
        const db = await conectar();
        const [preferencias, alunos] = await Promise.all([
            db.collection('preferencias').find().toArray(),
            db.collection('alunos').find().toArray()
        ]);

        const workbook = new ExcelJS.Workbook();
        
        // Aba de Preferências
        const sheetPreferencias = workbook.addWorksheet('Preferências');
        sheetPreferencias.columns = [
            { header: 'Turma', key: 'turma', width: 10 },
            { header: 'Nome', key: 'nome', width: 30 },
            { header: 'Data de Registro', key: 'data', width: 20 }
        ];

        // Adicionar colunas dinâmicas para preferências
        const maxPreferencias = Math.max(...preferencias.map(p => p.preferencias.length));
        for (let i = 1; i <= maxPreferencias; i++) {
            sheetPreferencias.columns.push({
                header: `Opção ${i}`,
                key: `opcao${i}`,
                width: 20
            });
        }

        // Adicionar dados de preferências
        preferencias.forEach(p => {
            const row = {
                turma: p.turma,
                nome: p.nome,
                data: new Date(p.dataCriacao).toLocaleString('pt-BR')
            };

            p.preferencias.forEach((pref, idx) => {
                row[`opcao${idx + 1}`] = pref;
            });

            sheetPreferencias.addRow(row);
        });

        // Aba de Estatísticas
        const sheetEstatisticas = workbook.addWorksheet('Estatísticas');
        
        // Estatísticas por turma
        const estatisticasTurma = await db.collection('alunos')
            .aggregate([
                {
                    $group: {
                        _id: "$turma",
                        total: { $sum: 1 },
                        comEscolha: {
                            $sum: {
                                $cond: [
                                    { $gt: [{ $size: "$preferencias" }, 0] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]).toArray();

        sheetEstatisticas.addRow(['Estatísticas por Turma']);
        sheetEstatisticas.addRow(['Turma', 'Total Alunos', 'Com Escolha', 'Pendentes', '% Concluído']);
        estatisticasTurma.forEach(est => {
            const pendentes = est.total - est.comEscolha;
            const percentual = ((est.comEscolha / est.total) * 100).toFixed(2);
            sheetEstatisticas.addRow([est._id, est.total, est.comEscolha, pendentes, `${percentual}%`]);
        });

        // Estilização básica
        [sheetPreferencias, sheetEstatisticas].forEach(sheet => {
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6E6E6' }
            };
        });
        
        const buffer = await workbook.xlsx.writeBuffer();
        return {
            content: buffer,
            filename: `preferencias_${new Date().toISOString().split('T')[0]}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
    }
}

module.exports = new ExportacaoService();