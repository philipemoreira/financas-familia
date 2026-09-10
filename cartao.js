import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
    query, where, onSnapshot, Timestamp, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function () {

    const listaFaturasCartoes = document.getElementById("lista-faturas-cartoes");
    const cartoesVazio = document.getElementById("cartoes-vazio");
    const botaoAbrirNovoCartao = document.getElementById("botao-abrir-novo-cartao");

    const fundoModalCartao = document.getElementById("fundo-modal-cartao");
    const tituloModalCartao = document.getElementById("titulo-modal-cartao");
    const botaoFecharCartao = document.getElementById("botao-fechar-cartao");
    const campoNomeCartao = document.getElementById("campo-nome-cartao");
    const campoVencimentoCartao = document.getElementById("campo-vencimento-cartao");
    const mensagemAvisoCartao = document.getElementById("mensagem-aviso-cartao");
    const botaoSalvarCartao = document.getElementById("botao-salvar-cartao");
    const botaoRemoverCartao = document.getElementById("botao-remover-cartao");

    const listaItensCartao = document.getElementById("lista-itens-cartao");
    const itensCartaoVazio = document.getElementById("itens-cartao-vazio");
    const botaoAbrirNovoItem = document.getElementById("botao-abrir-novo-item");

    const fundoModalItemCartao = document.getElementById("fundo-modal-item-cartao");
    const botaoFecharItemCartao = document.getElementById("botao-fechar-item-cartao");
    const campoCartaoDoItem = document.getElementById("campo-cartao-do-item");
    const campoNomeItemCartao = document.getElementById("campo-nome-item-cartao");
    const tipoItemFixo = document.getElementById("tipo-item-fixo");
    const tipoItemParcelado = document.getElementById("tipo-item-parcelado");
    const campoParcelasItemCartaoWrapper = document.getElementById("campo-parcelas-item-cartao-wrapper");
    const campoParcelasItemCartao = document.getElementById("campo-parcelas-item-cartao");
    const rotuloValorItemCartao = document.getElementById("rotulo-valor-item-cartao");
    const campoValorItemCartao = document.getElementById("campo-valor-item-cartao");
    const mensagemAvisoItemCartao = document.getElementById("mensagem-aviso-item-cartao");
    const botaoSalvarItemCartao = document.getElementById("botao-salvar-item-cartao");

    const fundoModalConfirmar = document.getElementById("fundo-modal-confirmar");
    const tituloModalConfirmar = document.getElementById("titulo-modal-confirmar");
    const textoModalConfirmar = document.getElementById("texto-modal-confirmar");
    const botaoConfirmarAcao = document.getElementById("botao-confirmar-acao");
    const botaoCancelarAcao = document.getElementById("botao-cancelar-acao");
    const botaoFecharConfirmar = document.getElementById("botao-fechar-confirmar");

    const toast = document.getElementById("toast");
    const toastMensagem = document.getElementById("toast-mensagem");
    const toastBotaoAcao = document.getElementById("toast-botao-acao");

    let uidAtual = null;
    let listaDeCartoes = []; // [{id, nome, diaVencimento}]
    let itensDeTodasAsFaturas = [];
    let cartaoEmEdicaoId = null;

    // ==========================================================================
    // TELINHA DE CONFIRMAÇÃO — substitui o confirm() feio do navegador
    // ==========================================================================
    function confirmarComTelinha(mensagem, titulo = "Confirmar") {
        return new Promise((resolve) => {
            tituloModalConfirmar.textContent = titulo;
            textoModalConfirmar.textContent = mensagem;
            fundoModalConfirmar.classList.add("aberto");

            function limpar() {
                fundoModalConfirmar.classList.remove("aberto");
                botaoConfirmarAcao.removeEventListener("click", aoConfirmar);
                botaoCancelarAcao.removeEventListener("click", aoCancelar);
                botaoFecharConfirmar.removeEventListener("click", aoCancelar);
            }
            function aoConfirmar() { limpar(); resolve(true); }
            function aoCancelar() { limpar(); resolve(false); }

            botaoConfirmarAcao.addEventListener("click", aoConfirmar);
            botaoCancelarAcao.addEventListener("click", aoCancelar);
            botaoFecharConfirmar.addEventListener("click", aoCancelar);
        });
    }

    let timeoutToast = null;
    function mostrarToast(mensagem, duracaoMs = 2200) {
        if (timeoutToast) clearTimeout(timeoutToast);
        toastMensagem.textContent = mensagem;
        toastBotaoAcao.hidden = true;
        toast.hidden = false;
        timeoutToast = setTimeout(() => { toast.hidden = true; }, duracaoMs);
    }

    function mesReferenciaString(data) {
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    }

    function formatarMoeda(valor) {
        const valorCorrigido = valor === 0 ? 0 : valor;
        return valorCorrigido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function paraNumero(texto) {
        return parseFloat(String(texto).replace(",", "."));
    }

    // ==========================================================================
    // LOGIN E CARREGAMENTO INICIAL
    // ==========================================================================
    onAuthStateChanged(auth, async (usuario) => {
        if (!usuario) {
            window.location.href = "index.html";
            return;
        }
        uidAtual = usuario.uid;

        escutarCartoes();
        escutarItensDeTodasAsFaturas();

        const parametros = new URLSearchParams(window.location.search);
        if (parametros.get("adicionar") === "1") {
            // Espera os cartões carregarem antes de abrir o formulário, senão
            // o select "Em qual cartão" abriria vazio
            const aguardar = setInterval(() => {
                if (listaDeCartoes.length > 0) {
                    clearInterval(aguardar);
                    abrirModalNovoItem();
                }
            }, 150);
            setTimeout(() => clearInterval(aguardar), 3000);
        }
    });

    // ==========================================================================
    // CARTÕES — criar, editar, remover
    // ==========================================================================
    function escutarCartoes() {
        const referencia = collection(db, "usuarios", uidAtual, "cartoes");
        onSnapshot(referencia, (snapshot) => {
            listaDeCartoes = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
            renderizarFaturas();
            popularSelectCartoes();
        });
    }

    function popularSelectCartoes() {
        const valorAtual = campoCartaoDoItem.value;
        campoCartaoDoItem.innerHTML = "";
        listaDeCartoes.forEach((cartao) => {
            const opcao = document.createElement("option");
            opcao.value = cartao.id;
            opcao.textContent = cartao.nome;
            campoCartaoDoItem.appendChild(opcao);
        });
        if (valorAtual) campoCartaoDoItem.value = valorAtual;
    }

    function abrirModalCartao(cartao) {
        cartaoEmEdicaoId = cartao ? cartao.id : null;
        tituloModalCartao.textContent = cartao ? "Editar cartão" : "Novo cartão";
        campoNomeCartao.value = cartao ? cartao.nome : "";
        campoVencimentoCartao.value = cartao ? (cartao.diaVencimento || "") : "";
        botaoRemoverCartao.hidden = !cartao;
        mensagemAvisoCartao.classList.remove("visivel");
        fundoModalCartao.classList.add("aberto");
    }

    botaoAbrirNovoCartao.addEventListener("click", () => abrirModalCartao(null));
    botaoFecharCartao.addEventListener("click", () => fundoModalCartao.classList.remove("aberto"));
    fundoModalCartao.addEventListener("click", (evento) => {
        if (evento.target === fundoModalCartao) fundoModalCartao.classList.remove("aberto");
    });

    botaoSalvarCartao.addEventListener("click", async () => {
        const nome = campoNomeCartao.value.trim();
        const diaVencimento = parseInt(campoVencimentoCartao.value, 10) || null;
        mensagemAvisoCartao.classList.remove("visivel");

        if (!nome) {
            mensagemAvisoCartao.textContent = "Digita um nome pro cartão.";
            mensagemAvisoCartao.classList.add("visivel");
            return;
        }

        const spinner = botaoSalvarCartao.querySelector(".spinner-botao");
        botaoSalvarCartao.disabled = true;
        spinner.hidden = false;

        if (cartaoEmEdicaoId) {
            await updateDoc(doc(db, "usuarios", uidAtual, "cartoes", cartaoEmEdicaoId), { nome, diaVencimento });
        } else {
            await addDoc(collection(db, "usuarios", uidAtual, "cartoes"), { nome, diaVencimento });
        }

        botaoSalvarCartao.disabled = false;
        spinner.hidden = true;
        fundoModalCartao.classList.remove("aberto");
        mostrarToast("Cartão salvo ✓");
    });

    botaoRemoverCartao.addEventListener("click", async () => {
        if (!cartaoEmEdicaoId) return;
        const confirmou = await confirmarComTelinha(
            "Tem certeza de que deseja remover esse cartão? Os itens que já entraram em faturas continuam salvos no histórico.",
            "Remover cartão"
        );
        if (!confirmou) return;

        await deleteDoc(doc(db, "usuarios", uidAtual, "cartoes", cartaoEmEdicaoId));
        fundoModalCartao.classList.remove("aberto");
        mostrarToast("Cartão removido");
    });

    // ==========================================================================
    // ITENS DE TODAS AS FATURAS — sempre o mês real de hoje (essa tela não
    // navega por mês, é sempre "o que está pra vencer agora")
    // ==========================================================================
    function escutarItensDeTodasAsFaturas() {
        const mesAtual = mesReferenciaString(new Date());
        const referencia = collection(db, "usuarios", uidAtual, "pendencias");
        const consulta = query(referencia, where("mesReferencia", "==", mesAtual), where("noCartao", "==", true));

        onSnapshot(consulta, (snapshot) => {
            itensDeTodasAsFaturas = snapshot.docs;
            renderizarItensCartao();
            renderizarFaturas();
        });
    }

    function nomeDoCartao(cartaoId) {
        const cartao = listaDeCartoes.find((c) => c.id === cartaoId);
        return cartao ? cartao.nome : "Cartão removido";
    }

    function renderizarItensCartao() {
        listaItensCartao.innerHTML = "";
        itensCartaoVazio.hidden = itensDeTodasAsFaturas.length > 0;

        itensDeTodasAsFaturas.forEach((documento) => {
            const dados = documento.data();
            const badge = dados.origem === "parcelado"
                ? `<span class="badge-parcela">Parcela ${dados.numeroParcela}/${dados.totalParcelas}</span>`
                : `<span class="badge-parcela">Fixo</span>`;
            const badgeCartaoHtml = `<span class="badge-cartao">${nomeDoCartao(dados.cartaoId)}</span>`;

            const item = document.createElement("li");
            item.className = "item-conta";
            item.innerHTML = `
                <div class="info-conta">
                    <div class="nome-conta">${dados.descricao}${badge}${badgeCartaoHtml}</div>
                    <div class="meta-conta">${dados.pago ? "Já entrou nessa fatura" : "Entra na próxima fatura"}</div>
                </div>
                <span class="valor-conta" style="color: ${dados.pago ? "var(--sucesso)" : "#F5D76E"};">${formatarMoeda(dados.valor)}</span>
                <button class="botao-excluir-conta" data-id="${documento.id}" aria-label="Excluir item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/>
                    </svg>
                </button>
            `;
            listaItensCartao.appendChild(item);
        });
    }

    listaItensCartao.addEventListener("click", async (evento) => {
        const botao = evento.target.closest(".botao-excluir-conta");
        if (!botao) return;

        const referenciaItem = doc(db, "usuarios", uidAtual, "pendencias", botao.dataset.id);
        const snapshotItem = await getDoc(referenciaItem);
        if (!snapshotItem.exists()) return;
        const dadosItem = snapshotItem.data();

        let excluirTodas = false;
        if (dadosItem.grupoId) {
            const tipoGrupo = dadosItem.origem === "parcelado" ? "parcelamento" : "recorrência fixa";
            excluirTodas = await confirmarComTelinha(
                `Esse item faz parte de um(a) ${tipoGrupo}. Confirma pra excluir também as próximas ocorrências (ainda não pagas), ou cancela pra excluir só esse mês.`,
                "Excluir todas as próximas?"
            );
        }

        const confirmouExcluir = await confirmarComTelinha("Tem certeza de que deseja excluir?", "Confirmar exclusão");
        if (!confirmouExcluir) return;

        if (excluirTodas) {
            const referenciaPendencias = collection(db, "usuarios", uidAtual, "pendencias");
            const consultaGrupo = query(referenciaPendencias, where("grupoId", "==", dadosItem.grupoId), where("pago", "==", false));
            const pendenciasDoGrupo = await getDocs(consultaGrupo);
            for (const documento of pendenciasDoGrupo.docs) {
                await deleteDoc(documento.ref);
            }
        } else {
            if (dadosItem.lancamentoId) {
                await deleteDoc(doc(db, "usuarios", uidAtual, "lancamentos", dadosItem.lancamentoId)).catch(() => {});
            }
            await deleteDoc(referenciaItem);
        }

        mostrarToast("Item excluído ✓");
    });

    // ==========================================================================
    // FATURAS — uma por cartão cadastrado
    // ==========================================================================
    function renderizarFaturas() {
        listaFaturasCartoes.innerHTML = "";
        cartoesVazio.hidden = listaDeCartoes.length > 0;

        listaDeCartoes.forEach((cartao) => {
            const itensDoCartao = itensDeTodasAsFaturas.filter((documento) => documento.data().cartaoId === cartao.id);
            const itensNaoPagos = itensDoCartao.filter((documento) => !documento.data().pago);
            const faturaEstaPaga = itensDoCartao.length > 0 && itensNaoPagos.length === 0;
            const itensRelevantes = faturaEstaPaga ? itensDoCartao : itensNaoPagos;
            const totalFatura = itensRelevantes.reduce((soma, documento) => soma + documento.data().valor, 0);

            const textoVencimento = cartao.diaVencimento ? `Vence todo dia ${cartao.diaVencimento}` : "Sem dia de vencimento definido";

            const botaoAcaoHtml = faturaEstaPaga
                ? `<button type="button" class="link-botao-simples" data-acao="desmarcar" data-cartao="${cartao.id}">✓ Paga — desmarcar</button>`
                : (itensDoCartao.length > 0
                    ? `<button type="button" class="botao-retirar" data-acao="marcar" data-cartao="${cartao.id}">Marcar como paga</button>`
                    : "");

            const item = document.createElement("div");
            item.className = "fatura-cartao-item";
            item.innerHTML = `
                <div class="fatura-cartao-cabecalho">
                    <span class="fatura-cartao-nome">${cartao.nome}</span>
                    <button type="button" class="link-botao-simples" data-acao="editar" data-cartao="${cartao.id}">Editar</button>
                </div>
                <span class="fatura-cartao-valor">${formatarMoeda(totalFatura)}</span>
                <span class="fatura-cartao-vencimento">${textoVencimento}</span>
                ${botaoAcaoHtml}
            `;
            listaFaturasCartoes.appendChild(item);
        });
    }

    listaFaturasCartoes.addEventListener("click", async (evento) => {
        const botao = evento.target.closest("[data-acao]");
        if (!botao) return;

        const cartaoId = botao.dataset.cartao;
        const acao = botao.dataset.acao;

        if (acao === "editar") {
            const cartao = listaDeCartoes.find((c) => c.id === cartaoId);
            abrirModalCartao(cartao);
            return;
        }

        const itensDoCartao = itensDeTodasAsFaturas.filter((documento) => documento.data().cartaoId === cartaoId);

        if (acao === "marcar") {
            const itensNaoPagos = itensDoCartao.filter((documento) => !documento.data().pago);
            const totalFatura = itensNaoPagos.reduce((soma, documento) => soma + documento.data().valor, 0);
            if (itensNaoPagos.length === 0) return;

            const confirmou = await confirmarComTelinha(
                `Confirma o pagamento da fatura do ${nomeDoCartao(cartaoId)}, no valor de ${formatarMoeda(totalFatura)}? Isso desconta o valor total do seu saldo, uma vez só.`,
                "Pagar fatura"
            );
            if (!confirmou) return;

            const agora = new Date();
            const novoLancamento = await addDoc(collection(db, "usuarios", uidAtual, "lancamentos"), {
                tipo: "gasto",
                valor: totalFatura,
                categoria: "Fatura do Cartão",
                descricao: `Fatura — ${nomeDoCartao(cartaoId)}`,
                data: Timestamp.fromDate(agora),
                mesReferencia: mesReferenciaString(agora),
                criadoEm: serverTimestamp()
            });

            const lote = writeBatch(db);
            itensNaoPagos.forEach((documento) => {
                lote.update(doc(db, "usuarios", uidAtual, "pendencias", documento.id), {
                    pago: true,
                    lancamentoId: novoLancamento.id,
                    pagoEm: serverTimestamp()
                });
            });
            await lote.commit();
            mostrarToast("Fatura paga ✓");
        }

        if (acao === "desmarcar") {
            const itensPagos = itensDoCartao.filter((documento) => documento.data().pago);
            if (itensPagos.length === 0) return;

            const confirmou = await confirmarComTelinha(
                "Tem certeza de que deseja desmarcar o pagamento dessa fatura? O valor volta pro seu saldo.",
                "Desmarcar fatura"
            );
            if (!confirmou) return;

            const idsLancamentosUnicos = [...new Set(itensPagos.map((documento) => documento.data().lancamentoId).filter(Boolean))];
            for (const idLancamento of idsLancamentosUnicos) {
                await deleteDoc(doc(db, "usuarios", uidAtual, "lancamentos", idLancamento)).catch(() => {});
            }

            const lote = writeBatch(db);
            itensPagos.forEach((documento) => {
                lote.update(doc(db, "usuarios", uidAtual, "pendencias", documento.id), {
                    pago: false,
                    lancamentoId: null,
                    pagoEm: null
                });
            });
            await lote.commit();
            mostrarToast("Fatura desmarcada");
        }
    });

    // ==========================================================================
    // ADICIONAR ITEM NUMA FATURA
    // ==========================================================================
    function atualizarTipoItem() {
        const ehParcelado = tipoItemParcelado.checked;
        campoParcelasItemCartaoWrapper.hidden = !ehParcelado;
        campoParcelasItemCartao.required = ehParcelado;
        rotuloValorItemCartao.textContent = ehParcelado ? "Valor total da compra" : "Valor mensal";
    }

    tipoItemFixo.addEventListener("change", atualizarTipoItem);
    tipoItemParcelado.addEventListener("change", atualizarTipoItem);

    function abrirModalNovoItem() {
        if (listaDeCartoes.length === 0) {
            mostrarToast("Cria um cartão primeiro, aí sim dá pra adicionar itens.");
            return;
        }
        campoNomeItemCartao.value = "";
        campoValorItemCartao.value = "";
        campoParcelasItemCartao.value = "";
        tipoItemFixo.checked = true;
        popularSelectCartoes();
        atualizarTipoItem();
        mensagemAvisoItemCartao.classList.remove("visivel");
        fundoModalItemCartao.classList.add("aberto");
    }

    botaoAbrirNovoItem.addEventListener("click", abrirModalNovoItem);
    botaoFecharItemCartao.addEventListener("click", () => {
        fundoModalItemCartao.classList.remove("aberto");
    });
    fundoModalItemCartao.addEventListener("click", (evento) => {
        if (evento.target === fundoModalItemCartao) fundoModalItemCartao.classList.remove("aberto");
    });

    botaoSalvarItemCartao.addEventListener("click", async () => {
        const cartaoId = campoCartaoDoItem.value;
        const nome = campoNomeItemCartao.value.trim();
        const valor = paraNumero(campoValorItemCartao.value);
        const ehParcelado = tipoItemParcelado.checked;
        const numeroParcelas = ehParcelado ? parseInt(campoParcelasItemCartao.value, 10) : 1;

        mensagemAvisoItemCartao.classList.remove("visivel");

        if (!cartaoId) {
            mensagemAvisoItemCartao.textContent = "Escolhe em qual cartão esse item entra.";
            mensagemAvisoItemCartao.classList.add("visivel");
            return;
        }
        if (!nome) {
            mensagemAvisoItemCartao.textContent = "Digita um nome pro item.";
            mensagemAvisoItemCartao.classList.add("visivel");
            return;
        }
        if (!valor || valor <= 0) {
            mensagemAvisoItemCartao.textContent = "Digita um valor maior que zero.";
            mensagemAvisoItemCartao.classList.add("visivel");
            return;
        }
        if (ehParcelado && (!numeroParcelas || numeroParcelas < 2)) {
            mensagemAvisoItemCartao.textContent = "Informa um número de parcelas válido (mínimo 2).";
            mensagemAvisoItemCartao.classList.add("visivel");
            return;
        }

        const spinner = botaoSalvarItemCartao.querySelector(".spinner-botao");
        botaoSalvarItemCartao.disabled = true;
        spinner.hidden = false;

        const hoje = new Date();
        const cartaoEscolhido = listaDeCartoes.find((c) => c.id === cartaoId);
        const diaParaRegistro = (cartaoEscolhido && cartaoEscolhido.diaVencimento) || 1;

        if (ehParcelado) {
            const valorParcela = Math.floor((valor / numeroParcelas) * 100) / 100;
            const diferencaCentavos = Math.round((valor - valorParcela * numeroParcelas) * 100) / 100;
            const grupoId = `parc_cartao_${Date.now()}`;

            for (let indice = 0; indice < numeroParcelas; indice++) {
                const anoDestino = hoje.getFullYear();
                const mesDestino = hoje.getMonth() + indice;
                const ultimoDiaDoMes = new Date(anoDestino, mesDestino + 1, 0).getDate();
                const diaFinal = Math.min(diaParaRegistro, ultimoDiaDoMes);
                const mesReferencia = mesReferenciaString(new Date(anoDestino, mesDestino, 1));
                const ehUltima = indice === numeroParcelas - 1;
                const valorDessaParcela = ehUltima ? valorParcela + diferencaCentavos : valorParcela;

                await addDoc(collection(db, "usuarios", uidAtual, "pendencias"), {
                    valor: valorDessaParcela,
                    valorTotalCompra: valor,
                    categoria: "Cartão de Crédito",
                    descricao: nome,
                    diaDoMes: diaFinal,
                    mesReferencia,
                    origem: "parcelado",
                    numeroParcela: indice + 1,
                    totalParcelas: numeroParcelas,
                    grupoId,
                    noCartao: true,
                    cartaoId,
                    pago: false,
                    criadoEm: serverTimestamp()
                });
            }
        } else {
            const grupoId = `fixo_cartao_${Date.now()}`;
            for (let indice = 0; indice < 12; indice++) {
                const anoDestino = hoje.getFullYear();
                const mesDestino = hoje.getMonth() + indice;
                const ultimoDiaDoMes = new Date(anoDestino, mesDestino + 1, 0).getDate();
                const diaFinal = Math.min(diaParaRegistro, ultimoDiaDoMes);
                const mesReferencia = mesReferenciaString(new Date(anoDestino, mesDestino, 1));

                await addDoc(collection(db, "usuarios", uidAtual, "pendencias"), {
                    valor,
                    categoria: "Cartão de Crédito",
                    descricao: nome,
                    diaDoMes: diaFinal,
                    mesReferencia,
                    origem: "fixo",
                    grupoId,
                    noCartao: true,
                    cartaoId,
                    pago: false,
                    criadoEm: serverTimestamp()
                });
            }
        }

        botaoSalvarItemCartao.disabled = false;
        spinner.hidden = true;
        fundoModalItemCartao.classList.remove("aberto");
        mostrarToast("Item adicionado ✓");
    });

});
