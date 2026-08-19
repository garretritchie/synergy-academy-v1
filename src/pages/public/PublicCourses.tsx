import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Award, BookOpen, Clock3, GraduationCap, Mail, Phone } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

type PublicCourse = {
  course_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  cover_image_url: string | null;
  duration_weeks: number | null;
  difficulty_level: string | null;
  is_self_paced: boolean;
  metadata: Record<string, unknown>;
  categories: Array<{ name: string; slug: string }>;
  curriculum: Array<{
    title: string;
    description: string | null;
    lessons: Array<{ title: string; estimated_minutes: number | null }>;
  }>;
};

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb] text-ink-900">
      <header className="border-b border-white/10 bg-[linear-gradient(110deg,#07162a_0%,#0b3f82_62%,#0066ff_145%)] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-7">
          <Link to="/courses" aria-label="Synergy Academy courses" className="flex flex-col items-start">
            <img
              src="/brand/synergy-bahamas-logo-white.png"
              alt="Synergy Bahamas"
              width="2810"
              height="964"
              className="h-auto w-36"
            />
            <AcademyBrandMark tone="light" compact className="mt-2" />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link className="rounded-lg px-3 py-2 text-white/75 hover:bg-white/10 hover:text-white" to="/courses">
              Courses
            </Link>
            <Link className="rounded-lg bg-white px-3 py-2 font-semibold text-brand-800 hover:bg-brand-50" to="/signin">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-12 border-t border-ink-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-6 text-xs text-ink-500 sm:grid-cols-[1fr_auto] sm:px-7">
          <div>
            <p>Synergy Academy, an eLearning Platform by Synergy Bahamas.</p>
            <address className="mt-2 flex flex-wrap gap-x-4 gap-y-1 not-italic">
              <span className="inline-flex items-center gap-1.5">
                <Phone size={13} aria-hidden="true" />
                <a className="hover:text-brand-700 hover:underline" href="tel:+12423230727">(242) 323-0727</a>
                <span aria-hidden="true">/</span>
                <a className="hover:text-brand-700 hover:underline" href="tel:+12426016016">(242) 601-6016</a>
              </span>
              <a className="inline-flex items-center gap-1.5 hover:text-brand-700 hover:underline" href="mailto:info@synergybahamas.com">
                <Mail size={13} aria-hidden="true" /> info@synergybahamas.com
              </a>
            </address>
          </div>
          <a className="self-start font-medium text-brand-700 hover:text-brand-800" href="https://www.synergybahamas.com" target="_blank" rel="noreferrer">
            Visit synergybahamas.com
          </a>
        </div>
      </footer>
    </div>
  );
}

export function PublicCourses() {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const { data, error: queryError } = await supabase.rpc("get_public_courses", {
        requested_slug: null,
      });
      if (queryError) {
        setError(
          queryError.message.toLowerCase().includes("get_public_courses")
            ? "The public catalog requires migration 013."
            : queryError.message,
        );
      } else setCourses((data ?? []) as PublicCourse[]);
      setLoading(false);
    })();
  }, []);
  const visible = categorySlug
    ? courses.filter((course) =>
        course.categories.some((category) => category.slug === categorySlug),
      )
    : courses;
  const categoryName = courses
    .flatMap((course) => course.categories)
    .find((category) => category.slug === categorySlug)?.name;
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-7 sm:py-14">
        <div className="max-w-2xl">
          <AcademyBrandMark compact />
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-950">
            {categoryName || "Practical learning for modern work"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-600">
            Instructor-led and flexible courses built around useful skills, clear outcomes, and verified completion.
          </p>
        </div>
        <div className="mt-8">
          {error && <Alert>{error}</Alert>}
          {loading ? (
            <div className="rounded-xl bg-white shadow-soft"><TableSkeleton /></div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl bg-white shadow-soft">
              <EmptyState
                icon={<BookOpen size={30} />}
                title="No published courses yet"
                description="Reviewed courses will appear here when enrollment information is ready."
              />
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((course) => (
                <article key={course.course_id} className="overflow-hidden rounded-xl bg-white shadow-soft">
                  {course.cover_image_url ? (
                    <img className="aspect-[16/9] w-full object-cover" src={course.cover_image_url} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-brand-50 text-brand-600">
                      <GraduationCap size={34} />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex flex-wrap gap-1.5">
                      {course.categories.map((category) => (
                        <Link key={category.slug} className="badge-brand" to={`/categories/${category.slug}`}>
                          {category.name}
                        </Link>
                      ))}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-ink-950">{course.title}</h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-600">
                      {course.short_description || course.description}
                    </p>
                    <div className="mt-4 flex items-center gap-3 text-xs text-ink-500">
                      {course.duration_weeks && <span>{course.duration_weeks} weeks</span>}
                      <span className="capitalize">{course.is_self_paced ? "Self-paced" : course.difficulty_level}</span>
                    </div>
                    <Link className="btn-primary mt-5 w-full" to={`/courses/${course.slug}`}>
                      View course <ArrowRight size={15} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </PublicShell>
  );
}

export function PublicCourseDetail() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [course, setCourse] = useState<PublicCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const { data, error: queryError } = await supabase.rpc("get_public_courses", {
        requested_slug: slug,
      });
      if (queryError) setError(queryError.message);
      else setCourse(((data ?? [])[0] as PublicCourse | undefined) ?? null);
      setLoading(false);
    })();
  }, [slug]);
  if (loading)
    return (
      <PublicShell><main className="mx-auto max-w-6xl px-5 py-12 sm:px-7"><TableSkeleton /></main></PublicShell>
    );
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-7 sm:py-14">
        {error && <Alert>{error}</Alert>}
        {!course ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState icon={<BookOpen size={30} />} title="Course not found" description="This course may still be in review." />
          </div>
        ) : (
          <>
            <div className="grid gap-7 lg:grid-cols-[1fr_22rem]">
              <section>
                <div className="flex flex-wrap gap-2">
                  {course.categories.map((category) => (
                    <Link key={category.slug} className="badge-brand" to={`/categories/${category.slug}`}>{category.name}</Link>
                  ))}
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-950">{course.title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-600">{course.description || course.short_description}</p>
                <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-ink-600">
                  {course.duration_weeks && <span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> {course.duration_weeks} weeks</span>}
                  <span className="inline-flex items-center gap-1.5"><BookOpen size={14} /> {course.is_self_paced ? "Self-paced" : "Instructor-led options"}</span>
                  <span className="inline-flex items-center gap-1.5"><Award size={14} /> Completion certificate</span>
                </div>
              </section>
              <aside className="rounded-xl bg-white p-5 shadow-soft">
                <h2 className="font-semibold text-ink-950">Interested in this course?</h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">Create an account for future access options, or sign in if Synergy or your employer has already enrolled you.</p>
                <Link className="btn-primary mt-5 w-full" to="/signup">Create account</Link>
                <Link className="btn-secondary mt-2 w-full" to="/signin">Sign in</Link>
              </aside>
            </div>
            <section className="mt-9">
              <h2 className="text-xl font-semibold text-ink-950">Course outline</h2>
              <div className="mt-4 space-y-3">
                {course.curriculum.length === 0 ? (
                  <p className="rounded-xl bg-white p-5 text-sm text-ink-500 shadow-soft">The detailed outline will be published after curriculum review.</p>
                ) : course.curriculum.map((module, index) => (
                  <details key={`${module.title}-${index}`} className="rounded-xl bg-white px-5 py-4 shadow-soft" open={index === 0}>
                    <summary className="cursor-pointer font-semibold text-ink-900">{module.title}</summary>
                    {module.description && <p className="mt-2 text-sm text-ink-600">{module.description}</p>}
                    <ol className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <li key={`${lesson.title}-${lessonIndex}`} className="flex items-center justify-between gap-3 text-sm text-ink-700">
                          <span>{lesson.title}</span>
                          {lesson.estimated_minutes && <span className="text-xs text-ink-400">{lesson.estimated_minutes} min</span>}
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </PublicShell>
  );
}
