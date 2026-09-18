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
        }

        this.updateLavagemButton();
        this.renderAll();
    },

    formatPlate(input) {
        let val = input.value.toUpperCase();
        val = val.replace(/[^A-Z0-9]/g, '');
        input.value = val;
    },

    saveDraft() {
        const modelEl = document.getElementById('cot-carModel');
        const plateEl = document.getElementById('cot-carPlate');
        const data = {
            state: this.state,
            model: modelEl ? modelEl.value : '',
            plate: plateEl ? plateEl.value : ''
        };
        localStorage.setItem('cotador_v40_draft', JSON.stringify(data));
    },

    renderAll() {
        this.renderHeader();
        this.renderBody();
        this.renderTags();
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
            const isStockWinner = p.vencedor === 'ESTOQUE';
            const rowClass = p.vencedor ? (isStockWinner ? 'winner-is-stock' : 'has-winner') : 'no-winner';

            const stockData = p.precos['ESTOQUE'] || {};
            let stockCols = `
                <td class="td-stock-section" style="text-align:center">
                    <input type="radio" name="win_${p.id}" class="radio-win radio-stock" ${isStockWinner ? 'checked' : ''} onclick="Cotacao.setWinner(${p.id}, 'ESTOQUE')">
                </td>
                <td class="td-stock-section"><input type="text" class="inp-brand" placeholder="Marca" value="${stockData.marca || ''}" oninput="Cotacao.updateBrand(${p.id}, 'ESTOQUE', this.value)"></td>
                <td class="td-stock-section"><input type="number" class="inp-sm bg-custo" placeholder="0" value="${stockData.custo !== null && stockData.custo !== undefined ? stockData.custo : ''}" oninput="Cotacao.updatePrice(${p.id}, 'ESTOQUE', this)"></td>
                <td class="td-stock-section">
                    <input class="inp-sale inp-stock-venda" 
                           value="${stockData.venda ? stockData.venda.toFixed(2) : ''}"
                           onchange="Cotacao.updateManualSellPrice(${p.id}, 'ESTOQUE', this.value)">
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
                                       onchange="Cotacao.updateManualSellPrice(${p.id}, '${v}', this.value)">
                            </td>`;
                }).join('');
            } else {
                vendorCols = `<td style="background:#111a24;"></td>`;
            }

            const warningIcon = !p.vencedor ? '<span style="color:#eab308; font-weight:bold; margin-left:3px; font-size:14px;" title="Selecione o vencedor">⚠</span>' : '';

            return `<tr class="${rowClass}" data-cot-id="${p.id}">
                        <td class="td-qty" style="display:flex; align-items:center; justify-content:center;">
                            <input type="number" class="inp-qty" value="${p.qty}" min="1" oninput="Cotacao.updateQty(${p.id}, this.value)">
                            ${warningIcon}
                        </td>
                        <td class="td-part"><input value="${p.nome}" class="inp-name" placeholder="DIGITE O NOME DA PEÇA..." oninput="Cotacao.updatePartName(${p.id}, this.value)"></td>
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
     * Define vencedor ou desmarca se clicar novamente no mesmo
     */
    setWinner(id, vendor) {
        const p = this.state.pecas.find(x => x.id === id);
        if (!p) return;
        if (p.vencedor === vendor) {
            p.vencedor = null; // Toggle off
        } else {
            p.vencedor = vendor;
        }
        this.renderBody();
        this.recalcAllPricesAndRefresh();
        this.saveDraft();
    },

    addPartRow() {
        this.state.pecas.push({ id: Date.now(), qty: 1, nome: '', precos: {}, vencedor: null });
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

    removeVendor(name) {
        if (confirm(`Remover coluna do vendedor "${name}"?`)) {
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
    // GERAÇÃO DE ORÇAMENTO WHATSAPP & IMPRESSÃO PDF
    // =========================================================
    generateBudgetWithLabor(mode = 'text') {
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
                    alert(`⚠️ ATENÇÃO: O vendedor "${vendor}" tem peças selecionadas mas está sem valor de FRETE.\n\nPor favor, preencha o frete (coloque 0 se for grátis) antes de gerar o orçamento.`);
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
            let partsHtml = '';

            this.state.pecas.forEach(p => {
                if (p.vencedor && p.nome.trim()) {
                    hasParts = true;

                    let vendaFinal = p.precos[p.vencedor].venda;
                    if (vendaFinal === null || vendaFinal === undefined) {
                        vendaFinal = this.calculateSellPrice(p.precos[p.vencedor].custo, p.vencedor, true);
                    }

                    const unitVal = vendaFinal || 0;
                    const totalVal = unitVal * (p.qty || 1);
                    totalPartsSum += totalVal;

                    const unitFmt = unitVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const totalFmt = totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const brandFmt = p.precos[p.vencedor].marca ? ` (${p.precos[p.vencedor].marca.toUpperCase()})` : '';

                    text += `${p.qty}x ${p.nome.toUpperCase()}${brandFmt} - R$ ${unitFmt} un. = R$ ${totalFmt}\n`;

                    partsHtml += `
                        <tr>
                            <td style="text-align:center;">${p.qty}x</td>
                            <td>${p.nome.toUpperCase()}${brandFmt}</td>
                            <td style="text-align:right;">R$ ${unitFmt}</td>
                            <td style="text-align:right;">R$ ${totalFmt}</td>
                        </tr>
                    `;
                }
            });

            if (!hasParts) {
                text += "(Nenhuma peça selecionada)\n";
                partsHtml += '<tr><td colspan="4" style="text-align:center;">Nenhuma peça selecionada</td></tr>';
            }

            text += `\n----------------------------------\n`;
            text += `MÃO DE OBRA & SERVIÇOS:\n\n`;

            let totalLaborSum = 0;
            let hasLabor = false;
            let laborHtml = '';

            this.state.labor.items.forEach(item => {
                if (item.desc && item.desc.trim()) {
                    hasLabor = true;
                    totalLaborSum += item.total || 0;
                    const priceFmt = (item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    text += `${item.desc.toUpperCase()} = R$ ${priceFmt}\n`;

                    laborHtml += `
                        <tr>
                            <td style="text-align:center;">-</td>
                            <td>${item.desc.toUpperCase()}</td>
                            <td style="text-align:right;">-</td>
                            <td style="text-align:right;">R$ ${priceFmt}</td>
                        </tr>
                    `;
                }
            });

            if (!hasLabor) {
                text += "(Sem mão de obra inclusa)\n";
                laborHtml += '<tr><td colspan="4" style="text-align:center;">Nenhuma mão de obra inclusa</td></tr>';
            }

            const grandTotal = totalPartsSum + totalLaborSum;
            const grandTotalFmt = grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const partsSumFmt = totalPartsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const laborSumFmt = totalLaborSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            text += `\n==================================\n`;
            text += `TOTAL PEÇAS: R$ ${partsSumFmt}\n`;
            text += `TOTAL MÃO DE OBRA: R$ ${laborSumFmt}\n`;
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
                    else alert('Orçamento Copiado para o WhatsApp!');
                }
            } else if (mode === 'pdf') {
                const dateStr = new Date().toLocaleDateString('pt-BR');
                const printWindow = window.open('', '', 'width=900,height=700');
                if (!printWindow) {
                    alert("O navegador bloqueou a abertura do PDF. Por favor, permita pop-ups para este site.");
                    return;
                }
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>Orçamento_${plate || 'S_PLACA'}</title>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
                            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #D60000; padding-bottom: 12px; margin-bottom: 20px; }
                            .logo { font-size: 26px; font-weight: 900; font-style: italic; color: #0f172a; }
                            .logo span { color: #D60000; font-style: normal; }
                            .info { text-align: right; font-size: 12px; line-height: 1.5; color: #475569; }
                            h2 { text-align: center; color: #0f172a; margin-bottom: 18px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
                            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
                            th, td { border: 1px solid #cbd5e1; padding: 7px 10px; }
                            th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                            .section-title { background-color: #e2e8f0 !important; font-size: 11px; text-align: left !important; padding-left: 10px; font-weight: 800; }
                            .total-box { width: 320px; float: right; border: 2px solid #0f172a; padding: 12px; margin-top: 10px; background: #f8fafc; border-radius: 4px; }
                            .total-line { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; font-weight: 600; }
                            .grand-total { font-weight: 900; font-size: 17px; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 8px; color: #D60000; }
                            .footer-note { clear: both; margin-top: 45px; font-size: 10px; color: #64748b; text-align: center; font-style: italic; }
                            tr:nth-child(even) { background-color: #f8fafc; }
                            @media print {
                                body { padding: 0; }
                                @page { margin: 1.2cm; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div class="logo">AUTOCAR<span>BS</span> <small style="font-size:12px; color:#64748b; font-style:normal; font-weight:700;">| SISTEMA DE GESTÃO</small></div>
                            <div class="info">
                                <strong>DATA:</strong> ${dateStr}<br>
                                <strong>VEÍCULO:</strong> ${model || 'Não Informado'}<br>
                                <strong>PLACA:</strong> ${plate || 'Não Informada'}
                            </div>
                        </div>
                        <h2>Orçamento de Peças e Serviços</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px; text-align:center;">QTD</th>
                                    <th>DESCRIÇÃO</th>
                                    <th style="width: 110px; text-align:right;">V. UNITÁRIO</th>
                                    <th style="width: 110px; text-align:right;">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><th colspan="4" class="section-title">📦 PEÇAS</th></tr>
                                ${partsHtml}
                                <tr><th colspan="4" class="section-title">🔧 MÃO DE OBRA &amp; SERVIÇOS</th></tr>
                                ${laborHtml}
                            </tbody>
                        </table>
                        <div class="total-box">
                            <div class="total-line">
                                <span>Subtotal Peças:</span>
                                <span>R$ ${partsSumFmt}</span>
                            </div>
                            <div class="total-line">
                                <span>Subtotal Mão de Obra:</span>
                                <span>R$ ${laborSumFmt}</span>
                            </div>
                            <div class="total-line grand-total">
                                <span>TOTAL GERAL:</span>
                                <span>R$ ${grandTotalFmt}</span>
                            </div>
                        </div>
                        <div class="footer-note">
                            * Valores sujeitos a alteração sem aviso prévio. Orçamento válido por 10 dias. AutoCar BS Oficina &amp; Peças.
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
            alert("Erro ao gerar orçamento: " + error.message);
            console.error(error);
        }
    },

    // =========================================================
    // AÇÕES RÁPIDAS (COPIAR COTAÇÃO, PEDIDOS, LISTA INTERNA)
    // =========================================================
    generateText(type) {
        const usedVendors = new Set();
        this.state.pecas.forEach(p => {
            if (p.vencedor && p.vencedor !== 'ESTOQUE') {
                usedVendors.add(p.vencedor);
            }
        });

        for (const vendor of usedVendors) {
            if (this.state.frete[vendor] === undefined || this.state.frete[vendor] === null) {
                alert(`⚠️ ATENÇÃO: O vendedor "${vendor}" tem peças selecionadas mas está sem valor de FRETE.\n\nPor favor, preencha o frete (coloque 0 se for grátis) antes de gerar a lista.`);
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
            const partsToQuote = this.state.pecas.filter(p => p.vencedor !== 'ESTOQUE' && p.nome && p.nome.trim() !== '');
            if (partsToQuote.length === 0) text += "(Nenhuma peça para cotar)";
            else partsToQuote.forEach(p => { text += `- ${p.nome.toUpperCase()}\n`; });

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                navigator.clipboard.writeText(text).catch(() => {});
                if (UI) UI.toast('Lista de cotação copiada com sucesso!', 'success');
                else alert('Lista Copiada!');
            }
        } else if (type === 'order') {
            text = `PEDIDOS DE COMPRA - ${model || 'VEÍCULO'}\n`;
            if (plate) text += `PLACA: ${plate}\n`;
            const buyItems = this.state.pecas.filter(p => p.vencedor && p.vencedor !== 'ESTOQUE');

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

            const stockItems = this.state.pecas.filter(p => p.vencedor === 'ESTOQUE');
            if (stockItems.length > 0) {
                text += `\n📦 SEPARAR DO ESTOQUE FÍSICO:\n`;
                stockItems.forEach(i => {
                    const m = i.precos['ESTOQUE']?.marca ? `(${i.precos['ESTOQUE'].marca.toUpperCase()})` : '';
                    text += ` [ ] ${i.qty}x ${i.nome} ${m}\n`;
                });
            }

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                navigator.clipboard.writeText(text).catch(() => {});

                if (buyItems.length > 0) {
                    if (confirm("Texto dos pedidos copiado!\n\nDeseja sincronizar essas peças no controle de pedidos?")) {
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

            this.state.pecas.forEach(p => {
                if (p.vencedor && p.precos[p.vencedor]) {
                    const d = p.precos[p.vencedor];
                    let custoFinal = d.custo || 0;
                    let vendaFinal = d.venda;
                    if (vendaFinal === null || vendaFinal === undefined) {
                        vendaFinal = this.calculateSellPrice(d.custo, p.vencedor, true);
                    }
                    vendaFinal = vendaFinal || 0;

                    text += `${p.qty}x ${p.nome.toUpperCase()} / R$ ${custoFinal.toFixed(2)} / R$ ${vendaFinal.toFixed(2)} / ${d.marca ? d.marca.toUpperCase() : 'S/ MARCA'} / ${p.vencedor}\n`;
                    text += "--------------------------------------------------\n";

                    rowsHtml += `
                        <tr>
                            <td style="text-align:center;">${p.qty}x</td>
                            <td>${p.nome.toUpperCase()}</td>
                            <td style="text-align:right;">R$ ${custoFinal.toFixed(2)}</td>
                            <td style="text-align:right;">R$ ${vendaFinal.toFixed(2)}</td>
                            <td style="text-align:center;">${d.marca ? d.marca.toUpperCase() : '-'}</td>
                            <td style="text-align:center;">${p.vencedor}</td>
                        </tr>
                    `;
                }
            });

            if (rowsHtml === '') {
                rowsHtml = '<tr><td colspan="6" style="text-align:center;">Nenhuma peça selecionada</td></tr>';
                text += "(Nenhuma peça selecionada)\n";
            }

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                navigator.clipboard.writeText(text).catch(() => {});
            }

            const dateStr = new Date().toLocaleDateString('pt-BR');
            const printWindow = window.open('', '', 'width=900,height=700');
            if (!printWindow) {
                alert("Seu navegador bloqueou o PDF. Por favor, permita pop-ups para este site e tente novamente.");
                return;
            }
            printWindow.document.write(`
                <html>
                <head>
                    <title>Relatório_${plate || 'S_PLACA'}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 25px; color: #1e293b; background:#fff; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #D60000; padding-bottom: 12px; margin-bottom: 20px; }
                        .logo { font-size: 26px; font-weight: 900; font-style: italic; color: #0f172a; }
                        .logo span { color: #D60000; font-style: normal; }
                        .info { text-align: right; font-size: 12px; line-height: 1.5; color: #475569; }
                        h2 { text-align: center; color: #0f172a; margin-bottom: 18px; font-size: 18px; text-transform: uppercase; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; }
                        th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        @media print {
                            body { padding: 0; }
                            @page { margin: 1.2cm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">AUTOCAR<span>BS</span> <small style="font-size:12px; color:#64748b; font-style:normal; font-weight:700;">| RELATÓRIO DE CUSTO &amp; LUCRO</small></div>
                        <div class="info">
                            <strong>DATA:</strong> ${dateStr}<br>
                            <strong>VEÍCULO:</strong> ${model || 'Não Informado'}<br>
                            <strong>PLACA:</strong> ${plate || 'Não Informada'}
                        </div>
                    </div>
                    <h2>Relatório Interno de Conferência</h2>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align:center;">QTD</th>
                                <th>DESCRIÇÃO DA PEÇA</th>
                                <th style="width: 100px; text-align:right;">CUSTO UN.</th>
                                <th style="width: 100px; text-align:right;">VENDA UN.</th>
                                <th style="width: 120px; text-align:center;">MARCA</th>
                                <th style="width: 150px; text-align:center;">FORNECEDOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
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
    smartNewQuote() {
        const hasData = this.state.pecas.length > 0 && (this.state.pecas[0].nome !== '' || (document.getElementById('cot-carModel')?.value || '') !== '');
        if (hasData) {
            if (confirm("Deseja salvar a cotação atual antes de limpar?")) {
                if (this.saveCurrent(false)) this.clearScreen();
            } else {
                if (confirm("Deseja apagar a tela sem salvar?")) this.clearScreen();
            }
        } else {
            this.clearScreen();
        }
    },

    clearScreen() {
        this.currentId = null;
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
        if (UI) UI.toast('Tela limpa para nova cotação.', 'info');
    },

    // =========================================================
    // SALVAR & HISTÓRICO COM AGRUPAMENTO POR PLACA / VEÍCULO
    // =========================================================
    saveCurrent(showMessage = true) {
        const m = document.getElementById('cot-carModel')?.value?.trim();
        const p = document.getElementById('cot-carPlate')?.value?.trim();

        if (!m) {
            if (UI) UI.toast('Informe o modelo do veículo para salvar!', 'warning');
            else alert('Digite o modelo do veículo!');
            document.getElementById('cot-carModel')?.focus();
            return false;
        }
        if (!p) {
            if (showMessage) {
                if (UI) UI.toast('Informe a PLACA para salvar no histórico!', 'warning');
                else alert('Digite a PLACA para salvar no histórico!');
                document.getElementById('cot-carPlate')?.focus();
            }
            return false;
        }

        const cleanPlate = p.toUpperCase().replace(/[^A-Z0-9]/g, '');

        let h = JSON.parse(localStorage.getItem('cotador_history') || '[]');
        const r = {
            id: this.currentId || Date.now(),
            date: new Date().toLocaleString(),
            model: m,
            plate: cleanPlate,
            state: this.state
        };

        const i = h.findIndex(x => x.id === r.id);
        if (i >= 0) h[i] = r;
        else h.push(r);

        localStorage.setItem('cotador_history', JSON.stringify(h));
        this.currentId = r.id;
        if (showMessage) {
            if (UI) UI.toast(`Orçamento de ${cleanPlate} salvo no histórico!`, 'success');
            else alert('Orçamento salvo no histórico!');
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
        let h = JSON.parse(localStorage.getItem('cotador_history') || '[]');
        const term = (document.getElementById('cot-searchHistory')?.value || '').toUpperCase();
        const container = document.getElementById('cot-historyList');
        if (!container) return;

        // Visualização dentro de uma pasta de veículo específica
        if (this.currentHistoryGroupKey) {
            const carQuotes = h.filter(x => {
                const p = x.plate ? x.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : "";
                const m = x.model || "S/ Modelo";
                const uniqueKey = p !== "" ? p : m;
                return uniqueKey === this.currentHistoryGroupKey;
            });

            carQuotes.sort((a, b) => b.id - a.id);

            const first = carQuotes[0] || {};
            const folderTitle = first.plate || first.model || "Orçamento";
            const folderSub = first.plate ? first.model : "";

            let html = `
                <div style="background:#1e293b; padding:10px 14px; border-radius:6px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border);">
                    <span style="font-weight:bold; color:var(--gold); display:flex; align-items:center; gap:6px;">
                        <i class="ph ph-folder-open"></i> ${folderTitle} <small style="color:#cbd5e1;">(${folderSub})</small>
                    </span>
                    <button type="button" onclick="Cotacao.exitHistoryGroup()" class="btn btn-secondary btn-sm" style="padding:4px 10px;">⬅ Voltar</button>
                </div>
            `;

            if (carQuotes.length === 0) {
                html += '<p style="text-align:center; color:var(--text-secondary);">Nenhum orçamento encontrado nesta pasta.</p>';
            } else {
                html += carQuotes.map(x => `
                    <div class="history-item" onclick="Cotacao.loadItem(${x.id})">
                        <div>
                            <strong style="color:#ffffff;">${x.date}</strong><br>
                            <small style="color:var(--text-secondary)">${x.model || 'Sem Modelo'}</small>
                        </div>
                        <button type="button" class="btn-red-cot" style="padding:6px 10px; border-radius:4px;" onclick="Cotacao.deleteItem(${x.id}, event)" title="Excluir este orçamento">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                `).join('');
            }
            container.innerHTML = html;
            return;
        }

        // Visualização geral agrupada por veículo
        const filtered = h.filter(x => (String(x.model || '') + ' ' + String(x.plate || '')).toUpperCase().includes(term));
        const groups = {};

        filtered.forEach(x => {
            const rawPlate = x.plate ? x.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : "";
            const uniqueKey = rawPlate !== "" ? rawPlate : (x.model || "S/ Modelo");

            if (!groups[uniqueKey]) {
                groups[uniqueKey] = {
                    key: uniqueKey,
                    plate: rawPlate,
                    latestModel: x.model,
                    count: 0,
                    lastDate: 0
                };
            }
            groups[uniqueKey].count++;
            if (x.id > groups[uniqueKey].lastDate) {
                groups[uniqueKey].lastDate = x.id;
                groups[uniqueKey].latestModel = x.model;
            }
        });

        const groupArr = Object.values(groups).sort((a, b) => b.lastDate - a.lastDate);

        if (groupArr.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">Nenhum orçamento arquivado.</p>';
            return;
        }

        container.innerHTML = groupArr.map(g => {
            const safeKey = g.key.replace(/'/g, "\\'");
            return `
                <div class="history-group" onclick="Cotacao.openHistoryGroup('${safeKey}')">
                    <div>
                        <span style="font-size:1.1rem; color:var(--gold); margin-right:4px;">📂</span> 
                        <strong style="color:#ffffff;">${g.plate || g.latestModel}</strong> <br>
                        <span style="font-size:0.75rem; color:var(--text-secondary);">${g.plate ? g.latestModel : "Sem Placa"}</span>
                    </div>
                    <div style="font-size:0.8rem; font-weight:bold; color:var(--gold); display:flex; align-items:center; gap:4px;">
                        <span>${g.count} orçamento${g.count !== 1 ? 's' : ''}</span>
                        <i class="ph ph-caret-right"></i>
                    </div>
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

    loadItem(id) {
        const hasData = this.state.pecas.length > 0 && (this.state.pecas[0].nome !== '' || (document.getElementById('cot-carModel')?.value || '') !== '');

        const performLoad = () => {
            const item = JSON.parse(localStorage.getItem('cotador_history') || '[]').find(x => x.id === id);
            if (item) {
                this.state = item.state;
                if (this.state.margin === undefined) this.state.margin = 90;
                this.state.pecas.forEach(p => { if (!p.qty) p.qty = 1; });
                if (!this.state.labor) this.state.labor = { type: 'popular', rate: 200, items: [] };
                if (!this.state.frete) this.state.frete = {};
                if (this.state.lavagem === undefined) this.state.lavagem = false;

                this.currentId = item.id;
                const modelEl = document.getElementById('cot-carModel');
                const plateEl = document.getElementById('cot-carPlate');
                if (modelEl) modelEl.value = item.model || '';
                if (plateEl) plateEl.value = item.plate || '';

                this.updateLavagemButton();
                this.renderAll();
                this.recalcAllPricesAndRefresh();
                this.toggleHistory();
                if (UI) UI.toast(`Orçamento de ${item.plate || item.model} carregado!`, 'success');
            }
        };

        if (hasData) {
            if (confirm("Deseja salvar a cotação atual antes de abrir este orçamento?")) {
                if (this.saveCurrent(false)) performLoad();
            } else {
                if (confirm("Trocar sem salvar o atual?")) performLoad();
            }
        } else {
            performLoad();
        }
    },

    deleteItem(id, ev) {
        if (ev) ev.stopPropagation();
        if (confirm('Tem certeza que deseja apagar este orçamento permanentemente?')) {
            let h = JSON.parse(localStorage.getItem('cotador_history') || '[]');
            const newH = h.filter(x => x.id !== id);
            localStorage.setItem('cotador_history', JSON.stringify(newH));

            if (this.currentHistoryGroupKey) {
                const remaining = newH.filter(x => {
                    const p = x.plate ? x.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : "";
                    const m = x.model || "S/ Modelo";
                    const key = p !== "" ? p : m;
                    return key === this.currentHistoryGroupKey;
                });
                if (remaining.length === 0) {
                    this.currentHistoryGroupKey = null;
                }
            }
            this.loadHistoryItems();
            if (UI) UI.toast('Orçamento excluído do histórico.', 'info');
        }
    },

    exportHistory() {
        const historyData = localStorage.getItem('cotador_history');
        if (!historyData || historyData === '[]') {
            if (UI) UI.toast('Seu histórico está vazio. Não há nada para exportar.', 'warning');
            else alert('Seu histórico está vazio.');
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
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) throw new Error("Formato inválido.");

                if (confirm(`Deseja importar ${importedData.length} orçamentos ao seu histórico atual?`)) {
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
                    if (UI) UI.toast(`Importação concluída! ${addedCount} novos orçamentos foram adicionados.`, 'success');
                    else alert(`Importação concluída! ${addedCount} novos orçamentos adicionados.`);
                    this.loadHistoryItems();
                }
            } catch (error) {
                alert("Erro: O arquivo não é um backup JSON válido do sistema.");
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
