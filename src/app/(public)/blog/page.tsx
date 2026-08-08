import Link from "next/link";
import { posts } from "@/blog/posts";
import { MdArrowForward, MdCalendarMonth, MdSchedule } from "react-icons/md";
import { format } from "date-fns";

export default function BlogPage() {
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-15 md:py-20">
      <div className="mb-12 md:mb-16 text-center">
        <span className="inline-block bg-secondary/10 text-secondary px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded mb-5">
          TaskHub Blog
        </span>
        <h1 className="font-headline text-4xl sm:text-5xl font-extrabold text-primary tracking-tight leading-tight">
          Insights for the modern task economy
        </h1>
        <p className="text-primary/60 text-base sm:text-lg font-light max-w-2xl mx-auto mt-4">
          Practical guides for workers, buyers, and anyone building a career
          around flexible digital work.
        </p>
      </div>

      {featured && (
        <Link
          href={`/blog/${featured.slug}`}
          className="group block mb-12 md:mb-16"
        >
          <article className="grid md:grid-cols-2 gap-0 md:gap-10 items-stretch bg-white rounded-3xl border border-primary/5 shadow-sm overflow-hidden hover:shadow-xl transition-shadow">
            <div
              className={`relative min-h-[220px] md:min-h-full bg-linear-to-br ${featured.gradient} p-8 flex flex-col justify-end`}
            >
              <span className="self-start bg-white/20 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                Featured · {featured.tag}
              </span>
              <p className="mt-auto pt-24 text-6xl font-black text-white/10 select-none">
                01
              </p>
            </div>
            <div className="p-8 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-4 text-xs text-primary/40 mb-4">
                <span className="flex items-center gap-1.5">
                  <MdCalendarMonth />
                  {format(new Date(featured.date), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1.5">
                  <MdSchedule />
                  {featured.readTime}
                </span>
              </div>
              <h2 className="font-headline text-2xl md:text-3xl font-bold text-primary mb-3 leading-snug">
                {featured.title}
              </h2>
              <p className="text-primary/60 font-light leading-relaxed mb-6">
                {featured.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-secondary">
                  {featured.author} · {featured.authorRole}
                </span>
                <span className="flex items-center gap-2 text-sm font-bold text-primary">
                  Read article
                  <MdArrowForward className="text-secondary" />
                </span>
              </div>
            </div>
          </article>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rest.map((post, i) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
            <article className="h-full bg-white rounded-2xl border border-primary/5 shadow-sm overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              <div
                className={`relative h-40 bg-linear-to-br ${post.gradient} p-5 flex flex-col justify-between`}
              >
                <span className="self-start bg-white/20 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  {post.tag}
                </span>
                <span className="text-5xl font-black text-white/10 select-none">
                  {String(i + 2).padStart(2, "0")}
                </span>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 text-[11px] text-primary/40 mb-3">
                  <span className="flex items-center gap-1">
                    <MdCalendarMonth />
                    {format(new Date(post.date), "MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <MdSchedule />
                    {post.readTime}
                  </span>
                </div>
                <h3 className="font-headline text-lg font-bold text-primary mb-2 leading-snug group-hover:text-secondary transition-colors line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-sm text-primary/60 font-light leading-relaxed line-clamp-3 mb-4">
                  {post.excerpt}
                </p>
                <span className="mt-auto flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-secondary transition-colors">
                  Read article
                  <MdArrowForward className="text-base" />
                </span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}