import { BookOpenCheck, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";

type Card = { title?: string; body?: string };
type Side = { title?: string; items?: string[] };
type RecapRow = string[] | Record<string, string>;
export type StoryboardContent = {
  type?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
  outcomes?: string[];
  start_title?: string;
  start_body?: string;
  bullets?: string[];
  callout?: string;
  cards?: Card[];
  cols?: number;
  sides?: Side[];
  rows?: RecapRow[];
  recap_note?: string;
};

function ScreenHeader({ content }: { content: StoryboardContent }) {
  return <header><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">{content.eyebrow || "Learn"}</p><h2 className="mt-1.5 max-w-4xl text-2xl font-semibold tracking-[-0.025em] text-ink-950">{content.title}</h2>{content.lead && <p className="mt-3 max-w-3xl text-[15px] leading-6 text-ink-600 sm:text-base">{content.lead}</p>}</header>;
}

function BulletList({ items }: { items: string[] }) {
  return <ul className="mt-4 grid gap-2">{items.map((item) => <li key={item} className="flex gap-2.5 rounded-lg bg-ink-50 px-3.5 py-2.5 text-sm leading-5 text-ink-700"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-600" /><span>{item}</span></li>)}</ul>;
}

export function StoryboardScreen({ content }: { content: StoryboardContent }) {
  if (content.type === "welcome") return <div><ScreenHeader content={content} />{content.outcomes && <div className={`mt-5 grid gap-4 ${content.start_title || content.start_body ? "lg:grid-cols-[1fr_18rem]" : ""}`}><div><h3 className="text-sm font-semibold text-ink-950">By the end, you can</h3><BulletList items={content.outcomes} /></div>{(content.start_title || content.start_body) && <aside className="rounded-xl border border-accent-200 bg-accent-50 p-4 text-accent-900"><Sparkles size={18} /><h3 className="mt-2.5 text-sm font-semibold">{content.start_title}</h3><p className="mt-1.5 text-sm leading-5">{content.start_body}</p></aside>}</div>}</div>;

  if (content.type === "cards") {
    const columns = content.cols && content.cols >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2";
    return <div><ScreenHeader content={content} /><div className={`mt-5 grid gap-3 ${columns}`}>{(content.cards || []).map((card, index) => <article key={`${card.title}-${index}`} className="rounded-xl border border-ink-200 bg-ink-50/70 p-4"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700">{index + 1}</span><h3 className="mt-3 text-sm font-semibold text-ink-950">{card.title}</h3><p className="mt-1.5 text-sm leading-5 text-ink-600">{card.body}</p></article>)}</div></div>;
  }

  if (content.type === "comparison") return <div><ScreenHeader content={content} /><div className="mt-5 grid gap-3 lg:grid-cols-2">{(content.sides || []).map((side, index) => <section key={`${side.title}-${index}`} className={`rounded-xl border p-4 ${index === 0 ? "border-brand-200 bg-brand-50/70" : "border-accent-200 bg-accent-50/70"}`}><h3 className="text-sm font-semibold text-ink-950">{side.title}</h3><ul className="mt-3 space-y-2">{(side.items || []).map((item) => <li key={item} className="flex gap-2.5 text-sm leading-5 text-ink-700"><CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${index === 0 ? "text-brand-600" : "text-accent-600"}`} /><span>{item}</span></li>)}</ul></section>)}</div></div>;

  if (content.type === "recap") return <div><ScreenHeader content={content} /><div className="mt-5 overflow-x-auto rounded-xl border border-ink-200"><table className="min-w-full text-left text-sm"><tbody className="divide-y divide-ink-100">{(content.rows || []).map((row, index) => { const cells = Array.isArray(row) ? row : Object.values(row); return <tr key={index}>{cells.map((cell, cellIndex) => <td key={cellIndex} className={cellIndex === 0 ? "px-3.5 py-2.5 font-semibold text-ink-900" : "px-3.5 py-2.5 leading-5 text-ink-600"}>{cell}</td>)}</tr>; })}</tbody></table></div>{content.recap_note && <p className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-3.5 text-sm leading-5 text-brand-900">{content.recap_note}</p>}</div>;

  return <div><ScreenHeader content={content} />{content.bullets && <BulletList items={content.bullets} />}{content.callout && <aside className="mt-4 flex gap-2.5 rounded-xl border border-accent-200 bg-accent-50 p-4 text-accent-950"><Lightbulb size={18} className="mt-0.5 shrink-0" /><p className="text-sm font-medium leading-5">{content.callout}</p></aside>}{!content.bullets?.length && !content.callout && <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-brand-50 p-4 text-brand-900"><BookOpenCheck size={18} /><p className="text-sm">Read the main idea, then continue when you can explain it in your own words.</p></div>}</div>;
}
