import { notFound } from 'next/navigation';
import Link from 'next/link';
import { posts } from '@/content/blog';

export async function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `/blog/${slug}`,
      publishedTime: post.date,
      authors: ['Daybreak'],
      tags: post.tags,
    },
    twitter: {
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  let Content;
  try {
    const mod = await import(`@/content/blog/${slug}.mdx`);
    Content = mod.default;
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/blog"
            className="text-sm text-slate-500 hover:text-amber-400 transition-colors mb-8 inline-block"
          >
            &larr; Back to Blog
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <time className="text-sm text-slate-500">
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="text-sm text-slate-600">{post.readTime} read</span>
          </div>

          <article className="prose prose-invert prose-amber max-w-none prose-headings:font-semibold prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline prose-code:text-amber-400 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700 prose-table:text-sm prose-th:text-slate-300 prose-td:text-slate-400">
            <Content />
          </article>

          <div className="flex gap-2 mt-8 pt-8 border-t border-slate-700">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: post.title,
                description: post.description,
                datePublished: post.date,
                author: {
                  '@type': 'Organization',
                  name: 'Daybreak',
                  url: 'https://github.com/Jpatching/daybreak',
                },
                publisher: {
                  '@type': 'Organization',
                  name: 'DaybreakScan',
                  url: 'https://www.daybreakscan.com',
                },
              }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
