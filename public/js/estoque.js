/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Controle de Estoque
 * =========================================================
 */

const Estoque = {
    listaProdutos: [],
    listaStats: {
        valorTotalEstoque: 0,
        totalItens: 0,
        reposicao: [],
        ranking: []
    },
    page: 1,
    itemsPerPage: 20,
    totalItems: 0,
    idEdicao: null,
    idMovimentacao: null,
    idExclusao: null,
    financeiroVisivel: false,
    searchTimeout: null,
    abaAtiva: 'produtos',
    filtroStatusGeral: 'todos',
    termoBuscaReposicao: '',
    termoBuscaRanking: '',
    termoBuscaRelatorio: '',
    tipoRelatorio: 'geral',
    dadosRelatorio: null,
    filtrosRelatorio: { status: 'todos', tipo: 'todos', marca: 'todos', modelo: 'todos' },
    filtrosCarregados: false,
    filtroClasseABC: 'todos',
    criterioABC: 'faturamento',
    visaoABC: 'pecas',
    filtroTipoABC: 'todos',
    periodoABC: 'anual',
    rankingPeriodoABC: null,
    rotuloPeriodoAtivoABC: 'Anual',
    dadosCurvaABC: {
        itens: [],
        resumo: {
            classeA: { count: 0, valor: 0, percValor: 0, unidades: 0 },
            classeB: { count: 0, valor: 0, percValor: 0, unidades: 0 },
            classeC: { count: 0, valor: 0, percValor: 0, unidades: 0 },
            total: { count: 0, valor: 0, unidades: 0, riscoRuptura: 0 }
        }
    },

    // Estado do Scanner de Código de Barras (Câmera e USB/HID)
    scannerContexto: 'busca', // 'busca' ou 'cadastro'
    scannerStream: null,
    scannerCameraFacing: 'environment', // 'environment' ou 'user'
    scannerTorchLigada: false,
    scannerAtivo: false,
    scannerHtml5QrCode: null,
    scannerAnimFrame: null,
    scannerAudioCtx: null,

    init() {
        this.ajustarItensPorPagina();
        this.iniciarLeitorTecladoUSB();
        window.addEventListener('resize', () => {
            const novo = window.innerWidth < 768 ? 10 : 20;
            if (novo !== this.itemsPerPage) {
                this.itemsPerPage = novo;
                this.carregarTabela(1);
            }
        });

        // Suporte a navegação por histórico do navegador (botão Voltar/Avançar)
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '');
            const abasValidas = ['produtos', 'reposicao', 'saidas', 'relatorios', 'cotacao'];
            if (hash && abasValidas.includes(hash) && this.abaAtiva !== hash) {
                this.alternarAba(hash);
            }
        });
    },

    toggleSidebar() {
        if (window.Sidebar) return Sidebar.toggleDrawer();
        const sidebar = document.getElementById('app-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('active');
    },

    fecharSidebar() {
        if (window.Sidebar) return Sidebar.fecharDrawer();
        const sidebar = document.getElementById('app-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    },

    toggleMenuGrupo(grupo) {
        if (window.Sidebar) return Sidebar.toggleGrupo(grupo);
        const el = document.getElementById(`group-${grupo}`);
        if (el) el.classList.toggle('open');
    },

    alternarAba(aba) {
        this.abaAtiva = aba;

        try {
            localStorage.setItem('autocar_active_tab', aba);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', `#${aba}`);
            }
        } catch (_) {}

        // Atualização da Sidebar e Topbar via arquitetura modular
        if (window.Sidebar) {
            Sidebar.atualizarNavegacao(aba);
        } else {
            // Fallback caso sidebar.js não esteja carregado
            const groupEstoque = document.getElementById('group-estoque');
            if (['produtos', 'reposicao', 'saidas', 'relatorios'].includes(aba)) {
                if (groupEstoque) {
                    groupEstoque.classList.add('is-active-module');
                    groupEstoque.classList.add('open');
                }
            } else {
                if (groupEstoque) {
                    groupEstoque.classList.remove('is-active-module');
                    groupEstoque.classList.remove('open');
                }
            }

            // Atualiza botões das abas
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            const btnAtivo = document.getElementById(`tab-btn-${aba}`);
            if (btnAtivo) btnAtivo.classList.add('active');

            // Alterna painéis visíveis
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
            const paneAtivo = document.getElementById(`tab-pane-${aba}`);
            if (paneAtivo) paneAtivo.classList.remove('hidden');

            // Atualiza títulos e breadcrumbs dinâmicos da página na Topbar
            const titulos = {
                produtos: { 
                    modulo: 'ESTOQUE', 
                    submodulo: 'GERAL', 
                    titulo: 'Estoque Geral', 
                    subtitulo: 'Visão consolidada dos produtos e controle de estoque' 
                },
                reposicao: { 
                    modulo: 'ESTOQUE', 
                    submodulo: 'REPOSIÇÃO', 
                    titulo: 'Reposição de Estoque', 
                    subtitulo: 'Itens com saldo abaixo do estoque mínimo parametrizado' 
                },
                saidas: { 
                    modulo: 'ESTOQUE', 
                    submodulo: 'CURVA ABC', 
                    titulo: 'Curva ABC & Giro de Peças', 
                    subtitulo: 'Classificação estratégica de giro, relevância financeira e controle de ruptura' 
                },
                relatorios: { 
                    modulo: 'ESTOQUE', 
                    submodulo: 'RELATÓRIOS', 
                    titulo: 'Relatórios Gerenciais', 
                    subtitulo: 'Análise executiva financeira e discriminada de peças' 
                },
                cotacao: { 
                    modulo: 'ORÇAMENTOS', 
                    submodulo: 'COTAÇÃO DE PEÇAS', 
                    titulo: 'Cotação de Peças & Orçamentos', 
                    subtitulo: 'Cote com múltiplos fornecedores e gere orçamentos para clientes' 
                },
                usuarios: { 
                    modulo: 'CONFIGURAÇÕES', 
                    submodulo: 'EQUIPE & ACESSOS', 
                    titulo: 'Equipe & Controle de Acessos', 
                    subtitulo: 'Gerenciamento de colaboradores, cargos e senhas de acesso individuais' 
                }
            };

            const info = titulos[aba] || titulos.produtos;
            const elTitulo = document.getElementById('page-title');
            const elSubtitulo = document.getElementById('page-subtitle');
            const elBreadMod = document.getElementById('breadcrumb-module');
            const elBreadSub = document.getElementById('breadcrumb-submodule');
            const btnHeaderCadastrar = document.getElementById('btn-header-cadastrar');

            if (elTitulo) elTitulo.innerText = info.titulo;
            if (elSubtitulo) elSubtitulo.innerText = info.subtitulo;
            if (elBreadMod) elBreadMod.innerText = info.modulo;
            if (elBreadSub) elBreadSub.innerText = info.submodulo;

            if (btnHeaderCadastrar) {
                btnHeaderCadastrar.style.display = (aba === 'produtos') ? 'inline-flex' : 'none';
            }

            // Fecha a sidebar no mobile se estiver aberta
            if (window.innerWidth <= 992) {
                this.fecharSidebar();
            }
        }

        // Renderiza conteúdo específico se necessário
        if (aba === 'reposicao') {
            this.renderizarTabelaReposicao();
        } else if (aba === 'saidas') {
            this.calcularCurvaABC();
            this.renderizarCardsABC();
            this.renderizarTabelaRanking();
        } else if (aba === 'relatorios') {
            this.carregarRelatorio();
        } else if (aba === 'cotacao') {
            if (window.Cotacao) Cotacao.iniciar();
        } else if (aba === 'usuarios') {
            if (window.Usuarios) Usuarios.carregarLista();
        }
    },

    ajustarItensPorPagina() {
        this.itemsPerPage = window.innerWidth < 768 ? 10 : 20;
    },

    async carregarTudo() {
        await Promise.all([
            this.carregarTabela(1),
            this.carregarStats()
        ]);
        const app = document.getElementById('app-container');
        if (app) app.style.opacity = '1';
        this.restaurarAbaAtiva();
    },

    restaurarAbaAtiva() {
        let aba = 'produtos';
        try {
            const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
            const abasValidas = ['produtos', 'reposicao', 'saidas', 'relatorios', 'cotacao', 'usuarios'];
            if (hash && abasValidas.includes(hash)) {
                aba = hash;
            } else {
                const salva = localStorage.getItem('autocar_active_tab');
                if (salva && abasValidas.includes(salva)) {
                    aba = salva;
                }
            }
        } catch (_) {}

        // Restaura preferências salvas da Curva ABC se estiver nela
        if (aba === 'saidas') {
            try {
                const visaoSalva = localStorage.getItem('autocar_abc_visao');
                if (visaoSalva && (visaoSalva === 'pecas' || visaoSalva === 'tipos')) {
                    this.visaoABC = visaoSalva;
                    document.querySelectorAll('.report-subtabs-segmented .subtab-btn').forEach(b => {
                        if (b.id && b.id.startsWith('subtab-abc-')) b.classList.remove('active');
                    });
                    const btnAtivo = document.getElementById(`subtab-abc-${visaoSalva}`);
                    if (btnAtivo) btnAtivo.classList.add('active');
                    const boxFiltroTipo = document.getElementById('box-filtro-tipo-abc');
                    if (boxFiltroTipo) {
                        boxFiltroTipo.style.display = (visaoSalva === 'pecas') ? 'flex' : 'none';
                    }
                }

                const criterioSalvo = localStorage.getItem('autocar_abc_criterio');
                if (criterioSalvo && (criterioSalvo === 'faturamento' || criterioSalvo === 'volume')) {
                    this.criterioABC = criterioSalvo;
                    const selCrit = document.getElementById('select-criterio-abc');
                    if (selCrit) selCrit.value = criterioSalvo;
                }

                const periodoSalvo = localStorage.getItem('autocar_abc_periodo');
                if (periodoSalvo && ['anual', '30dias', '90dias', 'personalizado'].includes(periodoSalvo)) {
                    const selPer = document.getElementById('select-periodo-abc');
                    if (selPer) selPer.value = periodoSalvo;
                    if (periodoSalvo !== 'anual') {
                        this.alternarAba('saidas');
                        this.alternarPeriodoABC(periodoSalvo);
                        return;
                    }
                }
            } catch (_) {}
        } else if (aba === 'relatorios') {
            try {
                const tipoRelSalvo = localStorage.getItem('autocar_relatorio_tipo');
                if (tipoRelSalvo && ['geral', 'tipo', 'pecas'].includes(tipoRelSalvo)) {
                    this.tipoRelatorio = tipoRelSalvo;
                    document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
                    const btnAtivo = document.getElementById(`subtab-${tipoRelSalvo}`);
                    if (btnAtivo) btnAtivo.classList.add('active');
                }
            } catch (_) {}
        }

        this.alternarAba(aba);
    },

    pesquisar() {
        const input = document.getElementById('input-busca');
        const termo = input ? input.value.trim() : '';
        const btnClear = document.getElementById('btn-clear-busca');

        if (btnClear) {
            if (termo.length > 0) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }

        if (this.filtroStatusGeral !== 'todos') {
            this.aplicarFiltroStatusGeral();
            return;
        }

        clearTimeout(this.searchTimeout);
        if (termo.length === 0 || termo.length >= 2) {
            this.searchTimeout = setTimeout(() => {
                this.carregarTabela(1);
            }, 350);
        }
    },

    limparBusca() {
        const input = document.getElementById('input-busca');
        if (input) input.value = '';
        const btnClear = document.getElementById('btn-clear-busca');
        if (btnClear) btnClear.classList.add('hidden');

        if (this.filtroStatusGeral !== 'todos') {
            this.aplicarFiltroStatusGeral();
        } else {
            this.carregarTabela(1);
        }
    },

    filtrarStatusGeral(status) {
        this.filtroStatusGeral = status;

        // Atualiza estilo dos chips
        ['todos', 'repor', 'zerados'].forEach(s => {
            const el = document.getElementById(`chip-filter-${s}`);
            if (el) {
                if (s === status) el.classList.add('active');
                else el.classList.remove('active');
            }
        });

        const pagControls = document.querySelector('#container-paginacao-produtos .pagination-controls');

        if (status === 'todos') {
            if (pagControls) pagControls.style.display = 'flex';
            this.carregarTabela(1);
        } else {
            if (pagControls) pagControls.style.display = 'none';
            this.aplicarFiltroStatusGeral();
        }
    },

    aplicarFiltroStatusGeral() {
        const input = document.getElementById('input-busca');
        const termo = input ? input.value.trim().toLowerCase() : '';
        let lista = [];
        let labelStatus = '';

        const reposicao = this.listaStats.reposicao || [];

        if (this.filtroStatusGeral === 'repor') {
            lista = [...reposicao];
            labelStatus = 'com necessidade de reposição';
        } else if (this.filtroStatusGeral === 'zerados') {
            lista = reposicao.filter(p => Number(p.qtd) === 0);
            labelStatus = 'com estoque zerado';
        }

        if (termo) {
            lista = lista.filter(p => `${p.tipo} ${p.modelo || ''} ${p.marca || ''} ${p.codigo || ''}`.toLowerCase().includes(termo));
        }

        this.renderizarLinhasProdutos(lista, `Nenhum produto ${labelStatus} encontrado.`);

        const counter = document.getElementById('pagination-counter');
        if (counter) {
            counter.innerHTML = `Exibindo <strong>${lista.length}</strong> produtos ${labelStatus}`;
        }
    },

    filtrarReposicao() {
        const input = document.getElementById('input-busca-reposicao');
        const termo = input ? input.value.trim().toLowerCase() : '';
        const btnClear = document.getElementById('btn-clear-reposicao');
        if (btnClear) {
            if (termo.length > 0) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }
        this.termoBuscaReposicao = termo;
        this.renderizarTabelaReposicao();
    },

    limparBuscaReposicao() {
        const input = document.getElementById('input-busca-reposicao');
        if (input) input.value = '';
        const btnClear = document.getElementById('btn-clear-reposicao');
        if (btnClear) btnClear.classList.add('hidden');
        this.termoBuscaReposicao = '';
        this.renderizarTabelaReposicao();
    },

    filtrarRanking() {
        const input = document.getElementById('input-busca-ranking');
        const termo = input ? input.value.trim().toLowerCase() : '';
        const btnClear = document.getElementById('btn-clear-ranking');
        if (btnClear) {
            if (termo.length > 0) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }
        this.termoBuscaRanking = termo;
        this.renderizarTabelaRanking();
    },

    limparBuscaRanking() {
        const input = document.getElementById('input-busca-ranking');
        if (input) input.value = '';
        const btnClear = document.getElementById('btn-clear-ranking');
        if (btnClear) btnClear.classList.add('hidden');
        this.termoBuscaRanking = '';
        this.renderizarTabelaRanking();
    },

    async carregarTabela(pg = 1) {
        if (this.filtroStatusGeral !== 'todos') {
            this.aplicarFiltroStatusGeral();
            return;
        }
        UI.setLoading(true);
        this.page = pg;
        const input = document.getElementById('input-busca');
        const termo = input ? input.value.trim() : '';

        try {
            const res = await API.listarProdutos(this.page, this.itemsPerPage, termo);
            this.listaProdutos = res.data || [];
            this.totalItems = res.pagination.total || 0;
            this.renderizarTabela();
            this.renderizarPaginacao();
        } catch (err) {
            UI.toast(err.message || 'Erro ao carregar lista de produtos.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    async carregarStats() {
        try {
            const res = await API.obterStats();
            this.listaStats = res.stats || {
                valorTotalEstoque: 0,
                totalItens: 0,
                reposicao: [],
                ranking: []
            };
            this.renderizarStats();
        } catch (err) {
            console.error('Erro ao carregar estatísticas:', err);
        }
    },

    mudarPagina(delta) {
        const maxPage = Math.ceil(this.totalItems / this.itemsPerPage) || 1;
        const newPage = this.page + delta;
        if (newPage >= 1 && newPage <= maxPage) {
            this.carregarTabela(newPage);
        }
    },

    renderizarTabela() {
        this.renderizarLinhasProdutos(this.listaProdutos, 'Nenhum produto cadastrado no estoque.');
    },

    renderizarLinhasProdutos(produtos, msgVazia = 'Nenhum produto encontrado.') {
        const tbody = document.getElementById('tabela-estoque');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!produtos || produtos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding: 40px 15px; color: var(--text-secondary);">
                        <i class="ph ph-magnifying-glass" style="font-size: 2rem; color: #475569; display: block; margin: 0 auto 8px;"></i>
                        ${msgVazia}
                    </td>
                </tr>`;
            return;
        }

        produtos.forEach(p => {
            const qtd = Number(p.qtd) || 0;
            const minimo = Number(p.minimo) || 0;
            const isLow = qtd < minimo;
            const isZero = qtd <= 0;

            const tipo = UI.escapeHtml(p.tipo || 'Item');
            const modelo = UI.escapeHtml(p.modelo || '');
            const marca = UI.escapeHtml(p.marca || '');
            const codigo = UI.escapeHtml(p.codigo || '');
            const compra = Number(p.compra || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const venda = Number(p.venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

            let stockPillHtml = '';
            if (isZero) {
                stockPillHtml = `
                    <span class="stock-pill pill-zero" title="Estoque zerado!">
                        <i class="ph ph-x-circle"></i>
                        <span>0 un</span>
                        <small>Zerado</small>
                    </span>`;
            } else if (isLow) {
                stockPillHtml = `
                    <span class="stock-pill pill-low" title="Estoque abaixo do mínimo (${minimo} un)">
                        <i class="ph ph-warning"></i>
                        <span>${qtd} un</span>
                        <small>Repor</small>
                    </span>`;
            } else {
                stockPillHtml = `
                    <span class="stock-pill pill-ok" title="Estoque regular (mínimo: ${minimo} un)">
                        <i class="ph ph-check-circle"></i>
                        <span>${qtd} un</span>
                    </span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td style="width:40%;">
                        <span class="mobile-label">PRODUTO:</span>
                        <div style="padding: 1px 0;">
                            <strong style="font-size:0.86rem; color:#f8fafc; display:inline-block; margin-bottom:2px; letter-spacing:0.2px;">${tipo} ${modelo}</strong><br>
                            <span style="font-size:0.73rem; color:var(--text-secondary); font-family:monospace;">${marca} ${codigo}</span>
                        </div>
                    </td>
                    <td style="width:14%;">
                        <span class="mobile-label">CUSTO:</span>
                        <span style="color:#cbd5e1; font-size:0.82rem; font-weight:600;">R$ ${compra}</span>
                    </td>
                    <td style="width:14%;">
                        <span class="mobile-label">VENDA:</span>
                        <span style="color:#f8fafc; font-size:0.85rem; font-weight:700;">R$ ${venda}</span>
                    </td>
                    <td style="width:16%;">
                        <span class="mobile-label">ESTOQUE:</span>
                        ${stockPillHtml}
                    </td>
                    <td style="width:16%;">
                        <div class="actions-wrapper">
                            <button class="action-btn btn-action-in" onclick="Estoque.abrirEntrada(${p.id})" title="Entrada no Estoque (+)">
                                <i class="ph ph-plus"></i>
                            </button>
                            <button class="action-btn btn-action-out" onclick="Estoque.abrirSaida(${p.id})" title="Baixa no Estoque (-)">
                                <i class="ph ph-minus"></i>
                            </button>
                            <button class="action-btn btn-action-edit" onclick="Estoque.editarProduto(${p.id})" title="Editar Produto">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="action-btn btn-action-del" onclick="Estoque.pedirSenhaExclusao(${p.id})" title="Excluir Produto">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
    },

    renderizarPaginacao() {
        const maxPage = Math.ceil(this.totalItems / this.itemsPerPage) || 1;
        const pageInfo = document.getElementById('page-info');
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        const counter = document.getElementById('pagination-counter');
        const pag = document.getElementById('container-paginacao-produtos');
        const controls = pag ? pag.querySelector('.pagination-controls') : null;

        if (this.filtroStatusGeral === 'todos' && controls) {
            controls.style.display = 'flex';
        }

        if (pageInfo) pageInfo.innerText = `Página ${this.page} de ${maxPage}`;
        if (btnPrev) btnPrev.disabled = this.page <= 1;
        if (btnNext) btnNext.disabled = this.page >= maxPage;

        if (counter) {
            if (this.totalItems === 0) {
                counter.innerHTML = 'Nenhum produto cadastrado';
            } else {
                const start = ((this.page - 1) * this.itemsPerPage) + 1;
                const end = Math.min(this.page * this.itemsPerPage, this.totalItems);
                counter.innerHTML = `Exibindo <strong>${start}-${end}</strong> de <strong>${this.totalItems}</strong> produtos`;
            }
        }
    },

    renderizarStats() {
        const elTotalItens = document.getElementById('total-itens');
        const elValorTotal = document.getElementById('valor-total');
        const badgeReposicao = document.getElementById('badge-count-reposicao');

        if (elTotalItens) elTotalItens.innerText = this.listaStats.totalItens || 0;
        if (elValorTotal) elValorTotal.innerText = UI.formatCurrency(this.listaStats.valorTotalEstoque || 0);

        const baixos = this.listaStats.reposicao || [];
        const maisVendidos = this.listaStats.ranking || [];

        if (badgeReposicao) {
            if (baixos.length > 0) {
                badgeReposicao.innerText = baixos.length;
                badgeReposicao.style.display = 'inline-block';
            } else {
                badgeReposicao.style.display = 'none';
            }
        }

        // Atualiza badges nas toolbars
        const elRepBadge = document.getElementById('reposicao-total-badge');
        if (elRepBadge) elRepBadge.innerText = baixos.length;

        const elRankBadge = document.getElementById('ranking-total-badge');
        if (elRankBadge) elRankBadge.innerText = maisVendidos.length;

        // Atualiza chips da toolbar de Estoque Geral
        const elChipTodos = document.getElementById('chip-count-todos');
        const elChipRepor = document.getElementById('chip-count-repor');
        const elChipZerados = document.getElementById('chip-count-zerados');

        if (elChipTodos) elChipTodos.innerText = this.listaStats.totalItens || 0;
        if (elChipRepor) elChipRepor.innerText = baixos.length;
        if (elChipZerados) {
            const zerados = baixos.filter(p => Number(p.qtd) === 0).length;
            elChipZerados.innerText = zerados;
        }

        // Calcula Curva ABC e renderiza tabelas e cards
        this.calcularCurvaABC();
        this.renderizarCardsABC();
        this.renderizarTabelaReposicao();
        this.renderizarTabelaRanking();
    },

    renderizarTabelaReposicao() {
        const tbody = document.getElementById('tabela-reposicao');
        if (!tbody) return;

        tbody.innerHTML = '';
        let baixos = this.listaStats.reposicao || [];

        if (this.termoBuscaReposicao) {
            baixos = baixos.filter(p => `${p.tipo} ${p.modelo || ''} ${p.marca || ''} ${p.codigo || ''}`.toLowerCase().includes(this.termoBuscaReposicao));
        }

        if (baixos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding: 40px; color: var(--text-secondary);">
                        <i class="ph ph-check-circle" style="font-size:2.2rem; color:var(--success); display:block; margin:0 auto 10px;"></i>
                        ${this.termoBuscaReposicao ? 'Nenhum produto correspondente encontrado no filtro de reposição.' : 'Estoque 100% abastecido! Nenhum item necessitando de reposição no momento.'}
                    </td>
                </tr>`;
            return;
        }

        baixos.forEach(p => {
            const qtd = Number(p.qtd) || 0;
            const minimo = Number(p.minimo) || 0;
            const faltam = Math.max(0, minimo - qtd);

            const tipo = UI.escapeHtml(p.tipo || 'Item');
            const modelo = UI.escapeHtml(p.modelo || '');
            const marca = UI.escapeHtml(p.marca || '');
            const codigo = UI.escapeHtml(p.codigo || '');

            const pillClass = qtd === 0 ? 'pill-zero' : 'pill-low';
            const pillText = qtd === 0 ? 'Zerado' : 'Baixo';

            tbody.innerHTML += `
                <tr>
                    <td style="width:40%;">
                        <span class="mobile-label">PRODUTO:</span>
                        <div style="padding: 1px 0;">
                            <strong style="font-size:0.86rem; color:#f8fafc; display:inline-block; margin-bottom:2px;">${tipo} ${modelo}</strong><br>
                            <span style="font-size:0.73rem; color:var(--text-secondary); font-family:monospace;">${marca} ${codigo}</span>
                        </div>
                    </td>
                    <td style="width:15%;">
                        <span class="mobile-label">ATUAL:</span>
                        <span class="stock-pill ${pillClass}">
                            <i class="ph ${qtd === 0 ? 'ph-x-circle' : 'ph-warning'}"></i>
                            <span>${qtd} un</span>
                            <small>${pillText}</small>
                        </span>
                    </td>
                    <td style="width:15%;">
                        <span class="mobile-label">MÍNIMO:</span>
                        <span style="color:#cbd5e1; font-weight:600; font-size:0.84rem;">${minimo} un</span>
                    </td>
                    <td style="width:15%;">
                        <span class="mobile-label">DÉFICIT:</span>
                        <span class="stock-deficit-badge">
                            <i class="ph ph-arrow-up-right"></i> +${faltam} un
                        </span>
                    </td>
                    <td style="width:15%;">
                        <div class="actions-wrapper">
                            <button class="action-btn btn-action-in" onclick="Estoque.abrirEntrada(${p.id})" title="Entrada / Repor Estoque (+)">
                                <i class="ph ph-plus"></i>
                            </button>
                            <button class="action-btn btn-action-out" onclick="Estoque.abrirSaida(${p.id})" title="Baixa no Estoque (-)">
                                <i class="ph ph-minus"></i>
                            </button>
                            <button class="action-btn btn-action-edit" onclick="Estoque.editarProduto(${p.id})" title="Editar Produto">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="action-btn btn-action-del" onclick="Estoque.pedirSenhaExclusao(${p.id})" title="Excluir Produto">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
    },

    popularFiltroTipoABC() {
        const select = document.getElementById('filtro-abc-tipo');
        if (!select) return;

        const baseRanking = (this.periodoABC === 'anual')
            ? (this.listaStats.ranking || [])
            : (this.rankingPeriodoABC || []);

        const tipos = Array.from(new Set(
            baseRanking
                .map(p => String(p.tipo || '').trim().toUpperCase())
                .filter(Boolean)
        )).sort();

        const valorAtual = this.filtroTipoABC || 'todos';
        select.innerHTML = '<option value="todos">Todas as Categorias</option>';
        tipos.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === valorAtual) opt.selected = true;
            select.appendChild(opt);
        });
    },

    selecionarVisaoABC(visao) {
        this.visaoABC = visao;
        try {
            localStorage.setItem('autocar_abc_visao', visao);
        } catch (_) {}
        document.querySelectorAll('.report-subtabs-segmented .subtab-btn').forEach(b => {
            if (b.id && b.id.startsWith('subtab-abc-')) b.classList.remove('active');
        });
        const btnAtivo = document.getElementById(`subtab-abc-${visao}`);
        if (btnAtivo) btnAtivo.classList.add('active');

        // Se for visão por categorias, esconde o dropdown de categoria individual (pois já está consolidado)
        const boxFiltroTipo = document.getElementById('box-filtro-tipo-abc');
        if (boxFiltroTipo) {
            boxFiltroTipo.style.display = (visao === 'pecas') ? 'flex' : 'none';
        }

        this.calcularCurvaABC();
        this.renderizarCardsABC();
        this.renderizarTabelaRanking();
    },

    filtrarTipoABC(tipo) {
        this.filtroTipoABC = tipo;
        this.calcularCurvaABC();
        this.renderizarCardsABC();
        this.renderizarTabelaRanking();
    },

    verPecasDaCategoria(tipo) {
        this.filtroTipoABC = tipo;
        const select = document.getElementById('filtro-abc-tipo');
        if (select) select.value = tipo;
        this.selecionarVisaoABC('pecas');
    },

    calcularCurvaABC() {
        this.popularFiltroTipoABC();

        const rawList = (this.periodoABC === 'anual')
            ? (this.listaStats.ranking || [])
            : (this.rankingPeriodoABC || []);

        if (!rawList.length) {
            this.dadosCurvaABC = {
                itens: [],
                resumo: {
                    classeA: { count: 0, valor: 0, percValor: 0, unidades: 0 },
                    classeB: { count: 0, valor: 0, percValor: 0, unidades: 0 },
                    classeC: { count: 0, valor: 0, percValor: 0, unidades: 0 },
                    total: { count: 0, valor: 0, unidades: 0, riscoRuptura: 0 }
                }
            };
            return;
        }

        let itens = [];

        if (this.visaoABC === 'tipos') {
            // Consolidação por Categoria / Tipo
            const grupos = {};
            rawList.forEach(p => {
                const tipo = String(p.tipo || 'OUTROS').trim().toUpperCase();
                if (!grupos[tipo]) {
                    grupos[tipo] = {
                        tipo,
                        produtosCount: 0,
                        saidasNum: 0,
                        faturamento: 0,
                        itensRuptura: 0
                    };
                }
                const saidas = Number(p.periodoSaidas !== undefined ? p.periodoSaidas : p.saidas) || 0;
                const venda = Number(p.venda) || 0;
                const qtd = Number(p.qtd) || 0;
                const minimo = Number(p.minimo) || 0;
                const fat = Number(p.periodoFaturamento !== undefined ? p.periodoFaturamento : (p.faturamento || (saidas * venda))) || 0;

                grupos[tipo].produtosCount++;
                grupos[tipo].saidasNum += saidas;
                grupos[tipo].faturamento += fat;
                if (qtd <= minimo) {
                    grupos[tipo].itensRuptura++;
                }
            });

            itens = Object.values(grupos).map(cat => {
                const metrica = this.criterioABC === 'volume' ? cat.saidasNum : cat.faturamento;
                return {
                    ...cat,
                    metrica,
                    riscoRuptura: cat.itensRuptura > 0
                };
            });
        } else {
            // Visão por Peças (com possível filtro de tipo/categoria)
            let listaBase = rawList;
            if (this.filtroTipoABC && this.filtroTipoABC !== 'todos') {
                listaBase = listaBase.filter(p => String(p.tipo || '').trim().toUpperCase() === this.filtroTipoABC);
            }

            itens = listaBase.map(p => {
                const saidas = Number(p.periodoSaidas !== undefined ? p.periodoSaidas : p.saidas) || 0;
                const venda = Number(p.venda) || 0;
                const compra = Number(p.compra) || 0;
                const qtd = Number(p.qtd) || 0;
                const minimo = Number(p.minimo) || 0;
                const faturamento = Number(p.periodoFaturamento !== undefined ? p.periodoFaturamento : (p.faturamento || (saidas * venda))) || 0;
                const metrica = this.criterioABC === 'volume' ? saidas : faturamento;
                const riscoRuptura = (qtd <= minimo);

                return {
                    ...p,
                    saidasNum: saidas,
                    vendaNum: venda,
                    compraNum: compra,
                    qtdNum: qtd,
                    minimoNum: minimo,
                    faturamento,
                    metrica,
                    riscoRuptura
                };
            });
        }

        // Ordenação decrescente pela métrica escolhida
        itens.sort((a, b) => b.metrica - a.metrica);

        const totalMetrica = itens.reduce((acc, x) => acc + x.metrica, 0);
        const totalFaturamento = itens.reduce((acc, x) => acc + x.faturamento, 0);
        const totalUnidades = itens.reduce((acc, x) => acc + x.saidasNum, 0);

        let acumulado = 0;

        const resumo = {
            classeA: { count: 0, valor: 0, percValor: 0, unidades: 0 },
            classeB: { count: 0, valor: 0, percValor: 0, unidades: 0 },
            classeC: { count: 0, valor: 0, percValor: 0, unidades: 0 },
            total: { count: itens.length, valor: totalFaturamento, unidades: totalUnidades, riscoRuptura: 0 }
        };

        itens.forEach((item, idx) => {
            acumulado += item.metrica;
            item.rankPos = idx + 1;
            item.percIndividual = totalMetrica > 0 ? (item.metrica / totalMetrica) * 100 : 0;
            item.percAcumulado = totalMetrica > 0 ? Math.min(100, (acumulado / totalMetrica) * 100) : 0;

            const percAnterior = item.percAcumulado - item.percIndividual;

            // Classificação Pareto
            if (item.percAcumulado <= 80 || percAnterior < 80) {
                item.classe = 'A';
                resumo.classeA.count++;
                resumo.classeA.valor += item.faturamento;
                resumo.classeA.unidades += item.saidasNum;
            } else if (item.percAcumulado <= 95 || percAnterior < 95) {
                item.classe = 'B';
                resumo.classeB.count++;
                resumo.classeB.valor += item.faturamento;
                resumo.classeB.unidades += item.saidasNum;
            } else {
                item.classe = 'C';
                resumo.classeC.count++;
                resumo.classeC.valor += item.faturamento;
                resumo.classeC.unidades += item.saidasNum;
            }

            if (item.riscoRuptura && (item.classe === 'A' || item.classe === 'B')) {
                resumo.total.riscoRuptura++;
            }
        });

        resumo.classeA.percValor = totalFaturamento > 0 ? (resumo.classeA.valor / totalFaturamento) * 100 : 0;
        resumo.classeB.percValor = totalFaturamento > 0 ? (resumo.classeB.valor / totalFaturamento) * 100 : 0;
        resumo.classeC.percValor = totalFaturamento > 0 ? (resumo.classeC.valor / totalFaturamento) * 100 : 0;

        this.dadosCurvaABC = { itens, resumo };
    },

    renderizarCardsABC() {
        const { resumo } = this.dadosCurvaABC;
        if (!resumo) return;

        const sufixoItem = this.visaoABC === 'tipos' ? 'categorias' : 'produtos';

        // Atualiza Card Classe A
        const elValA = document.getElementById('abc-card-val-a');
        const elPercA = document.getElementById('abc-card-perc-a');
        const elItensA = document.getElementById('abc-card-itens-a');
        if (elValA) elValA.innerText = UI.formatCurrency(resumo.classeA.valor);
        if (elPercA) elPercA.innerText = `${resumo.classeA.percValor.toFixed(1)}% do faturamento (${resumo.classeA.unidades} un)`;
        if (elItensA) elItensA.innerText = `${resumo.classeA.count} ${sufixoItem}`;

        // Atualiza Card Classe B
        const elValB = document.getElementById('abc-card-val-b');
        const elPercB = document.getElementById('abc-card-perc-b');
        const elItensB = document.getElementById('abc-card-itens-b');
        if (elValB) elValB.innerText = UI.formatCurrency(resumo.classeB.valor);
        if (elPercB) elPercB.innerText = `${resumo.classeB.percValor.toFixed(1)}% do faturamento (${resumo.classeB.unidades} un)`;
        if (elItensB) elItensB.innerText = `${resumo.classeB.count} ${sufixoItem}`;

        // Atualiza Card Classe C
        const elValC = document.getElementById('abc-card-val-c');
        const elPercC = document.getElementById('abc-card-perc-c');
        const elItensC = document.getElementById('abc-card-itens-c');
        if (elValC) elValC.innerText = UI.formatCurrency(resumo.classeC.valor);
        if (elPercC) elPercC.innerText = `${resumo.classeC.percValor.toFixed(1)}% do faturamento (${resumo.classeC.unidades} un)`;
        if (elItensC) elItensC.innerText = `${resumo.classeC.count} ${sufixoItem}`;

        // Atualiza Card Total
        const elValTot = document.getElementById('abc-card-val-total');
        const elUnTot = document.getElementById('abc-card-unidades-total');
        const elItensTot = document.getElementById('abc-card-itens-total');
        if (elValTot) elValTot.innerText = UI.formatCurrency(resumo.total.valor);
        if (elUnTot) elUnTot.innerText = `${resumo.total.unidades} saídas totais`;
        if (elItensTot) elItensTot.innerText = `${resumo.total.count} ${sufixoItem} no escopo`;

        // Atualiza badges dos Chips
        const elChipTodos = document.getElementById('badge-chip-todos');
        const elChipA = document.getElementById('badge-chip-A');
        const elChipB = document.getElementById('badge-chip-B');
        const elChipC = document.getElementById('badge-chip-C');
        const elChipRup = document.getElementById('badge-chip-ruptura');

        if (elChipTodos) elChipTodos.innerText = resumo.total.count;
        if (elChipA) elChipA.innerText = resumo.classeA.count;
        if (elChipB) elChipB.innerText = resumo.classeB.count;
        if (elChipC) elChipC.innerText = resumo.classeC.count;
        if (elChipRup) elChipRup.innerText = resumo.total.riscoRuptura;
    },

    filtrarClasseABC(classe) {
        this.filtroClasseABC = classe;
        document.querySelectorAll('.abc-chip').forEach(c => c.classList.remove('active'));
        const chip = document.getElementById(`chip-abc-${classe}`);
        if (chip) chip.classList.add('active');
        this.renderizarTabelaRanking();
    },

    alternarCriterioABC(criterio) {
        this.criterioABC = criterio;
        try {
            localStorage.setItem('autocar_abc_criterio', criterio);
        } catch (_) {}
        this.calcularCurvaABC();
        this.renderizarCardsABC();
        this.renderizarTabelaRanking();
    },

    async alternarPeriodoABC(periodo) {
        this.periodoABC = periodo;
        try {
            localStorage.setItem('autocar_abc_periodo', periodo);
        } catch (_) {}
        const containerPersonalizado = document.getElementById('abc-custom-date-container');
        const rotuloAtivo = document.getElementById('abc-rotulo-periodo-ativo');

        if (periodo === 'personalizado') {
            if (containerPersonalizado) {
                containerPersonalizado.classList.remove('hidden');
            }
            const elDe = document.getElementById('abc-data-inicio');
            const elAte = document.getElementById('abc-data-fim');
            const hoje = new Date();
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
            const hojeStr = hoje.toISOString().split('T')[0];
            if (elDe && !elDe.value) elDe.value = primeiroDia;
            if (elAte && !elAte.value) elAte.value = hojeStr;

            if (rotuloAtivo) rotuloAtivo.innerText = '';
            return;
        }

        if (containerPersonalizado) {
            containerPersonalizado.classList.add('hidden');
        }
        if (rotuloAtivo) rotuloAtivo.innerText = '';

        if (periodo === 'anual') {
            this.rankingPeriodoABC = null;
            this.calcularCurvaABC();
            this.renderizarCardsABC();
            this.renderizarTabelaRanking();
            return;
        }

        // Período relativo: '30dias' ou '90dias'
        try {
            UI.mostrarLoading(true);
            const res = await API.obterCurvaABC({ periodo });
            if (res && res.success) {
                this.rankingPeriodoABC = res.ranking || [];
                if (rotuloAtivo) rotuloAtivo.innerText = res.rotuloPeriodo || '';
            }
        } catch (err) {
            console.error('[alternarPeriodoABC] Erro:', err);
            UI.notificar('Erro ao consultar saídas do período selecionado.', 'danger');
        } finally {
            UI.mostrarLoading(false);
            this.calcularCurvaABC();
            this.renderizarCardsABC();
            this.renderizarTabelaRanking();
        }
    },

    async aplicarPeriodoPersonalizadoABC() {
        const elDe = document.getElementById('abc-data-inicio');
        const elAte = document.getElementById('abc-data-fim');
        const rotuloAtivo = document.getElementById('abc-rotulo-periodo-ativo');

        const de = elDe ? elDe.value : '';
        const ate = elAte ? elAte.value : '';

        if (de && ate && de > ate) {
            UI.notificar('A data inicial (De) não pode ser maior que a final (Até).', 'warning');
            return;
        }

        try {
            UI.mostrarLoading(true);
            const res = await API.obterCurvaABC({ periodo: 'personalizado', de, ate });
            if (res && res.success) {
                this.periodoABC = 'personalizado';
                this.rankingPeriodoABC = res.ranking || [];
                if (rotuloAtivo) rotuloAtivo.innerText = res.rotuloPeriodo || '';
                UI.notificar(`Filtro aplicado: ${res.rotuloPeriodo}`, 'success');
            }
        } catch (err) {
            console.error('[aplicarPeriodoPersonalizadoABC] Erro:', err);
            UI.notificar('Erro ao consultar período personalizado.', 'danger');
        } finally {
            UI.mostrarLoading(false);
            this.calcularCurvaABC();
            this.renderizarCardsABC();
            this.renderizarTabelaRanking();
        }
    },

    renderizarTabelaRanking() {
        const thead = document.getElementById('thead-ranking');
        const tbody = document.getElementById('tabela-ranking');
        const tfoot = document.getElementById('tfoot-ranking');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';

        if (!this.dadosCurvaABC.itens || !this.dadosCurvaABC.itens.length) {
            this.calcularCurvaABC();
            this.renderizarCardsABC();
        }

        // Renderiza o cabeçalho correto de acordo com a visão ativa
        if (thead) {
            if (this.visaoABC === 'tipos') {
                thead.innerHTML = `
                    <tr>
                        <th style="width:12%; text-align:center;">Classe / Rank</th>
                        <th style="width:26%;">Categoria / Tipo</th>
                        <th style="width:12%; text-align:center;">Produtos</th>
                        <th style="width:14%; text-align:center;">Saúde Estoque</th>
                        <th style="width:10%; text-align:center;">Saídas</th>
                        <th style="width:14%;">Receita Gerada</th>
                        <th style="width:10%; text-align:center;">% Acum.</th>
                        <th style="width:12%; text-align:center;">Ações</th>
                    </tr>
                `;
            } else {
                thead.innerHTML = `
                    <tr>
                        <th style="width:12%; text-align:center;">Classe / Rank</th>
                        <th style="width:30%;">Produto / Especificação</th>
                        <th style="width:14%; text-align:center;">Saldo Estoque</th>
                        <th style="width:10%; text-align:center;">Saídas</th>
                        <th style="width:11%;">Preço Venda</th>
                        <th style="width:13%;">Receita Gerada</th>
                        <th style="width:10%; text-align:center;">% Acum.</th>
                        <th style="width:10%; text-align:right;">Ações Rápidas</th>
                    </tr>
                `;
            }
        }

        let lista = this.dadosCurvaABC.itens || [];

        // Filtro por classe ou ruptura
        if (this.filtroClasseABC === 'A' || this.filtroClasseABC === 'B' || this.filtroClasseABC === 'C') {
            lista = lista.filter(item => item.classe === this.filtroClasseABC);
        } else if (this.filtroClasseABC === 'ruptura') {
            lista = lista.filter(item => item.riscoRuptura && (item.classe === 'A' || item.classe === 'B'));
        }

        // Filtro por termo de busca
        if (this.termoBuscaRanking) {
            if (this.visaoABC === 'tipos') {
                lista = lista.filter(p => p.tipo.toLowerCase().includes(this.termoBuscaRanking));
            } else {
                lista = lista.filter(p => `${p.tipo} ${p.modelo || ''} ${p.marca || ''} ${p.codigo || ''}`.toLowerCase().includes(this.termoBuscaRanking));
            }
        }

        if (lista.length === 0) {
            const cols = 8;
            tbody.innerHTML = `
                <tr>
                    <td colspan="${cols}" style="text-align:center; padding: 40px; color: var(--text-secondary);">
                        <i class="ph ph-chart-line-down" style="font-size:2.2rem; color:var(--text-secondary); display:block; margin:0 auto 10px;"></i>
                        ${this.termoBuscaRanking ? 'Nenhum resultado correspondente encontrado na Curva ABC.' : 'Nenhuma movimentação encontrada para o escopo selecionado.'}
                    </td>
                </tr>`;
            return;
        }

        let somaSaidas = 0;
        let somaFaturamento = 0;
        let somaPerc = 0;

        lista.forEach(p => {
            somaSaidas += p.saidasNum;
            somaFaturamento += p.faturamento;
            somaPerc += p.percIndividual;

            let medalHtml = '';
            if (p.rankPos === 1) {
                medalHtml = `<span class="rank-badge rank-gold" title="1º Lugar Geral"><i class="ph ph-trophy"></i> 1º</span>`;
            } else if (p.rankPos === 2) {
                medalHtml = `<span class="rank-badge rank-silver" title="2º Lugar Geral"><i class="ph ph-medal"></i> 2º</span>`;
            } else if (p.rankPos === 3) {
                medalHtml = `<span class="rank-badge rank-bronze" title="3º Lugar Geral"><i class="ph ph-medal"></i> 3º</span>`;
            } else {
                medalHtml = `<span class="rank-badge rank-neutral">${p.rankPos}º</span>`;
            }

            if (this.visaoABC === 'tipos') {
                // Linha de Categoria / Tipo
                let saudeHtml = '';
                if (p.itensRuptura > 0) {
                    saudeHtml = `<span class="rupture-alert-pill" title="${p.itensRuptura} produtos abaixo do mínimo ou zerados"><i class="ph ph-warning"></i> ${p.itensRuptura} em alerta</span>`;
                } else {
                    saudeHtml = `<span class="stock-pill pill-ok"><i class="ph ph-check-circle"></i> Estoque OK</span>`;
                }

                tbody.innerHTML += `
                    <tr>
                        <td style="width:12%; text-align:center;">
                            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                                <span class="badge-classe-${p.classe.toLowerCase()}">CLASSE ${p.classe}</span>
                                ${medalHtml}
                            </div>
                        </td>
                        <td style="width:26%;">
                            <div style="padding: 2px 0;">
                                <strong style="font-size:0.9rem; color:#f8fafc; display:flex; align-items:center; gap:6px;">
                                    <i class="ph ph-tag" style="color:var(--gold);"></i> ${UI.escapeHtml(p.tipo)}
                                </strong>
                            </div>
                        </td>
                        <td style="width:12%; text-align:center;">
                            <span style="font-size:0.84rem; color:#cbd5e1; font-weight:600;">${p.produtosCount} SKUs</span>
                        </td>
                        <td style="width:14%; text-align:center;">
                            ${saudeHtml}
                        </td>
                        <td style="width:10%; text-align:center;">
                            <strong style="color:var(--success); font-size:0.88rem; font-weight:700;">
                                <i class="ph ph-arrow-circle-up" style="margin-right:2px;"></i> ${p.saidasNum} un
                            </strong>
                        </td>
                        <td style="width:14%;">
                            <div style="display:flex; flex-direction:column;">
                                <strong style="color:#ffffff; font-size:0.88rem;">${UI.formatCurrency(p.faturamento)}</strong>
                                <span style="font-size:0.71rem; color:#94a3b8;">${p.percIndividual.toFixed(1)}% do faturamento</span>
                            </div>
                        </td>
                        <td style="width:10%; text-align:center;">
                            <div class="abc-progress-wrapper">
                                <strong style="font-size:0.76rem; color:#f8fafc;">${p.percAcumulado.toFixed(1)}%</strong>
                                <div class="abc-progress-bar">
                                    <div class="abc-progress-fill ${p.classe.toLowerCase()}" style="width:${Math.min(100, p.percAcumulado)}%;"></div>
                                </div>
                            </div>
                        </td>
                        <td style="width:12%; text-align:center;">
                            <button class="btn btn-secondary btn-sm" onclick="Estoque.verPecasDaCategoria(this.dataset.tipo)" data-tipo="${UI.escapeHtml(p.tipo)}" title="Ver todas as peças desta categoria">
                                <i class="ph ph-magnifying-glass"></i> Ver Peças
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                // Linha de Peça Individual
                const tipo = UI.escapeHtml(p.tipo || 'Item');
                const modelo = UI.escapeHtml(p.modelo || '');
                const marca = UI.escapeHtml(p.marca || '');
                const codigo = UI.escapeHtml(p.codigo || '');
                const vendaFmt = Number(p.vendaNum || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

                let stockPillHtml = '';
                if (p.qtdNum === 0) {
                    stockPillHtml = `<span class="stock-pill pill-zero" title="Estoque Físico Zerado">0 un</span>`;
                } else if (p.qtdNum < p.minimoNum) {
                    stockPillHtml = `<span class="stock-pill pill-low" title="Abaixo do Mínimo (${p.minimoNum} un)">${p.qtdNum} un</span>`;
                } else {
                    stockPillHtml = `<span class="stock-pill pill-ok" title="Estoque Regular">${p.qtdNum} un</span>`;
                }

                let ruptureAlertHtml = '';
                if (p.riscoRuptura && (p.classe === 'A' || p.classe === 'B')) {
                    if (p.qtdNum === 0) {
                        ruptureAlertHtml = `<span class="rupture-alert-pill" title="Crítico: Peça Classe ${p.classe} zerada!"><i class="ph ph-warning-octagon"></i> Zerado!</span>`;
                    } else {
                        ruptureAlertHtml = `<span class="rupture-alert-pill" title="Atenção: Peça Classe ${p.classe} abaixo do mínimo!"><i class="ph ph-warning"></i> Repor!</span>`;
                    }
                }

                tbody.innerHTML += `
                    <tr>
                        <td style="width:12%; text-align:center;">
                            <span class="mobile-label">CLASSE / RANK:</span>
                            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                                <span class="badge-classe-${p.classe.toLowerCase()}">CLASSE ${p.classe}</span>
                                ${medalHtml}
                            </div>
                        </td>
                        <td style="width:30%;">
                            <span class="mobile-label">PRODUTO:</span>
                            <div style="padding: 1px 0;">
                                <strong style="font-size:0.86rem; color:#f8fafc; display:inline-block; margin-bottom:2px;">${tipo} ${modelo}</strong><br>
                                <span style="font-size:0.73rem; color:var(--text-secondary); font-family:monospace;">${marca} ${codigo}</span>
                            </div>
                        </td>
                        <td style="width:14%; text-align:center;">
                            <span class="mobile-label">SALDO:</span>
                            <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                                ${stockPillHtml}
                                ${ruptureAlertHtml}
                            </div>
                        </td>
                        <td style="width:10%; text-align:center;">
                            <span class="mobile-label">SAÍDAS:</span>
                            <strong style="color:var(--success); font-size:0.88rem; font-weight:700;">
                                <i class="ph ph-arrow-circle-up" style="margin-right:2px;"></i> ${p.saidasNum} un
                            </strong>
                        </td>
                        <td style="width:11%;">
                            <span class="mobile-label">VENDA:</span>
                            <span style="color:#cbd5e1; font-weight:600; font-size:0.84rem;">R$ ${vendaFmt}</span>
                        </td>
                        <td style="width:13%;">
                            <span class="mobile-label">RECEITA:</span>
                            <div style="display:flex; flex-direction:column;">
                                <strong style="color:#ffffff; font-size:0.86rem;">${UI.formatCurrency(p.faturamento)}</strong>
                                <span style="font-size:0.71rem; color:#94a3b8;">${p.percIndividual.toFixed(1)}% do total</span>
                            </div>
                        </td>
                        <td style="width:10%; text-align:center;">
                            <span class="mobile-label">% ACUM.:</span>
                            <div class="abc-progress-wrapper">
                                <strong style="font-size:0.76rem; color:#f8fafc;">${p.percAcumulado.toFixed(1)}%</strong>
                                <div class="abc-progress-bar">
                                    <div class="abc-progress-fill ${p.classe.toLowerCase()}" style="width:${Math.min(100, p.percAcumulado)}%;"></div>
                                </div>
                            </div>
                        </td>
                        <td style="width:10%; text-align:right;">
                            <div class="actions-wrapper" style="justify-content:flex-end;">
                                <button class="action-btn btn-action-in" onclick="Estoque.abrirEntrada(${p.id})" title="Entrada no Estoque (+)">
                                    <i class="ph ph-plus"></i>
                                </button>
                                <button class="action-btn btn-action-out" onclick="Estoque.abrirSaida(${p.id})" title="Baixa no Estoque (-)">
                                    <i class="ph ph-minus"></i>
                                </button>
                                <button class="action-btn btn-action-edit" onclick="Estoque.editarProduto(${p.id})" title="Editar Produto">
                                    <i class="ph ph-pencil-simple"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
            }
        });

        if (tfoot) {
            const rotuloTotal = this.visaoABC === 'tipos' ? 'categorias exibidas' : 'produtos exibidos';
            tfoot.innerHTML = `
                <tr>
                    <td colspan="3" style="padding:10px 14px; color:#94a3b8; font-size:0.8rem;">
                        TOTAIS (${lista.length} ${rotuloTotal})
                    </td>
                    <td style="text-align:center; color:var(--success); font-weight:800; font-size:0.88rem;">${somaSaidas} un</td>
                    <td>-</td>
                    <td style="color:#ffffff; font-weight:800; font-size:0.88rem;">${UI.formatCurrency(somaFaturamento)}</td>
                    <td style="text-align:center; color:var(--gold); font-weight:800; font-size:0.84rem;">${somaPerc.toFixed(1)}%</td>
                    <td></td>
                </tr>`;
        }
    },

    abrirModalLista(tipo) {
        const modal = document.getElementById('modal-lista');
        const content = document.getElementById('conteudo-modal-lista');
        const titulo = document.getElementById('titulo-modal-lista');
        if (!modal || !content || !titulo) return;

        modal.classList.remove('hidden');
        content.innerHTML = '';

        if (tipo === 'reposicao') {
            titulo.innerText = 'REPOSIÇÃO NECESSÁRIA';
            titulo.style.color = 'var(--gold)';
            const baixos = this.listaStats.reposicao || [];
            baixos.forEach(p => {
                content.innerHTML += `
                    <div class="list-item" style="padding:15px 0;">
                        <div>
                            <strong style="color:white; font-size:1rem;">${UI.escapeHtml(p.tipo)} ${UI.escapeHtml(p.modelo || '')}</strong><br>
                            <span style="font-size:0.8rem; color:#888">${UI.escapeHtml(p.marca || '')}</span>
                        </div>
                        <div style="text-align:right">
                            <strong style="color:var(--gold); font-size:1.2rem;">${p.qtd} un</strong>
                            <div style="font-size:0.8rem; color:#666">Mín: ${p.minimo}</div>
                        </div>
                    </div>`;
            });
        } else {
            titulo.innerText = 'PRODUTOS MAIS VENDIDOS';
            titulo.style.color = 'var(--success)';
            const rank = this.listaStats.ranking || [];
            rank.forEach((p, i) => {
                content.innerHTML += `
                    <div class="list-item" style="padding:15px 0;">
                        <div>
                            <strong style="color:white; font-size:1rem;">${i + 1}. ${UI.escapeHtml(p.tipo)} ${UI.escapeHtml(p.modelo || '')}</strong><br>
                            <span style="font-size:0.8rem; color:#888">${UI.escapeHtml(p.marca || '')}</span>
                        </div>
                        <strong style="color:var(--success); font-size:1.2rem;">${p.saidas} un</strong>
                    </div>`;
            });
        }
    },

    toggleFinanceiro() {
        this.financeiroVisivel = !this.financeiroVisivel;
        const el = document.getElementById('valor-total');
        if (el) el.classList.toggle('blur-value');
    },

    abrirModalCadastro() {
        this.idEdicao = null;
        document.querySelectorAll('#modal-cadastro input').forEach(i => i.value = '');
        document.getElementById('modal-cadastro-titulo').innerText = 'CADASTRAR PRODUTO';
        UI.abrirModal('modal-cadastro');
        setTimeout(() => document.getElementById('tipo')?.focus(), 50);
    },

    obterProdutoPorId(id) {
        const numId = Number(id);
        return this.listaProdutos.find(x => Number(x.id) === numId) ||
               (this.listaStats.reposicao || []).find(x => Number(x.id) === numId) ||
               (this.listaStats.ranking || []).find(x => Number(x.id) === numId) ||
               (this.rankingPeriodoABC || []).find(x => Number(x.id) === numId) ||
               (this.dadosCurvaABC?.itens || []).find(x => Number(x.id) === numId) ||
               (this.dadosRelatorio?.produtos || []).find(x => Number(x.id) === numId);
    },

    editarProduto(id) {
        this.idEdicao = id;
        const p = this.obterProdutoPorId(id);
        if (!p) {
            return UI.toast('Não foi possível carregar os dados deste produto.', 'warning');
        }

        document.getElementById('modal-cadastro-titulo').innerText = 'EDITAR PRODUTO';
        document.getElementById('tipo').value = p.tipo || '';
        document.getElementById('marca').value = p.marca || '';
        document.getElementById('modelo').value = p.modelo || '';
        document.getElementById('codigo').value = p.codigo || '';
        document.getElementById('qtd').value = p.qtd || 0;
        document.getElementById('minimo').value = p.minimo || 0;
        document.getElementById('valorCompra').value = Number(p.compra || p.compraUnit || 0).toFixed(2).replace('.', ',');
        document.getElementById('valorVenda').value = Number(p.venda || p.vendaUnit || 0).toFixed(2).replace('.', ',');

        UI.abrirModal('modal-cadastro');
    },

    async salvarProduto() {
        const p = {
            tipo: document.getElementById('tipo').value.trim(),
            marca: document.getElementById('marca').value.trim(),
            modelo: document.getElementById('modelo').value.trim(),
            codigo: document.getElementById('codigo').value.trim(),
            qtd: parseInt(document.getElementById('qtd').value) || 0,
            minimo: parseInt(document.getElementById('minimo').value) || 0,
            compra: UI.lerMoeda(document.getElementById('valorCompra').value),
            venda: UI.lerMoeda(document.getElementById('valorVenda').value)
        };

        if (!p.tipo) {
            return UI.toast('Preencha o tipo do produto!', 'warning');
        }

        try {
            UI.setLoading(true);
            if (this.idEdicao === null) {
                await API.cadastrarProduto(p);
                UI.toast('Produto cadastrado com sucesso!', 'success');
            } else {
                await API.atualizarProduto(this.idEdicao, p);
                UI.toast('Produto atualizado com sucesso!', 'success');
            }
            this.fecharModal('modal-cadastro');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Erro ao salvar produto.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    abrirEntrada(id) {
        this.idMovimentacao = id;
        const p = this.obterProdutoPorId(id);
        if (!p) {
            return UI.toast('Não foi possível carregar os dados deste produto.', 'warning');
        }

        document.getElementById('nome-produto-entrada').innerText = `${p.tipo} ${p.modelo || ''}`;
        document.getElementById('qtd-entrada').value = 1;
        document.getElementById('check-devolucao').checked = false;
        UI.abrirModal('modal-entrada');
        setTimeout(() => document.getElementById('qtd-entrada')?.focus(), 50);
    },

    async confirmarEntrada() {
        const qtd = parseInt(document.getElementById('qtd-entrada').value);
        const devolucao = document.getElementById('check-devolucao').checked;

        if (!qtd || qtd <= 0) {
            return UI.toast('Quantidade inválida para entrada.', 'warning');
        }

        try {
            UI.setLoading(true);
            await API.registrarEntrada(this.idMovimentacao, qtd, devolucao);
            UI.toast('Entrada registrada com sucesso!', 'success');
            this.fecharModal('modal-entrada');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Erro ao registrar entrada.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    abrirSaida(id) {
        this.idMovimentacao = id;
        const p = this.obterProdutoPorId(id);
        if (!p) {
            return UI.toast('Não foi possível carregar os dados deste produto.', 'warning');
        }

        document.getElementById('nome-produto-saida').innerText = `${p.tipo} ${p.modelo || ''}`;
        document.getElementById('qtd-saida').value = 1;
        document.getElementById('check-venda').checked = true;
        UI.abrirModal('modal-saida');
        setTimeout(() => document.getElementById('qtd-saida')?.focus(), 50);
    },

    async confirmarSaida() {
        const qtd = parseInt(document.getElementById('qtd-saida').value);
        const isVenda = document.getElementById('check-venda').checked;

        if (!qtd || qtd <= 0) {
            return UI.toast('Quantidade inválida para saída.', 'warning');
        }

        try {
            UI.setLoading(true);
            await API.registrarSaida(this.idMovimentacao, qtd, isVenda);
            UI.toast('Saída realizada com sucesso!', 'success');
            this.fecharModal('modal-saida');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Erro ao registrar saída.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    pedirSenhaExclusao(id) {
        this.idExclusao = id;
        const inputSenha = document.getElementById('senha-supervisor');
        if (inputSenha) inputSenha.value = '';
        UI.abrirModal('modal-senha-exclusao');
        setTimeout(() => inputSenha?.focus(), 50);
    },

    async confirmarExclusao() {
        const senhaSupervisor = document.getElementById('senha-supervisor').value.trim();
        if (!senhaSupervisor) {
            return UI.toast('Digite a senha de supervisor.', 'warning');
        }

        try {
            UI.setLoading(true);
            await API.excluirProduto(this.idExclusao, senhaSupervisor);
            UI.toast('Produto excluído com sucesso!', 'success');
            this.fecharModal('modal-senha-exclusao');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Senha de supervisor incorreta ou erro ao excluir.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    /* =========================================================
       MÓDULO DE RELATÓRIOS ESTRATÉGICOS
       ========================================================= */
    formatarMoeda(val) {
        if (typeof UI !== 'undefined' && typeof UI.formatCurrency === 'function') {
            return UI.formatCurrency(val);
        }
        const n = Number(val) || 0;
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    async carregarRelatorio() {
        UI.setLoading(true);
        try {
            const res = await API.obterRelatorio(this.filtrosRelatorio);
            if (res && res.relatorio) {
                this.dadosRelatorio = res.relatorio;
                this.popularFiltrosRelatorio(res.relatorio.filtrosDisponiveis);
                this.renderizarRelatorioAtual();
            }
        } catch (err) {
            console.error('Erro ao carregar relatório:', err);
            UI.toast(err.message || 'Erro ao carregar relatório.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    popularFiltrosRelatorio(filtros) {
        if (!filtros) return;

        const selectTipo = document.getElementById('filtro-relatorio-tipo');
        const selectMarca = document.getElementById('filtro-relatorio-marca');
        const selectModelo = document.getElementById('filtro-relatorio-modelo');

        if (selectTipo && filtros.tipos && !this.filtrosCarregados) {
            const tiposUnicos = Array.from(new Set(filtros.tipos.map(t => String(t || '').trim().toUpperCase()))).sort();
            selectTipo.innerHTML = '<option value="todos">Todos os Tipos</option>';
            tiposUnicos.forEach(t => {
                if (!t) return;
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                selectTipo.appendChild(opt);
            });
        }

        if (selectMarca && filtros.marcas && !this.filtrosCarregados) {
            const marcasUnicas = Array.from(new Set(filtros.marcas.map(m => String(m || '').trim().toUpperCase()))).sort();
            selectMarca.innerHTML = '<option value="todos">Todas as Marcas</option>';
            marcasUnicas.forEach(m => {
                if (!m) return;
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                selectMarca.appendChild(opt);
            });
        }

        if (selectModelo && filtros.modelos) {
            const valorAtual = selectModelo.value;
            const modelosUnicos = Array.from(new Set(filtros.modelos.map(mod => String(mod || '').trim().toUpperCase()))).sort();
            selectModelo.innerHTML = '<option value="todos">Todos os Modelos</option>';
            modelosUnicos.forEach(mod => {
                if (!mod) return;
                const opt = document.createElement('option');
                opt.value = mod;
                opt.textContent = mod;
                if (mod === valorAtual) opt.selected = true;
                selectModelo.appendChild(opt);
            });
        }

        this.filtrosCarregados = true;
    },

    aplicarFiltrosRelatorio() {
        const status = document.getElementById('filtro-relatorio-status')?.value || 'todos';
        const tipo = document.getElementById('filtro-relatorio-tipo')?.value || 'todos';
        const marca = document.getElementById('filtro-relatorio-marca')?.value || 'todos';
        const modelo = document.getElementById('filtro-relatorio-modelo')?.value || 'todos';

        this.filtrosRelatorio = { status, tipo, marca, modelo };
        this.carregarRelatorio();
    },

    filtrarBuscaRelatorio() {
        const input = document.getElementById('input-busca-relatorio');
        const termo = input ? input.value.trim().toLowerCase() : '';
        const btnClear = document.getElementById('btn-clear-relatorio');

        if (btnClear) {
            if (termo.length > 0) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }

        this.termoBuscaRelatorio = termo;
        this.renderizarRelatorioAtual();
    },

    limparBuscaRelatorio() {
        const input = document.getElementById('input-busca-relatorio');
        if (input) input.value = '';
        const btnClear = document.getElementById('btn-clear-relatorio');
        if (btnClear) btnClear.classList.add('hidden');
        this.termoBuscaRelatorio = '';
        this.renderizarRelatorioAtual();
    },

    limparFiltrosRelatorio() {
        const status = document.getElementById('filtro-relatorio-status');
        const tipo = document.getElementById('filtro-relatorio-tipo');
        const marca = document.getElementById('filtro-relatorio-marca');
        const modelo = document.getElementById('filtro-relatorio-modelo');
        const busca = document.getElementById('input-busca-relatorio');
        const btnClear = document.getElementById('btn-clear-relatorio');

        if (status) status.value = 'todos';
        if (tipo) tipo.value = 'todos';
        if (marca) marca.value = 'todos';
        if (modelo) modelo.value = 'todos';
        if (busca) busca.value = '';
        if (btnClear) btnClear.classList.add('hidden');

        this.termoBuscaRelatorio = '';
        this.filtrosRelatorio = { status: 'todos', tipo: 'todos', marca: 'todos', modelo: 'todos' };
        this.carregarRelatorio();
    },

    atalhoFiltroStatus(status) {
        const el = document.getElementById('filtro-relatorio-status');
        if (el) el.value = status;
        this.filtrosRelatorio.status = status;
        this.carregarRelatorio();
    },

    selecionarTipoRelatorio(tipo) {
        this.tipoRelatorio = tipo;
        try {
            localStorage.setItem('autocar_relatorio_tipo', tipo);
        } catch (_) {}

        document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        const btnAtivo = document.getElementById(`subtab-${tipo}`);
        if (btnAtivo) btnAtivo.classList.add('active');

        this.renderizarRelatorioAtual();
    },

    atualizarCabecalhoImpressao(titulo) {
        const elData = document.getElementById('print-data-emissao');
        const elTitulo = document.getElementById('print-titulo-subtipo');
        if (elData) elData.textContent = `Data: ${new Date().toLocaleString('pt-BR')}`;
        if (elTitulo) elTitulo.textContent = titulo;
    },

    renderizarRelatorioAtual() {
        if (!this.dadosRelatorio) return;

        const container = document.getElementById('relatorio-conteudo');
        if (!container) return;

        if (this.tipoRelatorio === 'geral') {
            this.atualizarCabecalhoImpressao('Visão Geral Consolidada');
            this.renderizarRelatorioGeral(container);
        } else if (this.tipoRelatorio === 'tipo') {
            this.atualizarCabecalhoImpressao('Relatório Consolidado por Categoria / Tipo');
            this.renderizarRelatorioPorTipo(container);
        } else if (this.tipoRelatorio === 'modelo') {
            this.atualizarCabecalhoImpressao('Relação de Peças em Estoque por Modelo');
            this.renderizarRelatorioPorModelo(container);
        } else if (this.tipoRelatorio === 'pecas') {
            this.atualizarCabecalhoImpressao('Relatório Analítico Discriminado por Peça');
            this.renderizarRelatorioPorPecas(container);
        }
    },

    renderizarRelatorioGeral(container) {
        const { geral, porTipo, porModelo, produtos } = this.dadosRelatorio;

        let itensOk = 0;
        let itensRepor = 0;
        let itensZerados = 0;

        produtos.forEach(p => {
            if (p.qtd === 0) itensZerados++;
            else if (p.qtd < p.minimo) itensRepor++;
            else itensOk++;
        });

        const margemGeralFmt = (geral.margemMediaGeral || 0).toFixed(1);
        const temFiltroTipo = this.filtrosRelatorio.tipo && this.filtrosRelatorio.tipo !== 'todos';
        const termo = this.termoBuscaRelatorio;

        let html = `
            <!-- 1. Grid Executivo de 4 Indicadores Estratégicos -->
            <div class="report-kpi-grid">
                <div class="report-kpi-card kpi-blue">
                    <div class="report-kpi-header">
                        <span class="report-kpi-title">Capital Investido</span>
                        <i class="ph ph-currency-dollar kpi-icon"></i>
                    </div>
                    <div class="report-kpi-val">${this.formatarMoeda(geral.totalCusto)}</div>
                    <div class="report-kpi-sub">Custo total imobilizado</div>
                </div>

                <div class="report-kpi-card kpi-green">
                    <div class="report-kpi-header">
                        <span class="report-kpi-title">Faturamento Projetado</span>
                        <i class="ph ph-trend-up kpi-icon"></i>
                    </div>
                    <div class="report-kpi-val">${this.formatarMoeda(geral.totalVendaPotencial)}</div>
                    <div class="report-kpi-sub">Venda potencial se liquidado</div>
                </div>

                <div class="report-kpi-card kpi-gold">
                    <div class="report-kpi-header">
                        <span class="report-kpi-title">Lucro Bruto Previsto</span>
                        <span class="kpi-tag-badge">+${margemGeralFmt}% markup</span>
                    </div>
                    <div class="report-kpi-val" style="color:var(--success);">${this.formatarMoeda(geral.totalLucroPotencial)}</div>
                    <div class="report-kpi-sub">Retorno financeiro esperado</div>
                </div>

                <div class="report-kpi-card kpi-purple">
                    <div class="report-kpi-header">
                        <span class="report-kpi-title">Posição Física</span>
                        <i class="ph ph-package kpi-icon"></i>
                    </div>
                    <div class="report-kpi-val">${geral.totalUnidadesFisicas} <small style="font-size:0.85rem; font-weight:600; color:#94a3b8;">unidades</small></div>
                    <div class="report-kpi-sub">${geral.totalItens} produtos distintos (SKUs)</div>
                </div>
            </div>

            <!-- 2. Faixa Interativa de Saúde do Estoque -->
            <div class="report-health-strip">
                <div class="health-item ok" onclick="Estoque.atalhoFiltroStatus('positivo')" title="Clique para filtrar apenas itens regulares">
                    <i class="ph ph-check-circle"></i>
                    <div class="health-info">
                        <strong>${itensOk} Itens Regulares</strong>
                        <span>Estoque saudável (&gt; mínimo)</span>
                    </div>
                </div>

                <div class="health-item warning" onclick="Estoque.atalhoFiltroStatus('repor')" title="Clique para filtrar itens que necessitam de reposição">
                    <i class="ph ph-warning-circle"></i>
                    <div class="health-info">
                        <strong>${itensRepor} Para Reposição</strong>
                        <span>Estoque abaixo do mínimo parametrizado</span>
                    </div>
                </div>

                <div class="health-item danger" onclick="Estoque.atalhoFiltroStatus('zerado')" title="Clique para filtrar itens zerados">
                    <i class="ph ph-x-circle"></i>
                    <div class="health-info">
                        <strong>${itensZerados} Itens Zerados</strong>
                        <span>Saldo zero no estoque</span>
                    </div>
                </div>
            </div>
        `;

        if (temFiltroTipo) {
            let listaModelos = porModelo || [];
            if (termo) {
                listaModelos = listaModelos.filter(m => `${m.modelo} ${m.marca || ''} ${m.codigo || ''}`.toLowerCase().includes(termo));
            }

            html += `
                <div class="report-section-card">
                    <div class="report-section-header">
                        <h3 class="report-section-title">
                            <i class="ph ph-car"></i> Relação de Peças por Modelo — ${UI.escapeHtml(this.filtrosRelatorio.tipo)} (${listaModelos.length} modelos)
                        </h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th style="width:25%;">Modelo / Aplicação</th>
                                    <th style="width:14%;">Marca</th>
                                    <th style="width:11%;">Código</th>
                                    <th style="width:12%; text-align:center;">Estoque</th>
                                    <th style="width:12%;">Custo Unit.</th>
                                    <th style="width:12%;">Venda Unit.</th>
                                    <th style="width:14%;">Total Custo</th>
                                    <th style="width:14%;">Total Venda</th>
                                    <th style="width:12%; text-align:right;">Margem</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (listaModelos.length === 0) {
                html += `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-secondary);">Nenhum modelo correspondente ao filtro.</td></tr>`;
            } else {
                listaModelos.forEach(m => {
                    const lucro = m.valorVenda - m.valorCusto;
                    const margem = m.valorCusto > 0 ? ((lucro / m.valorCusto) * 100).toFixed(1) : '0.0';
                    const pillClass = m.unidadesTotais === 0 ? 'pill-zero' : (m.unidadesTotais < 2 ? 'pill-low' : 'pill-ok');

                    html += `
                        <tr>
                            <td><strong style="color:#f8fafc; font-size:0.86rem;">${UI.escapeHtml(m.modelo)}</strong></td>
                            <td>${UI.escapeHtml(m.marca || '-')}</td>
                            <td style="font-family:monospace; font-size:0.78rem; color:var(--text-secondary);">${UI.escapeHtml(m.codigo) || '-'}</td>
                            <td style="text-align:center;">
                                <span class="stock-pill ${pillClass}">
                                    <span>${m.unidadesTotais} un</span>
                                </span>
                            </td>
                            <td>${this.formatarMoeda(m.compraUnit || (m.unidadesTotais > 0 ? m.valorCusto / m.unidadesTotais : 0))}</td>
                            <td>${this.formatarMoeda(m.vendaUnit || (m.unidadesTotais > 0 ? m.valorVenda / m.unidadesTotais : 0))}</td>
                            <td><strong>${this.formatarMoeda(m.valorCusto)}</strong></td>
                            <td>${this.formatarMoeda(m.valorVenda)}</td>
                            <td style="text-align:right; color:var(--gold); font-weight:700;">${margem}%</td>
                        </tr>
                    `;
                });
            }

            html += `
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3">TOTAIS DE ${UI.escapeHtml(this.filtrosRelatorio.tipo)}</td>
                                    <td style="text-align:center;"><strong>${geral.totalUnidadesFisicas} un</strong></td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td>${this.formatarMoeda(geral.totalCusto)}</td>
                                    <td>${this.formatarMoeda(geral.totalVendaPotencial)}</td>
                                    <td style="text-align:right; color:var(--gold);">${margemGeralFmt}%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
        } else {
            let listaTipos = porTipo || [];
            let listaTopModelos = porModelo || [];

            if (termo) {
                listaTipos = listaTipos.filter(t => t.tipo.toLowerCase().includes(termo));
                listaTopModelos = listaTopModelos.filter(m => `${m.modelo} ${m.marca || ''} ${m.tipo || ''}`.toLowerCase().includes(termo));
            }

            html += `
                <!-- Tabela 1: Distribuição por Categoria -->
                <div class="report-section-card">
                    <div class="report-section-header">
                        <h3 class="report-section-title">
                            <i class="ph ph-chart-bar"></i> Distribuição Consolidada por Categoria / Tipo
                        </h3>
                        <button class="btn btn-secondary btn-sm" onclick="Estoque.selecionarTipoRelatorio('tipo')">
                            <i class="ph ph-tag"></i> Ver Todas as Categorias
                        </button>
                    </div>
                    <div class="table-wrapper">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th style="width:28%;">Tipo / Categoria</th>
                                    <th style="width:12%; text-align:center;">SKUs</th>
                                    <th style="width:12%; text-align:center;">Unidades</th>
                                    <th style="width:16%;">Custo Investido</th>
                                    <th style="width:16%;">Venda Projetada</th>
                                    <th style="width:16%;">Lucro Estimado</th>
                                    <th style="width:12%; text-align:right;">% Estoque</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (listaTipos.length === 0) {
                html += `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-secondary);">Nenhuma categoria correspondente ao filtro.</td></tr>`;
            } else {
                listaTipos.slice(0, 12).forEach(t => {
                    const perc = geral.totalCusto > 0 ? ((t.valorCusto / geral.totalCusto) * 100).toFixed(1) : '0.0';
                    const lucroTipo = t.valorVenda - t.valorCusto;
                    html += `
                        <tr>
                            <td><strong style="color:#f8fafc; font-size:0.86rem;">${UI.escapeHtml(t.tipo)}</strong></td>
                            <td style="text-align:center;">${t.itensDistintos}</td>
                            <td style="text-align:center;"><span class="stock-pill pill-ok"><span>${t.unidadesTotais} un</span></span></td>
                            <td>${this.formatarMoeda(t.valorCusto)}</td>
                            <td>${this.formatarMoeda(t.valorVenda)}</td>
                            <td style="color:var(--success); font-weight:600;">${this.formatarMoeda(lucroTipo)}</td>
                            <td style="text-align:right;"><strong>${perc}%</strong></td>
                        </tr>
                    `;
                });
            }

            html += `
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>TOTAIS CONSOLIDADOS</td>
                                    <td style="text-align:center;">${geral.totalItens}</td>
                                    <td style="text-align:center;">${geral.totalUnidadesFisicas} un</td>
                                    <td>${this.formatarMoeda(geral.totalCusto)}</td>
                                    <td>${this.formatarMoeda(geral.totalVendaPotencial)}</td>
                                    <td style="color:var(--success);">${this.formatarMoeda(geral.totalLucroPotencial)}</td>
                                    <td style="text-align:right;">100.0%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- Tabela 2: Modelos com Maior Volume Físico -->
                <div class="report-section-card">
                    <div class="report-section-header">
                        <h3 class="report-section-title">
                            <i class="ph ph-car"></i> Modelos com Maior Presença em Estoque
                        </h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th style="width:28%;">Modelo / Aplicação</th>
                                    <th style="width:16%;">Categoria</th>
                                    <th style="width:14%;">Marca</th>
                                    <th style="width:12%; text-align:center;">Estoque</th>
                                    <th style="width:14%;">Custo Total</th>
                                    <th style="width:14%;">Venda Total</th>
                                    <th style="width:12%; text-align:right;">Margem</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (listaTopModelos.length === 0) {
                html += `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-secondary);">Nenhum modelo correspondente ao filtro.</td></tr>`;
            } else {
                listaTopModelos.slice(0, 12).forEach(m => {
                    const lucro = m.valorVenda - m.valorCusto;
                    const margem = m.valorCusto > 0 ? ((lucro / m.valorCusto) * 100).toFixed(1) : '0.0';
                    const pillClass = m.unidadesTotais === 0 ? 'pill-zero' : (m.unidadesTotais < 2 ? 'pill-low' : 'pill-ok');

                    html += `
                        <tr>
                            <td><strong style="color:#f8fafc; font-size:0.86rem;">${UI.escapeHtml(m.modelo)}</strong></td>
                            <td>${UI.escapeHtml(m.tipo)}</td>
                            <td>${UI.escapeHtml(m.marca || '-')}</td>
                            <td style="text-align:center;">
                                <span class="stock-pill ${pillClass}">
                                    <span>${m.unidadesTotais} un</span>
                                </span>
                            </td>
                            <td><strong>${this.formatarMoeda(m.valorCusto)}</strong></td>
                            <td>${this.formatarMoeda(m.valorVenda)}</td>
                            <td style="text-align:right; color:var(--gold); font-weight:700;">${margem}%</td>
                        </tr>
                    `;
                });
            }

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    renderizarRelatorioPorTipo(container) {
        const { geral, porTipo } = this.dadosRelatorio;
        const termo = this.termoBuscaRelatorio;

        let lista = porTipo || [];
        if (termo) {
            lista = lista.filter(t => t.tipo.toLowerCase().includes(termo));
        }

        let totalItens = 0;
        let totalUnidades = 0;
        let totalCusto = 0;
        let totalVenda = 0;

        let rowsHtml = '';
        lista.forEach(t => {
            const lucro = t.valorVenda - t.valorCusto;
            const margem = t.valorCusto > 0 ? ((lucro / t.valorCusto) * 100).toFixed(1) : '0.0';
            const percEstoque = geral.totalCusto > 0 ? ((t.valorCusto / geral.totalCusto) * 100).toFixed(1) : '0.0';

            totalItens += t.itensDistintos;
            totalUnidades += t.unidadesTotais;
            totalCusto += t.valorCusto;
            totalVenda += t.valorVenda;

            rowsHtml += `
                <tr>
                    <td><strong style="color:#f8fafc; font-size:0.86rem;">${UI.escapeHtml(t.tipo)}</strong></td>
                    <td style="text-align:center;">${t.itensDistintos}</td>
                    <td style="text-align:center;"><span class="stock-pill pill-ok"><span>${t.unidadesTotais} un</span></span></td>
                    <td>${this.formatarMoeda(t.valorCusto)}</td>
                    <td>${this.formatarMoeda(t.valorVenda)}</td>
                    <td style="color:var(--success); font-weight:600;">${this.formatarMoeda(lucro)}</td>
                    <td style="text-align:center; color:var(--gold); font-weight:600;">${margem}%</td>
                    <td style="text-align:right;"><strong>${percEstoque}%</strong></td>
                </tr>
            `;
        });

        const totalLucro = totalVenda - totalCusto;
        const totalMargem = totalCusto > 0 ? ((totalLucro / totalCusto) * 100).toFixed(1) : '0.0';

        let html = `
            <div class="report-section-card">
                <div class="report-section-header">
                    <h3 class="report-section-title">
                        <i class="ph ph-tag"></i> Relatório Consolidado por Categoria / Tipo (${lista.length} categorias)
                    </h3>
                </div>
                <div class="table-wrapper">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Categoria / Tipo</th>
                                <th style="text-align:center;">Itens Distintos</th>
                                <th style="text-align:center;">Qtd Unidades</th>
                                <th>Custo Total</th>
                                <th>Venda Projetada</th>
                                <th>Lucro Projetado</th>
                                <th style="text-align:center;">Margem (%)</th>
                                <th style="text-align:right;">% do Estoque</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-secondary);">Nenhuma categoria encontrada com os filtros atuais.</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>TOTAIS</td>
                                <td style="text-align:center;">${totalItens}</td>
                                <td style="text-align:center;">${totalUnidades} un</td>
                                <td>${this.formatarMoeda(totalCusto)}</td>
                                <td>${this.formatarMoeda(totalVenda)}</td>
                                <td style="color:var(--success);">${this.formatarMoeda(totalLucro)}</td>
                                <td style="text-align:center; color:var(--gold);">${totalMargem}%</td>
                                <td style="text-align:right;">100.0%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    renderizarRelatorioPorModelo(container) {
        const { porModelo } = this.dadosRelatorio;
        const termo = this.termoBuscaRelatorio;

        let lista = porModelo || [];
        if (termo) {
            lista = lista.filter(m => `${m.modelo} ${m.tipo || ''} ${m.marca || ''} ${m.codigo || ''}`.toLowerCase().includes(termo));
        }

        let totalUnidades = 0;
        let totalCusto = 0;
        let totalVenda = 0;

        let rowsHtml = '';
        lista.forEach(m => {
            totalUnidades += m.unidadesTotais;
            totalCusto += m.valorCusto;
            totalVenda += m.valorVenda;

            const lucro = m.valorVenda - m.valorCusto;
            const margem = m.valorCusto > 0 ? ((lucro / m.valorCusto) * 100).toFixed(1) : '0.0';
            const pillClass = m.unidadesTotais === 0 ? 'pill-zero' : (m.unidadesTotais < 2 ? 'pill-low' : 'pill-ok');

            rowsHtml += `
                <tr>
                    <td><strong style="color:#f8fafc; font-size:0.86rem;">${UI.escapeHtml(m.modelo)}</strong></td>
                    <td>${UI.escapeHtml(m.tipo)}</td>
                    <td>${UI.escapeHtml(m.marca || '-')}</td>
                    <td style="font-family:monospace; font-size:0.78rem; color:var(--text-secondary);">${UI.escapeHtml(m.codigo) || '-'}</td>
                    <td style="text-align:center;">
                        <span class="stock-pill ${pillClass}">
                            <span>${m.unidadesTotais} un</span>
                        </span>
                    </td>
                    <td>${this.formatarMoeda(m.compraUnit || (m.unidadesTotais > 0 ? m.valorCusto / m.unidadesTotais : 0))}</td>
                    <td>${this.formatarMoeda(m.vendaUnit || (m.unidadesTotais > 0 ? m.valorVenda / m.unidadesTotais : 0))}</td>
                    <td><strong>${this.formatarMoeda(m.valorCusto)}</strong></td>
                    <td>${this.formatarMoeda(m.valorVenda)}</td>
                    <td style="color:var(--success); font-weight:600;">${this.formatarMoeda(lucro)}</td>
                    <td style="text-align:right; color:var(--gold); font-weight:600;">${margem}%</td>
                </tr>
            `;
        });

        const totalLucro = totalVenda - totalCusto;
        const totalMargem = totalCusto > 0 ? ((totalLucro / totalCusto) * 100).toFixed(1) : '0.0';

        let html = `
            <div class="report-section-card">
                <div class="report-section-header">
                    <h3 class="report-section-title">
                        <i class="ph ph-car"></i> Relação de Peças em Estoque por Modelo (${lista.length} modelos)
                    </h3>
                </div>
                <div class="table-wrapper">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Modelo / Aplicação</th>
                                <th>Categoria</th>
                                <th>Marca</th>
                                <th>Código</th>
                                <th style="text-align:center;">Estoque</th>
                                <th>Custo Unit.</th>
                                <th>Venda Unit.</th>
                                <th>Custo Total</th>
                                <th>Venda Total</th>
                                <th>Lucro Estimado</th>
                                <th style="text-align:right;">Margem (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="11" style="text-align:center; padding:30px; color:var(--text-secondary);">Nenhum modelo encontrado com os filtros atuais.</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4">TOTAIS CONSOLIDADOS (${lista.length} MODELOS)</td>
                                <td style="text-align:center;"><strong>${totalUnidades} un</strong></td>
                                <td>-</td>
                                <td>-</td>
                                <td>${this.formatarMoeda(totalCusto)}</td>
                                <td>${this.formatarMoeda(totalVenda)}</td>
                                <td style="color:var(--success);">${this.formatarMoeda(totalLucro)}</td>
                                <td style="text-align:right; color:var(--gold);">${totalMargem}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    renderizarRelatorioPorPecas(container) {
        const { produtos } = this.dadosRelatorio;
        const termo = this.termoBuscaRelatorio;

        let lista = produtos || [];
        if (termo) {
            lista = lista.filter(p => `${p.codigo || ''} ${p.modelo || ''} ${p.tipo || ''} ${p.marca || ''}`.toLowerCase().includes(termo));
        }

        let totalUnidades = 0;
        let totalCusto = 0;
        let totalVenda = 0;

        let rowsHtml = '';
        lista.forEach(p => {
            totalUnidades += p.qtd;
            totalCusto += p.subtotalCusto;
            totalVenda += p.subtotalVenda;

            const lucroTotal = p.subtotalVenda - p.subtotalCusto;
            const pillClass = p.qtd === 0 ? 'pill-zero' : (p.qtd < p.minimo ? 'pill-low' : 'pill-ok');
            const pillText = p.qtd === 0 ? 'Zerado' : (p.qtd < p.minimo ? 'Repor' : 'OK');

            rowsHtml += `
                <tr>
                    <td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${UI.escapeHtml(p.codigo) || '-'}</td>
                    <td><strong style="color:#f8fafc; font-size:0.86rem;">${UI.escapeHtml(p.modelo) || '-'}</strong></td>
                    <td>${UI.escapeHtml(p.tipo)}</td>
                    <td>${UI.escapeHtml(p.marca) || 'SEM MARCA'}</td>
                    <td style="text-align:center;">
                        <span class="stock-pill ${pillClass}">
                            <span>${p.qtd} un</span>
                            <small>${pillText}</small>
                        </span>
                    </td>
                    <td style="text-align:center; color:#94a3b8; font-size:0.8rem;">
                        ${p.minimo} un
                    </td>
                    <td>${this.formatarMoeda(p.compraUnit)}</td>
                    <td>${this.formatarMoeda(p.vendaUnit)}</td>
                    <td><strong>${this.formatarMoeda(p.subtotalCusto)}</strong></td>
                    <td>${this.formatarMoeda(p.subtotalVenda)}</td>
                    <td style="color:var(--success); font-weight:600;">${this.formatarMoeda(lucroTotal)}</td>
                    <td style="text-align:right; color:var(--gold); font-weight:600;">${p.margemLucro.toFixed(1)}%</td>
                </tr>
            `;
        });

        const totalLucro = totalVenda - totalCusto;
        const totalMargem = totalCusto > 0 ? ((totalLucro / totalCusto) * 100).toFixed(1) : '0.0';

        let html = `
            <div class="report-section-card">
                <div class="report-section-header">
                    <h3 class="report-section-title">
                        <i class="ph ph-list-dashes"></i> Relatório Analítico Discriminado por Peça (${lista.length} itens)
                    </h3>
                </div>
                <div class="table-wrapper">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Modelo / Aplicação</th>
                                <th>Categoria</th>
                                <th>Marca</th>
                                <th style="text-align:center;">Status</th>
                                <th style="text-align:center;">Mínimo</th>
                                <th>Custo Unit.</th>
                                <th>Venda Unit.</th>
                                <th>Custo Total</th>
                                <th>Venda Total</th>
                                <th>Lucro Total</th>
                                <th style="text-align:right;">Margem (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="12" style="text-align:center; padding:30px; color:var(--text-secondary);">Nenhum item encontrado com os filtros atuais.</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4">TOTAIS (${lista.length} ITENS)</td>
                                <td style="text-align:center;"><strong>${totalUnidades} un</strong></td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>${this.formatarMoeda(totalCusto)}</td>
                                <td>${this.formatarMoeda(totalVenda)}</td>
                                <td style="color:var(--success);">${this.formatarMoeda(totalLucro)}</td>
                                <td style="text-align:right; color:var(--gold);">${totalMargem}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    exportarCSV() {
        if (!this.dadosRelatorio) {
            return UI.toast('Nenhum dado de relatório carregado para exportar.', 'warning');
        }

        const dataIso = new Date().toISOString().slice(0, 10);
        let csvConteudo = '';
        let nomeArquivo = '';

        if (this.tipoRelatorio === 'geral') {
            nomeArquivo = `autocarbs_relatorio_geral_${dataIso}.csv`;
            csvConteudo += 'AUTOCAR BS - RELATORIO GERAL DE ESTOQUE\n';
            csvConteudo += `Data Emissao;${new Date().toLocaleString('pt-BR')}\n\n`;
            csvConteudo += 'METRICA;VALOR\n';
            csvConteudo += `Total de SKUs;${this.dadosRelatorio.geral.totalItens}\n`;
            csvConteudo += `Total Unidades Fisicas;${this.dadosRelatorio.geral.totalUnidadesFisicas}\n`;
            csvConteudo += `Custo Total Investido;R$ ${this.dadosRelatorio.geral.totalCusto.toFixed(2).replace('.', ',')}\n`;
            csvConteudo += `Venda Total Projetada;R$ ${this.dadosRelatorio.geral.totalVendaPotencial.toFixed(2).replace('.', ',')}\n`;
            csvConteudo += `Lucro Total Projetado;R$ ${this.dadosRelatorio.geral.totalLucroPotencial.toFixed(2).replace('.', ',')}\n`;
            csvConteudo += `Margem Bruta Media;${this.dadosRelatorio.geral.margemMediaGeral.toFixed(2).replace('.', ',')}%\n\n`;

            csvConteudo += 'DISTRIBUICAO POR CATEGORIA / TIPO\n';
            csvConteudo += 'Tipo;Itens Distintos;Unidades;Custo Total;Venda Projetada;Lucro Projetado\n';
            this.dadosRelatorio.porTipo.forEach(t => {
                const lucro = t.valorVenda - t.valorCusto;
                csvConteudo += `"${t.tipo}";${t.itensDistintos};${t.unidadesTotais};${t.valorCusto.toFixed(2).replace('.', ',')};${t.valorVenda.toFixed(2).replace('.', ',')};${lucro.toFixed(2).replace('.', ',')}\n`;
            });
        } else if (this.tipoRelatorio === 'tipo') {
            nomeArquivo = `autocarbs_relatorio_por_tipo_${dataIso}.csv`;
            csvConteudo += 'AUTOCAR BS - RELATORIO DE ESTOQUE POR CATEGORIA / TIPO\n';
            csvConteudo += `Data Emissao;${new Date().toLocaleString('pt-BR')}\n\n`;
            csvConteudo += 'Tipo/Categoria;Itens Distintos;Qtd Unidades;Custo Total (R$);Venda Projetada (R$);Lucro Projetado (R$);Margem (%)\n';
            this.dadosRelatorio.porTipo.forEach(t => {
                const lucro = t.valorVenda - t.valorCusto;
                const margem = t.valorCusto > 0 ? ((lucro / t.valorCusto) * 100).toFixed(2).replace('.', ',') : '0,00';
                csvConteudo += `"${t.tipo}";${t.itensDistintos};${t.unidadesTotais};${t.valorCusto.toFixed(2).replace('.', ',')};${t.valorVenda.toFixed(2).replace('.', ',')};${lucro.toFixed(2).replace('.', ',')};${margem}%\n`;
            });
        } else if (this.tipoRelatorio === 'modelo') {
            nomeArquivo = `autocarbs_relatorio_por_modelo_${dataIso}.csv`;
            csvConteudo += 'AUTOCAR BS - RELATORIO DE ESTOQUE POR MODELO\n';
            csvConteudo += `Data Emissao;${new Date().toLocaleString('pt-BR')}\n\n`;
            csvConteudo += 'Modelo;Tipo;Marca;Codigo;Qtd Estoque;Custo Unit (R$);Venda Unit (R$);Custo Total (R$);Venda Total (R$);Lucro Projetado (R$);Margem (%)\n';
            (this.dadosRelatorio.porModelo || []).forEach(m => {
                const lucro = m.valorVenda - m.valorCusto;
                const margem = m.valorCusto > 0 ? ((lucro / m.valorCusto) * 100).toFixed(2).replace('.', ',') : '0,00';
                csvConteudo += `"${m.modelo}";"${m.tipo}";"${m.marca}";"${m.codigo || ''}";${m.unidadesTotais};${(m.compraUnit || 0).toFixed(2).replace('.', ',')};${(m.vendaUnit || 0).toFixed(2).replace('.', ',')};${m.valorCusto.toFixed(2).replace('.', ',')};${m.valorVenda.toFixed(2).replace('.', ',')};${lucro.toFixed(2).replace('.', ',')};${margem}%\n`;
            });
        } else {
            nomeArquivo = `autocarbs_relatorio_por_pecas_${dataIso}.csv`;
            csvConteudo += 'AUTOCAR BS - RELATORIO DISCRIMINADO POR PECA\n';
            csvConteudo += `Data Emissao;${new Date().toLocaleString('pt-BR')}\n\n`;
            csvConteudo += 'Codigo;Modelo;Tipo;Marca;Status;Estoque;Minimo;Custo Unit;Venda Unit;Custo Subtotal;Venda Subtotal;Lucro Estimado;Margem (%)\n';
            this.dadosRelatorio.produtos.forEach(p => {
                const lucro = p.subtotalVenda - p.subtotalCusto;
                csvConteudo += `"${p.codigo || ''}";"${p.modelo || ''}";"${p.tipo}";"${p.marca || ''}";"${p.statusEstoque}";${p.qtd};${p.minimo};${p.compraUnit.toFixed(2).replace('.', ',')};${p.vendaUnit.toFixed(2).replace('.', ',')};${p.subtotalCusto.toFixed(2).replace('.', ',')};${p.subtotalVenda.toFixed(2).replace('.', ',')};${lucro.toFixed(2).replace('.', ',')};${p.margemLucro.toFixed(2).replace('.', ',')}%\n`;
            });
        }

        const blob = new Blob(['\uFEFF' + csvConteudo], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    imprimirRelatorio() {
        if (!this.dadosRelatorio) {
            return UI.toast('Nenhum dado carregado para gerar o relatório.', 'warning');
        }
        this.gerarDocumentoImpressao();
        window.print();
    },

    gerarDocumentoImpressao() {
        const printArea = document.getElementById('relatorio-documento-impressao');
        if (!printArea || !this.dadosRelatorio) return;

        const { geral, porTipo, produtos } = this.dadosRelatorio;

        // Formata filtros para exibição no relatório
        const statusTxt = this.filtrosRelatorio.status === 'positivo' ? 'Estoque Positivo (> 0)' :
                          (this.filtrosRelatorio.status === 'repor' ? 'Reposição Urgente (< Mínimo)' :
                          (this.filtrosRelatorio.status === 'zerado' ? 'Zerados (0 no estoque)' : 'Todos os Status'));
        const tipoTxt = this.filtrosRelatorio.tipo !== 'todos' ? this.filtrosRelatorio.tipo : 'Todas as Categorias';
        const marcaTxt = this.filtrosRelatorio.marca !== 'todos' ? this.filtrosRelatorio.marca : 'Todas as Marcas';

        let itensOk = 0;
        let itensRepor = 0;
        let itensZerados = 0;
        (produtos || []).forEach(p => {
            if (p.qtd === 0) itensZerados++;
            else if (p.qtd < p.minimo) itensRepor++;
            else itensOk++;
        });

        let tituloDocumento = 'RELATÓRIO ANALÍTICO - LISTAGEM DE PEÇAS';
        if (this.tipoRelatorio === 'geral') {
            tituloDocumento = 'RELATÓRIO EXECUTIVO - VISÃO GERAL DO ESTOQUE';
        } else if (this.tipoRelatorio === 'tipo') {
            tituloDocumento = 'RELATÓRIO GERENCIAL - DISTRIBUIÇÃO POR CATEGORIA';
        }

        let html = `
            <div class="print-sheet">
                <!-- Cabeçalho Oficial e Econômico -->
                <div class="print-header-simple">
                    <div class="print-title-row">
                        <span class="print-brand">AUTOCAR BS</span>
                        <span class="print-title">${UI.escapeHtml(tituloDocumento)}</span>
                        <span class="print-date">Emissão: ${new Date().toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="print-info-row">
                        <div class="print-filter-info">
                            <strong>Filtros Ativos:</strong> 
                            Status: <em>${UI.escapeHtml(statusTxt)}</em> | 
                            Tipo: <em>${UI.escapeHtml(tipoTxt)}</em> | 
                            Marca: <em>${UI.escapeHtml(marcaTxt)}</em>
                        </div>
                        <div class="print-summary-info">
                            <strong>SKUs:</strong> ${geral.totalItens} &nbsp;|&nbsp; 
                            <strong>Total Físico:</strong> ${geral.totalUnidadesFisicas} un &nbsp;|&nbsp; 
                            <strong>Capital Investido:</strong> ${this.formatarMoeda(geral.totalCusto)}
                        </div>
                    </div>
                </div>
        `;

        if (this.tipoRelatorio === 'geral') {
            // Documento 1: Visão Geral Executiva
            const margemGeralFmt = (geral.margemMediaGeral || 0).toFixed(1);

            html += `
                <!-- Cards de Indicadores Estratégicos -->
                <div class="print-kpi-grid">
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Capital Investido (Custo)</span>
                        <div class="print-kpi-value">${this.formatarMoeda(geral.totalCusto)}</div>
                        <div class="print-kpi-sub">Total imobilizado em estoque</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Faturamento Projetado</span>
                        <div class="print-kpi-value">${this.formatarMoeda(geral.totalVendaPotencial)}</div>
                        <div class="print-kpi-sub">Venda potencial se liquidado</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Lucro Bruto Estimado</span>
                        <div class="print-kpi-value">${this.formatarMoeda(geral.totalLucroPotencial)}</div>
                        <div class="print-kpi-sub">Markup médio: +${margemGeralFmt}%</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Posição Física Geral</span>
                        <div class="print-kpi-value">${geral.totalUnidadesFisicas} un</div>
                        <div class="print-kpi-sub">${geral.totalItens} produtos (SKUs) cadastrados</div>
                    </div>
                </div>

                <!-- Faixa de Saúde do Estoque -->
                <div class="print-status-strip">
                    <span><strong>${itensOk}</strong> Itens Regulares / Saudáveis (&gt; Mínimo)</span>
                    <span><strong>${itensRepor}</strong> Itens em Ponto de Reposição (&lt; Mínimo)</span>
                    <span><strong>${itensZerados}</strong> Itens com Estoque Zerado (Ruptura)</span>
                </div>

                <!-- Tabela Consolidada por Categoria -->
                <table class="print-clean-table">
                    <colgroup>
                        <col style="width: 4%;">
                        <col style="width: 32%;">
                        <col style="width: 11%;">
                        <col style="width: 11%;">
                        <col style="width: 14%;">
                        <col style="width: 14%;">
                        <col style="width: 14%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="text-align:center;">#</th>
                            <th>Categoria / Tipo de Peça</th>
                            <th style="text-align:center;">SKUs Distintos</th>
                            <th style="text-align:center;">Qtd Estoque</th>
                            <th style="text-align:right;">Capital Investido</th>
                            <th style="text-align:right;">Venda Projetada</th>
                            <th style="text-align:right;">Lucro Estimado</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let totItens = 0, totUn = 0, totCusto = 0, totVenda = 0, totLucro = 0;
            (porTipo || []).forEach((t, idx) => {
                const lucro = t.valorVenda - t.valorCusto;
                totItens += t.itensDistintos;
                totUn += t.unidadesTotais;
                totCusto += t.valorCusto;
                totVenda += t.valorVenda;
                totLucro += lucro;

                html += `
                    <tr>
                        <td style="text-align:center; color:#555;">${idx + 1}</td>
                        <td class="col-desc"><strong>${UI.escapeHtml(t.tipo)}</strong></td>
                        <td style="text-align:center;">${t.itensDistintos}</td>
                        <td style="text-align:center; font-weight:bold;">${t.unidadesTotais} un</td>
                        <td style="text-align:right;">${this.formatarMoeda(t.valorCusto)}</td>
                        <td style="text-align:right;">${this.formatarMoeda(t.valorVenda)}</td>
                        <td style="text-align:right; font-weight:600;">${this.formatarMoeda(lucro)}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="2" style="text-align:right;">TOTAIS CONSOLIDADOS (${(porTipo || []).length} CATEGORIAS):</th>
                            <th style="text-align:center;">${totItens}</th>
                            <th style="text-align:center;">${totUn} un</th>
                            <th style="text-align:right;">${this.formatarMoeda(totCusto)}</th>
                            <th style="text-align:right;">${this.formatarMoeda(totVenda)}</th>
                            <th style="text-align:right;">${this.formatarMoeda(totLucro)}</th>
                        </tr>
                    </tfoot>
                </table>
            `;

        } else if (this.tipoRelatorio === 'tipo') {
            // Documento 2: Relatório Consolidado por Categoria
            html += `
                <table class="print-clean-table">
                    <colgroup>
                        <col style="width: 4%;">
                        <col style="width: 28%;">
                        <col style="width: 10%;">
                        <col style="width: 11%;">
                        <col style="width: 13%;">
                        <col style="width: 13%;">
                        <col style="width: 13%;">
                        <col style="width: 8%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="text-align:center;">#</th>
                            <th>Categoria / Tipo de Peça</th>
                            <th style="text-align:center;">Itens Distintos</th>
                            <th style="text-align:center;">Qtd Estoque</th>
                            <th style="text-align:right;">Custo Total</th>
                            <th style="text-align:right;">Venda Total</th>
                            <th style="text-align:right;">Lucro Previsto</th>
                            <th style="text-align:center;">Markup</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            let totUn = 0, totCusto = 0, totVenda = 0, totItens = 0, totLucro = 0;
            (porTipo || []).forEach((t, idx) => {
                const lucro = t.valorVenda - t.valorCusto;
                const margem = t.valorCusto > 0 ? ((lucro / t.valorCusto) * 100).toFixed(1) : '0.0';
                totItens += t.itensDistintos;
                totUn += t.unidadesTotais;
                totCusto += t.valorCusto;
                totVenda += t.valorVenda;
                totLucro += lucro;
                html += `
                    <tr>
                        <td style="text-align:center; color:#555;">${idx + 1}</td>
                        <td class="col-desc"><strong>${UI.escapeHtml(t.tipo)}</strong></td>
                        <td style="text-align:center;">${t.itensDistintos}</td>
                        <td style="text-align:center; font-weight:bold;">${t.unidadesTotais} un</td>
                        <td style="text-align:right;">${this.formatarMoeda(t.valorCusto)}</td>
                        <td style="text-align:right;">${this.formatarMoeda(t.valorVenda)}</td>
                        <td style="text-align:right; font-weight:600;">${this.formatarMoeda(lucro)}</td>
                        <td style="text-align:center;">${margem}%</td>
                    </tr>
                `;
            });
            const margemGeralTot = totCusto > 0 ? ((totLucro / totCusto) * 100).toFixed(1) : '0.0';
            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="2" style="text-align:right;">TOTAIS GERAIS (${(porTipo || []).length} CATEGORIAS):</th>
                            <th style="text-align:center;">${totItens}</th>
                            <th style="text-align:center;">${totUn} un</th>
                            <th style="text-align:right;">${this.formatarMoeda(totCusto)}</th>
                            <th style="text-align:right;">${this.formatarMoeda(totVenda)}</th>
                            <th style="text-align:right;">${this.formatarMoeda(totLucro)}</th>
                            <th style="text-align:center;">${margemGeralTot}%</th>
                        </tr>
                    </tfoot>
                </table>
            `;
        } else {
            // Documento 3: Analítico por Peça (Detalhado)
            html += `
                <table class="print-clean-table">
                    <colgroup>
                        <col style="width: 3.5%;">
                        <col style="width: 8.5%;">
                        <col style="width: 34%;">
                        <col style="width: 6%;">
                        <col style="width: 11%;">
                        <col style="width: 11%;">
                        <col style="width: 13%;">
                        <col style="width: 13%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="text-align:center;">#</th>
                            <th>Código</th>
                            <th>Produto / Descrição</th>
                            <th style="text-align:center;">Estoque</th>
                            <th style="text-align:right;">Custo Unit.</th>
                            <th style="text-align:right;">Venda Unit.</th>
                            <th style="text-align:right;">Total Custo</th>
                            <th style="text-align:right;">Total Venda</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            let totUn = 0, totCusto = 0, totVenda = 0;
            (produtos || []).forEach((p, idx) => {
                totUn += (p.qtd || 0);
                totCusto += (p.subtotalCusto || 0);
                totVenda += (p.subtotalVenda || 0);
                const descCompleta = `<strong>${UI.escapeHtml(p.tipo)}</strong>${p.modelo ? ' - ' + UI.escapeHtml(p.modelo) : ''} <span style="color:#666; font-size:6.5pt;">(${UI.escapeHtml(p.marca) || 'SEM MARCA'})</span>`;
                const qtdFmt = p.qtd > 0 ? `<strong>${p.qtd}</strong>` : `<span style="color:#888;">0</span>`;
                const codFmt = p.codigo ? UI.escapeHtml(p.codigo) : `<span style="color:#bbb;">-</span>`;
                html += `
                    <tr>
                        <td style="text-align:center; color:#555;">${idx + 1}</td>
                        <td style="font-family:monospace; font-weight:600;">${codFmt}</td>
                        <td class="col-desc">${descCompleta}</td>
                        <td style="text-align:center;">${qtdFmt}</td>
                        <td style="text-align:right;">${this.formatarMoeda(p.compraUnit)}</td>
                        <td style="text-align:right;">${this.formatarMoeda(p.vendaUnit)}</td>
                        <td style="text-align:right;">${this.formatarMoeda(p.subtotalCusto)}</td>
                        <td style="text-align:right; font-weight:600;">${this.formatarMoeda(p.subtotalVenda)}</td>
                    </tr>
                `;
            });
            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3" style="text-align:right;">TOTAIS GERAIS (${(produtos || []).length} ITENS):</th>
                            <th style="text-align:center;">${totUn} un</th>
                            <th>-</th>
                            <th>-</th>
                            <th style="text-align:right;">${this.formatarMoeda(totCusto)}</th>
                            <th style="text-align:right;">${this.formatarMoeda(totVenda)}</th>
                        </tr>
                    </tfoot>
                </table>
            `;
        }

        html += `
                <!-- Assinaturas Discretas de Conferência -->
                <div class="print-signatures-box">
                    <div class="print-sig-col">
                        <div class="print-sig-line"></div>
                        <span>Conferente / Estoquista</span>
                    </div>
                    <div class="print-sig-col">
                        <div class="print-sig-line"></div>
                        <span>Gerente / Supervisor</span>
                    </div>
                </div>
                <div class="print-footer-note">
                    AutoCar BS ERP - Relatório de Conferência de Estoque | Sistema de Gestão Interna
                </div>
            </div>
        `;

        printArea.innerHTML = html;
    },

    imprimirCurvaABC() {
        if (!this.dadosCurvaABC || !this.dadosCurvaABC.itens || !this.dadosCurvaABC.itens.length) {
            this.calcularCurvaABC();
        }

        const printArea = document.getElementById('relatorio-documento-impressao');
        if (!printArea) return;

        const { resumo, itens } = this.dadosCurvaABC;
        if (!resumo) {
            return UI.toast('Nenhum dado da Curva ABC disponível para impressão.', 'warning');
        }

        const rotuloPeriodo = this.rotuloPeriodoAtivoABC || (this.periodoABC === 'anual' ? 'Anual' : (this.periodoABC === '30dias' ? 'Últimos 30 Dias' : (this.periodoABC === '90dias' ? 'Últimos 90 Dias' : 'Personalizado')));
        const rotuloCriterio = this.criterioABC === 'volume' ? 'Volume de Saídas (Unidades)' : 'Faturamento Bruto (R$)';
        const rotuloVisao = this.visaoABC === 'tipos' ? 'Consolidado por Categoria / Tipo' : 'Detalhamento por Peça';
        const rotuloClasse = this.filtroClasseABC !== 'todos' ? `Filtro: Classe ${this.filtroClasseABC.toUpperCase()}` : 'Todas as Classes (A, B, C)';
        const rotuloFiltroTipo = (this.filtroTipoABC && this.filtroTipoABC !== 'todos') ? ` | Categoria: ${this.filtroTipoABC}` : '';

        // Filtra itens conforme filtro ativo na tela
        let itensFiltrados = itens || [];
        if (this.filtroClasseABC === 'A' || this.filtroClasseABC === 'B' || this.filtroClasseABC === 'C') {
            itensFiltrados = itensFiltrados.filter(x => x.classe === this.filtroClasseABC);
        } else if (this.filtroClasseABC === 'ruptura') {
            itensFiltrados = itensFiltrados.filter(x => x.riscoRuptura);
        }

        let html = `
            <div class="print-sheet">
                <!-- Cabeçalho Oficial -->
                <div class="print-header-simple">
                    <div class="print-title-row">
                        <span class="print-brand">AUTOCAR BS</span>
                        <span class="print-title">RELATÓRIO ESTRATÉGICO - CURVA ABC & GIRO DE PEÇAS</span>
                        <span class="print-date">Emissão: ${new Date().toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="print-info-row">
                        <div class="print-filter-info">
                            <strong>Parâmetros:</strong> 
                            Período: <em>${UI.escapeHtml(rotuloPeriodo)}</em> | 
                            Critério: <em>${UI.escapeHtml(rotuloCriterio)}</em> | 
                            Visão: <em>${UI.escapeHtml(rotuloVisao)}</em> | 
                            <em>${UI.escapeHtml(rotuloClasse + rotuloFiltroTipo)}</em>
                        </div>
                        <div class="print-summary-info">
                            <strong>Itens:</strong> ${resumo.total.count} &nbsp;|&nbsp; 
                            <strong>Saídas:</strong> ${resumo.total.unidades} un &nbsp;|&nbsp; 
                            <strong>Receita:</strong> ${this.formatarMoeda(resumo.total.valor)}
                        </div>
                    </div>
                </div>

                <!-- Cards de Resumo Pareto -->
                <div class="print-kpi-grid">
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Classe A (Prioridade Máxima)</span>
                        <div class="print-kpi-value">${this.formatarMoeda(resumo.classeA.valor)}</div>
                        <div class="print-kpi-sub">${resumo.classeA.percValor.toFixed(1)}% receita | ${resumo.classeA.count} itens (${resumo.classeA.unidades} un)</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Classe B (Intermediário)</span>
                        <div class="print-kpi-value">${this.formatarMoeda(resumo.classeB.valor)}</div>
                        <div class="print-kpi-sub">${resumo.classeB.percValor.toFixed(1)}% receita | ${resumo.classeB.count} itens (${resumo.classeB.unidades} un)</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Classe C (Baixo Giro)</span>
                        <div class="print-kpi-value">${this.formatarMoeda(resumo.classeC.valor)}</div>
                        <div class="print-kpi-sub">${resumo.classeC.percValor.toFixed(1)}% receita | ${resumo.classeC.count} itens (${resumo.classeC.unidades} un)</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Total Movimentado & Ruptura</span>
                        <div class="print-kpi-value">${this.formatarMoeda(resumo.total.valor)}</div>
                        <div class="print-kpi-sub">${resumo.total.unidades} un totais | Ruptura: ${resumo.total.riscoRuptura} itens em risco</div>
                    </div>
                </div>
        `;

        if (this.visaoABC === 'tipos') {
            html += `
                <table class="print-clean-table">
                    <colgroup>
                        <col style="width: 5%;">
                        <col style="width: 7%;">
                        <col style="width: 32%;">
                        <col style="width: 10%;">
                        <col style="width: 10%;">
                        <col style="width: 10%;">
                        <col style="width: 14%;">
                        <col style="width: 6%;">
                        <col style="width: 6%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="text-align:center;">#</th>
                            <th style="text-align:center;">Classe</th>
                            <th>Categoria / Tipo de Peça</th>
                            <th style="text-align:center;">Produtos</th>
                            <th style="text-align:center;">Ruptura</th>
                            <th style="text-align:center;">Qtd Saídas</th>
                            <th style="text-align:right;">Receita Gerada</th>
                            <th style="text-align:right;">% Part.</th>
                            <th style="text-align:right;">% Acum.</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let totSaidas = 0, totFat = 0, totProds = 0;
            itensFiltrados.forEach((item, idx) => {
                totSaidas += item.saidasNum;
                totFat += item.faturamento;
                totProds += item.produtosCount;
                const pillClass = item.classe.toLowerCase();
                const rupturaTxt = item.itensRuptura > 0 ? `<span style="font-weight:bold; color:#000;">${item.itensRuptura} em falta</span>` : `<span style="color:#666;">Regular</span>`;
                html += `
                    <tr>
                        <td style="text-align:center; color:#555;">${idx + 1}</td>
                        <td style="text-align:center;"><span class="print-abc-pill ${pillClass}">CLASSE ${item.classe}</span></td>
                        <td class="col-desc"><strong>${UI.escapeHtml(item.tipo)}</strong></td>
                        <td style="text-align:center;">${item.produtosCount}</td>
                        <td style="text-align:center;">${rupturaTxt}</td>
                        <td style="text-align:center; font-weight:bold;">${item.saidasNum} un</td>
                        <td style="text-align:right; font-weight:600;">${this.formatarMoeda(item.faturamento)}</td>
                        <td style="text-align:right;">${item.percIndividual.toFixed(1)}%</td>
                        <td style="text-align:right; font-weight:bold;">${item.percAcumulado.toFixed(1)}%</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3" style="text-align:right;">TOTAIS (${itensFiltrados.length} CATEGORIAS):</th>
                            <th style="text-align:center;">${totProds}</th>
                            <th>-</th>
                            <th style="text-align:center;">${totSaidas} un</th>
                            <th style="text-align:right;">${this.formatarMoeda(totFat)}</th>
                            <th colspan="2" style="text-align:right;">100.0%</th>
                        </tr>
                    </tfoot>
                </table>
            `;
        } else {
            html += `
                <table class="print-clean-table">
                    <colgroup>
                        <col style="width: 4%;">
                        <col style="width: 6.5%;">
                        <col style="width: 9%;">
                        <col style="width: 31.5%;">
                        <col style="width: 10%;">
                        <col style="width: 6.5%;">
                        <col style="width: 6.5%;">
                        <col style="width: 7%;">
                        <col style="width: 11%;">
                        <col style="width: 4%;">
                        <col style="width: 4%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="text-align:center;">#</th>
                            <th style="text-align:center;">Classe</th>
                            <th>Código</th>
                            <th>Produto / Especificação</th>
                            <th>Marca</th>
                            <th style="text-align:center;">Estoque</th>
                            <th style="text-align:center;">Mínimo</th>
                            <th style="text-align:center;">Saídas</th>
                            <th style="text-align:right;">Receita (R$)</th>
                            <th style="text-align:right;">%</th>
                            <th style="text-align:right;">%Ac</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let totSaidas = 0, totFat = 0, totEstoque = 0;
            itensFiltrados.forEach((item, idx) => {
                totSaidas += item.saidasNum;
                totFat += item.faturamento;
                totEstoque += item.qtdNum;
                const pillClass = item.classe.toLowerCase();
                const descCompleta = `<strong>${UI.escapeHtml(item.tipo)}</strong>${item.modelo ? ' ' + UI.escapeHtml(item.modelo) : ''}`;
                const codFmt = item.codigo ? UI.escapeHtml(item.codigo) : '-';
                const alertaRuptura = item.riscoRuptura ? `<span class="print-abc-pill ruptura" style="margin-left:3px;" title="Estoque abaixo do mínimo">RUPTURA</span>` : '';

                html += `
                    <tr>
                        <td style="text-align:center; color:#555;">${idx + 1}</td>
                        <td style="text-align:center;"><span class="print-abc-pill ${pillClass}">CLASSE ${item.classe}</span></td>
                        <td style="font-family:monospace; font-weight:600;">${codFmt}</td>
                        <td class="col-desc">${descCompleta}${alertaRuptura}</td>
                        <td>${UI.escapeHtml(item.marca || '-')}</td>
                        <td style="text-align:center; font-weight:bold;">${item.qtdNum}</td>
                        <td style="text-align:center; color:#555;">${item.minimoNum}</td>
                        <td style="text-align:center; font-weight:bold;">${item.saidasNum} un</td>
                        <td style="text-align:right; font-weight:600;">${this.formatarMoeda(item.faturamento)}</td>
                        <td style="text-align:right;">${item.percIndividual.toFixed(1)}%</td>
                        <td style="text-align:right; font-weight:bold;">${item.percAcumulado.toFixed(1)}%</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="5" style="text-align:right;">TOTAIS (${itensFiltrados.length} ITENS):</th>
                            <th style="text-align:center;">${totEstoque}</th>
                            <th>-</th>
                            <th style="text-align:center;">${totSaidas} un</th>
                            <th style="text-align:right;">${this.formatarMoeda(totFat)}</th>
                            <th colspan="2" style="text-align:right;">100.0%</th>
                        </tr>
                    </tfoot>
                </table>
            `;
        }

        html += `
                <!-- Assinaturas Estratégicas -->
                <div class="print-signatures-box">
                    <div class="print-sig-col">
                        <div class="print-sig-line"></div>
                        <span>Analista / Responsável pelo Estoque</span>
                    </div>
                    <div class="print-sig-col">
                        <div class="print-sig-line"></div>
                        <span>Gerente / Diretor de Operações</span>
                    </div>
                </div>
                <div class="print-footer-note">
                    AutoCar BS ERP - Análise de Giro e Priorização Curva ABC | Sistema de Gestão Interna
                </div>
            </div>
        `;

        printArea.innerHTML = html;
        window.print();
    },

    imprimirReposicao() {
        let baixos = this.listaStats.reposicao || [];
        if (this.termoBuscaReposicao) {
            baixos = baixos.filter(p => `${p.tipo} ${p.modelo || ''} ${p.marca || ''} ${p.codigo || ''}`.toLowerCase().includes(this.termoBuscaReposicao));
        }

        if (baixos.length === 0) {
            return UI.toast('Nenhum item necessitando de reposição no momento.', 'info');
        }

        const printArea = document.getElementById('relatorio-documento-impressao');
        if (!printArea) return;

        const totalItensRepor = baixos.length;
        const itensZerados = baixos.filter(p => (Number(p.qtd) || 0) <= 0).length;
        const totalUnidadesComprar = baixos.reduce((acc, p) => acc + Math.max(0, (Number(p.minimo) || 0) - (Number(p.qtd) || 0)), 0);
        const totalInvestimentoPrevisto = baixos.reduce((acc, p) => {
            const deficit = Math.max(0, (Number(p.minimo) || 0) - (Number(p.qtd) || 0));
            const custo = Number(p.compra || p.compraUnit || 0);
            return acc + (deficit * custo);
        }, 0);

        let html = `
            <div class="print-sheet">
                <!-- Cabeçalho Oficial -->
                <div class="print-header-simple">
                    <div class="print-title-row">
                        <span class="print-brand">AUTOCAR BS</span>
                        <span class="print-title">ORDEM DE COMPRA & REPOSIÇÃO DE ESTOQUE</span>
                        <span class="print-date">Emissão: ${new Date().toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="print-info-row">
                        <div class="print-filter-info">
                            <strong>Finalidade:</strong> 
                            <em>Reposição Urgente de Peças com Saldo Abaixo do Ponto Mínimo de Segurança</em>
                        </div>
                        <div class="print-summary-info">
                            <strong>Itens a Comprar:</strong> ${totalItensRepor} SKUs &nbsp;|&nbsp; 
                            <strong>Volume Total:</strong> ${totalUnidadesComprar} un &nbsp;|&nbsp; 
                            <strong>Custo Previsto:</strong> ${this.formatarMoeda(totalInvestimentoPrevisto)}
                        </div>
                    </div>
                </div>

                <!-- Cards de Resumo da Compra -->
                <div class="print-kpi-grid">
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Itens com Déficit (SKUs)</span>
                        <div class="print-kpi-value">${totalItensRepor} produtos</div>
                        <div class="print-kpi-sub">Abaixo do estoque mínimo</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Itens Totalmente Zerados</span>
                        <div class="print-kpi-value">${itensZerados} produtos</div>
                        <div class="print-kpi-sub">Ruptura imediata de estoque</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Volume Total a Adquirir</span>
                        <div class="print-kpi-value">${totalUnidadesComprar} unidades</div>
                        <div class="print-kpi-sub">Quantidade física de reposição</div>
                    </div>
                    <div class="print-kpi-card">
                        <span class="print-kpi-label">Investimento Total Estimado</span>
                        <div class="print-kpi-value">${this.formatarMoeda(totalInvestimentoPrevisto)}</div>
                        <div class="print-kpi-sub">Baseado no último custo unitário</div>
                    </div>
                </div>

                <!-- Tabela de Ordem de Compra -->
                <table class="print-clean-table">
                    <colgroup>
                        <col style="width: 3.5%;">
                        <col style="width: 9%;">
                        <col style="width: 32.5%;">
                        <col style="width: 10%;">
                        <col style="width: 7%;">
                        <col style="width: 7%;">
                        <col style="width: 8%;">
                        <col style="width: 9%;">
                        <col style="width: 10%;">
                        <col style="width: 4%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="text-align:center;">#</th>
                            <th>Código</th>
                            <th>Produto / Especificação</th>
                            <th>Marca</th>
                            <th style="text-align:center;">Atual</th>
                            <th style="text-align:center;">Mínimo</th>
                            <th style="text-align:center;">Comprar</th>
                            <th style="text-align:right;">Custo Unit.</th>
                            <th style="text-align:right;">Subtotal</th>
                            <th style="text-align:center;">Conf.</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        baixos.forEach((p, idx) => {
            const qtd = Number(p.qtd) || 0;
            const minimo = Number(p.minimo) || 0;
            const faltam = Math.max(0, minimo - qtd);
            const custo = Number(p.compra || p.compraUnit || 0);
            const subtotal = faltam * custo;

            const desc = `<strong>${UI.escapeHtml(p.tipo || '')}</strong>${p.modelo ? ' ' + UI.escapeHtml(p.modelo) : ''}`;
            const codFmt = p.codigo ? UI.escapeHtml(p.codigo) : '-';
            const marcaFmt = p.marca ? UI.escapeHtml(p.marca) : '-';
            const zeroTag = qtd <= 0 ? `<span class="print-abc-pill ruptura" style="margin-left:3px;">ZERADO</span>` : '';

            html += `
                <tr>
                    <td style="text-align:center; color:#555;">${idx + 1}</td>
                    <td style="font-family:monospace; font-weight:600;">${codFmt}</td>
                    <td class="col-desc">${desc}${zeroTag}</td>
                    <td>${marcaFmt}</td>
                    <td style="text-align:center; ${qtd <= 0 ? 'font-weight:900; color:#000;' : ''}">${qtd} un</td>
                    <td style="text-align:center; color:#555;">${minimo} un</td>
                    <td style="text-align:center; font-weight:900; background:#f3f4f6;">+${faltam} un</td>
                    <td style="text-align:right;">${this.formatarMoeda(custo)}</td>
                    <td style="text-align:right; font-weight:700;">${this.formatarMoeda(subtotal)}</td>
                    <td style="text-align:center; font-size:9pt;">[ &nbsp; ]</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="4" style="text-align:right;">TOTAIS DA ORDEM DE COMPRA (${totalItensRepor} ITENS):</th>
                            <th>-</th>
                            <th>-</th>
                            <th style="text-align:center; font-weight:900;">${totalUnidadesComprar} un</th>
                            <th>-</th>
                            <th style="text-align:right; font-weight:900;">${this.formatarMoeda(totalInvestimentoPrevisto)}</th>
                            <th></th>
                        </tr>
                    </tfoot>
                </table>

                <!-- Assinaturas da Ordem de Compra -->
                <div class="print-signatures-box">
                    <div class="print-sig-col">
                        <div class="print-sig-line"></div>
                        <span>Comprador / Solicitante</span>
                    </div>
                    <div class="print-sig-col">
                        <div class="print-sig-line"></div>
                        <span>Aprovação Gerência / Diretoria</span>
                    </div>
                </div>
                <div class="print-footer-note">
                    AutoCar BS ERP - Ordem de Compra & Reposição de Estoque | Sistema de Gestão Interna
                </div>
            </div>
        `;

        printArea.innerHTML = html;
        window.print();
    },

    // =========================================================
    // LEITOR DE CÓDIGO DE BARRAS (CÂMERA & LEITOR USB/HID)
    // =========================================================

    /**
     * Emite um beep audível de confirmação (1800Hz clássico de PDV)
     * Utiliza Web Audio API sem dependências externas.
     */
    tocarBeepScanner() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            if (!this.scannerAudioCtx) {
                this.scannerAudioCtx = new AudioContext();
            }
            if (this.scannerAudioCtx.state === 'suspended') {
                this.scannerAudioCtx.resume();
            }
            const osc = this.scannerAudioCtx.createOscillator();
            const gain = this.scannerAudioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, this.scannerAudioCtx.currentTime);
            gain.gain.setValueAtTime(0.18, this.scannerAudioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.scannerAudioCtx.currentTime + 0.09);
            osc.connect(gain);
            gain.connect(this.scannerAudioCtx.destination);
            osc.start();
            osc.stop(this.scannerAudioCtx.currentTime + 0.09);
        } catch (_) {}
    },

    /**
     * Intercepta entradas ultrarrápidas de leitores de código de barras USB/Bluetooth
     */
    iniciarLeitorTecladoUSB() {
        let buffer = '';
        let lastKeyTime = 0;

        window.addEventListener('keydown', (e) => {
            const now = Date.now();
            const diff = now - lastKeyTime;
            lastKeyTime = now;

            const target = e.target;
            const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

            // Leitores físicos de código de barras digitam em alta velocidade (< 85ms entre teclas)
            if (diff > 85 && buffer.length > 0) {
                buffer = '';
            }

            if (e.key === 'Enter') {
                if (buffer.length >= 3) {
                    const codigoDetectado = buffer.trim();
                    buffer = '';

                    // Se o usuário estiver focado no input de código do cadastro
                    if (isInput && target.id === 'codigo') {
                        this.tocarBeepScanner();
                        UI.toast('Código registrado via Leitor USB!', 'success');
                        return;
                    }

                    e.preventDefault();
                    this.tocarBeepScanner();
                    this.processarCodigoEscaneado(codigoDetectado);
                }
                buffer = '';
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                buffer += e.key;
            }
        });
    },

    /**
     * Abre o modal do scanner por câmera
     * @param {'busca'|'cadastro'} contexto
     */
    async abrirScannerCodigoBarras(contexto = 'busca') {
        this.scannerContexto = contexto;
        this.scannerAtivo = true;

        const manualInput = document.getElementById('scanner-manual-code');
        if (manualInput) manualInput.value = '';

        const modalTitulo = document.getElementById('scanner-modal-titulo');
        const modalSub = document.getElementById('scanner-modal-subtitle');
        if (modalTitulo && modalSub) {
            if (contexto === 'cadastro') {
                modalTitulo.innerText = 'ESCANEAR PARA CADASTRO';
                modalSub.innerText = 'Aponte a câmera para o código de barras da nova peça';
            } else {
                modalTitulo.innerText = 'LEITOR DE CÓDIGO DE BARRAS';
                modalSub.innerText = 'Aponte a câmera para consultar ou dar movimentação rápida';
            }
        }

        const statusText = document.getElementById('scanner-status-text');
        if (statusText) statusText.innerText = 'Inicializando câmera...';

        UI.abrirModal('modal-barcode-scanner');

        await this.iniciarCameraScanner();
    },

    /**
     * Inicializa stream de vídeo e decodificador com fallback inteligente
     */
    async iniciarCameraScanner() {
        const video = document.getElementById('scanner-video');
        const html5Container = document.getElementById('scanner-html5-view');
        const statusText = document.getElementById('scanner-status-text');

        this.fecharCameraScanner();
        this.scannerAtivo = true;

        // Prioridade 1: BarcodeDetector nativo (Google Chrome / Edge / Android)
        const temBarcodeDetector = ('BarcodeDetector' in window);

        if (temBarcodeDetector && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                if (html5Container) html5Container.style.display = 'none';
                if (video) video.style.display = 'block';

                const constraints = {
                    video: {
                        facingMode: { ideal: this.scannerCameraFacing },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.scannerStream = stream;

                if (video) {
                    video.srcObject = stream;
                    await video.play();
                }

                // Detecta capacidade de lanterna (Torch)
                const track = stream.getVideoTracks()[0];
                const capabilities = (track && track.getCapabilities) ? track.getCapabilities() : {};
                const btnTorch = document.getElementById('btn-scanner-toggle-torch');
                if (btnTorch) {
                    if (capabilities.torch) {
                        btnTorch.classList.remove('hidden');
                    } else {
                        btnTorch.classList.add('hidden');
                    }
                }

                if (statusText) statusText.innerText = 'Posicione o código no quadro';

                const formats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'];
                const detector = new window.BarcodeDetector({ formats });

                const scanLoop = async () => {
                    if (!this.scannerAtivo) return;

                    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
                        try {
                            const barcodes = await detector.detect(video);
                            if (barcodes && barcodes.length > 0) {
                                const rawValue = barcodes[0].rawValue;
                                if (rawValue && rawValue.trim()) {
                                    this.tocarBeepScanner();
                                    this.fecharScanner();
                                    this.processarCodigoEscaneado(rawValue.trim());
                                    return;
                                }
                            }
                        } catch (_) {}
                    }
                    this.scannerAnimFrame = requestAnimationFrame(scanLoop);
                };

                this.scannerAnimFrame = requestAnimationFrame(scanLoop);
                return;
            } catch (err) {
                console.warn('Falha no BarcodeDetector nativo, tentando biblioteca html5-qrcode:', err);
            }
        }

        // Prioridade 2: Biblioteca html5-qrcode (Fallback universal ZXing)
        if (window.Html5Qrcode && html5Container) {
            try {
                if (video) video.style.display = 'none';
                html5Container.style.display = 'block';
                html5Container.innerHTML = '';

                const html5QrCode = new Html5Qrcode('scanner-html5-view');
                this.scannerHtml5QrCode = html5QrCode;

                const config = {
                    fps: 15,
                    qrbox: { width: 250, height: 140 },
                    aspectRatio: 1.777778
                };

                await html5QrCode.start(
                    { facingMode: this.scannerCameraFacing },
                    config,
                    (decodedText) => {
                        if (decodedText && decodedText.trim() && this.scannerAtivo) {
                            this.tocarBeepScanner();
                            this.fecharScanner();
                            this.processarCodigoEscaneado(decodedText.trim());
                        }
                    },
                    () => {}
                );

                if (statusText) statusText.innerText = 'Posicione o código no quadro';
                return;
            } catch (err) {
                console.warn('Falha na inicialização do html5-qrcode:', err);
            }
        }

        // Se nenhuma câmera estiver acessível
        if (statusText) statusText.innerText = 'Câmera não detectada. Digite abaixo:';
        const manualInput = document.getElementById('scanner-manual-code');
        if (manualInput) {
            setTimeout(() => manualInput.focus(), 150);
        }
    },

    /**
     * Encerra streams e processos de vídeo do scanner
     */
    fecharCameraScanner() {
        this.scannerAtivo = false;

        if (this.scannerAnimFrame) {
            cancelAnimationFrame(this.scannerAnimFrame);
            this.scannerAnimFrame = null;
        }

        if (this.scannerStream) {
            this.scannerStream.getTracks().forEach(track => {
                try { track.stop(); } catch (_) {}
            });
            this.scannerStream = null;
        }

        const video = document.getElementById('scanner-video');
        if (video) {
            video.srcObject = null;
        }

        if (this.scannerHtml5QrCode) {
            try {
                this.scannerHtml5QrCode.stop().catch(() => {}).then(() => {
                    try { this.scannerHtml5QrCode.clear(); } catch (_) {}
                    this.scannerHtml5QrCode = null;
                });
            } catch (_) {
                this.scannerHtml5QrCode = null;
            }
        }

        const html5Container = document.getElementById('scanner-html5-view');
        if (html5Container) {
            html5Container.innerHTML = '';
            html5Container.style.display = 'none';
        }

        this.scannerTorchLigada = false;
        const labelTorch = document.getElementById('label-scanner-torch');
        if (labelTorch) labelTorch.innerText = 'Lanterna';
    },

    /**
     * Fecha o modal do scanner
     */
    fecharScanner() {
        this.fecharCameraScanner();
        UI.fecharModal('modal-barcode-scanner');
    },

    /**
     * Alterna entre câmera frontal e traseira
     */
    async alternarCameraScanner() {
        this.scannerCameraFacing = (this.scannerCameraFacing === 'environment') ? 'user' : 'environment';
        await this.iniciarCameraScanner();
    },

    /**
     * Liga ou desliga a lanterna do smartphone se suportado
     */
    async alternarLanternaScanner() {
        if (!this.scannerStream) return;
        const track = this.scannerStream.getVideoTracks()[0];
        if (!track || !track.applyConstraints) return;

        try {
            this.scannerTorchLigada = !this.scannerTorchLigada;
            await track.applyConstraints({
                advanced: [{ torch: this.scannerTorchLigada }]
            });
            const labelTorch = document.getElementById('label-scanner-torch');
            if (labelTorch) {
                labelTorch.innerText = this.scannerTorchLigada ? 'Desligar Lanterna' : 'Ligar Lanterna';
            }
        } catch (err) {
            console.warn('Erro ao alternar lanterna:', err);
        }
    },

    /**
     * Confirma código inserido manualmente na barra do scanner
     */
    confirmarCodigoManual() {
        const input = document.getElementById('scanner-manual-code');
        const codigo = input ? input.value.trim() : '';
        if (!codigo) {
            return UI.toast('Por favor, digite um código de barras ou referência.', 'warning');
        }
        this.tocarBeepScanner();
        this.fecharScanner();
        this.processarCodigoEscaneado(codigo);
    },

    /**
     * Localiza um produto na memória pelo código
     */
    obterProdutoPorCodigo(codigo) {
        if (!codigo) return null;
        const codNormalizado = String(codigo).trim().toLowerCase();
        return this.listaProdutos.find(x => String(x.codigo || '').trim().toLowerCase() === codNormalizado) ||
               (this.listaStats.reposicao || []).find(x => String(x.codigo || '').trim().toLowerCase() === codNormalizado) ||
               (this.listaStats.ranking || []).find(x => String(x.codigo || '').trim().toLowerCase() === codNormalizado) ||
               (this.rankingPeriodoABC || []).find(x => String(x.codigo || '').trim().toLowerCase() === codNormalizado) ||
               (this.dadosCurvaABC?.itens || []).find(x => String(x.codigo || '').trim().toLowerCase() === codNormalizado) ||
               (this.dadosRelatorio?.produtos || []).find(x => String(x.codigo || '').trim().toLowerCase() === codNormalizado);
    },

    /**
     * Processa o código obtido pela câmera, USB ou digitação
     */
    async processarCodigoEscaneado(codigoRaw) {
        const codigo = String(codigoRaw || '').trim();
        if (!codigo) return;

        // Caso 1: Escaneamento acionado a partir do formulário de cadastro/edição
        if (this.scannerContexto === 'cadastro') {
            const inputCodigo = document.getElementById('codigo');
            if (inputCodigo) {
                inputCodigo.value = codigo;
                inputCodigo.classList.add('highlight-flash');
                setTimeout(() => inputCodigo.classList.remove('highlight-flash'), 1200);
            }
            UI.toast(`Código preenchido: ${codigo}`, 'success');

            const modalCad = document.getElementById('modal-cadastro');
            if (modalCad && modalCad.classList.contains('hidden')) {
                this.abrirModalCadastro();
                if (inputCodigo) inputCodigo.value = codigo;
            }

            const inputTipo = document.getElementById('tipo');
            if (inputTipo && !inputTipo.value) {
                setTimeout(() => inputTipo.focus(), 100);
            }
            return;
        }

        // Caso 2: Escaneamento na busca rápida geral
        let produto = this.obterProdutoPorCodigo(codigo);

        if (!produto) {
            try {
                UI.setLoading(true);
                const res = await API.listarProdutos(1, 10, codigo);
                if (res && res.data && res.data.length > 0) {
                    produto = res.data.find(p => String(p.codigo || '').trim().toLowerCase() === codigo.toLowerCase()) || res.data[0];
                }
            } catch (err) {
                console.warn('Erro na busca por código via API:', err);
            } finally {
                UI.setLoading(false);
            }
        }

        if (produto) {
            // Atualiza input de busca e recarrega visualização
            const inputBusca = document.getElementById('input-busca');
            if (inputBusca) {
                inputBusca.value = codigo;
                const btnClear = document.getElementById('btn-clear-busca');
                if (btnClear) btnClear.classList.remove('hidden');
            }
            this.carregarTabela(1);

            // Exibe modal de ações rápidas
            this.exibirResultadoScanner(produto, codigo);
        } else {
            // Produto não localizado
            this.exibirResultadoScanner(null, codigo);
        }
    },

    /**
     * Exibe o modal de resultado de escaneamento com ações imediatas
     */
    exibirResultadoScanner(produto, codigoBuscado) {
        const container = document.getElementById('scan-result-conteudo');
        const badgeTitulo = document.getElementById('scan-res-titulo');
        if (!container) return;

        if (produto) {
            if (badgeTitulo) {
                badgeTitulo.className = 'scan-result-badge-success';
                badgeTitulo.style.background = '';
                badgeTitulo.style.borderColor = '';
                badgeTitulo.style.color = '';
                badgeTitulo.innerHTML = '<i class="ph ph-check-circle"></i> PRODUTO IDENTIFICADO';
            }

            const qtd = Number(produto.qtd) || 0;
            const minimo = Number(produto.minimo) || 0;
            const statusCor = qtd === 0 ? '#ef4444' : (qtd <= minimo ? '#eab308' : '#22c55e');
            const precoVenda = Number(produto.venda || produto.vendaUnit || produto.precoVenda || 0);

            container.innerHTML = `
                <div class="scan-card-prod">
                    <div class="scan-card-title">${UI.escapeHtml(produto.tipo || 'Produto')} ${UI.escapeHtml(produto.modelo || '')}</div>
                    <div class="scan-card-meta">
                        <strong>CÓD:</strong> ${UI.escapeHtml(produto.codigo || 'S/N')} | <strong>MARCA:</strong> ${UI.escapeHtml(produto.marca || '-')}
                    </div>
                    <div class="scan-card-stats-row">
                        <div class="scan-card-stat-item">
                            <span class="scan-card-stat-label">Saldo Atual</span>
                            <span class="scan-card-stat-val" style="color: ${statusCor};">${qtd} un</span>
                        </div>
                        <div class="scan-card-stat-item">
                            <span class="scan-card-stat-label">Estoque Mín.</span>
                            <span class="scan-card-stat-val">${minimo} un</span>
                        </div>
                        <div class="scan-card-stat-item">
                            <span class="scan-card-stat-label">Preço Venda</span>
                            <span class="scan-card-stat-val" style="color: var(--gold);">${UI.formatCurrency(precoVenda)}</span>
                        </div>
                    </div>
                </div>

                <div class="scan-actions-grid">
                    <button type="button" class="btn btn-primary" onclick="Estoque.fecharModal('modal-scan-resultado'); Estoque.abrirEntrada(${produto.id})">
                        <i class="ph ph-arrow-circle-up"></i>
                        <span>+ Entrada</span>
                    </button>
                    <button type="button" class="btn btn-danger" onclick="Estoque.fecharModal('modal-scan-resultado'); Estoque.abrirSaida(${produto.id})">
                        <i class="ph ph-arrow-circle-down"></i>
                        <span>- Baixa / Saída</span>
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="Estoque.fecharModal('modal-scan-resultado'); Estoque.editarProduto(${produto.id})">
                        <i class="ph ph-pencil-simple"></i>
                        <span>Editar Peça</span>
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="Estoque.fecharModal('modal-scan-resultado')">
                        <i class="ph ph-check"></i>
                        <span>Concluir</span>
                    </button>
                </div>
            `;
        } else {
            if (badgeTitulo) {
                badgeTitulo.className = 'scan-result-badge-success';
                badgeTitulo.style.background = 'rgba(239, 68, 68, 0.15)';
                badgeTitulo.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                badgeTitulo.style.color = '#ef4444';
                badgeTitulo.innerHTML = '<i class="ph ph-x-circle"></i> NÃO ENCONTRADO';
            }

            container.innerHTML = `
                <div class="scan-card-prod" style="border-color: rgba(239, 68, 68, 0.35);">
                    <div style="display:flex; align-items:center; gap:8px; color:#ef4444; font-weight:700; margin-bottom:8px;">
                        <i class="ph ph-warning-circle" style="font-size:1.3rem;"></i>
                        <span>Peça não localizada no estoque</span>
                    </div>
                    <div class="scan-card-meta" style="font-size:0.88rem; color:#f8fafc;">
                        Código lido: <strong style="color:var(--gold);">${UI.escapeHtml(codigoBuscado)}</strong>
                    </div>
                    <p style="font-size:0.78rem; color:var(--text-secondary); margin:8px 0 0 0; line-height:1.4;">
                        Nenhum item com este código de barras foi encontrado no estoque da oficina. Deseja cadastrar este item agora com 1 clique?
                    </p>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button type="button" class="btn btn-primary" onclick="Estoque.fecharModal('modal-scan-resultado'); Estoque.abrirModalCadastroComCodigo('${UI.escapeHtml(codigoBuscado)}')">
                        <i class="ph ph-plus-circle"></i>
                        <span>+ Cadastrar Produto com este Código</span>
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="Estoque.fecharModal('modal-scan-resultado')">
                        <i class="ph ph-x"></i>
                        <span>Fechar</span>
                    </button>
                </div>
            `;
        }

        UI.abrirModal('modal-scan-resultado');
    },

    /**
     * Abre modal de cadastro pré-preenchendo com o código escaneado
     */
    abrirModalCadastroComCodigo(codigo) {
        this.abrirModalCadastro();
        const inputCodigo = document.getElementById('codigo');
        if (inputCodigo) {
            inputCodigo.value = codigo || '';
            inputCodigo.classList.add('highlight-flash');
            setTimeout(() => inputCodigo.classList.remove('highlight-flash'), 1200);
        }
        const inputTipo = document.getElementById('tipo');
        if (inputTipo) {
            setTimeout(() => inputTipo.focus(), 80);
        }
    },

    fecharModal(id) {
        UI.fecharModal(id);
        this.idEdicao = null;
        this.idExclusao = null;
        this.idMovimentacao = null;
    }
};

window.Estoque = Estoque;

