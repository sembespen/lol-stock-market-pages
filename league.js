import { leagueData } from './league-data.js';
import { defaultConfig } from './config.js';
import { championPersonalities, hypePersonality, practicalPersonality, traderPersonalities } from './personalities.js';
                                                         

export const leagueScenarios = [
 {id:'league',name:'Champions vs speculators'},
 {id:'league-players',name:'Champions only'},
 {id:'league-buff',name:'The crit-item craze'},
 {id:'league-shortage',name:'The boots shortage'},
 {id:'league-corner',name:'The corner attempt'},
];
export const storyScenarios = [
 {id:'story',name:'The bazaar · personalities & gossip'},
 {id:'story-players',name:'The bazaar · champions only'},
 {id:'story-buff',name:'The bazaar · crit craze'},
 {id:'story-shortage',name:'The bazaar · boot panic'},
 {id:'story-corner',name:'The bazaar · corner king'},
];
const clean = (text        ) => text.replace(/<br\s*\/?\s*>/gi,' · ').replace(/<[^>]+>/g,'').replaceAll('&nbsp;',' ').replaceAll('&amp;','&');
const rawItems = Object.entries(leagueData.items).filter(([,i])=>i.maps['11']&&i.gold.purchasable&&i.gold.total>0&&i.inStore!==false);
export const leagueCatalog         = rawItems.filter(([id,i])=>Number(id)<10000&&i.gold.base>0&&(!i.into?.length||i.tags.includes('Boots'))&&!i.requiredChampion&&!i.requiredAlly&&!i.tags.includes('Consumable')&&!i.name.startsWith('Guardian\'s')&&i.gold.total>=900).map(([id,i])=>{
 const stats={...i.stats};
 // Data Dragon's stats object is sparse. Preserve numeric stat lines from the tooltip too.
 const block=i.description.match(/<stats>([\s\S]*?)<\/stats>/)?.[1]??'';
 for(const line of block.split(/<br\s*\/?\s*>/i)){const text=clean(line).trim(),m=text.match(/^([\d,]+(?:\.\d+)?)\s*(%)?\s+(.+)$/);if(m)stats[m[3]]=Number(m[1].replaceAll(',',''));}
 const stat=(label       ,key       )=>stats[label]??stats[key]??0;
 const features       =[
 stat('Attack Damage','FlatPhysicalDamageMod')/7.5+stat('Critical Strike Chance','FlatCritChanceMod')*(stats['Critical Strike Chance']? .2:20),
 stat('Attack Speed','PercentAttackSpeedMod')*(stats['Attack Speed']?.2:20)+stat('Move Speed','FlatMovementSpeedMod')/10,
 stat('Health','FlatHPPoolMod')/60+stat('Armor','FlatArmorMod')/8+stat('Magic Resist','FlatSpellBlockMod')/8,
 stat('Ability Power','FlatMagicDamageMod')/9+stat('Ability Haste','AbilityHaste')/12,
 stat('Life Steal','PercentLifeStealMod')*(stats['Life Steal']?.6:60)+stat('Health Regen','FlatHPRegenMod')/5+(i.tags.includes('ManaRegen')?3:0),
 i.tags.includes('Active')?1:0,
 ];
 return {id:`lol-${id}`,name:i.name,originalName:i.name,reference:i.gold.total,features:features.map(n=>Math.min(100,n))          ,symbol:'◆',color:i.tags.includes('SpellDamage')?'#bd9bf5':i.tags.includes('Armor')?'#87caa7':'#e8be69',icon:`item-${id}.png`,stats,description:clean(i.description),tags:i.tags,recipe:i.from??[],boots:i.tags.includes('Boots')};
});
const championWeights=(c                                 )       =>{
 const mage=c.tags.includes('Mage'),marksman=c.tags.includes('Marksman'),tank=c.tags.includes('Tank'),support=c.tags.includes('Support');
 const curated                      ={Jinx:[1.4,1.2,.15,0,.35,.05],Ahri:[0,.15,.3,1.5,.2,.1],Yasuo:[1.4,.85,.3,0,.6,.05],Lux:[0,.1,.25,1.5,.45,.2],Garen:[1,.2,1.1,0,.45,.05],Teemo:[.35,.8,.25,1,.2,.25],Thresh:[.05,.1,.9,.4,1,.9],Ashe:[1.1,1.3,.2,0,.35,.15]};
 return curated[c.id]??[mage&&!marksman?.05:marksman?1.3:.95,marksman?1:.2+c.info.attack/30,tank?1.4:support?.5:.2+c.info.defense/30,mage?1.3:support?.6:.05,support?1:tank?.5:.35,support?.8:.1];
};
function build(weights       ){
 const chosen         =[],total=[0,0,0,0,0,0];
 for(let slot=0;slot<6;slot++){
  const options=leagueCatalog.filter(i=>!chosen.includes(i.id)&&(!i.boots||!chosen.some(id=>leagueCatalog.find(x=>x.id===id) .boots)));
  const ranked=options.map(i=>({i,score:i.features.reduce((n,f,d)=>n+weights[d]*10*Math.log((10+total[d]+f)/(10+total[d])),0)/i.reference})).sort((a,b)=>b.score-a.score||a.i.id.localeCompare(b.i.id));
  if(!ranked.length)break;const i=ranked[0].i;chosen.push(i.id);i.features.forEach((v,d)=>total[d]+=v);
 }return chosen;
}
export function createLeagueManifest(seed=42,scenario='league')         {
 const c=defaultConfig();c.items=structuredClone(leagueCatalog);
 const cast=['Jinx','Ahri','Yasuo','Lux','Garen','Teemo','Thresh','Ashe','Darius','Veigar','MissFortune','Leona'];
 const champions=Object.values(leagueData.champions).sort((a,b)=>{const ai=cast.indexOf(a.id),bi=cast.indexOf(b.id);return (ai<0?999:ai)-(bi<0?999:bi)||a.id.localeCompare(b.id);});
 c.archetypes=champions.map(ch=>{const weights=championWeights(ch);return {name:ch.name,champion:ch.id,icon:`champion-${ch.id}.png`,weights,shoppingList:build(weights)};});
 Object.assign(c,{valueFighters:18,fixedFighters:12,valueTraders:8,momentumTraders:4,fighterCash:2500,traderCash:14000,income:250,incomeRounds:50,initialStock:2,maxStock:4,productionEvery:10,willingness:850,momentumWindow:24,momentumMinTrades:2,valueBuyBps:12500,valueSellBps:14500});
 c.league={patch:leagueData.patch,waveEvery:50,waves:4,demandTrading:true,corner:scenario==='league-corner'};
 if(scenario==='league-players'){c.valueTraders=0;c.momentumTraders=0;}
 const m         ={schemaVersion:1,engineVersion:'2.0.0',seed,config:c,interventions:[]};
 if(scenario==='league-buff')m.interventions.push({id:'crit-craze',round:55,kind:'utility',items:c.items.filter(i=>i.tags?.includes('CriticalStrike')).map(i=>i.id),value:1.8,duration:45});
 if(scenario==='league-shortage')m.interventions.push({id:'boots-stop',round:35,kind:'pause',items:c.items.filter(i=>i.boots).map(i=>i.id),value:0},{id:'boots-resume',round:100,kind:'resume',items:c.items.filter(i=>i.boots).map(i=>i.id),value:0});
 return m;
}
export function createStoryManifest(seed=42,scenario='story')         {
 const old=scenario==='story'?'league':scenario.replace('story-','league-');
 const m=createLeagueManifest(seed,old),c=m.config;m.engineVersion='3.0.0';
 // Put the researched ensemble in the first shopping wave; retain all identities.
 const cast=['Jinx','Draven','Ornn','Ahri','Garen','Teemo','Veigar','Yasuo','Lux','Thresh','Ashe','Darius','MissFortune','Leona'];
 c.archetypes.sort((a,b)=>{const ai=cast.indexOf(a.champion ),bi=cast.indexOf(b.champion );return (ai<0?999:ai)-(bi<0?999:bi)||a.champion .localeCompare(b.champion );});
 for(const a of c.archetypes)a.personality=structuredClone(championPersonalities[a.champion ]??practicalPersonality);
 const alternates=['Beatrice Bags','Nix the Bargain Goblin','Mortimer Fairweather','Lady Bootstraps'];
 const traders=Array.from({length:c.valueTraders},(_,n)=>({...structuredClone(traderPersonalities[n%4]),id:`${traderPersonalities[n%4].id}-${n+1}`,label:n<4?traderPersonalities[n].label:alternates[(n-4)%4]+(n>=8?' '+(n+1):'')}));
 if(c.league .corner&&traders.length)traders[0]={...structuredClone(traderPersonalities[3]),id:'corner-special',label:'The Corner King'};
 const hypeNames=['Pip Moonshot','Fifi FOMO','Sir Candlewick','Bex Buyhigh'];
 for(let n=0;n<c.momentumTraders;n++)traders.push({...structuredClone(hypePersonality),id:`hype-${n+1}`,label:hypeNames[n%4]+(n>=4?' '+(n+1):'')});
 c.story={version:1,traders};return m;
}
