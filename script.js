document.addEventListener("DOMContentLoaded", function() {

    // Função para renderizar lista de mods
    function renderMods(listaMods, container) {
        if (!container) return;
        container.innerHTML = '';
        if (listaMods.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;padding:40px;">Nenhum mod encontrado nesta categoria.</p>';
            return;
        }
        listaMods.forEach(mod => {
            container.innerHTML += `
                <div class="card-mod">
                    <img src="\( {mod.imagem}" alt=" \){mod.nome}">
                    <h3>${mod.nome}</h3>
                    <p>${mod.descricao}</p>
                    <a class="download" href="mod.html?id=${mod.id}">Ver Mod</a>
                </div>
            `;
        });
    }

    // Página de todos os mods
    const lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista) {
        const params = new URLSearchParams(window.location.search);
        const categoria = params.get('categoria');
        
        if (categoria) {
            const filtrados = mods.filter(m => 
                m.categoria.toLowerCase().includes(categoria.toLowerCase()) ||
                (categoria.toLowerCase() === 'followers' && m.categoria.toLowerCase().includes('companion'))
            );
            renderMods(filtrados, lista);
            
            const titulo = document.querySelector('.hero-content h2, .banner-pequeno h2');
            if (titulo) titulo.textContent = categoria;
        } else {
            renderMods(mods, lista);
        }
    }

    // Página de detalhes do mod
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'));
    if (id && document.getElementById("titulo-mod")) {
        const mod = mods.find(m => m.id === id);
        if (mod) {
            document.getElementById('nome').textContent = mod.nome;
            document.getElementById('titulo-mod').textContent = mod.nome;
            document.getElementById('descricao').textContent = mod.descricao;
            document.getElementById('categoria-mod').textContent = mod.categoria;

            // Capa
            const capa = document.getElementById('capa');
            if (capa) {
                capa.src = mod.imagem;
                capa.alt = mod.nome;
            }

            // Download
            const download = document.getElementById('download');
            if (download) download.href = mod.download;

            // Galeria
            const galeria = document.getElementById('galeria');
            if (galeria && mod.galeria) {
                galeria.innerHTML = '';
                mod.galeria.forEach(src => {
                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = mod.nome;
                    galeria.appendChild(img);
                });
            }
        }
    }

    // Pesquisa
    const searchInput = document.querySelector('.search input, #pesquisa');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const termo = this.value.toLowerCase().trim();
            const cards = document.querySelectorAll('.card-mod, .card-home');
            cards.forEach(card => {
                const texto = card.textContent.toLowerCase();
                card.style.display = (termo === '' || texto.includes(termo)) ? '' : 'none';
            });
        });
    }
});
