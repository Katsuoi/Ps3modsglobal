(function(){
  async function post(api,path,body,bearer){
    var headers={"Content-Type":"application/json"};
    if(bearer)headers.Authorization="Bearer "+bearer;
    var response=await fetch(api+path,{method:"POST",headers:headers,body:JSON.stringify(body||{})});
    var data={};try{data=await response.json()}catch(_){}
    if(!response.ok)throw new Error(data.error||"Falha na autenticação.");
    return data;
  }
  async function begin(api,password,onAuthenticated,onError){
    var old=document.getElementById("ps3-mfa-panel");
    if(old)old.remove();
    try{
      var auth=await post(api,"/api/admin/login",{password:password});
      var setup=!!auth.setupRequired,challenge=setup?auth.setupToken:auth.challengeToken;
      if(!challenge)throw new Error("O servidor não retornou o desafio de autenticação.");
      var secret="",otpauth="";
      if(setup){
        var init=await post(api,"/api/admin/2fa/setup",{},challenge);
        secret=init.secret;otpauth=init.otpauth||"";
      }else if(!auth.requires2fa){
        throw new Error("Resposta de autenticação inesperada.");
      }
      var panel=document.createElement("section");
      panel.id="ps3-mfa-panel";panel.className="panel";
      panel.style.marginTop="14px";
      var heading=document.createElement("h2");
      heading.textContent=setup?"Ative a verificação em duas etapas":"Confirme sua identidade";
      panel.appendChild(heading);
      var info=document.createElement("p");
      info.className="muted";
      info.textContent=setup
        ?"Abra o Google Authenticator, Microsoft Authenticator ou outro aplicativo compatível com códigos TOTP. Adicione uma conta manualmente usando o segredo abaixo. Nome sugerido: PS3ModsGlobal — Katsuo."
        :"Digite o código de 6 dígitos exibido no aplicativo autenticador da conta Katsuo. Cada código muda a cada 30 segundos.";
      panel.appendChild(info);
      if(setup){
        var secretLabel=document.createElement("p");secretLabel.textContent="Chave secreta (mantenha em sigilo):";panel.appendChild(secretLabel);
        var secretBox=document.createElement("pre");secretBox.textContent=secret;secretBox.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;background:#0b1018;padding:12px;border-radius:8px;color:#8bd8ff;user-select:all";panel.appendChild(secretBox);
        var uriDetails=document.createElement("details");
        var uriSummary=document.createElement("summary");uriSummary.textContent="Mostrar URI de configuração manual";uriDetails.appendChild(uriSummary);
        var uriBox=document.createElement("pre");uriBox.textContent=otpauth;uriBox.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere";uriDetails.appendChild(uriBox);panel.appendChild(uriDetails);
      }
      var label=document.createElement("label");label.textContent="Código de autenticação";label.style.display="block";label.style.marginTop="12px";panel.appendChild(label);
      var code=document.createElement("input");code.type="text";code.inputMode="numeric";code.autocomplete="one-time-code";code.maxLength=12;code.placeholder="000000";code.style.cssText="display:block;box-sizing:border-box;width:100%;max-width:300px;padding:12px;margin:8px 0;background:#0e131b;color:white;border:1px solid #344055;border-radius:8px";panel.appendChild(code);
      var status=document.createElement("p");status.className="status";panel.appendChild(status);
      var verify=document.createElement("button");verify.type="button";verify.textContent=setup?"Ativar proteção e gerar códigos de recuperação":"Verificar e entrar";panel.appendChild(verify);
      var loginBox=document.getElementById("login");
      if(loginBox&&loginBox.parentNode)loginBox.parentNode.insertBefore(panel,loginBox.nextSibling);
      verify.onclick=async function(){
        verify.disabled=true;status.textContent="Verificando código...";
        try{
          var result=setup
            ?await post(api,"/api/admin/2fa/verify-setup",{secret:secret,code:code.value},challenge)
            :await post(api,"/api/admin/2fa/verify",{code:code.value},challenge);
          if(result.recoveryCodes&&result.recoveryCodes.length){
            heading.textContent="Guarde seus códigos de recuperação";
            info.textContent="A proteção foi ativada. Estes códigos só serão exibidos agora. Guarde-os em um local seguro, fora deste aparelho. Cada código pode ser usado uma única vez.";
            code.remove();label.remove();verify.remove();status.textContent="";
            var recovery=document.createElement("pre");recovery.textContent=result.recoveryCodes.join("\n");recovery.style.cssText="white-space:pre-wrap;user-select:all;background:#0b1018;padding:14px;border-radius:8px;color:#8bd8ff;font-size:15px";panel.appendChild(recovery);
            var finish=document.createElement("button");finish.type="button";finish.textContent="Já salvei os códigos — entrar no painel";panel.appendChild(finish);
            finish.onclick=async function(){finish.disabled=true;await onAuthenticated(result.token)};
          }else{
            status.textContent="Autenticação concluída.";
            await onAuthenticated(result.token);
          }
        }catch(error){status.textContent=error.message;verify.disabled=false;code.focus()}
      };
      code.addEventListener("keydown",function(event){if(event.key==="Enter")verify.click()});
      code.focus();
      if(onError)onError(setup?"Senha aceita. Conclua a configuração do autenticador abaixo.":"Senha aceita. Informe o segundo fator abaixo.");
    }catch(error){if(onError)onError(error.message);throw error}
  }
  window.PS3AdminAuth={begin:begin};
})();