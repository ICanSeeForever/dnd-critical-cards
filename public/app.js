const $=s=>document.querySelector(s);
const labels={monsters:'20 против монстров',players:'20 против игроков',fumbles:'Критический провал'};
let state=null;
const fmt=s=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(s));
async function action(a){try{const r=await fetch('/crits/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});if(!r.ok)throw Error('Сервер отклонил действие')}catch(e){alert(e.message)}}
function effectParts(text){const match=text.match(/^(.+?[.!?…])\s+([\s\S]+)$/);return match?[match[1],match[2]]:[text,'']}
function addEffect(row,e){const type=document.createElement('strong');type.textContent=e.type;const p=document.createElement('p');const [title,detail]=effectParts(e.text);const lead=document.createElement('b');lead.className='effect-name';lead.textContent=title;p.append(lead);if(detail)p.append(document.createTextNode(' '+detail));row.append(type,p)}
function miniCard(item){const b=document.createElement('button');b.className='mini-card';b.title=`Карта № ${item.card.id} · ${fmt(item.time)} МСК`;b.onclick=()=>action({type:'show',key:item.key});const face=document.createElement('span');face.className='mini-face';if(item.group==='fumbles'){const img=document.createElement('img');img.src=item.card.image;img.alt=`Карта № ${item.card.id}`;img.loading='lazy';face.append(img)}else{const number=document.createElement('span');number.className='mini-number';number.textContent=`№ ${item.card.id}`;face.append(number);for(const effect of item.card.effects){const row=document.createElement('span');row.className='mini-effect-row';const type=document.createElement('b');type.textContent=effect.type;const title=document.createElement('span');title.textContent=effectParts(effect.text)[0];row.append(type,title);face.append(row)}}const time=document.createElement('time');time.textContent=fmt(item.time)+' МСК';b.append(face,time);return b}
function render(s){
  if(state&&s.version===state.version)return;state=s;
  $('#landing').classList.toggle('hidden',!!s.group);$('#table').classList.toggle('hidden',!s.group);$('#overlay').classList.toggle('hidden',!s.revealed);
  if(!s.group)return;
  $('#group-title').textContent=labels[s.group];$('#remaining').textContent=s.remaining;
  const fan=$('#fan');fan.replaceChildren();
  for(let i=0;i<s.remaining;i++){
    const b=document.createElement('button');b.className='fan-card';b.setAttribute('aria-label',`Вытянуть карту ${i+1}`);
    const angle=s.remaining===1?0:-45+i*90/(s.remaining-1);
    const radians=angle*Math.PI/180;
    b.style.setProperty('--r',`${-angle}deg`);b.style.setProperty('--sin',Math.sin(radians));b.style.setProperty('--y',`${430*(Math.cos(radians)-1)}px`);b.style.setProperty('--my',`${160*(Math.cos(radians)-1)}px`);b.style.setProperty('--z',i);
    b.onclick=()=>action({type:'draw',slot:i});fan.append(b);
  }
  $('#empty').classList.toggle('hidden',s.remaining>0);
  const h=s.history[s.group].slice(0,6);$('#history-count').textContent=`${h.length} / 6`;const list=$('#history-list');list.replaceChildren();
  if(!h.length){const p=document.createElement('p');p.className='no-history';p.textContent='Пока никто не вытянул карту.';list.append(p)}
  for(const item of h)list.append(miniCard(item));
  if(s.revealed){
    const item=s.revealed;$('#reveal-group').textContent=labels[item.group].toUpperCase();$('#reveal-time').textContent=`${fmt(item.time)} МСК`;
    const c=$('#card-content');c.replaceChildren();
    if(item.group==='fumbles'){const img=document.createElement('img');img.className='fumble-image';img.src=item.card.image;img.alt=`Критический провал, карта ${item.card.id}`;c.append(img)}
    else{const face=document.createElement('div');face.className='face';const title=document.createElement('h2');title.textContent=`Карта № ${item.card.id}`;const sub=document.createElement('div');sub.className='subtitle';sub.textContent=labels[item.group].toUpperCase();face.append(title,sub);for(const e of item.card.effects){const row=document.createElement('div');row.className='effect';addEffect(row,e);face.append(row)}c.append(face)}
  }
}
document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>action({type:'select',group:b.dataset.group}));
$('#home').onclick=()=>action({type:'home'});$('#close').onclick=()=>action({type:'close'});
$('#number-form').onsubmit=e=>{e.preventDefault();const input=$('#card-number');if(!input.reportValidity()||!state?.group)return;action({type:'number',group:state.group,number:Number(input.value)});};
const events=new EventSource('/crits/api/events');events.onmessage=e=>render(JSON.parse(e.data));
fetch('/crits/api/state').then(r=>r.json()).then(render);
