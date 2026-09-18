/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Menu Lateral & Navegação Modular (Sidebar ERP)
 * =========================================================
 * Arquitetura desacoplada para controle da barra lateral,
 * acordeons de módulos, gaveta mobile (drawer), modo mini/colapsado
 * e breadcrumbs contextuais.
 */

const Sidebar = {
    // Registro declarativo dos módulos do ERP
    modulos: {
        estoque: {
            id: 'group-estoque',
            nome: 'Estoque',
            tipo: 'grupo', // Acordeon com submódulos
            submodulos: {
                produtos: {
                    id: 'tab-btn-produtos',
                    titulo: 'Estoque Geral',
                    subtitulo: 'Visão consolidada dos produtos e controle de estoque',
                    moduloBreadcrumb: 'ESTOQUE',
                    submoduloBreadcrumb: 'GERAL',
                    mostrarBotaoCadastrar: true
                },
                reposicao: {
                    id: 'tab-btn-reposicao',
                    titulo: 'Reposição de Estoque',
                    subtitulo: 'Itens com saldo abaixo do estoque mínimo parametrizado',
                    moduloBreadcrumb: 'ESTOQUE',
                    submoduloBreadcrumb: 'REPOSIÇÃO',
                    mostrarBotaoCadastrar: false
                },
                saidas: {
                    id: 'tab-btn-saidas',
                    titulo: 'Curva ABC & Giro de Peças',
                    subtitulo: 'Classificação estratégica de giro, relevância financeira e controle de ruptura',
                    moduloBreadcrumb: 'ESTOQUE',
                    submoduloBreadcrumb: 'CURVA ABC',
                    mostrarBotaoCadastrar: false
                },
                relatorios: {
                    id: 'tab-btn-relatorios',
                    titulo: 'Relatórios Gerenciais',
                    subtitulo: 'Análise executiva financeira e discriminada de peças',
                    moduloBreadcrumb: 'ESTOQUE',
                    submoduloBreadcrumb: 'RELATÓRIOS',
                    mostrarBotaoCadastrar: false
                }
            }
        },
        cotacao: {
            id: 'group-cotacao',
            nome: 'Cotação de Peças',
            tipo: 'standalone', // Módulo de nível único (sem acordeon)
            submodulos: {
                cotacao: {
                    id: 'tab-btn-cotacao',
                    titulo: 'Cotação de Peças & Orçamentos',
                    subtitulo: 'Cote com múltiplos fornecedores e gere orçamentos para clientes',
                    moduloBreadcrumb: 'ORÇAMENTOS',
                    submoduloBreadcrumb: 'COTAÇÃO DE PEÇAS',
                    mostrarBotaoCadastrar: false
                }
            }
        },
        usuarios: {
            id: 'group-usuarios',
            nome: 'Equipe & Acessos',
            tipo: 'standalone',
            somenteRole: ['supervisor', 'admin'],
            submodulos: {
                usuarios: {
                    id: 'tab-btn-usuarios',
                    titulo: 'Equipe & Controle de Acessos',
                    subtitulo: 'Gerenciamento de colaboradores, cargos e senhas de acesso individuais',
                    moduloBreadcrumb: 'CONFIGURAÇÕES',
                    submoduloBreadcrumb: 'EQUIPE & ACESSOS',
                    mostrarBotaoCadastrar: false
                }
            }
        }
    },

    abaAtiva: 'produtos',
    moduloAtivo: 'estoque',
    collapsed: false,
    flyoutCloseTimer: null,

    /**
     * Inicializa eventos, listeners globais e estado persistido da sidebar
     */
    init() {
        // Recuperar preferência de menu colapsado no desktop
        try {
            const salvo = localStorage.getItem('autocar_sidebar_collapsed');
            if (salvo === 'true' && window.innerWidth > 992) {
                this.setCollapsed(true);
            }
        } catch {
            // Ignora se localStorage estiver indisponível
        }

        // Fechar gaveta no mobile ao clicar fora (backdrop)
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.fecharDrawer());
        }

        // Fechar gaveta ao pressionar a tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.fecharDrawer();
                this.fecharFlyouts();
            }
        });

        // Configura controle robusto de mouse hover com tolerância para os flyouts
        this.initFlyoutHandlers();

        // Controle responsivo ao redimensionar
        window.addEventListener('resize', () => {
            if (window.innerWidth > 992) {
                this.fecharDrawer();
            }
        });

        // Recuperar e aplicar aba ativa salva para evitar qualquer salto de tela no refresh (F5)
        try {
            const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
            const abasValidas = ['produtos', 'reposicao', 'saidas', 'relatorios', 'cotacao', 'usuarios'];
            const abaSalva = (hash && abasValidas.includes(hash))
                ? hash
                : localStorage.getItem('autocar_active_tab');

            if (abaSalva && abasValidas.includes(abaSalva)) {
                this.atualizarNavegacao(abaSalva);
            }
        } catch (_) {}
    },

    /**
     * Manipuladores de mouse para os flyouts com tolerância de tempo (grace period de 250ms).
     * Evita que o menu feche no meio do caminho enquanto o usuário move o cursor até a opção!
     */
    initFlyoutHandlers() {
        const groups = document.querySelectorAll('.sidebar-module-group');
        groups.forEach(group => {
            const submodules = group.querySelector('.sidebar-submodules');
            if (!submodules) return;

            group.addEventListener('mouseenter', () => {
                if (!this.collapsed) return;
                clearTimeout(this.flyoutCloseTimer);
                submodules.classList.remove('flyout-closed');
                group.classList.add('flyout-active');
            });

            group.addEventListener('mouseleave', () => {
                if (!this.collapsed) return;
                // Margem de segurança de 250ms antes de fechar para o mouse cruzar o espaço
                this.flyoutCloseTimer = setTimeout(() => {
                    group.classList.remove('flyout-active');
                    submodules.classList.remove('flyout-closed');
                }, 250);
            });
        });
    },

    // ==========================================
    // Controle do Modo Mini / Colapsado (Apenas Ícones)
    // ==========================================
    toggleCollapse() {
        this.setCollapsed(!this.collapsed);
    },

    setCollapsed(collapsed) {
        this.collapsed = !!collapsed;
        const sidebar = document.getElementById('app-sidebar');
        const icon = document.getElementById('icon-sidebar-collapse');
        const btn = document.getElementById('btn-sidebar-collapse');

        if (sidebar) {
            if (this.collapsed) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }

        if (icon) {
            icon.className = this.collapsed ? 'ph ph-caret-right' : 'ph ph-caret-left';
        }

        if (btn) {
            btn.title = this.collapsed ? 'Expandir Menu' : 'Recolher Menu (apenas ícones)';
        }

        try {
            localStorage.setItem('autocar_sidebar_collapsed', this.collapsed ? 'true' : 'false');
        } catch {
            // Ignora erro de storage
        }
    },

    /**
     * Fecha imediatamente qualquer caixa flutuante (flyout) no modo reduzido
     * após o usuário clicar em uma subpasta/opção.
     */
    fecharFlyouts() {
        clearTimeout(this.flyoutCloseTimer);
        const groups = document.querySelectorAll('.sidebar-module-group');
        groups.forEach(group => {
            group.classList.remove('flyout-active');
            const sub = group.querySelector('.sidebar-submodules');
            if (sub) {
                sub.classList.add('flyout-closed');
            }
        });
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        // Remove a classe temporária após 300ms
        setTimeout(() => {
            document.querySelectorAll('.sidebar-submodules').forEach(el => el.classList.remove('flyout-closed'));
        }, 300);
    },

    /**
     * Clique no botão do Módulo Estoque:
     * - Se colapsado: navega diretamente para o estoque (mantendo a aba atual ou Estoque Geral)
     * - Se expandido: abre ou fecha o acordeon
     */
    onModuloEstoqueClick() {
        if (this.collapsed) {
            const abaEstoque = ['produtos', 'reposicao', 'saidas', 'relatorios'].includes(this.abaAtiva)
                ? this.abaAtiva
                : 'produtos';
            if (window.Estoque) Estoque.alternarAba(abaEstoque);
            this.fecharFlyouts();
        } else {
            this.toggleGrupo('estoque');
        }
    },

    // ==========================================
    // Controle da Gaveta Mobile (Drawer)
    // ==========================================
    toggleDrawer() {
        const sidebar = document.getElementById('app-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('active');
    },

    abrirDrawer() {
        const sidebar = document.getElementById('app-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
    },

    fecharDrawer() {
        const sidebar = document.getElementById('app-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    },

    // ==========================================
    // Controle de Acordeons dos Módulos
    // ==========================================
    toggleGrupo(grupoId) {
        const el = document.getElementById(`group-${grupoId}`);
        if (!el) return;

        const estaAberto = el.classList.contains('open');

        if (!estaAberto) {
            this.fecharOutrosGrupos(grupoId);
            el.classList.add('open');
        } else {
            el.classList.remove('open');
        }
    },

    abrirGrupo(grupoId) {
        const el = document.getElementById(`group-${grupoId}`);
        if (el) el.classList.add('open');
    },

    fecharGrupo(grupoId) {
        const el = document.getElementById(`group-${grupoId}`);
        if (el) el.classList.remove('open');
    },

    fecharOutrosGrupos(grupoAtualId) {
        Object.keys(this.modulos).forEach(modKey => {
            if (modKey !== grupoAtualId) {
                const el = document.getElementById(this.modulos[modKey].id);
                if (el) {
                    el.classList.remove('open');
                }
            }
        });
    },

    fecharTodosGrupos() {
        Object.values(this.modulos).forEach(modConfig => {
            const el = document.getElementById(modConfig.id);
            if (el) {
                el.classList.remove('open');
            }
        });
    },

    // ==========================================
    // Atualização de Navegação e Estados Ativos
    // ==========================================
    /**
     * Atualiza toda a hierarquia visual da sidebar quando uma aba é clicada.
     * Quando o usuário NÃO estiver dentro do módulo Estoque,
     * a árvore retrátil do Estoque é automaticamente recolhida (fechada)!
     */
    async atualizarNavegacao(aba) {
        this.abaAtiva = aba;

        try {
            localStorage.setItem('autocar_active_tab', aba);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', `#${aba}`);
            }
        } catch (_) {}

        // Encontra o módulo pai desta aba
        let moduloPaiKey = null;
        let submoduloInfo = null;

        for (const [modKey, modConfig] of Object.entries(this.modulos)) {
            if (modConfig.submodulos && modConfig.submodulos[aba]) {
                moduloPaiKey = modKey;
                submoduloInfo = modConfig.submodulos[aba];
                break;
            }
        }

        this.moduloAtivo = moduloPaiKey;

        // Atualiza classes ativas e abre/fecha os grupos
        Object.entries(this.modulos).forEach(([modKey, modConfig]) => {
            const elGrupo = document.getElementById(modConfig.id);
            if (!elGrupo) return;

            if (modKey === moduloPaiKey) {
                elGrupo.classList.add('is-active-module');
                if (modConfig.tipo === 'grupo' && !this.collapsed) {
                    elGrupo.classList.add('open');
                }
            } else {
                elGrupo.classList.remove('is-active-module');
                elGrupo.classList.remove('open');
            }
        });

        // Atualiza destaque no botão da aba clicada
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const btnAtivo = document.getElementById(`tab-btn-${aba}`);
        if (btnAtivo) btnAtivo.classList.add('active');

        // Alterna os painéis visíveis do ERP
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
        const paneAtivo = document.getElementById(`tab-pane-${aba}`);
        if (paneAtivo) {
            paneAtivo.classList.remove('hidden');
            if (paneAtivo.dataset.module && window.ViewLoader) {
                await ViewLoader.loadView(paneAtivo.dataset.module, paneAtivo.id);
            }
        }

        // Atualiza Header Superior / Topbar (Breadcrumbs e Títulos)
        if (submoduloInfo) {
            const elTitulo = document.getElementById('page-title');
            const elSubtitulo = document.getElementById('page-subtitle');
            const elBreadMod = document.getElementById('breadcrumb-module');
            const elBreadSub = document.getElementById('breadcrumb-submodule');
            const btnHeaderCadastrar = document.getElementById('btn-header-cadastrar');

            if (elTitulo) elTitulo.innerText = submoduloInfo.titulo;
            if (elSubtitulo) elSubtitulo.innerText = submoduloInfo.subtitulo;
            if (elBreadMod) elBreadMod.innerText = submoduloInfo.moduloBreadcrumb;
            if (elBreadSub) elBreadSub.innerText = submoduloInfo.submoduloBreadcrumb;

            if (btnHeaderCadastrar) {
                btnHeaderCadastrar.style.display = submoduloInfo.mostrarBotaoCadastrar ? 'inline-flex' : 'none';
            }
        }

        // Se estiver no modo colapsado (apenas ícones), fecha imediatamente o flyout flutuante ao escolher uma opção!
        if (this.collapsed) {
            this.fecharFlyouts();
        }

        // Fecha gaveta mobile ao trocar de tela
        if (window.innerWidth <= 992) {
            this.fecharDrawer();
        }
    },

    registrarModulo(key, config) {
        this.modulos[key] = config;
    }
};

window.Sidebar = Sidebar;
