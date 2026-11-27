(function(){if(document.querySelector('script[data-ps3-notifications]'))return;var s=document.createElement("script");s.src="/notifications.js?v=20261123-1";s.defer=true;s.setAttribute("data-ps3-notifications","1");document.head.appendChild(s);})();
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
    if (cached && Object.prototype.hasOwnProperty.call(cached, "data") && Date.now() - Number(cached.time || 0) < 90000) {
        return Promise.resolve(cached.data);
    }
    // A API não pode impedir o catálogo estático de aparecer se o proxy ficar lento.
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId;
    var request = fetch((window.PS3MODS_API_URL || "") + path, controller ? {signal: controller.signal} : {})
        .then(function(r) { if (!r.ok) throw new Error("Falha ao carregar " + path + " (HTTP " + r.status + ")"); return r.json(); })
        .then(function(data) { save(data); return data; })
        .finally(function() { if (timeoutId) clearTimeout(timeoutId); });
    var timeout = new Promise(function(resolve) {
        timeoutId = setTimeout(function() {
            if (controller) controller.abort();
            console.warn("Tempo limite ao carregar " + path + "; usando catálogo local.");
            resolve(fallback);
        }, 5000);
    });
    request.catch(function() {});
    if (cached && Object.prototype.hasOwnProperty.call(cached, "data")) {
        // Exibe os dados locais imediatamente e atualiza em segundo plano.
        request.catch(function(e) { console.warn("Atualização de cache adiada:", e); });
        return Promise.resolve(cached.data);
    }
    return Promise.race([request, timeout]).catch(function(e) {
        console.warn("Não foi possível carregar " + path, e);
        return fallback;
    });
}

// Uma única consulta compartilhada entre script.js e community.js.
window.PS3MODS_COMMUNITY_PROMISE = fetch((window.PS3MODS_API_URL || "") + "/api/mods", {cache: "no-store"})
    .then(function(response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
    .then(function(data) { return Array.isArray(data.items) ? data.items : []; })
    .catch(function(error) { console.warn("Falha ao atualizar mods da comunidade:", error); return []; });

document.addEventListener("DOMContentLoaded", async function() {
    // Dispara as três consultas em paralelo. Se houver cache, nenhuma delas bloqueia a tela.
    var overridePromise = (typeof mods !== "undefined")
        ? ps3modsCachedJson("/api/legacy-overrides", "overrides", {items: {}})
        : Promise.resolve({items: {}});
    // As contagens precisam ser consultadas sem o cache local de 90 segundos.
    var countsPromise = fetch((window.PS3MODS_API_URL || "") + "/api/download-counts", {cache: "no-store"})
        .then(function(response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .catch(function(error) { console.warn("Não foi possível atualizar as contagens de downloads:", error); return {counts: {}}; });
    // A tela inicial nunca deve depender da resposta da API para renderizar o catálogo local.
    function aguardarComLimite(promise, fallback, ms, label) {
        return Promise.race([
            Promise.resolve(promise),
            new Promise(function(resolve) {
                setTimeout(function() {
                    console.warn("Tempo limite ao carregar " + label + "; exibindo os dados locais disponíveis.");
                    resolve(fallback);
                }, ms);
            })
        ]);
    }
    var results = await Promise.all([
        aguardarComLimite(window.PS3MODS_COMMUNITY_PROMISE, [], 3500, "mods da comunidade"),
        aguardarComLimite(overridePromise, {items: {}}, 3500, "edições administrativas"),
        aguardarComLimite(countsPromise, {counts: {}}, 3500, "contagem de downloads")
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
    function somarContagensDownloads(counts) {
        return Object.keys(counts || {}).reduce(function(soma, id) {
            return soma + Math.max(0, Number(counts[id]) || 0);
        }, 0);
    }
    // A API entrega o total agregado do banco; use-o como fonte oficial.
    var totalDownloads = Number.isFinite(Number(countData.total))
        ? Math.max(0, Number(countData.total))
        : somarContagensDownloads(downloadCounts);
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
            statDownloads.textContent = formatarContagemDownloads(totalDownloads);
        }
    }

    // Reconsulta somente o total persistido, independentemente das outras APIs da página.
    // Isso recupera o número mesmo quando a consulta inicial atingiu o tempo limite.
    var totalDownloadsSyncBusy = false;
    async function sincronizarTotalDownloadsPersistido() {
        if (totalDownloadsSyncBusy || !document.getElementById("stat-downloads")) return;
        totalDownloadsSyncBusy = true;
        try {
            var response = await fetch((window.PS3MODS_API_URL || "") + "/api/download-counts?refresh=" + Date.now(), {
                cache: "no-store",
                headers: {"Cache-Control": "no-cache"}
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            var data = await response.json();
            var persistedTotal = Number(data && data.total);
            if (!Number.isFinite(persistedTotal) || persistedTotal < 0) {
                throw new Error("A API não retornou um total válido");
            }
            // Nunca regride o número já confirmado nesta sessão por uma resposta antiga.
            totalDownloads = Math.max(totalDownloads, persistedTotal);
            if (data.counts && typeof data.counts === "object") {
                downloadCounts = data.counts;
                window.PS3MODS_DOWNLOAD_COUNTS = downloadCounts;
            }
            atualizarContagensDownloads();
        } catch (error) {
            console.warn("Não foi possível sincronizar o total geral de downloads:", error);
        } finally {
            totalDownloadsSyncBusy = false;
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
            totalDownloads += 1;
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
        var principal = String(mod && mod.categoria || "").trim();
        // Só exibe o selo F/M quando a categoria principal for realmente armadura.
        // Ter várias categorias não transforma o mod em armadura.
        var principalNormalizada = normalizarBusca(principal);
        if (mod && mod.genero === "Ambos" &&
            (principalNormalizada === "armadura" || principalNormalizada === "armaduras")) {
            return "Armaduras (F/M)";
        }
        return principal || (Array.isArray(mod && mod.categorias) ? mod.categorias[0] || "" : "");
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

    function palavrasEquivalentes(a, b) {
        if (a === b) return true;
        // Aceita apenas a variação simples singular/plural; não confunde prefixos
        // semanticamente diferentes, como "arma" e "armadura".
        if (a.length > 3 && a.charAt(a.length - 1) === "s") return a.slice(0, -1) === b;
        if (b.length > 3 && b.charAt(b.length - 1) === "s") return b.slice(0, -1) === a;
        return false;
    }

    function tokenCombina(token, palavras) {
        if (palavras.some(function(p) { return palavrasEquivalentes(p, token); })) return true;
        if (token.length >= 5 && palavras.some(function(p) {
            return p.length >= 5 && distanciaEdicao(token, p) <= (token.length >= 9 ? 2 : 1);
        })) return true;
        for (var i = 0; i < GRUPOS_BUSCA.length; i++) {
            var grupo = GRUPOS_BUSCA[i].map(function(alias) { return normalizarBusca(alias); });
            var consultaNoGrupo = grupo.some(function(alias) {
                return palavrasEquivalentes(alias, token) ||
                    (token.length >= 5 && alias.length >= 5 && distanciaEdicao(token, alias) <= 1);
            });
            if (consultaNoGrupo && grupo.some(function(alias) {
                return palavras.some(function(p) { return palavrasEquivalentes(p, alias); });
            })) return true;
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

    function chaveCanonicaCategoria(valor) {
        return normalizarBusca(valor).split(/\s+/).filter(function(palavra) {
            return palavra && !/^(de|da|do|das|dos)$/.test(palavra);
        }).map(function(palavra) {
            if (palavra.length > 4 && palavra.slice(-3) === "oes") return palavra.slice(0, -3) + "ao";
            if (palavra.length > 3 && palavra.slice(-1) === "s") return palavra.slice(0, -1);
            return palavra;
        }).join(" ");
    }

    function categoriasEquivalentes(a, b) {
        a = normalizarBusca(a);
        b = normalizarBusca(b);
        if (!a || !b) return false;
        if (chaveCanonicaCategoria(a) === chaveCanonicaCategoria(b)) return true;
        if (palavrasEquivalentes(a, b)) return true;
        // Sinônimos são aceitos somente quando o nome inteiro da categoria
        // corresponde a um alias; nunca por coincidência de prefixo.
        for (var i = 0; i < GRUPOS_BUSCA.length; i++) {
            var grupo = GRUPOS_BUSCA[i].map(function(alias) { return normalizarBusca(alias); });
            if (grupo.some(function(alias) { return palavrasEquivalentes(alias, a); }) &&
                grupo.some(function(alias) { return palavrasEquivalentes(alias, b); })) return true;
        }
        return false;
    }

    function matchCategoria(mod, categoria) {
        var busca = normalizarBusca(categoria);
        if (!busca) return false;
        var categoriasMod = [mod.categoria].concat(Array.isArray(mod.categorias) ? mod.categorias : []);
        var encontrou = categoriasMod.some(function(valor) {
            var nome = normalizarBusca(valor);
            if (!nome) return false;
            if (categoriasEquivalentes(nome, busca)) return true;

            // "Armaduras" pode funcionar como categoria-pai de "Armaduras Femininas"
            // e "Armaduras Masculinas", sem alcançar a categoria "Armas".
            if ((busca === "armadura" || busca === "armaduras") &&
                /^armaduras? (femininas|masculinas)$/.test(nome)) return true;
            return false;
        });
        if (encontrou) return true;

        // Mods marcados para ambos os gêneros só entram nas subcategorias de
        // armadura quando sua categoria principal também é de armaduras.
        var categoriaPrincipal = normalizarBusca(mod.categoria);
        return mod.genero === "Ambos" &&
            (busca === "armadura feminina" || busca === "armaduras femininas" ||
             busca === "armadura masculina" || busca === "armaduras masculinas") &&
            (categoriaPrincipal === "armadura" || categoriaPrincipal === "armaduras");
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
            var categoriaPrincipal = normalizarBusca(mod.categoria);
            if (mod.genero === "Ambos" &&
                (categoriaPrincipal === "armadura" || categoriaPrincipal === "armaduras")) {
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
                // URLSearchParams já decodifica o valor; decodificar novamente
                // quebra categorias com "%" ou sequências especiais.
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
        var origem = document.createElement("span");
        origem.className = mod.__community ? "origem-comunidade" : "origem-administracao";
        origem.textContent = mod.__community ? "Comunidade" : "Administração";
        card.appendChild(origem);
        var cat = document.createElement("span");
        cat.className = "categoria"; cat.textContent = labelCategoria(mod) || "Comunidade";
        card.appendChild(cat);
        var updatedAt = mod.downloadUpdatedAt ? Date.parse(mod.downloadUpdatedAt) : 0;
        if (updatedAt && Date.now() - updatedAt < 7 * 24 * 60 * 60 * 1000 && Date.now() >= updatedAt) { var updateBadge=document.createElement("span"); updateBadge.className="badge-mod-atualizado"; updateBadge.textContent="ATUALIZADO"; updateBadge.title="Link de download atualizado nos últimos 7 dias"; card.appendChild(updateBadge); }
        var title = document.createElement("h3"); title.textContent = mod.nome || "Mod sem nome"; card.appendChild(title);
        var desc = document.createElement("p"); desc.textContent = mod.descricao || ""; card.appendChild(desc);
        // Exibe a contagem para mods do catálogo e da comunidade usando o mesmo endpoint.
        var count = document.createElement("span");
        count.className = "download-count"; count.setAttribute("data-download-count", "");
        count.setAttribute("data-mod-id", mod.id);
        count.textContent = "↓ " + formatarContagemDownloads(downloadCounts[String(mod.id)] || 0) + " downloads";
        card.appendChild(count);
        var link = document.createElement("a"); link.className = "download";
        link.href = mod.__community ? "../mod-comunidade.html?id=" + encodeURIComponent(mod.id) : "mod.html?id=" + encodeURIComponent(mod.id);
        link.textContent = "Ver Mod"; card.appendChild(link);
        var fav = document.createElement("button"); fav.className = "btn-fav";
        fav.type = "button"; fav.setAttribute("data-fav", mod.id); fav.textContent = "☆ Favoritar";
        fav.addEventListener("click", function() { window.toggleFavorito(mod.id); });
        card.appendChild(fav);
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
                [m.categoria].concat(Array.isArray(m.categorias) ? m.categorias : []).forEach(function(nome) {
                    var label = String(nome || "").trim(), key = chaveCanonicaCategoria(label);
                    if (!label || !key) return;
                    var atual = cats[key];
                    if (!atual || (label.length > atual.length && label.indexOf(" de ") !== -1 && atual.indexOf(" de ") === -1)) cats[key] = label;
                });
            });
        }
        Object.keys(cats).sort(function(a,b) { return cats[a].localeCompare(cats[b], "pt-BR"); }).forEach(function(key) {
            var c = cats[key];
            if (normalizarBusca(c) === "armaduras") return;
            var opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });

        var params = new URLSearchParams(window.location.search);
        var catUrl = params.get("categoria");
        if (catUrl) {
            for (var i = 0; i < sel.options.length; i++) {
                if (categoriasEquivalentes(sel.options[i].value, catUrl)) {
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
            // A página pode ter sido aberta por um link de categoria. Ao alterar
            // o filtro, recomeça do catálogo completo para não combinar dois filtros
            // incompatíveis (categoria da URL + categoria escolhida no seletor).
            var result = catalogoMods.slice();

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
        // Usa o catálogo completo (mods legados + comunidade), não apenas os envios
        // da comunidade. Assim, qualquer categoria nova aparece automaticamente.
        var hosts = [document.querySelector(".categorias-grid"), document.querySelector(".side-cats")].filter(Boolean);
        var known = {};
        hosts.forEach(function(host) {
            host.querySelectorAll('a[href*="categoria="]').forEach(function(a) {
                try {
                    var atual = new URL(a.href, window.location.href).searchParams.get("categoria");
                    if (atual) known[chaveCanonicaCategoria(atual)] = true;
                } catch (e) {}
            });
        });
        var categorias = {};
        catalogoMods.forEach(function(mod) {
            [mod.categoria].concat(Array.isArray(mod.categorias) ? mod.categorias : []).forEach(function(nome) {
                var label = String(nome || "").trim();
                var key = chaveCanonicaCategoria(label);
                if (label && key) {
                    var atualLabel = categorias[key];
                    if (!atualLabel || (label.indexOf(" de ") !== -1 && atualLabel.indexOf(" de ") === -1) ||
                        (label.length > atualLabel.length && /s$/.test(normalizarBusca(label)) && !/s$/.test(normalizarBusca(atualLabel)))) {
                        categorias[key] = label;
                    }
                }
            });
        });
        Object.keys(categorias).sort(function(a,b) { return categorias[a].localeCompare(categorias[b], "pt-BR"); }).forEach(function(key) {
            if (known[key]) return;
            var label = categorias[key];
            hosts.forEach(function(host) {
                var a = document.createElement("a");
                a.textContent = label;
                a.href = (host.classList.contains("categorias-grid") ? "index.html?categoria=" : "mods/index.html?categoria=") + encodeURIComponent(label);
                host.appendChild(a);
            });
            known[key] = true;
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
            var detailUpdatedAt=mod.downloadUpdatedAt?Date.parse(mod.downloadUpdatedAt):0;if(detailUpdatedAt&&Date.now()-detailUpdatedAt<7*24*60*60*1000&&Date.now()>=detailUpdatedAt&&elTitulo){var detailBadge=document.createElement("span");detailBadge.className="badge-mod-atualizado";detailBadge.textContent="ATUALIZADO";detailBadge.title="Link de download atualizado nos últimos 7 dias";elTitulo.insertAdjacentElement("afterend",detailBadge);}
            if (elDesc) elDesc.textContent = mod.descricao;
            if (elCat) elCat.textContent = labelCategoria(mod);
            if (elCatBanner) elCatBanner.textContent = labelCategoria(mod);
            if (elAutor) elAutor.textContent = mod.autor || "Desconhecido";
            if (elVersao) elVersao.textContent = mod.versao || "-";
            if (elCompat) elCompat.textContent = mod.compatibilidade || "Skyrim LE PS3";
            if (elData) elData.textContent = mod.data || "-";

            // SEO dinâmico: cada mod do catálogo recebe metadados próprios.
            (function aplicarSeoDoMod(item) {
                var description = String(item.descricao || "Mod de Skyrim Legendary Edition para PlayStation 3.").replace(/\s+/g, " ").trim().slice(0, 300);
                var pageUrl = "https://jogosmodsglobal.pages.dev/mods/mod.html?id=" + encodeURIComponent(item.id);
                document.title = String(item.nome || "Mod") + " para Skyrim PS3 | Jogos Mods Global";
                function setMeta(selector, attribute, value) {
                    var node = document.head.querySelector(selector);
                    if (!node) {
                        node = document.createElement("meta");
                        var match = selector.match(/(?:name|property)="([^"]+)"/);
                        node.setAttribute(selector.indexOf("property=") !== -1 ? "property" : "name", match[1]);
                        document.head.appendChild(node);
                    }
                    node.setAttribute(attribute, value);
                }
                setMeta('meta[name="description"]', "content", description);
                setMeta('meta[property="og:title"]', "content", document.title);
                setMeta('meta[property="og:description"]', "content", description);
                setMeta('meta[property="og:type"]', "content", "article");
                setMeta('meta[property="og:url"]', "content", pageUrl);
                var imagePath = String(item.imagem || "../imagens/Preview.jpg").replace(/^\.\.\//, "");
                setMeta('meta[property="og:image"]', "content", new URL(imagePath, "https://jogosmodsglobal.pages.dev/").href);
                var canonical = document.head.querySelector('link[rel="canonical"]');
                if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
                canonical.href = pageUrl;
                var oldSchema = document.getElementById("mod-seo-schema");
                if (oldSchema) oldSchema.remove();
                var schema = document.createElement("script");
                schema.type = "application/ld+json";
                schema.id = "mod-seo-schema";
                schema.textContent = JSON.stringify({
                    "@context": "https://schema.org", "@type": "SoftwareApplication",
                    "name": item.nome, "description": description, "applicationCategory": "Game",
                    "operatingSystem": "PlayStation 3", "url": pageUrl,
                    "image": new URL(imagePath, "https://jogosmodsglobal.pages.dev/").href,
                    "author": {"@type":"Organization","name":"Jogos Mods Global"}
                });
                document.head.appendChild(schema);
            })(mod);

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
                            a.setAttribute("data-mod-id", mod.id);
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

            // Patches de tradução: arquivos pequenos e separados do mod original.
            if (Array.isArray(mod.translationPatches) && mod.translationPatches.length) {
                var patchStyle = document.createElement("style");
                patchStyle.textContent = ".translation-patches{margin:24px 0;padding:18px;border:1px solid #344956;border-radius:13px;background:#101922}.translation-patches h2{margin:0 0 5px;color:#b8edf0}.translation-patches .patch-subtitle{color:#9eabba;font-size:12px;margin:0 0 14px}.translation-patch-card{padding:13px;margin:9px 0;border:1px solid #344956;border-radius:10px;background:#0b141d}.translation-patch-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.translation-patch-head strong{color:#eaf3f5}.translation-patch-meta{color:#9eabba;font-size:12px;line-height:1.7;margin:8px 0}.translation-patch-install{white-space:pre-wrap;color:#c4ceda;font-size:12px;line-height:1.6;margin:8px 0}.translation-patch-card a{display:inline-block;margin-top:4px}";
                document.head.appendChild(patchStyle);
                var patchSection = document.createElement("section");
                patchSection.className = "translation-patches";
                var patchTitle = document.createElement("h2");
                patchTitle.textContent = "🌐 Traduções e patches";
                patchSection.appendChild(patchTitle);
                var patchIntro = document.createElement("p");
                patchIntro.className = "patch-subtitle";
                patchIntro.textContent = "Baixe o mod original acima e aplique somente o patch do idioma desejado.";
                patchSection.appendChild(patchIntro);
                var patchLanguageLabels = {"pt-BR":"🇧🇷 Português (Brasil)","en":"🇺🇸 English","es":"🇪🇸 Español","fr":"🇫🇷 Français","de":"🇩🇪 Deutsch","it":"🇮🇹 Italiano","ja":"🇯🇵 日本語","ru":"🇷🇺 Русский","zh":"🇨🇳 中文","pl":"🇵🇱 Polski","other":"🌐 Outro idioma"};
                mod.translationPatches.forEach(function(patch) {
                    if (!patch || !/^https?:\/\//i.test(String(patch.link || ""))) return;
                    var card = document.createElement("article");
                    card.className = "translation-patch-card";
                    var head = document.createElement("div");
                    head.className = "translation-patch-head";
                    var language = document.createElement("strong");
                    language.textContent = patchLanguageLabels[patch.language] || ("🌐 " + String(patch.language || "Tradução"));
                    head.appendChild(language);
                    if (patch.version) { var version = document.createElement("span"); version.className = "badge-mod-atualizado"; version.textContent = "Patch " + patch.version; head.appendChild(version); }
                    card.appendChild(head);
                    var meta = [];
                    if (patch.compatibleVersion) meta.push("Compatível com mod " + patch.compatibleVersion);
                    if (patch.size) meta.push("Tamanho: " + patch.size);
                    if (patch.author) meta.push("Tradutor: " + patch.author);
                    if (patch.updatedAt) { var date = new Date(patch.updatedAt); if (!isNaN(date.getTime())) meta.push("Atualizado: " + date.toLocaleDateString("pt-BR")); }
                    if (meta.length) { var metaNode = document.createElement("p"); metaNode.className = "translation-patch-meta"; metaNode.textContent = meta.join(" · "); card.appendChild(metaNode); }
                    if (patch.instructions) { var instructions = document.createElement("p"); instructions.className = "translation-patch-install"; instructions.textContent = "Instalação: " + patch.instructions; card.appendChild(instructions); }
                    var link = document.createElement("a"); link.className = "download"; link.textContent = "Baixar patch " + (patchLanguageLabels[patch.language] || patch.language || "de tradução"); link.href = patch.link; link.target = "_blank"; link.rel = "noopener noreferrer"; card.appendChild(link);
                    patchSection.appendChild(card);
                });
                if (patchSection.children.length > 2) { var details = document.querySelector(".info-mod"); if (details) details.appendChild(patchSection); }
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

            var videoSection = document.getElementById("video-mod");
            var videoFrameHost = document.getElementById("video-mod-frame");
            if (videoSection && videoFrameHost && mod.videoYoutube) {
                var videoId = String(mod.videoYoutube).trim();
                if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
                    try {
                        var videoUrl = new URL(videoId);
                        if (/(^|\.)youtu\.be$/i.test(videoUrl.hostname)) videoId = videoUrl.pathname.split("/").filter(Boolean)[0] || "";
                        else if (/(^|\.)youtube\.com$/i.test(videoUrl.hostname)) videoId = videoUrl.searchParams.get("v") || ((videoUrl.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/) || [])[1] || "");
                        else videoId = "";
                    } catch (e) { videoId = ""; }
                }
                if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
                    var iframe = document.createElement("iframe");
                    iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId);
                    iframe.title = "Vídeo do mod " + (mod.nome || "");
                    iframe.loading = "lazy";
                    iframe.referrerPolicy = "strict-origin-when-cross-origin";
                    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
                    iframe.allowFullscreen = true;
                    iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0";
                    videoFrameHost.appendChild(iframe);
                    videoSection.style.display = "block";
                }
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
    // Faz uma segunda leitura independente após a renderização inicial e ao restaurar a página.
    sincronizarTotalDownloadsPersistido();
    window.setTimeout(sincronizarTotalDownloadsPersistido, 2000);
    window.addEventListener("pageshow", sincronizarTotalDownloadsPersistido);

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
    if (ultimos) {
        ultimos.innerHTML = "";
        function dataRecente(mod) {
            var raw = mod.created_at || mod.createdAt || mod.submittedAt || mod.published_at || "";
            var parsed = Date.parse(raw);
            if (!isNaN(parsed)) return parsed;
            var numericId = Number(mod.id) || 0;
            if (numericId > 100000000000) return numericId;
            var date = String(mod.data || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            return date ? new Date(Number(date[3]),Number(date[2])-1,Number(date[1])).getTime() : 0;
        }
        catalogoMods.slice().sort(function(a,b) { return dataRecente(b)-dataRecente(a) || Number(b.id)-Number(a.id); }).slice(0,3).forEach(function(mod) {
            var community = !!mod.__community;
            var img = String(mod.imagem || "").replace("../", "");
            var href = community ? "mod-comunidade.html?id=" + encodeURIComponent(mod.id) : "mods/mod.html?id=" + encodeURIComponent(mod.id);
            var wrap = document.createElement("div"); wrap.className = "ultimo-card";
            var image = document.createElement("img"); image.src = img; image.alt = mod.nome || "Mod"; image.loading = "lazy"; image.decoding = "async"; wrap.appendChild(image);
            var info = document.createElement("div"); info.className = "ultimo-info";
            var cat = document.createElement("span"); cat.className = "categoria"; cat.textContent = (community ? "Comunidade · " : "Administração · ") + labelCategoria(mod); info.appendChild(cat);
            var title = document.createElement("h3"); title.textContent = mod.nome || "Mod"; info.appendChild(title);
            var desc = document.createElement("p"); desc.textContent = String(mod.descricao || "").substring(0,90) + "..."; info.appendChild(desc);
            var link = document.createElement("a"); link.href = href; link.textContent = "Ler mais →"; info.appendChild(link);
            wrap.appendChild(info); ultimos.appendChild(wrap);
        });
    }
    var elUpdate = document.getElementById("stat-update");
    function parseDataEstatistica(value) {
        if (value === null || value === undefined || value === "") return 0;
        if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
            var numeric = Number(value);
            return numeric < 100000000000 ? numeric * 1000 : numeric;
        }
        var text = String(value).trim();
        var br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (br) return new Date(Number(br[3]), Number(br[2])-1, Number(br[1])).getTime();
        var parsed = Date.parse(text);
        return isNaN(parsed) ? 0 : parsed;
    }
    function atualizarDataUltimaAtualizacao(lista, overrides) {
        if (!elUpdate) return;
        var latest = 0;
        (lista || []).forEach(function(mod) {
            [mod.updated_at, mod.updatedAt, mod.created_at, mod.createdAt, mod.published_at, mod.submittedAt, mod.data].forEach(function(value) {
                latest = Math.max(latest, parseDataEstatistica(value));
            });
        });
        var entries = overrides && overrides.items ? overrides.items : {};
        if (Array.isArray(entries)) {
            entries.forEach(function(entry) {
                latest = Math.max(latest, parseDataEstatistica(entry.updatedAt || entry.updated_at));
                var payload = entry.mod || entry;
                [payload.updated_at, payload.updatedAt, payload.data].forEach(function(value) {
                    latest = Math.max(latest, parseDataEstatistica(value));
                });
            });
        } else {
            Object.keys(entries).forEach(function(id) {
                var entry = entries[id] || {};
                latest = Math.max(latest, parseDataEstatistica(entry.updatedAt || entry.updated_at));
                var payload = entry.mod || entry;
                [payload.updated_at, payload.updatedAt, payload.created_at, payload.data].forEach(function(value) {
                    latest = Math.max(latest, parseDataEstatistica(value));
                });
            });
        }
        if (latest) {
            var date = new Date(latest);
            elUpdate.textContent = new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"2-digit",year:"numeric"}).format(date);
        }
    }
    atualizarDataUltimaAtualizacao(catalogoMods, overrideData);

    // Atualiza os indicadores sem recarregar a página; pausa quando a aba está em segundo plano.
    var homeStatsRefreshBusy = false;
    async function atualizarEstatisticasAoVivo() {
        if (homeStatsRefreshBusy || document.hidden || !document.getElementById("stats-bar")) return;
        homeStatsRefreshBusy = true;
        try {
            var fresh = await Promise.all([
                fetch((window.PS3MODS_API_URL || "") + "/api/mods", {cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("mods HTTP "+r.status);return r.json();}),
                fetch((window.PS3MODS_API_URL || "") + "/api/legacy-overrides", {cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("overrides HTTP "+r.status);return r.json();}),
                fetch((window.PS3MODS_API_URL || "") + "/api/download-counts", {cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("downloads HTTP "+r.status);return r.json();})
            ]);
            var freshCommunity = Array.isArray(fresh[0].items) ? fresh[0].items : [];
            var freshOverrides = fresh[1] || {items:{}};
            var freshCounts = fresh[2] && fresh[2].counts ? fresh[2].counts : {};
            var freshTotalDownloads = Number(fresh[2] && fresh[2].total);
            comunidadeMods = freshCommunity;
            catalogoMods = (typeof mods !== "undefined" ? mods.slice() : []).concat(freshCommunity.map(function(item){var mod=Object.assign({},item);mod.__community=true;return mod;}));
            if (typeof mods !== "undefined") {
                var overrideEntries = freshOverrides.items || {};
                if (Array.isArray(overrideEntries)) {
                    overrideEntries.forEach(function(entry) {
                        var target = mods.find(function(item){return Number(item.id)===Number(entry.id);});
                        if (target) Object.assign(target, entry.mod || entry);
                    });
                } else {
                    Object.keys(overrideEntries).forEach(function(id) {
                        var target = mods.find(function(item){return Number(item.id)===Number(id);});
                        if (target) Object.assign(target, overrideEntries[id].mod || overrideEntries[id]);
                    });
                }
            }
            downloadCounts = freshCounts;
            totalDownloads = Number.isFinite(freshTotalDownloads)
                ? Math.max(0, freshTotalDownloads)
                : somarContagensDownloads(downloadCounts);
            window.PS3MODS_DOWNLOAD_COUNTS = downloadCounts;
            var totalModsEl = document.getElementById("stat-mods");
            if (totalModsEl) totalModsEl.textContent = catalogoMods.length;
            atualizarContagensDownloads();
            atualizarDataUltimaAtualizacao(catalogoMods, freshOverrides);
        } catch (error) {
            console.warn("Não foi possível atualizar os indicadores da página inicial:", error);
        } finally {
            homeStatsRefreshBusy = false;
        }
    }
    if (document.getElementById("stats-bar")) {
        window.setInterval(atualizarEstatisticasAoVivo, 60000);
        document.addEventListener("visibilitychange", function() {
            if (!document.hidden) atualizarEstatisticasAoVivo();
        });
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
