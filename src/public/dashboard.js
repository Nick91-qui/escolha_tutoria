// Constants
const API = {
    PROCESS: '/api/assignments/process',
    CLEAR: '/api/assignments/clear',
    STATS: '/api/assignments/stats',
    DOWNLOAD: '/api/assignments/download-lists',
    DOWNLOAD_PREFERENCES: '/api/assignments/download-preferences'
};

const DOM = {
    initialize() {
        this.btnProcess = document.getElementById('btnProcess');
        this.btnClear = document.getElementById('btnClear');
        this.overview = document.getElementById('overview');
        this.logPanel = document.getElementById('logPanel');
        this.tutorStats = document.getElementById('tutorStats');
        this.unassignedList = document.getElementById('unassignedList');
        this.btnDownload = document.getElementById('btnDownload');
        this.spinnerDownload = this.btnDownload.querySelector('.spinner');
        this.spinnerDownload.style.display = 'none';
        this.btnDownloadPreferences = document.getElementById('btnDownloadPreferences');
        this.spinnerDownloadPreferences = this.btnDownloadPreferences.querySelector('.spinner');
        this.spinnerDownloadPreferences.style.display = 'none';
        
        // Get spinner references
        this.spinnerProcess = this.btnProcess.querySelector('.spinner');
        this.spinnerClear = this.btnClear.querySelector('.spinner');
        
        // Ensure spinners are hidden initially
        this.spinnerProcess.style.display = 'none';
        this.spinnerClear.style.display = 'none';

        this.modal = document.getElementById('tutorModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalContent = document.getElementById('modalContent');
        this.closeModal = document.querySelector('.close-modal');
        
        // Add modal close events
        this.closeModal.addEventListener('click', () => this.modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.modal.style.display = 'none';
            }
        });
    }
};

// Log Management
const Logger = {
    add(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `${timestamp} - ${message}`;
        DOM.logPanel.appendChild(logEntry);
        this.scrollToBottom();
    },

    scrollToBottom() {
        DOM.logPanel.scrollTop = DOM.logPanel.scrollHeight;
    },

    clear() {
        DOM.logPanel.innerHTML = '';
    }
};

// API Calls
const AssignmentService = {
    async process() {
        const response = await fetch(API.PROCESS, { method: 'POST' });
        return await response.json();
    },

    async clear() {
        const response = await fetch(API.CLEAR, { method: 'DELETE' });
        return await response.json();
    },

    async getStats() {
        const response = await fetch(API.STATS);
        return await response.json();
    },

    async downloadLists() {
        const response = await fetch(API.DOWNLOAD);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao baixar listas');
        }
        return response.blob();
    },

    async downloadPreferencesList() {
        const response = await fetch(API.DOWNLOAD_PREFERENCES);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao baixar lista de escolhas');
        }
        return response.blob();
    }
};

// UI Rendering
const UIRenderer = {
    renderOverview(stats) {
        // Calculate available and full tutors correctly
        const availableTutors = stats.tutors.details.filter(tutor => {
            const maxStudents = this.isPedagogicalRole(tutor.disciplina) ? 6 : 15;
            return tutor.currentCount < maxStudents;
        });

        const fullTutors = stats.tutors.details.filter(tutor => {
            const maxStudents = this.isPedagogicalRole(tutor.disciplina) ? 6 : 15;
            return tutor.currentCount >= maxStudents;
        });

        const html = `
            <div class="stat-grid">
                <div class="stat-item">
                    <h3>Total de Alunos</h3>
                    <p>${stats.total.students}</p>
                </div>
                <div class="stat-item">
                    <h3>Alunos Atribuídos</h3>
                    <p>${stats.total.assignedStudents}</p>
                </div>
                <div class="stat-item">
                    <h3>Tutores Disponíveis</h3>
                    <p>${availableTutors.length}</p>
                </div>
                <div class="stat-item">
                    <h3>Tutores Lotados</h3>
                    <p>${fullTutors.length}</p>
                </div>
            </div>
        `;
        DOM.overview.innerHTML = html;
    },

    renderTutorStats(stats) {
        const html = stats.tutors.details.map(tutor => {
            // Get max students based on role
            const maxStudents = this.isPedagogicalRole(tutor.disciplina) ? 6 : 15;
            
            return `
                <div class="tutor-item">
                    <h4 class="tutor-name" data-tutor='${JSON.stringify(tutor)}'>${tutor.nome} (${tutor.disciplina})</h4>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${(tutor.currentCount / maxStudents) * 100}%">
                            ${tutor.currentCount}/${maxStudents}
                        </div>
                    </div>
                    <p class="remaining">Vagas restantes: ${maxStudents - tutor.currentCount}</p>
                </div>
            `;
        }).join('');
        
        DOM.tutorStats.innerHTML = html;

        // Add click handlers for tutor names
        DOM.tutorStats.querySelectorAll('.tutor-name').forEach(element => {
            element.addEventListener('click', () => {
                const tutor = JSON.parse(element.dataset.tutor);
                this.showTutorModal(tutor);
            });
        });
    },

    showTutorModal(tutor) {
        const maxStudents = this.isPedagogicalRole(tutor.disciplina) ? 6 : 15;
        
        DOM.modalTitle.textContent = `Alunos de ${tutor.nome} - ${tutor.disciplina}`;
        
        // Ordenar alunos pela data de registro (do mais antigo para o mais recente)
        const sortedStudents = tutor.students ? [...tutor.students].sort((a, b) => {
            // Verificar se dataRegistro existe antes de comparar
            if (!a.dataRegistro) return -1;
            if (!b.dataRegistro) return 1;
            return new Date(a.dataRegistro || 0) - new Date(b.dataRegistro || 0);
        }) : [];
        
        const studentsList = sortedStudents.length 
            ? `<ul class="student-list">
                ${sortedStudents.map((student, index) => 
                    `<li>${index + 1}. ${student.nome} (${student.turma})${student.dataRegistro ? ` - ${new Date(student.dataRegistro).toLocaleString('pt-BR')}` : ''}</li>`
                ).join('')}
               </ul>`
            : '<p>Nenhum aluno atribuído ainda.</p>';
    
        DOM.modalContent.innerHTML = `
            <div class="modal-stats">
                <p>Total de alunos: ${tutor.currentCount}</p>
                <p>Vagas disponíveis: ${maxStudents - tutor.currentCount}</p>
                <p>Limite máximo: ${maxStudents} alunos</p>
            </div>
            <div class="modal-students-wrapper">
                ${studentsList}
            </div>
        `;
        
        DOM.modal.style.display = 'block';
    },

    renderUnassignedStudents(stats) {
        // Get unique classes
        const classes = [...new Set(stats.unassignedStudents.map(s => s.turma))].sort();
        
        // Create filter options
        const filterHtml = `
            <div class="filter-section">
                <label for="classFilter">Filtrar por turma:</label>
                <select id="classFilter" class="class-filter">
                    <option value="all">Todas as turmas</option>
                    ${classes.map(turma => 
                        `<option value="${turma}">${turma}</option>`
                    ).join('')}
                </select>
            </div>
        `;

        // Create student list with filter
        const studentListHtml = `
            ${filterHtml}
            <div class="students-section">
                ${stats.unassignedStudents.length === 0 
                    ? '<p class="success">Todos os alunos foram atribuídos!</p>'
                    : `
                        <p class="warning">Alunos aguardando atribuição: <span id="studentCount">${stats.unassignedStudents.length}</span></p>
                        <ul class="student-list">
                            ${stats.unassignedStudents.map(student => 
                                `<li data-turma="${student.turma}">${student.nome} (${student.turma})</li>`
                            ).join('')}
                        </ul>
                    `}
            </div>
        `;

        DOM.unassignedList.innerHTML = studentListHtml;

        // Add filter event listener
        const filterSelect = document.getElementById('classFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                const selectedClass = e.target.value;
                const studentItems = DOM.unassignedList.querySelectorAll('.student-list li');
                let visibleCount = 0;

                studentItems.forEach(item => {
                    if (selectedClass === 'all' || item.dataset.turma === selectedClass) {
                        item.style.display = '';
                        visibleCount++;
                    } else {
                        item.style.display = 'none';
                    }
                });

                // Update count
                const countSpan = document.getElementById('studentCount');
                if (countSpan) {
                    countSpan.textContent = visibleCount;
                }
            });
        }
    },

    isPedagogicalRole(disciplina) {
        const pedagogicalRoles = [
            'CASF',
            'COORDENADOR',
            'COORDENADORA',
            'PEDAGOGO',
            'PEDAGOGA',
            'DIRETORA',
            'DIRETOR',
            'COORDENADORA PEDAGOGICA',
            'COORDENADOR PEDAGOGICO'
        ];
        
        return pedagogicalRoles.some(role => 
            this.normalizarTexto(disciplina).includes(this.normalizarTexto(role))
        );
    },

    normalizarTexto(texto) {
        if (!texto) return '';
        return texto
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    },

    updateAll(stats) {
        this.renderOverview(stats);
        this.renderTutorStats(stats);
        this.renderUnassignedStudents(stats);

        // Update download buttons state
        const hasAssignments = stats.total.assignedStudents > 0;
        DOM.btnDownload.disabled = !hasAssignments;
        DOM.btnDownloadPreferences.disabled = !hasAssignments;  // Enable/disable preferences button based on assignments
    }
};

// Event Handlers
const EventHandlers = {
    async handleProcess() {
        const button = DOM.btnProcess;
        const spinner = button.querySelector('.spinner');
        
        try {
            button.disabled = true;
            spinner.hidden = false;
            Logger.add('Iniciando processamento de atribuições...');

            const result = await AssignmentService.process();
            
            if (result.success) {
                Logger.add('Processamento concluído com sucesso!', 'success');
                const stats = await AssignmentService.getStats();
                UIRenderer.updateAll(stats);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            Logger.add(`Erro no processamento: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            spinner.hidden = true;
        }
    },

    async handleClear() {
        if (!confirm('Tem certeza que deseja limpar todas as atribuições?')) return;

        const button = DOM.btnClear;
        const spinner = button.querySelector('.spinner');

        try {
            button.disabled = true;
            spinner.hidden = false;
            Logger.add('Removendo todas as atribuições...');

            const result = await AssignmentService.clear();
            
            if (result.success) {
                Logger.add(`${result.deletedCount} atribuições removidas`, 'success');
                const stats = await AssignmentService.getStats();
                UIRenderer.updateAll(stats);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            Logger.add(`Erro ao limpar atribuições: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            spinner.hidden = true;
        }
    },

    async handleDownload() {
        const button = DOM.btnDownload;
        const spinner = DOM.spinnerDownload;

        try {
            button.disabled = true;
            spinner.style.display = 'inline-block';
            Logger.add('Gerando PDFs das listas...');

            const blob = await AssignmentService.downloadLists();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `listas-tutores-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Logger.add('Download das listas concluído!', 'success');
        } catch (error) {
            Logger.add(`Erro ao baixar listas: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            spinner.style.display = 'none';
        }
    },

    async handleDownloadPreferences() {
        const button = DOM.btnDownloadPreferences;
        const spinner = DOM.spinnerDownloadPreferences;

        try {
            button.disabled = true;
            spinner.style.display = 'inline-block';
            Logger.add('Gerando PDF de escolhas dos alunos...');

            const blob = await AssignmentService.downloadPreferencesList();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lista-escolhas-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Logger.add('Download da lista de escolhas concluído!', 'success');
        } catch (error) {
            Logger.add(`Erro ao baixar lista de escolhas: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            spinner.style.display = 'none';
        }
    }
};

// Initialize Dashboard
async function initializeDashboard() {
    try {
        DOM.initialize();
        
        // Attach event listeners
        DOM.btnProcess.addEventListener('click', EventHandlers.handleProcess);
        DOM.btnClear.addEventListener('click', EventHandlers.handleClear);
        DOM.btnDownload.addEventListener('click', EventHandlers.handleDownload);
        DOM.btnDownloadPreferences.addEventListener('click', EventHandlers.handleDownloadPreferences);
        
        // Load initial data
        Logger.add('Carregando dados iniciais...');
        const stats = await AssignmentService.getStats();
        UIRenderer.updateAll(stats);
        Logger.add('Dashboard inicializado com sucesso', 'success');
    } catch (error) {
        Logger.add(`Erro ao inicializar dashboard: ${error.message}`, 'error');
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initializeDashboard);