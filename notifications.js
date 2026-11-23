(function(){
"use strict";
function init(){
 if(document.getElementById("ps3-notification-root"))return;
 var API="https://ps3modsglobal-community-api.madarauchiha76189.workers.dev";
 var header=document.querySelector("header.topo .container")||document.querySelector("header .container")||document.querySelector("header");
 if(!header){console.warn("[PS3 notifications] Cabeçalho não encontrado.");return;}
 var style=document.createElement("style");
 style.textContent=".ps3-notification-root{position:relative;display:inline-flex;vertical-align:middle;margin:6px 4px;z-index:1000}.ps3-notification-bell{position:relative;border:1px solid #40516a;border-radius:10px;background:#151e2b;color:#f2f6fc;padding:9px 12px;font-size:20px;line-height:1.2;cursor:pointer}.ps3-notification-count{position:absolute;top:-6px;right:-6px;min-width:17px;height:17px;padding:0 4px;border-radius:10px;background:#d83d54;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center}.ps3-notification-count[hidden]{display:none}.ps3-notification-panel{position:fixed;z-index:99999;top:120px;right:14px;width:min(340px,calc(100vw - 28px));max-height:420px;overflow:auto;background:#101722;border:1px solid #344055;border-radius:12px;box-shadow:0 12px 35px #0008;padding:12px;color:#edf3fa}.ps3-notification-panel[hidden]{display:none}.ps3-notification-item{display:block;padding:10px 4px;border-top:1px solid #2a3749;color:inherit;text-decoration:none}.ps3-notification-item strong,.ps3-notification-item span,.ps3-notification-item time{display:block}.ps3-notification-item span{font-size:12px;color:#c1ccda;margin-top:4px}.ps3-notification-item time{font-size:10px;color:#8d9bb0;margin-top:5px}.ps3-push-toggle{width:100%;margin:10px 0 4px;padding:9px;border:1px solid #40516a;border-radius:8px;background:#182638;color:#dceeff;font-weight:700;cursor:pointer}.ps3-push-status{font-size:11px;color:#9eabba;margin:4px 0 8px}";
 document.head.appendChild(style);
 var root=document.createElement("div");root.id="ps3-notification-root";root.className="ps3-notification-root";
 var bell=document.createElement("button");bell.type="button";bell.className="ps3-notification-bell";bell.setAttribute("aria-label","Abrir notificações");bell.title="Notificações";bell.textContent="🔔";
 var count=document.createElement("span");count.className="ps3-notification-count";count.hidden=true;bell.appendChild(count);
 var panel=document.createElement("section");panel.className="ps3-notification-panel";panel.hidden=true;
 var heading=document.createElement("strong");heading.textContent="Notificações";
 var push=document.createElement("button");push.type="button";push.className="ps3-push-toggle";push.textContent="Ativar notificações no celular";
 var status=document.createElement("p");status.className="ps3-push-status";status.textContent="Receba avisos mesmo quando não estiver com o site aberto.";
 var list=document.createElement("div");list.textContent="Carregando notificações...";
 panel.append(heading,push,status,list);root.append(bell);document.body.appendChild(panel);
 var nav=header.querySelector("nav");if(nav)nav.appendChild(root);else header.appendChild(root);
 var storageKey="ps3mods_notifications_last_seen";
 function bytes(v){var s=v.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
 async function load(){
  try{var res=await fetch(API+"/api/notifications",{cache:"no-store"});if(!res.ok)throw Error("HTTP "+res.status);var data=await res.json(),items=Array.isArray(data.items)?data.items:[],seen=Number(localStorage.getItem(storageKey)||0),highest=items.reduce(function(m,x){return Math.max(m,Number(x.id)||0);},0),unread=items.filter(function(x){return Number(x.id)>seen;}).length;
   count.textContent=unread>9?"9+":String(unread);count.hidden=!unread;list.innerHTML="";
   if(!items.length){list.textContent="Nenhuma notificação por enquanto.";}else items.forEach(function(item){var a=document.createElement("a");a.className="ps3-notification-item";a.href=item.url||"/";var t=document.createElement("strong");t.textContent=item.title||"Aviso";var b=document.createElement("span");b.textContent=item.body||"";var d=document.createElement("time");d.textContent=item.createdAt?new Date(item.createdAt).toLocaleString("pt-BR"):"";a.append(t,b,d);list.appendChild(a);});
   panel.dataset.maxId=String(highest);
  }catch(e){list.textContent="Não foi possível carregar. Tente novamente.";console.error("[PS3 notifications]",e);}
 }
 async function pushState(){try{if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window)){push.disabled=true;push.textContent="Push não disponível neste navegador";return;}var reg=await navigator.serviceWorker.getRegistration("/push/"),sub=reg&&await reg.pushManager.getSubscription();push.textContent=sub?"Desativar notificações push":"Ativar notificações no celular";}catch(e){}}
 async function togglePush(){push.disabled=true;try{var kr=await fetch(API+"/api/push/public-key",{cache:"no-store"}),kd=await kr.json();if(!kr.ok||!kd.enabled||!kd.publicKey)throw Error(kd.reason||"Notificações push ainda não estão configuradas no servidor.");var reg=await navigator.serviceWorker.register("/push/push-sw.js",{scope:"/push/"}),sub=await reg.pushManager.getSubscription();if(sub){await fetch(API+"/api/push/subscribe",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe();status.textContent="Notificações desativadas neste aparelho.";push.textContent="Ativar notificações no celular";return;}var permission=await Notification.requestPermission();if(permission!=="granted")throw Error("Permissão de notificação não concedida.");sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(kd.publicKey)});var saved=await fetch(API+"/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subscription:sub.toJSON()})});if(!saved.ok)throw Error("Não foi possível registrar este aparelho.");status.textContent="Notificações ativadas neste aparelho.";push.textContent="Desativar notificações push";}catch(e){status.textContent=e.message||"Erro ao ativar notificações.";console.error(e);}finally{push.disabled=false;}}
 bell.addEventListener("click",function(){panel.hidden=!panel.hidden;if(!panel.hidden){panel.style.top=Math.max(8,header.getBoundingClientRect().bottom+8)+"px";load();pushState();}});
 push.addEventListener("click",togglePush);
 panel.addEventListener("click",function(e){if(e.target.closest("a")){localStorage.setItem(storageKey,panel.dataset.maxId||"0");count.hidden=true;}});
 document.addEventListener("click",function(e){if(!root.contains(e.target)&&!panel.contains(e.target))panel.hidden=true;});
 load();setInterval(load,120000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();