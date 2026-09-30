// Tema claro/escuro + cor de destaque. Carregado no <head> para aplicar antes de pintar.
(function () {
  var raiz = document.documentElement;
  var CORES = [
    ["ambar", 75, "Âmbar"], ["coral", 30, "Coral"], ["verde", 150, "Verde"],
    ["turquesa", 190, "Turquesa"], ["azul", 245, "Azul"], ["violeta", 300, "Violeta"]
  ];
  raiz.dataset.tema = localStorage.getItem("tema") || "claro";
  raiz.dataset.cor = localStorage.getItem("cor") || "ambar";

  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.querySelector(".nav-telas");
    if (!nav) return;

    var grupo = document.createElement("div");
    grupo.className = "cores-tema";
    CORES.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.title = c[2];
      b.dataset.cor = c[0];
      b.style.background = "oklch(0.78 0.14 " + c[1] + ")";
      b.addEventListener("click", function () {
        raiz.dataset.cor = c[0];
        localStorage.setItem("cor", c[0]);
        marca();
      });
      grupo.appendChild(b);
    });
    function marca() {
      grupo.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("ativa", b.dataset.cor === raiz.dataset.cor);
      });
    }
    marca();

    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "alternar-tema";
    function rotulo() {
      botao.textContent = raiz.dataset.tema === "escuro" ? "☀ Claro" : "☾ Escuro";
    }
    botao.addEventListener("click", function () {
      raiz.dataset.tema = raiz.dataset.tema === "escuro" ? "claro" : "escuro";
      localStorage.setItem("tema", raiz.dataset.tema);
      rotulo();
    });
    rotulo();

    nav.appendChild(grupo);
    nav.appendChild(botao);
  });
})();
