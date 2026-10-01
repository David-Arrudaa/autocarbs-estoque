/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Gestão de Clientes & Veículos (clientes.js)
 * =========================================================
 * Controle completo de cadastro, busca inteligente, garagem
 * de veículos, histórico e integrações (ViaCEP & Placas).
 */

const Clientes = {
    paginaAtual: 1,
    totalPaginas: 1,
    limite: 15,
    termoBusca: '',
    veiculosTemporarios: [],
    clienteIdParaExcluir: null,
    timerBusca: null,
    iniciado: false,

    /**
     * Ponto de entrada do módulo
     */
    async iniciar() {
        this.configurarEventos();
        await Promise.all([
            this.carregarMetricas(),
            this.carregarLista(1)
        ]);
        this.iniciado = true;
    },

    /**
     * Liga os event listeners da interface
     */
    configurarEventos() {
        const inputBusca = document.getElementById('input-busca-clientes');
        const btnLimparBusca = document.getElementById('btn-limpar-busca-clientes');
        const btnNovo = document.getElementById('btn-novo-cliente');
        const btnReload = document.getElementById('btn-recarregar-clientes');
        const formCliente = document.getElementById('form-cliente-erp');
        const btnAddVeiculo = document.getElementById('btn-adicionar-veiculo-lista');

        // Busca com debounce
        if (inputBusca && !inputBusca.dataset.hasListener) {
            inputBusca.dataset.hasListener = 'true';
            inputBusca.addEventListener('input', (e) => {
                const val = e.target.value;
                if (btnLimparBusca) {
                    btnLimparBusca.style.display = val ? 'flex' : 'none';
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
                await Promise.all([this.carregarMetricas(), this.carregarLista(this.paginaAtual)]);
                if (icon) icon.classList.remove('ph-spin');
            });
        }

        if (btnNovo && !btnNovo.dataset.hasListener) {
            btnNovo.dataset.hasListener = 'true';
            btnNovo.addEventListener('click', () => this.abrirModalNovo());
        }

        // Submissão do formulário
        if (formCliente && !formCliente.dataset.hasListener) {
            formCliente.dataset.hasListener = 'true';
            formCliente.addEventListener('submit', (e) => this.salvarCliente(e));
        }

        // Adição de veículo temporário
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

        // Modais - Fechar
        this.ligarFechamentoModal('modal-cadastro-cliente', 'btn-fechar-modal-cliente', 'btn-cancelar-cliente');
        this.ligarFechamentoModal('modal-ficha-cliente', 'btn-fechar-ficha-cliente', 'ficha-btn-fechar');
        this.ligarFechamentoModal('modal-confirmacao-excluir-cliente', null, 'btn-cancelar-exclusao-cliente');

        const btnConfirmaExcluir = document.getElementById('btn-confirmar-exclusao-cliente');
        if (btnConfirmaExcluir && !btnConfirmaExcluir.dataset.hasListener) {
            btnConfirmaExcluir.dataset.hasListener = 'true';
            btnConfirmaExcluir.addEventListener('click', () => this.confirmarExclusao());
        }

        // Ligar máscaras de inputs
        this.configurarMascaras();

        // Ligar ViaCEP
        const inputCep = document.getElementById('cad_cep');
        if (inputCep && !inputCep.dataset.hasCepListener) {
            inputCep.dataset.hasCepListener = 'true';
            inputCep.addEventListener('blur', () => this.buscarViaCEP(inputCep.value));
        }

        // Ligar busca de placa no veículo temporário
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

        // Fechar ao clicar fora
        if (!modal.dataset.hasBackdropListener) {
            modal.dataset.hasBackdropListener = 'true';
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
    },

    /**
     * Carrega indicadores numéricos para os cartões de topo
     */
    async carregarMetricas() {
        try {
            const res = await API.metricasClientes();
            if (res && res.metricas) {
                const elCli = document.getElementById('kpi-total-clientes');
                const elVei = document.getElementById('kpi-total-veiculos');
                const elChk = document.getElementById('kpi-total-checklists');

                if (elCli) elCli.innerText = res.metricas.totalClientes.toLocaleString('pt-BR');
                if (elVei) elVei.innerText = res.metricas.totalVeiculos.toLocaleString('pt-BR');
                if (elChk) elChk.innerText = res.metricas.totalChecklists.toLocaleString('pt-BR');
            }
        } catch (err) {
            console.warn('[Clientes] Erro ao carregar métricas:', err);
        }
    },

    /**
     * Carrega lista paginada de clientes
     */
    async carregarLista(pagina = 1) {
        const tbody = document.getElementById('tbody-clientes');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="ph ph-spinner ph-spin" style="font-size: 1.8rem; display: block; margin-bottom: 8px; color: var(--primary);"></i>
                    Carregando base de clientes...
                </td>
            </tr>
        `;

        try {
            const res = await API.listarClientes({
                busca: this.termoBusca,
                pagina: pagina,
                limite: this.limite,
                ordenarPor: 'nome',
                ordem: 'asc'
            });

            if (!res.success) throw new Error(res.mensagem || 'Falha ao buscar clientes.');

            this.paginaAtual = res.paginacao.pagina;
            this.totalPaginas = res.paginacao.totalPaginas;

            this.renderizarTabela(res.clientes || [], res.paginacao);
            this.atualizarControlesPaginacao(res.paginacao);

        } catch (err) {
            console.error('[Clientes] Erro ao carregar lista:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 35px; color: #ef4444;">
                        <i class="ph ph-warning-circle" style="font-size: 1.8rem; display: block; margin-bottom: 8px;"></i>
                        Erro ao carregar clientes: ${err.message}
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Renderiza a tabela de clientes
     */
    renderizarTabela(clientes, paginacao) {
        const tbody = document.getElementById('tbody-clientes');
        if (!tbody) return;

        if (clientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <i class="ph ph-users" style="font-size: 2.2rem; display: block; margin-bottom: 10px; opacity: 0.4;"></i>
                        Nenhum cliente encontrado ${this.termoBusca ? `para "${this.termoBusca}"` : ''}.
                    </td>
                </tr>
            `;
            return;
        }

        const linhas = clientes.map(cliente => {
            const idBadge = `<span class="badge" style="font-family: monospace; font-weight: 700; background: var(--bg-body); border: 1px solid var(--border);">#${cliente.id}</span>`;
            const nome = (cliente.nome || 'SEM NOME').toUpperCase();
            const cpf = cliente.cpf || '<span style="color: var(--text-secondary);">-</span>';
            
            // Telefone com WhatsApp
            let telefoneHtml = '<span style="color: var(--text-secondary);">-</span>';
            if (cliente.telefone) {
                const zapNum = cliente.telefone.replace(/\D/g, '');
                const zapUrl = zapNum ? `https://wa.me/55${zapNum}` : null;
                telefoneHtml = `
                    <div class="cliente-contato-cell">
                        <span>${cliente.telefone}</span>
                        ${zapUrl ? `
                            <a href="${zapUrl}" target="_blank" class="btn-whatsapp-icon" title="Abrir conversa no WhatsApp">
                                <i class="ph-bold ph-whatsapp-logo"></i>
                            </a>
                        ` : ''}
                    </div>
                `;
            }

            // Veículos Vinculados (badges)
            const veiculos = Array.isArray(cliente.veiculos) ? cliente.veiculos : [];
            let veiculosHtml = '<span style="color: var(--text-secondary); font-size: 0.85rem;">Nenhum carro</span>';
            if (veiculos.length > 0) {
                veiculosHtml = `
                    <div class="veiculos-chips-container">
                        ${veiculos.slice(0, 2).map(v => `
                            <span class="veiculo-chip" title="${v.marca || ''} ${v.modelo || ''} (${v.ano || ''})">
                                <strong>${v.placa}</strong> ${v.modelo ? `· ${v.modelo.split(' ')[0]}` : ''}
                            </span>
                        `).join('')}
                        ${veiculos.length > 2 ? `
                            <span class="veiculo-chip-more" title="${veiculos.slice(2).map(v => v.placa).join(', ')}">
                                +${veiculos.length - 2}
                            </span>
                        ` : ''}
                    </div>
                `;
            }

            // Cidade / UF
            const localizacao = (cliente.cidade || cliente.uf)
                ? `${cliente.cidade || ''}${cliente.cidade && cliente.uf ? ' / ' : ''}${cliente.uf || ''}`
                : '<span style="color: var(--text-secondary);">-</span>';

            return `
                <tr>
                    <td>${idBadge}</td>
                    <td>
                        <strong class="cliente-nome-link" onclick="Clientes.abrirFicha(${cliente.id})" title="Ver ficha completa">
                            ${nome}
                        </strong>
                    </td>
                    <td style="font-family: monospace; font-size: 0.85rem;">${cpf}</td>
                    <td>${telefoneHtml}</td>
                    <td>${veiculosHtml}</td>
                    <td>${localizacao}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button type="button" class="btn-action-table" onclick="Clientes.abrirFicha(${cliente.id})" title="Ficha Completa 360°">
                            <i class="ph ph-eye"></i>
                        </button>
                        <button type="button" class="btn-action-table" onclick="Clientes.abrirEdicao(${cliente.id})" title="Editar Cliente">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button type="button" class="btn-action-table btn-action-danger" onclick="Clientes.abrirModalExcluir(${cliente.id}, '${nome.replace(/'/g, "\\'")}')" title="Excluir">
                            <i class="ph ph-trash"></i>
                        </button>
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
     * Abre modal para cadastro de novo cliente
     */
    abrirModalNovo() {
        const form = document.getElementById('form-cliente-erp');
        if (form) form.reset();

        document.getElementById('cad_cliente_id').value = '';
        document.getElementById('modal-cliente-titulo').innerHTML = `
            <i class="ph ph-user-plus"></i>
            <span>Novo Cliente</span>
        `;
        document.getElementById('texto-btn-salvar-cliente').innerText = 'Salvar Cliente';

        this.veiculosTemporarios = [];
        this.renderizarVeiculosCadastro();

        const modal = document.getElementById('modal-cadastro-cliente');
        if (modal) modal.classList.remove('hidden');

        const inputNome = document.getElementById('cad_nome');
        if (inputNome) setTimeout(() => inputNome.focus(), 100);
    },

    /**
     * Abre modal para edição de cliente existente
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

            document.getElementById('modal-cliente-titulo').innerHTML = `
                <i class="ph ph-pencil-simple"></i>
                <span>Editar Cliente <span style="font-family: monospace; color: var(--primary);">#${c.id}</span></span>
            `;
            document.getElementById('texto-btn-salvar-cliente').innerText = 'Atualizar Cliente';

            this.veiculosTemporarios = Array.isArray(c.veiculos) ? [...c.veiculos] : [];
            this.renderizarVeiculosCadastro();

            // Fecha a ficha se estiver aberta e abre a edição
            const modalFicha = document.getElementById('modal-ficha-cliente');
            if (modalFicha) modalFicha.classList.add('hidden');

            const modalCad = document.getElementById('modal-cadastro-cliente');
            if (modalCad) modalCad.classList.remove('hidden');

        } catch (err) {
            console.error('[Clientes] Erro ao abrir edição:', err);
            alert(`Erro ao abrir cliente: ${err.message}`);
        }
    },

    /**
     * Abre Ficha 360° com histórico, garagem e dados completos
     */
    async abrirFicha(id) {
        try {
            const res = await API.obterCliente(id);
            if (!res.success || !res.cliente) throw new Error(res.mensagem || 'Cliente não encontrado.');

            const c = res.cliente;
            const iniciais = (c.nome || 'CL')
                .split(' ')
                .filter(p => p.length > 0)
                .slice(0, 2)
                .map(p => p[0])
                .join('')
                .toUpperCase();

            document.getElementById('ficha-cliente-avatar').innerText = iniciais || 'CL';
            document.getElementById('ficha-cliente-nome').innerText = (c.nome || 'SEM NOME').toUpperCase();
            document.getElementById('ficha-cliente-id').innerText = `#${c.id}`;

            const dataCadastro = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-';
            document.getElementById('ficha-cliente-desde').innerText = `Cadastrado em ${dataCadastro}`;

            document.getElementById('ficha-cpf').innerText = c.cpf || 'Não informado';
            document.getElementById('ficha-telefone').innerText = c.telefone || 'Não informado';

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

            // Endereço e Google Maps
            const partesEnd = [c.endereco, c.numero ? `Nº ${c.numero}` : '', c.bairro, c.cidade, c.uf, c.cep].filter(Boolean);
            const enderecoFormatado = partesEnd.length > 0 ? partesEnd.join(', ') : 'Endereço não cadastrado';
            document.getElementById('ficha-endereco').innerText = enderecoFormatado;

            const btnMaps = document.getElementById('ficha-btn-maps');
            if (btnMaps) {
                if (c.endereco && c.cidade) {
                    btnMaps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoFormatado)}`;
                    btnMaps.style.display = 'inline-flex';
                } else {
                    btnMaps.style.display = 'none';
                }
            }

            // Garagem de Veículos
            const veiculos = Array.isArray(c.veiculos) ? c.veiculos : [];
            document.getElementById('ficha-veiculos-count').innerText = veiculos.length;
            const containerVei = document.getElementById('ficha-veiculos-container');
            if (containerVei) {
                if (veiculos.length === 0) {
                    containerVei.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 15px; background: var(--bg-body); border-radius: 8px; border: 1px dashed var(--border);">
                            Nenhum veículo vinculado a este cliente.
                        </div>
                    `;
                } else {
                    containerVei.innerHTML = veiculos.map(v => `
                        <div class="ficha-veiculo-card">
                            <div class="ficha-veiculo-header">
                                <span class="placa-badge">${v.placa}</span>
                                <span class="combustivel-badge">${v.combustivel || 'FLEX'}</span>
                            </div>
                            <div class="ficha-veiculo-body">
                                <strong>${v.marca || ''} ${v.modelo || ''}</strong>
                                <div class="ficha-veiculo-sub">
                                    <span>Ano: ${v.ano || '-'}</span>
                                    <span>Cor: ${v.cor || '-'}</span>
                                </div>
                                ${v.chassi ? `<div class="ficha-veiculo-chassi"><i class="ph ph-barcode"></i> ${v.chassi}</div>` : ''}
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Histórico de Checklists
            const checklists = Array.isArray(c.historico) ? c.historico : [];
            document.getElementById('ficha-checklists-count').innerText = checklists.length;
            const tbodyChk = document.getElementById('ficha-checklists-tbody');
            if (tbodyChk) {
                if (checklists.length === 0) {
                    tbodyChk.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 15px;">
                                Nenhum checklist registrado para este cliente até o momento.
                            </td>
                        </tr>
                    `;
                } else {
                    tbodyChk.innerHTML = checklists.map(chk => {
                        const dados = chk.dados_checklist || {};
                        const dataEntrada = dados.data_entrada || (chk.created_at ? new Date(chk.created_at).toLocaleDateString('pt-BR') : '-');
                        const placa = chk.placa_veiculo || dados.veiculo_placa || '-';
                        const mecanico = chk.mecanico_responsavel || dados.mecanico_responsavel || '-';
                        const relato = chk.observacoes || dados.servico_solicitado || '-';

                        return `
                            <tr>
                                <td>${dataEntrada}</td>
                                <td><span class="placa-mini-badge">${placa}</span></td>
                                <td>${mecanico}</td>
                                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${relato}</td>
                                <td style="text-align: right;">
                                    <span class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--primary); border: 1px solid var(--primary);">Registrado</span>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // Botão de editar dentro da ficha
            const btnEditar = document.getElementById('ficha-btn-editar');
            if (btnEditar) {
                btnEditar.onclick = () => this.abrirEdicao(c.id);
            }

            const modalFicha = document.getElementById('modal-ficha-cliente');
            if (modalFicha) modalFicha.classList.remove('hidden');

        } catch (err) {
            console.error('[Clientes] Erro ao abrir ficha:', err);
            alert(`Erro ao abrir ficha do cliente: ${err.message}`);
        }
    },

    /**
     * Salva cliente (criação ou edição)
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

            // Fecha modal
            const modal = document.getElementById('modal-cadastro-cliente');
            if (modal) modal.classList.add('hidden');

            // Feedback visual
            if (window.UI && typeof UI.mostrarToast === 'function') {
                UI.mostrarToast(res.mensagem || 'Cliente salvo com sucesso!', 'sucesso');
            } else {
                alert(res.mensagem || 'Cliente salvo com sucesso!');
            }

            // Atualiza lista e métricas
            await Promise.all([
                this.carregarMetricas(),
                this.carregarLista(this.paginaAtual)
            ]);

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
     * Adiciona veículo à lista temporária dentro do modal de cadastro
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

        // Limpa campos temporários
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
                    <button type="button" class="btn-action-table btn-action-danger" onclick="Clientes.removerVeiculoTemp(${i})" title="Remover Veículo">
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

            if (window.UI && typeof UI.mostrarToast === 'function') {
                UI.mostrarToast('Cliente excluído com sucesso!', 'sucesso');
            } else {
                alert('Cliente excluído com sucesso!');
            }

            await Promise.all([
                this.carregarMetricas(),
                this.carregarLista(this.paginaAtual)
            ]);

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
     * Integração ViaCEP (Busca de Endereço Automática)
     */
    async buscarViaCEP(cep) {
        const limpo = (cep || '').replace(/\D/g, '');
        if (limpo.length !== 8) return;

        const iconLoading = document.getElementById('icon-cep-cliente-loading');
        if (iconLoading) {
            iconLoading.className = 'ph ph-spinner ph-spin';
        }

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
            if (iconLoading) {
                iconLoading.className = 'ph ph-magnifying-glass';
            }
        }
    },

    /**
     * Busca na API de Placas (placas.app.br ou similar)
     */
    async buscarPlacaAPI(placa) {
        const limpa = (placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (limpa.length !== 7) return;

        const iconLoading = document.getElementById('icon-placa-cliente-loading');
        if (iconLoading) {
            iconLoading.className = 'ph ph-spinner ph-spin';
        }

        try {
            // Se houver token configurado
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
            console.warn('[Clientes] Consulta de placa automática indisponível:', err);
        } finally {
            if (iconLoading) {
                iconLoading.className = 'ph ph-magnifying-glass';
            }
        }
    },

    /**
     * Máscaras de entrada em tempo real
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
