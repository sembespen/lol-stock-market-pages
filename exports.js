import { ENGINE_VERSION, digest, run } from './engine.js';
                                                                        
function fail(message        )        { throw new Error(`Invalid run: ${message}`); }
const object=(v         )                        =>v!==null&&typeof v==='object'&&!Array.isArray(v)?v                          :fail('expected object');
const int=(v         ,min        ,max        )=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max?v:fail(`expected integer ${min}–${max}`);
const num=(v         ,min        ,max        )=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail('number outside supported range');
const str=(v         )=>typeof v==='string'&&v.length>0&&v.length<=120?v:fail('invalid string');
const longText=(v        )=>typeof v==='string'&&v.length<=12000?v:fail('invalid description');
const asset=(v        )=>{const s=str(v);return /^(item-[0-9]+|champion-[A-Za-z0-9]+)\.png$/.test(s)?s:fail('invalid local asset');};
const array=(v         ,max        )=>Array.isArray(v)&&v.length<=max?v:fail('invalid or oversized array');
const id=(v         )=>{const s=str(v);return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(s)&&!['constructor','prototype','__proto__'].includes(s)?s:fail('invalid ID');};
const vector=(v         )=>{const a=array(v,6);if(a.length!==6)fail('six utility dimensions required');return a.map(v=>num(v,0,100))                                               ;};
export function validateManifest(value         )           {
 const m=object(value);if(m.schemaVersion!==1)fail('unsupported schema version');if(![ENGINE_VERSION,'2.0.0'].includes(m.engineVersion          ))fail('unsupported engine version');const league=m.engineVersion==='2.0.0';
 const raw=object(m.config);const c={}          ;
 const ranges                                ={rounds:[1,1000],valueFighters:[0,200],fixedFighters:[0,200],valueTraders:[0,100],momentumTraders:[0,100],fighterCash:[0,1000000],traderCash:[0,1000000],income:[0,100000],incomeRounds:[0,1000],slots:[1,6],initialStock:[0,100],maxStock:[1,100],productionEvery:[1,1000],buyerFeeBps:[0,10000],sellerFeeBps:[0,10000],inventoryCap:[1,100],perItemCap:[1,100],priceCap:[1,4],willingness:[0,10000],valueBuyBps:[1,20000],valueSellBps:[1,20000],momentumWindow:[1,1000],momentumMinTrades:[1,10000],momentumThresholdBps:[0,10000],momentumBuyBps:[1,20000],momentumSellBps:[1,20000]};
 for(const [key,[min,max]] of Object.entries(ranges))(c                                     )[key]=int(raw[key],min,max);
 if(c.valueFighters+c.fixedFighters+c.valueTraders+c.momentumTraders>250)fail('maximum population is 250');if(c.initialStock>c.maxStock)fail('starting stock exceeds stock cap');if(c.perItemCap>c.inventoryCap)fail('per-item cap exceeds total cap');
 c.items=array(raw.items,league?250:24).map(v=>{const i=object(v);const result={id:id(i.id),name:str(i.name),originalName:str(i.originalName),reference:int(i.reference,1,100000),features:vector(i.features),symbol:str(i.symbol),color:typeof i.color==='string'&&/^#[a-fA-F0-9]{6}$/.test(i.color)?i.color:fail('invalid color')}                           ;
  if(league){if(i.icon!==undefined)result.icon=asset(i.icon);if(i.description!==undefined)result.description=longText(i.description);if(i.stats!==undefined)result.stats=Object.fromEntries(Object.entries(object(i.stats)).map(([k,v])=>[str(k),num(v,0,100000)]));if(i.tags!==undefined)result.tags=array(i.tags,40).map(str);if(i.recipe!==undefined)result.recipe=array(i.recipe,10).map(id);if(i.boots!==undefined){if(typeof i.boots!=='boolean')fail('invalid boots flag');result.boots=i.boots;}}return result;});
 if(!c.items.length||new Set(c.items.map(i=>i.id)).size!==c.items.length)fail('empty or duplicate catalog');const ids=new Set(c.items.map(i=>i.id));
 c.archetypes=array(raw.archetypes,league?250:12).map(v=>{const a=object(v),shoppingList=array(a.shoppingList,6).map(id);if(new Set(shoppingList).size!==shoppingList.length||shoppingList.some(i=>!ids.has(i)))fail('invalid shopping list');const result={name:str(a.name),weights:vector(a.weights),shoppingList}                                ;if(league){if(a.champion!==undefined)result.champion=id(a.champion);if(a.icon!==undefined)result.icon=asset(a.icon);}return result;});if(!c.archetypes.length)fail('archetypes required');
 if(league){const l=object(raw.league);if(typeof l.demandTrading!=='boolean'||typeof l.corner!=='boolean')fail('invalid league rules');c.league={patch:str(l.patch),waveEvery:int(l.waveEvery,1,1000),waves:int(l.waves,1,8),demandTrading:l.demandTrading,corner:l.corner};if(l.spotlight!==undefined){c.league.spotlight=id(l.spotlight);if(!c.archetypes.some(a=>a.champion===c.league .spotlight))fail('unknown spotlight champion');}if((c.valueFighters+c.fixedFighters)*c.league.waves+c.valueTraders+c.momentumTraders>250)fail('wave population exceeds 250');}else if(raw.league!==undefined)fail('league rules require engine 2.0.0');
 const interventions=array(m.interventions,200).map(v=>{const x=object(v);if(!['utility','pause','resume','issue','fees'].includes(x.kind          ))fail('unknown intervention');const kind=x.kind                        ;const items=array(x.items,league?250:24).map(id);if(items.some(i=>!ids.has(i))||new Set(items).size!==items.length)fail('invalid intervention items');if(kind!=='fees'&&!items.length)fail('intervention requires item');const result              ={id:id(x.id),round:int(x.round,1,c.rounds),kind,items,value:kind==='utility'?num(x.value,.1,5):int(x.value,0,kind==='fees'?10000:100)};
  if(x.duration!==undefined)result.duration=int(x.duration,1,1000);if(x.sellerValue!==undefined)result.sellerValue=int(x.sellerValue,0,10000);return result;});
 if(new Set(interventions.map(x=>x.id)).size!==interventions.length)fail('duplicate intervention ID');
 const manifest          ={schemaVersion:1,engineVersion:m.engineVersion          ,seed:int(m.seed,0,4294967295),config:c,interventions};if(m.parentRun){const p=object(m.parentRun);manifest.parentRun={id:id(p.id),round:int(p.round,0,c.rounds)};}return manifest;
}
export function exportRun(s       ) {return {manifest:s.manifest,completedRounds:s.round,digest:digest(s),events:s.events,results:{trades:s.trades,metrics:s.metrics,agents:s.agents,shop:s.shop,fees:s.fees,externalCash:s.externalCash}};}
// Compact v2 exports keep the supported 1,000-round run inside the import limit.
export const runJson=(s      )=>JSON.stringify(exportRun(s),null,s.manifest.config.league?undefined:2);
export function importRun(text        ) {
 if(text.length>64*1024*1024)fail('file exceeds 64 MB');let data         ;try{data=JSON.parse(text);}catch{fail('malformed JSON');}const envelope=object(data);const manifest=validateManifest(envelope.manifest??envelope);const rounds=envelope.completedRounds===undefined?manifest.config.rounds:int(envelope.completedRounds,0,manifest.config.rounds);const state=run(manifest,rounds);
 if(envelope.digest!==undefined&&envelope.digest!==digest(state))fail('recomputed result digest differs');return state;
}
function csv(rows                          ) {if(!rows.length)return '';const keys=Object.keys(rows[0]);const cell=(v         )=>{let text=String(v??'');if(typeof v==='string'&&/^[=+@\-\t\r]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;};return [keys.join(','),...rows.map(row=>keys.map(k=>cell(row[k])).join(','))].join('\r\n');}
export const tradesCsv=(s       )=>csv(s.trades.map(t=>({id:t.id,round:t.round,item:t.item,buyer:t.buyer,seller:t.seller,price:t.price,buyerFee:t.buyerFee,sellerFee:t.sellerFee,bid:t.bid,ask:t.ask,buyerReason:t.buyerReason.text,sellerReason:t.sellerReason.text})));
export const metricsCsv=(s       )=>csv(s.metrics.map(m=>({...m})));
export function download(name        ,text        ,type='application/json') {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

