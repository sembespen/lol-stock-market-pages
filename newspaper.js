import { holdings, isFighter } from './engine.js';
import { personalityOf } from './personalities.js';
                                                      
                                                                                                                                                                           
                                                                                                                                 
const gold=(n       )=>Math.round(n).toLocaleString('en-US');
// Receipts rebuild FIFO inventory at the issue round. Old editions never use later holdings or profit.
export function receipts(s      ,round=s.round){
 const lots=new Map                                     (),profit=new Map               (),gear=new Map               (),rows                                   =[];
 for(const t of s.trades){if(t.round>round)break;let realized            =null;
  if(t.seller!=='shop'){const lot=lots.get(`${t.seller}:${t.item}`)?.shift();if(!lot)throw new Error('Missing newspaper FIFO receipt');realized=t.price-t.sellerFee-lot.cost;profit.set(t.seller,(profit.get(t.seller)??0)+realized);}
  const buyer=s.agents.find(a=>a.id===t.buyer) ;
  if(isFighter(buyer))gear.set(t.buyer,(gear.get(t.buyer)??0)+1);
  else {const key=`${t.buyer}:${t.item}`,list=lots.get(key)??[];list.push({cost:t.price+t.buyerFee,round:t.round});lots.set(key,list);}
  rows.push({trade:t,profit:realized});
 }
 return {lots,profit,gear,rows};
}
export function editionRounds(s      )         {
 const rounds=new Set        ([0]);for(let r=25;r<=s.round;r+=25)rounds.add(r);
 if(s.manifest.config.bazaar)for(const m of s.metrics)rounds.add(m.round);
 if(s.round===s.manifest.config.rounds)rounds.add(s.round);
 for(const e of s.events)if(e.type==='champions-arrived'||e.type==='intervention-applied'&&!e.data.expired)rounds.add(e.round);
 const resale=s.trades.find(t=>t.seller!=='shop'),splurge=s.trades.find(t=>t.price>=s.manifest.config.items.find(i=>i.id===t.item) .reference*2);
 if(resale)rounds.add(resale.round);if(splurge)rounds.add(splurge.round);
 return [...rounds].sort((a,b)=>a-b);
}
export function editionAt(s      ,round       )         {
 if(!editionRounds(s).includes(round))throw new Error('No published edition at this round');
 const c=s.manifest.config,r=receipts(s,round),articles          =[];
 const agent=(id       )=>s.agents.find(a=>a.id===id) ;
 const name=(id       )=>id==='shop'?'the primary shop':agent(id).name;
 const it=(id       )=>c.items.find(i=>i.id===id) ;
 const commentary=(a      ,kind                           )=>personalityOf(s,a)?.[kind];
 const previous=editionRounds(s).filter(n=>n<round).at(-1)??0;
 const recent=r.rows.filter(x=>x.trade.round>previous);
 if(round===0){
  const count=c.valueFighters+c.fixedFighters,cast=c.story?.traders;
  articles.push({id:'opening',beat:'OPENING BELL',title:c.bazaar?'Eight customers, four stalls, ten days of receipts':'Local economy entrusted to people with swords',body:`${count} champion shoppers and ${c.valueTraders+c.momentumTraders} traders enter with ${gold(s.initialCash)} gold. Equipment is useful. Resale is possible. Financial restraint is entirely optional. ${c.bazaar?'The Ledger returns after each market day. Eight recurring customers have finite builds; sales are not guaranteed.':'The Ledger will return every 25 rounds, with extra editions when the receipts warrant it.'}`,evidence:`Round 0 · ${count} shoppers · ${c.valueTraders+c.momentumTraders} traders · ${gold(s.initialCash)} initial gold`});
  if(cast?.length)articles.push({id:'cast',beat:'MEET THE MERCHANTS',title:c.bazaar?'Meet the stalls competing for these customers':'A bagholder, a goblin and a baron walk into a shop',body:cast.slice(0,4).map(p=>p.label+': '+p.blurb).join(' ')+' These are strategies, not promises. The auction will have the final word.',evidence:'Configured trader personalities · inventory and cash caps apply'});
 }else{
  if(c.bazaar){const consequence=s.events.filter(e=>e.round===round&&e.type==='bazaar-consequence'&&/counteroffer|walked away|trust|without a sale|alternative/.test(String(e.data.text))).at(-1);if(consequence)articles.push({id:`counter-${round}`,beat:'AT THE COUNTER',title:String(consequence.data.text).split('. ')[0],body:String(consequence.data.text),evidence:`Recorded bazaar consequence · day ${round}`});}
  const publicEvent=s.events.find(e=>e.round===round&&(e.type==='champions-arrived'||e.type==='intervention-applied'&&!e.data.expired));
  if(publicEvent){
   if(publicEvent.type==='champions-arrived')articles.push({id:`wave-${round}`,beat:'FRESH WALLETS',title:'New shopping wave arrives; merchants practice looking innocent',body:`Wave ${publicEvent.data.wave} brings ${publicEvent.data.count} champion buyers and ${gold(publicEvent.data.gold          )} gold in recorded starting cash. Prior shoppers keep their equipment and remaining gold, but their shopping session is over. Traders stay at their stalls.`,evidence:`R${round} · champions-arrived event · ${gold(publicEvent.data.gold          )} gold issued`});
   else {const iv=publicEvent.data.intervention                                              ;const market=iv.items[0]?it(iv.items[0]):null;articles.push({id:`event-${round}`,beat:'PUBLIC NOTICE',title:iv.kind==='pause'?'Production stops. The shoes do not grow on trees.':iv.kind==='resume'?'Supply returns; scarcity enthusiasts request privacy':iv.kind==='utility'?'Fictional utility change gives merchants something to shout about':iv.kind==='fees'?'Treasury revises its share of everybody’s business':'Emergency stock enters through the front door',body:`A logged ${iv.kind} intervention affects ${iv.kind==='fees'?'transaction fees':iv.items.length+' item markets'}${market?', including '+market.name:''}. ${iv.kind==='utility'?'The public utility multiplier becomes '+iv.value+'×.':iv.kind==='issue'?iv.value+' copies per market were requested; shop capacity still applies.':'The rule change is public and recorded.'} No one gets to rewrite completed trades.`,item:market?.id,evidence:`R${round} · intervention ${iv.id} · value ${iv.value}`});}
  }
  const sale=recent.filter(x=>x.profit!==null).sort((x,y)=>Math.abs(y.profit )-Math.abs(x.profit )||x.trade.id.localeCompare(y.trade.id))[0];
  const expensive=recent.filter(x=>isFighter(agent(x.trade.buyer))).sort((x,y)=>y.trade.price/it(y.trade.item).reference-x.trade.price/it(x.trade.item).reference||x.trade.id.localeCompare(y.trade.id))[0];
  if(sale){const t=sale.trade,a=agent(t.seller),gain=sale.profit ;articles.push({id:`sale-${t.id}`,beat:gain<0?'LESSONS WERE LEARNED':'ACTUAL RESALE',title:c.bazaar?`${name(t.buyer)} buys ${it(t.item).name}; ${a.name} records ${gain<0?'−':'+'}${gold(Math.abs(gain))} g`:(gain<0?`${a.name} successfully converts stock into regret`:`${a.name} finds an actual customer. Economists take notes.`),body:`${name(t.buyer)} paid ${gold(t.price)} gold for ${it(t.item).name} at round ${t.round}. After the seller fee and original FIFO purchase cost, ${a.name} ${gain<0?'lost':'earned'} ${gold(Math.abs(gain))} gold on this copy. ${gain<0?'The sale is real. So is the lesson.':'A buyer actually showed up; a rising display price alone would not have paid the bills.'}`,quote:commentary(a,gain<0?'loss':'sell'),speaker:a.name,agent:a.id,item:t.item,trade:t.id,evidence:`${t.id} · R${t.round} · price ${gold(t.price)} · seller fee ${t.sellerFee} · FIFO profit ${gain}`});}
  if(expensive&&articles.length<3&&(!c.bazaar||expensive.trade.id!==sale?.trade.id)){const t=expensive.trade,a=agent(t.buyer),ratio=t.price/it(t.item).reference;articles.push({id:`purchase-${t.id}`,beat:'SHOPPING & CONSEQUENCES',title:ratio>=1.5?`${a.name} pays extra. Item declines to become extra shiny.`:`${a.name} acquires gear; wallet files a smaller balance`,body:`${it(t.item).name} changed hands for ${gold(t.price)} gold, ${ratio.toFixed(2)}× its shop reference, plus ${t.buyerFee} gold in buyer fees. ${a.name} equipped it permanently. The recorded decision: ${t.buyerReason.text}`,quote:commentary(a,'buy'),speaker:a.name,agent:a.id,item:t.item,trade:t.id,evidence:`${t.id} · R${t.round} · shop reference ${gold(it(t.item).reference)} · price ${gold(t.price)} · buyer fee ${t.buyerFee}`});}
  const holders=s.agents.filter(a=>!isFighter(a)).map(a=>({a,lots:[...r.lots.entries()].filter(([key])=>key.startsWith(a.id+':')).flatMap(([,v])=>v)})).filter(x=>x.lots.length).sort((x,y)=>y.lots.length-x.lots.length||x.a.id.localeCompare(y.a.id));
  if(holders[0]&&articles.length<3&&(!c.bazaar||round===c.rounds||recent.some(row=>row.trade.buyer===holders[0].a.id)||round%3===0)){const x=holders[0],cost=x.lots.reduce((n,l)=>n+l.cost,0),oldest=round-Math.min(...x.lots.map(l=>l.round));articles.push({id:`stock-${x.a.id}-${round}`,beat:'THE INVENTORY WATCH',title:`${x.a.name} owns ${x.lots.length} ${x.lots.length===1?'copy':'copies'}. Customers remain a separate purchase.`,body:`Our continuing inventory watch finds ${gold(cost)} gold of original, fee-inclusive cost still tied up in ${x.lots.length} unsold copies. The oldest has waited ${oldest} rounds. Realized trading profit so far: ${gold(r.profit.get(x.a.id)??0)} gold. Held stock is not a completed sale.`,quote:commentary(x.a,'wait'),speaker:x.a.name,agent:x.a.id,evidence:`Snapshot at R${round} · ${x.lots.length} FIFO lots · cost ${gold(cost)} · oldest age ${oldest}`});}
  if(!articles.length)articles.push({id:`quiet-${round}`,beat:'AN UNEVENTFUL DEVELOPMENT',title:c.bazaar?`Day ${round}: ${recent.length} recorded trades, no featured retail sale`:'Market fails to collapse on schedule. Paper prints anyway.',body:`${recent.length} trades were recorded since the previous edition. There was no qualifying resale, champion purchase or public rule change for this front page. Sometimes everyone just waits. Our dramatic correspondent is taking it poorly.`,evidence:`Rounds ${previous+1}–${round} · ${recent.length} executed trades`});
 }
 const classifieds=['Wanted: actual buyer. Must possess actual gold.','For sale: confidence. Receipt not included.','Lost: shopping discipline. Last seen near the item board.','Accounting department seeks fewer creative interpretations.'];
 return {round,breaking:round!==0&&round%25!==0&&round!==c.rounds,articles:c.bazaar?articles.slice(0,2):articles,classified:classifieds[Math.floor(round/25)%classifieds.length],trades:r.rows.length,resales:r.rows.filter(x=>x.profit!==null).length};
}
export function awards(s      )          {
 const r=receipts(s),rows          =[];const names=(id       )=>s.agents.find(a=>a.id===id) .name;
 const expensive=r.rows.filter(x=>isFighter(s.agents.find(a=>a.id===x.trade.buyer) )).sort((a,b)=>b.trade.price/s.manifest.config.items.find(i=>i.id===b.trade.item) .reference-a.trade.price/s.manifest.config.items.find(i=>i.id===a.trade.item) .reference)[0];
 if(expensive){const t=expensive.trade,i=s.manifest.config.items.find(i=>i.id===t.item) ;rows.push({id:'overpay-award',beat:'THE GOLDEN RECEIPT',title:'Largest reference premium',body:`${names(t.buyer)} · ${gold(t.price)} g for ${i.name} · ${(t.price/i.reference).toFixed(2)}× reference`,agent:t.buyer,item:t.item,trade:t.id,evidence:`${t.id} · R${t.round} · reference ${i.reference}`});}
 const best=r.rows.filter(x=>x.profit!==null&&x.profit>0).sort((a,b)=>b.profit -a.profit )[0];
 if(best)rows.push({id:'resale-award',beat:'A BUYER REALLY EXISTED',title:'Best actual resale',body:`${names(best.trade.seller)} · +${gold(best.profit )} g after fees and FIFO cost`,agent:best.trade.seller,item:best.trade.item,trade:best.trade.id,evidence:`${best.trade.id} · R${best.trade.round} · FIFO profit ${best.profit}`});
 const holder=s.agents.filter(a=>!isFighter(a)).sort((a,b)=>holdings(b)-holdings(a))[0];
 if(holder&&holdings(holder))rows.push({id:'inventory-award',beat:'THE VERY PATIENT COLLECTION',title:'Largest unsold collection',body:`${holder.name} · ${holdings(holder)} copies still held · ${gold(holder.profit)} g realized profit`,agent:holder.id,evidence:`End-of-run inventory · R${s.round} · no forced liquidation`});
 return rows;
}
