/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo de Autenticação: Lógica de Login & Sessão Premium
 * Com Autocomplete Dinâmico de E-mails e Histórico Inteligente
 * =========================================================
 */

const AuthModule = {
    EMAIL_HISTORY_KEY: 'autocar_email_history',
    REMEMBER_EMAIL_KEY: 'autocar_remember_email',

    /**
     * Inicializa os eventos da tela de login
     */
    init() {
        const formLogin = document.getElementById('form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => {
                e.preventDefault();
                this.fazerLogin();
            });
        }

        const inputEmail = document.getElementById('login-email');
        const inputSenha = document.getElementById('login-senha');
        const dropdown = document.getElementById('email-autocomplete-list');

        if (inputEmail) {
            // Navegação e submissão
            inputEmail.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (dropdown && dropdown.style.display !== 'none') {
                        const firstItem = dropdown.querySelector('.auth-autocomplete-item');
                        if (firstItem && inputEmail.value !== firstItem.getAttribute('data-email')) {
                            // Se dropdown está aberto e o usuário aperta enter sem valor completo
                            const email = firstItem.getAttribute('data-email');
                            if (email) {
                                inputEmail.value = email;
                                dropdown.style.display = 'none';
                                this.validarFormatoEmail();
                                if (inputSenha) inputSenha.focus();
                                e.preventDefault();
                                return;
                            }
                        }
                    }
                    if (inputSenha && !inputSenha.value) {
                        e.preventDefault();
                        inputSenha.focus();
                    }
                } else if (e.key === 'Escape' && dropdown) {
                    dropdown.style.display = 'none';
                }
            });

            // Autocomplete em tempo real ao digitar e validação instantânea de e-mail
            inputEmail.addEventListener('input', () => {
                this.atualizarAutocomplete();
                this.validarFormatoEmail();
            });

            // Exibir opções recentes ao focar
            inputEmail.addEventListener('focus', () => {
                this.atualizarAutocomplete();
            });

            // Fechar ao clicar fora (com pequeno delay para capturar o clique do mouse)
            inputEmail.addEventListener('blur', () => {
                setTimeout(() => {
                    if (dropdown) dropdown.style.display = 'none';
                }, 220);
            });
        }

        if (inputSenha) {
            // Detector instantâneo de Caps Lock
            const capsWarning = document.getElementById('auth-capslock-warning');
            const checarCapsLock = (e) => {
                if (!capsWarning) return;
                if (e.getModifierState && e.getModifierState('CapsLock')) {
                    capsWarning.style.display = 'flex';
                } else {
                    capsWarning.style.display = 'none';
                }
            };
            inputSenha.addEventListener('keydown', checarCapsLock);
            inputSenha.addEventListener('keyup', checarCapsLock);
            inputSenha.addEventListener('blur', () => {
                if (capsWarning) capsWarning.style.display = 'none';
            });
        }

        // Listener para sessões expiradas emitidas pelo api.js
        window.addEventListener('auth:expired', () => {
            this.mostrarTelaLogin();
        });
    },

    /**
     * Retorna a lista de e-mails gravados no histórico local
     */
    obterHistoricoEmails() {
        try {
            const raw = localStorage.getItem(this.EMAIL_HISTORY_KEY);
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) return list;
            }
        } catch (_) {}
        return [];
    },

    /**
     * Salva um e-mail no histórico (sem duplicatas, mantendo até 6)
     */
    salvarEmailHistorico(email) {
        if (!email || !email.includes('@')) return;
        try {
            let history = this.obterHistoricoEmails();
            history = history.filter(e => e.toLowerCase() !== email.toLowerCase());
            history.unshift(email.trim());
            if (history.length > 6) history = history.slice(0, 6);
            localStorage.setItem(this.EMAIL_HISTORY_KEY, JSON.stringify(history));
        } catch (_) {}
    },

    /**
     * Remove um item específico do histórico
     */
    removerEmailHistorico(emailRemover, ev) {
        if (ev) {
            ev.stopPropagation();
            ev.preventDefault();
        }
        try {
            let history = this.obterHistoricoEmails();
            history = history.filter(e => e.toLowerCase() !== emailRemover.toLowerCase());
            localStorage.setItem(this.EMAIL_HISTORY_KEY, JSON.stringify(history));
            this.atualizarAutocomplete();
        } catch (_) {}
    },

    /**
     * Renderiza o dropdown flutuante de sugestões de e-mail
     */
    atualizarAutocomplete() {
        const input = document.getElementById('login-email');
        const dropdown = document.getElementById('email-autocomplete-list');
        if (!input || !dropdown) return;

        const val = input.value.trim().toLowerCase();
        const history = this.obterHistoricoEmails();

        if (!history || history.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        // Se o usuário digitou, filtra por correspondência. Se está vazio, mostra os recentes.
        const matches = val 
            ? history.filter(item => item.toLowerCase().includes(val))
            : history;

        if (matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        dropdown.innerHTML = `
            <div class="auth-autocomplete-header">
                <span>E-mails Recentes</span>
                <i class="ph ph-clock-counter-clockwise"></i>
            </div>
            ${matches.map(email => `
                <div class="auth-autocomplete-item" data-email="${email}">
                    <i class="ph ph-user-circle auth-ac-icon"></i>
                    <span class="auth-autocomplete-text">${this.destacarMatch(email, val)}</span>
                    <button type="button" class="auth-autocomplete-del" title="Remover este e-mail do histórico" onclick="AuthModule.removerEmailHistorico('${email}', event)">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            `).join('')}
        `;

        dropdown.style.display = 'block';

        // Vincula evento de seleção em cada item
        dropdown.querySelectorAll('.auth-autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault(); // Evita perder o foco antes do clique
            });
            item.addEventListener('click', (ev) => {
                if (ev.target.closest('.auth-autocomplete-del')) return;
                const email = item.getAttribute('data-email');
                if (email) {
                    input.value = email;
                    dropdown.style.display = 'none';
                    this.validarFormatoEmail();
                    const pwd = document.getElementById('login-senha');
                    if (pwd) pwd.focus();
                }
            });
        });
    },

    /**
     * Valida formato do e-mail e exibe/oculta ícone de confirmação
     */
    validarFormatoEmail() {
        const input = document.getElementById('login-email');
        const icon = document.getElementById('email-valid-icon');
        if (!input || !icon) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const valido = emailRegex.test(input.value.trim());
        icon.style.display = valido ? 'block' : 'none';
    },

    /**
     * Salva ou remove o e-mail lembrado
     */
    salvarLembrarEmail(email, deveLembrar) {
        try {
            if (deveLembrar && email && email.includes('@')) {
                localStorage.setItem(this.REMEMBER_EMAIL_KEY, email.trim());
            } else {
                localStorage.removeItem(this.REMEMBER_EMAIL_KEY);
            }
        } catch (_) {}
    },

    /**
     * Obtém o e-mail gravado no Lembrar de Mim
     */
    obterLembrarEmail() {
        try {
            return localStorage.getItem(this.REMEMBER_EMAIL_KEY) || '';
        } catch (_) {
            return '';
        }
    },

    /**
     * Destaca em negrito as letras que o usuário já digitou
     */
    destacarMatch(email, query) {
        if (!query) return email;
        const idx = email.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return email;
        const before = email.slice(0, idx);
        const match = email.slice(idx, idx + query.length);
        const after = email.slice(idx + query.length);
        return `${before}<strong>${match}</strong>${after}`;
    },

    /**
     * Exibe a tela de login
     */
    mostrarTelaLogin() {
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app-container');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appContainer) appContainer.style.opacity = '0';

        this.limparErro();

        const inputSenha = document.getElementById('login-senha');
        const inputEmail = document.getElementById('login-email');
        const checkLembrar = document.getElementById('auth-remember-check');
        const capsWarning = document.getElementById('auth-capslock-warning');

        if (capsWarning) capsWarning.style.display = 'none';
        if (inputSenha) inputSenha.value = '';

        if (inputEmail) {
            const emailLembrado = this.obterLembrarEmail();
            if (emailLembrado) {
                inputEmail.value = emailLembrado;
                if (checkLembrar) checkLembrar.checked = true;
                if (inputSenha) inputSenha.focus();
            } else {
                if (checkLembrar) checkLembrar.checked = false;
                const history = this.obterHistoricoEmails();
                if (!inputEmail.value && history.length > 0) {
                    inputEmail.value = history[0];
                }
                if (!inputEmail.value) {
                    inputEmail.focus();
                } else if (inputSenha) {
                    inputSenha.focus();
                }
            }
            this.validarFormatoEmail();
        }
    },

    /**
     * Oculta a tela de login
     */
    ocultarTelaLogin() {
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app-container');
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContainer) appContainer.style.opacity = '1';
    },

    /**
     * Alterna a visibilidade da senha (olhinho)
     */
    toggleVisibilidadeSenha(btn) {
        const input = document.getElementById('login-senha');
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const icon = btn ? btn.querySelector('i') : document.getElementById('icon-toggle-pwd');
        if (icon) {
            icon.className = isPassword ? 'ph ph-eye-slash' : 'ph ph-eye';
        }
    },

    /**
     * Exibe mensagem de erro na caixa visual
     */
    mostrarErro(mensagem) {
        const boxErro = document.getElementById('auth-msg-erro');
        const txtErro = document.getElementById('auth-msg-erro-texto');
        const msgLegada = document.getElementById('msg-erro');

        if (boxErro && txtErro) {
            txtErro.innerText = mensagem;
            boxErro.style.display = 'flex';
        } else if (msgLegada) {
            msgLegada.innerText = mensagem;
            msgLegada.style.display = 'block';
        }
    },

    /**
     * Limpa a mensagem de erro
     */
    limparErro() {
        const boxErro = document.getElementById('auth-msg-erro');
        const msgLegada = document.getElementById('msg-erro');
        if (boxErro) boxErro.style.display = 'none';
        if (msgLegada) msgLegada.style.display = 'none';
    },

    /**
     * Submissão e validação do Login
     */
    async fazerLogin() {
        const inputEmail = document.getElementById('login-email');
        const inputSenha = document.getElementById('login-senha');
        const btnLogin = document.getElementById('btn-login');

        const email = inputEmail ? inputEmail.value.trim() : '';
        const senha = inputSenha ? inputSenha.value.trim() : '';

        this.limparErro();

        if (!email) {
            this.mostrarErro('Digite o seu e-mail de acesso.');
            if (inputEmail) inputEmail.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.mostrarErro('Informe um formato de e-mail válido (ex: seu.email@autocarbs.com.br).');
            if (inputEmail) inputEmail.focus();
            return;
        }

        if (!senha) {
            this.mostrarErro('Digite a sua senha de acesso.');
            if (inputSenha) inputSenha.focus();
            return;
        }

        try {
            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = `<i class="ph ph-spinner erp-spin"></i> <span>Acessando...</span>`;
            }
            UI.setLoading(true);

            const res = await API.login(email, senha);

            // Persiste na opção Lembrar de Mim
            const checkLembrar = document.getElementById('auth-remember-check');
            const deveLembrar = checkLembrar ? checkLembrar.checked : true;
            this.salvarLembrarEmail(email, deveLembrar);

            // Salva e-mail com sucesso no histórico local para autocompletar na próxima vez
            this.salvarEmailHistorico(email);

            if (window.atualizarPerfilUsuario) {
                window.atualizarPerfilUsuario(res.usuario);
            }

            this.ocultarTelaLogin();

            // Carrega dados do ERP
            if (window.Estoque) {
                await Estoque.carregarTudo();
            }
        } catch (err) {
            let msg = err.message || 'E-mail ou senha incorretos!';
            if (msg.toLowerCase().includes('pin')) {
                msg = 'E-mail ou senha incorretos!';
            }
            this.mostrarErro(msg);
            if (inputSenha) {
                inputSenha.value = '';
                inputSenha.focus();
            }
        } finally {
            if (btnLogin) {
                btnLogin.disabled = false;
                btnLogin.innerHTML = `<span>CONTINUAR</span> <i class="ph-bold ph-arrow-right"></i>`;
            }
            UI.setLoading(false);
        }
    },

    /**
     * Encerra a sessão: limpa o cookie HttpOnly no servidor e recarrega a página
     */
    async fazerLogout() {
        try {
            if (window.UI) UI.setLoading(true);
            await API.logout();
        } catch (err) {
            console.warn('Erro durante logout:', err);
        } finally {
            API.setToken(null);
            window.usuarioLogado = null;
            try {
                localStorage.removeItem('autocar_token');
                sessionStorage.clear();
            } catch (_) {}
            window.location.href = '/';
        }
    }
};

window.AuthModule = AuthModule;

// Aliases globais para compatibilidade com eventos do HTML
window.fazerLogin = () => AuthModule.fazerLogin();
window.fazerLogout = () => AuthModule.fazerLogout();
window.mostrarTelaLogin = () => AuthModule.mostrarTelaLogin();
window.toggleVisibilidadeSenha = (id, btn) => AuthModule.toggleVisibilidadeSenha(btn);

document.addEventListener('DOMContentLoaded', () => {
    AuthModule.init();
});
