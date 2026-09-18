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
        lavagem: false
    },
    iniciado: false,

    iniciar() {
        if (!document.getElementById('cot-carModel')) return;
        if (this.iniciado) return;
        this.iniciado = true;

        const draft = localStorage.getItem('cotador_v40_draft');
        if (draft) {
            try {
                const saved = JSON.parse(draft);
                if (saved.state) {
                    this.state = saved.state;
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
            btn.innerHTML = '🚿 LAVAGEM ON (+R$ 100)';
            btn.className = 'btn-info blink-red';
        } else {
            btn.innerHTML = '🚿 INCLUIR LAVAGEM';
            btn.className = 'btn-info';
        }
        this.saveDraft();
    },

    calculateSellPrice(custo, vendor, isWinnerRow) {
        if (custo === null || custo === undefined || isNaN(custo)) return null;

        let finalPrice = custo * 1.85;

        if (!isWinnerRow) {
            return finalPrice;
        }

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
                p.precos[vendor].venda = num;
                p.precos[vendor].manual = true;
            } else {
                p.precos[vendor].manual = false;
                if (p.precos[vendor].custo !== null) {
                    const isWinner = (p.vencedor === vendor);
                    p.precos[vendor].venda = this.calculateSellPrice(p.precos[vendor].custo, vendor, isWinner);
                } else {
                    p.precos[vendor].venda = null;
                }
            }
            this.saveDraft();
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

        let html = `<tr>
            <th class="th-qty">QTD</th>
            <th class="th-part">DESCRIÇÃO DA PEÇA</th>
            <th colspan="4" class="th-stock">ESTOQUE OFICINA</th>`;

        if (this.state.vendedores.length > 0) {
            html += this.state.vendedores.map(v => {
                const freteVal = this.state.frete[v] || '';
                const vEsc = UI.escapeHtml(v);
                const vParam = v.replace(/'/g, "\\'");
                return `<th colspan="4" class="th-vendor" style="border-left: 3px solid #777;">
                            <div style="font-size: 13px; margin-bottom: 3px; color:#fff;">${vEsc}</div>
                            <div class="freight-container">
                                <span class="freight-label">FRETE</span>
                                <input type="number" class="inp-freight-small" placeholder="0,00" value="${freteVal}" oninput="Cotacao.updateFreight('${vParam}', this.value)">
                            </div>
                        </th>`;
            }).join('');
        } else {
            html += `<th style="color:#aaa; font-weight:normal; font-style:italic; padding:15px;">Adicione vendedores ao lado ↗</th>`;
        }

        html += `<th style="width:30px"></th></tr>
                  <tr>
                    <th class="th-qty" style="background:#222;"></th>
                    <th class="th-part" style="font-size:9.5px; color:#aaa; text-align:right; padding-right:10px;">MARGEM 85% ➔</th>
                    <th class="th-stock" style="width:28px; background:#0d2b4d;">✔</th>
                    <th class="th-stock" style="background:#0d2b4d;">MARCA</th>
                    <th class="th-stock" style="background:#0d2b4d;">CUSTO</th>
                    <th class="th-stock" style="background:#0d2b4d;">VENDA</th>`;

        if (this.state.vendedores.length > 0) {
            html += this.state.vendedores.map(() => `<th style="width:28px; border-left: 3px solid #999; background:#333;">✔</th><th>MARCA</th><th>CUSTO</th><th>VENDA</th>`).join('');
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
                vendorCols = `<td style="background:var(--bg-input);"></td>`;
            }

            const warningIcon = !p.vencedor ? '<span style="color:#d4a017; font-weight:bold; margin-left:3px; font-size:13px;" title="Selecione o vencedor">⚠</span>' : '';

            return `<tr class="${rowClass}" data-cot-id="${p.id}">
                        <td class="td-qty" style="display:flex; align-items:center; justify-content:center;">
                            <input type="number" class="inp-qty" value="${p.qty}" min="1" oninput="Cotacao.updateQty(${p.id}, this.value)">
                            ${warningIcon}
                        </td>
                        <td class="td-part"><input value="${p.nome}" class="inp-name" placeholder="DIGITE O NOME DA PEÇA..." oninput="Cotacao.updatePartName(${p.id}, this.value)"></td>
                        ${stockCols}
                        ${vendorCols}
                        <td><button class="btn-red" style="padding: 4px 8px; border-radius:4px; width:26px; height:26px; font-weight:bold;" onclick="Cotacao.removePart(${p.id})">&times;</button></td>
                    </tr>`;
        }).join('');
    },

    renderTags() {
        const el = document.getElementById('cot-vendorTags');
        if (!el) return;
        el.innerHTML = this.state.vendedores.map(v => {
            const vEsc = UI.escapeHtml(v);
            const vParam = v.replace(/'/g, "\\'");
            return `<span class="vendor-tag">${vEsc} <span onclick="Cotacao.removeVendor('${vParam}')">&times;</span></span>`;
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
        if (!p) return;
        if (!p.precos[vendor]) p.precos[vendor] = {};
        p.precos[vendor].marca = val;
        this.saveDraft();
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

    setWinner(id, vendor) {
        const p = this.state.pecas.find(x => x.id === id);
        if (!p) return;
        if (p.vencedor === vendor) {
            p.vencedor = null;
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
            this.state.pecas.push({ id: Date.now(), qty: 1, nome: '', precos: {}, vencedor: null });
        }
        this.renderAll();
        this.recalcAllPricesAndRefresh();
    },

    addVendor() {
        const input = document.getElementById('cot-newVendorInput');
        if (!input) return;
        const name = input.value.trim().toUpperCase();
        if (name && !this.state.vendedores.includes(name)) {
            this.state.vendedores.push(name);
            input.value = '';
            this.renderAll();
            this.saveDraft();
        }
    },

    removeVendor(name) {
        if (confirm(`Remover a coluna do fornecedor "${name}"?`)) {
            this.state.vendedores = this.state.vendedores.filter(v => v !== name);
            delete this.state.frete[name];
            this.renderAll();
            this.saveDraft();
        }
    },

    // --- MÃO DE OBRA ---
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
        if (type === 'popular' && inputRate) inputRate.value = 200;
        if (type === 'premium' && inputRate) inputRate.value = 300;
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
            <input type="text" class="labor-desc" placeholder="DESCRIÇÃO DO SERVIÇO" value="${item.desc}" oninput="Cotacao.updateLaborItem(${item.id}, 'desc', this.value)">
            <input type="number" class="labor-hours" placeholder="Horas" value="${item.hours}" min="0.5" step="0.5" oninput="Cotacao.updateLaborItem(${item.id}, 'hours', this.value)">
            <input type="text" class="labor-total" placeholder="0,00" value="R$ ${displayVal}" 
                   onfocus="this.value = this.value.replace('R$ ', '')" 
                   onblur="Cotacao.updateLaborItem(${item.id}, 'total', this.value)">
            <button class="btn-red" style="padding: 8px 12px;" onclick="Cotacao.removeLaborRow(${item.id})">&times;</button>
        `;
        container.appendChild(div);
    },

    updateLaborItem(id, field, val) {
        const item = this.state.labor.items.find(i => i.id === id);
        if (!item) return;

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
                const totInput = row.querySelector('.labor-total');
                if (totInput) totInput.value = `R$ ${item.total.toFixed(2)}`;
            }
        });
        this.saveDraft();
    },

    async generateBudgetWithLabor() {
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
                    alert(`⚠️ ATENÇÃO: O fornecedor "${vendor}" tem peças selecionadas mas está sem valor de FRETE.\n\nPor favor, preencha o frete (coloque 0 se for grátis) antes de gerar o orçamento.`);
                    return;
                }
            }

            this.toggleLaborModal();
            const model = document.getElementById('cot-carModel')?.value.toUpperCase() || '';
            const plate = document.getElementById('cot-carPlate')?.value.toUpperCase() || '';
            let text = `ORÇAMENTO - ${model}\nPLACA: ${plate}\n\n`;
            text += `PEÇAS:\n\n`;

            let totalPartsSum = 0;
            let hasParts = false;

            this.state.pecas.forEach(p => {
                if (p.vencedor && p.nome.trim()) {
                    hasParts = true;
                    let vendaFinal = p.precos[p.vencedor].venda;
                    if (vendaFinal === null || vendaFinal === undefined) {
                        vendaFinal = this.calculateSellPrice(p.precos[p.vencedor].custo, p.vencedor, true);
                    }

                    const totalVal = (vendaFinal || 0) * p.qty;
                    totalPartsSum += totalVal;

                    const priceFmt = totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const brandFmt = p.precos[p.vencedor].marca ? ` ${p.precos[p.vencedor].marca.toUpperCase()}` : '';
                    text += `${p.qty}x ${p.nome.toUpperCase()}${brandFmt} R$ ${priceFmt}\n`;
                    text += "__________________________________\n";
                }
            });
            if (!hasParts) text += "(Nenhuma peça selecionada)\n";

            text += `\nMÃO DE OBRA:\n\n`;

            let totalLaborSum = 0;
            let hasLabor = false;

            this.state.labor.items.forEach(item => {
                if (item.desc.trim()) {
                    hasLabor = true;
                    totalLaborSum += item.total;
                    const priceFmt = item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    text += `${item.desc.toUpperCase()} R$ ${priceFmt}\n`;
                    text += "__________________________________\n";
                }
            });
            if (!hasLabor) text += "(Sem mão de obra inclusa)\n";

            const grandTotal = totalPartsSum + totalLaborSum;

            text += `\n==================================\n`;
            text += `TOTAL PEÇAS: R$ ${totalPartsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
            text += `TOTAL MÃO DE OBRA: R$ ${totalLaborSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
            text += `\nTOTAL GERAL: R$ ${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
            text += `==================================\n`;

            text += "\n*Valores sujeitos a alteração sem aviso prévio.*\n*Orçamento válido por 5 dias.*";

            const area = document.getElementById('cot-outputText');
            const panel = document.getElementById('cot-resultPanel');
            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                await UI.copiarParaClipboard(text, area);
                UI.toast('Orçamento Completo copiado para a Área de Transferência!', 'success');
            }
        } catch (error) {
            UI.toast("Erro ao gerar orçamento: " + error.message, 'error');
            console.error(error);
        }
    },

    // --- GERADOR DE TEXTOS & SINCRONIZAÇÃO DE ESTOQUE ---
    async generateText(type) {
        const usedVendors = new Set();
        this.state.pecas.forEach(p => {
            if (p.vencedor && p.vencedor !== 'ESTOQUE') {
                usedVendors.add(p.vencedor);
            }
        });

        for (const vendor of usedVendors) {
            if (this.state.frete[vendor] === undefined || this.state.frete[vendor] === null) {
                UI.toast(`Preencha o frete do fornecedor "${vendor}" (ou 0 se grátis) antes de gerar.`, 'warning');
                return;
            }
        }

        const model = document.getElementById('cot-carModel')?.value.toUpperCase() || '';
        const plate = document.getElementById('cot-carPlate')?.value.toUpperCase() || '';
        let text = "";
        const area = document.getElementById('cot-outputText');
        const panel = document.getElementById('cot-resultPanel');

        if (type === 'quote') {
            text = `COTAÇÃO - ${model}\nPLACA: ${plate}\n\n`;
            const partsToQuote = this.state.pecas.filter(p => p.vencedor !== 'ESTOQUE' && p.nome.trim() !== '');
            if (partsToQuote.length === 0) text += "(Nenhuma peça para cotar)";
            else partsToQuote.forEach(p => { text += `- ${p.nome.toUpperCase()}\n`; });

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                await UI.copiarParaClipboard(text, area);
                UI.toast('Lista de cotação copiada!', 'success');
            }
        } else if (type === 'order') {
            text = `PEDIDOS DE COMPRA - ${model}\nPLACA: ${plate}\n`;
            const buyItems = this.state.pecas.filter(p => p.vencedor && p.vencedor !== 'ESTOQUE');

            this.state.vendedores.forEach(v => {
                const items = buyItems.filter(p => p.vencedor === v);
                if (items.length) {
                    text += `\n👤 FORNECEDOR: ${v}:\n`;
                    items.forEach(i => {
                        const m = i.precos[v]?.marca ? `(${i.precos[v].marca.toUpperCase()})` : '';
                        text += ` [ ] ${i.qty}x ${i.nome} ${m}\n`;
                    });
                    if (this.state.frete[v] !== undefined && this.state.frete[v] !== null) {
                        text += ` (Frete: R$ ${this.state.frete[v].toFixed(2)})\n`;
                    }
                }
            });

            const stockItems = this.state.pecas.filter(p => p.vencedor === 'ESTOQUE');
            if (stockItems.length > 0) {
                text += `\n📦 SEPARAR DO ESTOQUE DA OFICINA:\n`;
                stockItems.forEach(i => {
                    const m = i.precos['ESTOQUE']?.marca ? `(${i.precos['ESTOQUE'].marca.toUpperCase()})` : '';
                    text += ` [ ] ${i.qty}x ${i.nome} ${m}\n`;
                });
            }

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                await UI.copiarParaClipboard(text, area);
            }

            // PERGUNTA SE DESEJA SINCRONIZAR COM O ESTOQUE
            if (buyItems.length > 0 || stockItems.length > 0) {
                const msg = `Texto do Pedido Copiado com Sucesso!\n\n` +
                            `📦 Deseja FINALIZAR e SINCRONIZAR com o Estoque do ERP agora?\n` +
                            `- ${buyItems.length} peça(s) compradas darão ENTRADA no estoque.\n` +
                            `- ${stockItems.length} peça(s) da oficina terão BAIXA automática.`;

                if (confirm(msg)) {
                    await this.sincronizarComEstoque(buyItems, stockItems, plate, model);
                }
            } else {
                UI.toast('Copiado! (Nenhum item selecionado para compra)', 'info');
            }
        } else if (type === 'internal') {
            text = `RELATÓRIO INTERNO - ${model}\nPLACA: ${plate}\n(Qtd / Peça / Custo Un. / Venda Un. / Marca / Fornecedor)\n\n`;
            this.state.pecas.forEach(p => {
                if (p.vencedor && p.precos[p.vencedor]) {
                    const d = p.precos[p.vencedor];
                    const custo = d.custo ? Number(d.custo).toFixed(2) : '0.00';
                    const venda = d.venda ? Number(d.venda).toFixed(2) : '0.00';
                    text += `${p.qty}x ${p.nome.toUpperCase()} / R$ ${custo} / R$ ${venda} / ${d.marca ? d.marca.toUpperCase() : 'S/ MARCA'} / ${p.vencedor}\n`;
                    text += "--------------------------------------------------\n";
                }
            });

            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                await UI.copiarParaClipboard(text, area);
                UI.toast('Relatório interno copiado!', 'success');
            }
        }
    },

    // --- EXECUTA A SINCRONIZAÇÃO VIA API ---
    async sincronizarComEstoque(buyItems, stockItems, plate, model) {
        try {
            UI.setLoading(true);

            const itensCompraPayload = buyItems.map(p => {
                const info = p.precos[p.vencedor] || {};
                return {
                    qty: p.qty,
                    name: p.nome,
                    brand: info.marca || '',
                    cost: info.custo || 0,
                    sale: info.venda || 0,
                    vendor: p.vencedor
                };
            });

            const itensEstoquePayload = stockItems.map(p => {
                const info = p.precos['ESTOQUE'] || {};
                return {
                    qty: p.qty,
                    name: p.nome,
                    brand: info.marca || '',
                    cost: info.custo || 0,
                    sale: info.venda || 0
                };
            });

            const res = await API.sincronizarCotacao({
                placa: plate,
                modelo: model,
                itensCompra: itensCompraPayload,
                itensEstoque: itensEstoquePayload
            });

            alert(`🎉 ${res.message}\n\n` +
                  `• Peças que entraram: ${res.detalhes?.entradas || 0}\n` +
                  `• Novos cadastros criados: ${res.detalhes?.novosCadastros || 0}\n` +
                  `• Peças baixadas do estoque: ${res.detalhes?.saidas || 0}`);

            // Atualiza tabelas do ERP em segundo plano
            if (window.Estoque) {
                await Estoque.carregarTudo();
            }
        } catch (err) {
            alert('Erro ao sincronizar com o estoque: ' + (err.message || err));
        } finally {
            UI.setLoading(false);
        }
    },

    // --- HISTÓRICO & PERSISTÊNCIA ---
    smartNewQuote() {
        const hasData = this.state.pecas.length > 0 && (this.state.pecas[0].nome !== '' || (document.getElementById('cot-carModel')?.value || '') !== '');
        if (hasData) {
            if (confirm("Salvar o orçamento atual antes de limpar?")) {
                if (this.saveCurrent(false)) this.clearScreen();
            } else {
                if (confirm("Apagar tudo e começar um novo limpo?")) this.clearScreen();
            }
        } else {
            this.clearScreen();
        }
    },

    clearScreen() {
        this.currentId = null;
        this.state.pecas = [];
        this.state.vendedores = [];
        this.state.frete = {};
        this.state.lavagem = false;
        this.state.labor = { type: 'popular', rate: 200, items: [] };

        const modelEl = document.getElementById('cot-carModel');
        const plateEl = document.getElementById('cot-carPlate');
        if (modelEl) modelEl.value = '';
        if (plateEl) plateEl.value = '';

        this.addPartRow();
        this.updateLavagemButton();
        this.renderAll();
        this.saveDraft();
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

    saveCurrent(alertOnSave = true) {
        const m = document.getElementById('cot-carModel')?.value.trim() || '';
        const p = document.getElementById('cot-carPlate')?.value.trim() || '';

        if (!m) {
            UI.toast('Digite o modelo do veículo!', 'warning');
            return false;
        }
        if (!p) {
            if (alertOnSave) UI.toast('Digite a PLACA do veículo para salvar no histórico!', 'warning');
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

        // Persistência centralizada no Supabase em background
        let valorTotal = 0;
        if (Array.isArray(this.state.pecas)) {
            this.state.pecas.forEach(item => {
                if (item.vencedor && item.precos[item.vencedor]) {
                    valorTotal += (Number(item.precos[item.vencedor].venda) || 0) * (Number(item.qty) || 1);
                }
            });
        }
        API.salvarCotacao({
            placa: cleanPlate,
            modelo: m,
            valorTotal,
            dados: this.state
        }).catch(err => console.warn('[Cotacao] Persistência remota em cache:', err.message));

        if (alertOnSave) UI.toast('Orçamento salvo com sucesso no histórico!', 'success');
        return true;
    },

    loadHistoryItems() {
        let h = JSON.parse(localStorage.getItem('cotador_history') || '[]');
        const term = (document.getElementById('cot-searchHistory')?.value || '').toUpperCase();
        const container = document.getElementById('cot-historyList');
        if (!container) return;

        if (this.currentHistoryGroupKey) {
            const carQuotes = h.filter(x => {
                const p = x.plate ? x.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : "";
                const m = x.model || "S/ Modelo";
                const uniqueKey = p !== "" ? p : m;
                return uniqueKey === this.currentHistoryGroupKey;
            });

            carQuotes.sort((a, b) => b.id - a.id);

            const first = carQuotes[0] || {};
            const folderTitle = first.plate || first.model || "Orçamentos";
            const folderSub = first.plate ? first.model : "";

            let html = `
                <div style="background:var(--bg-card); border:1px solid var(--border); padding:10px; border-radius:6px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:var(--gold);">📂 ${folderTitle} <small style="color:var(--text-secondary)">(${folderSub})</small></span>
                    <button onclick="Cotacao.exitHistoryGroup()" class="btn btn-secondary btn-sm" style="padding:4px 10px; cursor:pointer;">⬅ Voltar</button>
                </div>
            `;

            if (carQuotes.length === 0) {
                html += '<p style="text-align:center; color:var(--text-secondary); padding:20px;">Nenhum orçamento encontrado.</p>';
            } else {
                html += carQuotes.map(x => `
                    <div class="history-item" onclick="Cotacao.loadItem(${x.id})">
                        <div>
                            <strong style="color:white;">${x.date}</strong><br>
                            <small style="color:var(--text-secondary);">${x.model}</small>
                        </div>
                        <button class="btn-red" style="padding:6px 12px; border-radius:4px;" onclick="Cotacao.deleteItem(${x.id}, event)">🗑️</button>
                    </div>
                `).join('');
            }
            container.innerHTML = html;
            return;
        }

        const filtered = h.filter(x => ((x.model || '') + ' ' + (x.plate || '')).toUpperCase().includes(term));
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

        container.innerHTML = groupArr.map(g => `
            <div class="history-group" onclick="Cotacao.openHistoryGroup('${g.key.replace(/'/g, "\\'")}')">
                <div>
                    <span style="font-size:16px;">📂</span> <strong style="color:white;">${g.plate || g.latestModel}</strong> <br>
                    <span style="font-size:11px; color:var(--text-secondary);">${g.plate ? g.latestModel : "S/ Placa"}</span>
                </div>
                <div style="font-size:12px; font-weight:bold; color:var(--gold);">
                    ${g.count} cotações ➤
                </div>
            </div>
        `).join('');
    },

    openHistoryGroup(key) {
        this.currentHistoryGroupKey = key;
        const searchInput = document.getElementById('cot-searchHistory');
        if (searchInput) searchInput.value = '';
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
                this.state.pecas.forEach(p => { if (!p.qty) p.qty = 1; });
                if (!this.state.labor) this.state.labor = { type: 'popular', rate: 200, items: [] };
                if (!this.state.frete) this.state.frete = {};
                if (this.state.lavagem === undefined) this.state.lavagem = false;

                this.currentId = item.id;
                const modelEl = document.getElementById('cot-carModel');
                const plateEl = document.getElementById('cot-carPlate');
                if (modelEl) modelEl.value = item.model;
                if (plateEl) plateEl.value = item.plate;

                this.updateLavagemButton();
                this.renderAll();
                this.recalcAllPricesAndRefresh();
                this.toggleHistory();
            }
        };

        if (hasData) {
            if (confirm("Salvar a cotação atual antes de carregar a outra?")) {
                if (this.saveCurrent(false)) performLoad();
            } else {
                if (confirm("Carregar sem salvar a atual?")) performLoad();
            }
        } else {
            performLoad();
        }
    },

    deleteItem(id, ev) {
        if (ev) ev.stopPropagation();
        if (confirm('Apagar permanentemente este orçamento do histórico?')) {
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
        }
    }
};

window.Cotacao = Cotacao;

// Inicialização automática ao carregar o módulo via ViewLoader
window.addEventListener('view:loaded', (e) => {
    if (e.detail && e.detail.module === 'cotacao') {
        Cotacao.iniciar();
    }
});
