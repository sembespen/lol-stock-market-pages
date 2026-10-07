                                                                                          
export const ENGINE_VERSION = '1.0.0';
const rows                                                             = [
 ['infinity','Infinity Edge','Crownblade',3400,[10,0,0,0,0,0],'✧','#e8be69'],
 ['phantom','Phantom Dancer','Ghoststep',2600,[2,10,0,0,0,0],'◇','#80d9cc'],
 ['blood','Bloodthirster','Crimson Fang',3200,[7,0,0,0,8,0],'♢','#ed808e'],
 ['blade','Blade of the Ruined King','Duskblade',3000,[5,5,0,0,5,0],'⟡','#b39be4'],
 ['deathcap',"Rabadon's Deathcap",'Astral Crown',3600,[0,0,0,12,0,0],'△','#c895df'],
 ['hourglass',"Zhonya's Hourglass",'Golden Hour',3200,[0,0,5,7,0,0],'⌛','#e6c775'],
 ['luden',"Luden's Companion",'Storm Orb',2900,[0,0,0,9,0,0],'◉','#9cafff'],
 ['warmog',"Warmog's Armor",'Verdant Plate',3000,[0,0,11,0,4,0],'⬡','#91c997'],
 ['thorn','Thornmail','Briar Guard',2600,[0,0,9,0,0,0],'✳','#caaf86'],
 ['redemption','Redemption','Dawn Beacon',2300,[0,0,3,3,7,0],'⊕','#efbd98'],
 ['greaves',"Berserker's Greaves",'Swift Boots',1100,[0,5,0,0,0,0],'»','#88bbdf'],
 ['ward','Control Ward Bundle','Watchlight',800,[0,0,0,0,0,10],'◎','#b0d58e'],
];
export const catalog         = rows.map(([id,name,originalName,reference,features,symbol,color])=>({id,name,originalName,reference,features,symbol,color}));
const weights                    = [['Marksman',[1,.8,.1,0,.4,.1]],['Mage',[0,.1,.3,1,.1,.1]],['Tank',[.1,0,1,.1,.4,.2]],['Bruiser',[.8,.3,.6,0,.5,.1]],['Enchanter',[0,0,.3,.5,.8,.6]],['Scout',[.4,.4,.2,.2,.1,1]]];
// Greedy initial marginal utility per reference gold. Stored explicitly in config for replay.
function shoppingList(items        , w        ) {
 const list          =[]; const total=[0,0,0,0,0,0];
 for(let slot=0;slot<Math.min(6,items.length);slot++){
  const ranked=items.filter(i=>!list.includes(i.id)).map(i=>({i,score:i.features.reduce((s,f,d)=>s+w[d]*10*Math.log((10+total[d]+f)/(10+total[d])),0)/i.reference})).sort((a,b)=>b.score-a.score||a.i.id.localeCompare(b.i.id));
  const next=ranked[0].i; list.push(next.id); next.features.forEach((f,d)=>total[d]+=f);
 } return list;
}
export function defaultConfig()         {
 const items=structuredClone(catalog); const archetypes             =weights.map(([name,weights])=>({name,weights,shoppingList:shoppingList(items,weights)}));
 return {items,archetypes,rounds:200,valueFighters:60,fixedFighters:20,valueTraders:12,momentumTraders:8,fighterCash:2000,traderCash:8000,income:180,incomeRounds:60,slots:6,initialStock:4,maxStock:6,productionEvery:8,buyerFeeBps:100,sellerFeeBps:100,inventoryCap:8,perItemCap:4,priceCap:4,willingness:450,valueBuyBps:8500,valueSellBps:10500,momentumWindow:8,momentumMinTrades:3,momentumThresholdBps:500,momentumBuyBps:10800,momentumSellBps:9500};
}
export const scenarios = [{id:'players',name:'Players only',description:'80 fighters. The baseline economy.'},{id:'speculators',name:'Speculators enter',description:'The same players plus 20 traders and 160,000 additional gold.'},{id:'buff',name:'The fictional buff',description:'Infinity Edge utility ×1.8 from round 30 through 64.'},{id:'shortage',name:'The shortage',description:'Infinity Edge and Bloodthirster production stops in rounds 25–60.'}]         ;
export function createManifest(seed=42, scenario='speculators', small=false, handoffDefaults=false)           {
 const config=defaultConfig(); const interventions                =[];
 // One disclosed prototype tuning: slow production needs a longer momentum observation window.
 if(!handoffDefaults)config.momentumWindow=32;
 if(scenario==='players'){config.valueTraders=0;config.momentumTraders=0;}
 if(scenario==='buff') interventions.push({id:'preset-buff',round:30,kind:'utility',items:['infinity'],value:1.8,duration:35});
 if(scenario==='shortage') interventions.push({id:'preset-pause',round:25,kind:'pause',items:['infinity','blood'],value:0},{id:'preset-resume',round:61,kind:'resume',items:['infinity','blood'],value:0});
 if(small){config.items=config.items.filter(i=>['infinity','greaves','ward'].includes(i.id)).map(i=>({...i,name:i.originalName})); config.archetypes=config.archetypes.map(a=>({...a,shoppingList:shoppingList(config.items,a.weights)}));config.valueFighters=4;config.fixedFighters=2;config.valueTraders=2;config.momentumTraders=0;config.slots=3;interventions.length=0;interventions.push({id:'small-public-buff',round:1,kind:'utility',items:['infinity'],value:1.8,duration:8});}
 return {schemaVersion:1,engineVersion:ENGINE_VERSION,seed,config,interventions};
}

