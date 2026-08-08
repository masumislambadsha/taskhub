import Link from "next/link";
import { notFound } from "next/navigation";
import { posts, getPostBySlug } from "@/blog/posts";
import { format } from "date-fns";
import {
  MdArrowBack,
  MdArrowForward,
  MdCalendarMonth,
  MdSchedule,
} from "react-icons/md";

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = posts
    .filter((p) => p.slug !== slug)
    .sort((a, b) => {
      const aScore = a.tag === post.tag ? 1 : 0;
      const bScore = b.tag === post.tag ? 1 : 0;
      return bScore - aScore;
    })
    .slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary/60 hover:text-primary transition-colors mb-8"
      >
        <MdArrowBack />
        All articles
      </Link>

      <div className="grid lg:grid-cols-3 gap-10 lg:gap-16">
        <article className="lg:col-span-2">
          <div
            className={`relative h-56 md:h-80 rounded-3xl bg-linear-to-br ${post.gradientAccent} p-8 flex flex-col justify-between mb-8`}
          >
            <span className="self-start bg-white/20 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              {post.tag}
            </span>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight max-w-2xl">
              {post.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-primary/40 pb-6 border-b border-primary/5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center font-bold text-secondary">
                {post.author[0]}
              </div>
              <div>
                <p className="font-semibold text-primary">{post.author}</p>
                <p className="text-xs text-primary/40">{post.authorRole}</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 ml-auto">
              <MdCalendarMonth />
              {format(new Date(post.date), "MMMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1.5">
              <MdSchedule />
              {post.readTime}
            </span>
          </div>

          <div className="space-y-5">
            {post.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="text-primary/75 leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {post.tips && post.tips.length > 0 && (
            <div className="mt-8 bg-secondary/5 border border-secondary/20 rounded-2xl p-6 md:p-8">
              <h3 className="font-headline font-bold text-primary mb-4">
                Key takeaways
              </h3>
              <ul className="space-y-3">
                {post.tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-secondary shrink-0" />
                    <span className="text-sm text-primary/70">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-between items-center bg-primary rounded-2xl p-6 md:p-8">
            <div>
              <p className="font-headline font-bold text-white text-lg mb-1">
                Ready to put this into practice?
              </p>
              <p className="text-white/60 text-sm">
                Create a free TaskHub account and start today.
              </p>
            </div>
            <Link
              href="/register"
              className="bg-secondary text-white px-6 py-3 rounded-xl font-bold text-sm hover:scale-95 transition-transform shrink-0"
            >
              Get Started
            </Link>
          </div>
        </article>

        <aside className="lg:col-span-1">
          <h2 className="font-headline font-bold text-primary mb-5">
            More to read
          </h2>
          <div className="space-y-4">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group block bg-white rounded-2xl border border-primary/5 p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 text-[11px] text-primary/40 mb-2">
                  <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-semibold uppercase tracking-widest">
                    {p.tag}
                  </span>
                  <span>{format(new Date(p.date), "MMM d, yyyy")}</span>
                </div>
                <h3 className="font-semibold text-primary text-sm leading-snug mb-2 group-hover:text-secondary transition-colors">
                  {p.title}
                </h3>
                <span className="flex items-center gap-1 text-xs font-bold text-primary group-hover:text-secondary">
                  Read
                  <MdArrowForward className="text-sm" />
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}