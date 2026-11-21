import fs from 'node:fs';
const read = f => fs.readFileSync(f,'utf8');
const modules = fs.readdirSync('vendor/QRCode').filter(n=>n.endsWith('.js')).map(n=>JSON.stringify('./'+n.slice(0,-3))+':(module,require)=>{'+read('vendor/QRCode/'+n)+'}').join(',\n');
const qrcode = 'const modules={'+modules+'}, cache={};function require(id){if(!cache[id]){const m={exports:{}};cache[id]=m;modules[id](m,require)}return cache[id].exports} const QRCode=require("./index");';
let code = 'const GUEST='+JSON.stringify(read('src/guest.js'))+';'+qrcode+'\nconst PAGE='+JSON.stringify(read('src/page.html'))+';\nconst ART='+JSON.stringify(read('illustration.svg'))+';\n'+read('src/statements.mjs')+'\n'+read('src/ledger.mjs')+'\n'+read('src/reports.mjs')+'\n'+read('src/worker.mjs');
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js',code);
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
