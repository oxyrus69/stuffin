import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const VALID_TOKEN = process.env.AUTH_TOKEN || 'jinji';
// nilai cookie yang menandakan sudah login (jangan simpan token mentah)
const COOKIE_VALUE = 'authenticated';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const key = String(body.key ?? body.token ?? '').trim();

    if (!key) {
      return NextResponse.json({ ok: false, error: 'Kunci wajib diisi.' }, { status: 400 });
    }
    if (key !== VALID_TOKEN) {
      // optional: catat percobaan gagal ke Neon (best-effort, jangan blokir login)
      try {
        if (process.env.DATABASE_URL) {
          const { neon } = await import('@neondatabase/serverless');
          const sql = neon(process.env.DATABASE_URL);
          await sql`INSERT INTO auth_attempts (token_tried, success) VALUES (${key.slice(0,32)}, false)`.catch(()=>{});
        }
      } catch {}
      return NextResponse.json({ ok: false, error: 'Kunci tidak valid.' }, { status: 401 });
    }

    // optional: catat sukses
    try {
      if (process.env.DATABASE_URL) {
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        // buat tabel jika belum ada (best-effort)
        await sql`CREATE TABLE IF NOT EXISTS auth_attempts (id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(), token_tried TEXT, success BOOLEAN)`.catch(()=>{});
        await sql`INSERT INTO auth_attempts (token_tried, success) VALUES (${'***'}, true)`.catch(()=>{});
      }
    } catch {}

    const res = NextResponse.json({ ok: true });
    res.cookies.set('app_auth', COOKIE_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Gagal login' }, { status: 500 });
  }
}
