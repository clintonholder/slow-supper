import {byId,recipes} from '../data/recipes';
import type {Ingredient,PlannedMeal} from './types';
export type ShoppingItem = Ingredient & {recipes:string[];scaledAmount:number};
export const pretty=(n:number)=>Number.isInteger(n)?String(n):Number(n.toFixed(2)).toString();
export function shoppingFor(meals:PlannedMeal[]):ShoppingItem[]{
 const result=new Map<string,ShoppingItem>();
 meals.forEach(meal=>{const r=byId(meal.recipeId);r.ingredients.forEach(i=>{const key=`${i.id}:${i.unit}`;const existing=result.get(key);if(existing){existing.scaledAmount+=i.amount*meal.servings/r.servings;if(!existing.recipes.includes(r.title))existing.recipes.push(r.title);}else result.set(key,{...i,scaledAmount:i.amount*meal.servings/r.servings,recipes:[r.title]});});});
 return [...result.values()].sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
}
function pantryWaste(meals:PlannedMeal[]){return shoppingFor(meals).reduce((sum,i)=>{if(!i.packageSize)return sum;const used=i.scaledAmount;const bought=Math.ceil(used/i.packageSize)*i.packageSize;return sum+((bought-used)/i.packageSize)*(.8+(i.category==='Produce'?1.2:0));},0)}
function score(meals:PlannedMeal[]){const ids=meals.map(m=>m.recipeId);const uniq=new Set(ids);const types=new Set(ids.map(id=>byId(id).category));return pantryWaste(meals)+ (meals.length-uniq.size)*80 - types.size*.4;}
export function generate(count:number,servings:number,existing:PlannedMeal[],excluded:string[],cookedAt:Record<string,string>,noRepeatDays:number,favorites:string[]):PlannedMeal[]{
 const now=Date.now();let available=recipes.filter(r=>!excluded.includes(r.id)&&(!cookedAt[r.id]||now-new Date(cookedAt[r.id]).getTime()>noRepeatDays*86400000));
 if(available.length<count)available=recipes.filter(r=>!excluded.includes(r.id));
 if(!available.length)available=recipes;
 let best:PlannedMeal[]=[];let bestScore=Infinity;
 for(let seed=0;seed<Math.min(available.length,24);seed++){
  const chosen:PlannedMeal[]=[];
  for(let k=0;k<count;k++){
   const candidates=available.filter(r=>!chosen.some(c=>c.recipeId===r.id));
   if(!candidates.length)break;
   let choice=candidates[0],choiceScore=Infinity;
   for(const r of candidates){const trial=[...chosen,{key:`${k}`,recipeId:r.id,servings,day:k,status:'planned' as const}];const s=score(trial)- (favorites.includes(r.id)?0.25:0)+(seed===0?0:((r.id.charCodeAt(0)*37+r.title.length*13+seed*19)%23)*.027);if(s<choiceScore){choiceScore=s;choice=r;}}
   chosen.push({key:`meal-${k}`,recipeId:choice.id,servings,day:k,status:'planned'});
  }
  const total=score(chosen)-chosen.filter(m=>favorites.includes(m.recipeId)).length*.2;
  if(total<bestScore){bestScore=total;best=chosen;}
 }
 void existing;
 return best;
}
export function alternatives(meals:PlannedMeal[],index:number,excluded:string[]){return recipes.filter(r=>!excluded.includes(r.id)&&!meals.some((m,j)=>j!==index&&m.recipeId===r.id)).map(r=>({recipe:r,score:score(meals.map((m,j)=>j===index?{...m,recipeId:r.id}:m))})).sort((a,b)=>a.score-b.score);}