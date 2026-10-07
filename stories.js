import { activeFighter, fee, primaryAsk } from './engine.js';
                                               
export function buildGoal(s      ,a      ){
 const c=s.manifest.config;
 const next=c.archetypes[a.archetype].shoppingList.find(id=>!a.equipped.includes(id)&&(!c.items.find(i=>i.id===id) .boots||!a.equipped.some(id=>c.items.find(i=>i.id===id) .boots)));
 if(!next)return null;const item=c.items.find(i=>i.id===next) ,market=s.markets[next];
 const ask=market.bestAsk??(market.stock?primaryAsk(s,item):null);
 const cost=ask===null?null:ask+fee(ask,s.buyerFeeBps);
 return {item,cost,shortfall:cost===null?null:Math.max(0,cost-a.cash),active:activeFighter(s,a)};
}
export function headlines(s      ){
 const rows                                                        =[];
 const name=(id       )=>s.agents.find(a=>a.id===id)?.name??id;
 for(const e of s.events.slice().reverse()){
  if(e.type==='champions-arrived')rows.push({round:e.round,text:`Wave ${e.data.wave}: ${e.data.count} new champion buyers enter with ${e.data.gold} gold.`});
  if(e.type==='trade-executed'){
   const t=e.data.trade                           ,i=s.manifest.config.items.find(i=>i.id===t.item) ;
   if(t.seller!=='shop')rows.push({round:e.round,text:`${name(t.buyer)} buys ${i.name} from ${name(t.seller)} for ${t.price} gold.`,agent:t.buyer,item:t.item});
   else if(t.price>=i.reference*1.5)rows.push({round:e.round,text:`${name(t.buyer)} pays ${(t.price/i.reference).toFixed(2)}× shop reference for ${i.name}.`,agent:t.buyer,item:t.item});
  }
  if(e.type==='intervention-applied'&&!e.data.expired){const iv=e.data.intervention                                              ;rows.push({round:e.round,text:`Public change: ${iv.kind} affects ${iv.items.length} item markets.`});}
  if(rows.length>=6)break;
 }
 return rows.slice(0,6);
}
