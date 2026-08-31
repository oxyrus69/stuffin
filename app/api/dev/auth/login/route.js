import { NextResponse } from 'next/server';

const DEV_TOKEN = process.env.DEV_TOKEN || 'itsendri666';
const DEV_COOKIE_NAME = 'dev_auth';
const DEV_COOKIE_OK = 'authenticated';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();
    const token = body?.token;

    if (!token || token !== DEV_TOKEN) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(DEV_COOKIE_NAME, DEV_COOKIE_OK, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Dev auth error:', error);
    return NextResponse.json({ error: 'Gagal autentikasi dev' }, { status: 500 });
  }
}

export async function GET(request) {
  const auth = request.cookies.get(DEV_COOKIE_NAME)?.value;
  const authed = auth === DEV_COOKIE_OK;
  return NextResponse.json({ authenticated: authed });
}