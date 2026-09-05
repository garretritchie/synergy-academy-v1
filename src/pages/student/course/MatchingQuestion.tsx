import { useState } from 'react';
export function MatchingQuestion({options,value,disabled,onChange}:{options:unknown[];value?:string;disabled:boolean;onChange:(value:string)=>void}){
 const maps=options.flatMap(o=>{try{const m=JSON.parse(String(o));return typeof m==='object'&&m&&!Array.isArray(m)?[m as Record<string,string>]:[];}catch{return[];}});
 const keys=Object.keys(maps[0]??{}),labels=[...new Set(maps.flatMap(m=>Object.values(m)))].sort();
 const [selection,setSelection]=useState<Record<string,string>>(()=>{try{return value?JSON.parse(value):{};}catch{return{};}});
 if(!keys.length)return <p role="alert">This matching question needs configuration. Please contact your instructor.</p>;
 return <fieldset disabled={disabled} className="mt-5 space-y-3"><legend className="mb-2 text-sm text-ink-600">Match using the menus. Works with a keyboard or touch.</legend>{keys.map((key,i)=><label key={key} className="grid items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3 sm:grid-cols-2"><span className="text-sm font-medium">{key}</span><select aria-label={`Label for ${key}`} className="input bg-white" value={selection[key]??''} onChange={e=>{const next={...selection,[key]:e.target.value};setSelection(next);const ordered=Object.fromEntries(keys.map(k=>[k,next[k]]));onChange(keys.every(k=>next[k])?JSON.stringify(ordered):'');}}><option value="">Choose a label</option>{labels.map(l=><option key={`${i}-${l}`} disabled={keys.some(k=>k!==key&&selection[k]===l)} value={l}>{l}</option>)}</select></label>)}</fieldset>;
}
