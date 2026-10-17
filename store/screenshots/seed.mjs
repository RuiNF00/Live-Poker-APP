const DAY = 86400000, now = Date.parse('2026-10-16T23:40:00Z');
const base = (o) => ({ v: 1, createdAt: o.t, updatedAt: o.t, notes: '', ...o });
const P = (n, s, c) => (c ? { name: n, stack: s, cards: c } : { name: n, stack: s });
const g = (name, sb, bb, stage, level, left) => ({ kind: 'mtt', name, sb, bb, ante: bb, anteType: 'bb', currency: '$', stage, level, playersLeft: left });
export const hands = [
  base({ id: 'h7', t: now - 3*DAY - 2*3600000, game: g('$50K Super High Roller', 1500, 3000, 'ft', 20, 6),
    players: [P('',120000),P('',150000),P('',95000),P('Hero',210000,['Jc','Jd']),P('Reg alemão',260000,['Ad','Kh']),P('',180000)],
    button: 4, hero: 3, actions: [{p:1,kind:'fold'},{p:2,kind:'fold'},{p:3,kind:'raise',to:6600},{p:4,kind:'raise',to:21000},{p:5,kind:'fold'},{p:0,kind:'fold'},{p:3,kind:'raise',to:210000},{p:4,kind:'call'}],
    board: ['As','9c','4d','7s','2h'], board2: ['Js','6d','3c','Tc','5h'], tags: ['Mesa final','Run it twice'], notes: '' }),

  base({ id: 'h1', t: now - 20*60000, game: g('$25K High Roller', 1000, 2000, 'bubble', 14, 58),
    players: [P('Hero',64000,['Ah','Qh']),P('',51000),P('Boné azul',120000,['Kc','Kd']),P('',38000),P('',72000),P('',45000),P('Reg alemão',88000),P('',30000),P('',96000)],
    button: 0, hero: 0, actions: [{p:3,kind:'fold'},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:6,kind:'raise',to:4400},{p:7,kind:'fold'},{p:8,kind:'fold'},{p:0,kind:'raise',to:12000},{p:1,kind:'fold'},{p:2,kind:'raise',to:30000},{p:6,kind:'fold'},{p:0,kind:'raise',to:64000},{p:2,kind:'call'}],
    board: ['Qd','8h','3h','2s','Jh'], tags: ['Bolha','Pote grande','Dúvida'], notes: 'Bolha a 58 com 54 pagos. O boné azul só tinha 3-betado uma vez em 3 horas. Fold era melhor?' }),
  base({ id: 'h2', t: now - 55*60000, game: g('$25K High Roller', 800, 1600, 'mid', 12, 112),
    players: [P('',40000),P('Hero',71000,['7s','7d']),P('',52000),P('Fish casaco',33000,['As','9c']),P('',61000),P('',44000)],
    button: 0, hero: 1, actions: [{p:3,kind:'raise',to:3500},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:0,kind:'fold'},{p:1,kind:'call'},{p:2,kind:'fold'},{p:1,kind:'check'},{p:3,kind:'bet',to:4000},{p:1,kind:'call'},{p:1,kind:'check'},{p:3,kind:'check'},{p:1,kind:'bet',to:20000},{p:3,kind:'call'}],
    board: ['7c','Ah','2d','Ks','4h'], tags: ['Set','Value'], notes: '' }),
  base({ id: 'h3', t: now - 2*3600000, game: g('$25K High Roller', 600, 1200, 'mid', 10, 160),
    players: [P('Hero',48000,['Kh','Jh']),P('',36000),P('Reg alemão',80000),P('',29000),P('',55000),P('',41000)],
    button: 0, hero: 0, actions: [{p:3,kind:'fold'},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:0,kind:'raise',to:2600},{p:1,kind:'fold'},{p:2,kind:'call'},{p:2,kind:'check'},{p:0,kind:'bet',to:3000},{p:2,kind:'call'},{p:2,kind:'check'},{p:0,kind:'bet',to:8000},{p:2,kind:'call'},{p:2,kind:'check'},{p:0,kind:'bet',to:20000},{p:2,kind:'fold'}],
    board: ['Th','9h','2c','5s','3d'], tags: ['Bluff','C-bet'], notes: 'Barrel em três ruas, ele largou.' }),
  base({ id: 'h4', t: now - DAY - 3600000, game: { kind: 'cash', name: 'Cash 25/50', sb: 25, bb: 50, ante: 0, anteType: 'none', currency: '$' },
    players: [P('',520),P('Hero',610,['Qs','Qc']),P('Calling station',900,['Jd','Td']),P('',480),P('',300),P('',700)],
    button: 0, hero: 1, actions: [{p:3,kind:'fold'},{p:4,kind:'raise',to:125},{p:5,kind:'fold'},{p:0,kind:'fold'},{p:1,kind:'raise',to:400},{p:2,kind:'call'},{p:4,kind:'fold'},{p:1,kind:'bet',to:210},{p:2,kind:'call'}],
    board: ['9s','8d','2h','Qd','7c'], tags: ['Cooler'], notes: '' }),
  base({ id: 'h5', t: now - 2*DAY, game: g('$10K Turbo', 400, 800, 'ft', 18, 8),
    players: [P('Hero',22000,['Ad','Kd']),P('',60000),P('',41000),P('Boné azul',35000,['Ac','Jc'])],
    button: 0, hero: 0, actions: [{p:3,kind:'fold'},{p:0,kind:'raise',to:22000},{p:1,kind:'fold'},{p:2,kind:'fold'}],
    board: [], tags: ['Mesa final','Shove'], notes: '' }),
  base({ id: 'h6', t: now - 3*DAY, game: g('$50K Super High Roller', 300, 600, 'early', 6, 240),
    players: [P('',30000),P('Hero',31000,['5h','4h']),P('',28000),P('Nit',34000,['Ah','Ad']),P('',27000),P('',30000)],
    button: 0, hero: 1, actions: [{p:3,kind:'raise',to:1500},{p:4,kind:'fold'},{p:5,kind:'fold'},{p:0,kind:'fold'},{p:1,kind:'call'},{p:2,kind:'fold'},{p:1,kind:'check'},{p:3,kind:'bet',to:2000},{p:1,kind:'call'},{p:1,kind:'check'},{p:3,kind:'bet',to:5000},{p:1,kind:'raise',to:14000},{p:3,kind:'call'},{p:1,kind:'bet',to:13500},{p:3,kind:'call'}],
    board: ['6h','3s','Jd','2c','Ks'], tags: ['Hero call','Dúvida'], notes: 'Fiz straight no turn.' }),
];
const sess = [];
const res = [[25000,0],[25000,88000],[10000,0],[50000,131000],[25000,0],[10000,0],[50000,0],[10000,41500],[25000,154000],[50000,0],[10000,0],[25000,62000]];
res.forEach(([b,c],i)=>{ const st = now - (i+1)*7*DAY; sess.push({ id:'s'+i, kind:'mtt', name: '$'+(b/1000)+'K '+({10000:'Turbo',25000:'High Roller',50000:'Super High Roller'})[b], venue:'Nassau', currency:'$', startedAt: st, endedAt: st+6*3600000, breaks:[], buyIn:b, entries:1, addOn:0, cashOut:c, sb:100, bb:200, ante:200, anteType:'bb', tableSize:9, stack:0, stackLog:[], roster:[], notes:'' }); });
sess.unshift({ id:'live', kind:'mtt', name:'$25K High Roller', venue:'Nassau', currency:'$', startedAt: now-5*3600000, breaks:[], buyIn:25000, entries:1, addOn:0, cashOut:0, sb:1000, bb:2000, ante:2000, anteType:'bb', level:14, stage:'bubble', tableSize:9, stack:64000,
  stackLog:[{t:now-5*3600000,stack:30000,level:1},{t:now-4*3600000,stack:41000,level:5},{t:now-3*3600000,stack:36000,level:8},{t:now-2*3600000,stack:52000,level:10},{t:now-3600000,stack:71000,level:12},{t:now-20*60000,stack:64000,level:14}],
  roster:['Hero','','Boné azul','','','','Reg alemão','',''], notes:'' });
export const sessions = sess;
export const players = [
  { id:'p1', name:'Boné azul', look:'Boné azul, mesa 12', tags:['Tight','Nit'], notes:'Só 3-beta com premiums.', createdAt: now-DAY, updatedAt: now },
  { id:'p2', name:'Reg alemão', look:'Óculos, hoodie preto', tags:['Reg','Agressivo'], notes:'Abre muito do CO e BTN.', createdAt: now-DAY, updatedAt: now },
  { id:'p3', name:'Fish casaco', look:'Casaco de cabedal', tags:['Fish','Calling station'], notes:'Paga até ao river com qualquer par.', createdAt: now-DAY, updatedAt: now },
];
export const settings = { inBB:false, currency:'$', nickname:'Hero', defaultTableSize:9, onboarded:true };
// A festival trip covering the last three weekly sessions and the live one, with travel costs.
export const trips = [{ id:'t1', name:'Bahamas', venue:'Nassau', currency:'$', from: now-22*DAY, to: now+3*DAY, createdAt: now-23*DAY,
  expenses: [
    { id:'e1', kind:'flight', amount:1850, currency:'$', at: now-22*DAY, note:'' },
    { id:'e2', kind:'hotel', amount:4200, currency:'$', at: now-22*DAY, note:'' },
    { id:'e3', kind:'food', amount:960, currency:'$', at: now-10*DAY, note:'' },
    { id:'e4', kind:'coaching', amount:1500, currency:'$', at: now-15*DAY, note:'' },
  ] }];
// "Quem eu banco": statements three players sent this backer (positive bal = the player owes the backer).
const row = (dd, n, sh, c, o, e = true) => ({ d: now - dd*DAY, e: e ? now - dd*DAY + 7*3600000 : null, n, k: 'mtt', sh, mu: 1.1, c, o });
export const backing = [
  { id:'b1', createdAt: now-30*DAY, statement: { v:1, id:'b1', pl:'Miguel T.', bk:'Hero', cur:'$', at: now-DAY, bal: 18400, mk: 0, inv: 27500, res: 18400,
    rows: [row(1,'$25K High Roller',20,5500,0,false), row(8,'$10K Turbo',25,2750,23900), row(15,'$50K Super High Roller',10,5500,0)] } },
  { id:'b2', createdAt: now-40*DAY, statement: { v:1, id:'b2', pl:'Ana R.', bk:'Hero', cur:'$', at: now-2*DAY, bal: 6200, mk: 0, inv: 11000, res: 6200,
    rows: [row(2,'$10K Turbo',30,3300,9500), row(9,'$25K High Roller',15,4125,0)] } },
  { id:'b3', createdAt: now-50*DAY, statement: { v:1, id:'b3', pl:'Kenji S.', bk:'Hero', cur:'$', at: now-3*DAY, bal: -2750, mk: 8250, inv: 8250, res: -8250,
    rows: [row(3,'$25K High Roller',30,8250,0)] } },
];
