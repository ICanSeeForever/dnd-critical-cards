import fs from 'node:fs';
const raw=JSON.parse(fs.readFileSync(new URL('./raw.json',import.meta.url),'utf8'));
const result={players:[],monsters:[],fumbles:[]};
for(const book of raw){
  const key=book.file.includes('игроков')?'players':'monsters';
  const rows=book.sheets[0].rows.slice(1);
  for(let n=0;n<50;n++){
    const effects=rows.slice(n*4,n*4+4).map(r=>({type:Object.entries(r.cells).find(([k])=>k.startsWith('B'))?.[1]||'',text:Object.entries(r.cells).find(([k])=>k.startsWith('C'))?.[1]||''}));
    if(effects.length!==4||effects.some(e=>!e.text))throw Error(`${key} card ${n+1} incomplete`);
    result[key].push({id:n+1,effects});
  }
}
for(let n=1;n<=50;n++)result.fumbles.push({id:n,image:`/crits/assets/${String(n).padStart(2,'0')}.jpg`});
fs.writeFileSync(new URL('./cards.json',import.meta.url),JSON.stringify(result,null,2));
console.log(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.length])));
