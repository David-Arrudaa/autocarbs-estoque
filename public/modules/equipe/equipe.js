/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Gestão de Colaboradores & Controle de Acessos (RBAC)
 * =========================================================
 */

const Usuarios = {
    listaUsuarios: [],
    filtroRole: 'todos',
    termoBusca: '',
    usuarioPinEdicao: null,

    /**
     * Inicializa o módulo e listeners
     */
    init() {
        const inputBusca = document.getElementById('input-busca-usuarios');
        if (inputBusca) {
            inputBusca.addEventListener('input', () => this.pesquisar());
        }

        const inputPinNovo = document.getElementById('usr-pin');
        if (inputPinNovo) {
            inputPinNovo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.salvarUsuario();
            });
        }

        const inputPinAlt = document.getElementById('usr-novo-pin');
        if (inputPinAlt) {
            inputPinAlt.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.confirmarAlterarPin();
            });
        }
    },

    /**
     * Carrega todos os usuários do backend
     */
    async carregarLista() {
        const tbody = document.getElementById('tabela-usuarios');
        const countBox = document.getElementById('pagination-counter-usuarios');

        try {
            UI.setLoading(true);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state-card" style="text-align:center; padding:40px 20px;">
                            <i class="ph ph-spinner erp-spin" style="font-size:2rem; color:var(--gold);"></i>
                            <div style="margin-top:10px; color:var(--text-secondary);">Carregando colaboradores da oficina...</div>
                        </td>
                    </tr>
                `;
            }

            const res = await API.listarUsuarios();

            if (res.aviso) {
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="empty-state-card" style="text-align:center; padding:35px 20px;">
                                <i class="ph ph-database" style="font-size:2.5rem; color:#f59e0b; margin-bottom:12px;"></i>
                                <h3 style="color:#f8fafc; font-size:1.05rem; margin-bottom:6px;">Tabela de Usuários Não Inicializada</h3>
                                <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 16px auto; font-size:0.85rem; line-height:1.5;">
                                    ${UI.escapeHtml(res.aviso)}
                                </p>
                                <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:12px 18px; display:inline-block; font-size:0.8rem; color:#fde68a;">
                                    💡 O sistema continua funcionando normalmente pelos PINs mestres configurados no <code>.env</code>.
                                </div>
                            </td>
                        </tr>
                    `;
                }
                this.listaUsuarios = [];
                this.atualizarContadores();
                return;
            }

            this.listaUsuarios = Array.isArray(res.data) ? res.data : [];
            this.atualizarContadores();
            this.renderizarTabela();
        } catch (err) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state-card" style="text-align:center; padding:30px 20px;">
                            <i class="ph ph-warning-circle" style="font-size:2.2rem; color:var(--danger); margin-bottom:10px;"></i>
                            <div style="color:#f8fafc; font-weight:600;">Erro ao carregar colaboradores</div>
                            <div style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">${UI.escapeHtml(err.message)}</div>
                            <button class="btn btn-secondary btn-sm" onclick="Usuarios.carregarLista()" style="margin-top:14px;">
                                <i class="ph ph-arrows-clockwise"></i> Tentar Novamente
                            </button>
                        </td>
                    </tr>
                `;
            }
        } finally {
            UI.setLoading(false);
        }
    },

    /**
     * Atualiza os contadores de filtros e resumo
     */
    atualizarContadores() {
        const total = this.listaUsuarios.length;
        const totalAdmin = this.listaUsuarios.filter(u => u.role === 'admin').length;
        const totalSuper = this.listaUsuarios.filter(u => u.role === 'supervisor').length;
        const totalOp = this.listaUsuarios.filter(u => u.role === 'operador').length;

        const elTodos = document.getElementById('chip-count-usr-todos');
        const elAdmin = document.getElementById('chip-count-usr-admin');
        const elSuper = document.getElementById('chip-count-usr-supervisor');
        const elOp = document.getElementById('chip-count-usr-operador');
        const elCounter = document.getElementById('pagination-counter-usuarios');

        if (elTodos) elTodos.innerText = total;
        if (elAdmin) elAdmin.innerText = totalAdmin;
        if (elSuper) elSuper.innerText = totalSuper;
        if (elOp) elOp.innerText = totalOp;
        if (elCounter) elCounter.innerText = `${total} colaborador${total !== 1 ? 'es' : ''} registrado${total !== 1 ? 's' : ''}`;
    },

    /**
     * Renderiza a tabela de usuários com suporte a filtros e busca
     */
    renderizarTabela() {
        const tbody = document.getElementById('tabela-usuarios');
        if (!tbody) return;

        let filtrados = this.listaUsuarios.slice();

        // Filtro por Cargo
        if (this.filtroRole !== 'todos') {
            filtrados = filtrados.filter(u => u.role === this.filtroRole);
        }

        // Filtro por Busca (Nome)
        if (this.termoBusca) {
            const busca = this.termoBusca.toLowerCase();
            filtrados = filtrados.filter(u => u.nome && u.nome.toLowerCase().includes(busca));
        }

        if (filtrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state-card" style="text-align:center; padding:40px 20px;">
                        <i class="ph ph-users" style="font-size:2.5rem; color:var(--text-secondary); margin-bottom:12px;"></i>
                        <h3 style="color:#f8fafc; font-size:1.05rem; margin-bottom:6px;">Nenhum colaborador encontrado</h3>
                        <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:16px;">
                            ${this.termoBusca ? 'Tente buscar com outro termo ou limpe o campo de pesquisa.' : 'Cadastre os membros da sua equipe para liberar acesso individual.'}
                        </p>
                        ${!this.termoBusca ? `
                            <button type="button" class="btn btn-primary btn-sm" onclick="Usuarios.abrirModalNovo()">
                                <i class="ph ph-user-plus"></i>
                                <span>Cadastrar Primeiro Colaborador</span>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
            return;
        }

        const usuarioLogado = window.usuarioLogado || {};

        tbody.innerHTML = filtrados.map(u => {
            const isSelf = usuarioLogado.id && usuarioLogado.id === u.id;
            
            // Definição visual do cargo
            let roleBadge = '';
            if (u.role === 'admin') {
                roleBadge = `<span class="badge-role badge-role-admin"><i class="ph ph-shield-check"></i> Administrador</span>`;
            } else if (u.role === 'supervisor') {
                roleBadge = `<span class="badge-role badge-role-supervisor"><i class="ph ph-crown"></i> Supervisor</span>`;
            } else {
                roleBadge = `<span class="badge-role badge-role-operador"><i class="ph ph-wrench"></i> Operador</span>`;
            }

            // Status Ativo / Inativo
            const statusBadge = u.ativo
                ? `<span class="badge-status-usr ativo"><i class="ph ph-check-circle"></i> Ativo</span>`
                : `<span class="badge-status-usr inativo"><i class="ph ph-prohibit"></i> Inativo</span>`;

            // Data de criação
            let dataCriacao = '-';
            if (u.criado_em) {
                try {
                    const d = new Date(u.criado_em);
                    dataCriacao = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                } catch (_) {}
            }

            // Iniciais do Avatar
            const iniciais = (u.nome || 'U')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map(n => n[0].toUpperCase())
                .join('');

            return `
                <tr class="usr-row ${!u.ativo ? 'usr-row-inativo' : ''}">
                    <td data-label="Colaborador">
                        <div class="usr-cell-profile">
                            <div class="usr-avatar ${u.role}">
                                <span>${UI.escapeHtml(iniciais)}</span>
                            </div>
                            <div class="usr-profile-details">
                                <div class="usr-nome">
                                    <strong>${UI.escapeHtml(u.nome)}</strong>
                                    ${isSelf ? '<span class="usr-self-pill">(Você)</span>' : ''}
                                </div>
                                <span class="usr-email" style="font-size:0.78rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px; margin-top:2px;">
                                    <i class="ph ph-envelope-simple" style="color:var(--gold);"></i> ${UI.escapeHtml(u.email || 'Sem e-mail')}
                                </span>
                                <span class="usr-date" style="font-size:0.7rem; color:var(--text-secondary); margin-top:1px;">Desde: ${dataCriacao}</span>
                            </div>
                        </div>
                    </td>
                    <td data-label="Cargo">
                        ${roleBadge}
                    </td>
                    <td data-label="Status">
                        <button type="button" 
                                class="btn-toggle-status ${u.ativo ? 'ativo' : 'inativo'}" 
                                onclick="Usuarios.alternarStatus('${u.id}', ${u.ativo}, '${UI.escapeHtml(u.nome)}')"
                                title="Clique para ${u.ativo ? 'desativar' : 'ativar'} colaborador"
                                ${isSelf ? 'disabled' : ''}>
                            ${statusBadge}
                        </button>
                    </td>
                    <td data-label="Segurança">
                        <span class="usr-pin-protected">
                            <i class="ph ph-shield-check"></i> Senha Criptografada
                        </span>
                    </td>
                    <td data-label="Ações Rápidas" style="text-align:right;">
                        <div class="usr-actions-cell">
                            <button type="button" 
                                    class="btn-action-usr btn-action-pin" 
                                    onclick="Usuarios.abrirModalPin('${u.id}', '${UI.escapeHtml(u.nome)}', '${UI.escapeHtml(u.email || '')}')" 
                                    title="Redefinir Senha de Acesso">
                                <i class="ph ph-key"></i>
                                <span class="action-text">Redefinir Senha</span>
                            </button>
                            ${!isSelf ? `
                                <button type="button" 
                                        class="btn-action-usr btn-action-delete" 
                                        onclick="Usuarios.excluir('${u.id}', '${UI.escapeHtml(u.nome)}')" 
                                        title="Excluir Colaborador">
                                    <i class="ph ph-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Filtra por cargo
     */
    filtrarRole(role) {
        this.filtroRole = role;
        document.querySelectorAll('.filter-usr-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });
        this.renderizarTabela();
    },

    /**
     * Busca em tempo real
     */
    pesquisar() {
        const input = document.getElementById('input-busca-usuarios');
        const btnClear = document.getElementById('btn-clear-busca-usuarios');
        this.termoBusca = input ? input.value.trim() : '';

        if (btnClear) {
            btnClear.classList.toggle('hidden', !this.termoBusca);
        }

        this.renderizarTabela();
    },

    /**
     * Limpa o campo de busca
     */
    limparBusca() {
        const input = document.getElementById('input-busca-usuarios');
        const btnClear = document.getElementById('btn-clear-busca-usuarios');
        if (input) input.value = '';
        if (btnClear) btnClear.classList.add('hidden');
        this.termoBusca = '';
        this.renderizarTabela();
    },

    /**
     * Abre o modal de cadastro de novo colaborador
     */
    abrirModalNovo() {
        const form = document.getElementById('form-usuario');
        if (form) form.reset();

        const inputNome = document.getElementById('usr-nome');
        const inputEmail = document.getElementById('usr-email');
        const inputPin = document.getElementById('usr-pin');
        const selectRole = document.getElementById('usr-role');

        if (inputNome) inputNome.value = '';
        if (inputEmail) inputEmail.value = '';
        if (inputPin) inputPin.value = '';
        if (selectRole) selectRole.value = 'operador';

        UI.abrirModal('modal-usuario');
    },

    /**
     * Salva um novo colaborador
     */
    async salvarUsuario() {
        const nome = document.getElementById('usr-nome')?.value?.trim();
        const email = document.getElementById('usr-email')?.value?.trim();
        const senha = document.getElementById('usr-pin')?.value?.trim();
        const role = document.getElementById('usr-role')?.value || 'operador';
        const btnSalvar = document.getElementById('btn-salvar-usuario');

        if (!nome || nome.length < 2) {
            UI.toast('Informe o nome completo do colaborador.', 'warning');
            document.getElementById('usr-nome')?.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            UI.toast('Informe um e-mail válido (ex: colaborador@autocarbs.com.br).', 'warning');
            document.getElementById('usr-email')?.focus();
            return;
        }

        if (!senha || senha.length < 6) {
            UI.toast('A senha de acesso deve ter no mínimo 6 caracteres.', 'warning');
            document.getElementById('usr-pin')?.focus();
            return;
        }

        try {
            if (btnSalvar) btnSalvar.disabled = true;
            UI.setLoading(true);

            await API.cadastrarUsuario({ nome, email, senha, role });

            UI.toast(`Colaborador ${nome} cadastrado com sucesso!`, 'success');
            UI.fecharModal('modal-usuario');
            await this.carregarLista();
        } catch (err) {
            UI.toast(err.message || 'Erro ao cadastrar colaborador.', 'error');
        } finally {
            if (btnSalvar) btnSalvar.disabled = false;
            UI.setLoading(false);
        }
    },

    /**
     * Abre modal para alterar a senha de um colaborador
     */
    abrirModalPin(id, nome, email) {
        this.usuarioPinEdicao = { id, nome, email };

        const elNome = document.getElementById('modal-pin-usuario-nome');
        const inputPin = document.getElementById('usr-novo-pin');

        if (elNome) {
            elNome.innerText = email ? `${nome} (${email})` : nome;
        }
        if (inputPin) {
            inputPin.value = '';
            setTimeout(() => inputPin.focus(), 100);
        }

        UI.abrirModal('modal-alterar-pin');
    },

    /**
     * Confirma a alteração da senha
     */
    async confirmarAlterarPin() {
        if (!this.usuarioPinEdicao?.id) return;

        const inputPin = document.getElementById('usr-novo-pin');
        const senha = inputPin?.value?.trim();
        const btnConfirmar = document.getElementById('btn-confirmar-pin');

        if (!senha || senha.length < 6) {
            UI.toast('A nova senha deve conter no mínimo 6 caracteres.', 'warning');
            if (inputPin) inputPin.focus();
            return;
        }

        try {
            if (btnConfirmar) btnConfirmar.disabled = true;
            UI.setLoading(true);

            const res = await API.alterarSenhaUsuario(this.usuarioPinEdicao.id, senha);

            UI.toast(res.message || 'Senha alterada com sucesso!', 'success');
            UI.fecharModal('modal-alterar-pin');
            this.usuarioPinEdicao = null;
        } catch (err) {
            UI.toast(err.message || 'Erro ao alterar senha.', 'error');
        } finally {
            if (btnConfirmar) btnConfirmar.disabled = false;
            UI.setLoading(false);
        }
    },

    /**
     * Ativa ou desativa o status de um colaborador
     */
    async alternarStatus(id, statusAtual, nome) {
        const novoStatus = !statusAtual;
        const acao = novoStatus ? 'ativar' : 'desativar';

        try {
            UI.setLoading(true);
            await API.alternarStatusUsuario(id, novoStatus);
            UI.toast(`Colaborador ${nome} foi ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`, 'success');
            await this.carregarLista();
        } catch (err) {
            UI.toast(err.message || `Erro ao ${acao} colaborador.`, 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    /**
     * Exclui um colaborador após confirmação
     */
    async excluir(id, nome) {
        const confirmou = confirm(`Tem certeza que deseja excluir o colaborador "${nome}"?\n\nEsta ação não poderá ser desfeita.`);
        if (!confirmou) return;

        try {
            UI.setLoading(true);
            const res = await API.excluirUsuario(id);
            UI.toast(res.message || 'Colaborador excluído com sucesso!', 'success');
            await this.carregarLista();
        } catch (err) {
            UI.toast(err.message || 'Erro ao excluir colaborador.', 'error');
        } finally {
            UI.setLoading(false);
        }
    }
};

window.Usuarios = Usuarios;

// Auto-inicialização quando a view for carregada via ViewLoader
window.addEventListener('view:loaded', (e) => {
    if (e.detail && e.detail.module === 'equipe') {
        Usuarios.init();
        Usuarios.carregarLista();
    }
});

// Fallback caso já esteja no DOM
document.addEventListener('DOMContentLoaded', () => {
    Usuarios.init();
});
