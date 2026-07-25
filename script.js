document.addEventListener("DOMContentLoaded", function() {

    // Lista de mods
    const lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista) {
        lista.innerHTML = '';
        mods.forEach(mod => {
            lista.innerHTML += `
                <div class="card-mod">
                    <img src="${mod.imagem}" alt="${mod.nome}">
                    <h3>${mod.nome}</h3>
                    <p>${mod.descricao}</p>
                    <a class="download" href="mod.html?id=${mod.id}">Ver Mod</a>
                </div>
            `;
        });
    }

    // Detalhes do mod
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'));
    if (id) {
        const mod = mods.find(m => m.id === id);
        if (mod) {
            document.getElementById('nome').textContent = mod.nome;
            document.getElementById('titulo-mod').textContent = mod.nome;
            document.getElementById('descricao').textContent = mod.descricao;
            document.getElementById('categoria-mod').textContent = mod.categoria;
            document.getElementById('capa').src = mod.imagem.replace('../', '');

            const download = document.getElementById('download');
            if (download) download.href = mod.download;

            const galeria = document.getElementById('galeria');
            if (galeria) {
                galeria.innerHTML = mod.galeria.map(src => `<img src="${src.replace('../', '')}" alt="${mod.nome}">`).join('');
            }
        }
    }
});
// Pesquisa simples
const searchInput = document.querySelector('.search input');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const termo = this.value.toLowerCase();
        const cards = document.querySelectorAll('.card-mod, .card-home');
        cards.forEach(card => {
            const texto = card.textContent.toLowerCase();
            card.style.display = texto.includes(termo) ? '' : 'none';
        });
    });
}
