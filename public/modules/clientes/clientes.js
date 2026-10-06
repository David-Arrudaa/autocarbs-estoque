/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Gestão de Clientes (clientes.js)
 * Navegação em Páginas Reais (Subviews):
 * - Subview 1: Lista Enxuta
 * - Subview 2: Ficha 360° em Tela Cheia (Abas: Dados / OS)
 * - Subview 3: Formulário de Cadastro / Edição em Tela Cheia
 * =========================================================
 */

const Clientes = {
    paginaAtual: 1,
    totalPaginas: 1,
    limite: 15,
    termoBusca: '',
    veiculosTemporarios: [],
    clienteIdParaExcluir: null,
    clienteAtualFicha: null,
    timerBusca: null,
    subviewAtiva: 'lista',
    iniciado: false,

    /**
     * Ponto de entrada do módulo
     */
    async iniciar() {
        this.configurarEventos();
        this.mostrarSubview('lista');
        await this.carregarLista(1);
        this.iniciado = true;
    },

    /**
     * Alternador de telas/páginas (Subviews)
     * @param {'lista' | 'ficha' | 'cadastro'} nomeSubview 
     */
    mostrarSubview(nomeSubview) {
        this.subviewAtiva = nomeSubview;

        const viewLista = document.getElementById('view-clientes-lista');
        const viewFicha = document.getElementById('view-clientes-ficha');
        const viewCad = document.getElementById('view-clientes-cadastro');

        if (viewLista) viewLista.classList.toggle('hidden', nomeSubview !== 'lista');
        if (viewFicha) viewFicha.classList.toggle('hidden', nomeSubview !== 'ficha');
        if (viewCad) viewCad.classList.toggle('hidden', nomeSubview !== 'cadastro');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    voltarParaLista() {
        this.mostrarSubview('lista');
    },

    /**
     * Liga os listeners de eventos da interface
     */
    configurarEventos() {
        const inputBusca = document.getElementById('input-busca-clientes');
        const btnLimparBusca = document.getElementById('btn-limpar-busca-clientes');
        const btnNovo = document.getElementById('btn-novo-cliente');
        const btnReload = document.getElementById('btn-recarregar-clientes');
        const formCliente = document.getElementById('form-cliente-erp');
        const btnAddVeiculo = document.getElementById('btn-adicionar-veiculo-lista');

        // Busca instantânea com debounce e remoção de caracteres especiais
        if (inputBusca && !inputBusca.dataset.hasListener) {
            inputBusca.dataset.hasListener = 'true';
            inputBusca.addEventListener('input', (e) => {
                const cursorPos = e.target.selectionStart;
                const valorOriginal = e.target.value;
                // Remove qualquer caractere especial (hífen, pontos, barras, etc.),
                // permitindo apenas letras, números e espaços
                const valorLimpo = valorOriginal.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '');
                if (valorOriginal !== valorLimpo) {
                    e.target.value = valorLimpo;
                    if (cursorPos !== null) {
                        const diferenca = valorOriginal.length - valorLimpo.length;
                        const novaPos = Math.max(0, cursorPos - diferenca);
                        e.target.setSelectionRange(novaPos, novaPos);
                    }
                }

                const val = e.target.value.trim();
                if (btnLimparBusca) {
                    btnLimparBusca.style.display = e.target.value ? 'flex' : 'none';
                }
                clearTimeout(this.timerBusca);
                this.timerBusca = setTimeout(() => {
                    this.termoBusca = val;
                    this.paginaAtual = 1;
                    this.carregarLista(1);
                }, 300);
            });
        }

        if (btnLimparBusca && !btnLimparBusca.dataset.hasListener) {
            btnLimparBusca.dataset.hasListener = 'true';
            btnLimparBusca.addEventListener('click', () => {
                if (inputBusca) inputBusca.value = '';
                btnLimparBusca.style.display = 'none';
                this.termoBusca = '';
                this.paginaAtual = 1;
                this.carregarLista(1);
            });
        }

        if (btnReload && !btnReload.dataset.hasListener) {
            btnReload.dataset.hasListener = 'true';
            btnReload.addEventListener('click', async () => {
                const icon = document.getElementById('icon-reload-clientes');
                if (icon) icon.classList.add('ph-spin');
                await this.carregarLista(this.paginaAtual);
                if (icon) icon.classList.remove('ph-spin');
            });
        }

        if (btnNovo && !btnNovo.dataset.hasListener) {
            btnNovo.dataset.hasListener = 'true';
            btnNovo.addEventListener('click', () => this.abrirNovo());
        }

        if (formCliente && !formCliente.dataset.hasListener) {
            formCliente.dataset.hasListener = 'true';
            formCliente.addEventListener('submit', (e) => this.salvarCliente(e));
        }

        if (btnAddVeiculo && !btnAddVeiculo.dataset.hasListener) {
            btnAddVeiculo.dataset.hasListener = 'true';
            btnAddVeiculo.addEventListener('click', () => this.adicionarVeiculoTemp());
        }

        // Paginação
        const btnPrev = document.getElementById('btn-prev-clientes');
        const btnNext = document.getElementById('btn-next-clientes');
        if (btnPrev && !btnPrev.dataset.hasListener) {
            btnPrev.dataset.hasListener = 'true';
            btnPrev.addEventListener('click', () => {
                if (this.paginaAtual > 1) this.carregarLista(this.paginaAtual - 1);
            });
        }
        if (btnNext && !btnNext.dataset.hasListener) {
            btnNext.dataset.hasListener = 'true';
            btnNext.addEventListener('click', () => {
                if (this.paginaAtual < this.totalPaginas) this.carregarLista(this.paginaAtual + 1);
            });
        }

        // Modal de Exclusão (diálogo de segurança)
        this.ligarFechamentoModal('modal-confirmacao-excluir-cliente', null, 'btn-cancelar-exclusao-cliente');

        const btnConfirmaExcluir = document.getElementById('btn-confirmar-exclusao-cliente');
        if (btnConfirmaExcluir && !btnConfirmaExcluir.dataset.hasListener) {
            btnConfirmaExcluir.dataset.hasListener = 'true';
            btnConfirmaExcluir.addEventListener('click', () => this.confirmarExclusao());
        }

        // Máscaras e integrações
        this.configurarMascaras();

        const inputCep = document.getElementById('cad_cep');
        if (inputCep && !inputCep.dataset.hasCepListener) {
            inputCep.dataset.hasCepListener = 'true';
            inputCep.addEventListener('blur', () => this.buscarViaCEP(inputCep.value));
        }

        const inputPlaca = document.getElementById('temp_placa');
        if (inputPlaca && !inputPlaca.dataset.hasPlacaListener) {
            inputPlaca.dataset.hasPlacaListener = 'true';
            inputPlaca.addEventListener('blur', () => this.buscarPlacaAPI(inputPlaca.value));
        }
    },

    ligarFechamentoModal(modalId, btnXId, btnCancelId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (btnXId) {
            const btnX = document.getElementById(btnXId);
            if (btnX && !btnX.dataset.hasListener) {
                btnX.dataset.hasListener = 'true';
                btnX.addEventListener('click', () => modal.classList.add('hidden'));
            }
        }
        if (btnCancelId) {
            const btnCancel = document.getElementById(btnCancelId);
            if (btnCancel && !btnCancel.dataset.hasListener) {
                btnCancel.dataset.hasListener = 'true';
                btnCancel.addEventListener('click', () => modal.classList.add('hidden'));
            }
        }

        if (!modal.dataset.hasBackdropListener) {
            modal.dataset.hasBackdropListener = 'true';
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
    },

    /**
     * Alterna abas na Ficha da Página
     */
    alternarAbaFicha(aba) {
        const abas = ['dados', 'checklists', 'os'];
        abas.forEach(nome => {
            const btn = document.getElementById(`tab-btn-ficha-${nome}`);
            const cont = document.getElementById(`ficha-conteudo-${nome}`);
            if (btn) {
                if (nome === aba) btn.classList.add('active');
                else btn.classList.remove('active');
            }
            if (cont) {
                if (nome === aba) cont.classList.remove('hidden');
                else cont.classList.add('hidden');
            }
        });
    },

    /**
     * Carrega lista paginada de clientes
     */
    async carregarLista(pagina = 1) {
        const tbody = document.getElementById('tbody-clientes');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="ph ph-spinner ph-spin" style="font-size: 1.8rem; display: block; margin-bottom: 8px; color: var(--primary);"></i>
                    Carregando clientes...
                </td>
            </tr>
        `;

        try {
            const res = await API.listarClientes({
                busca: this.termoBusca,
                pagina: pagina,
                limite: this.limite,
                ordenarPor: 'id',
                ordem: 'desc'
            });

            if (!res.success) throw new Error(res.mensagem || 'Falha ao buscar clientes.');

            this.paginaAtual = res.paginacao.pagina;
            this.totalPaginas = res.paginacao.totalPaginas;

            this.renderizarTabela(res.clientes || [], res.paginacao);
            this.atualizarControlesPaginacao(res.paginacao);

            const badgeTotal = document.getElementById('badge-total-clientes');
            if (badgeTotal) badgeTotal.innerText = res.paginacao.total.toLocaleString('pt-BR');

        } catch (err) {
            console.error('[Clientes] Erro ao carregar lista:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 35px; color: #ef4444;">
                        <i class="ph ph-warning-circle" style="font-size: 1.8rem; display: block; margin-bottom: 8px;"></i>
                        Erro ao carregar clientes: ${err.message}
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Renderiza a tabela principal com layout limpo e enxuto
     */
    renderizarTabela(clientes, paginacao) {
        const tbody = document.getElementById('tbody-clientes');
        if (!tbody) return;

        if (clientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        Nenhum cliente encontrado ${this.termoBusca ? `para "${this.termoBusca}"` : ''}.
                    </td>
                </tr>
            `;
            return;
        }

        const linhas = clientes.map(cliente => {
            const cod = `<span class="badge-codigo">${cliente.id}</span>`;
            const nome = UI.escapeHtml((cliente.nome || 'SEM NOME').toUpperCase());
            const cpf = UI.escapeHtml(cliente.cpf || '-');
            const telefone = UI.escapeHtml(cliente.telefone || '-');

            return `
                <tr>
                    <td style="text-align: center;">${cod}</td>
                    <td><span class="servico-nome-titulo">${nome}</span></td>
                    <td style="font-family: inherit;">${cpf}</td>
                    <td>${telefone}</td>
                    <td style="text-align: right;">
                        <div class="actions-wrapper" style="justify-content: flex-end;">
                            <button type="button" class="action-btn btn-action-view" onclick="Clientes.abrirFicha(${cliente.id})" title="Visualizar Ficha">
                                <i class="ph ph-eye"></i>
                            </button>
                            <button type="button" class="action-btn btn-action-edit" onclick="Clientes.abrirEdicao(${cliente.id})" title="Editar">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button type="button" class="action-btn btn-action-del" onclick="Clientes.abrirModalExcluir(${cliente.id}, '${nome.replace(/'/g, "\\'")}')" title="Excluir">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = linhas;
    },

    atualizarControlesPaginacao(pag) {
        const info = document.getElementById('info-paginacao-clientes');
        const txtPag = document.getElementById('texto-pagina-clientes');
        const btnPrev = document.getElementById('btn-prev-clientes');
        const btnNext = document.getElementById('btn-next-clientes');

        const inicio = pag.total === 0 ? 0 : (pag.pagina - 1) * pag.limite + 1;
        const fim = Math.min(pag.pagina * pag.limite, pag.total);

        if (info) {
            info.innerHTML = `Exibindo <strong>${inicio}-${fim}</strong> de <strong>${pag.total}</strong> clientes`;
        }
        if (txtPag) {
            txtPag.innerText = `Página ${pag.pagina} de ${pag.totalPaginas}`;
        }
        if (btnPrev) btnPrev.disabled = pag.pagina <= 1;
        if (btnNext) btnNext.disabled = pag.pagina >= pag.totalPaginas;
    },

    /**
     * Abre a Ficha em PÁGINA COMPLETA ao clicar no "Olho" 👁️
     */
    async abrirFicha(id) {
        try {
            const res = await API.obterCliente(id);
            if (!res.success || !res.cliente) throw new Error(res.mensagem || 'Cliente não encontrado.');

            const c = res.cliente;
            this.clienteAtualFicha = c;

            // Inicia na Aba 1 (Dados do Cliente)
            this.alternarAbaFicha('dados');

            // 1. Aba Dados do Cliente
            document.getElementById('ficha-nome').innerText = (c.nome || 'SEM NOME').toUpperCase();
            document.getElementById('ficha-documento').innerText = c.cpf || '-';

            const dataCad = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-';
            document.getElementById('ficha-data-cadastro').innerText = dataCad;

            // Contatos
            document.getElementById('ficha-telefone').innerText = c.telefone || '-';
            const zapNum = (c.telefone || '').replace(/\D/g, '');
            const btnZap = document.getElementById('ficha-btn-whatsapp');
            if (btnZap) {
                if (zapNum) {
                    btnZap.href = `https://wa.me/55${zapNum}`;
                    btnZap.style.display = 'inline-flex';
                } else {
                    btnZap.style.display = 'none';
                }
            }

            // Endereço
            const logradouroNum = [c.endereco, c.numero ? `Nº ${c.numero}` : ''].filter(Boolean).join(', ') || '-';
            document.getElementById('ficha-endereco-completo').innerText = logradouroNum;

            const bairroCidade = [c.bairro, c.cidade, c.uf].filter(Boolean).join(' - ') || '-';
            document.getElementById('ficha-bairro-cidade').innerText = bairroCidade;
            document.getElementById('ficha-cep').innerText = c.cep || '-';

            const btnMaps = document.getElementById('ficha-btn-maps');
            if (btnMaps) {
                if (c.endereco && c.cidade) {
                    const endCompleto = `${c.endereco}, ${c.numero || ''}, ${c.bairro || ''}, ${c.cidade || ''} - ${c.uf || ''}`;
                    btnMaps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endCompleto)}`;
                    btnMaps.style.display = 'inline-flex';
                } else {
                    btnMaps.style.display = 'none';
                }
            }

            // Veículos do Cliente (Garagem)
            const veiculos = Array.isArray(c.veiculos) ? c.veiculos : [];
            document.getElementById('ficha-veiculos-count').innerText = veiculos.length;
            const tbodyVei = document.getElementById('ficha-veiculos-tbody');
            if (tbodyVei) {
                if (veiculos.length === 0) {
                    tbodyVei.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 15px;">
                                Nenhum veículo cadastrado.
                            </td>
                        </tr>
                    `;
                } else {
                    tbodyVei.innerHTML = veiculos.map(v => `
                        <tr>
                            <td><strong class="placa-badge">${v.placa}</strong></td>
                            <td>${v.marca || ''} ${v.modelo || ''}</td>
                            <td>${v.ano || '-'}</td>
                            <td>${v.cor || '-'}</td>
                            <td><span class="combustivel-badge">${v.combustivel || 'FLEX'}</span></td>
                            <td style="font-family: monospace; font-size: 0.82rem;">${v.chassi || '-'}</td>
                        </tr>
                    `).join('');
                }
            }

            // 2. Aba Checklists de Entrada (Histórico de Recepção do Veículo)
            const checklists = Array.isArray(c.historico_checklists) ? c.historico_checklists : (Array.isArray(c.historico) ? c.historico : []);
            const badgeChecklists = document.getElementById('ficha-checklists-count-badge');
            const headerChecklists = document.getElementById('ficha-checklists-count-header');
            if (badgeChecklists) badgeChecklists.innerText = checklists.length;
            if (headerChecklists) headerChecklists.innerText = checklists.length;

            const tbodyChecklists = document.getElementById('ficha-checklists-tbody');
            if (tbodyChecklists) {
                if (checklists.length === 0) {
                    tbodyChecklists.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px;">
                                Nenhum checklist de entrada registrado para este cliente.
                            </td>
                        </tr>
                    `;
                } else {
                    tbodyChecklists.innerHTML = checklists.map((chk, idx) => {
                        const dados = chk.dados_checklist || {};
                        const cod = chk.id ? chk.id.substring(0, 4).toUpperCase() : `#${idx + 1}`;
                        const dataEntrada = dados.data_entrada || (chk.created_at ? new Date(chk.created_at).toLocaleDateString('pt-BR') : '-');
                        const horaEntrada = dados.horario_entrada ? `<br><small style="color:var(--text-secondary); font-size:0.78rem;">${dados.horario_entrada}</small>` : '';
                        const carroDesc = `${dados.veiculo_marca || ''} ${dados.veiculo_versao || ''} ${dados.veiculo_ano_modelo || ''}`.trim() || 'VEÍCULO';
                        const placa = chk.placa_veiculo || dados.veiculo_placa || '-';
                        const km = dados.veiculo_km ? `KM: ${dados.veiculo_km}` : '';
                        const combustivel = dados.combustivel || '-';
                        const nivelTanque = dados.nivel_combustivel ? `Tanque: ${dados.nivel_combustivel}` : '';
                        const defeito = chk.observacoes || dados.servico_solicitado || '-';

                        return `
                            <tr>
                                <td style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${cod}</td>
                                <td style="font-size: 0.88rem; line-height: 1.3;">${dataEntrada}${horaEntrada}</td>
                                <td>
                                    <div class="os-desc-block">
                                        <span class="os-desc-carro">${carroDesc}</span>
                                        <span class="os-desc-placa">PLACA: ${placa}</span>
                                        ${km ? `<span class="os-desc-meta">${km}</span>` : ''}
                                    </div>
                                </td>
                                <td style="font-size: 0.85rem;">
                                    <strong>${combustivel}</strong>
                                    ${nivelTanque ? `<br><small style="color:var(--text-secondary); font-size:0.76rem;">${nivelTanque}</small>` : ''}
                                </td>
                                <td style="font-size: 0.88rem; max-width: 280px;">${defeito}</td>
                                <td style="text-align: right; white-space: nowrap;">
                                    <button type="button" class="btn-action-view" onclick="Clientes.imprimirOuVerChecklist('${chk.id}')" title="Visualizar Checklist de Entrada">
                                        <i class="ph ph-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // 3. Aba Ordens de Serviço (OS do Banco Principal)
            const ordensServico = Array.isArray(c.ordens_servico) ? c.ordens_servico : [];
            const badgeOs = document.getElementById('ficha-os-count-badge');
            const headerOs = document.getElementById('ficha-os-count-header');
            if (badgeOs) badgeOs.innerText = ordensServico.length;
            if (headerOs) headerOs.innerText = ordensServico.length;

            const tbodyOs = document.getElementById('ficha-os-tbody');
            if (tbodyOs) {
                if (ordensServico.length === 0) {
                    tbodyOs.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px;">
                                Nenhuma ordem de serviço registrada para este cliente.
                            </td>
                        </tr>
                    `;
                } else {
                    tbodyOs.innerHTML = ordensServico.map(os => {
                        const numOs = `#${String(os.numero || os.id).padStart(4, '0')}`;
                        const dataOs = os.data_inicial ? (os.data_inicial.includes('-') ? os.data_inicial.split('-').reverse().join('/') : os.data_inicial) : (os.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : '-');
                        const carroDesc = os.veiculo_modelo || os.veiculo || 'VEÍCULO NÃO INFORMADO';
                        const placa = os.veiculo_placa || os.placa || '-';
                        const totalItens = (os.itens_servicos?.length || 0) + (os.itens_pecas?.length || 0) || (Array.isArray(os.os_itens) ? os.os_itens.length : 0);
                        const totalValor = Number(os.valor_total !== undefined ? os.valor_total : (os.total || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                        return `
                            <tr>
                                <td style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">${numOs}</td>
                                <td style="font-size: 0.88rem;">${dataOs}</td>
                                <td>
                                    <div class="os-desc-block">
                                        <span class="os-desc-carro">${carroDesc}</span>
                                        <span class="os-desc-placa">PLACA: ${placa}</span>
                                    </div>
                                </td>
                                <td style="font-size: 0.88rem;">${totalItens} ${totalItens === 1 ? 'item' : 'itens'}</td>
                                <td style="font-weight: 700; color: #16a34a; font-size: 0.95rem;">${totalValor}</td>
                                <td style="text-align: right; white-space: nowrap;">
                                    <button type="button" class="btn-action-view" onclick="Clientes.abrirOrdemServico(${os.id})" title="Abrir Ordem de Serviço">
                                        <i class="ph ph-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // Botão Editar no Header da Ficha
            const btnEditarHeader = document.getElementById('ficha-btn-editar');
            if (btnEditarHeader) {
                btnEditarHeader.onclick = () => this.abrirEdicao(c.id);
            }

            // Ativa a subview da Ficha (Página Inteira!)
            this.mostrarSubview('ficha');

        } catch (err) {
            console.error('[Clientes] Erro ao abrir ficha:', err);
            alert(`Erro ao abrir ficha do cliente: ${err.message}`);
        }
    },

    imprimirOuVerChecklist(idChecklist) {
        if (!this.clienteAtualFicha) return;
        const chk = (this.clienteAtualFicha.historico_checklists || this.clienteAtualFicha.historico || []).find(h => h.id === idChecklist);
        if (!chk) return;

        const dados = chk.dados_checklist || {};
        const janela = window.open('', '', 'width=900,height=800');
        janela.document.write(`
            <html>
            <head>
                <title>Checklist de Entrada - ${chk.placa_veiculo || ''}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 25px; line-height: 1.5; color: #0f172a; }
                    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .header h2 { margin: 0; color: #1e3a8a; font-size: 1.3rem; }
                    .header span { color: #64748b; font-size: 0.9rem; font-weight: 600; }
                    .box { border: 1px solid #e2e8f0; padding: 14px; margin-bottom: 15px; border-radius: 6px; background: #fafafa; }
                    .box h4 { margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; color: #334155; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
                    .label { color: #64748b; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; }
                    .val { font-size: 0.95rem; font-weight: 600; color: #0f172a; margin-top: 2px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header">
                    <div>
                        <h2>AUTOCAR BS — CHECKLIST DE ENTRADA DO VEÍCULO</h2>
                        <small style="color: #64748b;">Registro de Recepção e Vistoria Inicial</small>
                    </div>
                    <span>Data: ${dados.data_entrada || ''} ${dados.horario_entrada ? 'às ' + dados.horario_entrada : ''}</span>
                </div>
                <div class="box">
                    <h4>1. DADOS DO CLIENTE</h4>
                    <div class="grid">
                        <div><div class="label">Nome</div><div class="val">${this.clienteAtualFicha.nome || ''}</div></div>
                        <div><div class="label">Telefone / WhatsApp</div><div class="val">${this.clienteAtualFicha.telefone || '-'}</div></div>
                        <div><div class="label">CPF / CNPJ</div><div class="val">${this.clienteAtualFicha.cpf || '-'}</div></div>
                        <div><div class="label">Cidade / UF</div><div class="val">${this.clienteAtualFicha.cidade || ''} - ${this.clienteAtualFicha.uf || ''}</div></div>
                    </div>
                </div>
                <div class="box">
                    <h4>2. DADOS DO VEÍCULO NA ENTRADA</h4>
                    <div class="grid-3">
                        <div><div class="label">Placa</div><div class="val" style="color:#2563eb;">${chk.placa_veiculo || dados.veiculo_placa || '-'}</div></div>
                        <div><div class="label">Veículo</div><div class="val">${dados.veiculo_marca || ''} ${dados.veiculo_versao || ''} (${dados.veiculo_ano_modelo || '-'})</div></div>
                        <div><div class="label">KM Entrada</div><div class="val">${dados.veiculo_km || '-'}</div></div>
                        <div><div class="label">Cor</div><div class="val">${dados.veiculo_cor || '-'}</div></div>
                        <div><div class="label">Câmbio / Portas</div><div class="val">${dados.cambio || '-'} / ${dados.portas || '-'}</div></div>
                        <div><div class="label">Combustível / Nível</div><div class="val">${dados.combustivel || '-'} (${dados.nivel_combustivel || '-'})</div></div>
                        <div><div class="label">Luz de Injeção / Painel</div><div class="val">${dados.luz_painel || 'NÃO'}</div></div>
                        <div><div class="label">Entrada por Guincho?</div><div class="val">${dados.guincho || 'NÃO'}</div></div>
                        <div><div class="label">Chassi</div><div class="val" style="font-family:monospace; font-size:0.85rem;">${dados.veiculo_chassi || '-'}</div></div>
                    </div>
                </div>
                <div class="box">
                    <h4>3. SERVIÇO SOLICITADO / RELATO DO CLIENTE</h4>
                    <p style="margin: 0; font-size: 0.95rem; line-height: 1.6;">${chk.observacoes || dados.servico_solicitado || 'Nenhum detalhe adicional informado.'}</p>
                </div>
                <div class="box">
                    <h4>4. RESPONSÁVEL PELA RECEPÇÃO</h4>
                    <p style="margin: 0; font-weight: 600;">${dados.mecanico_responsavel || chk.mecanico_responsavel || 'Não informado'}</p>
                </div>
            </body>
            </html>
        `);
        janela.document.close();
    },

    async abrirOrdemServico(idOs) {
        if (!idOs) return;
        try {
            if (window.Sidebar && typeof Sidebar.atualizarNavegacao === 'function') {
                await Sidebar.atualizarNavegacao('os');
            } else {
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

                const paneOS = document.getElementById('tab-pane-os');
                const btnOS = document.getElementById('tab-btn-os');
                if (paneOS) {
                    paneOS.classList.remove('hidden');
                    if (paneOS.dataset.module && window.ViewLoader) {
                        await ViewLoader.loadView(paneOS.dataset.module, paneOS.id);
                    }
                }
                if (btnOS) btnOS.classList.add('active');
            }

            if (window.OSModule) {
                if (!OSModule.inicializado && typeof OSModule.iniciar === 'function') {
                    await OSModule.iniciar();
                }
                await OSModule.editarOS(idOs);
            }
        } catch (err) {
            console.error('[Clientes] Erro ao abrir ordem de serviço:', err);
        }
    },

    imprimirOuVerOrdemServico(idOs) {
        if (!this.clienteAtualFicha) return;
        const os = (this.clienteAtualFicha.ordens_servico || []).find(o => o.id === idOs || String(o.id) === String(idOs));
        if (!os) return;

        const itensPecas = Array.isArray(os.itens_pecas) ? os.itens_pecas.map(p => ({
            descricao: p.nome || p.descricao || 'Peça',
            quantidade: p.qtd || 1,
            unitario: Number(p.preco || 0),
            subtotal: (Number(p.qtd || 1)) * (Number(p.preco || 0))
        })) : [];

        const itensServicos = Array.isArray(os.itens_servicos) ? os.itens_servicos.map(s => ({
            descricao: s.nome || s.descricao || 'Serviço',
            quantidade: 1,
            unitario: Number(s.preco || 0),
            subtotal: Number(s.preco || 0)
        })) : [];

        const itensLegados = Array.isArray(os.os_itens) ? os.os_itens.map(it => ({
            descricao: it.nome_peca || it.descricao || '-',
            quantidade: it.qtd || 1,
            unitario: Number(it.preco_venda || 0),
            subtotal: Number((it.qtd || 1) * (it.preco_venda || 0))
        })) : [];

        const itens = (itensPecas.length > 0 || itensServicos.length > 0)
            ? [...itensPecas, ...itensServicos]
            : itensLegados;

        const numOs = `#${String(os.numero || os.id).padStart(4, '0')}`;
        const dataOs = os.data_inicial ? (os.data_inicial.includes('-') ? os.data_inicial.split('-').reverse().join('/') : os.data_inicial) : (os.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : '-');
        const totalValNum = Number(os.valor_total !== undefined ? os.valor_total : (os.total || 0));
        const totalOs = totalValNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const carro = os.veiculo_modelo || os.veiculo || '-';
        const placa = os.veiculo_placa || os.placa || '-';
        const obs = os.descricao_problema || os.observacoes || os.observacao || '';

        const janela = window.open('', '', 'width=900,height=800');
        janela.document.write(`
            <html>
            <head>
                <title>Ordem de Serviço ${numOs} - ${this.clienteAtualFicha.nome || ''}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 25px; line-height: 1.5; color: #0f172a; }
                    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .header h2 { margin: 0; color: #1e3a8a; font-size: 1.3rem; }
                    .header span { color: #64748b; font-size: 0.9rem; font-weight: 600; }
                    .box { border: 1px solid #e2e8f0; padding: 14px; margin-bottom: 15px; border-radius: 6px; background: #fafafa; }
                    .box h4 { margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; color: #334155; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .label { color: #64748b; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; }
                    .val { font-size: 0.95rem; font-weight: 600; color: #0f172a; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.9rem; }
                    th, td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
                    th { background: #f1f5f9; color: #475569; font-size: 0.78rem; text-transform: uppercase; font-weight: 700; }
                    .total-box { display: flex; justify-content: flex-end; align-items: center; gap: 14px; margin-top: 15px; font-size: 1.15rem; font-weight: 700; }
                    .total-val { color: #16a34a; font-size: 1.3rem; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header">
                    <div>
                        <h2>AUTOCAR BS — ORDEM DE SERVIÇO ${numOs}</h2>
                        <small style="color: #64748b;">Comprovante de Peças e Serviços</small>
                    </div>
                    <span>Data: ${dataOs}</span>
                </div>
                <div class="box">
                    <h4>1. DADOS DO CLIENTE & VEÍCULO</h4>
                    <div class="grid">
                        <div><div class="label">Cliente</div><div class="val">${this.clienteAtualFicha.nome || os.cliente || ''}</div></div>
                        <div><div class="label">Telefone</div><div class="val">${this.clienteAtualFicha.telefone || '-'}</div></div>
                        <div><div class="label">Veículo</div><div class="val">${carro}</div></div>
                        <div><div class="label">Placa</div><div class="val" style="color:#2563eb;">${placa}</div></div>
                    </div>
                </div>
                <div class="box">
                    <h4>2. PEÇAS & SERVIÇOS EXECUTADOS</h4>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 45px;">#</th>
                                <th>Descrição do Item / Peça</th>
                                <th style="width: 70px; text-align: center;">Qtd</th>
                                <th style="width: 120px; text-align: right;">Unitário</th>
                                <th style="width: 130px; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itens.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:15px; color:#64748b;">Nenhum item discriminado.</td></tr>' : itens.map((it, i) => {
                                return `
                                    <tr>
                                        <td>${i + 1}</td>
                                        <td>${UI.escapeHtml(it.descricao || '-')}</td>
                                        <td style="text-align: center;">${it.quantidade}</td>
                                        <td style="text-align: right;">${Number(it.unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td style="text-align: right; font-weight: 600;">${Number(it.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="total-box">
                        <span>TOTAL DA OS:</span>
                        <span class="total-val">${totalOs}</span>
                    </div>
                </div>
                ${obs ? `
                <div class="box">
                    <h4>3. OBSERVAÇÕES</h4>
                    <p style="margin: 0;">${UI.escapeHtml(obs)}</p>
                </div>
                ` : ''}
            </body>
            </html>
        `);
        janela.document.close();
    },

    imprimirOuVerOS(idChecklist) {
        this.imprimirOuVerChecklist(idChecklist);
    },

    /**
     * Abre página de cadastro de novo cliente
     */
    abrirNovo() {
        const form = document.getElementById('form-cliente-erp');
        if (form) form.reset();

        document.getElementById('cad_cliente_id').value = '';
        document.getElementById('cadastro-cliente-titulo').innerHTML = `
            <i class="ph ph-user-plus"></i>
            <span>Novo Cliente</span>
        `;
        document.getElementById('texto-btn-salvar-cliente').innerText = 'Salvar Cliente';

        this.veiculosTemporarios = [];
        this.renderizarVeiculosCadastro();

        this.mostrarSubview('cadastro');

        const inputNome = document.getElementById('cad_nome');
        if (inputNome) setTimeout(() => inputNome.focus(), 100);
    },

    abrirModalNovo() {
        this.abrirNovo();
    },

    /**
     * Abre página de edição de cliente
     */
    async abrirEdicao(id) {
        try {
            const res = await API.obterCliente(id);
            if (!res.success || !res.cliente) throw new Error(res.mensagem || 'Cliente não encontrado.');

            const c = res.cliente;
            document.getElementById('cad_cliente_id').value = c.id;
            document.getElementById('cad_nome').value = c.nome || '';
            document.getElementById('cad_cpf').value = c.cpf || '';
            document.getElementById('cad_telefone').value = c.telefone || '';
            document.getElementById('cad_cep').value = c.cep || '';
            document.getElementById('cad_uf').value = c.uf || '';
            document.getElementById('cad_cidade').value = c.cidade || '';
            document.getElementById('cad_bairro').value = c.bairro || '';
            document.getElementById('cad_endereco').value = c.endereco || '';
            document.getElementById('cad_numero').value = c.numero || '';

            document.getElementById('cadastro-cliente-titulo').innerHTML = `
                <i class="ph ph-note-pencil"></i>
                <span>Editar Cliente #${c.id}</span>
            `;
            document.getElementById('texto-btn-salvar-cliente').innerText = 'Atualizar Cliente';

            this.veiculosTemporarios = Array.isArray(c.veiculos) ? [...c.veiculos] : [];
            this.renderizarVeiculosCadastro();

            this.mostrarSubview('cadastro');

        } catch (err) {
            console.error('[Clientes] Erro ao abrir edição:', err);
            alert(`Erro ao abrir cliente: ${err.message}`);
        }
    },

    /**
     * Salva cliente
     */
    async salvarCliente(e) {
        e.preventDefault();

        const btnSubmit = document.getElementById('btn-salvar-cliente-submit');
        const txtOriginal = btnSubmit ? btnSubmit.innerHTML : '';

        try {
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Gravando...`;
            }

            const id = document.getElementById('cad_cliente_id').value;
            const dados = {
                id: id ? parseInt(id) : null,
                nome: document.getElementById('cad_nome').value,
                cpf: document.getElementById('cad_cpf').value,
                telefone: document.getElementById('cad_telefone').value,
                cep: document.getElementById('cad_cep').value,
                uf: document.getElementById('cad_uf').value,
                cidade: document.getElementById('cad_cidade').value,
                bairro: document.getElementById('cad_bairro').value,
                endereco: document.getElementById('cad_endereco').value,
                numero: document.getElementById('cad_numero').value,
                veiculos: this.veiculosTemporarios
            };

            const res = await API.salvarCliente(dados);
            if (!res.success) throw new Error(res.mensagem || 'Falha ao salvar cliente.');

            this.voltarParaLista();
            await this.carregarLista(this.paginaAtual);

        } catch (err) {
            console.error('[Clientes] Erro ao salvar cliente:', err);
            alert(`Erro ao salvar cliente: ${err.message}`);
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = txtOriginal;
            }
        }
    },

    /**
     * Veículos no cadastro
     */
    adicionarVeiculoTemp() {
        const inputPlaca = document.getElementById('temp_placa');
        const placa = (inputPlaca ? inputPlaca.value : '').trim().toUpperCase();

        if (!placa) {
            alert('Informe pelo menos a placa do veículo.');
            if (inputPlaca) inputPlaca.focus();
            return;
        }

        const veiculo = {
            placa,
            marca: document.getElementById('temp_marca').value.trim().toUpperCase(),
            modelo: document.getElementById('temp_modelo').value.trim().toUpperCase(),
            ano: document.getElementById('temp_ano').value.trim(),
            cor: document.getElementById('temp_cor').value.trim().toUpperCase(),
            combustivel: document.getElementById('temp_combustivel').value.trim().toUpperCase(),
            chassi: document.getElementById('temp_chassi').value.trim().toUpperCase()
        };

        this.veiculosTemporarios.push(veiculo);
        this.renderizarVeiculosCadastro();

        if (inputPlaca) inputPlaca.value = '';
        document.getElementById('temp_marca').value = '';
        document.getElementById('temp_modelo').value = '';
        document.getElementById('temp_ano').value = '';
        document.getElementById('temp_cor').value = '';
        document.getElementById('temp_combustivel').value = '';
        document.getElementById('temp_chassi').value = '';

        if (inputPlaca) inputPlaca.focus();
    },

    removerVeiculoTemp(index) {
        this.veiculosTemporarios.splice(index, 1);
        this.renderizarVeiculosCadastro();
    },

    renderizarVeiculosCadastro() {
        const tbody = document.getElementById('tbody-veiculos-cadastro');
        if (!tbody) return;

        if (this.veiculosTemporarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 15px;">
                        Nenhum veículo adicionado ainda. Preencha acima e clique em Adicionar.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.veiculosTemporarios.map((v, i) => `
            <tr>
                <td><strong class="placa-badge">${v.placa}</strong></td>
                <td>${v.marca || ''} ${v.modelo || ''}</td>
                <td>${v.ano || '-'}</td>
                <td><span class="combustivel-badge">${v.combustivel || 'FLEX'}</span></td>
                <td style="text-align: right;">
                    <button type="button" class="btn-action-delete" style="width: 28px; height: 28px; font-size: 0.85rem;" onclick="Clientes.removerVeiculoTemp(${i})" title="Remover Veículo">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    /**
     * Exclusão de cliente
     */
    abrirModalExcluir(id, nome) {
        this.clienteIdParaExcluir = id;
        const txt = document.getElementById('texto-confirmar-exclusao-cliente');
        if (txt) {
            txt.innerHTML = `Tem certeza que deseja excluir permanentemente o cliente <strong>${nome}</strong> (#${id}) e todos os veículos vinculados a ele? Esta ação não pode ser desfeita.`;
        }
        const modal = document.getElementById('modal-confirmacao-excluir-cliente');
        if (modal) modal.classList.remove('hidden');
    },

    async confirmarExclusao() {
        if (!this.clienteIdParaExcluir) return;

        const btnConfirma = document.getElementById('btn-confirmar-exclusao-cliente');
        const txtOriginal = btnConfirma ? btnConfirma.innerHTML : '';

        try {
            if (btnConfirma) {
                btnConfirma.disabled = true;
                btnConfirma.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Excluindo...`;
            }

            const res = await API.excluirCliente(this.clienteIdParaExcluir);
            if (!res.success) throw new Error(res.mensagem || 'Falha ao excluir cliente.');

            const modal = document.getElementById('modal-confirmacao-excluir-cliente');
            if (modal) modal.classList.add('hidden');

            this.clienteIdParaExcluir = null;

            await this.carregarLista(this.paginaAtual);

        } catch (err) {
            console.error('[Clientes] Erro ao excluir:', err);
            alert(`Erro ao excluir: ${err.message}`);
        } finally {
            if (btnConfirma) {
                btnConfirma.disabled = false;
                btnConfirma.innerHTML = txtOriginal;
            }
        }
    },

    /**
     * ViaCEP
     */
    async buscarViaCEP(cep) {
        const limpo = (cep || '').replace(/\D/g, '');
        if (limpo.length !== 8) return;

        const iconLoading = document.getElementById('icon-cep-cliente-loading');
        if (iconLoading) iconLoading.className = 'ph ph-spinner ph-spin';

        try {
            const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
            const dados = await resp.json();

            if (dados.erro) {
                alert('CEP não encontrado nos correios.');
                return;
            }

            const inputEnd = document.getElementById('cad_endereco');
            const inputBai = document.getElementById('cad_bairro');
            const inputCid = document.getElementById('cad_cidade');
            const inputUf  = document.getElementById('cad_uf');
            const inputNum = document.getElementById('cad_numero');

            if (inputEnd && dados.logradouro) inputEnd.value = dados.logradouro.toUpperCase();
            if (inputBai && dados.bairro) inputBai.value = dados.bairro.toUpperCase();
            if (inputCid && dados.localidade) inputCid.value = dados.localidade.toUpperCase();
            if (inputUf && dados.uf) inputUf.value = dados.uf.toUpperCase();

            if (inputNum) inputNum.focus();

        } catch (err) {
            console.warn('[Clientes] Erro ao consultar ViaCEP:', err);
        } finally {
            if (iconLoading) iconLoading.className = 'ph ph-magnifying-glass';
        }
    },

    /**
     * Consulta automática de placa
     */
    async buscarPlacaAPI(placa) {
        const limpa = (placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (limpa.length !== 7) return;

        const iconLoading = document.getElementById('icon-placa-cliente-loading');
        if (iconLoading) iconLoading.className = 'ph ph-spinner ph-spin';

        try {
            const tokenPlacas = localStorage.getItem('autocar_placas_token') || 'COLE_SEU_TOKEN_AQUI';
            if (tokenPlacas && tokenPlacas !== 'COLE_SEU_TOKEN_AQUI') {
                const urlApiOriginal = 'https://placas.app.br/api/v1/placas/numero';
                const urlProxy = 'https://corsproxy.io/?' + encodeURIComponent(urlApiOriginal);

                const resp = await fetch(urlProxy, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokenPlacas}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ placa: limpa })
                });

                if (resp.ok) {
                    const dados = await resp.json();
                    if (dados) {
                        if (dados.marca) document.getElementById('temp_marca').value = dados.marca.toUpperCase();
                        if (dados.modelo) document.getElementById('temp_modelo').value = dados.modelo.toUpperCase();
                        if (dados.cor) document.getElementById('temp_cor').value = dados.cor.toUpperCase();
                        if (dados.chassi) document.getElementById('temp_chassi').value = dados.chassi.toUpperCase();
                        if (dados.anoFabricacao && dados.anoModelo) {
                            document.getElementById('temp_ano').value = `${dados.anoFabricacao}/${dados.anoModelo}`;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[Clientes] Consulta de placa indisponível:', err);
        } finally {
            if (iconLoading) iconLoading.className = 'ph ph-magnifying-glass';
        }
    },

    /**
     * Máscaras
     */
    configurarMascaras() {
        const mascaras = {
            cpf_cnpj(v) {
                const limpo = v.replace(/\D/g, '');
                if (limpo.length <= 11) {
                    return limpo
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
                        .substring(0, 14);
                } else {
                    return limpo
                        .replace(/^(\d{2})(\d)/, '$1.$2')
                        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                        .replace(/\.(\d{3})(\d)/, '.$1/$2')
                        .replace(/(\d{4})(\d)/, '$1-$2')
                        .substring(0, 18);
                }
            },
            telefone(v) {
                return v
                    .replace(/\D/g, '')
                    .replace(/(\d{2})(\d)/, '($1) $2')
                    .replace(/(\d{4,5})(\d{4})/, '$1-$2')
                    .substring(0, 15);
            },
            cep(v) {
                return v
                    .replace(/\D/g, '')
                    .replace(/(\d{5})(\d)/, '$1-$2')
                    .substring(0, 9);
            },
            placa(v) {
                return v
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .replace(/^([A-Z]{3})(\d)/, '$1-$2')
                    .substring(0, 8);
            },
            ano_modelo(v) {
                const limpo = v.replace(/\D/g, '');
                if (limpo.length > 4) {
                    return limpo.replace(/^(\d{4})(\d{0,4}).*/, '$1/$2').substring(0, 9);
                }
                return limpo;
            },
            chassi(v) {
                return v.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 17);
            }
        };

        document.querySelectorAll('[data-mascara]').forEach(input => {
            if (input.dataset.hasMask) return;
            input.dataset.hasMask = 'true';
            input.addEventListener('input', (e) => {
                const tipo = e.target.getAttribute('data-mascara');
                if (mascaras[tipo]) {
                    e.target.value = mascaras[tipo](e.target.value);
                }
            });
        });
    }
};

window.Clientes = Clientes;
