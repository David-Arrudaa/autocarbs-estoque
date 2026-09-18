/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Inicialização do Sistema e Gerenciamento de Sessão
 * =========================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (window.Sidebar) Sidebar.init();
    Estoque.init();

    // Listener para sessões expiradas
    window.addEventListener('auth:expired', () => {
        mostrarTelaLogin();
    });

    // Enter nos inputs de senha
    const inputLogin = document.getElementById('senha-acesso');
    if (inputLogin) {
        inputLogin.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') fazerLogin();
        });
    }

    const inputSupervisor = document.getElementById('senha-supervisor');
    if (inputSupervisor) {
        inputSupervisor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Estoque.confirmarExclusao();
        });
    }

    // Checa se já existe token válido armazenado
    const token = API.getToken();
    if (token) {
        try {
            const sessao = await API.verificarSessao();
            atualizarPerfilUsuario(sessao.usuario);
            document.getElementById('login-screen').style.display = 'none';
            await Estoque.carregarTudo();
            return;
        } catch {
            API.setToken(null);
        }
    }

    mostrarTelaLogin();
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
            supervisor: 'Supervisor',
            operador: 'Operador'
        };
        elRole.innerText = roles[usuario.role] || (usuario.role ? usuario.role.toUpperCase() : 'Operador');
        if (usuario.role === 'supervisor' || usuario.role === 'admin') {
            elRole.style.color = 'var(--gold)';
            elRole.style.fontWeight = '600';
        } else {
            elRole.style.color = '';
            elRole.style.fontWeight = '';
        }
    }

    // Controle de Acesso Baseado em Funções (RBAC) no Menu Lateral
    const elGroupUsuarios = document.getElementById('group-usuarios');
    const isGestor = usuario.role === 'supervisor' || usuario.role === 'admin';
    if (elGroupUsuarios) {
        elGroupUsuarios.style.display = isGestor ? 'block' : 'none';
    }

    // Se um operador tentar carregar a aba de usuários, redireciona para o estoque geral
    if (!isGestor && window.Estoque && Estoque.abaAtiva === 'usuarios') {
        Estoque.alternarAba('produtos');
    }
}

function mostrarTelaLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.opacity = '0';
    const input = document.getElementById('senha-acesso');
    if (input) {
        input.value = '';
        input.focus();
    }
}

async function fazerLogin() {
    const input = document.getElementById('senha-acesso');
    const msgErro = document.getElementById('msg-erro');
    const btn = document.getElementById('btn-login');

    const pin = input ? input.value.trim() : '';
    if (!pin) {
        if (msgErro) {
            msgErro.innerText = 'Digite a senha de acesso!';
            msgErro.style.display = 'block';
        }
        return;
    }

    try {
        if (btn) btn.disabled = true;
        UI.setLoading(true);

        const res = await API.login(pin);
        API.setToken(res.token);
        atualizarPerfilUsuario(res.usuario);

        if (msgErro) msgErro.style.display = 'none';
        document.getElementById('login-screen').style.display = 'none';

        await Estoque.carregarTudo();
    } catch (err) {
        if (msgErro) {
            msgErro.innerText = err.message || 'Senha incorreta!';
            msgErro.style.display = 'block';
        }
    } finally {
        if (btn) btn.disabled = false;
        UI.setLoading(false);
    }
}

function fazerLogout() {
    API.setToken(null);
    location.reload();
}

window.fazerLogin = fazerLogin;
window.fazerLogout = fazerLogout;

