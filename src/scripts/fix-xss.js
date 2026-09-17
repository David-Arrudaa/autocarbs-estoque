const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'public', 'js', 'estoque.js');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    // 1. renderizarGeral (porModelo)
    {
        from: `<td><strong style="color:var(--gold); font-size:0.9rem;">\${m.modelo}</strong></td>\n                        <td>\${m.marca}</td>\n                        <td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">\${m.codigo || '-'}</td>`,
        to:   `<td><strong style="color:var(--gold); font-size:0.9rem;">\${UI.escapeHtml(m.modelo)}</strong></td>\n                        <td>\${UI.escapeHtml(m.marca)}</td>\n                        <td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">\${UI.escapeHtml(m.codigo) || '-'}</td>`
    },
    // 2. renderizarGeral footer tipo
    {
        from: `<td colspan="3">TOTAIS DE \${this.filtrosRelatorio.tipo}</td>`,
        to:   `<td colspan="3">TOTAIS DE \${UI.escapeHtml(this.filtrosRelatorio.tipo)}</td>`
    },
    // 3. renderizarGeral (porTipo)
    {
        from: `<td><strong>\${t.tipo}</strong></td>`,
        to:   `<td><strong>\${UI.escapeHtml(t.tipo)}</strong></td>`
    },
    // 4. renderizarGeral (filtro marca/modelo)
    {
        from: `<td><strong style="color:var(--gold);">\${m.modelo}</strong></td>\n                        <td>\${m.tipo}</td>\n                        <td>\${m.marca}</td>`,
        to:   `<td><strong style="color:var(--gold);">\${UI.escapeHtml(m.modelo)}</strong></td>\n                        <td>\${UI.escapeHtml(m.tipo)}</td>\n                        <td>\${UI.escapeHtml(m.marca)}</td>`
    },
    // 5. renderizarRelatorioPorModelo
    {
        from: `<strong style="color:var(--gold); font-size:0.9rem;">\${m.modelo}</strong>\n                    </td>\n                    <td>\${m.tipo}</td>\n                    <td>\${m.marca}</td>\n                    <td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">\${m.codigo || '-'}</td>`,
        to:   `<strong style="color:var(--gold); font-size:0.9rem;">\${UI.escapeHtml(m.modelo)}</strong>\n                    </td>\n                    <td>\${UI.escapeHtml(m.tipo)}</td>\n                    <td>\${UI.escapeHtml(m.marca)}</td>\n                    <td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">\${UI.escapeHtml(m.codigo) || '-'}</td>`
    },
    // 6. renderizarRelatorioPorPecas
    {
        from: `<td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">\${p.codigo || '-'}</td>\n                    <td><strong style="color:var(--gold);">\${p.modelo || '-'}</strong></td>\n                    <td>\${p.tipo}</td>\n                    <td>\${p.marca || 'SEM MARCA'}</td>`,
        to:   `<td style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">\${UI.escapeHtml(p.codigo) || '-'}</td>\n                    <td><strong style="color:var(--gold);">\${UI.escapeHtml(p.modelo) || '-'}</strong></td>\n                    <td>\${UI.escapeHtml(p.tipo)}</td>\n                    <td>\${UI.escapeHtml(p.marca) || 'SEM MARCA'}</td>`
    },
    // 7. gerarDocumentoImpressao header
    {
        from: `<span class="print-title">\${tituloDocumento}</span>`,
        to:   `<span class="print-title">\${UI.escapeHtml(tituloDocumento)}</span>`
    },
    {
        from: `Status: <em>\${statusTxt}</em> | \n                            Tipo: <em>\${tipoTxt}</em> | \n                            Marca: <em>\${marcaTxt}</em> | \n                            Modelo: <em>\${modeloTxt}</em>`,
        to:   `Status: <em>\${UI.escapeHtml(statusTxt)}</em> | \n                            Tipo: <em>\${UI.escapeHtml(tipoTxt)}</em> | \n                            Marca: <em>\${UI.escapeHtml(marcaTxt)}</em> | \n                            Modelo: <em>\${UI.escapeHtml(modeloTxt)}</em>`
    },
    // 8. gerarDocumentoImpressao tipo
    {
        from: `<td class="col-desc"><strong>\${t.tipo}</strong></td>`,
        to:   `<td class="col-desc"><strong>\${UI.escapeHtml(t.tipo)}</strong></td>`
    },
    // 9. gerarDocumentoImpressao modelo
    {
        from: `<td style="font-family:monospace; font-weight:600;">\${m.codigo || '-'}</td>\n                        <td class="col-desc"><strong>\${m.modelo}</strong></td>\n                        <td class="col-desc">\${m.tipo}</td>\n                        <td>\${m.marca}</td>`,
        to:   `<td style="font-family:monospace; font-weight:600;">\${UI.escapeHtml(m.codigo) || '-'}</td>\n                        <td class="col-desc"><strong>\${UI.escapeHtml(m.modelo)}</strong></td>\n                        <td class="col-desc">\${UI.escapeHtml(m.tipo)}</td>\n                        <td>\${UI.escapeHtml(m.marca)}</td>`
    },
    // 10. gerarDocumentoImpressao pecas descCompleta & codFmt
    {
        from: `const descCompleta = \`<strong>\${p.tipo}</strong>\${p.modelo ? ' - ' + p.modelo : ''} <span style="color:#666; font-size:6.5pt;">(\${p.marca || 'SEM MARCA'})</span>\`;\n                const qtdFmt = p.qtd > 0 ? \`<strong>\${p.qtd}</strong>\` : \`<span style="color:#888;">0</span>\`;\n                const codFmt = p.codigo ? p.codigo : \`<span style="color:#bbb;">-</span>\`;`,
        to:   `const descCompleta = \`<strong>\${UI.escapeHtml(p.tipo)}</strong>\${p.modelo ? ' - ' + UI.escapeHtml(p.modelo) : ''} <span style="color:#666; font-size:6.5pt;">(\${UI.escapeHtml(p.marca) || 'SEM MARCA'})</span>\`;\n                const qtdFmt = p.qtd > 0 ? \`<strong>\${p.qtd}</strong>\` : \`<span style="color:#888;">0</span>\`;\n                const codFmt = p.codigo ? UI.escapeHtml(p.codigo) : \`<span style="color:#bbb;">-</span>\`;`
    }
];

let applied = 0;
for (const r of replacements) {
    if (content.includes(r.from)) {
        content = content.replace(r.from, r.to);
        applied++;
    } else {
        console.warn('Could not find chunk:', r.from.substring(0, 50));
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Applied ${applied} of ${replacements.length} XSS fixes successfully to estoque.js!`);
