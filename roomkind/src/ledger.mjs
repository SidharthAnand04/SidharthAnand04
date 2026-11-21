async function ledgerRequest(request,env){
  if(!env.LEDGER_SECRET || request.headers.get('authorization')!=='Bearer '+env.LEDGER_SECRET)return json({error:'Forbidden'},403);
  const {operation,params,method}=await request.json();
  if(!Object.hasOwn(statements,operation)||!Array.isArray(params)||!['first','all','run'].includes(method))return json({error:'Invalid operation'},400);
  let stmt=env.DB.prepare(statements[operation]);if(params.length)stmt=stmt.bind(...params);
  const result=await stmt[method]();return json(method==='run'?{ok:true}:result);
}
