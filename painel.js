// Painel único de consulta: Calendário (a partir de calendario.csv) +
// Produtos com agenda / Faturados sem agenda (a partir de produtos.json,
// gerado por build/gerar_produtos_json.py a partir da planilha). Tudo
// client-side, sem servidor - só consulta, ninguém edita por aqui.

(function () {
  "use strict";

  // ---------------------------------------------------------------- abas --

  const abas = document.querySelectorAll(".aba");
  const paineis = {
    calendario: document.getElementById("painelCalendario"),
    agenda: document.getElementById("painelAgenda"),
    "sem-agenda": document.getElementById("painelSemAgenda"),
  };
  function mostraAba(nome) {
    abas.forEach(function (b) { b.classList.toggle("ativa", b.dataset.aba === nome); });
    Object.keys(paineis).forEach(function (k) { paineis[k].hidden = k !== nome; });
  }
  abas.forEach(function (btn) {
    btn.addEventListener("click", function () { mostraAba(btn.dataset.aba); });
  });

  // Botoes "?" que explicam os campos de cada tela - um painel-ajuda por
  // botao, identificado por data-alvo. So' alterna visibilidade, nada mais.
  document.querySelectorAll(".botao-ajuda[data-alvo]").forEach(function (btn) {
    const painel = document.getElementById(btn.dataset.alvo);
    if (!painel) return;
    btn.addEventListener("click", function () {
      const aberto = !painel.hidden;
      painel.hidden = aberto;
      btn.setAttribute("aria-expanded", String(!aberto));
    });
  });

  function badge(status) {
    const conhecidos = ["CONFIRMADO", "ENTREGUE", "REAGENDADO"];
    const st = conhecidos.indexOf(status) >= 0 ? status : "OUTRO";
    return '<span class="badge badge-st-' + st + '">' + (status || "—") + "</span>";
  }

  // Versao compacta do badge pra tabela "Produtos com agenda" - mesma cor,
  // so' que uma bolinha em vez do texto, com o status no title (hover/toque).
  function pontoStatus(status) {
    const conhecidos = ["CONFIRMADO", "ENTREGUE", "REAGENDADO"];
    const st = conhecidos.indexOf(status) >= 0 ? status : "OUTRO";
    return '<span class="ponto-status ponto-status-' + st + '" title="' + (status || "—") + '"></span>';
  }

  function formataBR(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return "—";
    const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
    return dia + "/" + mes + "/" + ano;
  }

  function hojeIso() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Legendas do cadastro (grupo/subgrupo/ciclo vem em sigla nos dados; o
  // codigo permanece o valor do filtro, so' o texto mostrado muda).
  const NOMES_GRUPO = {
    CRT: "Cortina", FAN: "Fancolete", FIX: "Fixo", INV: "Inverter",
    LCFI: "Linha Comercial Fixo", LCIN: "Linha Comercial Inverter",
    MSP: "Multi-Split", SPT: "Splitão", VRF: "VRF", VT: "Ventilador",
  };
  const NOMES_SUBGRUPO = {
    BDG: "Bomba Drenagem", CLI: "Climatizador", CMP: "Componente", COND: "Condensadora",
    CRT: "Cortina", CTR: "Controle", DUT: "Duto", HED: "Header", HW: "Hi Wall",
    JAN: "Janela", K71: "K7 1 via", K72: "K7 2 vias", "K7-360": "K7-360",
    K74: "K7 4 vias", "K74-M": "K74 vias Mini", KIT: "Kits",
    "MOD.SERP": "Módulo Serpentina", "MOD.VENT": "Módulo Ventilador",
    PISO: "Piso", PT: "Piso Teto", REC: "Receptor", REF: "Refinete",
    "REF-EXT": "Refinete Externo", SPT: "Splitão", TETO: "Teto",
  };
  const NOMES_CICLO = { F: "Frio", QF: "Quente/Frio" };
  function nomeGrupo(c) { return NOMES_GRUPO[c] || c || ""; }
  function nomeSubgrupo(c) { return NOMES_SUBGRUPO[c] || c || ""; }
  function nomeCiclo(c) { return NOMES_CICLO[c] || c || ""; }
  function primeiraMaiuscula(s) {
    s = String(s || "");
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  // Campo interno ainda se chama "coleta", mas o valor e' a data de
  // FATURAMENTO (emissao da NF) - a coleta fisica acontece uns 1-2 dias
  // depois, por isso a tela mostra "Faturamento" (pedido do usuario,
  // 01/10/2026). Vem em dd/mm/aa.
  function parseColetaBR(str) {
    const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(str || "");
    if (!m) return null;
    return new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }

  // Ha quanto tempo uma NF faturada esta esperando agenda - mesma ideia do
  // painel de prazos (build/painel_prazos.py), so que aqui e' "dias desde a
  // coleta" com limiares fixos, nao a media historica por transportadora
  // (nao ha "prazo esperado" pra ganhar agenda, so' o quanto mais cedo melhor).
  const LIMIARES_ESPERA = { alerta: 8, critica: 16 };
  function situacaoEspera(coleta) {
    const data = parseColetaBR(coleta);
    if (!data) return { dias: null, classe: "" };
    const dias = Math.floor((new Date().setHours(0, 0, 0, 0) - data) / 86400000);
    if (dias >= LIMIARES_ESPERA.critica) return { dias, classe: "situacao-critica" };
    if (dias >= LIMIARES_ESPERA.alerta) return { dias, classe: "situacao-alerta" };
    return { dias, classe: "" };
  }

  // ------------------------------------------------------------ calendario --
  // Adaptado de build/app/ui.js (abreCalendario), fixo na pagina em vez de
  // modal. Fonte: calendario.csv (gerado por gerar_site.py direto da
  // planilha - o VEICULOS e FABRICANTES de cada dia ja vem prontos de la,
  // nao precisa re-somar nada aqui).

  const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const LIMITE_VEICULOS_DIA = 5;

  // "25/09/26" -> "2026-09-25". calendario.csv sempre traz ano de 2 digitos.
  function isoDeDataBR(str) {
    const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(str || "");
    if (!m) return null;
    return "20" + m[3] + "-" + m[2] + "-" + m[1];
  }

  function porDiaDeCalendario(linhasCalendario) {
    const porDia = {};
    (linhasCalendario || []).forEach(function (l) {
      const iso = isoDeDataBR(l[0]);
      if (!iso) return;
      // STATUS so' vem "BLOQUEADO" quando e' um dia marcado de verdade (feriado/
      // inventario, vindo do dados.json) - a planilha real usa a coluna OBS pra
      // outra coisa (texto tipo "4 CARRETAS"), entao NAO da' pra usar "tem texto
      // em OBS?" como sinal de bloqueio (bug corrigido em 30/09/2026: isso
      // marcava quase todo dia com entrega como bloqueado/vermelho por engano).
      // Coluna 6 (TUDO_ENTREGUE) so' existe no calendario.csv gerado a partir
      // de dados.json (painel-teste/beta) - a planilha real ainda nao tem
      // esse conceito por dia, entao fica undefined/"" la' e nunca marca.
      porDia[iso] = { veiculos: Number(l[2]) || 0, fabricantesTxt: l[3] || "",
                       motivoBloqueio: l[4] === "BLOQUEADO" ? (l[5] || "") : "",
                       tudoEntregue: l[6] === "SIM" };
    });
    return porDia;
  }

  function iniciaCalendario(linhasCalendario, aoClicarDia) {
    const porDia = porDiaDeCalendario(linhasCalendario);
    let mesExibido = new Date();
    mesExibido.setDate(1);

    const grade = document.getElementById("calGrade");
    const rotulo = document.getElementById("calRotuloMes");

    function render() {
      const ano = mesExibido.getFullYear();
      const mes = mesExibido.getMonth();
      rotulo.textContent = NOMES_MES[mes] + " de " + ano;

      const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
      const hoje = hojeIso();

      let html = DIAS_SEMANA.map(function (d) { return '<div class="cabecalho">' + d + "</div>"; }).join("");
      for (let i = 0; i < primeiroDiaSemana; i++) html += '<div class="dia vazio"></div>';

      for (let dia = 1; dia <= diasNoMes; dia++) {
        const iso = ano + "-" + String(mes + 1).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
        const info = porDia[iso];
        const tags = info ? info.fabricantesTxt.split(/\s+/).filter(Boolean).map(function (f) {
          return '<span class="tag-fab">' + f + "</span>";
        }).join("") : "";
        const total = info ? info.veiculos : 0;
        const motivo = info ? info.motivoBloqueio : "";
        const entregue = info ? info.tudoEntregue : false;
        const classes = "dia" + (iso === hoje ? " hoje" : "") + (total >= LIMITE_VEICULOS_DIA ? " cheio" : "") +
          (motivo ? " bloqueado" : "");
        html += '<div class="' + classes + '" data-iso="' + iso + '"><div class="numero">' + dia +
          (entregue ? ' <span class="check-entregue" title="Tudo entregue">✓</span>' : "") + "</div>" + tags +
          (motivo ? '<span class="tag-bloqueio">' + motivo + "</span>" : "") +
          (total ? '<span class="total-dia">' + total + " veíc.</span>" : "") + "</div>";
      }
      grade.innerHTML = html;
    }

    grade.addEventListener("click", function (e) {
      const cel = e.target.closest(".dia[data-iso]");
      if (cel && aoClicarDia) aoClicarDia(cel.dataset.iso);
    });
    document.getElementById("calAnterior").addEventListener("click", function () {
      mesExibido.setMonth(mesExibido.getMonth() - 1);
      render();
    });
    document.getElementById("calSeguinte").addEventListener("click", function () {
      mesExibido.setMonth(mesExibido.getMonth() + 1);
      render();
    });
    document.getElementById("calHoje").addEventListener("click", function () {
      mesExibido = new Date();
      mesExibido.setDate(1);
      render();
    });
    render();
  }

  // -------------------------------------------------------------- produtos --
  // Um mesmo mecanismo de filtro pras duas abas (com agenda / sem agenda),
  // parametrizado pelo prefixo dos ids e pelas colunas de cada tabela.

  function paraCsv(cabecalho, linhas) {
    const escapa = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    return [cabecalho, ...linhas].map(l => l.map(escapa).join(";")).join("\r\n");
  }

  function baixaCsv(nomeArquivo, cabecalho, linhas) {
    const csv = "﻿" + paraCsv(cabecalho, linhas);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  function distintos(itens, campo, numerico) {
    const vs = [...new Set(itens.map(i => i[campo]).filter(Boolean))];
    return numerico ? vs.sort((a, b) => Number(a) - Number(b)) : vs.sort();
  }

  function opcoes(select, valores, rotulo) {
    const atual = select.value;
    const texto = rotulo || (v => v);
    select.innerHTML = '<option value="">Todos</option>' +
      valores.map(v => '<option value="' + v + '">' + texto(v) + "</option>").join("");
    if (valores.indexOf(atual) >= 0) select.value = atual;
  }

  // CONFIRMADO e REAGENDADO sao as duas faces da mesma pergunta pro usuario
  // ("ja chegou ou nao?") - REAGENDADO so' existe como registro historico
  // (o antigo, quando uma NF e remarcada), nunca como estado final. Por isso
  // o filtro junta os dois num "Nao entregue" em vez de listar os status
  // crus (pedido do usuario, 01/10/2026 - mesma simplificacao feita na tela
  // de Lancamento).
  function opcoesStatus(select) {
    const atual = select.value;
    select.innerHTML = '<option value="">Todos</option>' +
      '<option value="NAO_ENTREGUE">Não entregue</option>' +
      '<option value="ENTREGUE">Entregue</option>';
    if (["", "NAO_ENTREGUE", "ENTREGUE"].indexOf(atual) >= 0) select.value = atual;
  }

  function iniciaFiltroProdutos(cfg) {
    // cfg: { itens, selFabricante, selGrupo, selSubgrupo, selBtus, selStatus(opcional),
    //        selData(opcional, input type=date), campoBusca, tbody, contagem, btnLimpar,
    //        btnExportar, linhaHtml, camposBusca(fn), csv: {nomeBase, cabecalho, linha(fn)},
    //        filtroInicial(fn, opcional), ths(NodeList, opcional) + colunas(array, opcional) -
    //        colunas[i] = { valor(it), numero(bool) }, na mesma ordem dos <th> }
    let ordenar = null; // { indice, dir: 1|-1 } - null = ordem natural (a do array `itens`)

    function aplicaOrdenacao(lista) {
      if (!ordenar || !cfg.colunas) return lista;
      const col = cfg.colunas[ordenar.indice];
      if (!col) return lista;
      return lista.slice().sort((a, b) => {
        const va = col.valor(a), vb = col.valor(b);
        const cmp = col.numero ? (va - vb) : String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
        return ordenar.dir * cmp;
      });
    }

    function passaFiltros(it) {
      if (cfg.selFabricante.value && it.fabricante !== cfg.selFabricante.value) return false;
      if (cfg.selGrupo.value && it.grupo !== cfg.selGrupo.value) return false;
      if (cfg.selSubgrupo.value && it.subgrupo !== cfg.selSubgrupo.value) return false;
      if (cfg.selBtus.value && it.btus !== cfg.selBtus.value) return false;
      if (cfg.selCiclo && cfg.selCiclo.value && it.ciclo !== cfg.selCiclo.value) return false;
      if (cfg.selStatus && cfg.selStatus.value) {
        if (cfg.selStatus.value === "NAO_ENTREGUE") {
          if (it.status === "ENTREGUE") return false;
        } else if (it.status !== cfg.selStatus.value) return false;
      }
      if (cfg.selData && cfg.selData.value && String(it.data || "").slice(0, 10) !== cfg.selData.value) return false;
      const busca = cfg.campoBusca.value.trim().toLowerCase();
      if (busca && !cfg.camposBusca(it).toLowerCase().includes(busca)) return false;
      return true;
    }

    function filtrados() { return cfg.itens.filter(passaFiltros); }

    function render() {
      const lista = aplicaOrdenacao(filtrados());
      cfg.tbody.innerHTML = lista.map(cfg.linhaHtml).join("");
      cfg.contagem.textContent = lista.length + " item(ns)";
    }

    function preencheFiltros() {
      opcoes(cfg.selFabricante, distintos(cfg.itens, "fabricante"), primeiraMaiuscula);
      opcoes(cfg.selGrupo, distintos(cfg.itens, "grupo"), nomeGrupo);
      opcoes(cfg.selSubgrupo, distintos(cfg.itens, "subgrupo"), nomeSubgrupo);
      opcoes(cfg.selBtus, distintos(cfg.itens, "btus", true));
      if (cfg.selCiclo) opcoes(cfg.selCiclo, distintos(cfg.itens, "ciclo"), nomeCiclo);
      if (cfg.selStatus) opcoesStatus(cfg.selStatus);
    }

    const controles = [cfg.selFabricante, cfg.selGrupo, cfg.selSubgrupo, cfg.selBtus];
    if (cfg.selCiclo) controles.push(cfg.selCiclo);
    if (cfg.selStatus) controles.push(cfg.selStatus);
    if (cfg.selData) controles.push(cfg.selData);
    controles.forEach(s => s.addEventListener("change", render));
    cfg.campoBusca.addEventListener("input", render);

    cfg.btnLimpar.addEventListener("click", () => {
      controles.forEach(s => { s.value = ""; });
      cfg.campoBusca.value = "";
      render();
    });

    cfg.btnExportar.addEventListener("click", () => {
      const lista = filtrados();
      if (!lista.length) { alert("Nada pra exportar com esses filtros."); return; }
      const hoje = new Date();
      const nome = cfg.csv.nomeBase + "_" + hoje.getFullYear() +
        String(hoje.getMonth() + 1).padStart(2, "0") + String(hoje.getDate()).padStart(2, "0") + ".csv";
      baixaCsv(nome, cfg.csv.cabecalho, lista.map(cfg.csv.linha));
    });

    if (cfg.ths && cfg.colunas) {
      cfg.ths.forEach((th, i) => {
        if (!cfg.colunas[i]) return;
        th.classList.add("ordenavel");
        th.addEventListener("click", () => {
          ordenar = (ordenar && ordenar.indice === i) ? { indice: i, dir: -ordenar.dir } : { indice: i, dir: 1 };
          cfg.ths.forEach(t => t.removeAttribute("data-ordem"));
          th.setAttribute("data-ordem", ordenar.dir === 1 ? "asc" : "desc");
          render();
        });
      });
    }

    preencheFiltros();
    if (cfg.filtroInicial) cfg.filtroInicial();
    render();

    return {
      // Usado pelo clique num dia do calendario: abre esta aba ja filtrada por data.
      filtrarPorData: cfg.selData ? function (iso) {
        controles.forEach(s => { if (s !== cfg.selData) s.value = ""; });
        cfg.campoBusca.value = "";
        cfg.selData.value = iso;
        render();
      } : null,
    };
  }

  function unificadoHtml(it) {
    if (!it.unificado_codigo) return "—";
    const codigos = it.unificado_codigo.split(",").map(c => c.trim()).filter(Boolean);
    const desc = it.unificado_descricao || "";
    const descAttr = desc.replace(/"/g, "&quot;");
    if (codigos.length <= 2) {
      return '<span title="' + descAttr + '">' + codigos.join(", ") + " — " + desc + "</span>";
    }
    // Mais de 2 conjuntos (chega a 30+): mostra so' os 2 primeiros + um
    // <details> pra ver o resto - a descricao ja' vem com "(+N)" do servidor
    // (enriquece_com_unificado em build/app/servidor.py), entao nao repete a contagem aqui.
    return '<details class="unificado-mais">' +
      '<summary title="' + descAttr + '">' + codigos.slice(0, 2).join(", ") + "... — " + desc + "</summary>" +
      '<div class="unificado-resto">' + codigos.join(", ") + "</div>" +
      "</details>";
  }

  function iniciaAgenda(itensTodos) {
    // Data mais proxima primeiro (mesma ordem padronizada da tela Agendados
    // do Lancamento) - e' o que mais interessa no dia a dia: o que vai
    // entregar primeiro. Quem nao tem data (raro) vai pro final.
    const itens = itensTodos.filter(i => i.agendado).slice().sort((a, b) => {
      const da = a.data || "9999-12-31", db = b.data || "9999-12-31";
      return da < db ? -1 : da > db ? 1 : 0;
    });
    return iniciaFiltroProdutos({
      itens,
      selFabricante: document.getElementById("agFabricante"),
      selGrupo: document.getElementById("agGrupo"),
      selSubgrupo: document.getElementById("agSubgrupo"),
      selBtus: document.getElementById("agBtus"),
      selCiclo: document.getElementById("agCiclo"),
      selStatus: document.getElementById("agStatus"),
      selData: document.getElementById("agData"),
      campoBusca: document.getElementById("agBusca"),
      tbody: document.querySelector("#tabelaAgenda tbody"),
      ths: document.querySelectorAll("#tabelaAgenda thead th"),
      colunas: [
        { valor: it => it.status || "" },
        { valor: it => it.data || "" },
        { valor: it => it.fabricante || "" },
        { valor: it => (it.nfs || []).join(", ") },
        { valor: it => it.codigo_interno || it.codigo_fabricante || "" },
        { valor: it => it.descricao || "" },
        { valor: it => nomeGrupo(it.grupo) },
        { valor: it => nomeSubgrupo(it.subgrupo) },
        { valor: it => Number(it.btus) || 0, numero: true },
        { valor: it => nomeCiclo(it.ciclo) },
        { valor: it => Number(it.qtd) || 0, numero: true },
        { valor: it => it.transportadora || "" },
        { valor: it => it.unificado_codigo || "" },
      ],
      contagem: document.getElementById("agContagem"),
      btnLimpar: document.getElementById("agLimpar"),
      btnExportar: document.getElementById("agExportar"),
      camposBusca: it => ((it.nfs || []).join(" ") + " " + (it.codigo_interno || "") + " " + (it.codigo_fabricante || "") +
        " " + (it.descricao || "") + " " + (it.unificado_codigo || "") + " " + (it.unificado_descricao || "")),
      linhaHtml: it => {
        const codigo = it.codigo_interno || (it.codigo_fabricante ? "(" + it.codigo_fabricante + ")" : "—");
        return "<tr>" +
          "<td>" + pontoStatus(it.status) + "</td>" +
          "<td>" + formataBR(it.data) + "</td>" +
          "<td>" + (it.fabricante || "—") + "</td>" +
          "<td>" + ((it.nfs || []).join(", ") || "—") + "</td>" +
          "<td>" + codigo + "</td>" +
          "<td>" + (it.descricao || "—") + "</td>" +
          "<td>" + (it.grupo ? nomeGrupo(it.grupo) : "—") + "</td>" +
          "<td>" + (it.subgrupo ? nomeSubgrupo(it.subgrupo) : "—") + "</td>" +
          "<td>" + (it.btus || "—") + "</td>" +
          "<td>" + (it.ciclo ? nomeCiclo(it.ciclo) : "—") + "</td>" +
          "<td>" + (it.qtd != null ? it.qtd : "—") + "</td>" +
          "<td>" + (it.transportadora || "—") + "</td>" +
          "<td>" + unificadoHtml(it) + "</td>" +
          "</tr>";
      },
      csv: {
        nomeBase: "produtos_com_agenda",
        cabecalho: ["STATUS", "DATA", "FABRICANTE", "NFS", "CÓDIGO", "DESCRIÇÃO", "GRUPO", "SUBGRUPO", "BTUS", "CICLO", "QTD", "TRANSPORTADORA", "UNIFICADO"],
        linha: it => [it.status, formataBR(it.data), it.fabricante, (it.nfs || []).join(" "),
          it.codigo_interno || it.codigo_fabricante, it.descricao, nomeGrupo(it.grupo), nomeSubgrupo(it.subgrupo),
          it.btus, nomeCiclo(it.ciclo), it.qtd, it.transportadora, it.unificado_codigo],
      },
      // Ao abrir a aba, mostra so os nao entregues - e o que interessa no
      // dia a dia; ENTREGUE fica a 1 clique.
      filtroInicial: () => { document.getElementById("agStatus").value = "NAO_ENTREGUE"; },
    });
  }

  function iniciaSemAgenda(itensTodos) {
    // Ultimo faturado primeiro (pedido do usuario, 01/10/2026). Sem coleta
    // legivel vai pro final. O destaque de espera (situacaoEspera, amarelo/
    // vermelho) continua valendo pros itens antigos mesmo fora do topo -
    // so' a ordem padrao da lista mudou, nao o calculo de quem esta atrasado.
    const itens = itensTodos.filter(i => !i.agendado).slice().sort((a, b) => {
      const da = parseColetaBR(a.coleta), db = parseColetaBR(b.coleta);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
    iniciaFiltroProdutos({
      itens,
      selFabricante: document.getElementById("saFabricante"),
      selGrupo: document.getElementById("saGrupo"),
      selSubgrupo: document.getElementById("saSubgrupo"),
      selBtus: document.getElementById("saBtus"),
      selCiclo: document.getElementById("saCiclo"),
      campoBusca: document.getElementById("saBusca"),
      tbody: document.querySelector("#tabelaSemAgenda tbody"),
      ths: document.querySelectorAll("#tabelaSemAgenda thead th"),
      colunas: [
        { valor: it => it.fabricante || "" },
        { valor: it => (it.nfs || []).join(", ") },
        { valor: it => it.codigo_interno || it.codigo_fabricante || "" },
        { valor: it => it.descricao || "" },
        { valor: it => nomeGrupo(it.grupo) },
        { valor: it => nomeSubgrupo(it.subgrupo) },
        { valor: it => Number(it.btus) || 0, numero: true },
        { valor: it => nomeCiclo(it.ciclo) },
        { valor: it => Number(it.qtd) || 0, numero: true },
        { valor: it => { const d = parseColetaBR(it.coleta); return d ? d.getTime() : Infinity; }, numero: true },
        { valor: it => it.transportadora || "" },
        { valor: it => it.unificado_codigo || "" },
      ],
      contagem: document.getElementById("saContagem"),
      btnLimpar: document.getElementById("saLimpar"),
      btnExportar: document.getElementById("saExportar"),
      camposBusca: it => ((it.nfs || []).join(" ") + " " + (it.codigo_interno || "") + " " + (it.codigo_fabricante || "") + " " +
        (it.descricao || "") + " " + (it.unificado_codigo || "") + " " + (it.unificado_descricao || "")),
      linhaHtml: it => {
        const codigo = it.codigo_interno || (it.codigo_fabricante ? "(" + it.codigo_fabricante + ")" : "—");
        const espera = situacaoEspera(it.coleta);
        const coletaTxt = it.coleta ? it.coleta + (espera.dias != null ? " (" + espera.dias + "d)" : "") : "—";
        return "<tr class=\"" + espera.classe + "\">" +
          "<td>" + (it.fabricante || "—") + "</td>" +
          "<td>" + ((it.nfs || []).join(", ") || "—") + "</td>" +
          "<td>" + codigo + "</td>" +
          "<td>" + (it.descricao || "—") + "</td>" +
          "<td>" + (it.grupo ? nomeGrupo(it.grupo) : "—") + "</td>" +
          "<td>" + (it.subgrupo ? nomeSubgrupo(it.subgrupo) : "—") + "</td>" +
          "<td>" + (it.btus || "—") + "</td>" +
          "<td>" + (it.ciclo ? nomeCiclo(it.ciclo) : "—") + "</td>" +
          "<td>" + (it.qtd != null ? it.qtd : "—") + "</td>" +
          "<td>" + coletaTxt + "</td>" +
          "<td>" + (it.transportadora || "—") + "</td>" +
          "<td>" + unificadoHtml(it) + "</td>" +
          "</tr>";
      },
      csv: {
        nomeBase: "faturados_sem_agenda",
        cabecalho: ["FABRICANTE", "NFS", "CÓDIGO", "DESCRIÇÃO", "GRUPO", "SUBGRUPO", "BTUS", "CICLO", "QTD", "FATURAMENTO", "TRANSPORTADORA", "UNIFICADO"],
        linha: it => [it.fabricante, (it.nfs || []).join(" "), it.codigo_interno || it.codigo_fabricante,
          it.descricao, nomeGrupo(it.grupo), nomeSubgrupo(it.subgrupo), it.btus, nomeCiclo(it.ciclo), it.qtd,
          it.coleta, it.transportadora, it.unificado_codigo],
      },
    });
  }

  // ------------------------------------------------------------- resumo --

  function cartaoResumo(num, rotulo, aba, alerta) {
    return '<a href="#" class="resumo-item' + (alerta ? " resumo-alerta" : "") + '" data-aba="' + aba + '">' +
      '<span class="resumo-num">' + num + "</span>" +
      '<span class="resumo-rotulo">' + rotulo + "</span>" +
      "</a>";
  }

  // NFs distintas entre os itens filtrados - uma NF com varios produtos conta
  // 1 vez so' (antes contava 1 vez por produto, numero inflado sem sentido
  // pra quem le "quantas notas estao confirmadas/aguardando").
  function contaNfs(itensFiltrados) {
    const nfs = new Set();
    itensFiltrados.forEach(it => (it.nfs || []).forEach(nf => { if (nf) nfs.add(nf); }));
    return nfs.size;
  }

  function iniciaResumo(linhasCalendario, produtos) {
    const itens = produtos.itens || [];
    const confirmados = contaNfs(itens.filter(it => it.agendado && it.status === "CONFIRMADO"));
    const itensSemAgenda = itens.filter(it => !it.agendado);
    const semAgenda = contaNfs(itensSemAgenda);
    const semAgendaCritica = contaNfs(itensSemAgenda.filter(it => situacaoEspera(it.coleta).classe === "situacao-critica"));
    const hojeInfo = porDiaDeCalendario(linhasCalendario)[hojeIso()];
    const veiculosHoje = hojeInfo ? hojeInfo.veiculos : 0;

    const resumo = document.getElementById("resumoTopo");
    resumo.innerHTML =
      cartaoResumo(confirmados, "confirmado(s)", "agenda") +
      cartaoResumo(semAgenda, "aguardando agenda", "sem-agenda", semAgenda > 0) +
      cartaoResumo(semAgendaCritica, "esperando 16+ dias", "sem-agenda", semAgendaCritica > 0) +
      cartaoResumo(veiculosHoje, "veículo(s) hoje", "calendario");

    resumo.querySelectorAll(".resumo-item").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        mostraAba(el.dataset.aba);
      });
    });
  }

  // ----------------------------------------------------------------- boot --

  Promise.all([
    carregarCSV("calendario.csv"),
    fetch("produtos.json?v=" + Date.now(), { cache: "no-store" }).then(r => r.json()),
  ]).then(([calendario, produtos]) => {
    const controladorAgenda = iniciaAgenda(produtos.itens || []);
    iniciaSemAgenda(produtos.itens || []);
    iniciaCalendario(calendario.linhas, function (iso) {
      mostraAba("agenda");
      if (controladorAgenda.filtrarPorData) controladorAgenda.filtrarPorData(iso);
    });
    iniciaResumo(calendario.linhas, produtos);
    document.getElementById("ultimaAtualizacao").textContent = produtos.gerado_em || "(não disponível)";
  }).catch(erro => {
    console.error(erro);
    document.getElementById("ultimaAtualizacao").textContent = "falha ao carregar";
  });

  // ----------------------------------------------------- últimas edições --
  // Bandeira na aba Calendário: as últimas 20 edições (ENTREGUE, agendado,
  // faturado sem agenda, reagendado, cancelado) vindas de ultimas_edicoes.json,
  // gerado pela tela de Lançamento junto com o resto (servidor.py). O número
  // na bandeira conta o que entrou desde a última vez que ESTE navegador
  // abriu a lista (localStorage - só conveniência, sem ele mostra tudo como novo).
  const TITULOS_EDICAO = {
    ENTREGUE: "Entregue", AGENDADO: "Novo agendamento", SEM_AGENDA: "Faturado sem agenda",
    REAGENDADO: "Reagendado", CANCELADO: "Cancelado", REVERTIDO: "Agenda desfeita",
  };
  const btnEdicoes = document.getElementById("btnEdicoes");
  const dialogoEdicoes = document.getElementById("dialogoEdicoes");
  const contadorEdicoes = document.getElementById("edicoesNovas");
  let edicoes = [];

  function lerVisto() {
    try { return localStorage.getItem("edicoesVistasAte") || ""; } catch (e) { return ""; }
  }
  function marcarVisto(em) {
    try { localStorage.setItem("edicoesVistasAte", em); } catch (e) { /* sem storage, segue */ }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function quandoBR(em) {
    // "2026-10-08T14:32:05" -> "08/10 14:32"
    return em ? em.slice(8, 10) + "/" + em.slice(5, 7) + " " + em.slice(11, 16) : "";
  }

  function renderEdicoes() {
    const visto = lerVisto();
    const lista = document.getElementById("listaEdicoes");
    if (!edicoes.length) {
      lista.innerHTML = '<li class="edicoes-vazio">Nenhuma edição registrada ainda.</li>';
      return;
    }
    lista.innerHTML = edicoes.map(function (ev) {
      const nfs = (ev.nfs || []).join(", ") || "sem NF ainda";
      let data = "";
      if (ev.tipo === "REAGENDADO") data = formataBR(ev.data_anterior) + " → " + formataBR(ev.data);
      else if (ev.tipo === "SEM_AGENDA" && ev.data) data = "faturada " + formataBR(ev.data);
      else if (ev.data) data = formataBR(ev.data);
      const extras = [data, ev.veiculos ? ev.veiculos + " veíc." : "", ev.transportadora || ""]
        .filter(Boolean).map(esc).join(" · ");
      return '<li class="edicao' + (ev.em > visto ? " nova" : "") + '">' +
        '<span class="edicao-tipo tipo-' + esc(ev.tipo) + '">' + esc(TITULOS_EDICAO[ev.tipo] || ev.tipo) + "</span>" +
        '<span class="edicao-quando">' + esc(quandoBR(ev.em)) + "</span>" +
        '<span class="edicao-desc"><strong>' + esc(ev.fabricante) + "</strong> NF " + esc(nfs) +
        (extras ? '<span class="edicao-extra">' + extras + "</span>" : "") + "</span></li>";
    }).join("");
  }

  function atualizaContador() {
    const visto = lerVisto();
    const novas = edicoes.filter(function (ev) { return ev.em > visto; }).length;
    contadorEdicoes.hidden = !novas;
    contadorEdicoes.textContent = novas;
    btnEdicoes.classList.toggle("tem-novas", !!novas);
  }

  fetch("ultimas_edicoes.json?v=" + Date.now(), { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : { eventos: [] }; })
    .then(function (j) { edicoes = j.eventos || []; atualizaContador(); })
    .catch(function () { /* arquivo ainda não publicado: bandeira sem número */ });

  btnEdicoes.addEventListener("click", function () {
    renderEdicoes();
    dialogoEdicoes.showModal();
    if (edicoes.length) marcarVisto(edicoes[0].em);
    atualizaContador();
  });
  document.getElementById("fecharEdicoes").addEventListener("click", function () { dialogoEdicoes.close(); });
  dialogoEdicoes.addEventListener("click", function (ev) {
    if (ev.target === dialogoEdicoes) dialogoEdicoes.close();
  });

  // ------------------------------------------------- relatório depósito --
  // relatorio-deposito.bin é o Excel da tela Pendentes CRIPTOGRAFADO
  // (AES-256-GCM, chave PBKDF2-SHA256 da senha) - o site é estático, então
  // quem confere a senha é a própria decifragem: senha errada = falha.
  // Formato e números iguais a build/pendentes.py (criptografa).
  const linkDeposito = document.getElementById("linkRelatorioDeposito");
  const dialogoDeposito = document.getElementById("dialogoRelatorioDeposito");
  const formDeposito = document.getElementById("formRelatorioDeposito");
  const senhaDeposito = document.getElementById("senhaRelatorioDeposito");
  const statusDeposito = document.getElementById("statusRelatorioDeposito");

  function avisoDeposito(texto, erro) {
    statusDeposito.textContent = texto;
    statusDeposito.classList.toggle("erro", !!erro);
  }

  linkDeposito.addEventListener("click", function (ev) {
    ev.preventDefault();
    senhaDeposito.value = "";
    avisoDeposito("");
    dialogoDeposito.showModal();
    senhaDeposito.focus();
  });
  document.getElementById("cancelarRelatorioDeposito").addEventListener("click", function () {
    dialogoDeposito.close();
  });
  // clique no fundo escuro (fora da caixa) fecha também
  dialogoDeposito.addEventListener("click", function (ev) {
    if (ev.target === dialogoDeposito) dialogoDeposito.close();
  });

  async function decifraRelatorio(bytes, senha) {
    const magico = new TextDecoder().decode(bytes.slice(0, 4));
    if (magico !== "DEP1") throw new Error("arquivo inválido");
    const sal = bytes.slice(4, 20), iv = bytes.slice(20, 32), cifrado = bytes.slice(32);
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
    const chave = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: sal, iterations: 600000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, chave, cifrado);
  }

  formDeposito.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const botao = formDeposito.querySelector("button");
    botao.disabled = true;
    avisoDeposito("Abrindo…");
    try {
      const resp = await fetch("relatorio-deposito.bin?v=" + Date.now(), { cache: "no-store" });
      if (!resp.ok) throw new Error("relatório ainda não publicado");
      const bytes = new Uint8Array(await resp.arrayBuffer());
      let xlsx;
      try {
        xlsx = await decifraRelatorio(bytes, senhaDeposito.value.trim());
      } catch (e) {
        avisoDeposito("Senha incorreta.", true);
        senhaDeposito.select();
        return;
      }
      const url = URL.createObjectURL(new Blob([xlsx], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-deposito-" + new Date().toISOString().slice(0, 10) + ".xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      dialogoDeposito.close();
    } catch (e) {
      avisoDeposito("Erro: " + e.message, true);
    } finally {
      botao.disabled = false;
    }
  });
})();
