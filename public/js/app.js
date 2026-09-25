/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Inicialização do Sistema e Gerenciamento de Sessão
 * =========================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicia verificação de sessão no servidor imediatamente em paralelo com o carregamento das views
    const promessaSessao = API.verificarSessao().catch(() => null);

    // 2. Pré-carrega as views estruturais essenciais (Estoque & Scanner)
    if (window.ViewLoader) {
        await ViewLoader.loadAll([
            { module: 'estoque', targetId: 'container-modulo-estoque' },
            { module: 'scanner', targetId: 'container-modulo-scanner' }
        ]);
    }

    if (window.ScannerModule) ScannerModule.init();
    if (window.Sidebar) Sidebar.init();
    Estoque.init();

    // Listener para sessões expiradas
    window.addEventListener('auth:expired', () => {
        try {
            localStorage.removeItem('autocar_has_session');
            document.documentElement.classList.remove('has-active-session');
        } catch (_) {}
        mostrarTelaLogin();
    });

    // Enter nos inputs de login
    const inputEmail = document.getElementById('login-email');
    const inputSenha = document.getElementById('login-senha');
    const inputLegado = document.getElementById('senha-acesso');

    if (inputEmail) {
        inputEmail.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (inputSenha && !inputSenha.value) {
                    inputSenha.focus();
                } else {
                    fazerLogin();
                }
            }
        });
    }

    if (inputSenha) {
        inputSenha.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') fazerLogin();
        });
    }

    if (inputLegado) {
        inputLegado.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') fazerLogin();
        });
    }

    const inputSupervisor = document.getElementById('senha-supervisor');
    if (inputSupervisor) {
        inputSupervisor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Estoque.confirmarExclusao();
        });
    }

    // Aguarda o resultado da checagem de sessão iniciada no início
    try {
        const sessao = await promessaSessao;
        if (sessao && sessao.usuario) {
            localStorage.setItem('autocar_has_session', 'true');
            document.documentElement.classList.add('has-active-session');
            atualizarPerfilUsuario(sessao.usuario);
            if (window.AuthModule) {
                AuthModule.ocultarTelaLogin();
            } else {
                const ls = document.getElementById('login-screen');
                if (ls) ls.style.display = 'none';
                const ac = document.getElementById('app-container');
                if (ac) ac.style.opacity = '1';
            }
            await Estoque.carregarTudo();
            return;
        }
    } catch {
        API.setToken(null);
    }

    // Se não houver sessão ativa ou expirou, limpa flag e exibe login
    try {
        localStorage.removeItem('autocar_has_session');
        document.documentElement.classList.remove('has-active-session');
    } catch (_) {}

    if (window.AuthModule) {
        AuthModule.mostrarTelaLogin();
    } else {
        mostrarTelaLogin();
    }
});

function atualizarPerfilUsuario(usuario) {
    if (!usuario) return;
    window.usuarioLogado = usuario;
    const elName = document.getElementById('user-display-name');
    const elRole = document.getElementById('user-display-role');
    if (elName) elName.innerText = usuario.nome || 'Operador AutoCar';
    if (elRole) {
        const roles = {
            admin: 'Administrador',
            supervisor: 'Gerência',
            gerencia: 'Gerência',
            operador: 'Operador'
        };
        elRole.innerText = roles[usuario.role] || (usuario.role ? usuario.role.toUpperCase() : 'Operador');
        if (usuario.role === 'supervisor' || usuario.role === 'gerencia' || usuario.role === 'admin') {
            elRole.style.color = 'var(--gold)';
            elRole.style.fontWeight = '600';
        } else {
            elRole.style.color = '';
            elRole.style.fontWeight = '';
        }
    }

    // Controle de Acesso Baseado em Funções (RBAC) no Menu Lateral
    // Apenas o Administrador tem acesso ao módulo Equipe & Acessos
    const elGroupUsuarios = document.getElementById('group-usuarios');
    if (elGroupUsuarios) {
        elGroupUsuarios.style.display = 'block';
    }
}

function mostrarTelaLogin() {
    if (window.AuthModule) {
        return AuthModule.mostrarTelaLogin();
    }
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.opacity = '0';
    
    const inputEmail = document.getElementById('login-email');
    const inputSenha = document.getElementById('login-senha');
    const inputLegado = document.getElementById('senha-acesso');

    if (inputSenha) inputSenha.value = '';
    if (inputLegado) inputLegado.value = '';

    if (inputEmail) {
        if (!inputEmail.value) {
            inputEmail.focus();
        } else if (inputSenha) {
            inputSenha.focus();
        }
    } else if (inputLegado) {
        inputLegado.focus();
    }
}

async function fazerLogin() {
    if (window.AuthModule) {
        return AuthModule.fazerLogin();
    }
    const inputEmail = document.getElementById('login-email');
    const inputSenha = document.getElementById('login-senha');
    const inputLegado = document.getElementById('senha-acesso');
    const msgErro = document.getElementById('msg-erro');
    const btn = document.getElementById('btn-login');

    const email = inputEmail ? inputEmail.value.trim() : '';
    const senha = inputSenha ? inputSenha.value.trim() : (inputLegado ? inputLegado.value.trim() : '');

    if (inputEmail && !email) {
        if (msgErro) {
            msgErro.innerText = 'Digite seu e-mail de acesso!';
            msgErro.style.display = 'block';
        }
        inputEmail.focus();
        return;
    }

    if (!senha) {
        if (msgErro) {
            msgErro.innerText = 'Digite a sua senha de acesso!';
            msgErro.style.display = 'block';
        }
        if (inputSenha) inputSenha.focus();
        else if (inputLegado) inputLegado.focus();
        return;
    }

    try {
        if (btn) btn.disabled = true;
        UI.setLoading(true);

        const res = await API.login(email, senha);
        API.setToken(res.token);
        atualizarPerfilUsuario(res.usuario);

        if (msgErro) msgErro.style.display = 'none';
        document.getElementById('login-screen').style.display = 'none';

        await Estoque.carregarTudo();
    } catch (err) {
        if (msgErro) {
            msgErro.innerText = err.message || 'E-mail ou senha incorretos!';
            msgErro.style.display = 'block';
        }
    } finally {
        if (btn) btn.disabled = false;
        UI.setLoading(false);
    }
}

function toggleVisibilidadeSenha(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'ph ph-eye-slash' : 'ph ph-eye';
    }
}

async function fazerLogout() {
    if (window.AuthModule && typeof window.AuthModule.fazerLogout === 'function') {
        return window.AuthModule.fazerLogout();
    }
    try {
        if (window.UI) UI.setLoading(true);
        if (window.API && typeof window.API.logout === 'function') {
            await API.logout();
        } else {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
        }
    } catch (_) {}
    if (window.API) API.setToken(null);
    window.usuarioLogado = null;
    try {
        localStorage.removeItem('autocar_token');
        localStorage.removeItem('autocar_has_session');
        document.documentElement.classList.remove('has-active-session');
        sessionStorage.clear();
    } catch (_) {}
    window.location.href = '/';
}

window.fazerLogin = fazerLogin;
window.fazerLogout = fazerLogout;

