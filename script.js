document.addEventListener("DOMContentLoaded", function() {

    // ===== FAVORITOS =====
    function getFavoritos() {
        try {
            return JSON.parse(localStorage.getItem("ps3mods_favoritos") || "[]");
        } catch(e) {
            return [];
        }
    }

    function salvarFavoritos(lista) {
        localStorage.setItem("ps3mods_favoritos", JSON.stringify(lista));
    }

    window.toggleFavorito = function(id) {
        var favs = getFavoritos();
        id = parseInt(id);
        var index = favs.indexOf(id);

        if (index === -1) {
            favs.push(id);
        } else {
            favs.splice(index, 1);
        }

        salvarFavoritos(favs);
        atualizarBotoesFavorito();
    };

    function atualizarBotoesFavorito() {
        var favs = getFavoritos();
        document.querySelectorAll("[data-fav]").forEach(function(btn) {
            var id = parseInt(btn.getAttribute("data-fav"));
            if (favs.indexOf(id) !== -1) {
                btn.textContent = "★ Favorito";
                btn.classList.add("favoritado");
            } else {
                btn.textContent = "☆ Favoritar";
                btn.classList.remove("favoritado");
            }
        });
    }

    // ===== RENDER MODS =====
    function renderMods(listaMods, container) {
        if (!container) return;
        container.innerHTML = "";

        if (listaMods.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8b95a5;padding:40px;">Nenhum mod encontrado.</p>';
            return;
        }

        listaMods.forEach(function(mod) {
            var card = document.createElement("div");
            card.className = "card-mod";
            card.innerHTML =
                '<img src="' + mod.imagem + '" alt="' + mod.nome + '">' +
                '<span class="categoria">' + mod.categoria + '</span>' +
                '<h3>' + mod.nome + '</h3>' +
                '<p>' + mod.descricao + '</p>' +
                '<a class="download" href="mod.html?id=' + mod.id + '">Ver Mod</a>' +
                '<button class="btn-fav" data-fav="' + mod.id + '" onclick="toggleFavorito(' + mod.id + ')">☆ Favoritar</button>';
            container.appendChild(card);
        });

        atualizarBotoesFavorito();
    }

    // ===== LISTA DE MODS =====
    var lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista && typeof mods !== "undefined") {
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

    // ===== PÁGINA DO MOD =====
    var params2 = new URLSearchParams(window.location.search);
    var id = parseInt(params2.get("id"));
    if (id && document.getElementById("titulo-mod") && typeof mods !== "undefined") {
        var mod = mods.find(function(m) { return m.id === id; });
        if (mod) {
            var elNome = document.getElementById("nome");
            var elTitulo = document.getElementById("titulo-mod");
            var elDesc = document.getElementById("descricao");
            var elCat = document.getElementById("categoria-mod");
            var elAutor = document.getElementById("autor-mod");
            var elVersao = document.getElementById("versao-mod");
            var elCompat = document.getElementById("compatibilidade-mod");
            var elCasamento = document.getElementById("casamento-mod");
            var elLocalizacao = document.getElementById("localizacao-mod");
            var elClasse = document.getElementById("classe-mod");

            if (elNome) elNome.textContent = mod.nome;
            if (elTitulo) elTitulo.textContent = mod.nome;
            if (elDesc) elDesc.textContent = mod.descricao;
            if (elCat) elCat.textContent = mod.categoria;
            if (elAutor) elAutor.textContent = mod.autor || "Desconhecido";
            if (elVersao) elVersao.textContent = mod.versao || "-";
            if (elCompat) elCompat.textContent = mod.compatibilidade || "Skyrim LE PS3";
            if (elCasamento) elCasamento.textContent = mod.casamento || "N/A";
            if (elLocalizacao) elLocalizacao.textContent = mod.localizacao || "N/A";
            if (elClasse) elClasse.textContent = mod.classe || "N/A";

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
                    img.style.cursor = "pointer";
                    img.onclick = function() { window.open(src, "_blank"); };
                    galeria.appendChild(img);
                });
            }

            var favBtn = document.getElementById("btn-favorito");
            if (favBtn) {
                favBtn.setAttribute("data-fav", mod.id);
                favBtn.onclick = function() { toggleFavorito(mod.id); };
            }
        }
        atualizarBotoesFavorito();
    }

    // ===== HOME DINÂMICA =====
    var statMods = document.getElementById("stat-mods");
    if (statMods && typeof mods !== "undefined") {
        statMods.textContent = mods.length;
    }

    var destaques = document.getElementById("destaques");
    if (destaques && typeof mods !== "undefined") {
        destaques.innerHTML = "";
        mods.slice(0, 6).forEach(function(mod) {
            var img = mod.imagem.replace("../", "");
            destaques.innerHTML +=
                '<div class="card-home">' +
                    '<img src="' + img + '" alt="' + mod.nome + '">' +
                    '<span class="categoria">' + mod.categoria + '</span>' +
                    '<h3>' + mod.nome + '</h3>' +
                    '<p>' + mod.descricao.substring(0, 70) + '...</p>' +
                    '<a class="download" href="mods/mod.html?id=' + mod.id + '">VER MOD</a>' +
                    '<button class="btn-fav" data-fav="' + mod.id + '" onclick="toggleFavorito(' + mod.id + ')">☆ Favoritar</button>' +
                '</div>';
        });
        atualizarBotoesFavorito();
    }

    var ultimos = document.getElementById("ultimos");
    if (ultimos && typeof mods !== "undefined") {
        ultimos.innerHTML = "";
        mods.slice().reverse().slice(0, 3).forEach(function(mod) {
            var img = mod.imagem.replace("../", "");
            ultimos.innerHTML +=
                '<div class="ultimo-card">' +
                    '<img src="' + img + '" alt="' + mod.nome + '">' +
                    '<div class="ultimo-info">' +
                        '<span class="categoria">' + mod.categoria + '</span>' +
                        '<h3>' + mod.nome + '</h3>' +
                        '<p>' + mod.descricao.substring(0, 90) + '...</p>' +
                        '<a href="mods/mod.html?id=' + mod.id + '">Ler mais →</a>' +
                    '</div>' +
                '</div>';
        });
    }

    // Data do último mod adicionado
    var elUpdate = document.getElementById("stat-update");
    if (elUpdate && typeof mods !== "undefined" && mods.length) {
        var ultimo = mods.slice().sort(function(a, b) {
            return b.id - a.id;
        })[0];
        elUpdate.textContent = ultimo.data || "--";
    }

    // ===== PESQUISA =====
    var searchInput = document.querySelector(".search input, #pesquisa");
    if (searchInput) {
        searchInput.addEventListener("input", function() {
            var termo = this.value.toLowerCase().trim();
            document.querySelectorAll(".card-mod, .card-home").forEach(function(card) {
                var texto = card.textContent.toLowerCase();
                card.style.display = (termo === "" || texto.includes(termo)) ? "" : "none";
            });
        });
    }

});
