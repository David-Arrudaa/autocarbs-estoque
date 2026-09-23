/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo de Autenticação: Lógica de Login & Sessão
 * =========================================================
 */

const AuthModule = {
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

        if (inputEmail) {
            inputEmail.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (inputSenha && !inputSenha.value) {
                        e.preventDefault();
                        inputSenha.focus();
                    }
                }
            });
        }

        // Listener para sessões expiradas emitidas pelo api.js
        window.addEventListener('auth:expired', () => {
            this.mostrarTelaLogin();
        });
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

        if (inputSenha) inputSenha.value = '';

        if (inputEmail) {
            if (!inputEmail.value) {
                inputEmail.focus();
            } else if (inputSenha) {
                inputSenha.focus();
            }
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

            // O token chegou via cookie HttpOnly — não precisa mais do setToken()
            // API.setToken(res.token) ← REMOVIDO (token não está mais no body)
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
            // Limpa mensagens antigas que mencionavam PIN
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
                btnLogin.innerHTML = `<span>ENTRAR NO SISTEMA</span> <i class="ph ph-arrow-right"></i>`;
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

