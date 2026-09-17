/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo de Utilidades de Interface, Notificações e Acessibilidade
 * =========================================================
 */

const UI = {
    /**
     * Sanitiza qualquer string para impedir ataques XSS (Cross-Site Scripting)
     */
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Formata um valor numérico em moeda brasileira (R$ 0,00)
     */
    formatCurrency(value) {
        const num = Number(value) || 0;
        return num.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    },

    /**
     * Alias em português para formatCurrency
     */
    formatarMoeda(value) {
        return this.formatCurrency(value);
    },

    /**
     * Aplica máscara de moeda em tempo real no input
     */
    mascaraMoeda(input) {
        let v = input.value.replace(/\D/g, '');
        v = (Number(v) / 100).toFixed(2) + '';
        v = v.replace('.', ',');
        v = v.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        input.value = v;
    },

    /**
     * Converte o texto com máscara de moeda de volta para float
     */
    lerMoeda(str) {
        if (!str) return 0;
        const limpo = String(str).replace(/\./g, '').replace(',', '.');
        return parseFloat(limpo) || 0;
    },

    /**
     * Controle da barra de progresso / carregamento
     */
    setLoading(ativo) {
        const bar = document.getElementById('load-bar');
        if (!bar) return;
        
        if (ativo) {
            bar.style.width = '70%';
        } else {
            bar.style.width = '100%';
            setTimeout(() => {
                bar.style.width = '0%';
            }, 250);
        }
    },

    /**
     * Abre um modal pelo ID, aplicando atributos de acessibilidade
     */
    abrirModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('hidden');
            el.style.display = '';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
            // Foca o primeiro input do modal se houver
            const firstInput = el.querySelector('input:not([type="hidden"]), select, textarea, button.btn-primary');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 80);
            }
        }
    },

    /**
     * Fecha um modal pelo ID
     */
    fecharModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            if (el.style.display && el.style.display !== 'none') {
                el.style.display = 'none';
            }
        }
    },

    /**
     * Sistema de notificações Toast (não bloqueia a thread como alert())
     * @param {string} mensagem - Texto da notificação
     * @param {'success'|'error'|'warning'|'info'} tipo - Tipo do toast
     * @param {number} duracao - Tempo em ms (padrão: 3500ms)
     */
    toast(mensagem, tipo = 'info', duracao = 3500) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('role', 'status');
            document.body.appendChild(container);
        }

        const icons = {
            success: 'ph-check-circle',
            error:   'ph-x-circle',
            warning: 'ph-warning',
            info:    'ph-info'
        };
        const iconClass = icons[tipo] || icons.info;

        const item = document.createElement('div');
        item.className = `toast-item toast-${tipo}`;
        item.innerHTML = `<i class="ph ${iconClass}"></i><span>${this.escapeHtml(mensagem)}</span>`;

        // Fecha ao clicar
        item.onclick = () => {
            item.classList.remove('toast-show');
            setTimeout(() => item.remove(), 250);
        };

        container.appendChild(item);

        // Animação de entrada
        requestAnimationFrame(() => {
            item.classList.add('toast-show');
        });

        // Remoção automática
        setTimeout(() => {
            if (item.parentElement) {
                item.classList.remove('toast-show');
                setTimeout(() => item.remove(), 260);
            }
        }, duracao);
    },

    /**
     * Cópia para área de transferência moderna (navigator.clipboard)
     * com fallback seguro caso permissão não seja concedida.
     * @param {string} texto
     * @param {HTMLTextAreaElement|HTMLInputElement} [fallbackInput]
     */
    async copiarParaClipboard(texto, fallbackInput) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(texto);
                return true;
            } catch (err) {
                console.warn('Clipboard API rejeitada, tentando fallback:', err);
            }
        }
        if (fallbackInput) {
            fallbackInput.select();
            document.execCommand('copy');
            return true;
        }
        return false;
    }
};

// ─── Atalho global da tecla ESC para fechar qualquer modal ativo ─────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modais = document.querySelectorAll('.modal-overlay:not(.hidden)');
        modais.forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        });
        // Fecha sidebar no mobile se estiver aberta
        const sidebar = document.getElementById('app-sidebar');
        const backdrop = document.querySelector('.sidebar-backdrop');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
        }
        if (backdrop && backdrop.classList.contains('active')) {
            backdrop.classList.remove('active');
        }
    }
});

window.UI = UI;
