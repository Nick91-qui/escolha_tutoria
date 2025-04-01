// Carregar dados ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    carregarEstatisticas();
    carregarAlunosPendentes();
});

async function carregarEstatisticas() {
    try {
        const response = await fetch('/api/admin/estatisticas');
        const data = await response.json();

        // Atualizar números gerais
        document.getElementById('totalAlunos').textContent = data.totalAlunos;
        document.getElementById('totalEscolhas').textContent = data.totalEscolhas;
        document.getElementById('faltamEscolher').textContent = 
            data.totalAlunos - data.totalEscolhas;

        // Renderizar estatísticas por turma
        renderizarEstatisticasTurmas(data.estatisticasTurmas);

        // Renderizar estatísticas por professor
        renderizarEstatisticasProfessores(data.estatisticasProfessores);

    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

async function carregarAlunosPendentes() {
    try {
        const response = await fetch('/api/admin/alunos-pendentes');
        const data = await response.json();

        const container = document.getElementById('alunosPendentes');
        container.innerHTML = data.alunos
            .map(aluno => `
                <div class="aluno-item">
                    <strong>${aluno.nome}</strong> - Turma: ${aluno.turma}
                </div>
            `)
            .join('');

    } catch (error) {
        console.error('Erro ao carregar alunos pendentes:', error);
    }
}

function renderizarEstatisticasTurmas(estatisticas) {
    const container = document.getElementById('estatisticasTurmas');
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Turma</th>
                    <th>Total</th>
                    <th>Escolheram</th>
                    <th>Pendentes</th>
                </tr>
            </thead>
            <tbody>
                ${estatisticas.map(est => `
                    <tr>
                        <td>${est.turma}</td>
                        <td>${est.total}</td>
                        <td>${est.escolheram}</td>
                        <td>${est.total - est.escolheram}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderizarEstatisticasProfessores(estatisticas) {
    const container = document.getElementById('estatisticasProfessores');
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Professor</th>
                    <th>1ª Escolha</th>
                    <th>2ª Escolha</th>
                    <th>3ª Escolha</th>
                </tr>
            </thead>
            <tbody>
                ${estatisticas.map(est => `
                    <tr>
                        <td>${est.nome}</td>
                        <td>${est.primeira}</td>
                        <td>${est.segunda}</td>
                        <td>${est.terceira}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function exportarCSV() {
    try {
        const response = await fetch('/api/admin/exportar-csv');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'preferencias.csv';
        a.click();
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
    }
}

async function exportarExcel() {
    try {
        const response = await fetch('/api/admin/exportar-excel');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'preferencias.xlsx';
        a.click();
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
    }
}