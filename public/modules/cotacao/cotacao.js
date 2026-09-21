/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo de Cotação de Peças & Orçamentos (Integrado ao Estoque)
 * =========================================================
 */

const Cotacao = {
    currentId: null,
    currentHistoryGroupKey: null,
    state: {
        vendedores: [],
        pecas: [],
        frete: {},
        labor: { type: 'popular', rate: 200, items: [] },
        lavagem: false,
        margin: 90
    },
    iniciado: false,

    /**
     * Inicializa o módulo quando a view for inserida no DOM
     */
    init() {
        if (!document.getElementById('cot-carModel')) return;
        if (this.iniciado) return;
        this.iniciado = true;

        const draft = localStorage.getItem('cotador_v40_draft');
        if (draft) {
            try {
                const saved = JSON.parse(draft);
                if (saved.currentId) {
                    this.currentId = String(saved.currentId);
                    const idInput = document.getElementById('cot-quoteId');
                    if (idInput) idInput.value = String(saved.currentId);
                }
                if (saved.state) {
                    this.state = saved.state;
                    if (this.state.margin === undefined || this.state.margin === null) {
                        this.state.margin = 90;
                    }
                    const modelEl = document.getElementById('cot-carModel');
                    const plateEl = document.getElementById('cot-carPlate');
                    if (modelEl && saved.model) modelEl.value = saved.model;
                    if (plateEl && saved.plate) plateEl.value = saved.plate;
                }
            } catch (e) {
                console.error("Erro ao carregar rascunho de cotação:", e);
            }
        }

        if (!this.state.pecas || this.state.pecas.length === 0) {
            this.state.pecas = [];
            this.addPartRow();
        } else {
            this.state.pecas.forEach(p => {
                if (p.vencedor === 'ESTOQUE') p.emEstoque = true;
            });
        }

        this.updateLavagemButton();
        this.renderAll();
        this.updateStatusBadge();
    },

    formatPlate(input) {
        let val = input.value.toUpperCase();
        val = val.replace(/[^A-Z0-9]/g, '');
        input.value = val;
        this.updateStatusBadge();
    },

    updateStatusBadge() {
        const badge = document.getElementById('cot-statusBadge');
        const btnText = document.getElementById('cot-btnSaveText');
        const btn = document.getElementById('cot-btnSave');
        const quoteIdEl = document.getElementById('cot-quoteId');
        const effectiveId = (quoteIdEl && quoteIdEl.value) ? quoteIdEl.value.trim() : (this.currentId || '');

        if (effectiveId) {
            if (badge) {
                badge.className = 'cot-status-badge cot-badge-editing';
                badge.innerHTML = `<i class="ph ph-note-pencil"></i> Editando Salvo`;
                badge.title = 'Editando cotação existente (atualiza sem duplicar)';
            }
            if (btnText) btnText.textContent = 'ATUALIZAR';
            if (btn) btn.title = 'Atualizar cotação existente (não cria duplicada)';
        } else {
            if (badge) {
                badge.className = 'cot-status-badge cot-badge-new';
                badge.innerHTML = `<i class="ph ph-sparkle"></i> Nova Cotação`;
                badge.title = 'Cotação nova criada do zero';
            }
            if (btnText) btnText.textContent = 'SALVAR';
            if (btn) btn.title = 'Salvar como nova cotação no histórico';
        }
    },

    saveDraft() {
        const modelEl = document.getElementById('cot-carModel');
        const plateEl = document.getElementById('cot-carPlate');
        const quoteIdEl = document.getElementById('cot-quoteId');
        const effectiveId = (quoteIdEl && quoteIdEl.value) ? quoteIdEl.value.trim() : (this.currentId || null);
        const data = {
            currentId: effectiveId,
            state: this.state,
            model: modelEl ? modelEl.value : '',
            plate: plateEl ? plateEl.value : ''
        };
        localStorage.setItem('cotador_v40_draft', JSON.stringify(data));
        this.updateStatusBadge();
    },

    renderAll() {
        this.renderHeader();
        this.renderBody();
        this.renderTags();
        this.updateLiveSummary();
    },

    updateLiveSummary() {
        const elCount = document.getElementById('cot-sum-count');
        const elWinners = document.getElementById('cot-sum-winners');
        const elTotal = document.getElementById('cot-sum-total');
        if (!elCount && !elWinners && !elTotal) return;

        let totalParts = this.state.pecas.length;
        let winnersCount = 0;
        let totalVenda = 0;

        this.state.pecas.forEach(p => {
            if (p.vencedor) {
                winnersCount++;
                const pr = p.precos[p.vencedor];
                if (pr) {
                    let v = pr.venda;
                    if (v === null || v === undefined) {
                        v = this.calculateSellPrice(pr.custo, p.vencedor, true);
                    }
                    totalVenda += (Number(v) || 0) * (Number(p.qty) || 1);
                }
            }
        });

        if (elCount) elCount.innerText = totalParts;
        if (elWinners) elWinners.innerText = winnersCount;
        if (elTotal) elTotal.innerText = `R$ ${totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    // --- LÓGICA DE LAVAGEM ---
    toggleLavagem() {
        this.state.lavagem = !this.state.lavagem;
        this.updateLavagemButton();
        this.recalcAllPricesAndRefresh();
    },

    updateLavagemButton() {
        const btn = document.getElementById('cot-btnLavagem');
        if (!btn) return;
        if (this.state.lavagem) {
            btn.innerHTML = '<i class="ph ph-drop"></i> <span>LAVAGEM ON (R$ 100)</span>';
            btn.className = 'btn btn-cyan-cot cot-blink-lavagem';
        } else {
            btn.innerHTML = '<i class="ph ph-drop"></i> <span>INCLUIR LAVAGEM</span>';
            btn.className = 'btn btn-cyan-cot';
        }
        this.saveDraft();
    },

    // --- LÓGICA DE MARGEM DINÂMICA (PADRÃO 90%) ---
    updateMargin(val) {
        let m = parseFloat(val);
        if (isNaN(m) || m < 0) m = 90;
        this.state.margin = m;
        this.recalcAllPricesAndRefresh();
        this.saveDraft();
    },

    /**
     * Calcula o preço de venda de uma peça com base na margem dinâmica,
     * diluição de frete do fornecedor e diluição da lavagem.
     */
    calculateSellPrice(custo, vendor, isWinnerRow) {
        if (custo === null || custo === undefined || isNaN(custo)) return null;

        const marginPerc = (this.state.margin !== undefined && this.state.margin !== null) 
            ? Number(this.state.margin) 
            : 90;
        const multiplier = 1 + (marginPerc / 100);

        let finalPrice = custo * multiplier;

        if (!isWinnerRow) {
            return finalPrice;
        }

        // Diluição do Frete do Vencedor
        if (vendor !== 'ESTOQUE') {
            const freightTotal = this.state.frete[vendor] || 0;
            let winningTotalQty = 0;
            this.state.pecas.forEach(p => {
                if (p.vencedor === vendor) {
                    const qty = parseFloat(p.qty) || 1;
                    winningTotalQty += qty;
                }
            });

            if (winningTotalQty > 0) {
                finalPrice += (freightTotal / winningTotalQty);
            }
        }

        // Diluição da Lavagem (+R$ 100) entre todas as peças vencedoras
        if (this.state.lavagem) {
            let globalWinningQty = 0;
            this.state.pecas.forEach(p => {
                if (p.vencedor) {
                    globalWinningQty += (parseFloat(p.qty) || 1);
                }
            });

            if (globalWinningQty > 0) {
                finalPrice += (100 / globalWinningQty);
            }
        }

        return finalPrice;
    },

    updateManualSellPrice(id, vendor, val) {
        let cleanVal = String(val).replace(',', '.');
        let num = parseFloat(cleanVal);

        const p = this.state.pecas.find(x => x.id === id);
        if (p && p.precos[vendor]) {
            if (!isNaN(num)) {
                p.precos[vendor].manual = true;
                p.precos[vendor].venda = num;
            } else {
                p.precos[vendor].manual = false;
                if (p.precos[vendor].custo !== null && p.precos[vendor].custo !== undefined) {
                    const isWinner = (p.vencedor === vendor);
                    p.precos[vendor].venda = this.calculateSellPrice(p.precos[vendor].custo, vendor, isWinner);
                } else {
                    p.precos[vendor].venda = null;
                }
            }
            this.saveDraft();
            this.recalcAllPricesAndRefresh();
        }
    },

    recalcAllPricesAndRefresh() {
        this.state.pecas.forEach(p => {
            const isWinnerStock = (p.vencedor === 'ESTOQUE');
            if (p.precos['ESTOQUE'] && p.precos['ESTOQUE'].custo !== null) {
                if (!p.precos['ESTOQUE'].manual) {
                    p.precos['ESTOQUE'].venda = this.calculateSellPrice(p.precos['ESTOQUE'].custo, 'ESTOQUE', isWinnerStock);
                }
            }
            this.state.vendedores.forEach(v => {
                const isWinnerVendor = (p.vencedor === v);
                if (p.precos[v] && p.precos[v].custo !== null) {
                    if (!p.precos[v].manual) {
                        p.precos[v].venda = this.calculateSellPrice(p.precos[v].custo, v, isWinnerVendor);
                    }
                }
            });
        });

        this.state.pecas.forEach(p => {
            const row = document.querySelector(`tr[data-cot-id="${p.id}"]`);
            if (!row) return;

            const stockVal = p.precos['ESTOQUE']?.venda;
            const stockInput = row.querySelector('.inp-stock-venda');
            if (stockInput && document.activeElement !== stockInput) {
                stockInput.value = stockVal ? stockVal.toFixed(2) : '';
            }

            this.state.vendedores.forEach(v => {
                const vendVal = p.precos[v]?.venda;
                const vendInput = row.querySelector(`input[data-vendor-venda="${v}"]`);
                if (vendInput && document.activeElement !== vendInput) {
                    vendInput.value = vendVal ? vendVal.toFixed(2) : '';
                }
            });
        });

        this.updateLiveSummary();
        this.saveDraft();
    },

    renderHeader() {
        const thead = document.querySelector('#cot-mainTable thead');
        if (!thead) return;

        const currentMargin = (this.state.margin !== undefined && this.state.margin !== null) 
            ? this.state.margin 
            : 90;

        let html = `<tr>
            <th class="th-qty">QTD</th>
            <th class="th-part">DESCRIÇÃO DA PEÇA</th>
            <th colspan="4" class="th-stock">ESTOQUE OFICINA</th>`;

        if (this.state.vendedores.length > 0) {
            html += this.state.vendedores.map(v => {
                const freteVal = this.state.frete[v] || '';
                const vEsc = UI ? UI.escapeHtml(v) : v;
                const vParam = v.replace(/'/g, "\\'");
                return `<th colspan="4" class="th-vendor">
                            <div style="font-size: 13px; margin-bottom: 3px; color:#fff; font-weight:800;">${vEsc}</div>
                            <div class="freight-container">
                                <span class="freight-label">FRETE R$</span>
                                <input type="number" class="inp-freight-small" placeholder="0,00" value="${freteVal}" oninput="Cotacao.updateFreight('${vParam}', this.value)">
                            </div>
                        </th>`;
            }).join('');
        } else {
            html += `<th style="color:#94a3b8; font-weight:normal; font-style:italic; padding:15px;">Adicione vendedores ao lado ↗</th>`;
        }

        html += `<th style="width:36px"></th></tr>
                  <tr>
                    <th class="th-qty" style="background:#0f1620;"></th>
                    <th class="th-part" style="text-align:right; padding-right:10px; vertical-align:middle;">
                        <div class="cot-margin-control">
                            <span class="margin-label">MARGEM</span>
                            <input type="number" id="globalMargin" class="inp-margem" value="${currentMargin}" min="0" max="500" oninput="Cotacao.updateMargin(this.value)">
                            <span class="margin-suffix">% ➔</span>
                        </div>
                    </th>
                    <th class="th-stock" style="width:30px;">✔</th>
                    <th class="th-stock">MARCA</th>
                    <th class="th-stock">CUSTO</th>
                    <th class="th-stock">VENDA</th>`;

        if (this.state.vendedores.length > 0) {
            html += this.state.vendedores.map(() => `<th style="width:30px; border-left: 3px solid #64748b; background:#1e293b;">✔</th><th>MARCA</th><th>CUSTO</th><th>VENDA</th>`).join('');
        } else {
            html += `<th></th>`;
        }

        html += `<th></th></tr>`;
        thead.innerHTML = html;
    },

    renderBody() {
        const tbody = document.querySelector('#cot-mainTable tbody');
        if (!tbody) return;

        tbody.innerHTML = this.state.pecas.map(p => {
            const isStock = Boolean(p.emEstoque || p.vencedor === 'ESTOQUE');
            const rowClass = (p.vencedor || isStock) ? (isStock ? 'winner-is-stock' : 'has-winner') : 'no-winner';

            const stockData = p.precos['ESTOQUE'] || {};
            let stockCols = `
                <td class="td-stock-section" style="text-align:center">
                    <input type="radio" name="win_${p.id}" class="radio-win radio-stock" ${isStock ? 'checked' : ''} onclick="Cotacao.setWinner(${p.id}, 'ESTOQUE')" title="Marcar como item do estoque">
                </td>
                <td class="td-stock-section"><input type="text" class="inp-brand" placeholder="Marca" value="${stockData.marca || ''}" oninput="Cotacao.updateBrand(${p.id}, 'ESTOQUE', this.value)"></td>
                <td class="td-stock-section"><input type="number" class="inp-sm bg-custo" placeholder="0" value="${stockData.custo !== null && stockData.custo !== undefined ? stockData.custo : ''}" oninput="Cotacao.updatePrice(${p.id}, 'ESTOQUE', this)"></td>
                <td class="td-stock-section">
                    <input class="inp-sale inp-stock-venda" 
                           value="${stockData.venda ? stockData.venda.toFixed(2) : ''}"
                           onchange="Cotacao.updateManualSellPrice(${p.id}, 'ESTOQUE', this.value)"
                           onkeydown="if(event.key==='Enter') Cotacao.handleRowEnter(${p.id})">
                </td>
            `;

            let vendorCols = '';
            if (this.state.vendedores.length > 0) {
                vendorCols = this.state.vendedores.map(v => {
                    const pr = p.precos[v] || {};
                    return `<td class="td-check"><input type="radio" name="win_${p.id}" class="radio-win" ${p.vencedor === v ? 'checked' : ''} onclick="Cotacao.setWinner(${p.id}, '${v}')"></td>
                            <td><input type="text" class="inp-brand" placeholder="Marca" value="${pr.marca || ''}" oninput="Cotacao.updateBrand(${p.id}, '${v}', this.value)"></td>
                            <td><input type="number" class="inp-sm bg-custo" placeholder="0" value="${pr.custo !== null && pr.custo !== undefined ? pr.custo : ''}" oninput="Cotacao.updatePrice(${p.id}, '${v}', this)"></td>
                            <td>
                                <input class="inp-sale" 
                                       data-vendor-venda="${v}" 
                                       value="${pr.venda ? pr.venda.toFixed(2) : ''}"
                                       onchange="Cotacao.updateManualSellPrice(${p.id}, '${v}', this.value)"
                                       onkeydown="if(event.key==='Enter') Cotacao.handleRowEnter(${p.id})">
                            </td>`;
                }).join('');
            } else {
                vendorCols = `<td style="background:#111a24;"></td>`;
            }

            const warningIcon = (!p.vencedor && !isStock) ? '<span style="color:#eab308; font-weight:bold; margin-left:3px; font-size:14px;" title="Selecione o vencedor ou marque Estoque">⚠</span>' : '';

            return `<tr class="${rowClass}" data-cot-id="${p.id}">
                        <td class="td-qty" style="display:flex; align-items:center; justify-content:center;">
                            <input type="number" class="inp-qty" value="${p.qty}" min="1" oninput="Cotacao.updateQty(${p.id}, this.value)">
                            ${warningIcon}
                        </td>
                        <td class="td-part">
                            <div class="cot-part-cell-wrapper">
                                <button type="button" 
                                        class="btn-stock-toggle ${isStock ? 'is-stock' : ''}" 
                                        onclick="Cotacao.toggleStockOnly(${p.id})" 
                                        title="${isStock ? 'Peça do Estoque Oficina:\n• NÃO será enviada na cotação para fornecedores (WhatsApp)\n• APARECERÁ no orçamento final do cliente (PDF/WhatsApp)' : 'Clique se já possui essa peça em estoque (não cotar no WhatsApp)'}">
                                    <i class="ph ${isStock ? 'ph-package' : 'ph-storefront'}"></i>
                                    <span>${isStock ? 'EM ESTOQUE' : 'COTAR'}</span>
                                </button>
                                <input value="${p.nome}" class="inp-name" placeholder="DIGITE O NOME DA PEÇA..." oninput="Cotacao.updatePartName(${p.id}, this.value)" onkeydown="if(event.key==='Enter') Cotacao.handleRowEnter(${p.id})">
                            </div>
                        </td>
                        ${stockCols}
                        ${vendorCols}
                        <td><button type="button" class="btn-remove-part" title="Remover Peça" onclick="Cotacao.removePart(${p.id})">&times;</button></td>
                    </tr>`;
        }).join('');
    },

    renderTags() {
        const el = document.getElementById('cot-vendorTags');
        if (!el) return;
        el.innerHTML = this.state.vendedores.map(v => {
            const vEsc = UI ? UI.escapeHtml(v) : v;
            const vParam = v.replace(/'/g, "\\'");
            return `<span class="cot-vendor-tag">${vEsc} <span class="remove-tag" onclick="Cotacao.removeVendor('${vParam}')">&times;</span></span>`;
        }).join('');
    },

    updateQty(id, val) {
        const p = this.state.pecas.find(x => x.id === id);
        if (!p) return;
        let q = parseInt(val);
        if (isNaN(q) || q < 1) q = 1;
        p.qty = q;
        this.recalcAllPricesAndRefresh();
        this.saveDraft();
    },

    updatePartName(id, val) {
        const p = this.state.pecas.find(x => x.id === id);
        if (p) {
            p.nome = val;
            this.saveDraft();
        }
    },

    updateBrand(id, vendor, val) {
        const p = this.state.pecas.find(x => x.id === id);
        if (p) {
            if (!p.precos[vendor]) p.precos[vendor] = {};
            p.precos[vendor].marca = val;
            this.saveDraft();
        }
    },

    updateFreight(vendor, val) {
        let cleanVal = String(val).replace(',', '.');
        const num = parseFloat(cleanVal);
        if (!isNaN(num)) this.state.frete[vendor] = num;
        else delete this.state.frete[vendor];
        this.recalcAllPricesAndRefresh();
    },

    updatePrice(id, vendor, inputEl) {
        let cleanVal = inputEl.value.replace(',', '.');
        const val = parseFloat(cleanVal);
        const p = this.state.pecas.find(x => x.id === id);
        if (!p) return;
        if (!p.precos[vendor]) p.precos[vendor] = {};

        p.precos[vendor].manual = false;

        if (!isNaN(val)) {
            p.precos[vendor].custo = val;
            const isWinner = (p.vencedor === vendor);
            p.precos[vendor].venda = this.calculateSellPrice(val, vendor, isWinner);
        } else {
            p.precos[vendor].custo = null;
            p.precos[vendor].venda = null;
        }
        this.recalcAllPricesAndRefresh();
    },

    /**
     * Alterna se a peça é exclusiva do estoque físico (não vai para cotação)
     */
    toggleStockOnly(id) {
        const p = this.state.pecas.find(x => x.id === id);
        if (!p) return;

        const isCurrentlyStock = Boolean(p.emEstoque || p.vencedor === 'ESTOQUE');

        if (!isCurrentlyStock) {
            p.emEstoque = true;
            p.vencedor = 'ESTOQUE';
            if (!p.precos['ESTOQUE']) {
                p.precos['ESTOQUE'] = { custo: null, venda: null, marca: 'ESTOQUE' };
            }
            if (UI) UI.toast(`"${(p.nome || 'Peça').toUpperCase()}" marcada no estoque! Não irá para o WhatsApp de cotação.`, 'info');
        } else {
            p.emEstoque = false;
            if (p.vencedor === 'ESTOQUE') {
                p.vencedor = null;
            }
            if (UI) UI.toast(`"${(p.nome || 'Peça').toUpperCase()}" desmarcada. Entrará na lista de cotação.`, 'info');
        }

        this.renderBody();
        this.recalcAllPricesAndRefresh();
        this.saveDraft();
    },

    /**
     * Define vencedor ou desmarca se clicar novamente no mesmo
     */
    setWinner(id, vendor) {
        const p = this.state.pecas.find(x => x.id === id);
        if (!p) return;
        if (p.vencedor === vendor) {
            p.vencedor = null; // Toggle off
            if (vendor === 'ESTOQUE') p.emEstoque = false;
        } else {
            p.vencedor = vendor;
            p.emEstoque = (vendor === 'ESTOQUE');
        }
        this.renderBody();
        this.recalcAllPricesAndRefresh();
        this.saveDraft();
    },

    addPartRow() {
        this.state.pecas.push({ id: Date.now(), qty: 1, nome: '', precos: {}, vencedor: null, emEstoque: false });
        this.renderAll();
        this.recalcAllPricesAndRefresh();
    },

    removePart(id) {
        this.state.pecas = this.state.pecas.filter(x => x.id !== id);
        if (this.state.pecas.length === 0) {
            this.addPartRow();
        } else {
            this.renderAll();
            this.recalcAllPricesAndRefresh();
        }
    },

    handleRowEnter(currentId) {
        const lastPeca = this.state.pecas[this.state.pecas.length - 1];
        if (lastPeca && lastPeca.id === currentId) {
            this.addPartRow();
            setTimeout(() => {
                const rows = document.querySelectorAll('#cot-mainTable tbody tr');
                const lastRow = rows[rows.length - 1];
                if (lastRow) {
                    const inputName = lastRow.querySelector('.inp-name');
                    if (inputName) inputName.focus();
                }
            }, 60);
        }
    },

    addVendor() {
        const input = document.getElementById('cot-newVendorInput');
        const name = input ? input.value.trim().toUpperCase() : '';
        if (name && !this.state.vendedores.includes(name)) {
            this.state.vendedores.push(name);
            if (input) input.value = '';
            this.renderAll();
            this.saveDraft();
        }
    },

    async removeVendor(name) {
        const confirmou = await Modal.confirm(`Deseja realmente remover a coluna do vendedor "${name}"?`, {
            title: 'Remover Vendedor',
            confirmText: 'Remover',
            danger: true
        });
        if (confirmou) {
            this.state.vendedores = this.state.vendedores.filter(v => v !== name);
            delete this.state.frete[name];
            this.renderAll();
            this.saveDraft();
        }
    },

    // =========================================================
    // MODAL DE MÃO DE OBRA & ORÇAMENTO FINAL
    // =========================================================
    openLaborModal() {
        const modal = document.getElementById('cot-laborModal');
        if (!modal) return;
        const radios = document.getElementsByName('cot-laborType');
        radios.forEach(r => { if (r.value === this.state.labor.type) r.checked = true; });
        const inputRate = document.getElementById('cot-laborRate');
        if (inputRate) inputRate.value = this.state.labor.rate || 200;

        const container = document.getElementById('cot-laborList');
        if (container) {
            container.innerHTML = '';
            if (this.state.labor.items.length === 0) this.addLaborRow();
            else this.state.labor.items.forEach(item => this.renderLaborRow(item));
        }
        modal.style.display = 'flex';
    },

    toggleLaborModal() {
        const modal = document.getElementById('cot-laborModal');
        if (modal) modal.style.display = 'none';
    },

    updateLaborType(type) {
        const inputRate = document.getElementById('cot-laborRate');
        this.state.labor.type = type;
        if (type === 'popular') {
            if (inputRate) inputRate.value = 200;
        }
        if (type === 'premium') {
            if (inputRate) inputRate.value = 300;
        }
        this.updateLaborCalc(true);
    },

    addLaborRow() {
        const newItem = { id: Date.now(), desc: '', hours: 1, total: 0 };
        this.state.labor.items.push(newItem);
        this.renderLaborRow(newItem);
        this.updateLaborCalc();
        this.saveDraft();
    },

    renderLaborRow(item) {
        const container = document.getElementById('cot-laborList');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'labor-row';
        div.dataset.id = item.id;
        let displayVal = item.total ? item.total.toFixed(2) : '0.00';

        div.innerHTML = `
            <input type="text" class="labor-desc" placeholder="DESCRIÇÃO DO SERVIÇO" value="${item.desc || ''}" oninput="Cotacao.updateLaborItem(${item.id}, 'desc', this.value)">
            <input type="number" class="labor-hours" placeholder="Horas" value="${item.hours || 1}" min="0.5" step="0.5" oninput="Cotacao.updateLaborItem(${item.id}, 'hours', this.value)">
            <input type="text" class="labor-total" placeholder="0,00" value="R$ ${displayVal}" 
                   onfocus="this.value = this.value.replace('R$ ', '')" 
                   onblur="Cotacao.updateLaborItem(${item.id}, 'total', this.value)">
            <button type="button" class="btn-remove-part" style="width:28px; height:28px;" onclick="Cotacao.removeLaborRow(${item.id})">&times;</button>
        `;
        container.appendChild(div);
    },

    updateLaborItem(id, field, val) {
        const item = this.state.labor.items.find(i => i.id === id);
        if (item) {
            if (field === 'hours') {
                item.hours = parseFloat(val) || 0;
                const currentRate = parseFloat(document.getElementById('cot-laborRate')?.value) || 0;
                item.total = item.hours * currentRate;
                const row = document.querySelector(`.labor-row[data-id="${id}"]`);
                if (row) row.querySelector('.labor-total').value = `R$ ${item.total.toFixed(2)}`;
            } else if (field === 'desc') {
                item.desc = val;
            } else if (field === 'total') {
                let num = parseFloat(String(val).replace(',', '.').replace('R$', '').trim());
                if (isNaN(num)) num = 0;
                item.total = num;
                const row = document.querySelector(`.labor-row[data-id="${id}"]`);
                if (row) row.querySelector('.labor-total').value = `R$ ${num.toFixed(2)}`;
            }
            this.saveDraft();
        }
    },

    removeLaborRow(id) {
        this.state.labor.items = this.state.labor.items.filter(i => i.id !== id);
        const container = document.getElementById('cot-laborList');
        if (container) {
            container.innerHTML = '';
            this.state.labor.items.forEach(i => this.renderLaborRow(i));
        }
        this.saveDraft();
    },

    updateLaborCalc(forceRecalc = false) {
        const inputRate = document.getElementById('cot-laborRate');
        const currentRate = parseFloat(inputRate?.value) || 0;
        this.state.labor.rate = currentRate;
        const rows = document.querySelectorAll('.labor-row');
        rows.forEach(row => {
            const id = parseInt(row.dataset.id);
            const item = this.state.labor.items.find(i => i.id === id);
            if (item) {
                item.total = item.hours * currentRate;
                const totalInput = row.querySelector('.labor-total');
                if (totalInput) totalInput.value = `R$ ${item.total.toFixed(2)}`;
            }
        });
        this.saveDraft();
    },

    // =========================================================
    // GERAÇÃO DE ORÇAMENTO WHATSAPP & IMPRESSÃO PDF (JOGO RÁPIDO)
    // =========================================================
    async generateBudgetWithLabor(mode = 'text') {
        try {
            this.recalcAllPricesAndRefresh();

            const usedVendors = new Set();
            this.state.pecas.forEach(p => {
                if (p.vencedor && p.vencedor !== 'ESTOQUE') {
                    usedVendors.add(p.vencedor);
                }
            });

            for (const vendor of usedVendors) {
                if (this.state.frete[vendor] === undefined || this.state.frete[vendor] === null) {
                    await Modal.alert(`O vendedor "${vendor}" tem peças selecionadas mas está sem valor de FRETE.\n\nPor favor, preencha o frete (digite 0 se for grátis) antes de gerar o orçamento.`, {
                        title: 'Frete Não Informado',
                        type: 'warning'
                    });
                    return;
                }
            }

            const model = (document.getElementById('cot-carModel')?.value || '').toUpperCase();
            const plate = (document.getElementById('cot-carPlate')?.value || '').toUpperCase();

            let text = `ORÇAMENTO - ${model || 'VEÍCULO NÃO INFORMADO'}\n`;
            if (plate) text += `PLACA: ${plate}\n`;
            text += `\nPEÇAS:\n\n`;

            let totalPartsSum = 0;
            let hasParts = false;
            let partsRowsHtml = '';

            this.state.pecas.forEach(p => {
                const isStock = Boolean(p.emEstoque || p.vencedor === 'ESTOQUE');
                if ((p.vencedor || isStock) && p.nome && p.nome.trim()) {
                    hasParts = true;
                    const win = isStock ? 'ESTOQUE' : p.vencedor;
                    if (!p.precos[win]) p.precos[win] = {};

                    let vendaFinal = p.precos[win].venda;
                    if (vendaFinal === null || vendaFinal === undefined) {
                        vendaFinal = this.calculateSellPrice(p.precos[win].custo, win, true);
                    }
                    if (vendaFinal === null || vendaFinal === undefined) {
                        vendaFinal = 0;
                    }

                    const unitVal = Number(vendaFinal) || 0;
                    const qtyVal = Number(p.qty) || 1;
                    const totalVal = unitVal * qtyVal;
                    totalPartsSum += totalVal;

                    const unitFmt = unitVal.toFixed(2);
                    const totalFmt = totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const brandFmt = p.precos[win].marca ? ` ${p.precos[win].marca.toUpperCase()}` : '';
                    const fullDesc = `${p.nome.toUpperCase()}${brandFmt}`;

                    text += `${qtyVal}x ${fullDesc} - R$ ${unitFmt} un. = R$ ${totalFmt}\n`;

                    partsRowsHtml += `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">${fullDesc}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${qtyVal}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right;">${unitFmt}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-weight: 600;">R$ ${totalFmt}</td>
                        </tr>
                    `;
                }
            });

            if (!hasParts) {
                text += "(Nenhuma peça selecionada)\n";
                partsRowsHtml += '<tr><td colspan="4" style="border: 1px solid #cbd5e1; padding: 10px; text-align:center;">Nenhuma peça selecionada</td></tr>';
            }

            let totalLaborSum = 0;
            let hasLabor = false;
            let laborRowsHtml = '';

            this.state.labor.items.forEach(item => {
                if (item.desc && item.desc.trim()) {
                    hasLabor = true;
                    const totalItem = item.total || 0;
                    const hoursVal = item.hours || 1;
                    totalLaborSum += totalItem;
                    const priceUnitFmt = (totalItem / (hoursVal || 1)).toFixed(2);
                    const priceTotalFmt = totalItem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    laborRowsHtml += `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">${item.desc.toUpperCase()}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${hoursVal}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right;">${priceUnitFmt}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-weight: 600;">R$ ${priceTotalFmt}</td>
                        </tr>
                    `;
                }
            });

            if (hasLabor) {
                text += `\n----------------------------------\n`;
                text += `MÃO DE OBRA & SERVIÇOS:\n\n`;
                this.state.labor.items.forEach(item => {
                    if (item.desc && item.desc.trim()) {
                        const priceTotalFmt = (item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        text += `${item.desc.toUpperCase()} = R$ ${priceTotalFmt}\n`;
                    }
                });
            }

            const grandTotal = totalPartsSum + totalLaborSum;
            const grandTotalFmt = grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const partsSumFmt = totalPartsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const laborSumFmt = totalLaborSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            text += `\n==================================\n`;
            text += `TOTAL PEÇAS: R$ ${partsSumFmt}\n`;
            if (hasLabor) text += `TOTAL MÃO DE OBRA: R$ ${laborSumFmt}\n`;
            text += `\nTOTAL GERAL: R$ ${grandTotalFmt}\n`;
            text += `==================================\n`;
            text += `\n*Valores sujeitos a alteração sem aviso prévio.*\n*Orçamento válido por 10 dias.*`;

            if (mode === 'text') {
                const area = document.getElementById('cot-outputText');
                const panel = document.getElementById('cot-resultPanel');
                if (area && panel) {
                    area.value = text;
                    panel.style.display = 'block';
                    area.select();
                    navigator.clipboard.writeText(text).catch(() => {});
                    if (UI) UI.toast('Orçamento copiado para a área de transferência!', 'success');
                    else await Modal.alert('Orçamento copiado para a área de transferência!', { title: 'Copiado', type: 'success' });
                }
            } else if (mode === 'pdf') {
                const now = new Date();
                const dateStr = now.toLocaleDateString('pt-BR');

                const printWindow = window.open('', '', 'width=950,height=750');
                if (!printWindow) {
                    await Modal.alert("O navegador bloqueou a abertura da impressão. Por favor, permita pop-ups para este site e tente novamente.", {
                        title: 'Impressão Bloqueada',
                        type: 'warning'
                    });
                    return;
                }

                let laborTableBlock = '';
                if (hasLabor) {
                    laborTableBlock = `
                        <div style="font-weight: bold; font-size: 11px; margin-top: 16px; margin-bottom: 4px; text-transform: uppercase;">MÃO DE OBRA &amp; SERVIÇOS</div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                            <thead>
                                <tr>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-weight: bold; background: #fff;">Serviço</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 80px; text-align: center; font-weight: bold; background: #fff;">Quantidade</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 100px; text-align: right; font-weight: bold; background: #fff;">Preço unit.</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 110px; text-align: right; font-weight: bold; background: #fff;">Sub-total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${laborRowsHtml}
                                <tr>
                                    <td colspan="4" style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; padding: 6px 10px; background: #fff;">
                                        Total Serviços: R$ ${laborSumFmt}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    `;
                }

                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <title>Orçamento_${plate || 'PECAS'}</title>
                        <style>
                            @page {
                                size: A4 portrait;
                                margin: 0;
                            }
                            * {
                                box-sizing: border-box;
                            }
                            body {
                                font-family: 'Segoe UI', Arial, sans-serif;
                                color: #000;
                                background: #fff;
                                margin: 0;
                                padding: 12mm 15mm;
                                font-size: 11px;
                                line-height: 1.4;
                            }
                            .header-row {
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-start;
                                padding-bottom: 8px;
                            }
                            .logo-col {
                                flex: 1.2;
                            }
                            .logo-main {
                                font-size: 24px;
                                font-weight: 900;
                                font-style: italic;
                                letter-spacing: -0.5px;
                                color: #000;
                                line-height: 1;
                            }
                            .logo-main span {
                                color: #D60000;
                                font-style: normal;
                            }
                            .logo-sub1 {
                                font-size: 7.5px;
                                font-weight: bold;
                                text-transform: uppercase;
                                margin-top: 4px;
                                color: #1e293b;
                            }
                            .logo-sub2 {
                                font-size: 6.8px;
                                text-transform: uppercase;
                                color: #64748b;
                            }
                            .company-col {
                                flex: 2;
                                text-align: left;
                                font-size: 9.5px;
                                line-height: 1.35;
                                color: #1e293b;
                                padding-left: 15px;
                            }
                            .company-name {
                                font-weight: 700;
                                font-size: 11px;
                            }
                            .meta-right-col {
                                flex: 1;
                                text-align: right;
                                font-size: 10px;
                            }
                            .divider-line {
                                border-top: 1px solid #e2e8f0;
                                margin: 10px 0;
                            }
                            .info-strip {
                                border: 1px solid #cbd5e1;
                                padding: 8px 12px;
                                margin: 12px 0;
                                font-size: 11px;
                                display: flex;
                                justify-content: space-between;
                                background: #f8fafc;
                            }
                            .items-table {
                                width: 100%;
                                border-collapse: collapse;
                                font-size: 11px;
                                margin-top: 4px;
                            }
                            .items-table th {
                                border: 1px solid #cbd5e1;
                                padding: 6px 10px;
                                font-weight: bold;
                                background: #fff;
                                font-size: 10.5px;
                            }
                            .items-table td {
                                border: 1px solid #cbd5e1;
                                padding: 6px 10px;
                            }
                            .grand-total-row {
                                text-align: right;
                                font-size: 16px;
                                font-weight: 900;
                                margin-top: 20px;
                                color: #000;
                                border-top: 2px solid #000;
                                padding-top: 8px;
                            }
                            .footer-note {
                                margin-top: 25px;
                                font-size: 9.5px;
                                color: #64748b;
                                text-align: center;
                                font-style: italic;
                            }
                            @media print {
                                @page {
                                    margin: 0;
                                }
                                body {
                                    margin: 0;
                                    padding: 12mm 15mm;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header-row">
                            <div class="logo-col">
                                <div class="logo-main">AUTOCAR <span>BS</span></div>
                                <div class="logo-sub1">Especialistas em VOLKSWAGEN E AUDI</div>
                                <div class="logo-sub2">MECÂNICA E REVISÕES PREVENTIVAS MULTIMARCAS</div>
                            </div>
                            <div class="company-col">
                                <div class="company-name">AUTOCAR BS</div>
                                <div>27.259.708/0001-18</div>
                                <div>15 DE NOVEMBRO, 2569 - LOTEAMENTO MODENA - TATUI - SP</div>
                                <div>E-mail: autocarbstatui@gmail.com - Fone: (15) 99666-1359</div>
                            </div>
                            <div class="meta-right-col">
                                <div style="font-weight: bold; font-size: 12px; color: #000;">COTAÇÃO DE PEÇAS</div>
                                <div style="margin-top: 8px; color: #334155;">Emissão: ${dateStr}</div>
                            </div>
                        </div>

                        <div class="divider-line"></div>

                        <div class="info-strip">
                            <div><strong>VEÍCULO:</strong> ${model || 'NÃO INFORMADO'}</div>
                            <div><strong>PLACA:</strong> ${plate || 'NÃO INFORMADA'}</div>
                            <div><strong>DATA:</strong> ${dateStr}</div>
                        </div>

                        <!-- Tabela de Peças / Produtos -->
                        <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">PEÇAS COTADAS</div>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left;">Produto</th>
                                    <th style="width: 80px; text-align: center;">Quantidade</th>
                                    <th style="width: 100px; text-align: right;">Preço unit.</th>
                                    <th style="width: 110px; text-align: right;">Sub-total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${partsRowsHtml}
                                <tr>
                                    <td colspan="4" style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; padding: 6px 10px; background: #fff;">
                                        Total Peças: R$ ${partsSumFmt}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Tabela de Serviços (Mão de Obra) se houver -->
                        ${laborTableBlock}

                        <!-- Valor Total Geral -->
                        <div class="grand-total-row">
                            Valor Total: R$ ${grandTotalFmt}
                        </div>

                        <div class="footer-note">
                            * Valores sujeitos a alteração sem aviso prévio. Orçamento de peças válido por 10 dias. AutoCar BS.
                        </div>

                        <script>
                            setTimeout(() => { window.print(); window.close(); }, 500);
                        <\/script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }
        } catch (error) {
            await Modal.alert("Erro ao gerar orçamento: " + error.message, { title: "Erro no Orçamento", type: "danger" });
            console.error(error);
        }
    },

    // =========================================================
    // AÇÕES RÁPIDAS (COPIAR COTAÇÃO, PEDIDOS, LISTA INTERNA)
    // =========================================================
    async generateText(type) {
        const usedVendors = new Set();
        this.state.pecas.forEach(p => {
            if (p.vencedor && p.vencedor !== 'ESTOQUE') {
                usedVendors.add(p.vencedor);
            }
        });

        for (const vendor of usedVendors) {
            if (this.state.frete[vendor] === undefined || this.state.frete[vendor] === null) {
                await Modal.alert(`O vendedor "${vendor}" tem peças selecionadas mas está sem valor de FRETE.\n\nPor favor, preencha o frete no cabeçalho (coloque 0 se for grátis) antes de gerar a lista.`, {
                    title: 'Frete Não Informado',
                    type: 'warning'
                });
                return;
            }
        }

        const model = (document.getElementById('cot-carModel')?.value || '').toUpperCase();
        const plate = (document.getElementById('cot-carPlate')?.value || '').toUpperCase();
        let text = "";
        const area = document.getElementById('cot-outputText');
        const panel = document.getElementById('cot-resultPanel');

        if (type === 'quote') {
            text = `COTAÇÃO - ${model || 'VEÍCULO'}\n`;
            if (plate) text += `PLACA: ${plate}\n`;
            text += `\n`;
            const partsToQuote = this.state.pecas.filter(p => !p.emEstoque && p.vencedor !== 'ESTOQUE' && p.nome && p.nome.trim() !== '');
            const stockPartsCount = this.state.pecas.filter(p => (p.emEstoque || p.vencedor === 'ESTOQUE') && p.nome && p.nome.trim() !== '').length;

            if (partsToQuote.length === 0) text += "(Nenhuma peça para cotar com fornecedores - itens já em estoque da oficina)\n";
            else partsToQuote.forEach(p => { text += `- ${p.nome.toUpperCase()}\n`; });

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                navigator.clipboard.writeText(text).catch(() => {});
                let msg = 'Lista de cotação copiada com sucesso!';
                if (stockPartsCount > 0) {
                    msg = `Cotação copiada! (${stockPartsCount} peça(s) em estoque não foram para a lista do Zap)`;
                }
                if (UI) UI.toast(msg, 'success');
                else await Modal.alert(msg, { title: 'Copiado', type: 'success' });
            }
        } else if (type === 'order') {
            text = `PEDIDOS DE COMPRA - ${model || 'VEÍCULO'}\n`;
            if (plate) text += `PLACA: ${plate}\n`;
            const buyItems = this.state.pecas.filter(p => p.vencedor && p.vencedor !== 'ESTOQUE' && !p.emEstoque);

            this.state.vendedores.forEach(v => {
                const items = buyItems.filter(p => p.vencedor === v);
                if (items.length) {
                    text += `\n👤 ${v}:\n`;
                    items.forEach(i => {
                        const m = i.precos[v].marca ? `(${i.precos[v].marca.toUpperCase()})` : '';
                        text += ` [ ] ${i.qty}x ${i.nome} ${m}\n`;
                    });
                    if (this.state.frete[v] !== undefined && this.state.frete[v] !== null) {
                        text += ` (Frete: R$ ${this.state.frete[v].toFixed(2)})\n`;
                    }
                }
            });

            const stockItems = this.state.pecas.filter(p => (p.vencedor === 'ESTOQUE' || p.emEstoque) && p.nome && p.nome.trim());
            if (stockItems.length > 0) {
                text += `\n📦 SEPARAR DO ESTOQUE FÍSICO:\n`;
                stockItems.forEach(i => {
                    const m = (i.precos && i.precos['ESTOQUE'] && i.precos['ESTOQUE'].marca) ? `(${i.precos['ESTOQUE'].marca.toUpperCase()})` : '';
                    text += ` [ ] ${i.qty}x ${i.nome.toUpperCase()} ${m}\n`;
                });
            }

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                navigator.clipboard.writeText(text).catch(() => {});

                if (buyItems.length > 0) {
                    const sincronizar = await Modal.confirm("Texto dos pedidos copiado para a área de transferência!\n\nDeseja sincronizar essas peças no controle de pedidos?", {
                        title: 'Sincronizar Pedidos',
                        type: 'question',
                        confirmText: 'Sincronizar',
                        cancelText: 'Apenas Copiar'
                    });
                    if (sincronizar) {
                        const today = new Date().toLocaleDateString('pt-BR');
                        const orderData = {
                            id: Date.now(),
                            model: model || "MODELO NÃO INFORMADO",
                            plate: plate,
                            created_at: new Date().toLocaleString(),
                            items: buyItems.map(p => ({
                                qty: p.qty,
                                name: p.nome.toUpperCase(),
                                vendor: p.vencedor,
                                date: today,
                                arrived: false
                            }))
                        };
                        localStorage.setItem('autocar_incoming_order', JSON.stringify(orderData));
                        if (UI) UI.toast('Pedidos sincronizados com sucesso!', 'success');
                    }
                } else {
                    if (UI) UI.toast('Pedidos copiados com sucesso!', 'success');
                }
            }
        } else if (type === 'internal') {
            text = `RELATÓRIO INTERNO - ${model || 'VEÍCULO'}\n`;
            if (plate) text += `PLACA: ${plate}\n`;
            text += `(Qtd / Peça / Custo Un. / Venda Un. / Marca / Fornecedor)\n\n`;
            let rowsHtml = '';

            let totalInternalCost = 0;
            let totalInternalSale = 0;

            this.state.pecas.forEach(p => {
                const isStock = Boolean(p.emEstoque || p.vencedor === 'ESTOQUE');
                if ((p.vencedor || isStock) && p.nome && p.nome.trim()) {
                    const win = isStock ? 'ESTOQUE' : p.vencedor;
                    const d = (p.precos && p.precos[win]) ? p.precos[win] : {};
                    let custoFinal = d.custo || 0;
                    let vendaFinal = d.venda;
                    if (vendaFinal === null || vendaFinal === undefined) {
                        vendaFinal = this.calculateSellPrice(d.custo, win, true);
                    }
                    vendaFinal = vendaFinal || 0;

                    const qtyVal = p.qty || 1;
                    totalInternalCost += custoFinal * qtyVal;
                    totalInternalSale += vendaFinal * qtyVal;

                    text += `${qtyVal}x ${p.nome.toUpperCase()} / R$ ${custoFinal.toFixed(2)} / R$ ${vendaFinal.toFixed(2)} / ${d.marca ? d.marca.toUpperCase() : 'S/ MARCA'} / ${win}\n`;
                    text += "--------------------------------------------------\n";

                    rowsHtml += `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align:center;">${qtyVal}x</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${p.nome.toUpperCase()}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align:right;">R$ ${custoFinal.toFixed(2)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align:right;">R$ ${vendaFinal.toFixed(2)}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align:center;">${d.marca ? d.marca.toUpperCase() : '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align:center; font-weight: 600;">${win}</td>
                        </tr>
                    `;
                }
            });

            const totalInternalProfit = totalInternalSale - totalInternalCost;

            if (rowsHtml === '') {
                rowsHtml = '<tr><td colspan="6" style="border: 1px solid #cbd5e1; padding: 8px; text-align:center;">Nenhuma peça selecionada</td></tr>';
                text += "(Nenhuma peça selecionada)\n";
            }

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                navigator.clipboard.writeText(text).catch(() => {});
            }

            const dateStr = new Date().toLocaleDateString('pt-BR');
            const printWindow = window.open('', '', 'width=950,height=750');
            if (!printWindow) {
                await Modal.alert("Seu navegador bloqueou a abertura do PDF. Por favor, permita pop-ups para este site e tente novamente.", {
                    title: 'Impressão Bloqueada',
                    type: 'warning'
                });
                return;
            }
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <title>Relatório_Interno_${plate || 'S_PLACA'}</title>
                    <style>
                        @page { size: A4 portrait; margin: 0; }
                        * { box-sizing: border-box; }
                        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 12mm 15mm; color: #000; background:#fff; font-size: 11px; line-height: 1.4; }
                        .header-row { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; }
                        .logo-main { font-size: 24px; font-weight: 900; font-style: italic; letter-spacing: -0.5px; color: #000; line-height: 1; }
                        .logo-main span { color: #D60000; font-style: normal; }
                        .logo-sub1 { font-size: 7.5px; font-weight: bold; text-transform: uppercase; margin-top: 4px; color: #1e293b; }
                        .logo-sub2 { font-size: 6.8px; text-transform: uppercase; color: #64748b; }
                        .company-col { flex: 2; text-align: left; font-size: 9.5px; line-height: 1.35; color: #1e293b; padding-left: 15px; }
                        .company-name { font-weight: 700; font-size: 11px; }
                        .meta-right-col { flex: 1; text-align: right; font-size: 10px; }
                        .divider-line { border-top: 1px solid #e2e8f0; margin: 8px 0; }
                        h2 { text-align: center; color: #0f172a; margin: 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th { border: 1px solid #cbd5e1; background-color: #fff; color: #0f172a; font-weight: bold; text-transform: uppercase; font-size: 10px; padding: 6px 8px; }
                        td { border: 1px solid #cbd5e1; padding: 6px 8px; }
                        .footer-totals { margin-top: 16px; border: 1px solid #cbd5e1; padding: 10px 14px; background: #fff; font-size: 12px; display: flex; justify-content: space-between; font-weight: bold; }
                        @media print {
                            @page { margin: 0; }
                            body { margin: 0; padding: 12mm 15mm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header-row">
                        <div>
                            <div class="logo-main">AUTOCAR <span>BS</span></div>
                            <div class="logo-sub1">Especialistas em VOLKSWAGEN E AUDI</div>
                            <div class="logo-sub2">MECÂNICA E REVISÕES PREVENTIVAS MULTIMARCAS</div>
                        </div>
                        <div class="company-col">
                            <div class="company-name">AUTOCAR BS</div>
                            <div>27.259.708/0001-18</div>
                            <div>15 DE NOVEMBRO, 2569 - LOTEAMENTO MODENA - TATUI - SP</div>
                            <div>E-mail: autocarbstatui@gmail.com - Fone: (15) 99666-1359</div>
                        </div>
                        <div class="meta-right-col">
                            <div style="font-weight: bold; font-size: 11px;">RELATÓRIO INTERNO</div>
                            <div style="margin-top: 6px;">DATA: ${dateStr}</div>
                            <div>VEÍCULO: ${model || 'Não Informado'}</div>
                            <div>PLACA: ${plate || 'Não Informada'}</div>
                        </div>
                    </div>
                    <div class="divider-line"></div>
                    <h2>Relatório de Custo, Venda e Fornecedores</h2>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 45px; text-align:center;">QTD</th>
                                <th style="text-align:left;">DESCRIÇÃO DA PEÇA</th>
                                <th style="width: 90px; text-align:right;">CUSTO UN.</th>
                                <th style="width: 90px; text-align:right;">VENDA UN.</th>
                                <th style="width: 100px; text-align:center;">MARCA</th>
                                <th style="width: 130px; text-align:center;">FORNECEDOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                    <div class="footer-totals">
                        <div>Total Custo: R$ ${totalInternalCost.toFixed(2)}</div>
                        <div>Total Venda: R$ ${totalInternalSale.toFixed(2)}</div>
                        <div style="color: #15803d;">Lucro Previsto: R$ ${totalInternalProfit.toFixed(2)}</div>
                    </div>
                    <script>
                        setTimeout(() => { window.print(); window.close(); }, 500);
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    },

    // =========================================================
    // LIMPAR TELA & NOVO LIMPO INTELIGENTE
    // =========================================================
    async smartNewQuote() {
        const hasData = this.state.pecas.length > 0 && (this.state.pecas[0].nome !== '' || (document.getElementById('cot-carModel')?.value || '') !== '');
        if (hasData) {
            const salvar = await Modal.confirm("Deseja salvar as alterações da cotação atual antes de iniciar uma nova do zero?", {
                title: 'Nova Cotação',
                type: 'question',
                confirmText: 'Salvar e Limpar',
                cancelText: 'Limpar sem Salvar'
            });
            if (salvar) {
                this.saveCurrent(false);
            }
            this.clearScreen();
        } else {
            this.clearScreen();
        }
    },

    clearScreen() {
        this.currentId = null;
        const idInput = document.getElementById('cot-quoteId');
        if (idInput) idInput.value = '';

        const currentMargin = this.state.margin || 90;
        this.state = {
            vendedores: [],
            pecas: [],
            frete: {},
            labor: { type: 'popular', rate: 200, items: [] },
            lavagem: false,
            margin: currentMargin
        };
        const modelEl = document.getElementById('cot-carModel');
        const plateEl = document.getElementById('cot-carPlate');
        if (modelEl) modelEl.value = '';
        if (plateEl) plateEl.value = '';
        this.addPartRow();
        this.updateLavagemButton();
        this.renderAll();
        this.saveDraft();
        this.updateStatusBadge();
        if (UI) UI.toast('Tela limpa para nova cotação do zero.', 'info');
    },

    // =========================================================
    // SALVAR & HISTÓRICO COM ID ÚNICO OCULTO POR ORÇAMENTO
    // =========================================================
    saveCurrent(showMessage = true) {
        const m = document.getElementById('cot-carModel')?.value?.trim();
        const p = document.getElementById('cot-carPlate')?.value?.trim();
        const quoteIdEl = document.getElementById('cot-quoteId');
        const currentId = (quoteIdEl && quoteIdEl.value) ? quoteIdEl.value.trim() : (this.currentId || '');

        if (!m) {
            if (UI) UI.toast('Informe o modelo do veículo para salvar!', 'warning');
            else Modal.alert('Digite o modelo do veículo!', { title: 'Modelo Obrigatório', type: 'warning' });
            document.getElementById('cot-carModel')?.focus();
            return false;
        }
        if (!p) {
            if (showMessage) {
                if (UI) UI.toast('Informe a PLACA para salvar no histórico!', 'warning');
                else Modal.alert('Digite a PLACA para salvar no histórico!', { title: 'Placa Obrigatória', type: 'warning' });
                document.getElementById('cot-carPlate')?.focus();
            }
            return false;
        }

        const cleanPlate = p.toUpperCase().replace(/[^A-Z0-9]/g, '');

        let h = [];
        try {
            h = JSON.parse(localStorage.getItem('cotador_history') || '[]');
        } catch (e) {
            h = [];
        }

        // Busca se já existe este orçamento específico pelo ID oculto
        const existingIndex = currentId ? h.findIndex(x => String(x.id) === String(currentId)) : -1;
        const isUpdate = existingIndex >= 0;

        // Se estiver atualizando, mantém o ID original. Se for novo (criado no "Novo Limpo"), gera um ID único oculto
        const targetId = isUpdate ? currentId : ('cot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7));

        const r = {
            id: targetId,
            date: new Date().toLocaleString('pt-BR'),
            model: m,
            plate: cleanPlate,
            state: JSON.parse(JSON.stringify(this.state))
        };

        if (isUpdate) {
            h[existingIndex] = r;
        } else {
            h.unshift(r);
        }

        localStorage.setItem('cotador_history', JSON.stringify(h));
        this.currentId = targetId;
        if (quoteIdEl) quoteIdEl.value = targetId;
        this.saveDraft();
        this.updateStatusBadge();

        if (showMessage) {
            if (isUpdate) {
                if (UI) UI.toast(`Cotação atualizada com sucesso!`, 'success');
            } else {
                if (UI) UI.toast(`Novo orçamento de ${cleanPlate} salvo no histórico!`, 'success');
            }
        }
        return true;
    },

    toggleHistory() {
        this.currentHistoryGroupKey = null;
        const modal = document.getElementById('cot-historyModal');
        if (!modal) return;
        if (modal.style.display === 'flex') {
            modal.style.display = 'none';
        } else {
            const searchInput = document.getElementById('cot-searchHistory');
            if (searchInput) searchInput.value = '';
            this.loadHistoryItems();
            modal.style.display = 'flex';
            setTimeout(() => document.getElementById('cot-searchHistory')?.focus(), 100);
        }
    },

    loadHistoryItems() {
        let h = [];
        try {
            h = JSON.parse(localStorage.getItem('cotador_history') || '[]');
        } catch (e) {
            h = [];
        }

        // Garante que todo item possua um ID único oculto
        let migrated = false;
        h.forEach((item, idx) => {
            if (!item.id) {
                item.id = 'cot_' + (Date.now() + idx) + '_' + Math.random().toString(36).substr(2, 6);
                migrated = true;
            }
        });
        if (migrated) {
            localStorage.setItem('cotador_history', JSON.stringify(h));
        }

        const term = (document.getElementById('cot-searchHistory')?.value || '').trim().toUpperCase();
        const container = document.getElementById('cot-historyList');
        if (!container) return;

        const filtered = h.filter(x => {
            const fullText = (String(x.model || '') + ' ' + String(x.plate || '')).toUpperCase();
            return fullText.includes(term);
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">Nenhum orçamento arquivado.</p>';
            return;
        }

        container.innerHTML = filtered.map(x => {
            const cleanPlate = (x.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            // Calcula total aproximado de peças vencedoras + serviços
            let total = 0;
            if (x.state && Array.isArray(x.state.pecas)) {
                x.state.pecas.forEach(p => {
                    const isStock = Boolean(p.emEstoque || p.vencedor === 'ESTOQUE');
                    const win = isStock ? 'ESTOQUE' : p.vencedor;
                    if (win && p.precos && p.precos[win]) {
                        total += (Number(p.precos[win].venda) || 0) * (Number(p.qty) || 1);
                    }
                });
            }
            if (x.state && x.state.labor && Array.isArray(x.state.labor.items)) {
                x.state.labor.items.forEach(l => {
                    total += Number(l.total) || 0;
                });
            }
            const totalStr = total > 0 ? `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

            return `
                <div class="history-item" onclick="Cotacao.loadItem('${x.id}')" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#1e293b; border:1px solid var(--border); border-radius:6px; margin-bottom:8px; cursor:pointer;">
                    <div style="flex:1;">
                        <span style="color:var(--gold); font-weight:800; font-size:1.05rem; letter-spacing:0.5px;">🚗 ${cleanPlate || 'SEM PLACA'}</span>
                        <strong style="color:#ffffff; margin-left:8px; font-size:0.95rem;">${x.model || 'Sem Modelo'}</strong>
                        ${totalStr ? `<span style="display:inline-block; font-size:0.75rem; color:#38bdf8; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); padding:2px 6px; border-radius:4px; margin-left:8px; font-weight:700;">${totalStr}</span>` : ''}<br>
                        <small style="color:var(--text-secondary);"><i class="ph ph-calendar"></i> ${x.date}</small>
                    </div>
                    <button type="button" class="btn-red-cot" style="padding:6px 10px; border-radius:4px;" onclick="Cotacao.deleteItem('${x.id}', event)" title="Excluir este orçamento">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    },

    openHistoryGroup(key) {
        this.currentHistoryGroupKey = key;
        const input = document.getElementById('cot-searchHistory');
        if (input) input.value = '';
        this.loadHistoryItems();
    },

    exitHistoryGroup() {
        this.currentHistoryGroupKey = null;
        this.loadHistoryItems();
    },

    async loadItem(id) {
        const hasData = this.state.pecas.length > 0 && (this.state.pecas[0].nome !== '' || (document.getElementById('cot-carModel')?.value || '') !== '');

        const performLoad = () => {
            let h = [];
            try {
                h = JSON.parse(localStorage.getItem('cotador_history') || '[]');
            } catch (e) {
                h = [];
            }
            const item = h.find(x => String(x.id) === String(id));

            if (item) {
                this.state = JSON.parse(JSON.stringify(item.state));
                if (this.state.margin === undefined) this.state.margin = 90;
                this.state.pecas.forEach(p => { 
                    if (!p.qty) p.qty = 1; 
                    if (p.vencedor === 'ESTOQUE') p.emEstoque = true;
                });
                if (!this.state.labor) this.state.labor = { type: 'popular', rate: 200, items: [] };
                if (!this.state.frete) this.state.frete = {};
                if (this.state.lavagem === undefined) this.state.lavagem = false;

                this.currentId = String(item.id);
                const quoteIdEl = document.getElementById('cot-quoteId');
                if (quoteIdEl) quoteIdEl.value = String(item.id);

                const modelEl = document.getElementById('cot-carModel');
                const plateEl = document.getElementById('cot-carPlate');
                if (modelEl) modelEl.value = item.model || '';
                if (plateEl) plateEl.value = item.plate || '';

                this.updateLavagemButton();
                this.renderAll();
                this.recalcAllPricesAndRefresh();
                this.saveDraft();
                this.updateStatusBadge();
                this.toggleHistory();
                if (UI) UI.toast(`Orçamento de ${item.plate || item.model} carregado para edição!`, 'success');
            }
        };

        if (hasData) {
            const salvar = await Modal.confirm("Deseja salvar as alterações da cotação atual antes de abrir a outra?", {
                title: 'Trocar de Cotação',
                type: 'question',
                confirmText: 'Salvar e Abrir',
                cancelText: 'Abrir sem Salvar'
            });
            if (salvar) {
                this.saveCurrent(false);
            }
            performLoad();
        } else {
            performLoad();
        }
    },

    async deleteItem(id, ev) {
        if (ev) ev.stopPropagation();
        const confirmou = await Modal.confirm('Tem certeza que deseja apagar este orçamento permanentemente?', {
            title: 'Excluir Orçamento',
            type: 'danger',
            confirmText: 'Excluir',
            cancelText: 'Cancelar'
        });
        if (confirmou) {
            let h = [];
            try { h = JSON.parse(localStorage.getItem('cotador_history') || '[]'); } catch (e) {}
            const newH = h.filter(x => String(x.id) !== String(id));
            localStorage.setItem('cotador_history', JSON.stringify(newH));

            if (String(this.currentId) === String(id)) {
                this.currentId = null;
                this.saveDraft();
                this.updateStatusBadge();
            }

            this.loadHistoryItems();
            if (UI) UI.toast('Orçamento excluído do histórico.', 'info');
        }
    },

    exportHistory() {
        const historyData = localStorage.getItem('cotador_history');
        if (!historyData || historyData === '[]') {
            if (UI) UI.toast('Seu histórico está vazio. Não há nada para exportar.', 'warning');
            else Modal.alert('Seu histórico está vazio. Não há nada para exportar.', { title: 'Histórico Vazio', type: 'info' });
            return;
        }
        const blob = new Blob([historyData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `autocar_historico_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (UI) UI.toast('Backup JSON do histórico exportado com sucesso!', 'success');
    },

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) throw new Error("Formato inválido.");

                const importar = await Modal.confirm(`Deseja importar ${importedData.length} orçamentos ao seu histórico atual?`, {
                    title: 'Importar Orçamentos',
                    type: 'question',
                    confirmText: 'Importar',
                    cancelText: 'Cancelar'
                });

                if (importar) {
                    let currentHistory = JSON.parse(localStorage.getItem('cotador_history') || '[]');
                    const existingIds = new Set(currentHistory.map(item => item.id));
                    let addedCount = 0;

                    importedData.forEach(item => {
                        if (!existingIds.has(item.id)) {
                            currentHistory.push(item);
                            addedCount++;
                        }
                    });

                    localStorage.setItem('cotador_history', JSON.stringify(currentHistory));
                    if (UI) UI.toast(`Importação concluída! ${addedCount} novos orçamentos adicionados.`, 'success');
                    this.loadHistoryItems();
                }
            } catch (error) {
                await Modal.alert("O arquivo selecionado não é um backup JSON válido do sistema.", {
                    title: 'Erro na Importação',
                    type: 'danger'
                });
                console.error(error);
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    }
};

window.Cotacao = Cotacao;

// Auto-inicialização quando a view for carregada via ViewLoader
window.addEventListener('view:loaded', (e) => {
    if (e.detail && e.detail.module === 'cotacao') {
        Cotacao.init();
    }
});

// Fallback caso já esteja no DOM
document.addEventListener('DOMContentLoaded', () => {
    Cotacao.init();
});
