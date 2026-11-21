// The most recently closed fortnight. Windows are adjacent and anchored to a Monday.
async function closePeriod(db, now=Date.now()){
  const length=14*86400000,anchor=Date.UTC(2026,10,16);
  const end=anchor+Math.floor((now-anchor)/length)*length,start=end-length;
  const day=t=>new Date(t).toISOString().slice(0,10);
  await db.prepare(statements.closePeriod)
    .bind(day(start),day(end),now,start,end).run();
  return {start:day(start),end:day(end)};
}
async function staff(req,e){
  const email=req.headers.get('oai-authenticated-user-email');
  if(!email)return page('<section><h1>Housekeeping reports</h1><p>Sign in with the hotel owner account to see tip totals.</p><a target="_top" href="/signin-with-chatgpt?return_to=%2Freports">Sign in</a></section>',401);
  if(!e.REPORT_OWNER_EMAIL||email.toLowerCase()!==e.REPORT_OWNER_EMAIL.toLowerCase())return page('<section><h2>Owner access required</h2></section>',403);
  const {end}=await closePeriod(e.DB);
  const open=await e.DB.prepare(statements.openRows).bind(Date.parse(end)).all();
  const history=await e.DB.prepare(statements.reports).all();
  const periods=[{label:'Open period from '+end,rows:open.results},...history.results.map(r=>({label:r.period_start+' to '+new Date(Date.parse(r.period_end_exclusive)-1).toISOString().slice(0,10),rows:JSON.parse(r.summary_json)}))];
  if(new URL(req.url).pathname.endsWith('.csv')){
    const lines=['period,room,mode,status,count,amount_usd'];
    for(const period of periods)for(const r of period.rows)lines.push([period.label,r.room,r.mode,r.status,r.tips,(r.cents/100).toFixed(2)].join(','));
    const res=reply(lines.join('\r\n')+'\r\n','text/csv');res.headers.set('Content-Disposition','attachment; filename="housekeeping-tips.csv"');return res;
  }
  return page('<section class="cards"><span class="tag">Housekeeping department</span><h1>Tip reports</h1><p>Fourteen-day reporting periods · UTC</p><a href="/reports.csv">Download CSV</a>'+periods.map(({label,rows})=>'<h2>'+label+'</h2><p>Settled real tips: '+dollars(rows.filter(r=>r.mode==='production'&&['settled','funds_available'].includes(r.status)).reduce((sum,r)=>sum+r.cents,0))+'</p>'+(rows.length?'<table><tr><th>Room</th><th>Mode</th><th>Status</th><th>Tips</th><th>Amount</th></tr>'+rows.map(r=>'<tr><td>'+r.room+'</td><td>'+r.mode+'</td><td>'+r.status+'</td><td>'+r.tips+'</td><td>'+dollars(r.cents)+'</td></tr>').join('')+'</table>':'<p>No tips recorded.</p>')).join('')+'</section>');
}
