const form=document.querySelector('form');
const custom=form.elements.custom;
const submit=form.querySelector('.action');
const message=document.querySelector('#message');
const mode=form.dataset.mode,room=form.dataset.room;
let preset=5;
const value=()=>preset===null?Number(custom.value):preset;
function update(){submit.textContent=(mode==='demo'?'Leave test tip':'Continue to bank')+(value()>0?' · $'+value().toFixed(2):'')}
for(const button of form.querySelectorAll('[data-value]'))button.onclick=()=>{
  for(const option of form.querySelectorAll('[data-value]'))option.setAttribute('aria-pressed',String(option===button));
  preset=button.dataset.value==='other'?null:Number(button.dataset.value);
  custom.hidden=preset!==null;custom.disabled=preset!==null;if(!custom.hidden)custom.focus();update()
};
custom.oninput=update;update();
form.onsubmit=async event=>{
  event.preventDefault();submit.disabled=true;message.textContent='';
  try{
    const cents=Math.round(value()*100);
    const key='roomkind:'+room+':'+mode+':'+cents;
    const id=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,id);
    const r=await fetch('/api/tip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,room,cents,name:form.elements.name?.value})});
    const data=await r.json();if(!r.ok)throw Error(data.error);
    const receipt=()=>{location.assign('/receipt/'+id)};
    if(!data.token){receipt();return}
    if(!window.Plaid)throw Error('Bank checkout did not load. Please try again.');
    const handler=Plaid.create({token:data.token,onSuccess:receipt,onExit:()=>{submit.disabled=false;message.textContent='Checkout closed. You can resume here.'}});handler.open()
  }catch(e){message.textContent=e.message||'Please try again.';submit.disabled=false}
};
