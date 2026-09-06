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
  return <header className="storyboard-header">
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">{content.eyebrow || "Learn"}</p>
    <h2 className="font-semibold text-ink-950">{content.title}</h2>
    {content.lead && <p className="storyboard-lead text-ink-600">{content.lead}</p>}
  </header>;
}

function BulletList({ items }: { items: string[] }) {
  return <ul className={`storyboard-list ${items.length >= 4 ? "storyboard-list-columns" : ""}`}>
    {items.map((item, index) => <li key={index} className="flex gap-2 rounded-lg bg-ink-50 text-sm leading-5 text-ink-700">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600"/><span>{item}</span>
    </li>)}
  </ul>;
}

export function StoryboardScreen({ content }: { content: StoryboardContent }) {
  let body;
  if (content.type === "welcome") {
    body = <div className="storyboard-welcome">
      {content.outcomes && <div><h3 className="text-sm font-semibold text-ink-950">By the end, you can</h3><BulletList items={content.outcomes}/></div>}
      {(content.start_title || content.start_body) && <aside className="rounded-xl border border-accent-200 bg-accent-50 p-3 text-accent-900">
        <div className="flex items-start gap-2"><Sparkles size={17} className="shrink-0"/><h3 className="text-sm font-semibold">{content.start_title}</h3></div>
        <p className="mt-2 text-sm leading-5">{content.start_body}</p>
      </aside>}
    </div>;
  } else if (content.type === "cards") {
    body = <div className={`storyboard-cards ${(content.cols ?? 2) >= 3 || (content.cards?.length ?? 0) >= 5 ? "storyboard-cards-three" : ""} ${(content.cards?.length ?? 0) >= 7 ? 'storyboard-cards-many' : ''}`}>
      {(content.cards || []).map((card, index) => <article key={index} className="rounded-xl border border-ink-200 bg-ink-50/70 p-3">
        <div className="flex items-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-semibold text-brand-800">{index + 1}</span>
          <h3 className="text-sm font-semibold leading-5 text-ink-950">{card.title}</h3>
        </div>
        <p className="mt-2 text-sm leading-5 text-ink-600">{card.body}</p>
      </article>)}
    </div>;
  } else if (content.type === "comparison") {
    body = <div className="storyboard-comparison">
      {(content.sides || []).map((side, index) => <section key={index} className={`rounded-xl border p-3 ${index === 0 ? "border-brand-200 bg-brand-50/70" : "border-accent-200 bg-accent-50/70"}`}>
        <h3 className="text-sm font-semibold text-ink-950">{side.title}</h3>
        <ul className="mt-2 space-y-2">{(side.items || []).map((item, itemIndex) => <li key={itemIndex} className="flex gap-2 text-sm leading-5 text-ink-700">
          <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${index === 0 ? "text-brand-600" : "text-accent-700"}`} /><span>{item}</span>
        </li>)}</ul>
      </section>)}
    </div>;
  } else if (content.type === "recap") {
    body = <>
      <div className="overflow-x-auto rounded-xl border border-ink-200"><table className="storyboard-table w-full text-left text-sm"><tbody>
        {(content.rows || []).map((row, index) => <tr key={index}>{(Array.isArray(row) ? row : Object.values(row)).map((cell, cellIndex) =>
          <td key={cellIndex} className={cellIndex === 0 ? "font-semibold text-ink-900" : "text-ink-600"}>{cell}</td>
        )}</tr>)}
      </tbody></table></div>
      {content.recap_note && <p className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm leading-5 text-brand-900">{content.recap_note}</p>}
    </>;
  } else {
    body = <>
      {content.bullets && <BulletList items={content.bullets}/>}
      {content.callout && <aside className="flex gap-2.5 rounded-xl border border-accent-200 bg-accent-50 p-3 text-accent-950"><Lightbulb size={18} className="mt-0.5 shrink-0"/><p className="text-sm font-medium leading-5">{content.callout}</p></aside>}
      {!content.bullets?.length && !content.callout && <div className="flex items-center gap-2.5 rounded-xl bg-brand-50 p-3 text-brand-900"><BookOpenCheck size={18}/><p className="text-sm">Read the main idea, then continue when you can explain it in your own words.</p></div>}
    </>;
  }
  return <div className="storyboard-screen"><ScreenHeader content={content}/>{body}</div>;
}
