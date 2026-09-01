import { NextResponse } from 'next/server';
import sql from '@/lib/db';

const DEV_COOKIE_NAME = 'dev_auth';
const DEV_COOKIE_OK = 'authenticated';

export const runtime = 'nodejs';

function checkDevAuth(request) {
  const auth = request.cookies.get(DEV_COOKIE_NAME)?.value;
  return auth === DEV_COOKIE_OK;
}

export async function GET(request) {
  if (!checkDevAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { group, page, search, from, to } = Object.fromEntries(new URL(request.url).searchParams);

    const conditions = [];
    if (group) conditions.push(sql`archive_group = ${group}`);
    if (page) conditions.push(sql`page = ${page}`);
    if (search) {
      const pat = `%${search}%`;
      conditions.push(sql`(file_name ILIKE ${pat} OR error_message ILIKE ${pat} OR error_stack ILIKE ${pat})`);
    }
    if (from) conditions.push(sql`created_at >= ${from}::timestamptz`);
    if (to) conditions.push(sql`created_at <= ${to}::timestamptz`);

    let rows;
    if (conditions.length === 0) {
      rows = await sql`
        SELECT id, created_at, archive_group, page, file_name, file_size, error_message, error_stack, metadata
        FROM error_archives
        ORDER BY created_at DESC LIMIT 200
      `;
    } else if (conditions.length === 1) {
      rows = await sql`
        SELECT id, created_at, archive_group, page, file_name, file_size, error_message, error_stack, metadata
        FROM error_archives
        WHERE ${conditions[0]}
        ORDER BY created_at DESC LIMIT 200
      `;
    } else if (conditions.length === 2) {
      rows = await sql`
        SELECT id, created_at, archive_group, page, file_name, file_size, error_message, error_stack, metadata
        FROM error_archives
        WHERE ${conditions[0]} AND ${conditions[1]}
        ORDER BY created_at DESC LIMIT 200
      `;
    } else if (conditions.length === 3) {
      rows = await sql`
        SELECT id, created_at, archive_group, page, file_name, file_size, error_message, error_stack, metadata
        FROM error_archives
        WHERE ${conditions[0]} AND ${conditions[1]} AND ${conditions[2]}
        ORDER BY created_at DESC LIMIT 200
      `;
    } else if (conditions.length === 4) {
      rows = await sql`
        SELECT id, created_at, archive_group, page, file_name, file_size, error_message, error_stack, metadata
        FROM error_archives
        WHERE ${conditions[0]} AND ${conditions[1]} AND ${conditions[2]} AND ${conditions[3]}
        ORDER BY created_at DESC LIMIT 200
      `;
    } else {
      rows = await sql`
        SELECT id, created_at, archive_group, page, file_name, file_size, error_message, error_stack, metadata
        FROM error_archives
        WHERE ${conditions[0]} AND ${conditions[1]} AND ${conditions[2]} AND ${conditions[3]} AND ${conditions[4]}
        ORDER BY created_at DESC LIMIT 200
      `;
    }

    const grouped = {};
    for (const row of rows) {
      const g = row.archive_group;
      if (!grouped[g]) {
        grouped[g] = {
          archive_group: g,
          created_at: row.created_at,
          page: row.page,
          files: [],
          error_message: row.error_message,
          error_stack: row.error_stack,
          metadata: row.metadata,
        };
      }
      grouped[g].files.push({
        id: row.id,
        file_name: row.file_name,
        file_size: row.file_size,
        created_at: row.created_at,
      });
    }

    const list = Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json({ archives: list });
  } catch (error) {
    console.error('Dev archive list error:', error);
    return NextResponse.json({ error: `Gagal mengambil arsip: ${error.message}` }, { status: 500 });
  }
}