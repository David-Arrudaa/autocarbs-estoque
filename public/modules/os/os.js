/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Ordens de Serviço (os.js)
 * Padrão Visual Enterprise Compacto com Navegação por Subviews
 * =========================================================
 */

const OSModule = {
    paginaAtual: 1,
    limitePorPagina: 15,
    totalRegistros: 0,
    totalPaginas: 1,
    termoBusca: '',
    filtroStatus: 'todos',
    dataInicial: '',
    dataFinal: '',
    idEdicao: null,
    itensPecas: [],
    itensServicos: [],
    debounceTimeout: null,
    inicializado: false,
    ordensCache: [],
    catalogoServicos: [],
    catalogoProdutos: [],
    timerBuscaProdutoRapido: null,
    timerBuscaServicoRapido: null,
    produtoSelecionadoTemp: null,
    servicoSelecionadoTemp: null,
    clientesEncontrados: [],
    timerBuscaCliente: null,
    listenerClickForaRegistrado: false,
    abaFormAtual: 'detalhes',

    /**
     * Inicialização do módulo quando a aba é acessada
     */
    async iniciar() {
        if (!this.inicializado) {
            this.inicializado = true;
            this.mostrarSubview('lista');
        } else {
            this.mostrarSubview('lista');
        }

        if (!this.listenerClickForaRegistrado) {
            this.listenerClickForaRegistrado = true;
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.os-servico-search-container')) {
                    this.fecharTodosDropdownsServicos();
                }
                if (!e.target.closest('.os-cliente-search-container')) {
                    this.fecharDropdownCliente();
                }
                if (!e.target.closest('.os-quick-add-bar')) {
                    this.fecharDropdownsRapidos();
                }
            });
        }

        await Promise.all([
            this.carregar(1),
            this.carregarCatalogoServicos(),
            this.carregarCatalogoProdutos()
        ]);
    },

    /**
     * Ação disparada quando o usuário clica no botão "Ordem de Serviço" na Sidebar:
     * - Retorna sempre para a visualização da listagem de ordens de forma limpa e atualizada.
     */
    async aoClicarMenuOS() {
        if (!this.inicializado) {
            await this.iniciar();
            return;
        }

        const viewCadastro = document.getElementById('view-os-cadastro');
        const estaNoCadastro = viewCadastro && !viewCadastro.classList.contains('hidden');

        if (estaNoCadastro) {
            this.voltarParaLista(false);
        }

        await this.carregar(1);
    },

    async carregarCatalogoServicos() {
        try {
            const res = await API.listarServicos({ limite: 1000, ordenarPor: 'nome', ordem: 'asc' });
            if (res && res.success) {
                this.catalogoServicos = res.servicos || [];
            }
        } catch (_) {}
    },

    async carregarCatalogoProdutos() {
        try {
            const res = await API.listarProdutos(1, 200);
            if (res && res.success && Array.isArray(res.data)) {
                this.catalogoProdutos = res.data;
            }
        } catch (_) {}
    },

    /**
     * Alterna entre a listagem e a página de cadastro/edição
     */
    mostrarSubview(subview) {
        const viewLista = document.getElementById('view-os-lista');
        const viewCadastro = document.getElementById('view-os-cadastro');
        const viewVisualizacao = document.getElementById('view-os-visualizacao');

        if (subview === 'visualizacao') {
            if (viewLista) viewLista.classList.add('hidden');
            if (viewCadastro) viewCadastro.classList.add('hidden');
            if (viewVisualizacao) viewVisualizacao.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (subview === 'cadastro') {
            if (viewLista) viewLista.classList.add('hidden');
            if (viewVisualizacao) viewVisualizacao.classList.add('hidden');
            if (viewCadastro) viewCadastro.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            if (viewCadastro) viewCadastro.classList.add('hidden');
            if (viewVisualizacao) viewVisualizacao.classList.add('hidden');
            if (viewLista) viewLista.classList.remove('hidden');
        }
    },

    voltarParaLista(limpar = false) {
        if (limpar) {
            this.limparFormulario();
        } else {
            this.idEdicao = null;
        }
        this.veioDaVisualizacao = false;
        this.osVisualizandoId = null;
        this.mostrarSubview('lista');
        if (this.ordensCache && this.ordensCache.length > 0) {
            this.renderizarTabela(this.ordensCache);
            this.atualizarPaginacao();
        } else {
            this.carregar();
        }
    },

    voltarDoFormulario() {
        if (this.veioDaVisualizacao && this.osVisualizandoId) {
            this.veioDaVisualizacao = false;
            this.visualizarOS(this.osVisualizandoId);
        } else {
            this.voltarParaLista(true);
        }
    },

    /**
     * Reseta completamente os campos e estados do formulário da OS
     */
    limparFormulario() {
        const hoje = new Date().toISOString().split('T')[0];
        const previsao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        this.idEdicao = null;
        this.itensPecas = [];
        this.itensServicos = [];
        this.setInputValue('os_numero', 'Automático');
        this.setInputValue('os_cliente_id', '');
        this.setInputValue('os_cliente_nome', '');
        this.setInputValue('os_cliente_telefone', '');
        this.setInputValue('os_veiculo_modelo', '');
        this.setInputValue('os_veiculo_ano', '');
        this.setInputValue('os_veiculo_placa', '');
        this.setInputValue('os_veiculo_km', '');
        this.setInputValue('os_veiculo_chassi', '');

        const uLogado = (window.obterUsuarioLogado && window.obterUsuarioLogado()) || window.usuarioLogado || {};
        const nomeResponsavelPadrao = (uLogado.nome ? uLogado.nome.trim().toUpperCase() : '') || 'AUTOCAR BS';
        this.setInputValue('os_responsavel', nomeResponsavelPadrao);

        this.setInputValue('os_data_inicial', hoje);
        this.setInputValue('os_data_final', previsao);
        this.setInputValue('os_status', 'orcamento');
        this.setInputValue('os_termo_garantia', '90 dias');
        this.setInputValue('os_descricao_problema', '');
        this.setInputValue('os_relatorio_tecnico', '');
        this.setInputValue('os_laudo_tecnico', '');
        this.setInputValue('os_valor_desconto', '0,00');
        this.atualizarStatusVinculoCliente(false);
        this.fecharDropdownCliente();

        this.itensPecas = [];
        this.itensServicos = [];
        this.produtoSelecionadoTemp = null;
        this.servicoSelecionadoTemp = null;

        const inpProd = document.getElementById('input-busca-produto-rapido');
        if (inpProd) inpProd.value = '';
        const inpPrecoP = document.getElementById('input-preco-produto-rapido');
        if (inpPrecoP) inpPrecoP.value = '';
        const inpQtdP = document.getElementById('input-qtd-produto-rapido');
        if (inpQtdP) inpQtdP.value = '1';

        const inpServ = document.getElementById('input-busca-servico-rapido');
        if (inpServ) inpServ.value = '';
        const inpPrecoS = document.getElementById('input-preco-servico-rapido');
        if (inpPrecoS) inpPrecoS.value = '';
        const inpQtdS = document.getElementById('input-qtd-servico-rapido');
        if (inpQtdS) inpQtdS.value = '1';

        this.fecharDropdownsRapidos();

        const elDisp = document.getElementById('os_numero_display');
        if (elDisp) elDisp.textContent = 'N° OS: Automático';

        this.renderizarLinhasServicos();
        this.renderizarLinhasPecas();
        this.recalcularTotais();
        this.alternarAbaForm('detalhes');
        this.atualizarBadgesAbas();
        this.atualizarBloqueioAbas();
    },

    /**
     * Alterna entre as abas internas do formulário da OS
     * Impede a troca para as abas de peças, serviços ou relatório caso o nome do cliente esteja vazio.
     */
    alternarAbaForm(aba) {
        const abaNormalizada = (aba === 'laudo') ? 'relatorio' : aba;
        if (abaNormalizada !== 'detalhes') {
            const cliNome = (this.getInputValue('os_cliente_nome') || '').trim();
            if (!cliNome) {
                const inputCli = document.getElementById('os_cliente_nome');
                if (inputCli) {
                    inputCli.focus();
                    inputCli.classList.add('input-error-pulse');
                    setTimeout(() => inputCli.classList.remove('input-error-pulse'), 1600);
                }
                return;
            }
        }

        this.abaFormAtual = abaNormalizada;
        const abas = ['detalhes', 'pecas', 'servicos', 'relatorio'];
        abas.forEach(a => {
            const btn = document.getElementById(`tab-btn-os-${a}`) || (a === 'relatorio' ? document.getElementById('tab-btn-os-laudo') : null);
            const pane = document.getElementById(`tab-pane-os-${a}`) || (a === 'relatorio' ? document.getElementById('tab-pane-os-laudo') : null);
            if (btn) {
                if (a === abaNormalizada) btn.classList.add('active');
                else btn.classList.remove('active');
            }
            if (pane) {
                if (a === abaNormalizada) pane.classList.remove('hidden');
                else pane.classList.add('hidden');
            }
        });
        this.atualizarBadgesAbas();
        this.atualizarBloqueioAbas();
    },

    /**
     * Atualiza o estado visual das abas bloqueadas quando não há cliente preenchido
     */
    atualizarBloqueioAbas() {
        const cliNome = (this.getInputValue('os_cliente_nome') || '').trim();
        const abasSecundarias = ['pecas', 'servicos', 'relatorio'];
        abasSecundarias.forEach(a => {
            const btn = document.getElementById(`tab-btn-os-${a}`) || (a === 'relatorio' ? document.getElementById('tab-btn-os-laudo') : null);
            if (btn) {
                if (!cliNome) {
                    btn.classList.add('tab-os-bloqueada');
                    btn.setAttribute('title', 'Informe o nome do cliente na aba Detalhes para liberar');
                } else {
                    btn.classList.remove('tab-os-bloqueada');
                    btn.removeAttribute('title');
                }
            }
        });
    },

    atualizarBadgesAbas() {
        const badgePecas = document.getElementById('badge-tab-os-pecas');
        const badgeServicos = document.getElementById('badge-tab-os-servicos');
        if (badgePecas) badgePecas.textContent = (this.itensPecas || []).length;
        if (badgeServicos) badgeServicos.textContent = (this.itensServicos || []).length;
    },

    /**
     * Carrega e renderiza a lista de ordens de serviço
     */
    async carregar(pagina = this.paginaAtual) {
        this.paginaAtual = pagina;
        const iconReload = document.getElementById('icon-reload-os');
        if (iconReload) iconReload.classList.add('ph-spin');

        const tbody = document.getElementById('tbody-os');
        // Só exibe spinner de tela cheia se ainda não tivermos nenhum registro em cache
        if (tbody && (!this.ordensCache || this.ordensCache.length === 0)) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 32px; color: var(--text-secondary);">
                        <i class="ph ph-circle-notch ph-spin" style="font-size:1.8rem; color:var(--primary); display:block; margin-bottom:8px;"></i>
                        <span>Carregando ordens de serviço...</span>
                    </td>
                </tr>
            `;
        }

        try {
            const res = await API.listarOS({
                pagina: this.paginaAtual,
                limite: this.limitePorPagina,
                busca: this.termoBusca,
                status: this.filtroStatus,
                dataInicial: this.dataInicial,
                dataFinal: this.dataFinal,
                ordenarPor: 'id',
                ordem: 'desc'
            });

            if (res && res.success) {
                this.ordensCache = res.ordens || [];
                this.totalRegistros = res.total || 0;
                this.totalPaginas = res.totalPaginas || 1;
                this.renderizarTabela(this.ordensCache);
                this.atualizarPaginacao();
            }
        } catch (err) {
            console.error('[OSModule] Erro ao carregar ordens de serviço:', err);
            // Se já tínhamos ordens em cache, mantém a tabela visível sem quebrar a visão do usuário
            if (this.ordensCache && this.ordensCache.length > 0) {
                this.renderizarTabela(this.ordensCache);
                this.atualizarPaginacao();
            } else if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding: 24px; color: var(--danger, #EF4444);">
                            <i class="ph ph-warning-circle" style="font-size:1.6rem; display:block; margin-bottom:6px;"></i>
                            <span>Não foi possível carregar as ordens de serviço. Verifique a conexão.</span>
                            <div style="margin-top: 10px;">
                                <button type="button" class="btn btn-secondary btn-sm" onclick="OSModule.carregar(${this.paginaAtual})">
                                    <i class="ph ph-arrow-clockwise"></i> Tentar novamente
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        } finally {
            if (iconReload) iconReload.classList.remove('ph-spin');
        }
    },

    /**
     * Mapeia status técnico para texto amigável
     */
    obterLabelStatus(status) {
        const mapa = {
            'orcamento': 'Orçamento',
            'aberto': 'Aberto',
            'em_andamento': 'Em Andamento',
            'aguardando_pecas': 'Aguard. Peças',
            'faturado': 'Faturado',
            'finalizado': 'Finalizado',
            'cancelado': 'Cancelado'
        };
        return mapa[status] || status || 'Orçamento';
    },

    formatarDataBR(dataStr) {
        if (!dataStr) return '-';
        const partes = dataStr.split('T')[0].split('-');
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return dataStr;
    },

    /**
     * Renderiza a tabela moderna compacta e limpa de ordens de serviço
     */
    renderizarTabela(ordens) {
        const tbody = document.getElementById('tbody-os');
        if (!tbody) return;

        if (ordens.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 40px 16px; color: var(--text-secondary);">
                        <i class="ph ph-clipboard-text" style="font-size:2.2rem; opacity:0.35; display:block; margin-bottom:8px;"></i>
                        <strong>Nenhuma ordem de serviço encontrada.</strong>
                        <p style="font-size:0.8rem; margin-top:4px; opacity:0.8;">Crie uma nova OS ou altere os filtros de pesquisa e datas.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = ordens.map(os => {
            const numeroOS = String(os.numero || os.id);
            const statusKey = (os.status || 'orcamento').toLowerCase();
            const statusLabel = this.obterLabelStatus(statusKey);
            const valorTotalFormatado = window.UI ? UI.formatarMoeda(os.valor_total || 0) : `R$ ${(os.valor_total || 0).toFixed(2)}`;
            const dataIni = this.formatarDataBR(os.data_inicial);

            const cliNome = os.cliente_nome ? (window.UI ? UI.escapeHtml(os.cliente_nome) : os.cliente_nome) : 'CLIENTE NÃO IDENTIFICADO';
            const modVeiculo = os.veiculo_modelo ? (window.UI ? UI.escapeHtml(os.veiculo_modelo) : os.veiculo_modelo) : '';
            const placaVeiculo = (os.veiculo_placa || '').trim().toUpperCase();
            const placaExibicao = placaVeiculo || (modVeiculo ? modVeiculo : '-');
            const tooltipVeiculo = [modVeiculo, placaVeiculo].filter(Boolean).join(' • ') || 'Veículo não informado';

            return `
                <tr>
                    <td style="text-align:center;">
                        <span class="badge-codigo-os">${numeroOS}</span>
                    </td>
                    <td>
                        <span class="os-cliente-nome-single" title="${cliNome}">${cliNome}</span>
                    </td>
                    <td style="text-align:center;">
                        <span class="os-placa-badge" title="${tooltipVeiculo}">${placaExibicao}</span>
                    </td>
                    <td style="text-align:center;">
                        <span class="os-data-texto">${dataIni}</span>
                    </td>
                    <td style="text-align:right;">
                        <span class="os-valor-total">${valorTotalFormatado}</span>
                    </td>
                    <td style="text-align:center;">
                        <span class="badge-status-os status-${statusKey}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="text-align:right;">
                        <div class="actions-wrapper" style="justify-content:flex-end; gap:4px;">
                            <button class="action-btn btn-action-view" onclick="OSModule.visualizarOS('${os.id}')" title="Visualizar OS Completa">
                                <i class="ph ph-eye"></i>
                            </button>
                            <button class="action-btn btn-action-edit" onclick="OSModule.editarOS('${os.id}')" title="Editar OS">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="action-btn btn-action-print" onclick="OSModule.imprimirOS('${os.id}')" title="Imprimir Ordem de Serviço">
                                <i class="ph ph-printer"></i>
                            </button>
                            <button class="action-btn btn-action-wa" onclick="OSModule.abrirWhatsApp('${os.id}')" title="Enviar WhatsApp ao Cliente">
                                <i class="ph ph-whatsapp-logo"></i>
                            </button>
                            <button class="action-btn btn-action-del" onclick="OSModule.excluirOS('${os.id}', '${numeroOS}')" title="Excluir OS">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Atualiza controles de paginação
     */
    atualizarPaginacao() {
        const counter = document.getElementById('os-pagination-counter');
        const pageInfo = document.getElementById('os-page-info');
        const btnPrev = document.getElementById('btn-os-prev');
        const btnNext = document.getElementById('btn-os-next');

        if (counter) {
            const inicio = this.totalRegistros === 0 ? 0 : (this.paginaAtual - 1) * this.limitePorPagina + 1;
            const fim = Math.min(this.paginaAtual * this.limitePorPagina, this.totalRegistros);
            counter.textContent = `Exibindo ${inicio} - ${fim} de ${this.totalRegistros} ordens`;
        }

        if (pageInfo) {
            pageInfo.textContent = `Página ${this.paginaAtual} de ${this.totalPaginas}`;
        }

        if (btnPrev) btnPrev.disabled = this.paginaAtual <= 1;
        if (btnNext) btnNext.disabled = this.paginaAtual >= this.totalPaginas;
    },

    mudarPagina(delta) {
        const nova = this.paginaAtual + delta;
        if (nova >= 1 && nova <= this.totalPaginas) {
            this.carregar(nova);
        }
    },

    /**
     * Busca com debounce
     */
    pesquisar() {
        const input = document.getElementById('input-busca-os');
        const btnClear = document.getElementById('btn-limpar-busca-os');
        this.termoBusca = (input ? input.value : '').trim();

        if (btnClear) {
            if (this.termoBusca) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }

        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.carregar(1);
        }, 300);
    },

    limparBusca() {
        const input = document.getElementById('input-busca-os');
        const btnClear = document.getElementById('btn-limpar-busca-os');
        if (input) input.value = '';
        if (btnClear) btnClear.classList.add('hidden');
        this.termoBusca = '';
        this.carregar(1);
    },

    filtrarStatus(status) {
        this.filtroStatus = status;
        this.carregar(1);
    },

    filtrarPeriodo() {
        const dtIni = document.getElementById('filtro-data-inicial');
        const dtFim = document.getElementById('filtro-data-final');
        this.dataInicial = dtIni ? dtIni.value : '';
        this.dataFinal = dtFim ? dtFim.value : '';
        this.carregar(1);
    },

    /**
     * =========================================================
     * SUBVIEW 2: FORMULÁRIO COMPLETO DE ORDEM DE SERVIÇO
     * =========================================================
     */
    abrirCadastro() {
        const tituloEl = document.getElementById('os-form-titulo');
        if (tituloEl) {
            tituloEl.innerHTML = `<i class="ph ph-clipboard-text"></i> <span>Nova Ordem de Serviço</span>`;
        }

        this.veioDaVisualizacao = false;
        this.limparFormulario();
        this.mostrarSubview('cadastro');

        setTimeout(() => {
            const inputCli = document.getElementById('os_cliente_nome');
            if (inputCli) inputCli.focus();
        }, 120);
    },

    async editarOS(id) {
        try {
            const res = await API.obterOS(id);
            if (!res || !res.success || !res.os) {
                throw new Error('Não foi possível carregar os detalhes da Ordem de Serviço.');
            }

            const os = res.os;
            this.idEdicao = os.id;
            this.itensPecas = Array.isArray(os.itens_pecas) ? JSON.parse(JSON.stringify(os.itens_pecas)) : [];
            this.itensServicos = Array.isArray(os.itens_servicos) 
                ? os.itens_servicos.map(s => ({
                    servico_id: s.servico_id || null,
                    codigo: s.codigo || '',
                    nome: s.nome || '',
                    preco: Number(s.preco) || 0,
                    subtotal: Number(s.subtotal !== undefined ? s.subtotal : s.preco) || 0,
                    descricao: s.descricao || '',
                    mostrarDescricao: !!(s.descricao && s.descricao.trim()) || !!s.servico_id
                }))
                : [];

            const tituloEl = document.getElementById('os-form-titulo');
            if (tituloEl) {
                tituloEl.innerHTML = `<i class="ph ph-clipboard-text"></i> <span>Editar Ordem de Serviço #${os.numero || os.id}</span>`;
            }

            this.setInputValue('os_numero', os.numero || os.id);
            this.setInputValue('os_cliente_id', os.cliente_id || '');
            this.setInputValue('os_cliente_nome', os.cliente_nome || '');
            this.setInputValue('os_cliente_telefone', os.cliente_telefone || '');
            this.setInputValue('os_veiculo_modelo', os.veiculo_modelo || '');
            this.setInputValue('os_veiculo_ano', os.veiculo_ano || '');
            this.setInputValue('os_veiculo_placa', os.veiculo_placa || '');
            this.setInputValue('os_veiculo_km', os.veiculo_km || '');
            this.setInputValue('os_veiculo_chassi', os.veiculo_chassi || '');

            let respEdicao = (os.criado_por || os.usuario_criacao || os.responsavel || '').trim();
            if (!respEdicao || respEdicao.toUpperCase() === 'AUTOCAR BS') {
                const uLog = (window.obterUsuarioLogado && window.obterUsuarioLogado()) || window.usuarioLogado || {};
                respEdicao = os.usuario_nome || (uLog.nome ? uLog.nome.trim() : '') || 'AUTOCAR BS';
            }
            this.setInputValue('os_responsavel', respEdicao.toUpperCase());

            this.setInputValue('os_data_inicial', os.data_inicial ? os.data_inicial.split('T')[0] : '');
            this.setInputValue('os_data_final', os.data_final ? os.data_final.split('T')[0] : '');
            this.setInputValue('os_status', os.status || 'orcamento');
            this.setInputValue('os_termo_garantia', os.termo_garantia || '90 dias');
            this.setInputValue('os_descricao_problema', os.descricao_problema || '');
            const relatorioCarregado = os.relatorio_tecnico || os.laudo_tecnico || '';
            this.setInputValue('os_relatorio_tecnico', relatorioCarregado);
            this.setInputValue('os_laudo_tecnico', relatorioCarregado);
            this.setInputValue('os_valor_desconto', Number(os.valor_desconto || 0).toFixed(2).replace('.', ','));
            this.atualizarStatusVinculoCliente(!!os.cliente_id);
            this.fecharDropdownCliente();

            const elDisp = document.getElementById('os_numero_display');
            if (elDisp) elDisp.textContent = `N° OS: ${os.numero || os.id}`;

            this.renderizarLinhasServicos();
            this.renderizarLinhasPecas();
            this.recalcularTotais();
            this.alternarAbaForm('detalhes');
            this.atualizarBadgesAbas();
            this.atualizarBloqueioAbas();

            this.mostrarSubview('cadastro');
        } catch (err) {
            if (window.UI) UI.toast(err.message || 'Erro ao carregar OS.', 'error');
        }
    },

    setInputValue(id, valor) {
        const el = document.getElementById(id);
        if (el) el.value = valor !== undefined && valor !== null ? valor : '';
    },

    getInputValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    },

    fecharDropdownsRapidos() {
        const ddProd = document.getElementById('dropdown-produtos-rapido');
        if (ddProd) ddProd.classList.add('hidden');

        const ddServ = document.getElementById('dropdown-servicos-rapido');
        if (ddServ) ddServ.classList.add('hidden');
    },

    fecharTodosDropdownsServicos() {
        this.fecharDropdownsRapidos();
    },

    // ========================================================
    // PEÇAS & INSUMOS (PADRÃO IMAGEM 3 COM BUSCA NO BANCO)
    // ========================================================
    aoFocarBuscaProdutoRapido() {
        const input = document.getElementById('input-busca-produto-rapido');
        const termo = input ? input.value : '';
        if (String(termo || '').trim().length >= 1) {
            this.buscarProdutosRapido(termo);
        }
    },

    aoDigitarBuscaProdutoRapido(termo) {
        clearTimeout(this.timerBuscaProdutoRapido);
        this.produtoSelecionadoTemp = null;
        const q = String(termo || '').trim();
        if (!q) {
            const dd = document.getElementById('dropdown-produtos-rapido');
            if (dd) {
                dd.innerHTML = '';
                dd.classList.add('hidden');
            }
            return;
        }

        this.buscarProdutosRapido(termo);
    },

    async buscarProdutosRapido(termo) {
        const dd = document.getElementById('dropdown-produtos-rapido');
        if (!dd) return;

        const q = String(termo || '').toLowerCase().trim();

        // 1. Filtro instantâneo no catálogo em memória
        let filtrados = (this.catalogoProdutos || []).filter(p => {
            const tipo = String(p.tipo || '').toLowerCase();
            const modelo = String(p.modelo || '').toLowerCase();
            const marca = String(p.marca || '').toLowerCase();
            const cod = String(p.codigo || '').toLowerCase();
            const desc = `${tipo} ${modelo} ${marca}`.trim();
            return desc.includes(q) || cod.includes(q);
        });

        if (filtrados.length > 0) {
            this.renderizarDropdownProdutosRapido(filtrados.slice(0, 15));
        }

        // 2. Consulta debounced no banco de dados
        clearTimeout(this.timerBuscaProdutoRapido);
        this.timerBuscaProdutoRapido = setTimeout(async () => {
            try {
                const res = await API.listarProdutos(1, 25, termo);
                if (res && res.success && Array.isArray(res.data)) {
                    res.data.forEach(novoItem => {
                        if (!this.catalogoProdutos.some(p => p.id === novoItem.id)) {
                            this.catalogoProdutos.push(novoItem);
                        }
                    });
                    this.renderizarDropdownProdutosRapido(res.data.slice(0, 15));
                }
            } catch (_) {}
        }, 220);
    },

    renderizarDropdownProdutosRapido(lista) {
        const dd = document.getElementById('dropdown-produtos-rapido');
        if (!dd) return;

        if (!lista || lista.length === 0) {
            dd.innerHTML = `
                <div class="os-quick-dropdown-empty">
                    Nenhum produto cadastrado com esse nome. Você pode digitar o preço e adicionar como item avulso.
                </div>
            `;
            dd.classList.remove('hidden');
            return;
        }

        dd.innerHTML = lista.map((p, idx) => {
            const tipo = p.tipo || '';
            const modelo = p.modelo || '';
            const marca = p.marca || '';
            const nomeCompleto = `${tipo} ${modelo} ${marca}`.trim() || p.nome || 'PRODUTO';
            const cod = p.codigo ? `[${p.codigo}] ` : '';
            const precoVenda = Number(p.venda || p.vendaUnit || p.precoVenda || p.preco || 0);
            const estoqueQtd = Number(p.qtd || p.estoque || 0);

            return `
                <div 
                    class="os-quick-dropdown-item ${idx === 0 ? 'highlighted' : ''}"
                    onclick="OSModule.selecionarProdutoRapido(${JSON.stringify(p).replace(/"/g, '&quot;')})"
                    data-index="${idx}"
                >
                    <div class="item-main">
                        <div class="item-title">${cod}${window.UI ? UI.escapeHtml(nomeCompleto) : nomeCompleto}</div>
                        <div class="item-subtitle">${p.marca ? p.marca + ' • ' : ''}Estoque: ${estoqueQtd} un.</div>
                    </div>
                    <div class="item-price">R$ ${precoVenda.toFixed(2).replace('.', ',')}</div>
                </div>
            `;
        }).join('');

        dd.classList.remove('hidden');
    },

    selecionarProdutoRapido(p) {
        const tipo = p.tipo || '';
        const modelo = p.modelo || '';
        const marca = p.marca || '';
        const nomeCompleto = (`${tipo} ${modelo} ${marca}`.trim() || p.nome || 'PRODUTO').toUpperCase();
        const precoVenda = Number(p.venda || p.vendaUnit || p.precoVenda || p.preco || 0);

        const inpDesc = document.getElementById('input-busca-produto-rapido');
        const inpPreco = document.getElementById('input-preco-produto-rapido');
        const inpQtd = document.getElementById('input-qtd-produto-rapido');

        if (inpDesc) inpDesc.value = nomeCompleto;
        if (inpPreco) inpPreco.value = precoVenda.toFixed(2).replace('.', ',');
        if (inpQtd && (!inpQtd.value || parseInt(inpQtd.value, 10) <= 0)) inpQtd.value = '1';

        this.produtoSelecionadoTemp = {
            id: p.id,
            codigo: p.codigo || '',
            nome: nomeCompleto,
            preco: precoVenda
        };

        const dd = document.getElementById('dropdown-produtos-rapido');
        if (dd) dd.classList.add('hidden');

        if (inpQtd) inpQtd.focus();
    },

    aoTeclarBuscaProdutoRapido(e) {
        const dd = document.getElementById('dropdown-produtos-rapido');
        if (!dd || dd.classList.contains('hidden')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.adicionarPecaRapida();
            }
            return;
        }

        const items = Array.from(dd.querySelectorAll('.os-quick-dropdown-item'));
        if (items.length === 0) return;

        let currentIndex = items.findIndex(el => el.classList.contains('highlighted'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
            currentIndex = (currentIndex + 1) % items.length;
            items[currentIndex].classList.add('highlighted');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            items[currentIndex].classList.add('highlighted');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const target = currentIndex >= 0 ? items[currentIndex] : items[0];
            if (target) {
                target.click();
            } else {
                this.adicionarPecaRapida();
            }
        } else if (e.key === 'Escape') {
            dd.classList.add('hidden');
        }
    },

    adicionarPecaRapida() {
        const inpDesc = document.getElementById('input-busca-produto-rapido');
        const inpPreco = document.getElementById('input-preco-produto-rapido');
        const inpQtd = document.getElementById('input-qtd-produto-rapido');

        const nome = (inpDesc ? inpDesc.value : '').trim().toUpperCase();
        if (!nome) {
            if (window.UI) UI.toast('Digite ou selecione o nome do produto/peça.', 'warning');
            if (inpDesc) inpDesc.focus();
            return;
        }

        const precoStr = (inpPreco ? inpPreco.value : '').trim();
        const preco = parseFloat(precoStr.replace(/\./g, '').replace(',', '.')) || 0;
        const qtd = Math.max(1, parseInt(inpQtd ? inpQtd.value : 1, 10) || 1);
        const subtotal = qtd * preco;

        this.itensPecas.push({
            produto_id: this.produtoSelecionadoTemp ? this.produtoSelecionadoTemp.id : null,
            codigo: this.produtoSelecionadoTemp ? this.produtoSelecionadoTemp.codigo : '',
            nome: nome,
            qtd: qtd,
            preco: preco,
            subtotal: subtotal
        });

        this.produtoSelecionadoTemp = null;
        if (inpDesc) inpDesc.value = '';
        if (inpPreco) inpPreco.value = '';
        if (inpQtd) inpQtd.value = '1';

        const dd = document.getElementById('dropdown-produtos-rapido');
        if (dd) dd.classList.add('hidden');

        this.renderizarLinhasPecas();
        this.recalcularTotais();

        if (inpDesc) inpDesc.focus();
    },

    adicionarLinhaPeca(item = null) {
        if (item) {
            this.itensPecas.push(item);
            this.renderizarLinhasPecas();
            this.recalcularTotais();
        } else {
            const input = document.getElementById('input-busca-produto-rapido');
            if (input) input.focus();
        }
    },

    removerLinhaPeca(index) {
        this.itensPecas.splice(index, 1);
        this.renderizarLinhasPecas();
        this.recalcularTotais();
    },

    renderizarLinhasPecas() {
        this.atualizarBadgesAbas();
        const tbody = document.getElementById('tbody-itens-pecas');
        if (!tbody) return;

        if (this.itensPecas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:18px; color:#94A3B8; font-size:0.80rem;">
                        Nenhuma peça adicionada. Digite na barra acima para pesquisar no estoque e adicionar.
                    </td>
                </tr>
            `;
            const subTotPecas = document.getElementById('display-subtotal-tabela-pecas');
            if (subTotPecas) subTotPecas.textContent = 'R$ 0,00';
            return;
        }

        let totalPecasCalc = 0;

        tbody.innerHTML = this.itensPecas.map((p, idx) => {
            const qtd = Number(p.qtd || 1);
            const preco = Number(p.preco || 0);
            const subtotal = qtd * preco;
            totalPecasCalc += subtotal;

            return `
                <tr>
                    <td style="font-weight:600; color:#1E293B; text-transform:uppercase;">
                        ${window.UI ? UI.escapeHtml(p.nome || '') : (p.nome || '')}
                    </td>
                    <td style="text-align:center; font-weight:700; color:#334155;">
                        ${qtd}
                    </td>
                    <td style="text-align:right; font-weight:600; color:#334155;">
                        ${preco.toFixed(2).replace('.', ',')}
                    </td>
                    <td style="text-align:center;">
                        <button type="button" class="btn-quick-del" onclick="OSModule.removerLinhaPeca(${idx})" title="Remover peça">
                            <i class="ph ph-trash"></i>
                        </button>
                    </td>
                    <td style="text-align:right; font-weight:700; color:#1E293B;">
                        ${window.UI ? UI.formatarMoeda(subtotal) : `R$ ${subtotal.toFixed(2)}`}
                    </td>
                </tr>
            `;
        }).join('');

        const subTotPecas = document.getElementById('display-subtotal-tabela-pecas');
        if (subTotPecas) subTotPecas.textContent = window.UI ? UI.formatarMoeda(totalPecasCalc) : `R$ ${totalPecasCalc.toFixed(2)}`;
    },

    // ========================================================
    // SERVIÇOS & MÃO DE OBRA (PADRÃO IMAGEM 4 COM BUSCA NO BANCO)
    // ========================================================
    aoFocarBuscaServicoRapido() {
        const input = document.getElementById('input-busca-servico-rapido');
        const termo = input ? input.value : '';
        if (String(termo || '').trim().length >= 1) {
            this.buscarServicosRapido(termo);
        }
    },

    aoDigitarBuscaServicoRapido(termo) {
        clearTimeout(this.timerBuscaServicoRapido);
        this.servicoSelecionadoTemp = null;
        const q = String(termo || '').trim();
        if (!q) {
            const dd = document.getElementById('dropdown-servicos-rapido');
            if (dd) {
                dd.innerHTML = '';
                dd.classList.add('hidden');
            }
            return;
        }

        this.buscarServicosRapido(termo);
    },

    async buscarServicosRapido(termo) {
        const dd = document.getElementById('dropdown-servicos-rapido');
        if (!dd) return;

        const q = String(termo || '').toLowerCase().trim();

        // 1. Filtro instantâneo no catálogo em memória
        let filtrados = (this.catalogoServicos || []).filter(s => {
            const nome = String(s.nome || '').toLowerCase();
            const cod = String(s.codigo || '').toLowerCase();
            return nome.includes(q) || cod.includes(q);
        });

        if (filtrados.length > 0) {
            this.renderizarDropdownServicosRapido(filtrados.slice(0, 15));
        }

        // 2. Consulta debounced no banco de dados
        clearTimeout(this.timerBuscaServicoRapido);
        this.timerBuscaServicoRapido = setTimeout(async () => {
            try {
                const res = await API.listarServicos({ busca: termo, limite: 25 });
                if (res && res.success && Array.isArray(res.servicos)) {
                    res.servicos.forEach(novoItem => {
                        if (!this.catalogoServicos.some(s => s.id === novoItem.id)) {
                            this.catalogoServicos.push(novoItem);
                        }
                    });
                    this.renderizarDropdownServicosRapido(res.servicos.slice(0, 15));
                }
            } catch (_) {}
        }, 220);
    },

    renderizarDropdownServicosRapido(lista) {
        const dd = document.getElementById('dropdown-servicos-rapido');
        if (!dd) return;

        if (!lista || lista.length === 0) {
            dd.innerHTML = `
                <div class="os-quick-dropdown-empty">
                    Nenhum serviço cadastrado com esse nome. Você pode digitar o preço e adicionar como serviço avulso.
                </div>
            `;
            dd.classList.remove('hidden');
            return;
        }

        dd.innerHTML = lista.map((s, idx) => {
            const nome = s.nome || 'SERVIÇO';
            const cod = s.codigo ? `[${s.codigo}] ` : '';
            const preco = Number(s.preco || 0);

            return `
                <div 
                    class="os-quick-dropdown-item ${idx === 0 ? 'highlighted' : ''}"
                    onclick="OSModule.selecionarServicoRapido(${JSON.stringify(s).replace(/"/g, '&quot;')})"
                    data-index="${idx}"
                >
                    <div class="item-main">
                        <div class="item-title">${cod}${window.UI ? UI.escapeHtml(nome) : nome}</div>
                        ${s.categoria ? `<div class="item-subtitle">${s.categoria}</div>` : ''}
                    </div>
                    <div class="item-price">R$ ${preco.toFixed(2).replace('.', ',')}</div>
                </div>
            `;
        }).join('');

        dd.classList.remove('hidden');
    },

    selecionarServicoRapido(s) {
        const nome = String(s.nome || 'SERVIÇO').toUpperCase();
        const preco = Number(s.preco || 0);

        const inpDesc = document.getElementById('input-busca-servico-rapido');
        const inpPreco = document.getElementById('input-preco-servico-rapido');
        const inpQtd = document.getElementById('input-qtd-servico-rapido');

        if (inpDesc) inpDesc.value = nome;
        if (inpPreco) inpPreco.value = preco.toFixed(2).replace('.', ',');
        if (inpQtd && (!inpQtd.value || parseInt(inpQtd.value, 10) <= 0)) inpQtd.value = '1';

        this.servicoSelecionadoTemp = {
            id: s.id,
            codigo: s.codigo || '',
            nome: nome,
            preco: preco,
            descricao: s.descricao || ''
        };

        const dd = document.getElementById('dropdown-servicos-rapido');
        if (dd) dd.classList.add('hidden');

        if (inpQtd) inpQtd.focus();
    },

    aoTeclarBuscaServicoRapido(e) {
        const dd = document.getElementById('dropdown-servicos-rapido');
        if (!dd || dd.classList.contains('hidden')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.adicionarServicoRapido();
            }
            return;
        }

        const items = Array.from(dd.querySelectorAll('.os-quick-dropdown-item'));
        if (items.length === 0) return;

        let currentIndex = items.findIndex(el => el.classList.contains('highlighted'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
            currentIndex = (currentIndex + 1) % items.length;
            items[currentIndex].classList.add('highlighted');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            items[currentIndex].classList.add('highlighted');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const target = currentIndex >= 0 ? items[currentIndex] : items[0];
            if (target) {
                target.click();
            } else {
                this.adicionarServicoRapido();
            }
        } else if (e.key === 'Escape') {
            dd.classList.add('hidden');
        }
    },

    adicionarServicoRapido() {
        const inpDesc = document.getElementById('input-busca-servico-rapido');
        const inpPreco = document.getElementById('input-preco-servico-rapido');
        const inpQtd = document.getElementById('input-qtd-servico-rapido');

        const nome = (inpDesc ? inpDesc.value : '').trim().toUpperCase();
        if (!nome) {
            if (window.UI) UI.toast('Digite ou selecione o nome do serviço.', 'warning');
            if (inpDesc) inpDesc.focus();
            return;
        }

        const precoStr = (inpPreco ? inpPreco.value : '').trim();
        const preco = parseFloat(precoStr.replace(/\./g, '').replace(',', '.')) || 0;
        const qtd = Math.max(1, parseInt(inpQtd ? inpQtd.value : 1, 10) || 1);
        const subtotal = qtd * preco;

        this.itensServicos.push({
            servico_id: this.servicoSelecionadoTemp ? this.servicoSelecionadoTemp.id : null,
            codigo: this.servicoSelecionadoTemp ? this.servicoSelecionadoTemp.codigo : '',
            nome: nome,
            qtd: qtd,
            preco: preco,
            subtotal: subtotal,
            descricao: this.servicoSelecionadoTemp ? this.servicoSelecionadoTemp.descricao : ''
        });

        this.servicoSelecionadoTemp = null;
        if (inpDesc) inpDesc.value = '';
        if (inpPreco) inpPreco.value = '';
        if (inpQtd) inpQtd.value = '1';

        const dd = document.getElementById('dropdown-servicos-rapido');
        if (dd) dd.classList.add('hidden');

        this.renderizarLinhasServicos();
        this.recalcularTotais();

        if (inpDesc) inpDesc.focus();
    },

    adicionarLinhaServico(item = null) {
        if (item) {
            this.itensServicos.push(item);
            this.renderizarLinhasServicos();
            this.recalcularTotais();
        } else {
            const input = document.getElementById('input-busca-servico-rapido');
            if (input) input.focus();
        }
    },

    removerLinhaServico(index) {
        this.itensServicos.splice(index, 1);
        this.renderizarLinhasServicos();
        this.recalcularTotais();
    },

    renderizarLinhasServicos() {
        this.atualizarBadgesAbas();
        const tbody = document.getElementById('tbody-itens-servicos');
        if (!tbody) return;

        if (this.itensServicos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:18px; color:#94A3B8; font-size:0.80rem;">
                        Nenhum serviço adicionado. Digite na barra acima para pesquisar serviços e adicionar.
                    </td>
                </tr>
            `;
            const subTotServicos = document.getElementById('display-subtotal-tabela-servicos');
            if (subTotServicos) subTotServicos.textContent = 'R$ 0,00';
            return;
        }

        let totalServicosCalc = 0;

        tbody.innerHTML = this.itensServicos.map((s, idx) => {
            const qtd = Number(s.qtd || 1);
            const preco = Number(s.preco || 0);
            const subtotal = qtd * preco;
            totalServicosCalc += subtotal;

            return `
                <tr>
                    <td style="font-weight:600; color:#1E293B; text-transform:uppercase;">
                        ${window.UI ? UI.escapeHtml(s.nome || '') : (s.nome || '')}
                    </td>
                    <td style="text-align:center; font-weight:700; color:#334155;">
                        ${qtd}
                    </td>
                    <td style="text-align:right; font-weight:600; color:#334155;">
                        ${preco.toFixed(2).replace('.', ',')}
                    </td>
                    <td style="text-align:center;">
                        <button type="button" class="btn-quick-del" onclick="OSModule.removerLinhaServico(${idx})" title="Remover serviço">
                            <i class="ph ph-trash"></i>
                        </button>
                    </td>
                    <td style="text-align:right; font-weight:700; color:#1E293B;">
                        ${window.UI ? UI.formatarMoeda(subtotal) : `R$ ${subtotal.toFixed(2)}`}
                    </td>
                </tr>
            `;
        }).join('');

        const subTotServicos = document.getElementById('display-subtotal-tabela-servicos');
        if (subTotServicos) subTotServicos.textContent = window.UI ? UI.formatarMoeda(totalServicosCalc) : `R$ ${totalServicosCalc.toFixed(2)}`;
    },

    /**
     * Recalcula os totais (Serviços + Peças - Desconto)
     */
    recalcularTotais() {
        const totalServicos = this.itensServicos.reduce((acc, s) => acc + ((Number(s.qtd) || 1) * (Number(s.preco) || 0)), 0);
        const totalPecas = this.itensPecas.reduce((acc, p) => acc + ((Number(p.qtd) || 1) * (Number(p.preco) || 0)), 0);

        const descStr = this.getInputValue('os_valor_desconto');
        const desconto = parseFloat(descStr.replace(/\./g, '').replace(',', '.')) || 0;
        const totalGeral = Math.max(0, (totalServicos + totalPecas) - desconto);

        const elTotServicos = document.getElementById('display-total-servicos');
        const elTotPecas = document.getElementById('display-total-pecas');
        const elTotGeral = document.getElementById('display-total-geral');

        if (elTotServicos) elTotServicos.textContent = window.UI ? UI.formatarMoeda(totalServicos) : `R$ ${totalServicos.toFixed(2)}`;
        if (elTotPecas) elTotPecas.textContent = window.UI ? UI.formatarMoeda(totalPecas) : `R$ ${totalPecas.toFixed(2)}`;
        if (elTotGeral) elTotGeral.textContent = window.UI ? UI.formatarMoeda(totalGeral) : `R$ ${totalGeral.toFixed(2)}`;

        const subTotPecas = document.getElementById('display-subtotal-tabela-pecas');
        if (subTotPecas) subTotPecas.textContent = window.UI ? UI.formatarMoeda(totalPecas) : `R$ ${totalPecas.toFixed(2)}`;

        const subTotServicos = document.getElementById('display-subtotal-tabela-servicos');
        if (subTotServicos) subTotServicos.textContent = window.UI ? UI.formatarMoeda(totalServicos) : `R$ ${totalServicos.toFixed(2)}`;
    },

    /**
     * Salva a Ordem de Serviço
     */
    async salvar() {
        const clienteNome = this.getInputValue('os_cliente_nome');
        let dataInicial = this.getInputValue('os_data_inicial');

        if (!clienteNome) {
            const el = document.getElementById('os_cliente_nome');
            if (el) {
                el.focus();
                el.classList.add('input-error-pulse');
                setTimeout(() => el.classList.remove('input-error-pulse'), 1600);
            }
            return false;
        }

        if (!dataInicial) {
            dataInicial = new Date().toISOString().split('T')[0];
            this.setInputValue('os_data_inicial', dataInicial);
        }

        const totalServicos = this.itensServicos.reduce((acc, s) => acc + (Number(s.preco) || 0), 0);
        const totalPecas = this.itensPecas.reduce((acc, p) => acc + ((Number(p.qtd) || 1) * (Number(p.preco) || 0)), 0);
        const descStr = this.getInputValue('os_valor_desconto');
        const desconto = parseFloat(descStr.replace(/\./g, '').replace(',', '.')) || 0;
        const totalGeral = Math.max(0, (totalServicos + totalPecas) - desconto);

        const uLogado = (window.obterUsuarioLogado && window.obterUsuarioLogado()) || window.usuarioLogado || {};
        let respSalvar = this.getInputValue('os_responsavel').trim();
        if (!respSalvar || respSalvar.toUpperCase() === 'AUTOCAR BS') {
            respSalvar = (uLogado.nome ? uLogado.nome.trim() : '') || 'AUTOCAR BS';
        }

        let criadorOriginal = null;
        if (this.idEdicao) {
            const osAntiga = this.ordensCache.find(o => String(o.id) === String(this.idEdicao));
            if (osAntiga) {
                criadorOriginal = osAntiga.criado_por || osAntiga.usuario_criacao || (osAntiga.responsavel && osAntiga.responsavel !== 'AUTOCAR BS' ? osAntiga.responsavel : null);
            }
        }
        const respFinal = (criadorOriginal || respSalvar).toUpperCase();

        const payload = {
            id: this.idEdicao,
            cliente_id: this.getInputValue('os_cliente_id') || null,
            cliente_nome: clienteNome,
            cliente_telefone: this.getInputValue('os_cliente_telefone'),
            veiculo_modelo: this.getInputValue('os_veiculo_modelo'),
            veiculo_ano: this.getInputValue('os_veiculo_ano'),
            veiculo_placa: this.getInputValue('os_veiculo_placa'),
            veiculo_km: this.getInputValue('os_veiculo_km'),
            veiculo_chassi: this.getInputValue('os_veiculo_chassi'),
            responsavel: respFinal,
            criado_por: respFinal,
            usuario_criacao: respFinal,
            usuario_id: uLogado.id || null,
            usuario_nome: (uLogado.nome ? uLogado.nome.trim().toUpperCase() : '') || respFinal,
            data_inicial: dataInicial,
            data_final: this.getInputValue('os_data_final'),
            status: this.getInputValue('os_status') || 'orcamento',
            termo_garantia: this.getInputValue('os_termo_garantia') || '90 dias',
            descricao_problema: this.getInputValue('os_descricao_problema'),
            laudo_tecnico: this.getInputValue('os_relatorio_tecnico') || this.getInputValue('os_laudo_tecnico') || '',
            relatorio_tecnico: this.getInputValue('os_relatorio_tecnico') || this.getInputValue('os_laudo_tecnico') || '',
            itens_servicos: this.itensServicos,
            itens_pecas: this.itensPecas,
            valor_servicos: totalServicos,
            valor_pecas: totalPecas,
            valor_desconto: desconto,
            valor_total: totalGeral
        };

        const btnTopo = document.getElementById('btn-salvar-os-topo');
        if (btnTopo) btnTopo.disabled = true;

        try {
            const res = await API.salvarOS(payload);
            if (res && res.success) {
                const idParaVisualizar = (res.os && res.os.id) || this.idEdicao || payload.id;
                const osSalva = res.os || null;
                this.idEdicao = null;
                this.veioDaVisualizacao = false;

                // Atualiza listagem de ordens em segundo plano para manter o cache sincronizado
                this.carregar(this.paginaAtual || 1).catch(() => {});

                if (idParaVisualizar) {
                    await this.visualizarOS(idParaVisualizar, osSalva);
                } else {
                    this.voltarParaLista(false);
                }
                return true;
            } else {
                throw new Error(res.message || 'Erro ao salvar Ordem de Serviço.');
            }
        } catch (err) {
            console.error('Erro ao salvar OS:', err);
            return false;
        } finally {
            if (btnTopo) btnTopo.disabled = false;
        }
    },

    /**
     * Exclui Ordem de Serviço com confirmação
     */
    async excluirOS(id, numero) {
        let confirmar = false;
        if (window.DialogModal && typeof DialogModal.confirm === 'function') {
            confirmar = await DialogModal.confirm(`Tem certeza que deseja excluir a Ordem de Serviço #${numero}? Esta ação não pode ser desfeita.`);
        } else {
            confirmar = window.confirm(`Tem certeza que deseja excluir a Ordem de Serviço #${numero}?`);
        }

        if (!confirmar) return;

        try {
            const res = await API.excluirOS(id);
            if (res && res.success) {
                await this.carregar(this.paginaAtual);
            } else {
                throw new Error(res.mensagem || res.message || 'Erro ao excluir OS.');
            }
        } catch (err) {
            console.error('Erro ao excluir OS:', err);
            if (window.DialogModal && typeof DialogModal.alert === 'function') {
                DialogModal.alert(err.message || 'Erro ao excluir ordem de serviço.');
            } else {
                alert(err.message || 'Erro ao excluir ordem de serviço.');
            }
        }
    },

    /**
     * Disparo ágil de WhatsApp ao Cliente
     */
    async abrirWhatsApp(id) {
        let os = this.ordensCache.find(o => String(o.id) === String(id));
        if (!os || !os.itens_servicos) {
            try {
                const res = await API.obterOS(id);
                if (res && res.os) os = res.os;
            } catch (_) {}
        }
        if (!os) return;

        const numOS = os.numero || os.id;
        const cliNome = (os.cliente_nome || 'Cliente').trim();
        const veiculo = [os.veiculo_modelo, os.veiculo_placa].filter(Boolean).join(' - ') || 'seu veículo';
        const statusLabel = this.obterLabelStatus(os.status);
        const total = window.UI ? UI.formatarMoeda(os.valor_total || 0) : `R$ ${(os.valor_total || 0).toFixed(2)}`;

        const mensagem = [
            `Olá, *${cliNome}*! Tudo bem?`,
            ``,
            `Atualização da *Ordem de Serviço Nº ${numOS}* na oficina *AUTOCAR BS*:`,
            `🚗 *Veículo:* ${veiculo}`,
            `📋 *Status:* ${statusLabel}`,
            `💰 *Valor Total:* ${total}`,
            ``,
            `Dúvidas ou para autorizar serviços, estamos à disposição por aqui! 👍`
        ].join('\n');

        let telefone = String(os.cliente_telefone || '').replace(/\D/g, '');
        if (!telefone) {
            const telInput = window.prompt(`Informe o WhatsApp do cliente ${cliNome} com DDD:`);
            if (!telInput) return;
            telefone = telInput.replace(/\D/g, '');
        }

        if (telefone.length === 10 || telefone.length === 11) {
            telefone = `55${telefone}`;
        }

        const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');
    },

    /**
     * Geração e Impressão de Documento A4 de Ordem de Serviço
     */
    async imprimirOS(id) {
        let os = this.ordensCache.find(o => String(o.id) === String(id));
        if (!os || !os.itens_servicos) {
            try {
                const res = await API.obterOS(id);
                if (res && res.os) os = res.os;
            } catch (_) {}
        }
        if (!os) return;

        let clienteDados = null;
        if (os.cliente_id) {
            try {
                const resCli = await API.obterCliente(os.cliente_id);
                if (resCli && resCli.cliente) clienteDados = resCli.cliente;
            } catch (_) {}
        }

        const container = document.getElementById('relatorio-documento-impressao');
        if (!container) return;

        container.innerHTML = `
            <div class="os-document-sheet" style="box-shadow: none !important; border: none !important; padding: 8mm 10mm !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important;">
                ${this.gerarHTMLDocumentoOS(os, clienteDados)}
            </div>
        `;

        window.print();
    },

    /**
     * =========================================================
     * VISUALIZAÇÃO COMPLETA DA ORDEM DE SERVIÇO (ESTILO PDF/A4)
     * =========================================================
     */
    async visualizarOS(id, osPrecarregada = null) {
        this.osVisualizandoId = id;
        this.mostrarSubview('visualizacao');

        const numTopo = document.getElementById('os-view-num-topo');
        if (numTopo) numTopo.innerText = id;

        const container = document.getElementById('os-view-documento-corpo');
        if (container) {
            container.innerHTML = `
                <div style="padding: 48px; text-align: center; color: #64748B;">
                    <i class="ph ph-circle-notch ph-spin" style="font-size: 2.2rem; color: #2563EB;"></i>
                    <div style="margin-top: 10px; font-weight: 600; font-size: 0.92rem;">Carregando Ordem de Serviço completa...</div>
                </div>
            `;
        }

        let os = osPrecarregada || this.ordensCache.find(o => String(o.id) === String(id));
        if (!os || !os.itens_servicos || !os.itens_pecas) {
            try {
                const res = await API.obterOS(id);
                if (res && res.os) {
                    os = res.os;
                }
            } catch (err) {
                console.warn('Erro ao carregar OS detalhada:', err);
            }
        }

        if (!os) {
            if (container) {
                container.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #EF4444;">
                        <i class="ph ph-warning-circle" style="font-size: 2.2rem;"></i>
                        <p style="margin-top: 8px; font-weight: 700;">Não foi possível carregar os detalhes desta Ordem de Serviço.</p>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="OSModule.voltarParaLista()">Voltar para a Lista</button>
                    </div>
                `;
            }
            return;
        }

        // Tenta obter dados estendidos do cliente caso exista cliente_id
        let clienteDados = null;
        if (os.cliente_id) {
            try {
                const resCli = await API.obterCliente(os.cliente_id);
                if (resCli && resCli.cliente) {
                    clienteDados = resCli.cliente;
                }
            } catch (_) {}
        }

        this.renderizarVisualizacaoOS(os, clienteDados);
    },

    editarOSAtual() {
        if (!this.osVisualizandoId) return;
        this.veioDaVisualizacao = true;
        this.editarOS(this.osVisualizandoId);
    },

    imprimirOSAtual() {
        if (!this.osVisualizandoId) return;
        this.imprimirOS(this.osVisualizandoId);
    },

    abrirWhatsAppAtual() {
        if (!this.osVisualizandoId) return;
        this.abrirWhatsApp(this.osVisualizandoId);
    },

    whatsappOSAtual() {
        this.abrirWhatsAppAtual();
    },

    renderizarVisualizacaoOS(os, clienteDados = null) {
        const container = document.getElementById('os-view-documento-corpo');
        if (!container) return;

        const numeroOS = os.numero || os.id;
        const numTopo = document.getElementById('os-view-num-topo');
        if (numTopo) numTopo.innerText = numeroOS;

        container.innerHTML = this.gerarHTMLDocumentoOS(os, clienteDados);
    },

    /**
     * Gera o HTML padronizado da Ordem de Serviço idêntico ao modelo PDF oficial da AutoCar BS
     */
    gerarHTMLDocumentoOS(os, clienteDados = null) {
        const numeroOS = os.numero || os.id;
        const cliNome = (os.cliente_nome || (clienteDados && clienteDados.nome) || 'Não Informado').toUpperCase();
        const tel = (clienteDados && clienteDados.telefone) || os.cliente_telefone || 'Não informado';

        let cliEndereco = 'Não informado';
        if (clienteDados) {
            const partes = [
                clienteDados.endereco || [clienteDados.logradouro, clienteDados.numero].filter(Boolean).join(', '),
                clienteDados.bairro,
                [clienteDados.cidade, clienteDados.estado].filter(Boolean).join(' - ')
            ].filter(Boolean);
            if (partes.length > 0) cliEndereco = partes.join(', ');
        } else if (os.cliente_endereco) {
            cliEndereco = os.cliente_endereco;
        }

        const cliEmail = (clienteDados && clienteDados.email) || os.cliente_email || 'Não informado';
        const mod = (os.veiculo_modelo || 'Não informado').toUpperCase();
        const placa = (os.veiculo_placa || 'Sem placa').toUpperCase();
        const km = os.veiculo_km || '-';
        const chassi = os.veiculo_chassi || '-';
        const statusLabel = this.obterLabelStatus(os.status);
        const dataIni = this.formatarDataBR(os.data_inicial) || '-';
        const dataFim = this.formatarDataBR(os.data_final) || '-';
        const dataEmissao = this.formatarDataBR(os.data_inicial || os.created_at) || this.formatarDataBR(new Date().toISOString());
        const garantia = os.termo_garantia || '90 dias';

        const servicos = (() => {
            try {
                return Array.isArray(os.itens_servicos) ? os.itens_servicos : (typeof os.itens_servicos === 'string' ? JSON.parse(os.itens_servicos || '[]') : []);
            } catch (_) { return []; }
        })();

        const pecas = (() => {
            try {
                return Array.isArray(os.itens_pecas) ? os.itens_pecas : (typeof os.itens_pecas === 'string' ? JSON.parse(os.itens_pecas || '[]') : []);
            } catch (_) { return []; }
        })();

        const totalPecas = Number(os.valor_pecas || 0);
        const totalServicos = Number(os.valor_servicos || 0);
        const totalDesconto = Number(os.valor_desconto || 0);
        const totalGeral = Number(os.valor_total || (totalPecas + totalServicos - totalDesconto));

        const formatarMoeda = (val) => window.UI ? UI.formatarMoeda(val) : `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const linhasPecas = pecas.length > 0
            ? pecas.map((p, idx) => {
                const qtd = Number(p.qtd || 1);
                const preco = Number(p.preco || 0);
                const subt = qtd * preco;
                const bg = idx % 2 === 1 ? '#FAFBFD' : '#FFFFFF';
                return `
                    <tr style="background: ${bg};">
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: left; vertical-align: top;">
                            <span class="item-nome" style="font-weight: 600; text-transform: uppercase; color: #0F172A;">${window.UI ? UI.escapeHtml(p.nome) : p.nome}</span>
                        </td>
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: center; vertical-align: top; color: #334155;">${qtd}</td>
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: right; vertical-align: top; color: #334155;">${preco.toFixed(2)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: right; vertical-align: top; font-weight: 600; color: #0F172A;">${formatarMoeda(subt)}</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="4" style="text-align: center; color: #64748B; font-style: italic; padding: 10px; border: 1px solid #E2E8F0; background: #FAFBFD;">Nenhum produto discriminado.</td></tr>`;

        const linhasServicos = servicos.length > 0
            ? servicos.map((s, idx) => {
                const qtd = Number(s.qtd || 1);
                const preco = Number(s.preco || 0);
                const subt = qtd * preco;
                const bg = idx % 2 === 1 ? '#FAFBFD' : '#FFFFFF';
                return `
                    <tr style="background: ${bg};">
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: left; vertical-align: top;">
                            <div class="item-nome" style="font-weight: 600; text-transform: uppercase; color: #0F172A;">${window.UI ? UI.escapeHtml(s.nome) : s.nome}</div>
                            ${s.descricao ? `<div class="item-desc" style="font-size: 9px; color: #64748B; margin-top: 2px; font-style: italic; line-height: 1.35;">${window.UI ? UI.escapeHtml(s.descricao) : s.descricao}</div>` : ''}
                        </td>
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: center; vertical-align: top; color: #334155;">${qtd}</td>
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: right; vertical-align: top; color: #334155;">${preco.toFixed(2)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: right; vertical-align: top; font-weight: 600; color: #0F172A;">${formatarMoeda(subt)}</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="4" style="text-align: center; color: #64748B; font-style: italic; padding: 10px; border: 1px solid #E2E8F0; background: #FAFBFD;">Nenhum serviço discriminado.</td></tr>`;

        const uLogadoDoc = (window.obterUsuarioLogado && window.obterUsuarioLogado()) || window.usuarioLogado || {};
        let responsavelNome = (os.criado_por || os.usuario_criacao || (os.responsavel && os.responsavel !== 'AUTOCAR BS' ? os.responsavel : '') || '').trim();
        if (!responsavelNome) {
            responsavelNome = os.usuario_nome || (uLogadoDoc.nome ? uLogadoDoc.nome.trim() : '') || 'AUTOCAR BS';
        }
        responsavelNome = responsavelNome.toUpperCase();

        return `
            <!-- 1. Cabeçalho Empresa & Identificação da OS (3 colunas com acabamento premium) -->
            <div class="os-doc-header" style="display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-start !important; width: 100% !important; margin-bottom: 12px !important;">
                <div class="os-doc-header-logo" style="flex: 0 0 240px; max-width: 250px;">
                    <img src="img/logo-autocar-bs.png" alt="AUTOCAR BS" style="width: 215px; max-width: 100%; height: auto; object-fit: contain; display: block;" />
                    <div class="brand-subtitle-box" style="display: inline-block; background: #FEF2F2; border: 1px solid #FCA5A5; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 800; color: #991B1B; letter-spacing: 0.4px; margin-top: 5px; text-transform: uppercase;">ESPECIALISTAS EM VOLKSWAGEN E AUDI</div>
                    <div class="brand-desc" style="font-size: 7.5px; color: #64748B; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; margin-top: 3px;">MECÂNICA E REVISÕES PREVENTIVAS MULTIMARCAS</div>
                </div>

                <div class="os-doc-header-empresa" style="flex: 1; padding: 0 16px; font-size: 10px; line-height: 1.45; color: #334155;">
                    <div class="empresa-nome" style="font-weight: 800; font-size: 13px; color: #0F172A; margin-bottom: 2px;">AUTOCAR BS</div>
                    <div>CNPJ: 27.259.708/0001-18</div>
                    <div>15 DE NOVEMBRO, 2569 - LOTEAMENTO MODENA - TATUÍ - SP</div>
                    <div>E-mail: autocarbstatui@gmail.com &bull; Fone: (15) 99666-1359</div>
                </div>

                <div class="os-doc-header-meta" style="flex: 0 0 145px; text-align: right;">
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 10px; text-align: right;">
                        <div class="os-num-linha" style="font-weight: 900; font-size: 13px; color: #0F172A; letter-spacing: -0.2px;">N° OS: ${numeroOS}</div>
                        <div class="os-emissao-label" style="margin-top: 3px; font-size: 9.5px; color: #64748B;">Emissão:</div>
                        <div class="os-emissao-data" style="font-weight: 600; font-size: 10px; color: #0F172A;">${dataEmissao}</div>
                    </div>
                </div>
            </div>

            <div class="os-doc-divisor" style="border-bottom: 1px solid #E2E8F0; margin: 10px 0 12px 0;"></div>

            <!-- 2. Dados do Cliente e Responsável (2 colunas lado a lado) -->
            <div class="os-doc-grid-dupla" style="display: flex !important; flex-direction: row !important; justify-content: space-between !important; gap: 20px !important; width: 100% !important; margin-bottom: 12px;">
                <div class="os-doc-col-info" style="flex: 1 1 50%; max-width: 50%; font-size: 10.5px; line-height: 1.45;">
                    <div class="os-doc-col-titulo" style="font-weight: 800; font-size: 10px; color: #64748B; letter-spacing: 0.5px; margin-bottom: 3px; text-transform: uppercase;">CLIENTE</div>
                    <div class="cli-nome" style="font-weight: 800; font-size: 12px; color: #0F172A;">${cliNome}</div>
                    ${cliEndereco && cliEndereco !== 'Não informado' ? `<div style="color: #475569; margin-top: 2px;">${cliEndereco}</div>` : ''}
                    <div style="color: #334155; margin-top: 2px;"><strong>Celular:</strong> ${tel}</div>
                </div>

                <div class="os-doc-col-info" style="flex: 1 1 50%; max-width: 50%; font-size: 10.5px; line-height: 1.45;">
                    <div class="os-doc-col-titulo" style="font-weight: 800; font-size: 10px; color: #64748B; letter-spacing: 0.5px; margin-bottom: 3px; text-transform: uppercase;">RESPONSÁVEL</div>
                    <div class="cli-nome" style="font-weight: 800; font-size: 12px; color: #0F172A;">${responsavelNome}</div>
                </div>
            </div>

            <!-- 3. Parâmetros da OS (Faixa Estilizada) -->
            <div class="os-doc-info-strip" style="display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; width: 100% !important; font-size: 10px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 6px 12px; margin-bottom: 10px;">
                <div><strong style="color: #64748B; font-weight: 700;">STATUS OS:</strong> <span style="font-weight: 700; color: #0F172A; text-transform: uppercase;">${statusLabel}</span></div>
                <div><strong style="color: #64748B; font-weight: 700;">DATA INICIAL:</strong> <span style="font-weight: 600; color: #0F172A;">${dataIni}</span></div>
                <div><strong style="color: #64748B; font-weight: 700;">DATA FINAL:</strong> <span style="font-weight: 600; color: #0F172A;">${dataFim}</span></div>
                <div><strong style="color: #64748B; font-weight: 700;">GARANTIA:</strong> <span style="font-weight: 600; color: #0F172A;">${garantia}</span></div>
            </div>

            <!-- Card dos Dados do Veículo -->
            <div class="os-doc-veiculo-bloco" style="font-size: 10px; line-height: 1.45; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 7px 12px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                    <div><span style="color: #64748B; font-weight: 700;">VEÍCULO:</span> <strong style="font-size: 11.5px; color: #0F172A;">${mod}${os.veiculo_ano ? ` (${os.veiculo_ano})` : ''}</strong></div>
                    <div><span style="color: #64748B; font-weight: 700;">PLACA:</span> <strong style="font-size: 11.5px; color: #0F172A; letter-spacing: 0.5px;">${placa}</strong></div>
                </div>
                <div style="display: flex; gap: 24px; color: #475569;">
                    <div><strong>KM:</strong> ${km}</div>
                    <div><strong>CHASSI:</strong> ${chassi}</div>
                </div>
            </div>

            <!-- Sintomas ou Relatório (se preenchidos) -->
            ${os.descricao_problema ? `
                <div style="font-size: 10px; line-height: 1.4; margin-bottom: 8px; background: #F8FAFC; border-left: 3px solid #CBD5E1; border-radius: 3px; padding: 5px 10px;">
                    <strong style="color: #475569; font-size: 9.5px; text-transform: uppercase;">Sintomas / Reclamação do Cliente:</strong>
                    <div style="margin-top: 2px; color: #0F172A;">${window.UI ? UI.escapeHtml(os.descricao_problema) : os.descricao_problema}</div>
                </div>
            ` : ''}

            ${(os.relatorio_tecnico || os.laudo_tecnico) ? `
                <div style="font-size: 10px; line-height: 1.4; margin-bottom: 10px; background: #F8FAFC; border-left: 3px solid #3B82F6; border-radius: 3px; padding: 5px 10px;">
                    <strong style="color: #1E40AF; font-size: 9.5px; text-transform: uppercase;">Diagnóstico & Relatório Técnico:</strong>
                    <div style="margin-top: 2px; color: #0F172A;">${window.UI ? UI.escapeHtml(os.relatorio_tecnico || os.laudo_tecnico) : (os.relatorio_tecnico || os.laudo_tecnico)}</div>
                </div>
            ` : ''}

            <!-- 4. Tabela de Peças & Produtos -->
            <table class="os-doc-tabela-pdf" style="width: 100% !important; min-width: 0 !important; max-width: 100% !important; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; border: 1px solid #E2E8F0; box-sizing: border-box !important;">
                <thead>
                    <tr style="background: #F1F5F9;">
                        <th style="padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: left; text-transform: uppercase; letter-spacing: 0.3px;">Produto</th>
                        <th style="width: 80px; padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: center; text-transform: uppercase; letter-spacing: 0.3px;">Qtd</th>
                        <th style="width: 100px; padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: right; text-transform: uppercase; letter-spacing: 0.3px;">Preço unit.</th>
                        <th style="width: 105px; padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: right; text-transform: uppercase; letter-spacing: 0.3px;">Sub-total</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasPecas}
                </tbody>
                <tfoot>
                    <tr style="background: #F8FAFC;">
                        <td colspan="4" class="linha-total-tabela" style="padding: 6px 8px; text-align: right; font-weight: 800; font-size: 10.5px; border: 1px solid #E2E8F0; color: #0F172A;">
                            Total Produtos: &nbsp; ${formatarMoeda(totalPecas)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <!-- 5. Tabela de Serviços & Mão de Obra -->
            <table class="os-doc-tabela-pdf" style="width: 100% !important; min-width: 0 !important; max-width: 100% !important; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; border: 1px solid #E2E8F0; box-sizing: border-box !important;">
                <thead>
                    <tr style="background: #F1F5F9;">
                        <th style="padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: left; text-transform: uppercase; letter-spacing: 0.3px;">Serviço</th>
                        <th style="width: 80px; padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: center; text-transform: uppercase; letter-spacing: 0.3px;">Qtd</th>
                        <th style="width: 100px; padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: right; text-transform: uppercase; letter-spacing: 0.3px;">Preço unit.</th>
                        <th style="width: 105px; padding: 6px 8px; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #1E293B; text-align: right; text-transform: uppercase; letter-spacing: 0.3px;">Sub-total</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasServicos}
                </tbody>
                <tfoot>
                    <tr style="background: #F8FAFC;">
                        <td colspan="4" class="linha-total-tabela" style="padding: 6px 8px; text-align: right; font-weight: 800; font-size: 10.5px; border: 1px solid #E2E8F0; color: #0F172A;">
                            Total Serviços: &nbsp; ${formatarMoeda(totalServicos)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <!-- 6. Card de Resumo Financeiro / Valor Total -->
            <div style="display: flex; justify-content: flex-end; width: 100%; margin: 8px 0 16px 0;">
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 8px 16px; min-width: 220px; text-align: right;">
                    ${totalDesconto > 0 ? `<div style="font-size: 10px; font-weight: 600; color: #DC2626; margin-bottom: 2px;">Desconto Aplicado: -${formatarMoeda(totalDesconto)}</div>` : ''}
                    <div style="font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.4px;">Valor Total da OS</div>
                    <div style="font-size: 17px; font-weight: 900; color: #0F172A; letter-spacing: -0.3px; margin-top: 1px;">${formatarMoeda(totalGeral)}</div>
                </div>
            </div>

            <!-- 7. Tabela de Assinaturas (modelo PDF oficial com acabamento refinado) -->
            <table class="os-doc-tabela-assinaturas" style="width: 100% !important; min-width: 0 !important; max-width: 100% !important; border-collapse: collapse; font-size: 10px; border: 1px solid #E2E8F0; margin-top: 10px; box-sizing: border-box !important;">
                <thead>
                    <tr style="background: #F1F5F9;">
                        <th style="width: 16%; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #334155; padding: 5px 8px; text-align: left; text-transform: uppercase; letter-spacing: 0.3px;">Data</th>
                        <th style="width: 42%; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #334155; padding: 5px 8px; text-align: center; text-transform: uppercase; letter-spacing: 0.3px;">Assinatura do Cliente</th>
                        <th style="width: 42%; border: 1px solid #E2E8F0; font-weight: 700; font-size: 9.5px; color: #334155; padding: 5px 8px; text-align: center; text-transform: uppercase; letter-spacing: 0.3px;">Assinatura do Técnico Responsável</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="height: 52px; border: 1px solid #E2E8F0; background: #FFFFFF;"></td>
                        <td style="height: 52px; border: 1px solid #E2E8F0; background: #FFFFFF;"></td>
                        <td style="height: 52px; border: 1px solid #E2E8F0; background: #FFFFFF;"></td>
                    </tr>
                </tbody>
            </table>
        `;
    },

    /**
     * =========================================================
     * INTEGRAÇÃO & AUTOCOMPLETE COM BANCO DE DADOS DE CLIENTES
     * =========================================================
     */
    atualizarStatusVinculoCliente(vinculado) {
        const badge = document.getElementById('os-cliente-vinculado-badge');
        const btnClear = document.getElementById('btn-limpar-cliente-os');
        const nomeInput = document.getElementById('os_cliente_nome');
        const temTexto = !!(nomeInput && nomeInput.value.trim());

        if (badge) {
            if (vinculado) badge.classList.remove('hidden');
            else badge.classList.add('hidden');
        }
        if (btnClear) {
            if (vinculado || temTexto) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }
    },

    fecharDropdownCliente() {
        const dropdown = document.getElementById('dropdown-cliente-results');
        if (dropdown) {
            dropdown.innerHTML = '';
            dropdown.classList.add('hidden');
        }
    },

    aoDigitarCliente(valor) {
        const q = String(valor || '').trim();
        this.atualizarBloqueioAbas();
        const btnClear = document.getElementById('btn-limpar-cliente-os');
        if (btnClear) {
            if (q.length > 0) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }

        if (q.length === 0) {
            this.setInputValue('os_cliente_id', '');
            this.atualizarStatusVinculoCliente(false);
            this.fecharDropdownCliente();
            return;
        }

        // Se o usuário alterar o texto, desmarca o ID do vínculo até ele selecionar um do banco
        const cliIdEl = document.getElementById('os_cliente_id');
        if (cliIdEl && cliIdEl.value) {
            cliIdEl.value = '';
            this.atualizarStatusVinculoCliente(false);
        }

        // Apenas pesquisa a partir de 3 caracteres
        if (q.length < 3) {
            this.fecharDropdownCliente();
            return;
        }

        clearTimeout(this.timerBuscaCliente);
        this.timerBuscaCliente = setTimeout(async () => {
            await this.buscarClientesNoBanco(q);
        }, 220);
    },

    async buscarClientesNoBanco(termo) {
        const dropdown = document.getElementById('dropdown-cliente-results');
        if (!dropdown) return;

        dropdown.innerHTML = `
            <div style="padding: 10px; text-align: center; font-size: 0.76rem; color: #64748B;">
                <i class="ph ph-circle-notch ph-spin" style="margin-right: 4px; color: #2563EB;"></i> Buscando clientes e veículos...
            </div>
        `;
        dropdown.classList.remove('hidden');

        try {
            const res = await API.listarClientes({ busca: termo, limite: 10 });
            if (res && res.success) {
                this.clientesEncontrados = res.clientes || [];
                this.renderizarDropdownClientes(this.clientesEncontrados, termo);
            } else {
                dropdown.innerHTML = `
                    <div style="padding: 8px; font-size: 0.74rem; color: #EF4444; text-align: center;">
                        Falha ao consultar banco de clientes.
                    </div>
                `;
            }
        } catch (err) {
            console.warn('Erro ao buscar clientes no banco:', err);
            dropdown.innerHTML = `
                <div style="padding: 8px; font-size: 0.74rem; color: #94A3B8; text-align: center;">
                    Cliente avulso (pressione Tab para continuar).
                </div>
            `;
        }
    },

    renderizarDropdownClientes(clientes, termo) {
        const dropdown = document.getElementById('dropdown-cliente-results');
        if (!dropdown) return;

        if (!clientes || clientes.length === 0) {
            dropdown.innerHTML = `
                <div style="padding: 10px 12px; font-size: 0.76rem; color: #64748B; text-align: center; line-height: 1.4;">
                    <i class="ph ph-user-plus" style="font-size: 1.1rem; color: #2563EB; display: block; margin-bottom: 3px;"></i>
                    Nenhum cliente cadastrado com "<strong>${window.UI ? UI.escapeHtml(termo) : termo}</strong>".<br>
                    <span style="font-size: 0.70rem; color: #94A3B8;">Você pode continuar preenchendo normalmente como cliente avulso.</span>
                </div>
            `;
            return;
        }

        dropdown.innerHTML = clientes.map((c, idx) => {
            const nomeEsc = window.UI ? UI.escapeHtml(c.nome || '') : (c.nome || '');
            const telEsc = window.UI ? UI.escapeHtml(c.telefone || '') : (c.telefone || '');
            
            // Deduplica veículos por placa para não repetir
            const veiculosOriginais = Array.isArray(c.veiculos) ? c.veiculos : [];
            const placasVistas = new Set();
            const veiculos = [];
            veiculosOriginais.forEach(v => {
                const placaNorm = String(v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                const chave = placaNorm || String(v.modelo || '').trim().toUpperCase();
                if (chave && !placasVistas.has(chave)) {
                    placasVistas.add(chave);
                    veiculos.push(v);
                }
            });
            c._veiculosDeduplicados = veiculos;

            let veiculosHtml = '';
            if (veiculos.length > 0) {
                veiculosHtml = `
                    <div class="os-cri-veiculos-list">
                        ${veiculos.map((v, vIdx) => {
                            const nomeCompletoVeiculo = [v.marca, v.modelo, v.ano].filter(Boolean).join(' ') || (v.modelo || 'Veículo');
                            return `
                                <div class="os-cri-veiculo-card" onclick="event.stopPropagation(); OSModule.selecionarClienteIdx(${idx}, ${vIdx})" title="Vincular este veículo à OS">
                                    <div class="os-cri-veiculo-nome">
                                        <i class="ph-bold ph-car" style="color: #2563EB;"></i>
                                        <span>${window.UI ? UI.escapeHtml(nomeCompletoVeiculo) : nomeCompletoVeiculo}</span>
                                    </div>
                                    <div class="os-cri-veiculo-props">
                                        <span class="os-cri-prop"><strong>PLACA:</strong> <span class="placa-text">${window.UI ? UI.escapeHtml(v.placa || '') : (v.placa || '')}</span></span>
                                        ${v.km ? `<span class="os-cri-prop"><strong>KM:</strong> <span>${window.UI ? UI.escapeHtml(String(v.km)) : v.km}</span></span>` : ''}
                                        ${v.chassi ? `<span class="os-cri-prop"><strong>CHASSI:</strong> <span class="chassi-text">${window.UI ? UI.escapeHtml(v.chassi) : v.chassi}</span></span>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                veiculosHtml = `
                    <div style="font-size: 0.68rem; color: #94A3B8; font-style: italic;">
                        Nenhum veículo vinculado a este cadastro
                    </div>
                `;
            }

            return `
                <div class="os-cliente-result-item" data-idx="${idx}" onclick="OSModule.selecionarClienteIdx(${idx})">
                    <div class="os-cri-header">
                        <span class="os-cri-nome">
                            <i class="ph-bold ph-user-check" style="color: #2563EB;"></i>
                            ${nomeEsc}
                        </span>
                        ${telEsc ? `
                            <span class="os-cri-telefone">
                                <i class="ph ph-whatsapp-logo"></i> ${telEsc}
                            </span>
                        ` : ''}
                    </div>
                    ${veiculosHtml}
                </div>
            `;
        }).join('');
    },

    selecionarClienteIdx(clienteIdx, veiculoIdx = 0) {
        const cliente = this.clientesEncontrados[clienteIdx];
        if (!cliente) return;

        const veiculos = Array.isArray(cliente._veiculosDeduplicados) 
            ? cliente._veiculosDeduplicados 
            : (Array.isArray(cliente.veiculos) ? cliente.veiculos : []);
        const veiculo = veiculos[veiculoIdx] || veiculos[0] || null;

        this.setInputValue('os_cliente_id', cliente.id);
        this.setInputValue('os_cliente_nome', (cliente.nome || '').toUpperCase());
        this.setInputValue('os_cliente_telefone', cliente.telefone || '');

        if (veiculo) {
            const marcaModelo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ').trim().toUpperCase() || (veiculo.modelo || '').toUpperCase();
            this.setInputValue('os_veiculo_modelo', marcaModelo);
            this.setInputValue('os_veiculo_ano', veiculo.ano || '');
            this.setInputValue('os_veiculo_placa', (veiculo.placa || '').toUpperCase());
            this.setInputValue('os_veiculo_km', veiculo.km || '');
            this.setInputValue('os_veiculo_chassi', (veiculo.chassi || '').toUpperCase());
        }

        this.atualizarStatusVinculoCliente(true);
        this.fecharDropdownCliente();
        this.atualizarBloqueioAbas();
    },

    limparClienteSelecionado() {
        this.setInputValue('os_cliente_id', '');
        this.setInputValue('os_cliente_nome', '');
        this.setInputValue('os_cliente_telefone', '');
        this.setInputValue('os_veiculo_modelo', '');
        this.setInputValue('os_veiculo_ano', '');
        this.setInputValue('os_veiculo_placa', '');
        this.setInputValue('os_veiculo_km', '');
        this.setInputValue('os_veiculo_chassi', '');
        this.atualizarStatusVinculoCliente(false);
        this.fecharDropdownCliente();
        this.atualizarBloqueioAbas();

        const input = document.getElementById('os_cliente_nome');
        if (input) input.focus();
    },

    aoTeclarBuscaCliente(e) {
        const dropdown = document.getElementById('dropdown-cliente-results');
        if (!dropdown || dropdown.classList.contains('hidden')) return;

        const items = Array.from(dropdown.querySelectorAll('.os-cliente-result-item'));
        if (items.length === 0) return;

        let currentIndex = items.findIndex(el => el.classList.contains('highlighted'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
            currentIndex = (currentIndex + 1) % items.length;
            items[currentIndex].classList.add('highlighted');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentIndex >= 0) items[currentIndex].classList.remove('highlighted');
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            items[currentIndex].classList.add('highlighted');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentIndex >= 0 && items[currentIndex]) {
                const idx = parseInt(items[currentIndex].getAttribute('data-idx'), 10);
                if (!isNaN(idx)) this.selecionarClienteIdx(idx);
            } else if (items.length > 0) {
                const idx = parseInt(items[0].getAttribute('data-idx'), 10);
                if (!isNaN(idx)) this.selecionarClienteIdx(idx);
            }
        } else if (e.key === 'Escape') {
            this.fecharDropdownCliente();
        }
    }
};

window.OSModule = OSModule;
window.OS = OSModule;
