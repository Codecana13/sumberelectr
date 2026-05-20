import Link from 'next/link';

export default function LatestArticles({ articles, categories, loading, error }) {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-3">Artikel Terbaru</h2>
      {loading && <div>Memuat artikel…</div>}
      {error && <div className="text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map(article => (
          <Link key={article.id} href={`/article/${article.slug}`} className="group">
            <article className="rounded-xl overflow-hidden shadow border hover:shadow-lg transition bg-white flex flex-col h-full">
              <div className="aspect-w-16 aspect-h-9 bg-gray-100">
                <img src={article.image || '/images/default-article.jpg'} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <span className="text-xs text-primary font-semibold mb-2 uppercase">
                  {categories.find(c => c.slug === article.category)?.name}
                </span>
                <h2 className="text-base font-bold mb-2 group-hover:text-primary transition">{article.title}</h2>
                <p className="text-gray-600 mb-3 text-sm">{article.excerpt}</p>
                <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
                  <span>{article.author}</span>
                  <span>{article.date ? new Date(article.date).toLocaleDateString('id-ID') : ''}</span>
                </div>
              </div>
            </article>
          </Link>
        ))}
        {articles.length === 0 && !loading && (
          <div className="col-span-2 text-center text-gray-500 py-10">Belum ada artikel di kategori ini.</div>
        )}
      </div>
    </div>
  );
}