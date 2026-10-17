// Original vector portraits. Visible traits mirror the server's question data.
const NS='http://www.w3.org/2000/svg';
const skin=['','#f7cfad','#dfaa7d','#b97850','#744733'];
const hair={black:'#20232b',brown:'#70432c',blonde:'#f4c34e',ginger:'#c65b2f',grey:'#c5c4d3',none:'#493229'};
function e(tag,attrs,...kids){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);for(const k of kids.flat())if(k)n.append(k);return n;}
const p=(d,fill,attrs={})=>e('path',{d,fill,...attrs});
const circle=(cx,cy,r,fill,attrs={})=>e('circle',{cx,cy,r,fill,...attrs});
export function portrait(c){
 const seed=[...c.id].reduce((a,x)=>a+x.charCodeAt(0),0),v=seed%3;
 const h=hair[c.hair],s=skin[c.skin],eye=['#4b7b81','#765839','#4e8064'][seed%3];
 const svg=e('svg',{viewBox:'0 0 100 106','aria-hidden':'true'},e('rect',{width:100,height:106,rx:12,fill:['#f5e4c8','#e3e8e6','#e9dfec'][v]}));
 if(c.long&&c.hair!=='none')svg.append(p(v===0?'M15 43 Q10 9 49 8 Q89 9 85 49 L94 96 L8 96 Z':'M17 47 Q8 10 50 8 Q88 10 84 49 Q98 77 83 94 L16 94 Q3 76 17 47 Z',h));
 svg.append(p('M10 106 Q12 84 41 81 L59 81 Q88 84 90 106 Z',c.colour),e('rect',{x:42,y:72,width:16,height:17,rx:6,fill:s}),p('M37 83 Q50 98 63 83','none',{stroke:'#ffffffaa','stroke-width':3}),circle(23,51,7,s),circle(77,51,7,s),e('ellipse',{cx:50,cy:48,rx:27,ry:32,fill:s}));
 if(c.hair!=='none'){
  if(v===0)svg.append(p('M23 49 Q13 16 40 10 Q79 1 79 46 L70 32 Q53 39 40 24 Q30 42 23 49 Z',h));
  else if(v===1)svg.append(p('M22 44 Q14 12 48 10 Q80 5 80 42 L69 32 L63 37 L52 25 L43 36 L34 30 Z',h));
  else svg.append(p('M22 49 L20 28 Q26 5 57 10 L85 7 L80 24 L73 29 L73 46 L67 31 Q42 34 31 25 L29 49 Z',h));
 }
 else svg.append(e('ellipse',{cx:40,cy:24,rx:8,ry:3,fill:'#ffffff55'}));
 // Eyebrows, white eyes, coloured irises and light catches give each face life.
 svg.append(p('M31 40 Q37 36 43 40 M57 40 Q63 36 69 40','none',{stroke:h,'stroke-width':2.5,'stroke-linecap':'round'}));
 for(const x of [37,63])svg.append(e('ellipse',{cx:x,cy:48,rx:6.7,ry:7.3,fill:'#fff'}),circle(x,49,4.5,eye),circle(x,49,2.4,'#1c2830'),circle(x+1.3,47.3,1.4,'#fff'));
 svg.append(p('M49 51 Q44 60 51 60','none',{stroke:'#6e3b343d','stroke-width':2.5,'stroke-linecap':'round'}));
 if(c.beard)svg.append(p('M24 58 Q32 72 39 64 Q50 71 61 64 Q70 72 76 58 Q77 86 50 89 Q23 84 24 58 Z',h));
 if(c.moustache)svg.append(p('M50 63 Q41 59 34 68 Q40 73 50 67 Q60 73 66 68 Q59 59 50 63 Z',h));
 if(c.smiling)svg.append(p('M40 71 Q50 75 60 71 Q58 82 50 82 Q42 82 40 71 Z','#783f3b'),p('M42 72 Q50 76 58 72 L56 77 L44 77 Z','#fff'));
 else svg.append(p('M43 75 Q50 73 57 75','none',{stroke:'#713d37','stroke-width':2.5,'stroke-linecap':'round'}));
 if(c.glasses)svg.append(...[37,63].map(x=>e(v===1?'rect':'circle',v===1?{x:x-10,y:38,width:20,height:20,rx:4,fill:'none',stroke:['#3b4859','#7b3f52','#2d4a62'][v],'stroke-width':3}:{cx:x,cy:48,r:10,fill:'none',stroke:['#3b4859','#7b3f52','#2d4a62'][v],'stroke-width':3})),p('M47 46 Q50 43 53 46 M22 44 L27 46 M73 46 L78 44','none',{stroke:'#374351','stroke-width':3}));
 if(c.earrings)svg.append(...[23,77].map(x=>circle(x,62,4.5,'#f7cd54',{stroke:'#956c27','stroke-width':1})));
 if(c.hat){
  const colour=['#73548c','#3e6077','#a34e3b'][v];
  svg.append(p(v===0?'M21 25 Q14 3 48 3 Q80 2 80 25 Z':v===1?'M22 27 L27 7 Q49 -1 73 7 L78 27 Z':'M18 27 Q13 6 47 6 Q75 3 80 26 Z',colour),e('rect',{x:13,y:25,width:75,height:7,rx:3,fill:colour}),p('M24 23 L76 23','none',{stroke:'#ffffff66','stroke-width':4}));
  if(c.hair!=='none')svg.append(p('M22 33 L29 33 L28 46 L22 49 Z M71 33 L78 33 L78 49 L72 46 Z',h));
 }
 return svg;
}
