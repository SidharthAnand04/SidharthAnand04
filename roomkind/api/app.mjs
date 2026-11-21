import {timingSafeEqual} from 'node:crypto';
import worker,{closePeriod,refresh} from '../dist/server/index.js';
import {statements} from '../src/statements.mjs';
const ledger='https://roomkind-housekeeping.sid619839.chatgpt.site/internal/ledger';
function database(secret){
 const names=new Map(Object.entries(statements).map(([key,sql])=>[sql,key]));
 return {prepare(sql){
  const operation=names.get(sql);if(!operation)throw Error('Unknown database operation');
  function statement(params){
   const call=async method=>{
    const res=await fetch(ledger,{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify({operation,params,method})});
    if(!res.ok)throw Error('Ledger unavailable');return res.json();
   };
   return {bind:(...values)=>statement(values),first:()=>call('first'),all:()=>call('all'),run:()=>call('run')};
  }
  return statement([]);
 }};
}
function matches(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y)}
export default async function handler(req,res){
 const url=new URL(req.url,'https://'+req.headers.host);
 // Vercel routes preserve the requested public URL in a query parameter.
 const route=url.searchParams.get('_route')||url.pathname;
 if(!route.startsWith('/')||route.startsWith('//'))return res.status(400).end();
 url.pathname=route;url.searchParams.delete('_route');
 const headers=new Headers();
 if(req.headers.origin)headers.set('origin',req.headers.origin);
 const env={...process.env,DB:database(process.env.LEDGER_SECRET),VERCEL_APP:true,REPORT_OWNER_EMAIL:'manager'};
 if(route==='/reports'||route==='/reports.csv'){
  const expected='Basic '+Buffer.from('manager:'+process.env.REPORT_PASSWORD).toString('base64');
  if(!process.env.REPORT_PASSWORD||!matches(req.headers.authorization,expected)){
   res.setHeader('WWW-Authenticate','Basic realm="Roomkind housekeeping", charset="UTF-8"');res.setHeader('Cache-Control','no-store');return res.status(401).end('Sign in with the hotel manager account.');
  }
  headers.set('oai-authenticated-user-email','manager');
 }
 if(route==='/cron/housekeeping'){
  if(req.method!=='GET'||!process.env.CRON_SECRET||!matches(req.headers.authorization,'Bearer '+process.env.CRON_SECRET))return res.status(403).end();
  const span=14*86400000,anchor=Date.UTC(2026,10,16),end=anchor+Math.floor((Date.now()-anchor)/span)*span;
  if(env.PLAID_ENV&&env.PLAID_ENV!=='demo'){
   let last='';
   while(true){
    const {results}=await env.DB.prepare(statements.reconcile).bind(env.PLAID_ENV,end-span,end,last).all();
    for(const row of results)await refresh(env,row);
    if(results.length<50)break;last=results.at(-1).id;
   }
  }
  return res.status(200).json(await closePeriod(env.DB));
 }
 let body;if(req.method==='POST'){if(req.body===undefined){const chunks=[];for await(const chunk of req)chunks.push(chunk);body=Buffer.concat(chunks)}else body=typeof req.body==='string'||Buffer.isBuffer(req.body)?req.body:JSON.stringify(req.body)}
 const response=await worker.fetch(new Request(url,{method:req.method,headers,body}),env);
 for(const [key,value] of response.headers)res.setHeader(key,value);
 res.status(response.status).end(Buffer.from(await response.arrayBuffer()));
}
