document.addEventListener("DOMContentLoaded", function() {

    var POR_PAGINA = 20;
    var paginaAtual = 1;
    var listaAtual = [];
    var containerLista = null;
    var listaBase = [];

    // ===== FAVORITOS =====
    function getFavoritos() {
        try { return JSON.parse(localStorage.getItem("ps3mods_favoritos") || "[]"); }
        catch(e) { return []; }
    }
    function salvarFavoritos(lista) {
        localStorage.setItem("ps3mods_favoritos", JSON.stringify(lista));
    }
    window.toggleFavorito = function(id) {
        var favs = getFavoritos();
        id = parseInt(id);
        var index = favs.indexOf(id);
        if (index === -1) favs.push(id);
        else favs.splice(index, 1);
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

    // ===== CATEGORIA / ARMADURA F-M =====
    function labelCategoria(mod) {
        if (mod.genero === "Ambos" || (mod.categorias && mod.categorias.length > 1)) {
            return "Armaduras (F/M)";
        }
        return mod.categoria || "";
    }

    function matchCategoria(mod, categoria) {
        var busca = categoria.toLowerCase();
        var cat = (mod.categoria || "").toLowerCase();
        if (cat.indexOf(busca) !== -1 || busca.indexOf(cat) !== -1) return true;
        if (mod.categorias && mod.categorias.some(function(c) {
            return String(c).toLowerCase().indexOf(busca) !== -1;
        })) return true;
        if (busca.indexOf("armadura") !== -1 && (mod.genero === "Ambos" || cat === "armaduras")) return true;
        if (busca === "followers" && cat.indexOf("companion") !== -1) return true;
        return false;
    }

    // ===== CONTAGEM POR CATEGORIA =====
    function contarCategorias() {
        var contagem = {};
        if (typeof mods === "undefined") return contagem;
        mods.forEach(function(mod) {
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
        var total = 0;
        Object.keys(contagem).forEach(function(nome) {
            if (nome.toLowerCase() === busca) total = contagem[nome];
        });
        return total;
    }

    function aplicarContagemCategorias() {
        if (typeof mods === "undefined") return;
        var contagem = contarCategorias();

        document.querySelectorAll("a[href*='categoria=']").forEach(function(a) {
            try {
                var url = new URL(a.href, window.location.href);
                var cat = url.searchParams.get("categoria");
                if (!cat) return;
                var qtd = qtdDaCategoria(contagem, cat);
                var base = a.textContent.replace(/\s*\(\d+\)\s*$/, "").trim();
                if (a.querySelector("small")) {
                    base = (a.childNodes[0] && a.childNodes[0].textContent || base).replace(/\s*\(\d+\)\s*$/, "").trim();
                }
                if (a.closest(".categorias-grid")) {
                    a.innerHTML = base + "<br><small style='opacity:.7;font-weight:500'>" + qtd + " mod" + (qtd === 1 ? "" : "s") + "</small>";
                } else {
                    a.textContent = base + " (" + qtd + ")";
                }
            } catch(e) {}
        });

        var stats = document.querySelectorAll("#stats-bar .stat-item strong");
        if (stats && stats[1]) {
            var unicas = {};
            mods.forEach(function(m) {
                if (m.categoria) unicas[m.categoria] = true;
                if (m.categorias) m.categorias.forEach(function(c) { unicas[c] = true; });
            });
            if (unicas["Armaduras"] && (unicas["Armaduras Femininas"] || unicas["Armaduras Masculinas"])) {
                delete unicas["Armaduras"];
            }
            stats[1].textContent = Object.keys(unicas).length;
        }
    }

    // ===== PAGINAÇÃO =====
    function garantirBotaoMais() {
        var btn = document.getElementById("btn-carregar-mais");
        if (btn) return btn;
        if (!containerLista || !containerLista.parentNode) return null;

        var wrap = document.createElement("div");
        wrap.id = "wrap-carregar-mais";
        wrap.style.cssText = "grid-column:1/-1;text-align:center;padding:24px 10px 10px;";

        btn = document.createElement("button");
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
        return btn;
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
        var card = document.createElement("div");
        card.className = "card-mod";
        card.innerHTML =
            '<img src="' + mod.imagem + '" alt="' + mod.nome + '" loading="lazy" decoding="async">' +
            '<span class="categoria">' + labelCategoria(mod) + '</span>' +
            '<h3>' + mod.nome + '</h3>' +
            '<p>' + mod.descricao + '</p>' +
            '<a class="download" href="mod.html?id=' + mod.id + '">Ver Mod</a>' +
            '<button class="btn-fav" data-fav="' + mod.id + '" onclick="toggleFavorito(' + mod.id + ')">☆ Favoritar</button>';
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
    }

    function renderMods(listaMods, container) {
        containerLista = container;
        listaAtual = listaMods.slice();
        renderPagina(true);
    }

    // ===== BUSCA AVANÇADA =====
    function montarBuscaAvancada() {
        if (!containerLista) return;
        if (document.getElementById("busca-avancada")) return;

        var host = containerLista.parentNode;
        if (!host) return;

        var box = document.createElement("div");
        box.id = "busca-avancada";
        box.style.cssText = "grid-column:1/-1;background:#121821;border:1px solid #1c2330;border-radius:12px;padding:14px;margin-bottom:16px;";

        box.innerHTML =
            '<div style="font-size:14px;color:#5ec8ff;font-weight:700;margin-bottom:10px;">Busca avançada</div>' +
            '<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px;">' +
                '<div>' +
                    '<label style="display:block;font-size:12px;color:#8b95a5;margin-bottom:4px;">Texto</label>' +
                    '<input id="ba-texto" type="text" placeholder="Nome, descrição, autor..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #2a3344;background:#0e131b;color:#e8eaed;">' +
                '</div>' +
                '<div>' +
                    '<label style="display:block;font-size:12px;color:#8b95a5;margin-bottom:4px;">Categoria</label>' +
                    '<select id="ba-cat" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2a3344;background:#0e131b;color:#e8eaed;">' +
                        '<option value="">Todas</option>' +
                    '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="display:block;font-size:12px;color:#8b95a5;margin-bottom:4px;">Ordenar</label>' +
                    '<select id="ba-ordem" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2a3344;background:#0e131b;color:#e8eaed;">' +
                        '<option value="recentes">Mais recentes</option>' +
                        '<option value="antigos">Mais antigos</option>' +
                        '<option value="az">A–Z</option>' +
                        '<option value="za">Z–A</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px;">' +
                '<div>' +
                    '<label style="display:block;font-size:12px;color:#8b95a5;margin-bottom:4px;">Gênero (armaduras)</label>' +
                    '<select id="ba-genero" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2a3344;background:#0e131b;color:#e8eaed;">' +
                        '<option value="">Qualquer</option>' +
                        '<option value="Feminino">Feminino</option>' +
                        '<option value="Masculino">Masculino</option>' +
                        '<option value="Ambos">Ambos (F/M)</option>' +
                    '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="display:block;font-size:12px;color:#8b95a5;margin-bottom:4px;">Casamento</label>' +
                    '<select id="ba-casamento" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2a3344;background:#0e131b;color:#e8eaed;">' +
                        '<option value="">Qualquer</option>' +
                        '<option value="sim">Sim</option>' +
                        '<option value="nao">Não</option>' +
                    '</select>' +
                '</div>' +
                '<div style="display:flex;align-items:flex-end;gap:8px;">' +
                    '<button type="button" id="ba-filtrar" style="flex:1;padding:11px;border:none;border-radius:8px;background:#5ec8ff;color:#0b0e14;font-weight:700;cursor:pointer;">Filtrar</button>' +
                    '<button type="button" id="ba-limpar" style="flex:1;padding:11px;border:1px solid #2a3a50;border-radius:8px;background:#1a2230;color:#8b95a5;font-weight:700;cursor:pointer;">Limpar</button>' +
                '</div>' +
            '</div>' +
            '<p id="ba-info" style="margin-top:10px;color:#8b95a5;font-size:12px;"></p>';

        // inserir antes da lista
        host.insertBefore(box, containerLista);

        // preencher categorias
        var sel = document.getElementById("ba-cat");
        var cats = {};
        if (typeof mods !== "undefined") {
            mods.forEach(function(m) {
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

        // se URL ja tem categoria, preselect
        var params = new URLSearchParams(window.location.search);
        var catUrl = params.get("categoria");
        if (catUrl) {
            for (var i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value.toLowerCase() === catUrl.toLowerCase()) {
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

            if (cat) {
                result = result.filter(function(m) { return matchCategoria(m, cat); });
            }
            if (texto) {
                result = result.filter(function(m) {
                    var blob = (m.nome + " " + m.descricao + " " + (m.autor || "") + " " + (m.classe || "") + " " + (m.localizacao || "")).toLowerCase();
                    return blob.indexOf(texto) !== -1;
                });
            }
            if (genero) {
                result = result.filter(function(m) {
                    var g = (m.genero || "").toLowerCase();
                    if (genero === "Ambos") return g === "ambos" || (m.categorias && m.categorias.length > 1);
                    return g === genero.toLowerCase();
                });
            }
            if (casamento) {
                result = result.filter(function(m) {
                    var c = String(m.casamento || "").toLowerCase();
                    if (casamento === "sim") return c.indexOf("sim") !== -1;
                    if (casamento === "nao") return c.indexOf("não") !== -1 || c.indexOf("nao") !== -1;
                    return true;
                });
            }

            if (ordem === "recentes") result.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
            if (ordem === "antigos") result.sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
            if (ordem === "az") result.sort(function(a, b) { return String(a.nome || "").localeCompare(String(b.nome || "")); });
            if (ordem === "za") result.sort(function(a, b) { return String(b.nome || "").localeCompare(String(a.nome || "")); });

            document.getElementById("ba-info").textContent = result.length + " mod" + (result.length === 1 ? "" : "s") + " encontrado" + (result.length === 1 ? "" : "s");
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

        // filtrar ao pressionar Enter no texto
        document.getElementById("ba-texto").addEventListener("keydown", function(e) {
            if (e.key === "Enter") aplicarFiltroAvancado();
        });
    }

    // ===== LISTA DE MODS =====
    var lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista && typeof mods !== "undefined") {
        var params = new URLSearchParams(window.location.search);
        var categoria = params.get("categoria");
        if (categoria) {
            listaBase = mods.filter(function(m) { return matchCategoria(m, categoria); });
            var titulo = document.querySelector(".hero-content h2, .banner-pequeno h2");
            if (titulo) titulo.textContent = categoria;
        } else {
            listaBase = mods.slice();
        }
        renderMods(listaBase, lista);
        montarBuscaAvancada();
    }

    // ===== PAGINA DO MOD =====
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
                    ["localizacao", "Localização"],
                    ["classe", "Classe"],
                    ["genero", "Gênero"],
                    ["tipo", "Tipo"],
                    ["forjavel", "Forjável"],
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
                    ["inicio", "Início"],
                    ["npc", "NPC"],
                    ["duracao", "Duração"],
                    ["hostil", "Hostil"],
                    ["domesticavel", "Domest
