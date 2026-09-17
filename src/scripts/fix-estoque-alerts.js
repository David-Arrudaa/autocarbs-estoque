const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'public', 'js', 'estoque.js');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    {
        from: `alert(err.message || 'Erro ao carregar lista de produtos.');`,
        to:   `UI.toast(err.message || 'Erro ao carregar lista de produtos.', 'error');`
    },
    {
        from: `return alert('Preencha o tipo do produto!');`,
        to:   `return UI.toast('Preencha o tipo do produto!', 'warning');`
    },
    {
        from: `            if (this.idEdicao === null) {
                await API.cadastrarProduto(p);
            } else {
                await API.atualizarProduto(this.idEdicao, p);
            }
            this.fecharModal('modal-cadastro');
            await this.carregarTudo();
        } catch (err) {
            alert(err.message || 'Erro ao salvar produto.');`,
        to:   `            if (this.idEdicao === null) {
                await API.cadastrarProduto(p);
                UI.toast('Produto cadastrado com sucesso!', 'success');
            } else {
                await API.atualizarProduto(this.idEdicao, p);
                UI.toast('Produto atualizado com sucesso!', 'success');
            }
            this.fecharModal('modal-cadastro');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Erro ao salvar produto.', 'error');`
    },
    {
        from: `return alert('Quantidade inválida para entrada.');`,
        to:   `return UI.toast('Quantidade inválida para entrada.', 'warning');`
    },
    {
        from: `            await API.registrarEntrada(this.idMovimentacao, qtd, devolucao);
            this.fecharModal('modal-entrada');
            await this.carregarTudo();
        } catch (err) {
            alert(err.message || 'Erro ao registrar entrada.');`,
        to:   `            await API.registrarEntrada(this.idMovimentacao, qtd, devolucao);
            UI.toast('Entrada registrada com sucesso!', 'success');
            this.fecharModal('modal-entrada');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Erro ao registrar entrada.', 'error');`
    },
    {
        from: `return alert('Quantidade inválida para saída.');`,
        to:   `return UI.toast('Quantidade inválida para saída.', 'warning');`
    },
    {
        from: `            await API.registrarSaida(this.idMovimentacao, qtd, isVenda);
            this.fecharModal('modal-saida');
            await this.carregarTudo();
        } catch (err) {
            alert(err.message || 'Erro ao registrar saída.');`,
        to:   `            await API.registrarSaida(this.idMovimentacao, qtd, isVenda);
            UI.toast('Saída realizada com sucesso!', 'success');
            this.fecharModal('modal-saida');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Erro ao registrar saída.', 'error');`
    },
    {
        from: `return alert('Digite a senha de supervisor.');`,
        to:   `return UI.toast('Digite a senha de supervisor.', 'warning');`
    },
    {
        from: `            await API.excluirProduto(this.idExclusao, senhaSupervisor);
            this.fecharModal('modal-senha-exclusao');
            await this.carregarTudo();
        } catch (err) {
            alert(err.message || 'Senha de supervisor incorreta ou erro ao excluir.');`,
        to:   `            await API.excluirProduto(this.idExclusao, senhaSupervisor);
            UI.toast('Produto excluído com sucesso!', 'success');
            this.fecharModal('modal-senha-exclusao');
            await this.carregarTudo();
        } catch (err) {
            UI.toast(err.message || 'Senha de supervisor incorreta ou erro ao excluir.', 'error');`
    },
    {
        from: `alert(err.message || 'Erro ao carregar relatório.');`,
        to:   `UI.toast(err.message || 'Erro ao carregar relatório.', 'error');`
    },
    {
        from: `return alert('Nenhum dado de relatório carregado para exportar.');`,
        to:   `return UI.toast('Nenhum dado de relatório carregado para exportar.', 'warning');`
    },
    {
        from: `return alert('Nenhum dado carregado para gerar o relatório.');`,
        to:   `return UI.toast('Nenhum dado carregado para gerar o relatório.', 'warning');`
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
console.log(`Applied ${applied} of ${replacements.length} Toast replacements to estoque.js!`);

