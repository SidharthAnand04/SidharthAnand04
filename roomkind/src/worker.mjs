const validRoom = r => typeof r==='string' && /^[1-9][0-9]{0,3}[A-Z]?$/.test(r);
const uuid = s => typeof s==='string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
const dollars=c=>'$'+(c/100).toFixed(2);
function reply(body,type,status=200){return new Response(body,{status,headers:{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'}})}
const page=(body,status)=>reply(PAGE.replace('%%BODY%%',()=>body),'text/html; charset=utf-8',status);
const json=(data,status)=>reply(JSON.stringify(data),'application/json',status);
const art='<figure><img alt="Folded hotel linens and a brass room key" src="/art.svg"><figcaption>For the hands that cared for your room.</figcaption></figure>';
function getMode(e){
  const m=e.PLAID_ENV||'demo';
  if(m==='demo')return m;
  if(!['sandbox','production'].includes(m)||!e.PLAID_CLIENT_ID||!e.PLAID_SECRET||!e.PLAID_FUNDING_ACCOUNT_ID||!e.PLAID_LINK_CUSTOMIZATION)throw Error('Payment setup incomplete');
  return m;
}
function guest(room,mode){
  return page(art+`<section><span class="tag">Room ${room}</span><h1>Thank your housekeeper.</h1><p>Leave an optional tip for the housekeeping team who cared for your room.</p><form data-mode="${mode}" data-room="${room}"><fieldset><legend>Choose a tip amount</legend><div class="amounts">${[3,5,10,'other'].map(x=>'<button type="button" data-value="'+x+'" aria-pressed="'+(x===5)+'">'+(x==='other'?'Other':'$'+x)+'</button>').join('')}</div><input name="custom" aria-label="Custom tip amount in USD" type="number" placeholder="Amount in USD" step=".01" min="1" max="500" required disabled hidden></fieldset>${mode==='demo'?'':'<label>Name on bank account<input name="name" autocomplete="name" maxlength="120" required></label><p></p>'}<button class="action">Continue</button><p id="message" role="status"></p><p class="note fine">${mode==='demo'?'Test checkout · No money moves.':mode==='sandbox'?'Plaid Sandbox · Test accounts only.':'One-time USD bank payment through Plaid.'}</p></form></section>${mode==='demo'?'':'<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>'}<script src="/guest.js"></script>`);
}
function cards(url){
  const values=(url.searchParams.get('rooms')||'101,102,103').split(',').map(s=>s.trim().toUpperCase());
  if(values.length>200||!values.every(validRoom))return page('<section><h2>Check your room list</h2><p>Enter up to 200 room numbers, optionally followed by a letter.</p><a href="/cards">Return to room cards</a></section>',400);
  const rooms=[...new Set(values)];
  return page(`<section class="cards"><div class="controls"><span class="tag">Housekeeping</span><h1>Room QR cards</h1><form><label>Room numbers<input name="rooms" value="${rooms.join(', ')}" required></label><p class="note">Separate rooms with commas. Each code opens that room’s tip page.</p><button>Generate cards</button> <button type="button" onclick="window.print()">Print cards</button></form></div><div class="sheet">${rooms.map(r=>'<div class="card"><b>Roomkind.</b><img src="/qr/'+r+'" alt="QR code for room '+r+'"><b>Thank your housekeeper</b><small>Scan to tip · Room '+r+'</small><a href="/r/'+r+'">Open tip page</a></div>').join('')}</div></section>`);
}
function qr(link){
  const code=new QRCode(-1,0);code.addData(link);code.make();
  const size=code.getModuleCount();let d='';
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(code.isDark(y,x))d+='M'+(x+4)+' '+(y+4)+'h1v1h-1z';
  return reply('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(size+8)+' '+(size+8)+'" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="'+d+'"/></svg>','image/svg+xml');
}
async function plaid(e,path,fields){
  const response=await fetch('https://'+getMode(e)+'.plaid.com'+path,{method:'POST',headers:{'Content-Type':'application/json','PLAID-CLIENT-ID':e.PLAID_CLIENT_ID,'PLAID-SECRET':e.PLAID_SECRET},body:JSON.stringify(fields)});
  if(!response.ok)throw Error('Bank service unavailable');return response.json();
}
async function checkout(req,e){
  if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Reopen the room page.'},403);
  let b;try{b=await req.json()}catch{return json({error:'Invalid request.'},400)}
  if(!b||!uuid(b.id)||!validRoom(b.room)||!Number.isInteger(b.cents)||b.cents<100||b.cents>50000)return json({error:'Choose a tip between $1 and $500.'},400);
  const mode=getMode(e);
  if(mode!=='demo'&&(typeof b.name!=='string'||!b.name.trim()||b.name.length>120))return json({error:'Enter your account name.'},400);
  await e.DB.prepare('INSERT OR IGNORE INTO tips(id,room,cents,mode,created,status) VALUES(?,?,?,?,?,?)').bind(b.id,b.room,b.cents,mode,Date.now(),mode==='demo'?'simulated':'initiated').run();
  let row=await e.DB.prepare('SELECT * FROM tips WHERE id=?').bind(b.id).first();
  if(row.room!==b.room||row.cents!==b.cents||row.mode!==mode)return json({error:'Receipt details differ.'},409);
  if(mode==='demo')return json({recorded:true});
  if(!row.intent){
    const info=await plaid(e,'/transfer/intent/create',{mode:'PAYMENT',amount:(b.cents/100).toFixed(2),description:'Room tip',ach_class:'web',funding_account_id:e.PLAID_FUNDING_ACCOUNT_ID,user:{legal_name:b.name.trim()}});
    await e.DB.prepare('UPDATE tips SET intent=? WHERE id=? AND intent IS NULL').bind(info.transfer_intent.id,b.id).run();
    row=await e.DB.prepare('SELECT * FROM tips WHERE id=?').bind(b.id).first();
  }
  if((await refresh(e,row))!=='initiated')return json({recorded:true});
  const link=await plaid(e,'/link/token/create',{client_name:'Roomkind',user:{client_user_id:b.id},products:['transfer'],language:'en',country_codes:['US'],link_customization_name:e.PLAID_LINK_CUSTOMIZATION,transfer:{intent_id:row.intent}});
  return json({token:link.link_token});
}
async function refresh(e,row){
  if(!row.intent||row.mode!==getMode(e))return row.status;
  const {transfer_intent:t}=await plaid(e,'/transfer/intent/get',{transfer_intent_id:row.intent});
  let status=t.status==='FAILED'?'failed':'initiated';
  if(t.transfer_id)status=(await plaid(e,'/transfer/get',{transfer_id:t.transfer_id})).transfer.status;
  const allowed=['initiated','pending','posted','settled','funds_available','returned','failed','cancelled'];
  if(!allowed.includes(status))status='under_review';
  await e.DB.prepare('UPDATE tips SET status=? WHERE id=?').bind(status,row.id).run();
  return status;
}
export default {async fetch(req,e){
  const u=new URL(req.url),p=u.pathname;
  try{
    if(req.method==='POST'&&p==='/api/reports/close')return json(await closePeriod(e.DB));
    if(req.method==='POST'&&p==='/api/tip')return await checkout(req,e);
    if(req.method!=='GET')return json({error:'Unsupported method.'},405);
    if(p==='/art.svg')return reply(ART,'image/svg+xml');
    if(p==='/guest.js')return reply(GUEST,'application/javascript');
    if(p==='/reports'||p==='/reports.csv')return await staff(req,e);
    if(p==='/cards')return cards(u);
    if(p==='/'){return page(art+'<section><span class="tag">Guest services</span><h1>A tip for housekeeping.</h1><p>Scan the card in your room, or enter your room number below.</p><form action="/room"><label>Room number<input required maxlength="5" name="room" placeholder="e.g. 101" pattern="[1-9][0-9]{0,3}[a-zA-Z]?"></label><p><button class="action">Open room</button></p></form></section>')}
    const room=p==='/room'?(u.searchParams.get('room')||'').trim().toUpperCase():p.split('/')[2];
    if(validRoom(room)){
      if(p==='/room')return Response.redirect(u.origin+'/r/'+room,303);
      if(p==='/r/'+room)return guest(room,getMode(e));
      if(p==='/qr/'+room)return qr(u.origin+'/r/'+room);
    }
    if(p.startsWith('/receipt/')&&uuid(p.slice(9))){
      const row=await e.DB.prepare('SELECT * FROM tips WHERE id=?').bind(p.slice(9)).first();
      if(row){const status=await refresh(e,row);return page(art+'<section><span class="tag">Room '+row.room+'</span><h1>'+(row.mode==='demo'?'Test tip recorded.':'Tip status')+'</h1><p>'+dollars(row.cents)+' · '+(row.mode==='demo'?'Simulated tip. No money moved.':row.mode+' transfer · '+status)+'</p><p class="note">Receipt '+row.id.slice(0,8).toUpperCase()+'</p><a href="/">Back to guest services</a></section>')}
    }
    return page('<section><h1>Page unavailable</h1><a href="/">Guest services</a></section>',404);
  }catch{return p.startsWith('/api/')?json({error:'Checkout is temporarily unavailable. Retry using the same room page.'},503):page('<section><h2>Temporarily unavailable</h2><p>Please try again shortly.</p></section>',503)}
}};
