document.addEventListener("DOMContentLoaded", function() {

    // Lista de mods
    const lista = document.getElementById("todos-mods") || document.getElementById("lista-mods");
    if (lista) {
        lista.innerHTML = '';
        mods.forEach(function(mod) {
            lista.innerHTML += `
                <div class="card-mod">
                    <img src="${mod.imagem}">
                    <h3>${mod.nome}</h3>
                    <p>${mod.descricao}</p>
                    <a class="download" href="mod.html?id=${mod.id}">Ver Mod</a>
                </div>
            `;
        });
    }

    // Detalhes do mod
    const urlParams = new URLSearchParams(window.location.search);
    const modId = parseInt(urlParams.get('id'));

    if (modId && document.getElementById("titulo-mod")) {
        const mod = mods.find(m => m.id === modId);
        if (mod) {
            document.getElementById("nome").textContent = mod.nome;
            document.getElementById("titulo-mod").textContent = mod.nome;
            document.getElementById("descricao").textContent = mod.descricao;
            document.getElementById("categoria-mod").textContent = mod.categoria;

            if (document.getElementById("capa")) document.getElementById("capa").src = mod.imagem;

            const downloadBtn = document.getElementById("download");
            if (downloadBtn) downloadBtn.href = mod.download;

            // Galeria
            const galeria = document.getElementById("galeria");
            if (galeria && mod.galeria) {
                galeria.innerHTML = '';
                mod.galeria.forEach(src => {
                    const img = document.createElement('img');
                    img.src = src;
                    galeria.appendChild(img);
                });
            }
        }
    }
});
