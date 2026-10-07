import { ENGINE_VERSION } from './config.js';
import { decideCharacter } from './characters.js';
import { personalityOf } from './personalities.js';
                                                                                                             
export const fee = (price        , bps        ) => Math.floor(price * bps / 10000);
export const holdings = (a       ) => Object.values(a.inventory).reduce((n,l)=>n+l.length,0);
export const isFighter = (a       ) => a.strategy.endsWith('fighter');
export function random(seed        ) { // Mulberry32; unsigned 32-bit state, no clock dependency.
 let v=seed>>>0; return ()=>{v=(v+0x6D2B79F5)>>>0;let t=Math.imul(v^(v>>>15),v|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function primaryAsk(s       , item      ) {
 const c=s.manifest.config; return Math.floor((item.reference*(3*c.maxStock-s.markets[item.id].stock)+c.maxStock)/(2*c.maxStock));
}
export function affordable(cash        , bps        , cap        ) {
 let lo=0,hi=Math.min(cash,cap); while(lo<hi){const m=Math.ceil((lo+hi)/2);if(m+fee(m,bps)<=cash)lo=m;else hi=m-1;}return lo;
}
export function satisfaction(s       , a       , additional         ) {
 const total=[0,0,0,0,0,0]; const ids=additional?[...a.equipped,additional]:a.equipped;
 for(const id of ids){const i=s.manifest.config.items.find(i=>i.id===id) ;i.features.forEach((f,d)=>total[d]+=f*s.markets[id].multiplier);}
 return s.manifest.config.archetypes[a.archetype].weights.reduce((sum,w,d)=>sum+w*10*Math.log(1+total[d]/10),0);
}
function event(s       ,type        ,data                        ) {s.events.push({round:s.round,type,data});}
export const activeFighter = (s      ,a      ) => isFighter(a)&&(!s.manifest.config.league||s.round<Math.max(1,a.arrived??0)+s.manifest.config.league.waveEvery);
function arrive(s      ,wave       ){
 const c=s.manifest.config;let index=0;
 for(const [strategy,count] of [['value-fighter',c.valueFighters],['fixed-fighter',c.fixedFighters]]                       ){
  for(let n=0;n<count;n++){
   const archetype=index===0&&c.league?.spotlight?c.archetypes.findIndex(a=>a.champion===c.league .spotlight):(wave*(c.valueFighters+c.fixedFighters)+index)%c.archetypes.length;index++;
   const a      ={id:`wave-${wave}-${strategy}-${n+1}`,name:`${c.archetypes[archetype].name} · W${wave+1}`,strategy,archetype,cash:c.fighterCash,equipped:[],inventory:Object.fromEntries(c.items.map(i=>[i.id,[]])),profit:0,lastPurchase:s.round,decision:[],arrived:s.round,wave};
   if(c.story)a.memory={purchases:0,overpaid:0,missedBids:0,lastPaidBps:0};
   s.agents.push(a);s.externalCash+=a.cash;
  }
 }
 event(s,'champions-arrived',{wave:wave+1,count:c.valueFighters+c.fixedFighters,gold:(c.valueFighters+c.fixedFighters)*c.fighterCash});
}
export function initialize(manifest          )        {
 const m=structuredClone(manifest),c=m.config; const agents         =[];
 for(const [strategy,count,cash] of [['value-fighter',c.valueFighters,c.fighterCash],['fixed-fighter',c.fixedFighters,c.fighterCash],['value-trader',c.valueTraders,c.traderCash],['momentum-trader',c.momentumTraders,c.traderCash]]                              ){
  for(let n=0;n<count;n++){const index=agents.filter(isFighter).length;agents.push({id:`${strategy}-${n+1}`,name:`${strategy.includes('fighter')?c.archetypes[index%c.archetypes.length].name:strategy==='value-trader'?'Value':'Momentum'} ${n+1}`,strategy,archetype:index%c.archetypes.length,cash,equipped:[],inventory:Object.fromEntries(c.items.map(i=>[i.id,[]])),profit:0,lastPurchase:0,decision:[]});}
 }
 if(c.league)for(const a of agents){if(isFighter(a)){if(a.id==='value-fighter-1'&&c.league.spotlight)a.archetype=c.archetypes.findIndex(x=>x.champion===c.league .spotlight);a.name=`${c.archetypes[a.archetype].name} · W1`;a.arrived=0;a.wave=0;}else a.name=c.league.corner&&a.id==='value-trader-1'?'The Corner Attempt':a.strategy==='value-trader'?`Dealer ${a.id.split('-').at(-1)}`:`Trend Chaser ${a.id.split('-').at(-1)}`;}
 const s      ={manifest:m,round:0,agents,markets:Object.fromEntries(c.items.map(i=>[i.id,{stock:c.initialStock,manufactured:0,last:i.reference,lastRound:null,multiplier:1,paused:false,bestBid:null,bestAsk:null,history:[]}])),shop:0,fees:0,initialCash:agents.reduce((n,a)=>n+a.cash,0),externalCash:0,buyerFeeBps:c.buyerFeeBps,sellerFeeBps:c.sellerFeeBps,trades:[],events:[],metrics:[],orders:[]};
 if(c.story)for(const a of agents){a.memory={purchases:0,overpaid:0,missedBids:0,lastPaidBps:0};if(!isFighter(a))a.name=personalityOf(s,a) .label;}
 return s;
}
const reason = (rule        ,text        ,inputs                  ={})         => ({rule,text,inputs});
export function decide(s       , a       , priority        )          {
 const c=s.manifest.config; const orders         =[]; a.decision=[];
 if(c.story)return decideCharacter(s,a,priority,{satisfaction,activeFighter,primaryAsk,affordable,fee,holdings,isFighter});
 const submit=(side             ,i      ,p        ,r        )=>{p=Math.max(1,Math.min(c.priceCap*i.reference,Math.floor(p)));const o       ={id:`${s.round}:${a.id}:${side}`,owner:a.id,item:i.id,side,price:p,priority,reason:r};orders.push(o);a.decision.push(r);};
 const canBuy=(i      )=>holdings(a)<c.inventoryCap&&a.inventory[i.id].length<c.perItemCap;
 const offer=(i      )=>s.markets[i.id].bestAsk??(s.markets[i.id].stock?primaryAsk(s,i):i.reference);
 if(isFighter(a)){
  if(c.league&&!activeFighter(s,a)){a.decision=[reason('wave-complete','My shopping session ended. Equipped copies and remaining cash stay accounted for.')];return [];}
  if(a.equipped.length>=c.slots){a.decision=[reason('full-build','All gear slots are filled.')];return [];}
  if(a.strategy==='fixed-fighter'){
   const id=c.archetypes[a.archetype].shoppingList.find(id=>!a.equipped.includes(id));const i=c.items.find(i=>i.id===id);
   if(i){const limit=affordable(a.cash,s.buyerFeeBps,Math.min(i.reference*2,i.reference*c.priceCap));
    if(limit>=offer(i)){submit('bid',i,limit,reason('fixed-build',`I am saving for ${i.name}, the next item on my fixed list.`,{cash:a.cash,estimatedAsk:offer(i),limit,reference:i.reference}));}
    else a.decision=[reason('saving',`I am saving for ${i.name}.`,{cash:a.cash,estimatedAsk:offer(i),affordableLimit:limit})];
   } else a.decision=[reason('list-complete','My configured shopping list is complete.')];
  }else{
   const base=satisfaction(s,a);const candidates=c.items.filter(i=>!a.equipped.includes(i.id)&&(!c.league||!i.boots||!a.equipped.some(id=>c.items.find(x=>x.id===id) .boots))).map(i=>{const gain=Math.round((satisfaction(s,a,i.id)-base)*1e6)/1e6;const ask=offer(i);const cost=ask+fee(ask,s.buyerFeeBps);const limit=Math.min(Math.floor(c.willingness*gain),affordable(a.cash,s.buyerFeeBps,i.reference*c.priceCap));return {i,gain,ask,cost,limit,ratio:gain/cost};}).filter(x=>x.gain>0&&x.cost<=a.cash&&x.limit>=x.ask).sort((a,b)=>b.ratio-a.ratio||a.i.id.localeCompare(b.i.id));
   const x=candidates[0];if(x)submit('bid',x.i,x.limit,reason('marginal-value',`I need a useful upgrade; ${x.i.name} gives the best satisfaction per gold I can afford.`,{gain:x.gain,estimatedAsk:x.ask,estimatedCost:x.cost,ratio:x.ratio,cash:a.cash,willingness:Math.floor(c.willingness*x.gain),limit:x.limit}));
   else a.decision=[reason('no-affordable-upgrade','No useful upgrade meets my budget and willingness to pay.',{cash:a.cash,score:base})];
  }
 }else if(a.strategy==='value-trader'&&c.league?.demandTrading){
  const buyers=s.agents.filter(a=>activeFighter(s,a));
  const candidates=c.items.map(i=>{
   const demand=buyers.filter(b=>!b.equipped.includes(i.id)&&c.archetypes[b.archetype].shoppingList.includes(i.id)).length;
   const fair=i.reference*s.markets[i.id].multiplier;
   return {i,demand,fair,ask:offer(i),held:a.inventory[i.id]};
  }).sort((x,y)=>y.demand-x.demand||x.i.id.localeCompare(y.i.id));
  const target=candidates.find(x=>x.demand>0&&canBuy(x.i)&&offer(x.i)<=Math.min(x.fair*c.valueBuyBps/10000,affordable(a.cash,s.buyerFeeBps,x.i.reference*c.priceCap)));
  const corner=c.league.corner&&a.id==='value-trader-1';
  const focus=c.items.find(i=>i.name==='Infinity Edge')??c.items[0];
  const chosen=corner?candidates.find(x=>x.i.id===focus.id&&canBuy(x.i)):target;
  if(chosen&&(!corner||s.round<75)){
   const limit=Math.min(Math.floor(chosen.fair*(corner?1.8:c.valueBuyBps/10000)),affordable(a.cash,s.buyerFeeBps,chosen.i.reference*c.priceCap));
   if(limit>=chosen.ask)submit('bid',chosen.i,limit,reason(corner?'corner-attempt':'build-demand',`I compete for ${chosen.i.name}: ${chosen.demand} active champions have it on their build list.`,{demand:chosen.demand,fair:chosen.fair,estimatedAsk:chosen.ask,limit}));
  }
  const held=candidates.filter(x=>x.held.length).sort((x,y)=>x.held[0].round-y.held[0].round||x.i.id.localeCompare(y.i.id));
  const sale=held[0];
  if(sale&&(!corner||s.round>=75)){
   const age=s.round-sale.held[0].round;
   const markup=corner?1.8:Math.max(.7,c.valueSellBps/10000-age*.012);
   const price=Math.ceil(sale.fair*markup);
   submit('ask',sale.i,price,reason(age>30?'inventory-exit':'inventory-offer',`I offer ${sale.i.name}; my asking price falls as this inventory ages.`,{age,demand:sale.demand,fair:sale.fair,markup,oldestCost:sale.held[0].cost}));
  }
 }else if(a.strategy==='value-trader'){
  const bids=c.items.map(i=>{const fair=i.reference*s.markets[i.id].multiplier;const ask=offer(i);const limit=Math.min(Math.floor(fair*c.valueBuyBps/10000),affordable(a.cash,s.buyerFeeBps,c.priceCap*i.reference));return {i,fair,ask,limit,discount:1-ask/fair};}).filter(x=>canBuy(x.i)&&x.limit>=x.ask).sort((a,b)=>b.discount-a.discount||a.i.id.localeCompare(b.i.id));
  if(bids[0]){const x=bids[0];submit('bid',x.i,x.limit,reason('value-discount',`The public offer for ${x.i.name} is below my utility-adjusted valuation.`,{fair:x.fair,estimatedAsk:x.ask,discount:x.discount,limit:x.limit}));}
  const asks=c.items.filter(i=>a.inventory[i.id].length).map(i=>{const fair=i.reference*s.markets[i.id].multiplier;return {i,fair,premium:s.markets[i.id].last/fair-1};}).sort((a,b)=>b.premium-a.premium||a.i.id.localeCompare(b.i.id));
  if(asks[0]){const x=asks[0];submit('ask',x.i,Math.ceil(x.fair*c.valueSellBps/10000),reason('value-sale',`I offer ${x.i.name} above its utility-adjusted reference.`,{fair:x.fair,premium:x.premium,oldestCost:a.inventory[x.i.id][0].cost}));}
 }else{
  const trends=c.items.map(i=>{const h=s.markets[i.id].history.filter(h=>h.round>=s.round-c.momentumWindow&&h.price!==null);const trades=h.reduce((n,h)=>n+h.volume,0);const latest=h.at(-1)?.price??i.reference;const change=h.length?(latest/h[0].price -1):0;return {i,trades,latest,change};});
  const buys=trends.filter(x=>x.trades>=c.momentumMinTrades&&x.change>c.momentumThresholdBps/10000&&canBuy(x.i)).sort((a,b)=>b.change-a.change||a.i.id.localeCompare(b.i.id));
  for(const x of buys){const limit=Math.min(Math.floor(x.latest*c.momentumBuyBps/10000),affordable(a.cash,s.buyerFeeBps,c.priceCap*x.i.reference));if(limit>=offer(x.i)){submit('bid',x.i,limit,reason('momentum-buy',`Recent executed prices for ${x.i.name} rose; I expect a higher resale price.`,{trades:x.trades,change:x.change,latest:x.latest,limit}));break;}}
  const sells=trends.filter(x=>x.trades>=c.momentumMinTrades&&x.change< -c.momentumThresholdBps/10000&&a.inventory[x.i.id].length).sort((a,b)=>a.change-b.change||a.i.id.localeCompare(b.i.id));
  if(sells[0]){const x=sells[0];submit('ask',x.i,Math.floor(x.latest*c.momentumSellBps/10000),reason('momentum-exit',`Recent executed prices for ${x.i.name} fell; I try to exit.`,{trades:x.trades,change:x.change,latest:x.latest,oldestCost:a.inventory[x.i.id][0].cost}));}
  if(!orders.length)a.decision=[reason(trends.every(x=>x.trades<c.momentumMinTrades)?'insufficient-data':'hold','I hold: no executable trend signal.',{minimumTrades:c.momentumMinTrades})];
 }
 if(!a.decision.length)a.decision=[reason('hold','No qualifying public opportunity; I hold.',{cash:a.cash,inventory:holdings(a)})];
 return orders;
}
// Validation reserves original gold and copies before any settlement. One bid/ask per owner.
export function validateOrders(s       , proposed         ) {
 const c=s.manifest.config;const accepted         =[];const seen=new Set        ();const cash=new Map(s.agents.map(a=>[a.id,a.cash]));const copies=new Map               ();
 for(const a of s.agents)for(const i of c.items)copies.set(`${a.id}:${i.id}`,a.inventory[i.id].length);
 for(const i of c.items)copies.set(`shop:${i.id}`,s.markets[i.id].stock);
 for(const o of proposed){const i=c.items.find(i=>i.id===o.item),a=s.agents.find(a=>a.id===o.owner);let error='';
  const key=o.owner==='shop'?`shop:${o.item}:${o.side}`:`${o.owner}:${o.side}`;
  if(!i||(!a&&o.owner!=='shop')||!['bid','ask'].includes(o.side)||!Number.isSafeInteger(o.price)||o.price<1||o.price>c.priceCap*(i?.reference??0)||!Number.isFinite(o.priority))error='Invalid owner, item, side or price';
  else if(seen.has(key))error='At most one order per side';
  else if(o.side==='bid'){
   if(!a)error='Shop cannot bid';
   else if(o.price+fee(o.price,s.buyerFeeBps)>(cash.get(a.id)??0))error='Insufficient reserved gold including buyer fee';
   else if(isFighter(a)&&(a.equipped.length>=c.slots||a.equipped.includes(o.item)))error='No available gear slot';
   else if(isFighter(a)&&c.league&&(!activeFighter(s,a)||i.boots&&a.equipped.some(id=>c.items.find(x=>x.id===id) .boots)))error='Inactive champion or boots already equipped';
   else if(!isFighter(a)&&(holdings(a)>=c.inventoryCap||a.inventory[o.item].length>=c.perItemCap))error='Inventory cap (without assuming a sale)';
  }else if(a&&isFighter(a))error='Equipped goods cannot be sold';
  else if((copies.get(`${o.owner}:${o.item}`)??0)<1)error='No owned transferable copy';
  if(error){event(s,'order-rejected',{order:o,reason:error});continue;}
  seen.add(key);if(o.side==='bid')cash.set(o.owner,cash.get(o.owner) -o.price-fee(o.price,s.buyerFeeBps));else copies.set(`${o.owner}:${o.item}`,copies.get(`${o.owner}:${o.item}`) -1);
  accepted.push(o);event(s,'order-submitted',{order:o});
 } return accepted;
}
export function clear(s       , orders         ) {
 for(const item of [...s.manifest.config.items].sort((a,b)=>a.id.localeCompare(b.id))){
  const bids=orders.filter(o=>o.item===item.id&&o.side==='bid').sort((a,b)=>b.price-a.price||a.priority-b.priority||a.id.localeCompare(b.id));
  const asks=orders.filter(o=>o.item===item.id&&o.side==='ask').sort((a,b)=>a.price-b.price||a.priority-b.priority||a.id.localeCompare(b.id));
  const market=s.markets[item.id];
  // Lexicographic scan of ranked bids then ranked asks. Self-pairs are skipped, not removed.
  while(bids.length&&asks.length){let pair                      =null;
   for(let b=0;b<bids.length&&!pair;b++)for(let a=0;a<asks.length;a++){if(bids[b].price<asks[a].price)break;if(bids[b].owner!==asks[a].owner){pair=[b,a];break;}}
   if(!pair)break;const [bid]=bids.splice(pair[0],1),[ask]=asks.splice(pair[1],1);const price=Math.floor((bid.price+ask.price)/2);const buyerFee=fee(price,s.buyerFeeBps),sellerFee=fee(price,s.sellerFeeBps);
   const buyer=s.agents.find(a=>a.id===bid.owner) ;const seller=s.agents.find(a=>a.id===ask.owner);
   buyer.cash-=price+buyerFee;
   if(seller){const lot=seller.inventory[item.id].shift() ;seller.cash+=price-sellerFee;seller.profit+=price-sellerFee-lot.cost;}else{market.stock--;s.shop+=price-sellerFee;}
   s.fees+=buyerFee+sellerFee;
   const t       ={id:`trade-${s.trades.length+1}`,round:s.round,item:item.id,buyer:bid.owner,seller:ask.owner,price,buyerFee,sellerFee,bid:bid.price,ask:ask.price,buyerReason:bid.reason,sellerReason:ask.reason};s.trades.push(t);event(s,'trade-executed',{trade:t});
   if(buyer.memory){buyer.memory.purchases++;buyer.memory.lastPaidBps=Math.floor(price*10000/item.reference);if(price*100>=item.reference*150)buyer.memory.overpaid++;}
   if(isFighter(buyer)){buyer.equipped.push(item.id);buyer.lastPurchase=s.round;event(s,'item-equipped',{agent:buyer.id,item:item.id});}else buyer.inventory[item.id].push({cost:price+buyerFee,round:s.round});
   market.last=price;market.lastRound=s.round;
  }
  market.bestBid=bids[0]?.price??null;market.bestAsk=asks[0]?.price??null;
 }
}
function apply(s       , x              ) {
 for(const id of x.items){const m=s.markets[id];if(!m)throw new Error('Unknown intervention item');
  if(x.kind==='utility')m.multiplier=x.value;
  if(x.kind==='pause')m.paused=true;if(x.kind==='resume')m.paused=false;
  if(x.kind==='issue'){const count=Math.min(x.value,Math.max(0,s.manifest.config.maxStock-m.stock));m.stock+=count;m.manufactured+=count;event(s,'item-issued',{item:id,count,requested:x.value,source:'emergency'});}
 }
 if(x.kind==='fees'){s.buyerFeeBps=x.value;s.sellerFeeBps=x.sellerValue??x.value;}
 event(s,'intervention-applied',{intervention:x});
}
export function assertAccounting(s       ) {
 const cash=s.agents.reduce((n,a)=>n+a.cash,0)+s.shop+s.fees;
 if(cash!==s.initialCash+s.externalCash)throw new Error(`Cash conservation failed at round ${s.round}`);
 for(const a of s.agents){if(!Number.isSafeInteger(a.cash)||a.cash<0)throw new Error('Invalid cash');if(a.equipped.length>s.manifest.config.slots||new Set(a.equipped).size!==a.equipped.length)throw new Error('Invalid build');}
 if(s.manifest.config.league)for(const a of s.agents)if(a.equipped.filter(id=>s.manifest.config.items.find(i=>i.id===id) .boots).length>1)throw new Error('Multiple boots equipped');
 for(const i of s.manifest.config.items){const m=s.markets[i.id];const owned=s.agents.reduce((n,a)=>n+a.inventory[i.id].length+a.equipped.filter(id=>id===i.id).length,0);
  if(m.stock<0||!Number.isSafeInteger(m.stock)||owned+m.stock!==s.manifest.config.initialStock+m.manufactured)throw new Error(`Copy conservation failed: ${i.id}`);
 }
}
export function step(s       )        {
 if(s.round>=s.manifest.config.rounds)return s;
 s.round++;event(s,'round-start',{});const c=s.manifest.config;
 if(c.league&&s.round>1&&(s.round-1)%c.league.waveEvery===0&&(s.round-1)/c.league.waveEvery<c.league.waves)arrive(s,(s.round-1)/c.league.waveEvery);
 // Recompute multiplier from scheduled public interventions, including automatic expiry.
 for(const i of c.items)s.markets[i.id].multiplier=1;
 for(const x of s.manifest.interventions.filter(x=>x.kind==='utility'&&x.round<=s.round&&(!x.duration||s.round<x.round+x.duration)).sort((a,b)=>a.round-b.round))for(const id of x.items)s.markets[id].multiplier=x.value;
 for(const x of s.manifest.interventions.filter(x=>x.kind==='utility'&&x.duration&&x.round+x.duration===s.round))for(const id of x.items)event(s,'intervention-applied',{intervention:{...x,id:`${x.id}-${id}-expired`,items:[id],value:s.markets[id].multiplier},expired:true});
 for(const x of s.manifest.interventions.filter(x=>x.round===s.round))apply(s,x);
 if(s.round%c.productionEvery===0)for(const i of c.items){const m=s.markets[i.id];if(!m.paused&&m.stock<c.maxStock){m.stock++;m.manufactured++;event(s,'item-issued',{item:i.id,count:1,source:'production'});}}
 for(const a of s.agents.filter(isFighter))if(c.league?activeFighter(s,a)&&s.round-(a.arrived??0)<=c.incomeRounds:s.round<=c.incomeRounds){a.cash+=c.income;s.externalCash+=c.income;event(s,'income-issued',{agent:a.id,gold:c.income});}
 const rng=random((s.manifest.seed^Math.imul(s.round,0x9e3779b9))>>>0);const ids=[...s.agents.map(a=>a.id),'shop'];for(let j=ids.length-1;j>0;j--){const k=Math.floor(rng()*(j+1));[ids[j],ids[k]]=[ids[k],ids[j]];}const priorities=new Map(ids.map((id,n)=>[id,n]));
 const proposals=s.agents.flatMap(a=>decide(s,a,priorities.get(a.id) ));
 for(const i of c.items)if(s.markets[i.id].stock)proposals.push({id:`${s.round}:shop:${i.id}`,owner:'shop',item:i.id,side:'ask',price:primaryAsk(s,i),priority:priorities.get('shop') ,reason:reason('primary-supply','I offer one manufactured copy at the reference price plus the stock scarcity premium.',{stock:s.markets[i.id].stock,reference:i.reference,ask:primaryAsk(s,i)})});
 s.orders=validateOrders(s,proposals);const before=s.trades.length;clear(s,s.orders);const trades=s.trades.slice(before);
 if(c.story)for(const a of s.agents){if(s.orders.some(o=>o.owner===a.id&&o.side==='bid')&&!trades.some(t=>t.buyer===a.id))a.memory .missedBids++;}
 for(const i of c.items){const fills=trades.filter(t=>t.item===i.id);const m=s.markets[i.id];m.history.push({round:s.round,price:fills.length?fills.reduce((n,t)=>n+t.price,0)/fills.length:null,volume:fills.length,stock:m.stock,multiplier:m.multiplier});}
 assertAccounting(s);const fighters=s.agents.filter(isFighter),traders=s.agents.filter(a=>!isFighter(a));const count=traders.reduce((n,a)=>n+holdings(a),0);
 const metric={round:s.round,volume:trades.length,resale:trades.filter(t=>t.seller!=='shop').length,fighterPurchases:trades.filter(t=>isFighter(s.agents.find(a=>a.id===t.buyer) )).length,cash:s.agents.reduce((n,a)=>n+a.cash,0),shop:s.shop,fees:s.fees,externalCash:s.externalCash,completion:fighters.length?fighters.reduce((n,a)=>n+a.equipped.length,0)/(fighters.length*c.slots):0,satisfaction:fighters.length?fighters.reduce((n,a)=>n+satisfaction(s,a),0)/fighters.length:0,concentration:count?Math.max(0,...traders.map(a=>holdings(a)))/count:0,realizedProfit:traders.reduce((n,a)=>n+a.profit,0),markedInventory:traders.reduce((n,a)=>n+c.items.reduce((n,i)=>n+a.inventory[i.id].length*s.markets[i.id].last,0),0),averageWait:fighters.length?fighters.reduce((n,a)=>n+s.round-a.lastPurchase,0)/fighters.length:0};
 s.metrics.push(metric);event(s,'round-completed',{metrics:metric});return s;
}
export function run(manifest          , rounds=manifest.config.rounds) {const s=initialize(manifest);while(s.round<Math.min(rounds,manifest.config.rounds))step(s);return s;}
export function digest(s       ) { // FNV-1a integrity checksum, not a cryptographic signature.
 // V2's larger stat catalog exposes runtime-specific last-bit logarithm differences.
 // Preserve exact integers; canonicalize fractional diagnostic values to six decimals.
 // V1 keeps its original serialization so historical digests remain unchanged.
 const canonical=s.manifest.config.league?(_key       ,v        )=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*1e6)/1e6:v:undefined;
 const value=JSON.stringify({round:s.round,agents:s.agents,markets:s.markets,shop:s.shop,fees:s.fees,trades:s.trades,metrics:s.metrics},canonical);let h=2166136261;for(let n=0;n<value.length;n++)h=Math.imul(h^value.charCodeAt(n),16777619);return (h>>>0).toString(16).padStart(8,'0');
}
export function schedule(s       ,x              ) {
 if(!Number.isInteger(x.round)||x.round<=s.round||x.round>s.manifest.config.rounds)throw new Error('Schedule a future round within the run');
 if(s.manifest.interventions.length>=200||s.manifest.interventions.some(v=>v.id===x.id))throw new Error('Too many or duplicate interventions');
 if(!['utility','pause','resume','issue','fees'].includes(x.kind)||x.items.some(id=>!s.markets[id])||new Set(x.items).size!==x.items.length||x.kind!=='fees'&&!x.items.length)throw new Error('Invalid intervention');
 if(!Number.isFinite(x.value)||x.value<0||x.value>(x.kind==='utility'?5:x.kind==='fees'?10000:100)||x.kind==='utility'&&x.value<.1||x.kind!=='utility'&&!Number.isInteger(x.value))throw new Error('Invalid intervention value');
 if(x.duration!==undefined&&(!Number.isInteger(x.duration)||x.duration<1||x.duration>1000))throw new Error('Invalid duration');
 if(x.sellerValue!==undefined&&(!Number.isInteger(x.sellerValue)||x.sellerValue<0||x.sellerValue>10000))throw new Error('Invalid seller fee');
 s.manifest.interventions.push(structuredClone(x));
}
export { ENGINE_VERSION };

