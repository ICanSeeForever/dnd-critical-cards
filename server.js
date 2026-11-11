import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const cards=JSON.parse(fs.readFileSync(path.join(base,'cards.json')));
const stateFile=path.join(base,'data','state.json');
fs.mkdirSync(path.dirname(stateFile),{recursive:true});
const shuffle=()=>{const a=Array.from({length:50},(_,i)=>i);for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const fresh=()=>({group:null,deck:[],revealed:null,history:{players:[],monsters:[],fumbles:[]},version:0});
let state;try{state=JSON.parse(fs.readFileSync(stateFile))}catch{state=fresh()}
// Upgrade earlier sessions that permanently removed drawn cards.
if(!Object.hasOwn(state,'pendingCardIndex')){
  state.deck=shuffle();state.pendingCardIndex=null;state.revealed=null;
  fs.writeFileSync(stateFile,JSON.stringify(state));
}
const clients=new Set();
const publicState=()=>({group:state.group,remaining:state.deck.length,revealed:state.revealed,history:state.history,version:state.version});
function publish(){state.version++;fs.writeFileSync(stateFile,JSON.stringify(state));const msg=`data: ${JSON.stringify(publicState())}\n\n`;for(const c of clients){try{c.write(msg)}catch{clients.delete(c)}}}
function respond(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>4096)throw Error('large')}return JSON.parse(s||'{}')}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/crits/api/state')return respond(res,200,publicState());
  if(url.pathname==='/crits/api/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write(`data: ${JSON.stringify(publicState())}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;
  }
  if(req.method==='POST'&&url.pathname==='/crits/api/action'){
    try{
      const a=await body(req);
      if(a.type==='select'&&Object.hasOwn(cards,a.group)){state.group=a.group;state.deck=shuffle();state.pendingCardIndex=null;state.revealed=null}
      else if(a.type==='home'){state.group=null;state.revealed=null;state.pendingCardIndex=null}
      else if(a.type==='draw'&&state.group&&!state.revealed&&Number.isInteger(a.slot)&&a.slot>=0&&a.slot<state.deck.length){
        const index=state.deck.splice(a.slot,1)[0];state.pendingCardIndex=index;const card=cards[state.group][index];
        const item={key:crypto.randomUUID(),group:state.group,card,time:new Date().toISOString()};
        state.history[state.group].unshift(item);state.history[state.group]=state.history[state.group].slice(0,100);
        state.revealed=item;
      }else if(a.type==='number'&&state.group&&a.group===state.group&&!state.revealed&&Number.isInteger(a.number)&&a.number>=1&&a.number<=50){
        const card=cards[state.group].find(c=>c.id===a.number);
        if(!card)return respond(res,404,{error:'Card not found'});
        state.revealed={key:crypto.randomUUID(),group:state.group,card,time:new Date().toISOString()};
      }else if(a.type==='show'&&state.group){const item=state.history[state.group].find(x=>x.key===a.key);if(!item)return respond(res,404,{error:'Card not found'});state.revealed=item}
      else if(a.type==='close'){
        if(state.pendingCardIndex!==null){state.deck.splice(crypto.randomInt(state.deck.length+1),0,state.pendingCardIndex);state.pendingCardIndex=null}
        state.revealed=null;
      }
      else return respond(res,400,{error:'Invalid action'});
      publish();return respond(res,200,publicState());
    }catch{return respond(res,400,{error:'Invalid request'})}
  }
  let p=url.pathname==='/crits'||url.pathname==='/crits/'?'/index.html':url.pathname.startsWith('/crits/')?url.pathname.slice(6):'';
  if(!p||p.includes('..')){res.writeHead(404);return res.end()}
  const file=path.join(base,'public',p);if(!file.startsWith(path.join(base,'public'))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':p.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache'});fs.createReadStream(file).pipe(res);
}).listen(3000,'0.0.0.0');
