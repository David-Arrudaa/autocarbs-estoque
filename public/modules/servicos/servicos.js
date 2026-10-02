/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Catálogo de Serviços & Mão de Obra (servicos.js)
 * Arquitetura de Navegação em Páginas Reais (Subviews)
 * Foco: Código, Procedimento / Serviço e Valor Hora
 * =========================================================
 */

const Servicos = {
    paginaAtual: 1,
    limitePorPagina: 15,
    totalRegistros: 0,
    totalPaginas: 1,
    termoBusca: '',
    idEdicao: null,
    debounceTimeout: null,
    inicializado: false,

    /**
     * Inicialização do módulo quando a aba é acessada
     */
    async iniciar() {
        if (!this.inicializado) {
            this.inicializado = true;
            this.mostrarSubview('lista');
        }
        await Promise.all([
            this.carregarMetricas(),
            this.carregar(1)
        ]);
    },

    /**
     * Alterna entre a listagem e a página de cadastro/edição
     */
    mostrarSubview(subview) {
        const viewLista = document.getElementById('view-servicos-lista');
        const viewCadastro = document.getElementById('view-servicos-cadastro');

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
     * Carrega as métricas do topo (Total de Serviços e Valor Hora Médio)
     */
    async carregarMetricas() {
        try {
            const res = await API.metricasServicos();
            if (res && res.success && res.metricas) {
                const m = res.metricas;
                const elTotal = document.getElementById('kpi-total-servicos');
                const elPreco = document.getElementById('kpi-preco-medio');

                if (elTotal) elTotal.textContent = String(m.totalServicos || 0);
                if (elPreco) elPreco.textContent = UI.formatarMoeda(m.precoMedio || 0);
            }
        } catch (err) {
            console.warn('[Servicos] Falha ao carregar métricas:', err.message);
        }
    },

    /**
     * Carrega e renderiza a lista de serviços
     */
    async carregar(pagina = this.paginaAtual) {
        this.paginaAtual = pagina;
        const iconReload = document.getElementById('icon-reload-servicos');
        if (iconReload) iconReload.classList.add('ph-spin');

        const tbody = document.getElementById('tbody-servicos');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding: 32px; color: var(--text-secondary);">
                        <i class="ph ph-circle-notch ph-spin" style="font-size:1.8rem; color:var(--primary); display:block; margin-bottom:8px;"></i>
                        <span>Carregando serviços...</span>
                    </td>
                </tr>
            `;
        }

        try {
            const res = await API.listarServicos({
                pagina: this.paginaAtual,
                limite: this.limitePorPagina,
                busca: this.termoBusca,
                ordenarPor: 'codigo',
                ordem: 'desc'
            });

            if (res && res.success) {
                this.totalRegistros = res.total || 0;
                this.totalPaginas = res.totalPaginas || 1;
                this.renderizarTabela(res.servicos || []);
                this.atualizarPaginacao();
            }
        } catch (err) {
            UI.toast(err.message || 'Erro ao carregar catálogo de serviços.', 'error');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align:center; padding: 24px; color: var(--danger);">
                            <i class="ph ph-warning-circle" style="font-size:1.6rem; display:block; margin-bottom:6px;"></i>
                            <span>Não foi possível carregar os serviços. Verifique a conexão.</span>
                        </td>
                    </tr>
                `;
            }
        } finally {
            if (iconReload) iconReload.classList.remove('ph-spin');
        }
    },

    /**
     * Renderiza a tabela limpa (Cód., Procedimento / Serviço, Valor Hora, Ações)
     */
    renderizarTabela(servicos) {
        const tbody = document.getElementById('tbody-servicos');
        if (!tbody) return;

        if (servicos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding: 40px 16px; color: var(--text-secondary);">
                        <i class="ph ph-magnifying-glass" style="font-size:2rem; opacity:0.4; display:block; margin-bottom:8px;"></i>
                        <strong>Nenhum serviço encontrado.</strong>
                        <p style="font-size:0.8rem; margin-top:4px; opacity:0.8;">Tente ajustar o termo de pesquisa ou adicione um novo serviço.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = servicos.map(s => {
            const valorHoraFormatado = UI.formatarMoeda(s.preco || 0);
            const descricao = s.descricao ? UI.escapeHtml(s.descricao) : '';

            return `
                <tr>
                    <td style="text-align:center;">
                        <span class="badge-codigo-servico">${UI.escapeHtml(String(s.codigo || s.id))}</span>
                    </td>
                    <td>
                        <div class="servico-nome-celula">
                            <span class="servico-nome-titulo">${UI.escapeHtml(s.nome)}</span>
                            ${descricao ? `<span class="servico-nome-desc" title="${descricao}">${descricao}</span>` : ''}
                        </div>
                    </td>
                    <td style="text-align:right;">
                        <span class="servico-preco-valor">${valorHoraFormatado}</span>
                    </td>
                    <td style="text-align:right;">
                        <div class="actions-wrapper" style="justify-content:flex-end;">
                            <button class="action-btn btn-action-edit" onclick="Servicos.editarServico('${s.id}')" title="Editar Serviço">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="action-btn btn-action-del" onclick="Servicos.excluirServico('${s.id}', '${UI.escapeHtml(s.nome)}')" title="Excluir Serviço">
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
        const counter = document.getElementById('servicos-pagination-counter');
        const pageInfo = document.getElementById('servicos-page-info');
        const btnPrev = document.getElementById('btn-servicos-prev');
        const btnNext = document.getElementById('btn-servicos-next');

        if (counter) {
            const inicio = this.totalRegistros === 0 ? 0 : (this.paginaAtual - 1) * this.limitePorPagina + 1;
            const fim = Math.min(this.paginaAtual * this.limitePorPagina, this.totalRegistros);
            counter.textContent = `Exibindo ${inicio} - ${fim} de ${this.totalRegistros} serviços`;
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
        const input = document.getElementById('input-busca-servicos');
        const btnClear = document.getElementById('btn-limpar-busca-servicos');
        this.termoBusca = (input ? input.value : '').trim();

        if (btnClear) {
            if (this.termoBusca) btnClear.classList.remove('hidden');
            else btnClear.classList.add('hidden');
        }

        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.carregar(1);
        }, 250);
    },

    limparBusca() {
        const input = document.getElementById('input-busca-servicos');
        const btnClear = document.getElementById('btn-limpar-busca-servicos');
        if (input) input.value = '';
        if (btnClear) btnClear.classList.add('hidden');
        this.termoBusca = '';
        this.carregar(1);
    },

    /**
     * Abre a subview para cadastrar um novo serviço
     */
    abrirCadastro() {
        this.idEdicao = null;
        document.getElementById('serv_codigo').value = '';
        document.getElementById('serv_nome').value = '';
        document.getElementById('serv_preco').value = '';
        document.getElementById('serv_descricao').value = '';

        const elTitulo = document.getElementById('servico-form-titulo');
        if (elTitulo) {
            elTitulo.innerHTML = '<i class="ph ph-wrench"></i> <span>Novo Serviço</span>';
        }

        const btnTopo = document.getElementById('texto-btn-salvar-servico-topo');
        if (btnTopo) btnTopo.textContent = 'SALVAR SERVIÇO';
        const btnRodape = document.getElementById('texto-btn-salvar-servico-rodape');
        if (btnRodape) btnRodape.textContent = 'SALVAR SERVIÇO';

        this.mostrarSubview('cadastro');
        setTimeout(() => document.getElementById('serv_nome')?.focus(), 80);
    },

    /**
     * Abre a subview para editar um serviço existente
     */
    async editarServico(id) {
        try {
            UI.setLoading(true);
            const res = await API.obterServico(id);
            if (!res || !res.success || !res.servico) {
                return UI.toast('Não foi possível carregar os dados deste serviço.', 'warning');
            }

            const s = res.servico;
            this.idEdicao = s.id;

            document.getElementById('serv_codigo').value = s.codigo || '';
            document.getElementById('serv_nome').value = s.nome || '';
            document.getElementById('serv_preco').value = Number(s.preco || 0).toFixed(2).replace('.', ',');
            document.getElementById('serv_descricao').value = s.descricao || '';

            const elTitulo = document.getElementById('servico-form-titulo');
            if (elTitulo) {
                elTitulo.innerHTML = `<i class="ph ph-pencil-simple"></i> <span>Editar Serviço #${UI.escapeHtml(String(s.codigo || s.id))} - ${UI.escapeHtml(s.nome)}</span>`;
            }

            const btnTopo = document.getElementById('texto-btn-salvar-servico-topo');
            if (btnTopo) btnTopo.textContent = 'SALVAR ALTERAÇÕES';
            const btnRodape = document.getElementById('texto-btn-salvar-servico-rodape');
            if (btnRodape) btnRodape.textContent = 'SALVAR ALTERAÇÕES';

            this.mostrarSubview('cadastro');
            setTimeout(() => document.getElementById('serv_nome')?.focus(), 80);
        } catch (err) {
            UI.toast(err.message || 'Erro ao carregar serviço para edição.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    /**
     * Salva o serviço (inclusão ou alteração)
     */
    async salvar() {
        const nome = document.getElementById('serv_nome').value.trim();
        const preco = UI.lerMoeda(document.getElementById('serv_preco').value);
        const codigo = document.getElementById('serv_codigo').value.trim();
        const descricao = document.getElementById('serv_descricao').value.trim();

        if (!nome) {
            UI.toast('Informe o nome do procedimento ou serviço!', 'warning');
            document.getElementById('serv_nome')?.focus();
            return;
        }

        if (preco <= 0) {
            UI.toast('Informe o valor hora do serviço!', 'warning');
            document.getElementById('serv_preco')?.focus();
            return;
        }

        const payload = {
            codigo,
            nome,
            preco,
            descricao
        };

        if (this.idEdicao) {
            payload.id = this.idEdicao;
        }

        try {
            UI.setLoading(true);
            const res = await API.salvarServico(payload);
            if (res && res.success) {
                UI.toast(res.mensagem || 'Serviço salvo com sucesso!', 'success');
                this.voltarParaLista();
                await Promise.all([
                    this.carregar(this.paginaAtual),
                    this.carregarMetricas()
                ]);
            }
        } catch (err) {
            UI.toast(err.message || 'Erro ao salvar serviço.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },

    /**
     * Exclui um serviço com confirmação
     */
    async excluirServico(id, nome) {
        const confirmou = await Dialog.confirm(
            `Tem certeza que deseja excluir o serviço <strong>"${nome}"</strong>?<br><span style="font-size:0.8rem; color:var(--text-secondary);">Esta ação não poderá ser desfeita.</span>`,
            { titulo: 'Excluir Serviço', perigo: true }
        );

        if (!confirmou) return;

        try {
            UI.setLoading(true);
            const res = await API.excluirServico(id);
            if (res && res.success) {
                UI.toast('Serviço excluído com sucesso!', 'success');
                await Promise.all([
                    this.carregar(this.paginaAtual),
                    this.carregarMetricas()
                ]);
            }
        } catch (err) {
            UI.toast(err.message || 'Erro ao excluir serviço.', 'error');
        } finally {
            UI.setLoading(false);
        }
    }
};

window.Servicos = Servicos;
