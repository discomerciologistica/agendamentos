// Utilitários de CSV compartilhados pelas páginas do site.
//
// Resolve três problemas que existiam quando cada página fazia split(","):
//  - descrição de produto com vírgula deslocava todas as colunas;
//  - arquivo salvo pelo Excel em latin-1 aparecia com acento quebrado;
//  - "0" que o VLOOKUP devolve quando a célula de origem está vazia ia pra tela.

// Quebra uma linha de CSV respeitando aspas duplas ("" = aspas literal).
function parseLinhaCSV(linha) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];

    if (dentroDeAspas) {
      if (ch === '"') {
        if (linha[i + 1] === '"') { atual += '"'; i++; }
        else { dentroDeAspas = false; }
      } else {
        atual += ch;
      }
    } else if (ch === '"') {
      dentroDeAspas = true;
    } else if (ch === ",") {
      campos.push(atual.trim());
      atual = "";
    } else {
      atual += ch;
    }
  }
  campos.push(atual.trim());
  return campos;
}

// Célula vazia na planilha vira 0 no VLOOKUP. Na tela isso não é informação.
function limparCelula(valor) {
  const v = (valor || "").trim();
  return (v === "0" || v === "00/01/00") ? "" : v;
}

// O Excel salva ora em UTF-8, ora em ANSI (latin-1/windows-1252).
// Tenta UTF-8 estrito; se o arquivo não for UTF-8 válido, relê como windows-1252.
function decodificar(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (e) {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

// Busca o CSV, devolve { cabecalho, linhas, atualizadoEm }.
// O parâmetro ?v= evita que o navegador sirva uma versão antiga do cache.
async function carregarCSV(caminho) {
  const resposta = await fetch(caminho + "?v=" + Date.now(), { cache: "no-store" });
  if (!resposta.ok) throw new Error("Não foi possível carregar " + caminho);

  const cabecalhoData = resposta.headers.get("Last-Modified");
  const texto = decodificar(await resposta.arrayBuffer());

  const linhas = texto.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim() !== "");

  // Linha de metadados opcional, gravada pelo gerador: # GERADO_EM=25/09/2026 10:04
  let atualizadoEm = null;
  if (linhas.length && linhas[0].startsWith("#")) {
    const meta = linhas.shift();
    const m = meta.match(/GERADO_EM\s*=\s*(.+)/i);
    if (m) atualizadoEm = m[1].trim();
  }
  if (!atualizadoEm && cabecalhoData) {
    const d = new Date(cabecalhoData);
    if (!isNaN(d)) {
      atualizadoEm = d.toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    }
  }

  const cabecalho = parseLinhaCSV(linhas.shift() || "");
  return {
    cabecalho,
    linhas: linhas.map(parseLinhaCSV).map(campos => campos.map(limparCelula)),
    atualizadoEm
  };
}

// Converte "dd/mm/aa" ou "dd/mm/aaaa" em Date. Devolve null se não der.
function parseData(texto) {
  const m = (texto || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let ano = parseInt(m[3], 10);
  if (ano < 100) ano += 2000;
  const d = new Date(ano, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  return isNaN(d) ? null : d;
}
