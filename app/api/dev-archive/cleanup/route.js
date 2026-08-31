import { NextResponse } from 'next/server';
import sql from '@/lib/db';

const DEV_COOKIE_NAME = 'dev_auth';
const DEV_COOKIE_OK = 'authenticated';

export const runtime = 'nodejs';

function checkDevAuth(request) {
  const auth = request.cookies.get(DEV_COOKIE_NAME)?.value;
  return auth === DEV_COOKIE_OK;
}

/**
 * DELETE /api/dev-archive/cleanup?days=30
 * Deletes all error_archives rows older than the given number of days.
 * Returns the count of deleted rows.
 */
export async function DELETE(request) {
  if (!checkDevAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);

    if (isNaN(days) || days < 1) {
      return NextResponse.json({ error: 'Parameter days harus angka >= 1' }, { status: 400 });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // First, find archive_groups that are entirely older than the cutoff
    const oldGroups = await sql`
      SELECT DISTINCT archive_group
      FROM error_archives
      WHERE created_at < ${cutoff}
    `;

    if (oldGroups.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: `Tidak ada arsip lebih tua dari ${days} hari.` });
    }

    const groupList = oldGroups.map((r) => r.archive_group);

    // Delete all rows in those groups
    const deleted = await sql`
      DELETE FROM error_archives
      WHERE archive_group = ANY(${groupList})
    `;

    return NextResponse.json({
      success: true,
      deleted: deleted.count || deleted.rowCount || 0,
      groupsRemoved: groupList.length,
      message: `${deleted.count || deleted.rowCount || 0} file dari ${groupList.length} grup dihapus (lebih tua dari ${days} hari).`,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: `Gagal membersihkan: ${error.message}` }, { status: 500 });
  }
}

/**
 * GET /api/dev-archive/cleanup?days=30
 * Preview: count how many files/groups would be deleted without actually deleting.
 */
export async function GET(request) {
  if (!checkDevAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);

    if (isNaN(days) || days < 1) {
      return NextResponse.json({ error: 'Parameter days harus angka >= 1' }, { status: 400 });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await sql`
      SELECT COUNT(DISTINCT archive_group) as groups, COUNT(*) as files
      FROM error_archives
      WHERE created_at < ${cutoff}
    `;

    const row = result[0] || { groups: 0, files: 0 };

    return NextResponse.json({
      days,
      cutoff: cutoff.toISOString(),
      groupsAtRisk: parseInt(row.groups, 10),
      filesAtRisk: parseInt(row.files, 10),
    });
  } catch (error) {
    console.error('Cleanup preview error:', error);
    return NextResponse.json({ error: `Gagal memeriksa: ${error.message}` }, { status: 500 });
  }
}
