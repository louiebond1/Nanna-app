// Original SVG artwork, kept as vectors so names and question details stay
// sharp at phone and tablet sizes. Every tested detail comes from card.country.
const NS = 'http://www.w3.org/2000/svg';
function e(tag, attrs, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children.flat()) if (child != null) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
const p = (d, fill, extra = {}) => e('path', { d, fill, ...extra });
const r = (x,y,width,height,fill,extra={}) => e('rect',{x,y,width,height,fill,...extra});
const t = (x,y,text,size=24,extra={}) => e('text',{x,y,'font-size':size,'font-family':'system-ui, sans-serif','font-weight':700,fill:'#193c43',...extra},text);
const line = (x1,y1,x2,y2,stroke,width=4) => e('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-linecap':'round'});
function landmark(id) {
  const stone = '#dcb47b', dark = '#805c40', white = '#fff9e8';
  const columns = (n,x,y,h) => Array.from({length:n},(_,i)=>r(x+i*22,y,10,h,white));
  switch(id) {
    case 'france': return [p('M100 5 L92 75 L65 158 L86 158 L103 116 Q110 100 117 116 L134 158 L155 158 L128 75 L120 5 Z','#56676b'),r(88,68,44,7,dark),r(75,110,70,7,dark),line(110,0,110,-12,dark,3)];
    case 'italy': return [e('g',{transform:'rotate(8 110 150)'},r(68,17,85,142,stone,{rx:8}),...Array.from({length:5},(_,i)=>[r(62,35+i*25,96,6,white),...columns(5,70,20+i*25,15)]),r(78,0,63,24,white,{rx:7}))];
    case 'greece': return [p('M28 40 L110 0 L192 40 Z',stone),r(28,42,164,10,dark),...columns(7,34,54,95),r(20,149,180,12,stone),r(12,161,196,9,dark)];
    case 'spain': return [r(40,75,140,85,stone),...[50,83,117,150].map((x,i)=>[p(`M${x} 80 L${x+8} ${i%2?0:18} L${x+16} 80 Z`,stone),r(x,80,16,80,stone),r(x+5,88,6,30,dark)]),p('M87 160 L87 124 Q110 90 133 124 L133 160 Z',dark)];
    case 'japan': return [p('M0 160 L104 8 L220 160 Z','#6b8fa2'),p('M77 48 L104 8 L136 48 L119 41 L109 53 L99 40 L90 50 Z',white),p('M0 155 Q70 135 110 150 Q170 135 220 155 L220 170 L0 170 Z','#45886b')];
    case 'egypt': return [p('M0 160 L75 15 L150 160 Z','#e4b35d'),p('M75 15 L105 160 L150 160 Z','#bb8540'),p('M110 160 L160 65 L220 160 Z','#f4cd84'),p('M160 65 L180 160 L220 160 Z','#cd9b50')];
    case 'australia': return [r(5,144,215,14,stone),p('M10 141 Q12 77 24 52 Q82 73 99 141 Z',white),p('M60 141 Q70 40 88 12 Q145 54 154 141 Z',white),p('M119 141 Q141 65 178 46 Q209 87 218 141 Z',white),p('M24 52 L99 141 M88 12 L154 141 M178 46 L218 141','none',{stroke:'#b9c8c6','stroke-width':3})];
    case 'brazil': return [p('M20 170 Q100 110 200 170 Z','#5e936b'),p('M96 60 L100 150 L122 150 L125 60 L194 47 L190 35 L123 42 L119 30 L101 30 L96 42 L25 35 L21 47 Z','#e2dacf'),e('circle',{cx:110,cy:17,r:14,fill:'#e2dacf'})];
    case 'canada': return [p('M96 160 L105 53 L115 53 L124 160 Z','#9caeb3'),r(76,45,68,15,'#b54d48',{rx:7}),p('M110 45 L110 -5','none',{stroke:'#5c747c','stroke-width':4}),p('M0 160 Q60 125 80 153 Q130 120 160 153 Q190 138 220 160 Z','#487e62')];
    case 'india': return [r(45,90,130,70,white),p('M65 90 Q65 40 110 22 Q155 40 155 90 Z',white),e('circle',{cx:110,cy:18,r:6,fill:stone}),line(110,12,110,0,stone,3),...[20,185].map(x=>[r(x,53,15,107,white),p(`M${x-3} 53 L${x+7} 24 L${x+19} 53 Z`,white)]),p('M94 160 L94 119 Q110 94 126 119 L126 160 Z','#547f8a'),r(25,160,170,9,stone)];
    case 'netherlands': return [p('M72 160 L88 35 L130 35 L150 160 Z',stone),p('M77 35 L110 6 L143 35 Z',dark),line(110,70,42,8,white,13),line(110,70,177,132,white,13),line(110,70,172,2,white,13),line(110,70,48,138,white,13),e('circle',{cx:110,cy:70,r:9,fill:dark}),r(99,128,24,32,dark)];
    default: return [r(22,31,176,18,stone),...columns(8,27,50,105),r(14,155,192,12,stone),r(40,15,140,15,dark),p('M80 15 L110 -5 L140 15 Z',stone)];
  }
}
function flag(c) {
  const g=e('g',{transform:'translate(272 16)'});let colours;
  if(c.id==='japan') g.append(r(0,0,70,44,'#fff'),e('circle',{cx:35,cy:22,r:13,fill:'#c52e42'}));
  else if(c.id==='greece') {
    for(let i=0;i<9;i++)g.append(r(0,i*44/9,70,44/9,i%2?'#fff':'#2665a2'));
    g.append(r(0,0,25,25,'#2665a2'),r(10,0,5,25,'#fff'),r(0,10,25,5,'#fff'));
  } else if(c.id==='brazil') g.append(r(0,0,70,44,'#2a8248'),p('M35 5 L64 22 L35 39 L6 22 Z','#f8d053'),e('circle',{cx:35,cy:22,r:11,fill:'#265995'}),p('M24 18 Q35 17 46 25','none',{stroke:'#fff','stroke-width':3}));
  else if(c.id==='australia') {
    g.append(r(0,0,70,44,'#203c80'),r(0,0,32,22,'#203c80'),p('M0 0 L32 22 M32 0 L0 22','none',{stroke:'#fff','stroke-width':5}),r(12,0,7,22,'#fff'),r(0,7,32,7,'#fff'),r(14,0,3,22,'#c32d3b'),r(0,9,32,3,'#c32d3b'));
    for(const [x,y] of [[18,33],[51,10],[44,24],[61,23],[52,36]])g.append(t(x,y,'✦',10,{fill:'#fff','text-anchor':'middle'}));
  } else {
    const vertical=['france','italy','canada'].includes(c.id);
    colours={france:['#244d92','#fff','#c94348'],italy:['#29885d','#fff','#ce4548'],canada:['#cb3647','#fff','#cb3647'],spain:['#bc3540','#f3ca4a','#bc3540'],egypt:['#ca3d46','#fff','#24252c'],india:['#ed994b','#fff','#32834c'],netherlands:['#bc3540','#fff','#315392'],germany:['#24252c','#c23a43','#f0c449']}[c.id];
    colours.forEach((colour,i)=>g.append(r(vertical?i*70/3:0,vertical?0:i*44/3,vertical?70/3:70,vertical?44:44/3,colour)));
    if(c.id==='canada')g.append(p('M35 9 L38 17 L43 13 L42 21 L48 22 L40 28 L40 31 L36 30 L36 36 L34 36 L34 30 L30 31 L30 28 L22 22 L28 21 L27 13 L32 17 Z','#cb3647'));
    if(c.id==='india')g.append(e('circle',{cx:35,cy:22,r:6,fill:'none',stroke:'#224c8a','stroke-width':2}));
    if(c.id==='egypt')g.append(p('M31 18 L35 20 L39 18 L38 28 L32 28 Z','#ba9742'));
    if(c.id==='spain')g.append(r(18,17,7,10,'#b44943'));
  }
  g.append(r(0,0,70,44,'none',{stroke:'#193c4344','stroke-width':1}));return g;
}
function food(id) {
  const g=e('g',{transform:'translate(286 304) scale(.65)'});
  const plate=e('ellipse',{cx:35,cy:43,rx:36,ry:7,fill:'#d3e2df'});
  g.append(plate);
  switch(id) {
    case 'france': g.append(e('g',{transform:'rotate(-15 35 25)'},e('rect',{x:0,y:10,width:70,height:28,rx:14,fill:'#dc9a42'}),...[18,32,46].map(x=>line(x,15,x-5,28,'#ffe0a0',4)))); break;
    case 'italy': g.append(p('M8 5 L65 21 L28 44 Z','#f5cc62'),p('M8 5 L65 21','none',{stroke:'#c5833f','stroke-width':8}),...[ [27,22],[42,25],[29,34] ].map(([cx,cy])=>e('circle',{cx,cy,r:4,fill:'#bf4c3c'}))); break;
    case 'greece': g.append(...[[16,29],[36,24],[51,34]].map(([cx,cy])=>e('ellipse',{cx,cy,rx:10,ry:7,fill:'#72863d'})),p('M28 16 Q39 0 52 8 Q47 20 28 16 Z','#3b7950'));break;
    case 'spain': g.append(e('ellipse',{cx:35,cy:30,rx:33,ry:16,fill:'#3f5e65'}),e('ellipse',{cx:35,cy:25,rx:31,ry:11,fill:'#eeb94c'}),...[[19,23],[37,29],[51,21]].map(([cx,cy])=>e('circle',{cx,cy,r:3,fill:'#bd5a3d'})));break;
    case 'japan': g.append(...[8,36].map(x=>e('g',{},r(x,17,26,25,'#294f45',{rx:5}),e('ellipse',{cx:x+13,cy:17,rx:13,ry:7,fill:'#fff8e8'}),e('ellipse',{cx:x+13,cy:17,rx:6,ry:4,fill:'#e78769'}))));break;
    case 'egypt': g.append(...[[17,26],[33,21],[50,29]].map(([cx,cy])=>e('ellipse',{cx,cy,rx:9,ry:15,transform:`rotate(25 ${cx} ${cy})`,fill:'#8e5135'})));break;
    case 'australia': g.append(e('ellipse',{cx:35,cy:34,rx:29,ry:11,fill:'#ead6ad'}),r(6,23,58,12,'#fffdf4',{rx:5}),e('ellipse',{cx:35,cy:23,rx:29,ry:11,fill:'#fffdf4'}),...[22,36,48].map(cx=>e('circle',{cx,cy:15,r:6,fill:'#bc4b4c'})));break;
    case 'brazil': g.append(e('ellipse',{cx:35,cy:29,rx:18,ry:22,fill:'#e9b74b'}),p('M35 11 L18 -3 L29 1 L35 -10 L41 1 L52 -3 Z','#3d8158'),p('M23 19 L48 37 M23 33 L44 15 M28 44 L51 24','none',{stroke:'#b7873e','stroke-width':2}));break;
    case 'canada': g.append(r(13,10,44,35,'#a36032',{rx:8}),r(23,0,24,12,'#a36032',{rx:3}),r(21,-2,28,6,'#3d5a5c'),r(21,20,28,17,'#f5e6c2',{rx:3}),p('M35 22 L38 28 L42 27 L40 33 L35 35 L30 33 L28 27 L32 28 Z','#bb5845'));break;
    case 'india': g.append(p('M7 42 L26 5 L48 42 Z','#d2a15c',{stroke:'#a3713e','stroke-width':2}),p('M29 42 L49 9 L68 42 Z','#e8bd74',{stroke:'#a3713e','stroke-width':2}));break;
    case 'netherlands': g.append(p('M5 22 L50 5 L67 35 L5 45 Z','#eac353'),p('M5 22 L67 12 L67 35 L5 45 Z','#f5d566'),...[ [20,31],[43,27],[56,24] ].map(([cx,cy])=>e('circle',{cx,cy,r:4,fill:'#c7993f'})));break;
    default: g.append(p('M35 37 C-8 15 16 -10 34 19 C54 -10 82 14 35 37 M13 35 Q35 8 57 35','none',{stroke:'#b97836','stroke-width':11,'stroke-linecap':'round'}));
  }
  return g;
}
function paintedCountry(c) {
  const card = document.createElement('section');
  card.className = 'scene country-card painted-country-card';
  card.setAttribute('aria-label', `${c.name} study card`);
  const heading = document.createElement('h2'); heading.textContent = c.name;
  heading.className = 'painted-heading';
  const picture = document.createElement('button'); picture.type = 'button';
  picture.className = 'painted-art-button'; picture.setAttribute('aria-label', `Enlarge the ${c.name} picture`);
  const image = document.createElement('img'); image.src = c.art;
  image.alt = `${c.name}: study the landmark, food, visitor and pigeons.`;
  image.decoding = 'async'; picture.append(image);
  picture.addEventListener('click', () => {
    const dialog = document.createElement('dialog'); dialog.className = 'country-picture-dialog';
    dialog.setAttribute('aria-label', `${c.name} enlarged picture`);
    const title = document.createElement('h2'); title.textContent = c.name;
    const large = document.createElement('img'); large.src = c.art; large.alt = image.alt;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn-primary'; close.textContent = 'Back to the card';
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.append(title,large,close); document.body.append(dialog); dialog.showModal();
  });
  const captions = document.createElement('div'); captions.className = 'painted-captions';
  for (const [label,value] of [['Capital',c.capital],['Food',c.food],['Animal',c.animal],['Did you know?',c.funFact]]) {
    const line = document.createElement('p');
    const key = document.createElement('strong'); key.textContent = `${label}: `;
    line.append(key,document.createTextNode(value)); captions.append(line);
  }
  card.append(heading,picture,captions);
  return card;
}

export function countryCard(c) {
  if (c.art) return paintedCountry(c);
  const svg=e('svg',{viewBox:'0 0 360 390',class:'scene country-card',role:'img','aria-label':`${c.name} study card. Study the illustration and labels.`},
    r(0,0,360,390,'#f9f5e9',{rx:18}),r(0,70,360,197,'#d9e9e2'),p('M0 204 Q42 168 95 191 Q172 212 200 169 Q253 138 360 185 L360 267 L0 267 Z','#adcda4'),p('M0 234 Q96 214 180 242 Q273 255 360 220 L360 267 L0 267 Z','#8cbec5'),
    t(16,44,c.name,c.name.length>9?28:34,{'font-family':'Georgia, serif'}),flag(c));
  for(let i=0;i<c.birds;i++) svg.append(p(`M${20+i*32} 94 q7 -9 14 0 q7 -9 14 0`,'none',{stroke:'#294b55','stroke-width':2.5}));
  svg.append(e('g',{transform:'translate(26 107) scale(.78)'},landmark(c.id)));
  const shirt={blue:'#2b63b4',red:'#c84743',yellow:'#f1bb35',green:'#2b8460'}[c.shirt];
  svg.append(e('g',{transform:'translate(278 155) scale(.8)'},e('circle',{cx:0,cy:0,r:17,fill:'#c88d64'}),p('M-16 -5 Q-20 -28 0 -24 Q20 -27 18 -5 Z','#4e392e'),p('M-17 24 Q0 12 17 24 L24 60 L-24 60 Z',shirt),line(-22,31,-34,51,'#c88d64',8),line(22,31,34,15,'#c88d64',8),line(-9,62,-15,92,'#28465e',10),line(9,62,15,92,'#28465e',10),e('circle',{cx:-6,cy:0,r:2,fill:'#193c43'}),e('circle',{cx:6,cy:0,r:2,fill:'#193c43'}),p('M-6 9 Q0 14 6 9','none',{stroke:'#6b3b31','stroke-width':2})));
  svg.append(r(10,228,210,33,'#f9f5e9',{rx:7,opacity:.94}),t(20,251,c.landmark,20,{'font-family':'Georgia, serif'}));
  svg.append(t(18,294,'CAPITAL',12,{'font-weight':700,fill:'#647c78','letter-spacing':2}),t(125,295,c.capital,23,{'font-family':'Georgia, serif'}));
  svg.append(t(18,331,'FOOD',12,{'font-weight':700,fill:'#647c78','letter-spacing':2}),t(125,333,c.food,23,{'font-family':'Georgia, serif'}),food(c.id));
  svg.append(line(18,346,342,346,'#d5dbcb',1),t(18,372,c.water,19,{'font-family':'Georgia, serif'}));
  return svg;
}
