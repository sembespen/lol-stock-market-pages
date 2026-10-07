import { characterRoll, personalityOf } from './personalities.js';
                                                                    
                   
                                                                                                                                
                                                                                                                                                      
 
export function decideCharacter(s      ,a      ,priority       ,h        )         {
 const c=s.manifest.config,p=personalityOf(s,a) ;const orders        =[];
 const why=(rule       ,text       ,inputs                 ={})       =>({rule,text,inputs:{personality:p.label,...inputs}});
 const hold=(rule       ,text       ,inputs                 ={})=>{a.decision=[why(rule,text,inputs)];return orders;};
 const submit=(side              ,i     ,price       ,r       )=>{const o      ={id:`${s.round}:${a.id}:${side}`,owner:a.id,item:i.id,side,price:Math.max(1,Math.min(c.priceCap*i.reference,Math.floor(price))),priority,reason:r};orders.push(o);a.decision.push(r);};
 const offer=(i     )=>s.markets[i.id].bestAsk??(s.markets[i.id].stock?h.primaryAsk(s,i):null);
 if(h.isFighter(a)){
  if(!h.activeFighter(s,a))return hold('wave-complete','My shopping session ended. Cash and gear remain accounted for.');
  if(a.equipped.length>=c.slots)return hold('full-build','All slots filled. The wallet may now recover.');
  const list=c.archetypes[a.archetype].shoppingList;
  const eligible=(i     )=>!a.equipped.includes(i.id)&&(!i.boots||!a.equipped.some(id=>c.items.find(i=>i.id===id) .boots));
  const next=list.find(id=>eligible(c.items.find(i=>i.id===id) ));
  const wait=s.round-a.lastPurchase;
  const elapsed=s.round-(a.arrived??0),reserve=elapsed<=c.league .waveEvery/2?Math.floor(c.fighterCash*p.reserveBps/10000):0;
  const regret=Math.min(3500,(a.memory?.overpaid??0)*p.memoryBps);
  const urgency=Math.min(4000,Math.max(0,wait-p.patience)*120);
  const maxPayBps=Math.max(10000,p.maxPayBps+urgency-regret);
  const base=h.satisfaction(s,a);
  const flexible=a.strategy==='value-fighter'||p.impulseBps>=3000||p.prestigeBps>=3000;
  const options=c.items.filter(i=>eligible(i)&&(flexible||i.id===next)).map(i=>{
   const gain=Math.round((h.satisfaction(s,a,i.id)-base)*1e6)/1e6,ask=offer(i);
   const impulse=1+p.impulseBps/10000*(characterRoll(s.manifest.seed,`${a.id}:${i.id}:${Math.floor(s.round/3)}`)*2-1);
   const loyalty=list.includes(i.id)?1+p.loyaltyBps/10000:1;
   const prestige=1+p.prestigeBps/10000*Math.min(1,i.reference/4000);
   const cost=ask===null?Infinity:ask+h.fee(ask,s.buyerFeeBps);
   const cap=Math.floor(i.reference*maxPayBps/10000);
   const willingness=flexible?Math.floor(c.willingness*gain*(1+(p.impulseBps+p.prestigeBps)/20000)):cap;
   const limit=Math.min(cap,willingness,h.affordable(Math.max(0,a.cash-reserve),s.buyerFeeBps,i.reference*c.priceCap));
   return {i,gain,ask,cost,limit,impulse,loyalty,prestige,score:gain/cost*impulse*loyalty*prestige};
  }).filter(x=>x.ask!==null&&x.gain>0&&x.limit>=x.ask ).sort((x,y)=>y.score-x.score||x.i.id.localeCompare(y.i.id));
  const x=options[0];
  if(x)submit('bid',x.i,x.limit,why('character-purchase',`${p.buy} I choose ${x.i.name} using useful stats, my preferences and my price ceiling.`,{gain:x.gain,estimatedAsk:x.ask ,limit:x.limit,reserve,maxPayBps,regretBps:regret,urgencyBps:urgency,impulse:x.impulse,loyalty:x.loyalty,prestige:x.prestige}));
  else return hold('character-wait',p.wait,{cash:a.cash,reserve,maxPayBps,regretBps:regret,wait,missedBids:a.memory?.missedBids??0});
 }else{
  const canBuy=(i     )=>h.holdings(a)<c.inventoryCap&&a.inventory[i.id].length<c.perItemCap;
  const buyers=s.agents.filter(b=>h.activeFighter(s,b));
  const focus=c.items.find(i=>i.name==='Infinity Edge')??c.items[0];
  const exitRound=Math.max(2,Math.floor(c.rounds*.375));
  const reserve=Math.floor(c.traderCash*p.reserveBps/10000);
  const candidates=c.items.map(i=>{
   const demand=buyers.filter(b=>!b.equipped.includes(i.id)&&c.archetypes[b.archetype].shoppingList.includes(i.id)).length;
   const hist=s.markets[i.id].history.filter(x=>x.round>=s.round-c.momentumWindow&&x.price!==null);
   const latest=hist.at(-1)?.price??i.reference,change=hist.length?latest/hist[0].price -1:0,trades=hist.reduce((n,x)=>n+x.volume,0);
   const fair=i.reference*s.markets[i.id].multiplier;
   const buyValue=p.mode==='hype'?latest*(1.08+Math.min(.15,Math.max(0,change))):fair*p.maxPayBps/10000;
   const limit=Math.min(Math.floor(buyValue),h.affordable(Math.max(0,a.cash-reserve),s.buyerFeeBps,c.priceCap*i.reference));
   const ask=offer(i);return {i,demand,fair,ask,limit,change,trades,latest,held:a.inventory[i.id]};
  });
  const bids=candidates.filter(x=>canBuy(x.i)&&x.ask!==null&&x.limit>=x.ask&&(p.mode==='hype'?x.trades>=c.momentumMinTrades&&x.change>c.momentumThresholdBps/10000:p.mode==='corner'?x.i.id===focus.id&&s.round<exitRound:x.demand>0));
  bids.sort((x,y)=>(p.mode==='hype'?y.change-x.change:p.mode==='bargain'?(y.fair/y.ask )-(x.fair/x.ask ):y.demand-x.demand)||x.i.id.localeCompare(y.i.id));
  const b=bids[0];if(b)submit('bid',b.i,b.limit,why('character-stock',`${p.buy} I bid for ${b.i.name}.`,{demand:b.demand,fair:b.fair,estimatedAsk:b.ask ,limit:b.limit,reserve,change:b.change,trades:b.trades,exitRound:p.mode==='corner'?exitRound:0}));
  const held=candidates.filter(x=>x.held.length&&(p.mode!=='corner'||s.round>=exitRound)).sort((x,y)=>x.held[0].round-y.held[0].round||x.i.id.localeCompare(y.i.id));
  const sale=p.mode==='hype'?held.find(x=>x.trades>=c.momentumMinTrades&&x.change<-c.momentumThresholdBps/10000):held[0];
  if(sale){
   const age=s.round-sale.held[0].round,oldestCost=sale.held[0].cost;
   const markup=p.mode==='corner'?Math.max(1.1,1.8-(s.round-exitRound)*.008):p.mode==='bargain'?Math.max(.65,1.15-age*.025):Math.max(.75,1.45-age*(p.mode==='bagholder'?.004:.012));
   let price=p.mode==='hype'?Math.floor(sale.latest*.92):Math.ceil(sale.fair*markup);
   if(p.mode==='bagholder'){
    let lo=oldestCost,hi=c.priceCap*sale.i.reference;
    if(hi-h.fee(hi,s.sellerFeeBps)<oldestCost){if(!orders.length)return hold('bagholder-stuck',p.wait,{oldestCost,maximumPrice:hi});return orders;}
    while(lo<hi){const mid=Math.floor((lo+hi)/2);if(mid-h.fee(mid,s.sellerFeeBps)>=oldestCost)hi=mid;else lo=mid+1;}price=Math.max(price,lo);
   }
   submit('ask',sale.i,price,why('character-sale',`${p.sell} I offer ${sale.i.name}.`,{age,oldestCost,fair:sale.fair,markup,change:sale.change,breakEvenFloor:p.mode==='bagholder'?price:0}));
  }
  if(!orders.length)return hold('character-hold',p.wait,{cash:a.cash,inventory:h.holdings(a),reserve});
 }
 return orders;
}
