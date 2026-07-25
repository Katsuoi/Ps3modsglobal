document.addEventListener("DOMContentLoaded", function() {

    function renderMods(listaMods, container) {
        if (!container) return;
        container.innerHTML = "";
        if (listaMods.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;padding:40px;">Nenhum mod encontrado nesta categoria.</p>';
            return;
        }
        listaMods.forEach(function(mod) {
            var card = document.createElement("div");
            card.className = "card-mod";
            card.innerHTML = 
                '<img src="' + mod.imagem + '" alt="' + mod.nome + '">' +
                '<h3>' + mod.nome + '</h3>' +
                '<p>' + mod.descricao + '</p>' +
                '<a class="download" href="mod.html?id=' + mod.id + '">Ver Mod</a>';
            container.appendChild(card);
        });
    }

    // Lista de mods
    var lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista) {
        var params = new URLSearchParams(window.location.search);
        var categoria = params.get("categoria");
        
        if (categoria) {
            var filtrados = mods.filter(function(m) {
                return m.categoria.toLowerCase().includes(categoria.toLowerCase()) ||
                       (categoria.toLowerCase() === "followers" && m.categoria.toLowerCase().includes("companion"));
            });
            renderMods(filtrados, lista);
            
            var titulo = document.querySelector(".hero-content h2, .banner-pequeno h2");
            if (titulo) titulo.textContent = categoria;
        } else {
            renderMods(mods, lista);
        }
    }

    // Página do mod
    var params2 = new URLSearchParams(window.location.search);
    var id = parseInt(params2.get("id"));
    if (id && document.getElementById("titulo-mod")) {
        var mod = mods.find(function(m) { return m.id === id; });
        if (mod) {
            document.getElementById("nome").textContent = mod.nome;
            document.getElementById("titulo-mod").textContent = mod.nome;
            document.getElementById("descricao").textContent = mod.descricao;
            document.getElementById("categoria-mod").textContent = mod.categoria;

            var capa = document.getElementById("capa");
            if (capa) {
                capa.src = mod.imagem;
                capa.alt = mod.nome;
            }

            var download = document.getElementById("download");
            if (download) download.href = mod.download;

            var galeria = document.getElementById("galeria");
            if (galeria && mod.galeria) {
                galeria.innerHTML = "";
                mod.galeria.forEach(function(src) {
                    var img = document.createElement("img");
                    img.src = src;
                    img.alt = mod.nome;
                    galeria.appendChild(img);
                });
            }
        }
    }

    // Pesquisa
    var searchInput = document.querySelector(".search input, #pesquisa");
    if (searchInput) {
        searchInput.addEventListener("input", function() {
            var termo = this.value.toLowerCase().trim();
            var cards = document.querySelectorAll(".card-mod, .card-home");
            cards.forEach(function(card) {
                var texto = card.textContent.toLowerCase();
                card.style.display = (termo === "" || texto.includes(termo)) ? "" : "none";
            });
        });
    }
});
