// app.js

let alunoAtual = null;
let professores = [];

// Função para verificar aluno
async function verificarAluno() {
    const turma = document.getElementById('turma').value.trim().toUpperCase();
    const nome = document.getElementById('nome').value.trim().toUpperCase();
    const errorElement = document.getElementById('loginError');

    if (!turma || !nome) {
        mostrarErro('Por favor, preencha todos os campos');
        return;
    }

    try {
        mostrarLoading(true);
        const response = await fetch('/api/verificar-aluno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turma, nome })
        });

        const data = await response.json();

        if (data.verificado) {
            alunoAtual = { turma, nome };
            localStorage.setItem('alunoAtual', JSON.stringify(alunoAtual));
            
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('preferencias-section').style.display = 'block';
            
            await carregarProfessores();
            await verificarPreferenciasExistentes();
        } else {
            mostrarErro('Aluno não encontrado. Verifique turma e nome.');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarErro('Erro ao verificar aluno. Tente novamente.');
    } finally {
        mostrarLoading(false);
    }
}

// Carregar lista de professores
async function carregarProfessores() {
    try {
        mostrarLoading(true);
        const response = await fetch('/api/professores');
        const data = await response.json();

        if (data.sucesso) {
            professores = data.professores;
            renderizarProfessores();
        } else {
            mostrarErro('Erro ao carregar lista de professores');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarErro('Erro ao carregar professores. Tente novamente.');
    } finally {
        mostrarLoading(false);
    }
}

// Renderizar lista de professores
function renderizarProfessores() {
    const container = document.getElementById('lista-professores');
    container.innerHTML = '';

    professores.forEach((professor, index) => {
        const card = document.createElement('div');
        card.className = 'professor-card';
        card.draggable = true;
        card.dataset.index = index;

        card.innerHTML = `
            <div class="professor-numero">${index + 1}</div>
            <div class="professor-info">
                <div class="professor-nome">${professor.nome}</div>
                <div class="professor-disciplina">${professor.disciplina}</div>
            </div>
        `;

        // Eventos de drag and drop
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);

        container.appendChild(card);
    });
}

// Funções de Drag and Drop
function handleDragStart(e) {
    this.classList.add('dragging');
    e.dataTransfer.setData('text/plain', this.dataset.index);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    atualizarNumeracao();
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const draggedIndex = e.dataTransfer.getData('text/plain');
    const droppedIndex = this.dataset.index;
    
    if (draggedIndex !== droppedIndex) {
        const container = document.getElementById('lista-professores');
        const cards = Array.from(container.children);
        
        const draggedCard = cards[draggedIndex];
        const droppedCard = cards[droppedIndex];
        
        if (draggedIndex < droppedIndex) {
            droppedCard.parentNode.insertBefore(draggedCard, droppedCard.nextSibling);
        } else {
            droppedCard.parentNode.insertBefore(draggedCard, droppedCard);
        }
        
        atualizarNumeracao();
    }
}

// Atualizar números após drag and drop
function atualizarNumeracao() {
    const cards = document.querySelectorAll('.professor-card');
    cards.forEach((card, index) => {
        card.dataset.index = index;
        card.querySelector('.professor-numero').textContent = index + 1;
    });
}

// Verificar preferências existentes
async function verificarPreferenciasExistentes() {
    if (!alunoAtual) return;

    try {
        const response = await fetch(`/api/preferencias/${alunoAtual.turma}/${alunoAtual.nome}`);
        const data = await response.json();

        if (data.sucesso && data.preferencias) {
            // Desabilitar drag and drop e botão de salvar
            const container = document.getElementById('lista-professores');
            const cards = container.querySelectorAll('.professor-card');
            cards.forEach(card => {
                card.draggable = false;
                card.classList.add('preferencia-final');
            });

            // Mostrar mensagem e desabilitar botão
            mostrarMensagemFinal('Suas preferências já foram registradas e não podem ser alteradas.');
            const botaoSalvar = document.querySelector('button[onclick="salvarPreferencias()"]');
            botaoSalvar.disabled = true;
            botaoSalvar.style.display = 'none';

            // Ordenar professores conforme preferências salvas
            const prefsOrdenadas = data.preferencias.preferencias;
            professores.sort((a, b) => {
                const indexA = prefsOrdenadas.indexOf(a.nome);
                const indexB = prefsOrdenadas.indexOf(b.nome);
                return indexA - indexB;
            });
            
            renderizarProfessores(true); // true indica que é readonly
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

// Adicione esta nova função
function mostrarMensagemFinal(mensagem) {
    const container = document.getElementById('preferencias-section');
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = 'mensagem-final';
    mensagemDiv.innerHTML = `
        <div style="background-color: #f8d7da; 
                    color: #721c24; 
                    padding: 15px; 
                    margin: 10px 0; 
                    border-radius: 4px; 
                    text-align: center;
                    border: 1px solid #f5c6cb;">
            <strong>⚠️ ${mensagem}</strong>
        </div>
    `;
    container.insertBefore(mensagemDiv, container.firstChild);
}

// Modifique a função renderizarProfessores para aceitar o parâmetro readonly
function renderizarProfessores(readonly = false) {
    const container = document.getElementById('lista-professores');
    container.innerHTML = '';

    professores.forEach((professor, index) => {
        const card = document.createElement('div');
        card.className = 'professor-card';
        if (!readonly) {
            card.draggable = true;
        }
        if (readonly) {
            card.classList.add('preferencia-final');
        }
        card.dataset.index = index;

        card.innerHTML = `
            <div class="professor-numero">${index + 1}</div>
            <div class="professor-info">
                <div class="professor-nome">${professor.nome}</div>
                <div class="professor-disciplina">${professor.disciplina}</div>
            </div>
        `;

        // Adicionar eventos de drag and drop apenas se não for readonly
        if (!readonly) {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
            card.addEventListener('dragover', handleDragOver);
            card.addEventListener('drop', handleDrop);
        }

        container.appendChild(card);
    });
}

// Salvar preferências
async function salvarPreferencias() {
    if (!alunoAtual) {
        mostrarErro('Sessão expirada. Faça login novamente.');
        return;
    }

    try {
        mostrarLoading(true);
        const preferencias = Array.from(document.querySelectorAll('.professor-card'))
            .map(card => ({
                nome: card.querySelector('.professor-nome').textContent,
                disciplina: card.querySelector('.professor-disciplina').textContent
            }));

        const response = await fetch('/api/preferencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                turma: alunoAtual.turma,
                nome: alunoAtual.nome,
                preferencias: preferencias.map(p => p.nome)
            })
        });

        const data = await response.json();

        if (data.sucesso) {
            mostrarMensagemSucesso('Preferências salvas com sucesso!');
        } else {
            mostrarErro('Erro ao salvar preferências.');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarErro('Erro ao salvar preferências. Tente novamente.');
    } finally {
        mostrarLoading(false);
    }
}

// Funções auxiliares
function mostrarLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function mostrarErro(mensagem) {
    const errorElement = document.getElementById('preferenciaError');
    errorElement.textContent = mensagem;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function mostrarMensagemSucesso(mensagem) {
    const successElement = document.getElementById('successMessage');
    successElement.textContent = mensagem;
    successElement.style.display = 'block';
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 5000);
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se há aluno salvo no localStorage
    const alunoSalvo = localStorage.getItem('alunoAtual');
    if (alunoSalvo) {
        alunoAtual = JSON.parse(alunoSalvo);
        document.getElementById('turma').value = alunoAtual.turma;
        document.getElementById('nome').value = alunoAtual.nome;
    }
});

// Cache de dados
const CACHE_KEY = 'app_cache_v1';
const cache = {
    turmas: null,
    alunos: {},
    professores: null,
    lastUpdate: null
};

// Função para carregar dados iniciais
async function inicializarDados() {
    try {
        // Tentar carregar do localStorage primeiro
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            const cacheAge = Date.now() - timestamp;
            
            // Cache válido por 1 hora
            if (cacheAge < 3600000) {
                Object.assign(cache, data);
                console.log('Dados carregados do cache');
                return;
            }
        }

        // Se não há cache válido, carregar do servidor
        const [professoresRes, turmasRes] = await Promise.all([
            fetch('/api/professores'),
            fetch('/api/turmas')
        ]);

        const [professoresData, turmasData] = await Promise.all([
            professoresRes.json(),
            turmasRes.json()
        ]);

        // Atualizar cache
        cache.professores = professoresData.professores;
        cache.turmas = turmasData.turmas;
        cache.lastUpdate = Date.now();

        // Salvar no localStorage
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: cache,
            timestamp: Date.now()
        }));

        console.log('Dados atualizados do servidor');
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarErro('Erro ao carregar dados iniciais');
    }
}

// Carregar alunos da turma apenas quando necessário
async function carregarAlunosTurma(turma) {
    if (cache.alunos[turma]) {
        return cache.alunos[turma];
    }

    try {
        const response = await fetch(`/api/alunos/${turma}`);
        const data = await response.json();
        
        if (data.sucesso) {
            cache.alunos[turma] = data.alunos;
            return data.alunos;
        }
    } catch (error) {
        console.error('Erro ao carregar alunos:', error);
        throw error;
    }
}

// Autocompletar nome do aluno
function configurarAutoComplete() {
    const turmaSelect = document.getElementById('turma');
    const nomeInput = document.getElementById('nome');
    
    turmaSelect.addEventListener('change', async () => {
        const turma = turmaSelect.value;
        if (!turma) return;

        try {
            const alunos = await carregarAlunosTurma(turma);
            
            // Configurar datalist para autocompletar
            let datalist = document.getElementById('alunos-list');
            if (!datalist) {
                datalist = document.createElement('datalist');
                datalist.id = 'alunos-list';
                document.body.appendChild(datalist);
            }

            datalist.innerHTML = alunos
                .map(aluno => `<option value="${aluno.nome}">`)
                .join('');

            nomeInput.setAttribute('list', 'alunos-list');
        } catch (error) {
            mostrarErro('Erro ao carregar lista de alunos');
        }
    });
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    inicializarDados();
    configurarAutoComplete();
});