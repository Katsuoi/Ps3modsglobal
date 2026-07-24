document.addEventListener("DOMContentLoaded", function(){

const lista = document.getElementById("todos-mods");

if(!lista){
    console.log("Lista não encontrada");
    return;
}


mods.forEach(function(mod){

lista.innerHTML += `

<div class="card-mod">

<img src="${mod.imagem}">

<h3>${mod.nome}</h3>

<p>${mod.descricao}</p>

<a class="download" href="mod.html?id=${mod.id}">
Ver Mod
</a>

</div>

`;

});


});
