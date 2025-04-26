// Carregar dados ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    carregarEstatisticas();
    carregarAlunosPendentes();
});

async function carregarEstatisticas() {
    try {
        console.log('Iniciando carregamento de estatísticas...');
        const response = await fetch('/api/admin/estatisticas');
        const data = await response.json();
        console.log('Dados recebidos:', data);

        // Atualizar números gerais com validação
        document.getElementById('totalAlunos').textContent = data.totalAlunos || 0;
        document.getElementById('totalEscolhas').textContent = data.totalEscolhas || 0;
        document.getElementById('faltamEscolher').textContent = 
            (data.totalAlunos || 0) - (data.totalEscolhas || 0);

        // Renderizar estatísticas por turma
        if (data.estatisticasTurmas && Array.isArray(data.estatisticasTurmas)) {
            renderizarEstatisticasTurmas(data.estatisticasTurmas);
        } else {
            document.getElementById('estatisticasTurmas').innerHTML = 
                '<p>Nenhum dado de turmas disponível</p>';
        }

        // Renderizar estatísticas por professor
        if (data.estatisticasProfessores && Array.isArray(data.estatisticasProfessores)) {
            renderizarEstatisticasProfessores(data.estatisticasProfessores);
        } else {
            document.getElementById('estatisticasProfessores').innerHTML = 
                '<p>Nenhum dado de professores disponível</p>';
        }

    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        // Mostrar mensagem de erro na interface
        document.getElementById('totalAlunos').textContent = 'Erro';
        document.getElementById('totalEscolhas').textContent = 'Erro';
        document.getElementById('faltamEscolher').textContent = 'Erro';
        document.getElementById('estatisticasTurmas').innerHTML = 
            '<p>Erro ao carregar dados das turmas</p>';
        document.getElementById('estatisticasProfessores').innerHTML = 
            '<p>Erro ao carregar dados dos professores</p>';
    }
}

async function carregarAlunosPendentes() {
    try {
        console.log('Carregando alunos pendentes...');
        const response = await fetch('/api/admin/alunos-pendentes');
        const data = await response.json();
        console.log('Dados de alunos pendentes:', data);

        const container = document.getElementById('alunosPendentes');
        
        if (!data.alunos || !Array.isArray(data.alunos)) {
            container.innerHTML = '<p>Nenhum dado de alunos pendentes disponível</p>';
            return;
        }

        if (data.alunos.length === 0) {
            container.innerHTML = '<p>Não há alunos pendentes</p>';
            return;
        }

        container.innerHTML = data.alunos
            .map(aluno => `
                <div class="aluno-item">
                    <strong>${aluno.nome || 'Nome não disponível'}</strong> 
                    - Turma: ${aluno.turma || 'Turma não disponível'}
                </div>
            `)
            .join('');

    } catch (error) {
        console.error('Erro ao carregar alunos pendentes:', error);
        document.getElementById('alunosPendentes').innerHTML = 
            '<p>Erro ao carregar lista de alunos pendentes</p>';
    }
}

function renderizarEstatisticasTurmas(estatisticas) {
    const container = document.getElementById('estatisticasTurmas');
    
    if (!estatisticas || !Array.isArray(estatisticas)) {
        container.innerHTML = '<p>Nenhum dado disponível</p>';
        return;
    }

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
                        <td>${est.turma || ''}</td>
                        <td>${est.total || 0}</td>
                        <td>${est.escolheram || 0}</td>
                        <td>${(est.total || 0) - (est.escolheram || 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderizarEstatisticasProfessores(estatisticas) {
    const container = document.getElementById('estatisticasProfessores');
    
    if (!estatisticas || !Array.isArray(estatisticas)) {
        container.innerHTML = '<p>Nenhum dado disponível</p>';
        return;
    }

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
                        <td>${est.nome || ''}</td>
                        <td>${est.primeira || 0}</td>
                        <td>${est.segunda || 0}</td>
                        <td>${est.terceira || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function exportarCSV() {
    try {
        const response = await fetch('/api/admin/exportar-csv');
        if (!response.ok) {
            throw new Error('Erro ao baixar CSV');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preferencias_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
        alert('Erro ao exportar CSV. Tente novamente.');
    }
}

async function exportarExcel() {
    try {
        const response = await fetch('/api/admin/exportar-excel');
        if (!response.ok) {
            throw new Error('Erro ao baixar Excel');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preferencias_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        alert('Erro ao exportar Excel. Tente novamente.');
    }
}