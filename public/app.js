// Variáveis globais
let alunoAtual = null;
let professores = [];

// Cache
const CACHE_KEY = 'app_cache_v1';
const cache = {
    professores: null,
    lastUpdate: null
};

// Função para verificar aluno
async function verificarAluno() {
    const turma = document.getElementById('turma').value.trim();
    const nome = document.getElementById('nome').value.trim().toUpperCase();

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
            mostrarErro('Nome não encontrado. Digite seu nome completo exatamente como consta na chamada.');
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

// Renderizar professores
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

        if (!readonly) {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
            card.addEventListener('dragover', handleDragOver);
            card.addEventListener('drop', handleDrop);
        }

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

// Atualizar numeração
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
            const container = document.getElementById('lista-professores');
            const cards = container.querySelectorAll('.professor-card');
            cards.forEach(card => {
                card.draggable = false;
                card.classList.add('preferencia-final');
            });

            mostrarMensagemFinal('Suas preferências já foram registradas e não podem ser alteradas.');
            const botaoSalvar = document.querySelector('button[onclick="salvarPreferencias()"]');
            botaoSalvar.disabled = true;
            botaoSalvar.style.display = 'none';

            const prefsOrdenadas = data.preferencias.preferencias;
            professores.sort((a, b) => {
                const indexA = prefsOrdenadas.indexOf(a.nome);
                const indexB = prefsOrdenadas.indexOf(b.nome);
                return indexA - indexB;
            });
            
            renderizarProfessores(true);
        }
    } catch (error) {
        console.error('Erro:', error);
    }
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
            verificarPreferenciasExistentes(); // Recarrega em modo readonly
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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    inicializarDados();
});

// Função para carregar dados iniciais
async function inicializarDados() {
    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            const cacheAge = Date.now() - timestamp;
            
            if (cacheAge < 3600000) {
                Object.assign(cache, data);
                console.log('Dados carregados do cache');
                return;
            }
        }

        const response = await fetch('/api/professores');
        const data = await response.json();

        if (data.sucesso) {
            cache.professores = data.professores;
            cache.lastUpdate = Date.now();

            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: cache,
                timestamp: Date.now()
            }));

            console.log('Dados atualizados do servidor');
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarErro('Erro ao carregar dados iniciais');
    }
}