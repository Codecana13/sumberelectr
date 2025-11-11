import Link from 'next/link';

export default function Trending({ articles }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-3">Trending</h2>
      <ol className="space-y-4">
        {articles.map((article, idx) => (
          <li key={article.id} className="flex gap-2 items-start">
            <span className="font-bold text-primary text-lg">{String(idx + 1).padStart(2, '0')}.</span>
            <div>
              <Link href={`/article/${article.slug}`} className="font-semibold hover:text-primary transition block">{article.title}</Link>
              <div className="text-xs text-gray-400">
                {article.author} &middot; {article.date ? new Date(article.date).toLocaleDateString('id-ID') : ''}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}