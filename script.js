document.addEventListener("DOMContentLoaded", function() {

    // Lista de mods
    const lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista) {
        lista.innerHTML = '';
        mods.forEach(mod => {
            lista.innerHTML += `
                <div class="card-mod">
                    <img src="\( {mod.imagem}" alt=" \){mod.nome}">
                    <h3>${mod.nome}</h3>
                    <p>${mod.descricao}</p>
                    <a class="download" href="mod.html?id=${mod.id}">Ver Mod</a>
                </div>
            `;
        });
    }

    // Página do mod individual
    const urlParams = new URLSearchParams(window.location.search);
    const modId = parseInt(urlParams.get('id'));
    if (modId && document.getElementById("titulo-mod")) {
        const mod = mods.find(m => m.id === modId);
        if (mod) {
            document.getElementById("nome").textContent = mod.nome;
            document.getElementById("titulo-mod").textContent = mod.nome;
            document.getElementById("descricao").textContent = mod.descricao;
            document.getElementById("categoria-mod").textContent = mod.categoria;
            document.getElementById("capa").src = mod.imagem;

            const downloadBtn = document.getElementById("download");
            if (downloadBtn) downloadBtn.href = mod.download;

            const galeria = document.getElementById("galeria");
            if (galeria && mod.galeria) {
                galeria.innerHTML = mod.galeria.map(src => `<img src="\( {src}" alt=" \){mod.nome}">`).join('');
            }
        }
    }
});
