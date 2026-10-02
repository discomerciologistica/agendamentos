let dados = [];

// Carrega o CSV e obtém a data real de modificação
fetch("dados.csv")
  .then(response => {
    const dataArquivo = new Date(response.headers.get("Last-Modified"));
    if (!isNaN(dataArquivo)) {
      const opcoes = { 
        day: "2-digit", month: "2-digit", year: "numeric", 
        hour: "2-digit", minute: "2-digit" 
      };
      document.getElementById("ultimaAtualizacao").textContent =
        "Última atualização: " + dataArquivo.toLocaleString("pt-BR", opcoes);
    } else {
      document.getElementById("ultimaAtualizacao").textContent =
        "Última atualização: (não disponível)";
    }
    return response.text();
  })
  .then(text => {
    dados = text.split("\n").slice(1).map(linha => {
      const [fabricante, data, codigo, produto, qtd, obs] = linha.split(",");
      return { fabricante, data, codigo, produto, qtd, obs };
    });
  });

// Elementos
const tbody = document.querySelector("#results tbody");

// Função genérica de sugestões
function configurarPesquisa(campoInput, campoSugestoes, propriedade) {
  campoInput.addEventListener("input", () => {
    const termo = campoInput.value.toLowerCase();
    campoSugestoes.innerHTML = "";
    if (termo.length > 0) {
      const filtrados = dados.filter(d => d[propriedade]?.toLowerCase().includes(termo));
      const unicos = [...new Set(filtrados.map(d => d[propriedade]))]; // evitar repetições
      unicos.slice(0, 5).forEach(valor => {
        const li = document.createElement("li");
        li.textContent = valor;
        li.onclick = () => {
          campoInput.value = valor;
          campoSugestoes.innerHTML = "";
          mostrarResultados(valor, propriedade);
        };
        campoSugestoes.appendChild(li);
      });
    }
  });

  // Pressionar Enter também pesquisa
  campoInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      mostrarResultados(campoInput.value, propriedade);
      campoSugestoes.innerHTML = "";
    }
  });
}

// Mostrar resultados na tabela
function mostrarResultados(valor, campo) {
  tbody.innerHTML = "";
  const filtrados = dados.filter(d => d[campo]?.toLowerCase().includes(valor.toLowerCase()));
  filtrados.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.fabricante}</td>
      <td>${d.data}</td>
      <td>${d.codigo}</td>
      <td>${d.produto}</td>
      <td>${d.qtd}</td>
      <td>${d.obs}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Aplicar a função para cada campo
configurarPesquisa(
  document.getElementById("searchFabricante"),
  document.getElementById("suggestionsFabricante"),
  "fabricante"
);

configurarPesquisa(
  document.getElementById("searchCodigo"),
  document.getElementById("suggestionsCodigo"),
  "codigo"
);

configurarPesquisa(
  document.getElementById("searchProduto"),
  document.getElementById("suggestionsProduto"),
  "produto"
);
