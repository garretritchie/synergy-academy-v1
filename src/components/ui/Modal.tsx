import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const prior = document.activeElement as HTMLElement | null;
    const dialog=ref.current;
    dialog?.showModal();
    return ()=>{ dialog?.close(); prior?.focus(); };
  },[]);
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();onClose();}} aria-label={title} className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-auto rounded-2xl border border-brand-100 bg-white p-0 text-ink-900 shadow-elevated backdrop:bg-navy/50">
    <header className="flex items-center justify-between border-b border-ink-200 bg-brand-50 px-4 py-2"><h2 className="text-lg font-semibold">{title}</h2><button type="button" aria-label={`Close ${title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white focus-visible:ring-2" onClick={onClose}><X size={18}/></button></header>
    <div className="p-5">{children}</div>
  </dialog>;
}
