const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'public', 'js', 'cotacao.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Modernizar cópia e alertas em generateBudgetWithLabor
content = content.replace(
`            const area = document.getElementById('cot-outputText');
            const panel = document.getElementById('cot-resultPanel');
            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                document.execCommand('copy');
                alert('✅ Orçamento Completo Copiado para a Área de Transferência!');
            }
        } catch (error) {
            alert("Erro ao gerar orçamento: " + error.message);
            console.error(error);
        }`,
`            const area = document.getElementById('cot-outputText');
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
        }`
);

// 2. Modernizar frete alert em generateText
content = content.replace(
`        for (const vendor of usedVendors) {
            if (this.state.frete[vendor] === undefined || this.state.frete[vendor] === null) {
                alert(\`⚠️ ATENÇÃO: O fornecedor "\${vendor}" tem peças selecionadas mas está sem valor de FRETE.\\n\\nPor favor, preencha o frete (coloque 0 se for grátis) antes de gerar.\`);
                return;
            }
        }`,
`        for (const vendor of usedVendors) {
            if (this.state.frete[vendor] === undefined || this.state.frete[vendor] === null) {
                UI.toast(\`Preencha o frete do fornecedor "\${vendor}" (ou 0 se grátis) antes de gerar.\`, 'warning');
                return;
            }
        }`
);

// 3. Modernizar cópia em quote
content = content.replace(
`            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                document.execCommand('copy');
                alert('✅ Lista de cotação copiada!');
            }`,
`            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                await UI.copiarParaClipboard(text, area);
                UI.toast('Lista de cotação copiada!', 'success');
            }`
);

// 4. Modernizar cópia em order
content = content.replace(
`            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                document.execCommand('copy');
            }`,
`            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                await UI.copiarParaClipboard(text, area);
            }`
);

content = content.replace(
`            } else {
                alert('✅ Copiado! (Nenhum item selecionado para compra)');
            }`,
`            } else {
                UI.toast('Copiado! (Nenhum item selecionado para compra)', 'info');
            }`
);

// 5. Modernizar cópia em internal
content = content.replace(
`            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                area.select();
                document.execCommand('copy');
                alert('✅ Relatório interno copiado!');
            }`,
`            if (area && panel) {
                area.value = text;
                panel.style.display = 'block';
                await UI.copiarParaClipboard(text, area);
                UI.toast('Relatório interno copiado!', 'success');
            }`
);

// 6. Modernizar saveCurrent alerts
content = content.replace(
`        if (!m) {
            alert('Digite o modelo do veículo!');
            return false;
        }
        if (!p) {
            if (alertOnSave) alert('Digite a PLACA do veículo para salvar no histórico!');
            return false;
        }`,
`        if (!m) {
            UI.toast('Digite o modelo do veículo!', 'warning');
            return false;
        }
        if (!p) {
            if (alertOnSave) UI.toast('Digite a PLACA do veículo para salvar no histórico!', 'warning');
            return false;
        }`
);

content = content.replace(
`        if (alertOnSave) alert('✅ Orçamento salvo com sucesso no histórico!');`,
`        if (alertOnSave) UI.toast('Orçamento salvo com sucesso no histórico!', 'success');`
);

// 7. Sanitizar renderTags XSS
content = content.replace(
`    renderTags() {
        const el = document.getElementById('cot-vendorTags');
        if (!el) return;
        el.innerHTML = this.state.vendedores.map(v => 
            \`<span class="vendor-tag">\${v} <span onclick="Cotacao.removeVendor('\${v}')">&times;</span></span>\`
        ).join('');
    },`,
`    renderTags() {
        const el = document.getElementById('cot-vendorTags');
        if (!el) return;
        el.innerHTML = this.state.vendedores.map(v => {
            const vEsc = UI.escapeHtml(v);
            const vParam = v.replace(/'/g, "\\\\'");
            return \`<span class="vendor-tag">\${vEsc} <span onclick="Cotacao.removeVendor('\${vParam}')">&times;</span></span>\`;
        }).join('');
    },`
);

// 8. Sanitizar renderHeader vendor title & oninput
content = content.replace(
`            html += this.state.vendedores.map(v => {
                const freteVal = this.state.frete[v] || '';
                return \`<th colspan="4" class="th-vendor" style="border-left: 3px solid #777;">
                            <div style="font-size: 13px; margin-bottom: 3px; color:#fff;">\${v}</div>
                            <div class="freight-container">
                                <span class="freight-label">FRETE</span>
                                <input type="number" class="inp-freight-small" placeholder="0,00" value="\${freteVal}" oninput="Cotacao.updateFreight('\${v}', this.value)">
                            </div>
                        </th>\`;
            }).join('');`,
`            html += this.state.vendedores.map(v => {
                const freteVal = this.state.frete[v] || '';
                const vEsc = UI.escapeHtml(v);
                const vParam = v.replace(/'/g, "\\\\'");
                return \`<th colspan="4" class="th-vendor" style="border-left: 3px solid #777;">
                            <div style="font-size: 13px; margin-bottom: 3px; color:#fff;">\${vEsc}</div>
                            <div class="freight-container">
                                <span class="freight-label">FRETE</span>
                                <input type="number" class="inp-freight-small" placeholder="0,00" value="\${freteVal}" oninput="Cotacao.updateFreight('\${vParam}', this.value)">
                            </div>
                        </th>\`;
            }).join('');`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cotacao.js successfully modernized (Clipboard API + Toast + XSS Sanitization)!');

