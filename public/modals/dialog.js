/**
 * =========================================================
 * AUTOCAR BS - MOTOR DE MODAIS DE DIÁLOGO (ALERT & CONFIRM)
 * Localização: public/modals/dialog.js
 * =========================================================
 */

const DialogModal = {
    overlay: null,
    card: null,
    iconBox: null,
    icon: null,
    titleEl: null,
    messageEl: null,
    btnCancel: null,
    btnConfirm: null,
    currentResolve: null,
    activeKeyDownHandler: null,

    /**
     * Garante que o template do modal exista no DOM
     */
    ensureDOM() {
        if (this.overlay) return;

        let existing = document.getElementById('app-dialog-modal');
        if (!existing) {
            const container = document.createElement('div');
            container.innerHTML = `
                <div id="app-dialog-modal" class="app-dialog-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
                    <div class="app-dialog-card" id="dialog-card">
                        <div class="app-dialog-icon-wrapper" id="dialog-icon-box">
                            <i class="ph" id="dialog-icon"></i>
                        </div>
                        <div class="app-dialog-content">
                            <h3 class="app-dialog-title" id="dialog-title">Atenção</h3>
                            <div class="app-dialog-message" id="dialog-message">Mensagem</div>
                        </div>
                        <div class="app-dialog-actions" id="dialog-actions">
                            <button type="button" class="btn btn-secondary app-dialog-btn-cancel" id="dialog-btn-cancel" style="display:none;">Cancelar</button>
                            <button type="button" class="btn btn-primary app-dialog-btn-confirm" id="dialog-btn-confirm">OK</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(container.firstElementChild);
            existing = document.getElementById('app-dialog-modal');
        }

        this.overlay = existing;
        this.card = document.getElementById('dialog-card');
        this.iconBox = document.getElementById('dialog-icon-box');
        this.icon = document.getElementById('dialog-icon');
        this.titleEl = document.getElementById('dialog-title');
        this.messageEl = document.getElementById('dialog-message');
        this.btnCancel = document.getElementById('dialog-btn-cancel');
        this.btnConfirm = document.getElementById('dialog-btn-confirm');

        // Fecha ao clicar fora do card se for alert
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                // Se for confirm, clicar fora cancela
                this.close(false);
            }
        });

        this.btnCancel.addEventListener('click', () => this.close(false));
        this.btnConfirm.addEventListener('click', () => this.close(true));
    },

    /**
     * Abre um modal de Alerta customizado
     * @param {string} message - Mensagem do alerta
     * @param {Object} [options] - Opções { title, type, buttonText }
     * @returns {Promise<void>}
     */
    alert(message, options = {}) {
        this.ensureDOM();
        return new Promise((resolve) => {
            this.currentResolve = resolve;

            const type = options.type || (options.danger ? 'danger' : 'warning');
            const title = options.title || (type === 'danger' ? 'Atenção' : (type === 'success' ? 'Sucesso' : 'Aviso'));
            const buttonText = options.buttonText || 'ENTENDIDO';

            this.setupTheme(type);
            this.titleEl.textContent = title;
            this.messageEl.textContent = message || '';
            this.btnConfirm.textContent = buttonText;
            this.btnCancel.style.display = 'none';

            this.show();
        });
    },

    /**
     * Abre um modal de Confirmação customizado
     * @param {string} message - Pergunta de confirmação
     * @param {Object} [options] - Opções { title, type, confirmText, cancelText, danger }
     * @returns {Promise<boolean>}
     */
    confirm(message, options = {}) {
        this.ensureDOM();
        return new Promise((resolve) => {
            this.currentResolve = resolve;

            const isDestructive = options.danger || /excluir|apagar|remover|limpar|deletar/i.test(message);
            const type = options.type || (isDestructive ? 'danger' : 'question');
            const title = options.title || (isDestructive ? 'Confirmar Ação' : 'Confirmação');
            const confirmText = options.confirmText || (isDestructive ? 'Excluir' : 'Confirmar');
            const cancelText = options.cancelText || 'Cancelar';

            this.setupTheme(type);
            this.titleEl.textContent = title;
            this.messageEl.textContent = message || '';
            this.btnConfirm.textContent = confirmText;
            this.btnCancel.textContent = cancelText;
            this.btnCancel.style.display = 'inline-flex';

            this.show();
        });
    },

    setupTheme(type) {
        // Remove classes anteriores
        this.card.classList.remove('dialog-warning', 'dialog-danger', 'dialog-success', 'dialog-info', 'dialog-question');
        this.card.classList.add(`dialog-${type}`);

        // Define o ícone Phosphor correspondente
        const icons = {
            warning: 'ph-warning',
            danger: 'ph-warning-octagon',
            success: 'ph-check-circle',
            info: 'ph-info',
            question: 'ph-question'
        };

        const iconClass = icons[type] || 'ph-warning';
        this.icon.className = `ph ${iconClass}`;
    },

    show() {
        this.overlay.style.display = 'flex';
        // Força reflow para animação
        void this.overlay.offsetWidth;
        this.overlay.classList.add('active');

        // Foco automático no botão de ação
        setTimeout(() => {
            if (this.btnConfirm) this.btnConfirm.focus();
        }, 60);

        // Captura atalhos Enter e Escape
        if (this.activeKeyDownHandler) {
            document.removeEventListener('keydown', this.activeKeyDownHandler);
        }
        this.activeKeyDownHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.close(true);
            }
        };
        document.addEventListener('keydown', this.activeKeyDownHandler, true);
    },

    close(result) {
        if (this.activeKeyDownHandler) {
            document.removeEventListener('keydown', this.activeKeyDownHandler, true);
            this.activeKeyDownHandler = null;
        }

        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.style.display = 'none';
            if (typeof this.currentResolve === 'function') {
                const res = this.currentResolve;
                this.currentResolve = null;
                res(result);
            }
        }, 180);
    }
};

// Exportação global
window.DialogModal = DialogModal;
window.Modal = DialogModal;

// Override transparente do alert e confirm nativos do navegador
// para que qualquer chamada involuntária seja apresentada no modal elegante
window._nativeAlert = window.alert;
window._nativeConfirm = window.confirm;

window.alert = function (message) {
    return DialogModal.alert(String(message));
};

window.confirm = function (message) {
    // Para chamadas síncronas que esperam retorno imediato, exibe o modal
    return DialogModal.confirm(String(message));
};

// Auto-inicialização quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DialogModal.ensureDOM());
} else {
    DialogModal.ensureDOM();
}

