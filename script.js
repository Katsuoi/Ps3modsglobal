// Cache público curto para que a troca entre páginas não espere a API a cada visita.
function ps3modsCachedJson(path, key, fallback) {
    var storageKey = "ps3mods_cache_v2_" + key;
    var cached = null;
    try {
        cached = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch (e) {}
    function save(data) {
        try { localStorage.setItem(storageKey, JSON.stringify({time: Date.now(), data: data})); } catch (e) {}
    }
    var request = fetch((window.PS3MODS_API_URL || "") + path)
        .then(function(r) { if (!r.ok) throw new Error("Falha ao carregar " + path); return r.json(); })
        .then(function(data) { save(data); return data; });
    if (cached && Object.prototype.hasOwnProperty.call(cached, "data")) {
        // Atualiza em segundo plano; a próxima aba já abre com dados locais.
        request.catch(function(e) { console.warn("Atualização de cache adiada:", e); });
        return Promise.resolve(cached.data);
    }
    return request.catch(function(e) {
        console.warn("Não foi possível carregar " + path, e);
        return fallback;
    });
}

// Uma única consulta compartilhada entre script.js e community.js.
window.PS3MODS_COMMUNITY_PROMISE = ps3modsCachedJson("/api/mods", "community", {items: []})
    .then(function(data) { return Array.isArray(data.items) ? data.items : []; });

document.addEventListener("DOMContentLoaded", async function() {
    // Dispara as três consultas em paralelo. Se houver cache, nenhuma delas bloqueia a tela.
    var overridePromise = (typeof mods !== "undefined")
        ? ps3modsCachedJson("/api/legacy-overrides", "overrides", {items: {}})
        : Promise.resolve({items: {}});
    var countsPromise = ps3modsCachedJson("/api/download-counts", "download-counts", {counts: {}});
    var results = await Promise.all([
        window.PS3MODS_COMMUNITY_PROMISE,
        overridePromise,
        countsPromise
    ]);
    var comunidadeMods = results[0];
    var catalogoMods = (typeof mods !== "undefined" ? mods.slice() : []).concat(comunidadeMods.map(function(item) {
        var mod = Object.assign({}, item); mod.__community = true; return mod;
    }));
    // Aplica os dados administrativos em memória, sem uma segunda espera de rede.
    var overrideData = results[1] || {items: {}};
    if (typeof mods !== "undefined") {
        Object.keys(overrideData.items || {}).forEach(function(id) {
            var target = mods.find(function(item) { return Number(item.id) === Number(id); });
            if (target) Object.assign(target, overrideData.items[id]);
        });
    }
    var countData = results[2] || {counts: {}};
    var downloadCounts = countData.counts || {};
    window.PS3MODS_DOWNLOAD_COUNTS = downloadCounts;

    var POR_PAGINA = 20;
    var paginaAtual = 1;
    var listaAtual = [];
    var containerLista = null;
    var listaBase = [];
    function formatarContagemDownloads(valor) {
        return new Intl.NumberFormat("pt-BR").format(Math.max(0, Number(valor) || 0));
    }
    function atualizarContagensDownloads() {
        document.querySelectorAll("[data-download-count]").forEach(function(el) {
            var id = el.getAttribute("data-mod-id");
            var total = Number(downloadCounts[String(id)] || 0);
            el.textContent = "↓ " + formatarContagemDownloads(total) + " downloads";
        });
        var statDownloads = document.getElementById("stat-downloads");
        if (statDownloads) {
            var totalGeral = Object.keys(downloadCounts).reduce(function(soma, id) {
                return soma + Math.max(0, Number(downloadCounts[id]) || 0);
            }, 0);
            statDownloads.textContent = formatarContagemDownloads(totalGeral);
        }
    }
    function registrarCliqueDownload(modId) {
        var token = localStorage.getItem("ps3member") || "";
        if (!token) return;
        fetch(window.PS3MODS_API_URL + "/api/download-counts/" + encodeURIComponent(modId), {
            method: "POST",
            headers: {"Authorization": "Bearer " + token},
            keepalive: true
        }).then(function(response) {
            if (!response.ok) return null;
            return response.json();
        }).then(function(data) {
            if (!data || !data.ok) return;
            downloadCounts[String(modId)] = Number(data.count) || 0;
            window.PS3MODS_DOWNLOAD_COUNTS = downloadCounts;
            atualizarContagensDownloads();
        }).catch(function(error) {
            console.warn("Não foi possível registrar este download.", error);
        });
    }


    function getFavoritos() {
        try { return JSON.parse(localStorage.getItem("ps3mods_favoritos") || "[]"); }
        catch (e) { return []; }
    }
    function salvarFavoritos(lista) {
        localStorage.setItem("ps3mods_favoritos", JSON.stringify(lista));
    }
    window.toggleFavorito = function(id) {
        var favs = getFavoritos();
        id = parseInt(id, 10);
        var index = favs.indexOf(id);
        if (index === -1) favs.push(id);
        else favs.splice(index, 1);
        salvarFavoritos(favs);
        atualizarBotoesFavorito();
    };
    function atualizarBotoesFavorito() {
        var favs = getFavoritos();
        document.querySelectorAll("[data-fav]").forEach(function(btn) {
            var id = parseInt(btn.getAttribute("data-fav"), 10);
            if (favs.indexOf(id) !== -1) {
                btn.textContent = "★ Favorito";
                btn.classList.add("favoritado");
            } else {
                btn.textContent = "☆ Favoritar";
                btn.classList.remove("favoritado");
            }
        });
    }

    function labelCategoria(mod) {
        if (mod.genero === "Ambos" || (mod.categorias && mod.categorias.length > 1)) {
            return "Armaduras (F/M)";
        }
        return mod.categoria || "";
    }

    function normalizarCategoria(valor) {
        return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    var GRUPOS_BUSCA = [
        ["follower","followers","companion","companions","compenion","seguidor","seguidores","seguidora","seguidoras","aliado","aliados","npc aliado","npc companheiro"],
        ["armor","armour","armadura","armaduras"],
        ["weapon","weapons","arma","armas"],
        ["spell","spells","magic","magia","magias","feitiço","feitico","feitiços","feiticos"],
        ["house","houses","home","homes","casa","casas","construção","construcao","construcoes"],
        ["quest","quests","mission","missions","missão","missao","missoes","aventura","aventuras"],
        ["graphics","graphic","visual","gráfico","grafico","graficos"],
        ["creature","creatures","monster","monsters","criatura","criaturas","monstro","monstros"],
        ["horse","horses","mount","mounts","montaria","montarias","cavalo","cavalos"],
        ["archery","bow","bows","arco","arcos","arqueiria"]
    ];

    function distanciaEdicao(a, b) {
        if (Math.abs(a.length - b.length) > 2) return 99;
        var prev = [];
        for (var j = 0; j <= b.length; j++) prev[j] = j;
        for (var i = 1; i <= a.length; i++) {
            var cur = [i], min = i;
            for (var k = 1; k <= b.length; k++) {
                cur[k] = Math.min(cur[k - 1] + 1, prev[k] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
                if (cur[k] < min) min = cur[k];
            }
            if (min > 2) return 99;
            prev = cur;
        }
        return prev[b.length];
    }

    function normalizarBusca(valor) {
        return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
            .replace(/[^a-z0-9]+/g, " ").trim();
    }

    function tokenCombina(token, palavras) {
        if (palavras.some(function(p) { return p === token || p.indexOf(token) === 0 || token.indexOf(p) === 0; })) return true;
        if (token.length >= 5 && palavras.some(function(p) {
            return p.length >= 5 && distanciaEdicao(token, p) <= (token.length >= 9 ? 2 : 1);
        })) return true;
        for (var i = 0; i < GRUPOS_BUSCA.length; i++) {
            var grupo = GRUPOS_BUSCA[i].map(normalizarBusca);
            if (grupo.some(function(alias) { return alias === token || (token.length >= 5 && distanciaEdicao(token, alias) <= 1); })) {
                if (grupo.some(function(alias) { return palavras.some(function(p) { return p === alias || p.indexOf(alias) === 0 || alias.indexOf(p) === 0; }); })) return true;
            }
        }
        return false;
    }

    function modCombinaBusca(mod, consulta) {
        var q = normalizarBusca(consulta);
        if (!q) return true;
        var dados = [mod.nome, mod.descricao, mod.categoria, mod.autor, mod.classe, mod.localizacao,
            mod.tipo, mod.genero, mod.escola, mod.vendedor, mod.casamento, mod.categorias || []].join(" ");
        var palavras = normalizarBusca(dados).split(/\s+/).filter(Boolean);
        var tokens = q.split(/\s+/).filter(Boolean);
        return tokens.every(function(token) { return tokenCombina(token, palavras); });
    }

    function matchCategoria(mod, categoria) {
        var busca = normalizarCategoria(categoria);
        var cat = normalizarCategoria(mod.categoria);
        if (cat && (cat.indexOf(busca) !== -1 || busca.indexOf(cat) !== -1)) return true;
        if (mod.categorias && mod.categorias.some(function(c) {
            var nome = normalizarCategoria(c);
            return nome.indexOf(busca) !== -1 || busca.indexOf(nome) !== -1;
        })) return true;
        if (busca.indexOf("armadura") !== -1 && (mod.genero === "Ambos" || cat === "armaduras")) return true;
        if (busca === "followers" && cat.indexOf("companion") !== -1) return true;
        return false;
    }

    function contarCategorias() {
        var contagem = {};
        if (!catalogoMods.length) return contagem;
        catalogoMods.forEach(function(mod) {
            var set = {};
            if (mod.categoria) set[mod.categoria] = true;
            if (mod.categorias && mod.categorias.length) {
                mod.categorias.forEach(function(c) { set[c] = true; });
            }
            if (mod.genero === "Ambos") {
                set["Armaduras Femininas"] = true;
                set["Armaduras Masculinas"] = true;
            }
            Object.keys(set).forEach(function(c) {
                contagem[c] = (contagem[c] || 0) + 1;
            });
        });
        return contagem;
    }

    function qtdDaCategoria(contagem, nomeBusca) {
        if (!nomeBusca) return 0;
        var busca = nomeBusca.toLowerCase();
        return catalogoMods.filter(function(mod) { return matchCategoria(mod, busca); }).length;
    }

    function aplicarContagemCategorias() {
        if (!catalogoMods.length) return;
        var contagem = contarCategorias();
        document.querySelectorAll("a[href*='categoria=']").forEach(function(a) {
            try {
                var url = new URL(a.href, window.location.href);
                var cat = url.searchParams.get("categoria");
                if (!cat) return;
                cat = decodeURIComponent(cat);
                var qtd = qtdDaCategoria(contagem, cat);

                // recupera nome limpo
                var base = cat;
                if (a.getAttribute("data-cat-nome")) {
                    base = a.getAttribute("data-cat-nome");
                } else {
                    var bruto = a.textContent.replace(/\s*\(\d+\)\s*$/, "").replace(/\d+\s*mods?/i, "").trim();
                    if (bruto) base = bruto;
                    a.setAttribute("data-cat-nome", base);
                }

                if (a.closest(".categorias-grid")) {
                    var zeroClass = qtd === 0 ? " zero" : "";
                    a.innerHTML =
                        '<span class="cat-nome">' + base + '</span>' +
                        '<span class="cat-badge' + zeroClass + '">' + qtd + ' mod' + (qtd === 1 ? '' : 's') + '</span>';
                } else {
                    var zeroClass2 = qtd === 0 ? " zero" : "";
                    a.innerHTML =
                        '<span class="cat-nome-side">' + base + '</span>' +
                        '<span class="side-count' + zeroClass2 + '">' + qtd + '</span>';
                }
            } catch (e) {}
        });
        var stats = document.querySelectorAll("#stats-bar .stat-item strong");
        if (stats && stats[1]) {
            var unicas = {};
            catalogoMods.forEach(function(m) {
                if (m.categoria) unicas[m.categoria] = true;
                if (m.categorias) m.categorias.forEach(function(c) { unicas[c] = true; });
            });
            if (unicas["Armaduras"] && (unicas["Armaduras Femininas"] || unicas["Armaduras Masculinas"])) {
                delete unicas["Armaduras"];
            }
            stats[1].textContent = Object.keys(unicas).length;
        }
    }

    function garantirBotaoMais() {
        if (document.getElementById("btn-carregar-mais")) return;
        if (!containerLista || !containerLista.parentNode) return;
        var wrap = document.createElement("div");
        wrap.id = "wrap-carregar-mais";
        wrap.style.cssText = "grid-column:1/-1;text-align:center;padding:24px 10px 10px;";
        var btn = document.createElement("button");
        btn.id = "btn-carregar-mais";
        btn.type = "button";
        btn.textContent = "Carregar mais";
        btn.style.cssText = "padding:12px 22px;border:none;border-radius:8px;background:#5ec8ff;color:#0b0e14;font-weight:700;font-size:14px;cursor:pointer;";
        btn.onclick = function() {
            paginaAtual++;
            renderPagina(false);
        };
        var info = document.createElement("p");
        info.id = "info-paginacao";
        info.style.cssText = "margin-top:10px;color:#8b95a5;font-size:13px;";
        wrap.appendChild(btn);
        wrap.appendChild(info);
        containerLista.appendChild(wrap);
    }

    function atualizarInfoPaginacao() {
        var info = document.getElementById("info-paginacao");
        var btn = document.getElementById("btn-carregar-mais");
        var wrap = document.getElementById("wrap-carregar-mais");
        if (!info || !btn || !wrap) return;
        var total = listaAtual.length;
        var mostrando = Math.min(paginaAtual * POR_PAGINA, total);
        if (total === 0) {
            wrap.style.display = "none";
            return;
        }
        wrap.style.display = "block";
        info.textContent = "Mostrando " + mostrando + " de " + total + " mods";
        btn.style.display = mostrando >= total ? "none" : "inline-block";
    }

    function criarCard(mod) {
        var card = document.createElement("article");
        card.className = "card-mod" + (mod.__community ? " card-comunidade" : "");
        var img = document.createElement("img");
        img.src = mod.imagem || ""; img.alt = mod.nome || "Mod";
        img.loading = "lazy"; img.decoding = "async";
        img.onerror = function() { this.style.display = "none"; };
        card.appendChild(img);
        if (mod.__community) {
            var origem = document.createElement("span");
            origem.className = "origem-comunidade"; origem.textContent = "Comunidade";
            card.appendChild(origem);
        }
        var cat = document.createElement("span");
        cat.className = "categoria"; cat.textContent = labelCategoria(mod) || "Comunidade";
        card.appendChild(cat);
        var title = document.createElement("h3"); title.textContent = mod.nome || "Mod sem nome"; card.appendChild(title);
        var desc = document.createElement("p"); desc.textContent = mod.descricao || ""; card.appendChild(desc);
        if (!mod.__community) {
            var count = document.createElement("span");
            count.className = "download-count"; count.setAttribute("data-download-count", "");
            count.setAttribute("data-mod-id", mod.id);
            count.textContent = "↓ " + formatarContagemDownloads(downloadCounts[String(mod.id)] || 0) + " downloads";
            card.appendChild(count);
        }
        var link = document.createElement("a"); link.className = "download";
        link.href = mod.__community ? "../mod-comunidade.html?id=" + encodeURIComponent(mod.id) : "mod.html?id=" + encodeURIComponent(mod.id);
        link.textContent = "Ver Mod"; card.appendChild(link);
        if (!mod.__community) {
            var fav = document.createElement("button"); fav.className = "btn-fav";
            fav.type = "button"; fav.setAttribute("data-fav", mod.id); fav.textContent = "☆ Favoritar";
            fav.addEventListener("click", function() { window.toggleFavorito(mod.id); });
            card.appendChild(fav);
        }
        return card;
    }

    function renderPagina(reset) {
        if (!containerLista) return;
        if (reset) {
            containerLista.innerHTML = "";
            paginaAtual = 1;
        }
        var wrap = document.getElementById("wrap-carregar-mais");
        if (wrap) wrap.remove();
        if (listaAtual.length === 0) {
            containerLista.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8b95a5;padding:40px;">Nenhum mod encontrado.</p>';
            return;
        }
        var inicio = (paginaAtual - 1) * POR_PAGINA;
        var fim = paginaAtual * POR_PAGINA;
        listaAtual.slice(inicio, fim).forEach(function(mod) {
            containerLista.appendChild(criarCard(mod));
        });
        garantirBotaoMais();
        atualizarInfoPaginacao();
        atualizarBotoesFavorito();
        atualizarContagensDownloads();
    }

    function renderMods(listaMods, container) {
        containerLista = container;
        listaAtual = listaMods.slice();
        renderPagina(true);
    }

    function montarBuscaAvancada() {
        if (!containerLista) return;
        if (document.getElementById("busca-avancada")) return;
        var host = containerLista.parentNode;
        if (!host) return;

        var box = document.createElement("section");
        box.id = "busca-avancada";
        box.className = "busca-catalogo";
        box.innerHTML =
            '<div class="busca-principal"><label for="ba-texto">Pesquisar mods</label>' +
            '<input id="ba-texto" type="search" placeholder="Nome, descrição ou autor..." autocomplete="off">' +
            '<button type="button" id="ba-filtrar">Pesquisar</button></div>' +
            '<details class="filtros-avancados"><summary>Filtros avançados <span>Categoria, gênero e mais</span></summary>' +
            '<div class="filtros-grid">' +
            '<label>Categoria<select id="ba-cat"><option value="">Todas as categorias</option></select></label>' +
            '<label>Ordenar por<select id="ba-ordem"><option value="recentes">Mais recentes</option><option value="antigos">Mais antigos</option><option value="az">Nome: A–Z</option><option value="za">Nome: Z–A</option></select></label>' +
            '<label>Gênero<select id="ba-genero"><option value="">Qualquer</option><option value="Feminino">Feminino</option><option value="Masculino">Masculino</option><option value="Ambos">Ambos (F/M)</option></select></label>' +
            '<label>Casamento<select id="ba-casamento"><option value="">Qualquer</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>' +
            '</div><div class="filtros-acoes"><button type="button" id="ba-limpar" class="btn-limpar">Limpar filtros</button></div></details>' +
            '<p id="ba-info" class="busca-info" aria-live="polite"></p>';

        host.insertBefore(box, containerLista);

        var sel = document.getElementById("ba-cat");
        var cats = {};
        if (catalogoMods.length) {
            catalogoMods.forEach(function(m) {
                if (m.categoria) cats[m.categoria] = true;
                if (m.categorias) m.categorias.forEach(function(c) { cats[c] = true; });
            });
        }
        Object.keys(cats).sort().forEach(function(c) {
            if (c === "Armaduras") return;
            var opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });

        var params = new URLSearchParams(window.location.search);
        var catUrl = params.get("categoria");
        if (catUrl) {
            for (var i = 0; i < sel.options.length; i++) {
                if (normalizarCategoria(sel.options[i].value) === normalizarCategoria(catUrl)) {
                    sel.value = sel.options[i].value;
                    break;
                }
            }
        }

        function aplicarFiltroAvancado() {
            var texto = (document.getElementById("ba-texto").value || "").toLowerCase().trim();
            var cat = document.getElementById("ba-cat").value;
            var genero = document.getElementById("ba-genero").value;
            var casamento = document.getElementById("ba-casamento").value;
            var ordem = document.getElementById("ba-ordem").value;
            var result = listaBase.slice();

            if (cat) result = result.filter(function(m) { return matchCategoria(m, cat); });
            if (texto) {
                result = result.filter(function(m) {
                    return modCombinaBusca(m, texto);
                });
            }
            if (genero) {
                result = result.filter(function(m) {
                    var g = String(m.genero || "").toLowerCase();
                    if (genero === "Ambos") return g === "ambos" || (m.categorias && m.categorias.length > 1);
                    return g === genero.toLowerCase();
                });
            }
            if (casamento) {
                result = result.filter(function(m) {
                    var c = String(m.casamento || "").toLowerCase();
                    if (casamento === "sim") return c.indexOf("sim") !== -1;
                    if (casamento === "nao") return c.indexOf("nao") !== -1 || c.indexOf("não") !== -1;
                    return true;
                });
            }
            if (ordem === "recentes") result.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
            if (ordem === "antigos") result.sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
            if (ordem === "az") result.sort(function(a, b) { return String(a.nome || "").localeCompare(String(b.nome || "")); });
            if (ordem === "za") result.sort(function(a, b) { return String(b.nome || "").localeCompare(String(a.nome || "")); });

            document.getElementById("ba-info").textContent = result.length + " mod(s) encontrado(s)";
            renderMods(result, containerLista);
        }

        document.getElementById("ba-filtrar").onclick = aplicarFiltroAvancado;
        document.getElementById("ba-limpar").onclick = function() {
            document.getElementById("ba-texto").value = "";
            document.getElementById("ba-cat").value = "";
            document.getElementById("ba-genero").value = "";
            document.getElementById("ba-casamento").value = "";
            document.getElementById("ba-ordem").value = "recentes";
            document.getElementById("ba-info").textContent = "";
            renderMods(listaBase, containerLista);
        };
        document.getElementById("ba-texto").addEventListener("keydown", function(e) {
            if (e.key === "Enter") aplicarFiltroAvancado();
        });

        // Recupera a pesquisa enviada pela página inicial ou por um link compartilhado.
        var buscaUrl = params.get("busca") || "";
        if (buscaUrl) {
            document.getElementById("ba-texto").value = buscaUrl;
            aplicarFiltroAvancado();
        }
    }

    function adicionarCategoriasComunidade() {
        var hosts = [document.querySelector(".categorias-grid"), document.querySelector(".side-cats")].filter(Boolean);
        var known = {};
        hosts.forEach(function(host) {
            host.querySelectorAll('a[href*="categoria="]').forEach(function(a) {
                try { known[normalizarCategoria(new URL(a.href, window.location.href).searchParams.get("categoria"))] = true; } catch (e) {}
            });
        });
        comunidadeMods.forEach(function(mod) {
            [mod.categoria].concat(Array.isArray(mod.categorias) ? mod.categorias : []).forEach(function(nome) {
                var label = String(nome || "").trim(), key = normalizarCategoria(label);
                if (!label || known[key]) return;
                known[key] = true;
                hosts.forEach(function(host) {
                    var a = document.createElement("a"); a.textContent = label;
                    a.href = (host.classList.contains("categorias-grid") ? "index.html?categoria=" : "mods/index.html?categoria=") + encodeURIComponent(label);
                    host.appendChild(a);
                });
            });
        });
    }
    adicionarCategoriasComunidade();

    // LISTA DE MODS
    var lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista && typeof mods !== "undefined") {
        var params = new URLSearchParams(window.location.search);
        var categoria = params.get("categoria");
        if (categoria) {
            listaBase = catalogoMods.filter(function(m) { return matchCategoria(m, categoria); });
            var titulo = document.querySelector(".hero-content h2, .banner-pequeno h2");
            if (titulo) titulo.textContent = categoria;
        } else {
            listaBase = catalogoMods.slice();
        }
        renderMods(listaBase, lista);
        montarBuscaAvancada();
    }

    // PAGINA DO MOD
    var params2 = new URLSearchParams(window.location.search);
    var id = parseInt(params2.get("id"), 10);
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
            var elData = document.getElementById("data-mod");
            var elCatBanner = document.getElementById("categoria");

            if (elNome) elNome.textContent = mod.nome;
            if (elTitulo) elTitulo.textContent = mod.nome;
            if (elDesc) elDesc.textContent = mod.descricao;
            if (elCat) elCat.textContent = labelCategoria(mod);
            if (elCatBanner) elCatBanner.textContent = labelCategoria(mod);
            if (elAutor) elAutor.textContent = mod.autor || "Desconhecido";
            if (elVersao) elVersao.textContent = mod.versao || "-";
            if (elCompat) elCompat.textContent = mod.compatibilidade || "Skyrim LE PS3";
            if (elData) elData.textContent = mod.data || "-";

            var tabela = document.getElementById("tabela-mod");
            if (tabela) {
                var mapa = [
                    ["casamento", "Casamento"],
                    ["localizacao", "Localizacao"],
                    ["classe", "Classe"],
                    ["genero", "Genero"],
                    ["tipo", "Tipo"],
                    ["forjavel", "Forjavel"],
                    ["corpo", "Corpo"],
                    ["quantidade", "Quantidade"],
                    ["escola", "Escola"],
                    ["custo", "Custo"],
                    ["vendedor", "Vendedor"],
                    ["armazenamento", "Armazenamento"],
                    ["manequins", "Manequins"],
                    ["seguidores", "Seguidores"],
                    ["forja", "Forja"],
                    ["alquimia", "Alquimia"],
                    ["encantamento", "Encantamento"],
                    ["inicio", "Inicio"],
                    ["npc", "NPC"],
                    ["duracao", "Duracao"],
                    ["hostil", "Hostil"],
                    ["domesticavel", "Domesticavel"],
                    ["funcao", "Funcao"],
                    ["ganhoFPS", "Ganho de FPS"],
                    ["perdaVisual", "Perda visual"],
                    ["recomendado", "Recomendado"]
                ];
                mapa.forEach(function(item) {
                    var chave = item[0];
                    var label = item[1];
                    if (mod[chave] && String(mod[chave]).trim() !== "" && mod[chave] !== "N/A") {
                        var tr = document.createElement("tr");
                        tr.innerHTML = "<td>" + label + "</td><td>" + mod[chave] + "</td>";
                        tabela.appendChild(tr);
                    }
                });
            }

            var capa = document.getElementById("capa");
            if (capa) {
                capa.src = mod.imagem;
                capa.alt = mod.nome;
                capa.loading = "lazy";
                capa.decoding = "async";
            }

            var countLabel = document.getElementById("mod-download-count");
            if (countLabel) countLabel.setAttribute("data-mod-id", mod.id);
            atualizarContagensDownloads();

            var downloadBox = document.getElementById("download-box");
            if (downloadBox) {
                downloadBox.innerHTML = "";
                var token = localStorage.getItem("ps3member") || "";
                function showLogin(message) {
                    downloadBox.innerHTML = "";
                    var p = document.createElement("p");
                    p.textContent = message || "Faça login para liberar os links de download.";
                    downloadBox.appendChild(p);
                    var login = document.createElement("a");
                    login.className = "download";
                    login.href = "../membro.html";
                    login.textContent = "Entrar / Criar perfil";
                    downloadBox.appendChild(login);
                }
                if (!token) {
                    showLogin();
                } else {
                    fetch(window.PS3MODS_API_URL + "/api/auth/me", {headers: {"Authorization": "Bearer " + token}})
                    .then(function(r) { if (!r.ok) throw new Error("Sua sessão expirou. Entre novamente."); return r.json(); })
                    .then(function() {
                        return fetch(window.PS3MODS_API_URL + "/api/legacy-downloads/" + encodeURIComponent(mod.id), {headers: {"Authorization": "Bearer " + token}});
                    })
                    .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || "Não foi possível liberar os downloads."); return d; }); })
                    .then(function(data) {
                        downloadBox.innerHTML = "";
                        (data.downloads || []).forEach(function(item) {
                            var a = document.createElement("a");
                            a.className = "download";
                            a.setAttribute("data-monetag-download", "1");
                            a.href = item.link;
                            a.target = "_blank";
                            a.rel = "noopener noreferrer";
                            a.textContent = item.nome || "Download";
                            a.style.display = "inline-block";
                            a.style.margin = "6px 8px 6px 0";
                            a.addEventListener("click", function() { registrarCliqueDownload(mod.id); });
                            downloadBox.appendChild(a);
                        });
                        if (!downloadBox.children.length) downloadBox.textContent = "Nenhum download disponível.";
                    })
                    .catch(function(err) { showLogin(err.message); });
                }
            }

            var galeria = document.getElementById("galeria");
            if (galeria && mod.galeria) {
                galeria.innerHTML = "";
                mod.galeria.forEach(function(src) {
                    var img = document.createElement("img");
                    img.src = src;
                    img.alt = mod.nome;
                    img.loading = "lazy";
                    img.decoding = "async";
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

    // HOME
    var statMods = document.getElementById("stat-mods");
    if (statMods) statMods.textContent = catalogoMods.length;
    atualizarContagensDownloads();

    var destaques = document.getElementById("destaques");
    if (destaques && typeof mods !== "undefined") {
        destaques.innerHTML = "";
        mods.slice().sort(function(a, b) { return (Number(downloadCounts[String(b.id)] || 0) - Number(downloadCounts[String(a.id)] || 0)) || (Number(b.id) - Number(a.id)); }).slice(0, 8).forEach(function(mod) {
            var img = String(mod.imagem || "").replace("../", "");
            destaques.innerHTML +=
                '<div class="card-home">' +
                '<img src="' + img + '" alt="' + mod.nome + '" loading="lazy" decoding="async">' +
                '<span class="categoria">' + labelCategoria(mod) + '</span>' +
                '<h3>' + mod.nome + '</h3>' +
                '<p>' + String(mod.descricao || "").substring(0, 70) + '...</p>' +
                '<span class="download-count" data-download-count data-mod-id="' + mod.id + '">↓ ' + formatarContagemDownloads(downloadCounts[String(mod.id)] || 0) + ' downloads</span>' +
                '<a class="download" href="mods/mod.html?id=' + mod.id + '">VER MOD</a>' +
                '<button class="btn-fav" data-fav="' + mod.id + '" onclick="toggleFavorito(' + mod.id + ')">☆ Favoritar</button>' +
                '</div>';
        });
        atualizarBotoesFavorito();
    }

    var ultimos = document.getElementById("ultimos");
    if (ultimos && typeof mods !== "undefined") {
        ultimos.innerHTML = "";
        mods.slice().sort(function(a, b) { function ts(v) { var m = String(v || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? new Date(Number(m[3]), Number(m[2])-1, Number(m[1])).getTime() : (Date.parse(v) || 0); } return ts(b.data) - ts(a.data) || Number(b.id)-Number(a.id); }).slice(0, 3).forEach(function(mod) {
            var img = String(mod.imagem || "").replace("../", "");
            ultimos.innerHTML +=
                '<div class="ultimo-card">' +
                '<img src="' + img + '" alt="' + mod.nome + '" loading="lazy" decoding="async">' +
                '<div class="ultimo-info">' +
                '<span class="categoria">' + labelCategoria(mod) + '</span>' +
                '<h3>' + mod.nome + '</h3>' +
                '<p>' + String(mod.descricao || "").substring(0, 90) + '...</p>' +
                '<span class="download-count" data-download-count data-mod-id="' + mod.id + '">↓ ' + formatarContagemDownloads(downloadCounts[String(mod.id)] || 0) + ' downloads</span>' +
                '<a href="mods/mod.html?id=' + mod.id + '">Ler mais →</a>' +
                '</div></div>';
        });
    }

    var elUpdate = document.getElementById("stat-update");
    if (elUpdate && typeof mods !== "undefined" && mods.length) {
        var ultimo = mods.slice().sort(function(a, b) { return b.id - a.id; })[0];
        elUpdate.textContent = ultimo.data || "--";
    }

    aplicarContagemCategorias();

    // PESQUISA HEADER
    var searchInput = document.querySelector(".search input, #pesquisa");
    if (searchInput) {
        searchInput.addEventListener("input", function() {
            var termo = this.value.toLowerCase().trim();
            if (containerLista && typeof mods !== "undefined" && (document.getElementById("todos-mods") || document.getElementById("lista-mods"))) {
                var baTexto = document.getElementById("ba-texto");
                if (baTexto) baTexto.value = this.value;
                var base = listaBase.length ? listaBase : catalogoMods;
                if (!termo) {
                    renderMods(base, containerLista);
                    return;
                }
                var filtrados = base.filter(function(m) {
                    return modCombinaBusca(m, termo);
                });
                renderMods(filtrados, containerLista);
                return;
            }
            document.querySelectorAll(".card-mod, .card-home, .ultimo-card").forEach(function(card) {
                var heading = card.querySelector("h3");
                var nome = heading ? heading.textContent : "";
                var mod = (typeof mods !== "undefined" ? mods : []).find(function(item) {
                    return String(item.nome || "").toLowerCase() === nome.toLowerCase();
                });
                var match = termo === "" || (mod ? modCombinaBusca(mod, termo) : normalizarBusca(card.textContent).indexOf(normalizarBusca(termo)) !== -1);
                card.style.display = match ? "" : "none";
            });
        });
    }


});
