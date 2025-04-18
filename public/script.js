let professores = [];
let ordemPreferencia = [];
let nomeCompleto = '';
let turma = '';
let updateInterval;

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const escolhasContainer = document.getElementById('escolhas-container');
    const infoAluno = document.querySelector('.info-aluno');
    const progressBar = document.querySelector('.progress');
    const listaProfessores = document.getElementById('lista-professores');
    const listaEscolhas = document.getElementById('lista-escolhas');
    const btnConfirmar = document.getElementById('btn-confirmar');
    const btnAdicionar = document.getElementById('btn-adicionar');
    const btnRemover = document.getElementById('btn-remover');
    const inputNome = document.getElementById('nome');

    // Converter nome para caixa alta enquanto digita
    if (inputNome) {
        inputNome.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    let aluno = null;
    let professoresDisponiveis = [
        { id: 1, nome: 'Ailton Luiz Silva', disciplina: 'GEOGRAFIA' },
        { id: 2, nome: 'Bruna Spadeto Oliveira', disciplina: 'SOCIOLOGIA' },
        { id: 3, nome: 'Giovana Manzoli Monteiro', disciplina: 'HISTÓRIA' },
        { id: 4, nome: 'João Francisco Alves Mendes', disciplina: 'HISTÓRIA' },
        { id: 5, nome: 'Kely de Jesus do Nascimento', disciplina: 'GEOGRAFIA' },
        { id: 6, nome: 'Wyller Carlos Silva de Oliveira', disciplina: 'FILOSOFIA' },
        { id: 7, nome: 'Nicholas Contijo Moreira', disciplina: 'Química - PCA' },
        { id: 8, nome: 'Gerlândia Estevam do Nascimento', disciplina: 'Química' },
        { id: 9, nome: 'Rondineli Schulthais Leite', disciplina: 'Matemática' },
        { id: 10, nome: 'Richardson Sant\'Ana Pimentel', disciplina: 'Matemática' },
        { id: 11, nome: 'Samantha de Barbi Vieira', disciplina: 'Biologia' },
        { id: 12, nome: 'Pedro Henrique Santos Oliveira', disciplina: 'Física' },
        { id: 13, nome: 'Gabriel Schimith dos Santos', disciplina: 'Física' },
        { id: 14, nome: 'Patrícia Caleffi Simões Moreira', disciplina: 'Educação Física' },
        { id: 15, nome: 'Alan Siqueira Ribeiro Pimentel', disciplina: 'Educação Física' },
        { id: 16, nome: 'Maria Aparecida Rosa Meneguelli', disciplina: 'Arte' },
        { id: 17, nome: 'Simone Motta', disciplina: 'Língua Portuguesa' },
        { id: 18, nome: 'Tatiana Ferreira Reis Rainha', disciplina: 'Língua Portuguesa' },
        { id: 19, nome: 'André Freitas Miranda', disciplina: 'Língua Portuguesa' },
        { id: 20, nome: 'Felipe dos Santos Guasti', disciplina: 'Língua Inglesa' },
        { id: 21, nome: 'Vitoria Rodrigues Santos', disciplina: 'Língua Inglesa' }
    ];
    let escolhasAluno = [];
    let professorSelecionado = null;

    // Função para atualizar a barra de progresso
    function atualizarProgresso() {
        const progresso = (escolhasAluno.length / 3) * 100;
        progressBar.style.width = `${progresso}%`;
    }

    // Função para atualizar o estado dos botões
    function atualizarBotoes() {
        if (btnAdicionar && btnRemover) {
            btnAdicionar.disabled = !professorSelecionado || escolhasAluno.length >= 3;
            btnRemover.disabled = !professorSelecionado;
        }
    }

    // Função para criar um card de professor
    function criarCardProfessor(professor, container, index = null) {
        const card = document.createElement('div');
        card.className = 'professor-card';
        card.dataset.id = professor.id;
        
        const isEscolhas = container === listaEscolhas;
        const maxEscolhas = 3;
        
        card.innerHTML = `
            <span class="numero">${index !== null ? index + 1 : ''}</span>
            <div class="info">
                <strong>${professor.nome}</strong>
                <div class="disciplina">${professor.disciplina}</div>
            </div>
            <button class="acao" title="${isEscolhas ? 'Remover da lista' : 'Adicionar à lista'}">${isEscolhas ? '−' : '+'}</button>
        `;
        
        const btnAcao = card.querySelector('.acao');
        btnAcao.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isEscolhas) {
                // Remover da lista de escolhas
                const professorIndex = escolhasAluno.findIndex(p => p.id === professor.id);
                if (professorIndex !== -1) {
                    professoresDisponiveis.push(escolhasAluno[professorIndex]);
                    escolhasAluno.splice(professorIndex, 1);
                }
            } else {
                // Adicionar à lista de escolhas
                if (escolhasAluno.length < maxEscolhas) {
                    const professorIndex = professoresDisponiveis.findIndex(p => p.id === professor.id);
                    if (professorIndex !== -1) {
                        escolhasAluno.push(professoresDisponiveis[professorIndex]);
                        professoresDisponiveis.splice(professorIndex, 1);
                    }
                }
            }
            renderizarProfessores();
            renderizarEscolhas();
        });

        if (!isEscolhas && escolhasAluno.length >= maxEscolhas) {
            card.classList.add('disabled');
            btnAcao.disabled = true;
        }
        
        container.appendChild(card);
        return card;
    }

    // Função para renderizar os professores disponíveis
    function renderizarProfessores() {
        listaProfessores.innerHTML = '';
        professores.forEach(professor => {
            criarCardProfessor(professor, listaProfessores);
        });
    }

    // Função para renderizar as escolhas do aluno
    function renderizarEscolhas() {
        listaEscolhas.innerHTML = '';
        escolhasAluno.forEach((professor, index) => {
            criarCardProfessor(professor, listaEscolhas, index);
        });
        atualizarProgresso();
        atualizarBotoes();
    }

    // Função para validar dados do professor
    function validarProfessor(professor) {
        return professor && 
               typeof professor === 'object' && 
               professor.id && 
               professor.nome;
    }

    // Função para validar nome do aluno
    function validarNomeAluno(nome) {
        return nome && 
               typeof nome === 'string' && 
               nome.trim().length >= 3 && 
               /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(nome);
    }

    // Função para validar turma
    function validarTurma(turma) {
        return turma && 
               typeof turma === 'string' && 
               turma.trim().length > 0;
    }

    // Função para mostrar notificação
    function mostrarNotificacao(mensagem, tipo = 'info') {
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
    }

    // Função para mostrar erro (substituindo a antiga mostrarErro)
    function mostrarErro(mensagem) {
        mostrarNotificacao(mensagem, 'error');
    }

    // Evento de submit do formulário de login
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nomeInput = document.getElementById('nome').value.trim();
        const turmaInput = document.getElementById('turma').value.trim();
        
        if (!validarNomeAluno(nomeInput)) {
            mostrarErro('Por favor, insira um nome válido (mínimo 3 letras, apenas caracteres alfabéticos).');
            return;
        }
        
        if (!validarTurma(turmaInput)) {
            mostrarErro('Por favor, insira uma turma válida.');
            return;
        }

        try {
            // Verificar se o aluno existe no sistema
            const response = await fetch('/api/verificar-aluno', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome: nomeInput.toUpperCase(),
                    turma: turmaInput
                })
            });

            const data = await response.json();

            if (!data.verificado) {
                mostrarErro('Nome não encontrado. Digite seu nome completo exatamente como consta na chamada.');
                return;
            }

            // Se chegou aqui, o aluno foi verificado com sucesso
            nomeCompleto = nomeInput.toUpperCase();
            turma = turmaInput;
            
            // Verificar se o aluno já tem preferências
            const preferenciasResponse = await fetch(`/api/preferencias/${turma}/${nomeCompleto}`);
            const preferenciasData = await preferenciasResponse.json();

            formLogin.style.display = 'none';
            escolhasContainer.style.display = 'block';
            infoAluno.innerHTML = `<strong>Aluno:</strong> ${nomeCompleto} | <strong>Turma:</strong> ${turma}`;
            
            // Inicializar a lista de professores disponíveis
            professores = professoresDisponiveis;
            renderizarProfessores();

            if (preferenciasData.sucesso && preferenciasData.preferencias) {
                // Aluno já tem preferências
                const prefsOrdenadas = preferenciasData.preferencias.preferencias;
                
                // Desabilitar todos os botões de ação
                document.querySelectorAll('.acao').forEach(btn => {
                    btn.disabled = true;
                });

                // Marcar os professores escolhidos com numeração
                professores.forEach(professor => {
                    const card = document.querySelector(`.professor-card[data-id="${professor.id}"]`);
                    if (card && prefsOrdenadas.includes(professor.nome)) {
                        const posicao = prefsOrdenadas.indexOf(professor.nome) + 1;
                        card.classList.add('preferencia-final');
                        card.classList.add(`preferencia-${posicao}`);
                        
                        // Adicionar número da preferência
                        const numero = document.createElement('div');
                        numero.className = 'numero-preferencia';
                        numero.textContent = posicao;
                        card.appendChild(numero);
                    }
                });

                // Desabilitar botão de confirmação
                if (btnConfirmar) {
                    btnConfirmar.disabled = true;
                    btnConfirmar.style.display = 'none';
                }

                mostrarMensagemFinal('Suas preferências já foram registradas e não podem ser alteradas.');
            } else {
                // Aluno não tem preferências, manter fluxo normal
                if (btnConfirmar) {
                    btnConfirmar.disabled = false;
                    btnConfirmar.style.display = 'block';
                }
            }

        } catch (error) {
            console.error('Erro ao verificar aluno:', error);
            mostrarErro('Erro ao verificar aluno. Por favor, tente novamente.');
        }
    });

    // Carregar professores do servidor
    async function carregarProfessores() {
        try {
            const response = await fetch('/api/professores');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Dados de professores inválidos');
            }
            
            professores = data.filter(validarProfessor);
            if (professores.length === 0) {
                throw new Error('Nenhum professor válido encontrado');
            }
            
            atualizarListaProfessores();
        } catch (error) {
            console.error('Erro ao carregar professores:', error);
            mostrarErro('Não foi possível carregar a lista de professores. Por favor, recarregue a página.');
        }
    }

    // Função para mostrar mensagem final
    function mostrarMensagemFinal(mensagem) {
        const container = document.getElementById('escolhas-container');
        if (!container) return;

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

    // Evento de click no botão confirmar
    btnConfirmar.addEventListener('click', async () => {
        if (escolhasAluno.length === 3) {
            try {
                const dadosEnvio = {
                    nome: nomeCompleto.toUpperCase(),
                    turma: turma.toUpperCase(),
                    preferencias: escolhasAluno.map(p => p.nome)
                };

                console.log('Enviando dados:', dadosEnvio);

                const response = await fetch('/api/preferencias', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dadosEnvio)
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.erro || 'Erro ao enviar escolhas');
                }

                const data = await response.json();
                if (data.sucesso) {
                    mostrarNotificacao('Suas escolhas foram confirmadas com sucesso!', 'success');
                    btnConfirmar.disabled = true;
                    
                    // Desabilitar todos os botões de ação
                    document.querySelectorAll('.acao').forEach(btn => {
                        btn.disabled = true;
                    });
                } else {
                    throw new Error(data.mensagem || 'Erro ao confirmar escolhas');
                }
            } catch (error) {
                console.error('Erro ao enviar escolhas:', error);
                mostrarErro(error.message || 'Ocorreu um erro ao enviar suas escolhas. Por favor, tente novamente.');
            }
        } else {
            mostrarErro('Por favor, selecione 3 professores antes de confirmar.');
        }
    });
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
    
    professores.forEach((professor, index) => {
        const card = criarCardProfessor(professor, index);
        lista.appendChild(card);
    });
}

function atualizarListaEscolhas() {
    const lista = document.getElementById('lista-escolhas');
    lista.innerHTML = '';
    
    ordemPreferencia.forEach((professorId, index) => {
        const professor = professores.find(p => p.id === professorId);
        if (professor) {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${professor.nome}`;
            lista.appendChild(li);
        }
    });
}

async function enviarEscolhas() {
    if (ordemPreferencia.length !== 3) {
        mostrarErro('Selecione exatamente 3 professores antes de enviar.');
        return;
    }
    
    try {
        const response = await fetch('/api/escolhas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nomeCompleto,
                turma,
                preferencias: ordemPreferencia
            })
        });
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Erro ao enviar escolhas');
        }
        
        alert('Suas escolhas foram enviadas com sucesso!');
        document.getElementById('btn-enviar').disabled = true;
        
        // Limpar o intervalo de atualização quando as escolhas forem enviadas
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    } catch (error) {
        console.error('Erro ao enviar escolhas:', error);
        mostrarErro('Ocorreu um erro ao enviar suas escolhas. Por favor, tente novamente.');
    }
}

function iniciarAtualizacaoStatusFila() {
    atualizarStatusFila();
    // Armazenar referência do intervalo para poder limpar depois
    updateInterval = setInterval(atualizarStatusFila, 30000);
}

async function atualizarStatusFila() {
    try {
        const response = await fetch('/api/status-fila');
        const status = await response.json();
        
        document.getElementById('posicao-fila').textContent = status.posicaoFila;
        document.getElementById('total-fila').textContent = status.totalFila;
        document.getElementById('tempo-estimado').textContent = status.tempoEstimado;
        
        const progresso = (status.posicaoFila / status.totalFila) * 100;
        document.querySelector('.progress').style.width = `${100 - progresso}%`;
    } catch (error) {
        console.error('Erro ao atualizar status da fila:', error);
    }
} 