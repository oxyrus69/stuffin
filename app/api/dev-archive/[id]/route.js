import { NextResponse } from 'next/server';
import sql from '@/lib/db';

const DEV_COOKIE_NAME = 'dev_auth';
const DEV_COOKIE_OK = 'authenticated';

export const runtime = 'nodejs';

function checkDevAuth(request) {
  const auth = request.cookies.get(DEV_COOKIE_NAME)?.value;
  return auth === DEV_COOKIE_OK;
}

export async function GET(request, { params }) {
  if (!checkDevAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const row = await sql`
      SELECT file_name, file_bytes, file_size, archive_group, error_message, error_stack
      FROM error_archives
      WHERE id = ${id}
    `;

    if (!row || row.length === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
    }

    const data = row[0];
    const buffer = Buffer.from(data.file_bytes);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${data.file_name}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Dev archive download error:', error);
    return NextResponse.json({ error: `Gagal mengunduh: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!checkDevAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const row = await sql`
      SELECT archive_group FROM error_archives WHERE id = ${id}
    `;

    if (!row || row.length === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
    }

    // Delete all files in the same archive group
    const result = await sql`
      DELETE FROM error_archives WHERE archive_group = ${row[0].archive_group}
    `;

    return NextResponse.json({
      success: true,
      deleted: result.count || result.rowCount || 0,
      message: `${result.count || result.rowCount || 0} file dihapus dari grup ${row[0].archive_group}`,
    });
  } catch (error) {
    console.error('Dev archive delete error:', error);
    return NextResponse.json({ error: `Gagal menghapus: ${error.message}` }, { status: 500 });
  }
}