import content from '@/content/practice-packets.json';
import { Download } from 'lucide-react';
export function PracticePacket({order}:{order:number}){
 const packet=content.packets[order-1];if(!packet)return null;
 const text=`# ${packet.title}\n\nAll examples are fictional.\n\n## Starting input\n\n${packet.input}\n\n## Worked example\n\n${packet.example}\n\n## Your template\n\n${packet.template}\n\n## Self-check\n\n${packet.check}`;
 const download=()=>{const url=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download=`module-${order}-practice.md`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <details className="rounded-xl border border-brand-200 bg-brand-50/50 p-4"><summary className="cursor-pointer text-sm font-semibold text-brand-900">Starting input, worked example and template</summary><p className="mt-3 text-xs text-ink-600">Fictional practice material. No private data or paid tool is required.</p><h4 className="mt-3 text-sm font-semibold">Starting input</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{packet.input}</p><h4 className="mt-4 text-sm font-semibold">Worked example</h4><p className="mt-2 text-sm leading-6">{packet.example}</p><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">{packet.template}</pre><button type="button" className="btn-secondary mt-3" onClick={download}><Download size={14}/> Download practice template</button></details>;
}
