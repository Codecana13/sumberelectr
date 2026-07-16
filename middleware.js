import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Create a new ratelimiter, that allows 20 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(20, '10 s'),
  analytics: true,
  /**
   * Optional prefix for the keys used in redis. This is useful if you want to share a redis
   * instance with other applications and want to avoid key collisions. The default prefix is
   * @upstash/ratelimit
   */
  prefix: '@upstash/ratelimit',
});

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // Pengecualian: Bypass Rate Limiter untuk operasi Admin
  // Karena jalur ini sudah dilindungi Google Sign-In, kita bisa mengabaikan limit di sini.
  if (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/upload-image') ||
    pathname.startsWith('/api/delete-image')
  ) {
    return NextResponse.next();
  }

  // Hanya jalankan rate limiter pada route /api publik
  if (pathname.startsWith('/api')) {
    // Gunakan IP pengguna sebagai identifier unik. 
    // Jika tidak dapat mendeteksi IP, gunakan fallback 'anonymous'.
    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous';

    const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_${ip}`);

    // Jika melebihi batas, kembalikan response 429
    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Terlalu banyak permintaan (Too Many Requests). Silakan coba lagi nanti.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }
  }

  // Lanjutkan request jika belum mencapai limit atau bukan route /api
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/api/:path*',
};
