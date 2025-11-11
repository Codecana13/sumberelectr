import Link from 'next/link';

export default function HomeArticles({ articles = [] }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-primary">Artikel Terbaru</h2>
        <Link href="/article" className="text-sm text-blue-600 hover:underline font-semibold">
          Lihat Semua Artikel &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {articles.slice(0, 4).map(article => (
          <Link key={article.id || article.slug} href={`/article/${article.slug}`} className="group">
            <article className="rounded-lg overflow-hidden shadow border hover:shadow-lg transition bg-white flex flex-col h-full min-h-[230px]">
              <div className="aspect-w-1 aspect-h-1 bg-gray-100">
                <img
                  src={article.image || '/images/default-article.jpg'}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  loading="lazy"
                  style={{ minHeight: 100, maxHeight: 120 }}
                />
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <span className="text-[10px] text-primary font-semibold mb-1 uppercase truncate">
                  {article.category}
                </span>
                <h3 className="text-xs font-bold mb-1 group-hover:text-primary transition line-clamp-2">{article.title}</h3>
                <p className="text-gray-600 mb-2 text-xs line-clamp-2">{article.excerpt}</p>
                <div className="mt-auto flex items-center justify-between text-[10px] text-gray-400">
                  <span>{article.author}</span>
                  <span>{article.date ? new Date(article.date).toLocaleDateString('id-ID') : ''}</span>
                </div>
              </div>
            </article>
          </Link>
        ))}
        {articles.length === 0 && (
          <div className="col-span-4 text-center text-gray-500 py-10">Belum ada artikel.</div>
        )}
      </div>
    </section>
  );
}