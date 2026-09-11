/* Guided spatial placement. Once placed, visibility depends on world tracking, not QR reads. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),S=AR.S;
  const box=document.createElement('section');box.id='papelAnclado';box.hidden=true;
  box.innerHTML='<div class="anclado-arriba"><p id="ancladoEstado" role="status" aria-live="polite"></p><button id="ancladoSalir" type="button">Salir</button></div><div class="anclado-centro" aria-hidden="true">+</div><div class="anclado-abajo"><p id="ancladoAyuda"></p><button id="ancladoMarcar" type="button">Marcar cruz 1</button><button id="ancladoReubicar" type="button" hidden>Volver a ubicar</button></div>';
  $('capaAR').append(box);
  const set=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text;};
  function start(){box.hidden=false;$('capaAR').classList.add('papel-fijo');update();}
  function stop(){box.hidden=true;$('capaAR').classList.remove('papel-fijo');}
  function update(){
    if(!S.paperFixed || !S.session){stop();return;}
    const placed=!!S.fijado,ready=!!(S._hitReady&&!S._trackPerdido&&S.reticula?.visible);
    $('ancladoMarcar').hidden=placed;$('ancladoMarcar').disabled=!ready;
    $('ancladoReubicar').hidden=!placed;
    box.dataset.step=placed?'placed':S.esquinando===5?'second':'first';
    box.dataset.tracking=S._trackPerdido?'lost':'world';
    set('ancladoMarcar',S.esquinando===5?'Marcar cruz 2':'Marcar cruz 1');
    const message=S._trackPerdido?'El teléfono perdió el seguimiento espacial. Apuntá de nuevo a la mesa y su entorno.':placed?'Modelo fijado · podés moverte sin enfocar el QR':S.esquinando===5?'2 de 2 · apuntá al centro de la cruz 2':'1 de 2 · apuntá al centro de la cruz 1';
    set('ancladoEstado',message);
    const hint=placed?'Mantené la hoja quieta sobre la mesa. Si movés la hoja, usá Volver a ubicar.':ready?'Aro verde: tocá Marcar. La mira + indica hacia dónde apunta el teléfono.':'Apoyá la hoja en una mesa. Mové despacio el teléfono hasta detectar esa superficie y ver el aro verde.';
    const hud=$('hudMsg').textContent;
    const warning=!placed && /misma hoja|Muy cerca|escala válida/.test(hud)?hud:hint;
    set('ancladoAyuda',warning);
  }
  box.addEventListener('beforexrselect',e=>e.preventDefault());
  $('ancladoMarcar').onclick=()=>{if(!S.paperFixed)return;AR.tapPantalla();update();};
  $('ancladoReubicar').onclick=()=>{if(S.paperFixed)AR.reiniciarPlanoFijo();};
  $('ancladoSalir').onclick=()=>AR.salirAR();
  window.MSAnchorUI={start,stop,update};
})();
