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
            });
        }

        await Promise.all([
            this.carregar(1),
            this.carregarCatalogoServicos()
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
        this.osVisualizandoId = null;
        this.mostrarSubview('lista');
        if (this.ordensCache && this.ordensCache.length > 0) {
            this.renderizarTabela(this.ordensCache);
            this.atualizarPaginacao();
        } else {
            this.carregar();
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
        this.setInputValue('os_responsavel', 'AUTOCAR BS');
        this.setInputValue('os_data_inicial', hoje);
        this.setInputValue('os_data_final', previsao);
        this.setInputValue('os_status', 'orcamento');
        this.setInputValue('os_termo_garantia', '90 dias');
        this.setInputValue('os_descricao_problema', '');
        this.setInputValue('os_laudo_tecnico', '');
        this.setInputValue('os_valor_desconto', '0,00');
        this.atualizarStatusVinculoCliente(false);
        this.fecharDropdownCliente();

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
     * Impede a troca para as abas de peças, serviços ou laudo caso o nome do cliente esteja vazio.
     */
    alternarAbaForm(aba) {
        if (aba !== 'detalhes') {
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

        this.abaFormAtual = aba;
        const abas = ['detalhes', 'pecas', 'servicos', 'laudo'];
        abas.forEach(a => {
            const btn = document.getElementById(`tab-btn-os-${a}`);
            const pane = document.getElementById(`tab-pane-os-${a}`);
            if (btn) {
                if (a === aba) btn.classList.add('active');
                else btn.classList.remove('active');
            }
            if (pane) {
                if (a === aba) pane.classList.remove('hidden');
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
        const abasSecundarias = ['pecas', 'servicos', 'laudo'];
        abasSecundarias.forEach(a => {
            const btn = document.getElementById(`tab-btn-os-${a}`);
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
            this.setInputValue('os_responsavel', os.responsavel || 'AUTOCAR BS');
            this.setInputValue('os_data_inicial', os.data_inicial ? os.data_inicial.split('T')[0] : '');
            this.setInputValue('os_data_final', os.data_final ? os.data_final.split('T')[0] : '');
            this.setInputValue('os_status', os.status || 'orcamento');
            this.setInputValue('os_termo_garantia', os.termo_garantia || '90 dias');
            this.setInputValue('os_descricao_problema', os.descricao_problema || '');
            this.setInputValue('os_laudo_tecnico', os.laudo_tecnico || '');
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

    /**
     * Itens: Discriminação de Serviços
     */
    adicionarLinhaServico(item = null) {
        this.itensServicos.push(item || {
            servico_id: null,
            codigo: '',
            nome: '',
            preco: 0,
            subtotal: 0,
            descricao: '',
            mostrarDescricao: false
        });
        this.renderizarLinhasServicos();
        this.recalcularTotais();

        // Auto-foco no campo de busca de serviço da nova linha adicionada
        const novoIdx = this.itensServicos.length - 1;
        setTimeout(() => {
            const input = document.getElementById(`input-busca-servico-${novoIdx}`);
            if (input) input.focus();
        }, 60);
    },

    removerLinhaServico(index) {
        this.itensServicos.splice(index, 1);
        this.renderizarLinhasServicos();
        this.recalcularTotais();
    },

    limparServicoLinha(index) {
        if (!this.itensServicos[index]) return;
        this.itensServicos[index].servico_id = null;
        this.itensServicos[index].codigo = '';
        this.itensServicos[index].nome = '';
        this.itensServicos[index].preco = 0;
        this.itensServicos[index].subtotal = 0;
        this.itensServicos[index].descricao = '';
        this.itensServicos[index].mostrarDescricao = false;
        this.fecharTodosDropdownsServicos();
        this.renderizarLinhasServicos();
        this.recalcularTotais();
        setTimeout(() => {
            const input = document.getElementById(`input-busca-servico-${index}`);
            if (input) input.focus();
        }, 50);
    },

    toggleDescricaoServico(index) {
        if (!this.itensServicos[index]) return;
        this.itensServicos[index].mostrarDescricao = !this.itensServicos[index].mostrarDescricao;
        this.renderizarLinhasServicos();
        if (this.itensServicos[index].mostrarDescricao) {
            setTimeout(() => {
                const textarea = document.getElementById(`textarea-servico-desc-${index}`);
                if (textarea) textarea.focus();
            }, 50);
        }
    },

    fecharTodosDropdownsServicos() {
        document.querySelectorAll('.os-servico-results-dropdown').forEach(dd => {
            dd.classList.add('hidden');
        });
    },

    aoFocarBuscaServico(index) {
        const input = document.getElementById(`input-busca-servico-${index}`);
        const termo = input ? input.value : '';
        if (String(termo || '').trim().length >= 3) {
            this.renderizarDropdownServicos(index, termo);
        } else {
            this.fecharTodosDropdownsServicos();
        }
    },

    aoDigitarBuscaServico(index, termo) {
        if (!this.itensServicos[index]) return;
        this.itensServicos[index].nome = termo;
        if (!termo.trim()) {
            this.itensServicos[index].servico_id = null;
        }

        // Atualiza dinamicamente o botão de limpar sem perder foco do input
        const container = document.getElementById(`os-servico-search-container-${index}`);
        if (container) {
            let btnClear = container.querySelector('.btn-clear-servico');
            if (termo.trim()) {
                if (!btnClear) {
                    const wrapper = container.querySelector('.os-servico-input-wrapper');
                    if (wrapper) {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'btn-clear-servico';
                        btn.title = 'Limpar serviço selecionado';
                        btn.onclick = () => OSModule.limparServicoLinha(index);
                        btn.innerHTML = '<i class="ph ph-x"></i>';
                        wrapper.appendChild(btn);
                    }
                }
            } else if (btnClear) {
                btnClear.remove();
            }
        }

        // Exige no mínimo 3 caracteres para disparar a pesquisa e abrir a lista
        const q = String(termo || '').trim();
        if (q.length < 3) {
            const dropdown = document.getElementById(`dropdown-servico-results-${index}`);
            if (dropdown) {
                dropdown.innerHTML = '';
                dropdown.classList.add('hidden');
            }
            return;
        }

        this.renderizarDropdownServicos(index, termo);
    },

    aoTeclarBuscaServico(e, index) {
        const dropdown = document.getElementById(`dropdown-servico-results-${index}`);
        if (!dropdown || dropdown.classList.contains('hidden')) return;

        const items = Array.from(dropdown.querySelectorAll('.os-search-result-item'));
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
                const id = items[currentIndex].getAttribute('data-id');
                if (id) this.selecionarServicoEncontrado(index, id);
            } else if (items.length > 0) {
                const id = items[0].getAttribute('data-id');
                if (id) this.selecionarServicoEncontrado(index, id);
            }
        } else if (e.key === 'Escape') {
            this.fecharTodosDropdownsServicos();
        }
    },

    renderizarDropdownServicos(index, termo) {
        const dropdown = document.getElementById(`dropdown-servico-results-${index}`);
        if (!dropdown) return;

        const q = String(termo || '').toLowerCase().trim();
        // Apenas a partir de 3 caracteres
        if (q.length < 3) {
            dropdown.innerHTML = '';
            dropdown.classList.add('hidden');
            return;
        }

        const lista = (this.catalogoServicos || []).filter(s => {
            const nome = (s.nome || '').toLowerCase();
            const codigo = String(s.codigo || '').toLowerCase();
            return nome.includes(q) || codigo.includes(q);
        });

        lista.sort((a, b) => {
            const aName = (a.nome || '').toLowerCase();
            const bName = (b.nome || '').toLowerCase();
            const aStarts = aName.startsWith(q);
            const bStarts = bName.startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return aName.localeCompare(bName);
        });

        const correspondencias = lista.slice(0, 15);

        if (correspondencias.length === 0) {
            dropdown.innerHTML = `
                <div class="os-search-no-results">
                    <i class="ph ph-magnifying-glass"></i>
                    <span>Nenhum serviço encontrado no catálogo para "<strong>${window.UI ? UI.escapeHtml(termo) : termo}</strong>". Você pode prosseguir com este nome avulso.</span>
                </div>
            `;
            dropdown.classList.remove('hidden');
            return;
        }

        dropdown.innerHTML = correspondencias.map((cat, i) => `
            <div 
                class="os-search-result-item ${i === 0 ? 'highlighted' : ''}" 
                onclick="OSModule.selecionarServicoEncontrado(${index}, ${cat.id})"
                data-id="${cat.id}"
                data-index="${i}"
            >
                <div class="os-sri-left">
                    <div class="os-sri-header">
                        ${cat.codigo ? `<span class="os-sri-badge">[${window.UI ? UI.escapeHtml(cat.codigo) : cat.codigo}]</span>` : ''}
                        <span class="os-sri-nome">${window.UI ? UI.escapeHtml(cat.nome) : cat.nome}</span>
                    </div>
                    ${cat.descricao ? `<div class="os-sri-desc-preview">${window.UI ? UI.escapeHtml(cat.descricao) : cat.descricao}</div>` : ''}
                </div>
                <div class="os-sri-right">
                    <span class="os-sri-price">R$ ${Number(cat.preco || 0).toFixed(2).replace('.', ',')}</span>
                </div>
            </div>
        `).join('');

        dropdown.classList.remove('hidden');
    },

    selecionarServicoEncontrado(index, servicoId) {
        if (!this.itensServicos[index]) return;
        const servico = this.catalogoServicos.find(s => String(s.id) === String(servicoId));
        if (!servico) return;

        this.itensServicos[index].servico_id = servico.id;
        this.itensServicos[index].codigo = servico.codigo || '';
        this.itensServicos[index].nome = servico.nome || '';
        this.itensServicos[index].preco = Number(servico.preco) || 0;
        this.itensServicos[index].subtotal = Number(servico.preco) || 0;
        // Puxa a descrição do catálogo mestre como base para o usuário editar nesta OS (nunca altera o catálogo original)
        this.itensServicos[index].descricao = servico.descricao || '';
        // Abre automaticamente o campo de descrição nesta OS!
        this.itensServicos[index].mostrarDescricao = true;

        this.fecharTodosDropdownsServicos();
        this.renderizarLinhasServicos();
        this.recalcularTotais();
    },

    atualizarLinhaServico(index, campo, valor) {
        if (!this.itensServicos[index]) return;
        if (campo === 'preco') {
            const num = parseFloat(String(valor).replace(/\./g, '').replace(',', '.')) || 0;
            this.itensServicos[index].preco = num;
            this.itensServicos[index].subtotal = num;
        } else {
            this.itensServicos[index][campo] = valor;
        }
        this.recalcularTotais();
    },

    renderizarLinhasServicos() {
        this.atualizarBadgesAbas();
        const tbody = document.getElementById('tbody-itens-servicos');
        if (!tbody) return;

        if (this.itensServicos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center; padding:18px; color:#94A3B8; font-size:0.80rem;">
                        <i class="ph ph-wrench" style="font-size:1.4rem; opacity:0.5; display:block; margin-bottom:4px;"></i>
                        Nenhum serviço adicionado. Clique em "+ Adicionar Serviço" para pesquisar e incluir mão de obra.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.itensServicos.map((s, idx) => `
            <tr>
                <td style="vertical-align:top; padding: 10px 12px;">
                    <!-- Barra de Pesquisa de Serviço (Autocomplete no Catálogo) -->
                    <div class="os-servico-search-container" id="os-servico-search-container-${idx}">
                        <div class="os-servico-input-wrapper">
                            <i class="ph ph-magnifying-glass os-search-icon"></i>
                            <input 
                                type="text" 
                                id="input-busca-servico-${idx}" 
                                class="os-input-busca-servico"
                                placeholder="Buscar serviço por nome ou código (digite mín. 3 letras)..." 
                                value="${window.UI ? UI.escapeHtml(s.nome || '') : (s.nome || '')}"
                                onfocus="OSModule.aoFocarBuscaServico(${idx})"
                                oninput="OSModule.aoDigitarBuscaServico(${idx}, this.value)"
                                onkeydown="OSModule.aoTeclarBuscaServico(event, ${idx})"
                                autocomplete="off"
                            >
                            ${s.nome ? `
                                <button type="button" class="btn-clear-servico" onclick="OSModule.limparServicoLinha(${idx})" title="Limpar serviço selecionado">
                                    <i class="ph ph-x"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div id="dropdown-servico-results-${idx}" class="os-servico-results-dropdown hidden"></div>
                    </div>

                    <!-- Campo de Descrição Específico desta OS (Abre ao selecionar serviço ou via botão) -->
                    ${s.mostrarDescricao ? `
                        <div class="os-servico-desc-box">
                            <div class="os-servico-desc-header">
                                <span class="os-desc-title">
                                    <i class="ph ph-note-pencil"></i> Descrição / Observações deste serviço nesta OS:
                                </span>
                                <span class="os-desc-notice">
                                    <i class="ph ph-shield-check"></i> Altera apenas nesta OS • Não altera o cadastro original
                                </span>
                                <button type="button" class="btn-fechar-desc" onclick="OSModule.toggleDescricaoServico(${idx})" title="Ocultar campo de descrição">
                                    <i class="ph ph-caret-up"></i>
                                </button>
                            </div>
                            <textarea 
                                id="textarea-servico-desc-${idx}"
                                rows="2" 
                                placeholder="Descreva observações específicas para este veículo (ex: aplicado vedante Loctite, verificado desgaste de pastilhas)..."
                                oninput="OSModule.atualizarLinhaServico(${idx}, 'descricao', this.value)"
                            >${window.UI ? UI.escapeHtml(s.descricao || '') : (s.descricao || '')}</textarea>
                        </div>
                    ` : `
                        <div style="margin-top: 4px;">
                            <button type="button" class="btn-toggle-desc-link" onclick="OSModule.toggleDescricaoServico(${idx})">
                                <i class="ph ph-plus-circle"></i> Adicionar detalhes/observações para esta OS
                            </button>
                        </div>
                    `}
                </td>
                <td style="text-align:right; vertical-align:top; padding-top:12px;">
                    <input 
                        type="text" 
                        value="${Number(s.preco || 0).toFixed(2).replace('.', ',')}"
                        oninput="OSModule.atualizarLinhaServico(${idx}, 'preco', this.value)"
                        style="width:110px; text-align:right; padding:6px 8px; font-size:0.84rem; font-weight:700; border:1px solid #CBD5E1; border-radius:6px;"
                    >
                </td>
                <td style="text-align:center; vertical-align:top; padding-top:14px;">
                    <button type="button" class="action-btn btn-action-del" onclick="OSModule.removerLinhaServico(${idx})" title="Remover serviço">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    /**
     * Itens: Discriminação de Peças
     */
    adicionarLinhaPeca(item = null) {
        this.itensPecas.push(item || {
            nome: '',
            qtd: 1,
            preco: 0,
            subtotal: 0
        });
        this.renderizarLinhasPecas();
        this.recalcularTotais();
    },

    removerLinhaPeca(index) {
        this.itensPecas.splice(index, 1);
        this.renderizarLinhasPecas();
        this.recalcularTotais();
    },

    atualizarLinhaPeca(index, campo, valor) {
        if (!this.itensPecas[index]) return;
        if (campo === 'qtd') {
            const qtd = Math.max(1, parseInt(valor, 10) || 1);
            this.itensPecas[index].qtd = qtd;
            this.itensPecas[index].subtotal = qtd * (Number(this.itensPecas[index].preco) || 0);
        } else if (campo === 'preco') {
            const preco = parseFloat(String(valor).replace(/\./g, '').replace(',', '.')) || 0;
            this.itensPecas[index].preco = preco;
            this.itensPecas[index].subtotal = (Number(this.itensPecas[index].qtd) || 1) * preco;
        } else {
            this.itensPecas[index][campo] = valor;
        }

        // Atualiza a célula de subtotal visualmente
        const subtotalEl = document.getElementById(`subtotal-peca-${index}`);
        if (subtotalEl && window.UI) {
            subtotalEl.textContent = UI.formatarMoeda(this.itensPecas[index].subtotal || 0);
        }

        this.recalcularTotais();
    },

    renderizarLinhasPecas() {
        this.atualizarBadgesAbas();
        const tbody = document.getElementById('tbody-itens-pecas');
        if (!tbody) return;

        if (this.itensPecas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:14px; color:#94A3B8; font-size:0.78rem;">
                        Nenhuma peça adicionada. Clique em "+ Adicionar Peça" para incluir insumos ou peças trocadas.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.itensPecas.map((p, idx) => {
            const subtotal = (Number(p.qtd) || 1) * (Number(p.preco) || 0);
            return `
                <tr>
                    <td>
                        <input 
                            type="text" 
                            placeholder="Ex: JOGO DE PASTILHAS DE FREIO DIANTEIRA" 
                            value="${window.UI ? UI.escapeHtml(p.nome || '') : (p.nome || '')}"
                            oninput="OSModule.atualizarLinhaPeca(${idx}, 'nome', this.value)"
                            style="width:100%; padding:5px 8px; font-size:0.82rem; font-weight:600;"
                        >
                    </td>
                    <td style="text-align:center;">
                        <input 
                            type="number" 
                            min="1" 
                            value="${p.qtd || 1}"
                            oninput="OSModule.atualizarLinhaPeca(${idx}, 'qtd', this.value)"
                            style="width:65px; text-align:center; padding:5px 8px; font-size:0.82rem; font-weight:700;"
                        >
                    </td>
                    <td style="text-align:right;">
                        <input 
                            type="text" 
                            value="${Number(p.preco || 0).toFixed(2).replace('.', ',')}"
                            oninput="OSModule.atualizarLinhaPeca(${idx}, 'preco', this.value)"
                            style="width:100px; text-align:right; padding:5px 8px; font-size:0.82rem; font-weight:700;"
                        >
                    </td>
                    <td style="text-align:right; font-weight:700; color:#16A34A;" id="subtotal-peca-${idx}">
                        ${window.UI ? UI.formatarMoeda(subtotal) : `R$ ${subtotal.toFixed(2)}`}
                    </td>
                    <td style="text-align:center;">
                        <button type="button" class="action-btn btn-action-del" onclick="OSModule.removerLinhaPeca(${idx})" title="Remover peça">
                            <i class="ph ph-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Recalcula os totais (Serviços + Peças - Desconto)
     */
    recalcularTotais() {
        const totalServicos = this.itensServicos.reduce((acc, s) => acc + (Number(s.preco) || 0), 0);
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
            responsavel: this.getInputValue('os_responsavel') || 'AUTOCAR BS',
            data_inicial: dataInicial,
            data_final: this.getInputValue('os_data_final'),
            status: this.getInputValue('os_status') || 'orcamento',
            termo_garantia: this.getInputValue('os_termo_garantia') || '90 dias',
            descricao_problema: this.getInputValue('os_descricao_problema'),
            laudo_tecnico: this.getInputValue('os_laudo_tecnico'),
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
                this.voltarParaLista(false);
                await this.carregar(1);
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
                throw new Error(res.message || 'Erro ao excluir OS.');
            }
        } catch (err) {
            console.error('Erro ao excluir OS:', err);
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
            <div class="os-document-sheet" style="box-shadow: none !important; border: none !important; padding: 12px 18px !important; max-width: 100% !important;">
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
    async visualizarOS(id) {
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

        let os = this.ordensCache.find(o => String(o.id) === String(id));
        try {
            const res = await API.obterOS(id);
            if (res && res.os) {
                os = res.os;
            }
        } catch (err) {
            console.warn('Erro ao carregar OS detalhada:', err);
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

        const servicos = Array.isArray(os.itens_servicos) ? os.itens_servicos : [];
        const pecas = Array.isArray(os.itens_pecas) ? os.itens_pecas : [];

        const totalPecas = Number(os.valor_pecas || 0);
        const totalServicos = Number(os.valor_servicos || 0);
        const totalDesconto = Number(os.valor_desconto || 0);
        const totalGeral = Number(os.valor_total || (totalPecas + totalServicos - totalDesconto));

        const formatarMoeda = (val) => window.UI ? UI.formatarMoeda(val) : `R$ ${Number(val || 0).toFixed(2)}`;

        const linhasPecas = pecas.length > 0
            ? pecas.map(p => {
                const qtd = Number(p.qtd || 1);
                const preco = Number(p.preco || 0);
                const subt = qtd * preco;
                return `
                    <tr>
                        <td style="padding: 5px 8px; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB; text-align: left;">
                            <span class="item-nome">${window.UI ? UI.escapeHtml(p.nome) : p.nome}</span>
                        </td>
                        <td style="padding: 5px 8px; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB; text-align: center;">${qtd}</td>
                        <td style="padding: 5px 8px; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB; text-align: right;">${preco.toFixed(2)}</td>
                        <td style="padding: 5px 8px; border-bottom: 1px solid #D1D5DB; text-align: right;">${formatarMoeda(subt)}</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="4" style="text-align: center; color: #6B7280; font-style: italic; padding: 8px; border-bottom: 1px solid #D1D5DB;">Nenhum produto discriminado.</td></tr>`;

        const linhasServicos = servicos.length > 0
            ? servicos.map(s => {
                const qtd = Number(s.qtd || 1);
                const preco = Number(s.preco || 0);
                const subt = qtd * preco;
                return `
                    <tr>
                        <td style="padding: 5px 8px; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB; text-align: left;">
                            <div class="item-nome">${window.UI ? UI.escapeHtml(s.nome) : s.nome}</div>
                            ${s.descricao ? `<div class="item-desc">${window.UI ? UI.escapeHtml(s.descricao) : s.descricao}</div>` : ''}
                        </td>
                        <td style="padding: 5px 8px; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB; text-align: center;">${qtd}</td>
                        <td style="padding: 5px 8px; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB; text-align: right;">${preco.toFixed(2)}</td>
                        <td style="padding: 5px 8px; border-bottom: 1px solid #D1D5DB; text-align: right;">${formatarMoeda(subt)}</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="4" style="text-align: center; color: #6B7280; font-style: italic; padding: 8px; border-bottom: 1px solid #D1D5DB;">Nenhum serviço discriminado.</td></tr>`;

        return `
            <!-- 1. Cabeçalho Empresa & Identificação da OS -->
            <div class="os-doc-header">
                <div class="os-doc-header-logo">
                    <div class="brand-title">AUTOCAR <span>BS</span></div>
                    <div class="brand-subtitle-box">ESPECIALISTAS EM VOLKSWAGEN E AUDI</div>
                    <div class="brand-desc">MECÂNICA E REVISÕES PREVENTIVAS MULTIMARCAS</div>
                </div>

                <div class="os-doc-header-empresa">
                    <div class="empresa-nome">AUTOCAR BS</div>
                    <div>27.259.708/0001-18</div>
                    <div>15 DE NOVEMBRO, 2569 - LOTEAMENTO MODENA - TATUI - SP</div>
                    <div>E-mail: autocarbstatui@gmail.com - Fone: (15) 99666-1359</div>
                </div>

                <div class="os-doc-header-meta">
                    <div class="os-num-linha">N° OS: ${numeroOS}</div>
                    <div class="os-emissao-label">Emissão:</div>
                    <div class="os-emissao-data">${dataEmissao}</div>
                </div>
            </div>

            <div class="os-doc-divisor"></div>

            <!-- 2. Dados do Cliente e Responsável -->
            <div class="os-doc-grid-dupla">
                <div class="os-doc-col-info">
                    <div class="os-doc-col-titulo">CLIENTE</div>
                    <div class="cli-nome">${cliNome}</div>
                    <div>${cliEndereco}</div>
                    <div>E-mail: ${cliEmail}</div>
                    <div>Celular: ${tel}</div>
                </div>

                <div class="os-doc-col-info">
                    <div class="os-doc-col-titulo">RESPONSÁVEL</div>
                    <div class="cli-nome">AUTOCAR BS</div>
                    <div>Telefone: (15) 99666-1359</div>
                    <div>Email: autocarbstatui@gmail.com</div>
                </div>
            </div>

            <div class="os-doc-divisor"></div>

            <!-- 3. Parâmetros da OS e Dados do Veículo -->
            <div class="os-doc-info-strip">
                <div class="info-item"><strong>STATUS OS:</strong> <span>${statusLabel}</span></div>
                <div class="info-item"><strong>DATA INICIAL:</strong> <span>${dataIni}</span></div>
                <div class="info-item"><strong>DATA FINAL:</strong> <span>${dataFim}</span></div>
                <div class="info-item"><strong>GARANTIA:</strong> <span>${garantia}</span></div>
            </div>

            <div class="os-doc-veiculo-bloco">
                <div><strong>DESCRIÇÃO:</strong></div>
                <div style="margin-bottom: 3px;">${mod}${os.veiculo_ano ? ` (${os.veiculo_ano})` : ''}</div>
                <div><strong>PLACA:</strong> ${placa}</div>
                <div><strong>CHASSI:</strong> ${chassi}</div>
                <div><strong>KM:</strong> ${km}</div>
            </div>

            <!-- Sintomas ou Laudo (se preenchidos) -->
            ${os.descricao_problema ? `
                <div style="font-size: 10.5px; line-height: 1.4; margin-bottom: 12px; padding: 6px 10px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px;">
                    <strong>SINTOMAS / RECLAMAÇÃO DO CLIENTE:</strong>
                    <div style="margin-top: 2px;">${window.UI ? UI.escapeHtml(os.descricao_problema) : os.descricao_problema}</div>
                </div>
            ` : ''}

            ${os.laudo_tecnico ? `
                <div style="font-size: 10.5px; line-height: 1.4; margin-bottom: 12px; padding: 6px 10px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px;">
                    <strong>DIAGNÓSTICO & LAUDO TÉCNICO:</strong>
                    <div style="margin-top: 2px;">${window.UI ? UI.escapeHtml(os.laudo_tecnico) : os.laudo_tecnico}</div>
                </div>
            ` : ''}

            <!-- 4. Tabela de Peças & Produtos -->
            <table class="os-doc-tabela-pdf">
                <thead>
                    <tr>
                        <th style="text-align: left;">Produto</th>
                        <th style="width: 85px; text-align: center;">Quantidade</th>
                        <th style="width: 110px; text-align: right;">Preço unit.</th>
                        <th style="width: 110px; text-align: right;">Sub-total</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasPecas}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4" class="linha-total-tabela">
                            Total: &nbsp; ${formatarMoeda(totalPecas)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <!-- 5. Tabela de Serviços & Mão de Obra (com suporte a descrição do serviço) -->
            <table class="os-doc-tabela-pdf" style="margin-top: 14px;">
                <thead>
                    <tr>
                        <th style="text-align: left;">Serviço</th>
                        <th style="width: 85px; text-align: center;">Quantidade</th>
                        <th style="width: 110px; text-align: right;">Preço unit.</th>
                        <th style="width: 110px; text-align: right;">Sub-total</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasServicos}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4" class="linha-total-tabela">
                            Total: &nbsp; ${formatarMoeda(totalServicos)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <!-- 6. Total Geral -->
            <div class="os-doc-valor-total-destaque">
                ${totalDesconto > 0 ? `<div style="font-size: 11px; font-weight: 500; color: #DC2626; margin-bottom: 4px;">Desconto: -${formatarMoeda(totalDesconto)}</div>` : ''}
                Valor Total: ${formatarMoeda(totalGeral)}
            </div>

            <!-- 7. Tabela de Assinaturas (modelo PDF oficial) -->
            <table class="os-doc-tabela-assinaturas">
                <thead>
                    <tr>
                        <th style="width: 14%;">Data</th>
                        <th style="width: 43%;">Assinatura do Cliente</th>
                        <th style="width: 43%;">Assinatura do Técnico Responsável</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
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
