const DAY = 86400000, now = Date.parse('2026-10-16T23:40:00Z');
const base = (o) => ({ v: 1, createdAt: o.t, updatedAt: o.t, notes: '', ...o });
const P = (n, s, c) => (c ? { name: n, stack: s, cards: c } : { name: n, stack: s });
const g = (name, sb, bb, stage, level, left) => ({ kind: 'mtt', name, sb, bb, ante: bb, anteType: 'bb', currency: '€', stage, level, playersLeft: left });
export const hands = [
  base({ id: 'h1', t: now - 20*60000, game: g('Main Event €550', 1000, 2000, 'bubble', 14, 58),
    players: [P('Hero',64000,['Ah','Qh']),P('',51000),P('Boné azul',120000,['Kc','Kd']),P('',38000),P('',72000),P('',45000),P('Reg alemão',88000),P('',30000),P('',96000)],
    button: 0, hero: 0, actions: [{p:3,kind:'fold'},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:6,kind:'raise',to:4400},{p:7,kind:'fold'},{p:8,kind:'fold'},{p:0,kind:'raise',to:12000},{p:1,kind:'fold'},{p:2,kind:'raise',to:30000},{p:6,kind:'fold'},{p:0,kind:'raise',to:64000},{p:2,kind:'call'}],
    board: ['Qd','8h','3h','2s','Jh'], tags: ['Bolha','Pote grande','Dúvida'], notes: 'Bolha a 58 com 54 pagos. O boné azul só tinha 3-betado uma vez em 3 horas. Fold era melhor?' }),
  base({ id: 'h2', t: now - 55*60000, game: g('Main Event €550', 800, 1600, 'mid', 12, 112),
    players: [P('',40000),P('Hero',71000,['7s','7d']),P('',52000),P('Fish casaco',33000,['As','9c']),P('',61000),P('',44000)],
    button: 0, hero: 1, actions: [{p:3,kind:'raise',to:3500},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:0,kind:'fold'},{p:1,kind:'call'},{p:2,kind:'fold'}],
    board: ['7c','Ah','2d','Ks','4h'], tags: ['Set','Value'], notes: '' }),
  base({ id: 'h3', t: now - 2*3600000, game: g('Main Event €550', 600, 1200, 'mid', 10, 160),
    players: [P('Hero',48000,['Kh','Jh']),P('',36000),P('Reg alemão',80000),P('',29000),P('',55000),P('',41000)],
    button: 0, hero: 0, actions: [{p:3,kind:'fold'},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:0,kind:'raise',to:2600},{p:1,kind:'fold'},{p:2,kind:'call'}],
    board: ['Th','9h','2c','5s','3d'], tags: ['Bluff','C-bet'], notes: 'Barrel em três ruas, ele largou.' }),
  base({ id: 'h4', t: now - DAY - 3600000, game: { kind: 'cash', name: 'Cash 2/5', sb: 2, bb: 5, ante: 0, anteType: 'none', currency: '€' },
    players: [P('',520),P('Hero',610,['Qs','Qc']),P('Calling station',900,['Jd','Td']),P('',480),P('',300),P('',700)],
    button: 0, hero: 1, actions: [{p:3,kind:'fold'},{p:4,kind:'raise',to:15},{p:5,kind:'fold'},{p:0,kind:'fold'},{p:1,kind:'raise',to:50},{p:2,kind:'call'},{p:4,kind:'fold'}],
    board: ['9s','8d','2h','Qd','7c'], tags: ['Cooler'], notes: '' }),
  base({ id: 'h5', t: now - 2*DAY, game: g('Turbo €150', 400, 800, 'ft', 18, 8),
    players: [P('Hero',22000,['Ad','Kd']),P('',60000),P('',41000),P('Boné azul',35000,['Ac','Jc'])],
    button: 0, hero: 0, actions: [{p:3,kind:'fold'},{p:0,kind:'raise',to:22000},{p:1,kind:'fold'},{p:2,kind:'fold'}],
    board: [], tags: ['Mesa final','Shove'], notes: '' }),
  base({ id: 'h6', t: now - 3*DAY, game: g('Deepstack €220', 300, 600, 'early', 6, 240),
    players: [P('',30000),P('Hero',31000,['5h','4h']),P('',28000),P('Nit',34000,['Ah','Ad']),P('',27000),P('',30000)],
    button: 0, hero: 1, actions: [{p:3,kind:'raise',to:1500},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:0,kind:'fold'},{p:1,kind:'call'},{p:2,kind:'fold'}],
    board: ['6h','3s','Jd','2c','Ks'], tags: ['Hero call','Dúvida'], notes: 'Fiz straight no turn.' }),
];
const sess = [];
const res = [[550,0],[550,1980],[150,0],[220,610],[550,0],[1100,0],[220,0],[150,540],[550,3120],[220,0],[150,0],[550,1350]];
res.forEach(([b,c],i)=>{ const st = now - (i+1)*7*DAY; sess.push({ id:'s'+i, kind:'mtt', name: ['Main Event','Deepstack','Turbo'][i%3]+' €'+b, venue:'Casino', currency:'€', startedAt: st, endedAt: st+6*3600000, breaks:[], buyIn:b, entries:1, addOn:0, cashOut:c, sb:100, bb:200, ante:200, anteType:'bb', tableSize:9, stack:0, stackLog:[], roster:[], notes:'' }); });
sess.unshift({ id:'live', kind:'mtt', name:'Main Event €550', venue:'Casino', currency:'€', startedAt: now-5*3600000, breaks:[], buyIn:550, entries:1, addOn:0, cashOut:0, sb:1000, bb:2000, ante:2000, anteType:'bb', level:14, stage:'bubble', tableSize:9, stack:64000,
  stackLog:[{t:now-5*3600000,stack:30000,level:1},{t:now-4*3600000,stack:41000,level:5},{t:now-3*3600000,stack:36000,level:8},{t:now-2*3600000,stack:52000,level:10},{t:now-3600000,stack:71000,level:12},{t:now-20*60000,stack:64000,level:14}],
  roster:['Hero','','Boné azul','','','','Reg alemão','',''], notes:'' });
export const sessions = sess;
export const players = [
  { id:'p1', name:'Boné azul', look:'Boné azul, mesa 12', tags:['Tight','Nit'], notes:'Só 3-beta com premiums.', createdAt: now-DAY, updatedAt: now },
  { id:'p2', name:'Reg alemão', look:'Óculos, hoodie preto', tags:['Reg','Agressivo'], notes:'Abre muito do CO e BTN.', createdAt: now-DAY, updatedAt: now },
  { id:'p3', name:'Fish casaco', look:'Casaco de cabedal', tags:['Fish','Calling station'], notes:'Paga até ao river com qualquer par.', createdAt: now-DAY, updatedAt: now },
];
export const settings = { inBB:false, currency:'€', nickname:'Hero', defaultTableSize:9, onboarded:true };
