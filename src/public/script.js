// Constantes e configurações
const CONFIG = {
    MAX_ESCOLHAS: 5,
    UPDATE_INTERVAL: 30000
};

// Estado global
let state = {
    professores: [],
    escolhasAluno: [],
    professorSelecionado: null,
    nomeCompleto: '',
    turma: '',
    updateInterval: null,
    elements: null
};

// Funções de UI
function initializeUI() {
    const elements = {
        formLogin: document.getElementById('form-login'),
        escolhasContainer: document.getElementById('escolhas-container'),
        infoAluno: document.querySelector('.info-aluno'),
        progressBar: document.querySelector('.progress'),
        listaProfessores: document.getElementById('lista-professores'),
        listaEscolhas: document.getElementById('lista-escolhas'),
        btnConfirmar: document.getElementById('btn-confirmar'),
        btnAdicionar: document.getElementById('btn-adicionar'),
        btnRemover: document.getElementById('btn-remover'),
        inputNome: document.getElementById('nome')
    };

    setupEventListeners(elements);
    return elements;
}

// Funções de validação
const validacoes = {
    professor(professor) {
        return professor && 
               typeof professor === 'object' && 
               professor.id && 
               professor.nome;
    },
    nomeAluno(nome) {
        return nome && 
               typeof nome === 'string' && 
               nome.trim().length >= 3 && 
               /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(nome);
    },
    turma(turma) {
        return turma && 
               typeof turma === 'string' && 
               turma.trim().length > 0;
    }
}

// Funções de renderização
const renderizacao = {
    professores() {
        if (!state.elements?.listaProfessores) return;
        state.elements.listaProfessores.innerHTML = '';
        state.professores.forEach(professor => {
            renderizacao.criarCardProfessor(professor, state.elements.listaProfessores);
        });
    },
    escolhas() {
        state.elements.listaEscolhas.innerHTML = '';
        state.escolhasAluno.forEach((professor, index) => {
            renderizacao.criarCardProfessor(professor, state.elements.listaEscolhas, index);
        });
        atualizarProgresso();
        atualizarBotoes();
    },
    criarCardProfessor(professor, container, index = null) {
        console.log('📝 Criando card para professor:', professor);
        
        const card = document.createElement('div');
        card.className = 'professor-card';
        
        const profId = professor.id;
        console.log('🔑 ID do professor:', profId);
        
        card.dataset.id = profId;
        
        const isEscolhas = container === state.elements.listaEscolhas;
        const maxEscolhas = CONFIG.MAX_ESCOLHAS;
        
        // Create image element with fallback
        const imgSrc = professor.foto || '/images/no-image-logo.png';
        
        card.innerHTML = `
            <span class="numero">${index !== null ? index + 1 : ''}</span>
            <img src="${imgSrc}" 
                 alt="Foto ${professor.nome}" 
                 class="professor-foto"
                 onerror="this.src='/images/no-image-logo.png'">
            <div class="info">
                <strong>${professor.nome}</strong>
                <div class="disciplina">${professor.disciplina}</div>
            </div>
            <button class="acao" data-prof-id="${profId}" 
                    title="${isEscolhas ? 'Remover da lista' : 'Adicionar à lista'}">
                <span>${isEscolhas ? '−' : '+'}</span>
            </button>
        `;
        
        const btnAcao = card.querySelector('.acao');
        btnAcao.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('🖱️ Clique no botão de ação para professor:', professor);
            
            if (isEscolhas) {
                // Remover da lista de escolhas
                const professorIndex = state.escolhasAluno.findIndex(p => p.id === profId);
                if (professorIndex !== -1) {
                    state.professores.push(state.escolhasAluno[professorIndex]);
                    state.escolhasAluno.splice(professorIndex, 1);
                }
            } else {
                // Adicionar à lista de escolhas
                if (state.escolhasAluno.length < maxEscolhas) {
                    const professorIndex = state.professores.findIndex(p => p.id === profId);
                    if (professorIndex !== -1) {
                        state.escolhasAluno.push(state.professores[professorIndex]);
                        state.professores.splice(professorIndex, 1);
                    }
                }
            }
            renderizacao.professores();
            renderizacao.escolhas();
        });

        if (!isEscolhas && state.escolhasAluno.length >= maxEscolhas) {
            card.classList.add('disabled');
            btnAcao.disabled = true;
        }
        
        container.appendChild(card);
        return card;
    }
}

// Funções de notificação
const notificacoes = {
    mostrar(mensagem, tipo = 'info') {
        const configs = {
            text: mensagem,
            duration: 3000,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: {
                background: tipo === 'error' ? "#dc3545" : 
                           tipo === 'success' ? "#28a745" : "#17a2b8",
                borderRadius: "8px",
                fontFamily: "'Poppins', sans-serif",
                fontSize: "14px",
                padding: "12px 24px"
            }
        };
        Toastify(configs).showToast();
    },
    erro(mensagem) {
        this.mostrar(mensagem, 'error');
    },
    sucesso(mensagem) {
        this.mostrar(mensagem, 'success');
    }
}

// Funções de API
const api = {
    async verificarAluno(nome, turma) {
        const nomeNormalizado = normalizarTexto(nome);
        const response = await fetch('/api/verificar-aluno', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: nomeNormalizado,
                turma: turma
            })
        });

        return response.json();
    },
    async buscarPreferencias(turma, nome) {
        try {
            console.log('🔍 Buscando preferências:', { turma, nome });
            const response = await fetch(`/api/preferencias/${turma}/${nome}`);
            const data = await response.json(); // Read response only once
            console.log('📦 Dados recebidos:', data);

            return {
                sucesso: true,
                preferencias: data.preferencias || null,
                mensagem: data.mensagem || ''
            };
        } catch (error) {
            console.error('❌ Erro ao buscar preferências:', error);
            return {
                sucesso: false,
                preferencias: null,
                mensagem: error.message
            };
        }
    },
    async salvarPreferencias(dados) {
        // Add validation before sending
        if (!dados.nome || !dados.turma || !Array.isArray(dados.preferencias)) {
            throw new Error('Dados inválidos para envio');
        }

        console.log('📤 Enviando para API:', dados);

        const response = await fetch('/api/preferencias', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: dados.nome.trim().toUpperCase(),
                turma: dados.turma.trim().toUpperCase(),
                preferencias: dados.preferencias
            })
        });

        const responseData = await response.json();
        console.log('📥 Resposta da API:', responseData);

        return responseData;
    },
    async atualizarStatusFila() {
        const response = await fetch('/api/status-fila');
        return response.json();
    },
    
    async buscarProfessores() {
        try {
            const response = await fetch('/api/professores');
            const data = await response.json();
            console.log('📚 Professores carregados:', data);
            return {
                sucesso: true,
                professores: data.professores || []
            };
        } catch (error) {
            console.error('❌ Erro ao buscar professores:', error);
            return {
                sucesso: false,
                professores: [],
                mensagem: error.message
            };
        }
    }
}

// Event Handlers
function setupEventListeners(elements) {
    elements.formLogin.addEventListener('submit', handleFormSubmit);
    elements.btnConfirmar.addEventListener('click', handleConfirmar);
    if (elements.inputNome) {
        elements.inputNome.addEventListener('input', handleNomeInput);
    }
}

// Funções de validação do formulário
async function validarFormulario(nomeInput, turmaInput) {
    const nomeNormalizado = normalizarTexto(nomeInput);
    
    if (!validacoes.nomeAluno(nomeNormalizado)) {
        notificacoes.erro('Por favor, insira um nome válido (mínimo 3 letras, apenas caracteres alfabéticos).');
        return false;
    }
    
    if (!validacoes.turma(turmaInput)) {
        notificacoes.erro('Por favor, insira uma turma válida.');
        return false;
    }

    return true;
}

// Funções de verificação de aluno
async function verificarAlunoExistente(nome, turma) {
    const nomeNormalizado = normalizarTexto(nome);
    const data = await api.verificarAluno(nomeNormalizado, turma);
    
    if (!data.verificado) {
        notificacoes.erro('Nome não encontrado. Digite seu nome completo exatamente como consta na chamada.');
        return false;
    }
    return true;
}

// Funções de UI para preferências
function configurarUIPreferencias(prefsOrdenadas) {
    document.querySelectorAll('.acao').forEach(btn => btn.disabled = true);

    prefsOrdenadas.forEach((pref, index) => {
        const profId = pref._id || pref.id; // handle both MongoDB _id and local id
        const card = document.querySelector(`.professor-card[data-id="${profId}"]`);
        if (card) {
            card.classList.add('preferencia-final', `preferencia-${index + 1}`);
            
            const numero = document.createElement('div');
            numero.className = 'numero-preferencia';
            numero.textContent = index + 1;
            card.appendChild(numero);
        }
    });

    if (state.elements.btnConfirmar) {
        state.elements.btnConfirmar.disabled = true;
        state.elements.btnConfirmar.style.display = 'none';
    }

    mostrarMensagemFinal('Suas preferências já foram registradas e não podem ser alteradas.');
}

// Função principal refatorada
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const nomeInput = document.getElementById('nome').value.trim();
    const turmaInput = document.getElementById('turma').value.trim();
    
    try {
        // Validação inicial
        if (!await validarFormulario(nomeInput, turmaInput)) return;
        console.log('✅ Formulário validado');

        // Verificar existência do aluno
        if (!await verificarAlunoExistente(nomeInput, turmaInput)) return;
        console.log('✅ Aluno verificado');

        // Atualizar estado
        atualizarEstadoAluno(nomeInput, turmaInput);
        console.log('✅ Estado atualizado');

        // Buscar e verificar preferências
        const { sucesso, preferencias } = await api.buscarPreferencias(state.turma, state.nomeCompleto);
        console.log('📦 Resultado busca preferências:', { sucesso, preferencias });
        
        // Configurar interface inicial
        configurarInterfaceEscolhas();

        // Verificar se há preferências válidas
        if (sucesso && preferencias && Array.isArray(preferencias) && preferencias.length > 0) {
            console.log('🎯 Configurando UI com preferências existentes:', preferencias);
            configurarUIPreferencias(preferencias);
        } else {
            console.log('🆕 Habilitando novas escolhas - Nenhuma preferência encontrada');
            habilitarNovasEscolhas();
        }

    } catch (error) {
        console.error('❌ Erro ao processar formulário:', error);
        notificacoes.erro('Erro ao verificar aluno. Por favor, tente novamente.');
    }
}

// Funções auxiliares
function atualizarEstadoAluno(nome, turma) {
    state.nomeCompleto = nome.toUpperCase();
    state.turma = turma;
}

function configurarInterfaceEscolhas() {
    state.elements.formLogin.style.display = 'none';
    state.elements.escolhasContainer.style.display = 'block';
    state.elements.infoAluno.innerHTML = `<strong>Aluno:</strong> ${state.nomeCompleto} | <strong>Turma:</strong> ${state.turma}`;
    renderizacao.professores();
}

function habilitarNovasEscolhas() {
    if (state.elements.btnConfirmar) {
        state.elements.btnConfirmar.disabled = false;
        state.elements.btnConfirmar.style.display = 'block';
    }
}

// Update handleConfirmar function
async function handleConfirmar() {
    const btnConfirmar = state.elements.btnConfirmar;
    
    if (state.escolhasAluno.length === CONFIG.MAX_ESCOLHAS && !btnConfirmar.disabled) {
        try {
            // Disable button and show loading state
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<span class="spinner"></span> Enviando...';
            
            const dadosEnvio = {
                nome: state.nomeCompleto,
                turma: state.turma,
                preferencias: state.escolhasAluno.map(p => p.id)
            };

            const response = await api.salvarPreferencias(dadosEnvio);
            
            if (response.sucesso) {
                notificacoes.sucesso('Suas escolhas foram confirmadas com sucesso!');
                
                document.querySelectorAll('.acao').forEach(btn => {
                    btn.disabled = true;
                });

                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error(response.mensagem || 'Erro ao confirmar escolhas');
            }
        } catch (error) {
            console.error('❌ Erro ao enviar escolhas:', error);
            notificacoes.erro(error.message || 'Ocorreu um erro ao enviar suas escolhas.');
            
            // Re-enable button on error
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = 'Confirmar Escolhas';
        }
    }
}

// Simplify input handler to only handle uppercase
function handleNomeInput(e) {
    e.target.value = e.target.value.toUpperCase();
}

// Keep normalization function for when we need to send data
function normalizarTexto(texto) {
    return texto
        .normalize('NFD')               // Decompose characters with accents
        .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
        .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
        .trim()                        // Remove leading/trailing spaces
        .toUpperCase();                // Convert to uppercase
}

// Inicialização principal
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicação...');
    
    try {
        // Inicializar elementos do DOM
        state.elements = initializeUI();
        console.log('📱 Interface inicializada');

        // Carregar professores da API
        const { sucesso, professores } = await api.buscarProfessores();
        if (!sucesso || !professores.length) {
            throw new Error('Falha ao carregar lista de professores');
        }
        
        state.professores = professores;
        console.log('👥 Professores carregados:', state.professores.length);

        // Verificar preferências existentes
        const urlParams = new URLSearchParams(window.location.search);
        const nome = urlParams.get('nome');
        const turma = urlParams.get('turma');
        
        if (nome && turma) {
            console.log('🔍 Verificando preferências para:', { nome, turma });
            state.nomeCompleto = nome.toUpperCase();
            state.turma = turma;
            
            const preferenciasData = await api.buscarPreferencias(turma, nome);
            console.log('📋 Dados de preferências:', preferenciasData);
            
            if (preferenciasData?.preferencias) {
                console.log('✅ Configurando UI com preferências existentes');
                configurarUIPreferencias(preferenciasData.preferencias);
            } else {
                console.log('🆕 Renderizando lista normal');
                renderizacao.professores();
            }
        } else {
            console.log('🆕 Novo acesso, renderizando lista normal');
            renderizacao.professores();
        }
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        notificacoes.erro('Erro ao inicializar aplicação. Por favor, recarregue a página.');
    }
});

function mostrarTelaEscolhas(nome, turma) {
    const container = document.getElementById('escolhas-container');
    container.style.display = 'block';
    
    document.getElementById('nome-aluno').textContent = nome;
    document.getElementById('turma-aluno').textContent = turma;
    
    atualizarListaEscolhas();
    iniciarAtualizacaoStatusFila();
}

function atualizarListaProfessores() {
    const lista = document.getElementById('lista-professores');
    lista.innerHTML = '';
    
    state.professores.forEach((professor, index) => {
        const card = renderizacao.criarCardProfessor(professor, index);
        lista.appendChild(card);
    });
}

function atualizarListaEscolhas() {
    const lista = document.getElementById('lista-escolhas');
    lista.innerHTML = '';
    
    ordemPreferencia.forEach((professorId, index) => {
        const professor = state.professores.find(p => p.id === professorId);
        if (professor) {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${professor.nome}`;
            lista.appendChild(li);
        }
    });
}

async function enviarEscolhas() {
    if (ordemPreferencia.length !== CONFIG.MAX_ESCOLHAS) {
        notificacoes.erro(`Selecione exatamente ${CONFIG.MAX_ESCOLHAS} professores antes de enviar.`);
        return;
    }
    
    try {
        const response = await fetch('/api/escolhas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nomeCompleto: state.nomeCompleto,
                turma: state.turma,
                preferencias: ordemPreferencia
            })
        });
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Erro ao enviar escolhas');
        }
        
        alert('Suas escolhas foram enviadas com sucesso!');
        document.getElementById('btn-enviar').disabled = true;
        
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }
    } catch (error) {
        console.error('Erro ao enviar escolhas:', error);
        notificacoes.erro('Ocorreu um erro ao enviar suas escolhas. Por favor, tente novamente.');
    }
}

function iniciarAtualizacaoStatusFila() {
    atualizarStatusFila();
    state.updateInterval = setInterval(atualizarStatusFila, CONFIG.UPDATE_INTERVAL);
}

async function atualizarStatusFila() {
    try {
        const status = await api.atualizarStatusFila();
        
        document.getElementById('posicao-fila').textContent = status.posicaoFila;
        document.getElementById('total-fila').textContent = status.totalFila;
        document.getElementById('tempo-estimado').textContent = status.tempoEstimado;
        
        const progresso = (status.posicaoFila / status.totalFila) * 100;
        document.querySelector('.progress').style.width = `${100 - progresso}%`;
    } catch (error) {
        console.error('Erro ao atualizar status da fila:', error);
    }
}

function atualizarProgresso() {
    const progresso = (state.escolhasAluno.length / CONFIG.MAX_ESCOLHAS) * 100;
    document.querySelector('.progress').style.width = `${progresso}%`;
}

function atualizarBotoes() {
    const btnAdicionar = document.getElementById('btn-adicionar');
    const btnRemover = document.getElementById('btn-remover');
    if (btnAdicionar && btnRemover) {
        btnAdicionar.disabled = !state.professorSelecionado || state.escolhasAluno.length >= CONFIG.MAX_ESCOLHAS;
        btnRemover.disabled = !state.professorSelecionado;
    }
}

function mostrarMensagemFinal(mensagem) {
    const container = document.getElementById('escolhas-container');
    const statusContainer = document.querySelector('.status-container');
    const listaEscolhas = document.querySelector('.lista-escolhas');
    const instrucoes = document.querySelector('.instrucoes');
    const listasContainer = document.querySelector('.listas-container');
    
    if (!container) return;

    // Hide containers
    if (statusContainer) {
        statusContainer.style.display = 'none';
    }
    if (listaEscolhas) {
        listaEscolhas.style.display = 'none';
    }
    if (instrucoes) {
        instrucoes.textContent = "Você não pode selecionar nenhum tutor.";
        instrucoes.style.borderLeft = '4px solid #721c24'; 
        instrucoes.style.backgroundColor = '#f8d7da'; 
    }
    if (listasContainer) {
        listasContainer.style.display = 'grid';
        listasContainer.style.gridTemplateColumns = '1fr';
        listasContainer.style.gap = '1rem';
    }

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