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

    /**
     * Inicialização do módulo quando a aba é acessada
     */
    async iniciar() {
        if (!this.inicializado) {
            this.inicializado = true;
            this.mostrarSubview('lista');
        }
        await this.carregar(1);
    },

    /**
     * Alterna entre a listagem e a página de cadastro/edição
     */
    mostrarSubview(subview) {
        const viewLista = document.getElementById('view-os-lista');
        const viewCadastro = document.getElementById('view-os-cadastro');

        if (subview === 'cadastro') {
            if (viewLista) viewLista.classList.add('hidden');
            if (viewCadastro) viewCadastro.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            if (viewCadastro) viewCadastro.classList.add('hidden');
            if (viewLista) viewLista.classList.remove('hidden');
        }
    },

    voltarParaLista() {
        this.idEdicao = null;
        this.mostrarSubview('lista');
    },

    /**
     * Carrega e renderiza a lista de ordens de serviço
     */
    async carregar(pagina = this.paginaAtual) {
        this.paginaAtual = pagina;
        const iconReload = document.getElementById('icon-reload-os');
        if (iconReload) iconReload.classList.add('ph-spin');

        const tbody = document.getElementById('tbody-os');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center; padding: 32px; color: var(--text-secondary);">
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
            if (window.UI) UI.toast(err.message || 'Erro ao carregar ordens de serviço.', 'error');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align:center; padding: 24px; color: var(--danger, #EF4444);">
                            <i class="ph ph-warning-circle" style="font-size:1.6rem; display:block; margin-bottom:6px;"></i>
                            <span>Não foi possível carregar as ordens de serviço. Verifique a conexão.</span>
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
     * Renderiza a tabela moderna compacta de ordens de serviço
     */
    renderizarTabela(ordens) {
        const tbody = document.getElementById('tbody-os');
        if (!tbody) return;

        if (ordens.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center; padding: 40px 16px; color: var(--text-secondary);">
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
            const dataFim = this.formatarDataBR(os.data_final);

            const cliNome = os.cliente_nome ? (window.UI ? UI.escapeHtml(os.cliente_nome) : os.cliente_nome) : 'CLIENTE NÃO IDENTIFICADO';
            const modVeiculo = os.veiculo_modelo ? (window.UI ? UI.escapeHtml(os.veiculo_modelo) : os.veiculo_modelo) : '';
            const placaVeiculo = os.veiculo_placa ? (window.UI ? UI.escapeHtml(os.veiculo_placa) : os.veiculo_placa) : '';
            const responsavel = os.responsavel ? (window.UI ? UI.escapeHtml(os.responsavel) : os.responsavel) : 'AUTOCAR BS';
            const garantia = os.termo_garantia ? (window.UI ? UI.escapeHtml(os.termo_garantia) : os.termo_garantia) : '90 dias';

            return `
                <tr>
                    <td style="text-align:center;">
                        <span class="badge-codigo-servico">${numeroOS}</span>
                    </td>
                    <td>
                        <div class="os-cliente-celula">
                            <span class="os-cliente-nome">${cliNome}</span>
                            <div class="os-veiculo-info">
                                ${modVeiculo ? `<span>${modVeiculo}</span>` : ''}
                                ${placaVeiculo ? `<span class="os-veiculo-placa">${placaVeiculo}</span>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="font-size:0.78rem; font-weight:600; color:#475569;">${responsavel}</span>
                    </td>
                    <td style="text-align:center;">
                        <span class="os-data-texto">${dataIni}</span>
                    </td>
                    <td style="text-align:center;">
                        <span class="os-data-texto">${dataFim}</span>
                    </td>
                    <td style="text-align:right;">
                        <span class="os-valor-total">${valorTotalFormatado}</span>
                    </td>
                    <td style="text-align:center;">
                        <span class="badge-status-os status-${statusKey}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="text-align:center;">
                        <span class="badge-garantia-os">${garantia}</span>
                    </td>
                    <td style="text-align:right;">
                        <div class="actions-wrapper" style="justify-content:flex-end; gap:4px;">
                            <button class="action-btn btn-action-edit" onclick="OSModule.editarOS('${os.id}')" title="Visualizar / Editar OS">
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
        this.idEdicao = null;
        this.itensPecas = [];
        this.itensServicos = [];

        const tituloEl = document.getElementById('os-form-titulo');
        if (tituloEl) {
            tituloEl.innerHTML = `<i class="ph ph-clipboard-text"></i> <span>Nova Ordem de Serviço</span>`;
        }

        const hoje = new Date().toISOString().split('T')[0];
        const previsao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Reseta campos do formulário
        this.setInputValue('os_numero', 'Automático');
        this.setInputValue('os_cliente_nome', '');
        this.setInputValue('os_cliente_telefone', '');
        this.setInputValue('os_veiculo_modelo', '');
        this.setInputValue('os_veiculo_placa', '');
        this.setInputValue('os_veiculo_km', '');
        this.setInputValue('os_responsavel', 'AUTOCAR BS');
        this.setInputValue('os_data_inicial', hoje);
        this.setInputValue('os_data_final', previsao);
        this.setInputValue('os_status', 'orcamento');
        this.setInputValue('os_termo_garantia', '90 dias');
        this.setInputValue('os_descricao_problema', '');
        this.setInputValue('os_laudo_tecnico', '');
        this.setInputValue('os_valor_desconto', '0,00');

        this.renderizarLinhasServicos();
        this.renderizarLinhasPecas();
        this.recalcularTotais();

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
            this.itensServicos = Array.isArray(os.itens_servicos) ? JSON.parse(JSON.stringify(os.itens_servicos)) : [];

            const tituloEl = document.getElementById('os-form-titulo');
            if (tituloEl) {
                tituloEl.innerHTML = `<i class="ph ph-clipboard-text"></i> <span>Editar Ordem de Serviço #${os.numero || os.id}</span>`;
            }

            this.setInputValue('os_numero', os.numero || os.id);
            this.setInputValue('os_cliente_nome', os.cliente_nome || '');
            this.setInputValue('os_cliente_telefone', os.cliente_telefone || '');
            this.setInputValue('os_veiculo_modelo', os.veiculo_modelo || '');
            this.setInputValue('os_veiculo_placa', os.veiculo_placa || '');
            this.setInputValue('os_veiculo_km', os.veiculo_km || '');
            this.setInputValue('os_responsavel', os.responsavel || 'AUTOCAR BS');
            this.setInputValue('os_data_inicial', os.data_inicial ? os.data_inicial.split('T')[0] : '');
            this.setInputValue('os_data_final', os.data_final ? os.data_final.split('T')[0] : '');
            this.setInputValue('os_status', os.status || 'orcamento');
            this.setInputValue('os_termo_garantia', os.termo_garantia || '90 dias');
            this.setInputValue('os_descricao_problema', os.descricao_problema || '');
            this.setInputValue('os_laudo_tecnico', os.laudo_tecnico || '');
            this.setInputValue('os_valor_desconto', Number(os.valor_desconto || 0).toFixed(2).replace('.', ','));

            this.renderizarLinhasServicos();
            this.renderizarLinhasPecas();
            this.recalcularTotais();

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
            nome: '',
            preco: 0,
            subtotal: 0
        });
        this.renderizarLinhasServicos();
        this.recalcularTotais();
    },

    removerLinhaServico(index) {
        this.itensServicos.splice(index, 1);
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
        const tbody = document.getElementById('tbody-itens-servicos');
        if (!tbody) return;

        if (this.itensServicos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center; padding:14px; color:#94A3B8; font-size:0.78rem;">
                        Nenhum serviço adicionado. Clique em "+ Adicionar Serviço" para incluir mão de obra.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.itensServicos.map((s, idx) => `
            <tr>
                <td>
                    <input 
                        type="text" 
                        placeholder="Ex: REVISÃO DE FREIOS / TROCA DE CORREIA DENTADA" 
                        value="${window.UI ? UI.escapeHtml(s.nome || '') : (s.nome || '')}"
                        oninput="OSModule.atualizarLinhaServico(${idx}, 'nome', this.value)"
                        style="width:100%; padding:5px 8px; font-size:0.82rem; font-weight:600; text-transform:uppercase;"
                    >
                </td>
                <td style="text-align:right;">
                    <input 
                        type="text" 
                        value="${Number(s.preco || 0).toFixed(2).replace('.', ',')}"
                        oninput="OSModule.atualizarLinhaServico(${idx}, 'preco', this.value)"
                        style="width:110px; text-align:right; padding:5px 8px; font-size:0.82rem; font-weight:700;"
                    >
                </td>
                <td style="text-align:center;">
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
        const dataInicial = this.getInputValue('os_data_inicial');

        if (!clienteNome) {
            if (window.UI) UI.toast('Por favor, informe o nome do cliente.', 'warning');
            const el = document.getElementById('os_cliente_nome');
            if (el) el.focus();
            return;
        }

        if (!dataInicial) {
            if (window.UI) UI.toast('Por favor, informe a data de entrada da OS.', 'warning');
            const el = document.getElementById('os_data_inicial');
            if (el) el.focus();
            return;
        }

        const totalServicos = this.itensServicos.reduce((acc, s) => acc + (Number(s.preco) || 0), 0);
        const totalPecas = this.itensPecas.reduce((acc, p) => acc + ((Number(p.qtd) || 1) * (Number(p.preco) || 0)), 0);
        const descStr = this.getInputValue('os_valor_desconto');
        const desconto = parseFloat(descStr.replace(/\./g, '').replace(',', '.')) || 0;
        const totalGeral = Math.max(0, (totalServicos + totalPecas) - desconto);

        const payload = {
            id: this.idEdicao,
            cliente_nome: clienteNome,
            cliente_telefone: this.getInputValue('os_cliente_telefone'),
            veiculo_modelo: this.getInputValue('os_veiculo_modelo'),
            veiculo_placa: this.getInputValue('os_veiculo_placa'),
            veiculo_km: this.getInputValue('os_veiculo_km'),
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
                if (window.UI) UI.toast(`Ordem de Serviço #${res.os.numero || res.os.id} salva com sucesso!`, 'success');
                this.voltarParaLista();
                await this.carregar(1);
            } else {
                throw new Error(res.message || 'Erro ao salvar Ordem de Serviço.');
            }
        } catch (err) {
            if (window.UI) UI.toast(err.message || 'Erro ao salvar OS.', 'error');
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
                if (window.UI) UI.toast(`OS #${numero} excluída com sucesso.`, 'success');
                await this.carregar(this.paginaAtual);
            } else {
                throw new Error(res.message || 'Erro ao excluir OS.');
            }
        } catch (err) {
            if (window.UI) UI.toast(err.message || 'Erro ao excluir OS.', 'error');
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

        const container = document.getElementById('relatorio-documento-impressao');
        if (!container) return;

        const numeroOS = os.numero || os.id;
        const cliNome = (os.cliente_nome || 'Não Informado').toUpperCase();
        const tel = os.cliente_telefone || 'Não informado';
        const mod = (os.veiculo_modelo || 'Não informado').toUpperCase();
        const placa = (os.veiculo_placa || 'Sem placa').toUpperCase();
        const km = os.veiculo_km || 'Não informado';
        const statusLabel = this.obterLabelStatus(os.status).toUpperCase();
        const dataIni = this.formatarDataBR(os.data_inicial);
        const dataFim = this.formatarDataBR(os.data_final);
        const garantia = os.termo_garantia || '90 dias';

        const servicos = Array.isArray(os.itens_servicos) ? os.itens_servicos : [];
        const pecas = Array.isArray(os.itens_pecas) ? os.itens_pecas : [];

        const linhasServicos = servicos.length > 0
            ? servicos.map(s => `
                <tr>
                    <td style="padding:6px 8px; border-bottom:1px solid #CBD5E1;">${window.UI ? UI.escapeHtml(s.nome) : s.nome}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:right;">${window.UI ? UI.formatarMoeda(s.preco || 0) : `R$ ${Number(s.preco || 0).toFixed(2)}`}</td>
                </tr>
            `).join('')
            : `<tr><td colspan="2" style="padding:8px; color:#64748B; font-style:italic;">Nenhum serviço discriminado.</td></tr>`;

        const linhasPecas = pecas.length > 0
            ? pecas.map(p => {
                const subt = (Number(p.qtd) || 1) * (Number(p.preco) || 0);
                return `
                    <tr>
                        <td style="padding:6px 8px; border-bottom:1px solid #CBD5E1;">${window.UI ? UI.escapeHtml(p.nome) : p.nome}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:center;">${p.qtd || 1}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:right;">${window.UI ? UI.formatarMoeda(p.preco || 0) : `R$ ${Number(p.preco || 0).toFixed(2)}`}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:right; font-weight:700;">${window.UI ? UI.formatarMoeda(subt) : `R$ ${subt.toFixed(2)}`}</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="4" style="padding:8px; color:#64748B; font-style:italic;">Nenhuma peça discriminada.</td></tr>`;

        container.innerHTML = `
            <div style="font-family: Inter, sans-serif; color: #0F172A; max-width: 800px; margin: 0 auto; padding: 24px;">
                <!-- Cabeçalho Oficina -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #0F172A; padding-bottom: 12px; margin-bottom: 14px;">
                    <div>
                        <h1 style="margin:0; font-size:1.6rem; font-weight:900; letter-spacing:-0.5px; color:#1E3A8A;">AUTOCAR BS</h1>
                        <p style="margin:2px 0 0 0; font-size:0.82rem; color:#475569;">Centro Automotivo Especializado • Mecânica & Diagnósticos</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem; color:#64748B; text-transform:uppercase; font-weight:700;">ORDEM DE SERVIÇO</span>
                        <div style="font-size:1.6rem; font-weight:900; color:#2563EB;">N° ${numeroOS}</div>
                        <span style="font-size:0.75rem; font-weight:700; background:#E2E8F0; padding:2px 8px; border-radius:4px;">${statusLabel}</span>
                    </div>
                </div>

                <!-- Dados do Cliente e Veículo -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px; background:#F8FAFC; border:1px solid #CBD5E1; border-radius:8px; padding:12px;">
                    <div style="font-size:0.82rem; line-height:1.5;">
                        <div style="font-weight:700; color:#334155; margin-bottom:4px; text-transform:uppercase; font-size:0.72rem;">Dados do Cliente</div>
                        <div><strong>Nome:</strong> ${cliNome}</div>
                        <div><strong>Telefone:</strong> ${tel}</div>
                    </div>
                    <div style="font-size:0.82rem; line-height:1.5;">
                        <div style="font-weight:700; color:#334155; margin-bottom:4px; text-transform:uppercase; font-size:0.72rem;">Dados do Veículo & Prazos</div>
                        <div><strong>Veículo:</strong> ${mod} | <strong>Placa:</strong> ${placa}</div>
                        <div><strong>KM Atual:</strong> ${km} | <strong>Garantia:</strong> ${garantia}</div>
                        <div><strong>Entrada:</strong> ${dataIni} | <strong>Entrega:</strong> ${dataFim}</div>
                    </div>
                </div>

                <!-- Descrições -->
                ${os.descricao_problema ? `
                    <div style="margin-bottom:12px; font-size:0.80rem; border:1px solid #CBD5E1; border-radius:6px; padding:8px 12px; background:#FFFFFF;">
                        <strong>Sintomas / Reclamação do Cliente:</strong>
                        <div style="margin-top:3px; color:#334155;">${window.UI ? UI.escapeHtml(os.descricao_problema) : os.descricao_problema}</div>
                    </div>
                ` : ''}

                ${os.laudo_tecnico ? `
                    <div style="margin-bottom:14px; font-size:0.80rem; border:1px solid #CBD5E1; border-radius:6px; padding:8px 12px; background:#FFFFFF;">
                        <strong>Diagnóstico & Laudo Técnico:</strong>
                        <div style="margin-top:3px; color:#334155;">${window.UI ? UI.escapeHtml(os.laudo_tecnico) : os.laudo_tecnico}</div>
                    </div>
                ` : ''}

                <!-- Tabela de Serviços -->
                <div style="margin-bottom:14px;">
                    <div style="font-size:0.82rem; font-weight:700; text-transform:uppercase; margin-bottom:6px; color:#0F172A;">1. Serviços & Mão de Obra</div>
                    <table style="width:100%; border-collapse:collapse; font-size:0.80rem; border:1px solid #CBD5E1;">
                        <thead>
                            <tr style="background:#F1F5F9; text-align:left; font-size:0.72rem; text-transform:uppercase; color:#475569;">
                                <th style="padding:6px 8px; border-bottom:1px solid #CBD5E1;">Descrição do Serviço</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:right; width:120px;">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasServicos}
                        </tbody>
                    </table>
                </div>

                <!-- Tabela de Peças -->
                <div style="margin-bottom:16px;">
                    <div style="font-size:0.82rem; font-weight:700; text-transform:uppercase; margin-bottom:6px; color:#0F172A;">2. Peças & Insumos Utilizados</div>
                    <table style="width:100%; border-collapse:collapse; font-size:0.80rem; border:1px solid #CBD5E1;">
                        <thead>
                            <tr style="background:#F1F5F9; text-align:left; font-size:0.72rem; text-transform:uppercase; color:#475569;">
                                <th style="padding:6px 8px; border-bottom:1px solid #CBD5E1;">Descrição da Peça</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:center; width:60px;">Qtd</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:right; width:100px;">Unitário</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #CBD5E1; text-align:right; width:110px;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasPecas}
                        </tbody>
                    </table>
                </div>

                <!-- Fechamento Financeiro -->
                <div style="display:flex; justify-content:flex-end; margin-bottom:28px;">
                    <div style="width:260px; font-size:0.82rem; line-height:1.6; border:1px solid #CBD5E1; border-radius:8px; padding:10px 14px; background:#F8FAFC;">
                        <div style="display:flex; justify-content:space-between;">
                            <span>Total Serviços:</span>
                            <strong>${window.UI ? UI.formatarMoeda(os.valor_servicos || 0) : `R$ ${Number(os.valor_servicos || 0).toFixed(2)}`}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>Total Peças:</span>
                            <strong>${window.UI ? UI.formatarMoeda(os.valor_pecas || 0) : `R$ ${Number(os.valor_pecas || 0).toFixed(2)}`}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>Desconto:</span>
                            <strong>${window.UI ? UI.formatarMoeda(os.valor_desconto || 0) : `R$ ${Number(os.valor_desconto || 0).toFixed(2)}`}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid #CBD5E1; margin-top:4px; padding-top:4px; font-size:0.95rem; font-weight:800; color:#16A34A;">
                            <span>TOTAL GERAL:</span>
                            <span>${window.UI ? UI.formatarMoeda(os.valor_total || 0) : `R$ ${Number(os.valor_total || 0).toFixed(2)}`}</span>
                        </div>
                    </div>
                </div>

                <!-- Termo e Assinaturas -->
                <div style="margin-top:20px; border-top:1px dashed #CBD5E1; padding-top:14px; font-size:0.75rem; color:#64748B;">
                    <p style="margin:0 0 24px 0;">Declaro ter recebido os serviços e peças discriminados nesta Ordem de Serviço em perfeitas condições de uso e funcionamento, com termo de garantia de <strong>${garantia}</strong> a partir da data de entrega.</p>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:40px; text-align:center;">
                        <div>
                            <div style="border-top:1px solid #475569; width:80%; margin:0 auto; padding-top:4px;">
                                <strong>AUTOCAR BS</strong><br>Responsável Técnico
                            </div>
                        </div>
                        <div>
                            <div style="border-top:1px solid #475569; width:80%; margin:0 auto; padding-top:4px;">
                                <strong>${cliNome}</strong><br>Assinatura do Cliente
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        window.print();
    }
};

window.OSModule = OSModule;
window.OS = OSModule;
