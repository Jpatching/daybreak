import Link from 'next/link';
import { posts } from '@/content/blog';

export const metadata = {
  title: 'Blog',
  description:
    'Research and guides on Solana deployer reputation, rug pull detection, and token safety. Learn how to protect yourself before you trade.',
  alternates: { canonical: '/blog' },
};

export default function BlogPage() {
  const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2 text-white">Blog</h1>
          <p className="text-slate-400 text-center mb-12">
            Research and guides on Solana token safety and deployer reputation.
          </p>

          <div className="space-y-6">
            {sorted.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block p-6 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-amber-500/50 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <time className="text-xs text-slate-500">
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span className="text-xs text-slate-600">{post.readTime} read</span>
                </div>
                <h2 className="text-xl font-semibold text-white group-hover:text-amber-400 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-slate-400 text-sm">{post.description}</p>
                <div className="flex gap-2 mt-3">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
