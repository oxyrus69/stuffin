import { NextResponse } from 'next/server';
import sql from '@/lib/db';

const DEV_COOKIE_NAME = 'dev_auth';
const DEV_COOKIE_OK = 'authenticated';

export const runtime = 'nodejs';
export const maxDuration = 60;

function checkDevAuth(request) {
  const auth = request.cookies.get(DEV_COOKIE_NAME)?.value;
  return auth === DEV_COOKIE_OK;
}

/**
 * POST /api/dev-archive/reprocess
 * Body: { archive_group: string }
 *
 * Fetches all files from the given archive group, reconstructs
 * the FormData as the original upload expected, and forwards it
 * to the correct processing endpoint server-side.
 *
 * - BLC (page=proses) → POST /api/process-excel → returns Excel buffer
 * - Akumulasi (page=akumulasi) → returns files for client-side re-run
 */
export async function POST(request) {
  if (!checkDevAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { archive_group } = await request.json();
    if (!archive_group) {
      return NextResponse.json({ error: 'archive_group dibutuhkan' }, { status: 400 });
    }

    // Fetch all files in this archive group
    const rows = await sql`
      SELECT id, file_name, file_size, file_bytes, page, error_message
      FROM error_archives
      WHERE archive_group = ${archive_group}
      ORDER BY id ASC
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Arsip tidak ditemukan' }, { status: 404 });
    }

    const page = rows[0].page;

    if (page === 'proses') {
      // BLC re-process: reconstruct FormData → POST to /api/process-excel
      const formData = new FormData();

      for (const row of rows) {
        const buffer = Buffer.from(row.file_bytes);
        const ext = row.file_name.split('.').pop()?.toLowerCase() || 'xlsx';
        const mimeType = ext === 'xls'
          ? 'application/vnd.ms-excel'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([buffer], { type: mimeType });
        const file = new File([blob], row.file_name, { type: mimeType });

        // Heuristic: if file name contains "stuffing" → stuffing field, else jit
        const isStuffing = /stuffing|stuff/i.test(row.file_name);
        if (isStuffing) {
          formData.append('stuffing', file);
        } else {
          formData.append('jit', file);
        }
      }

      // Forward to processing endpoint
      const host = request.headers.get('host') || 'localhost:3000';
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const processingUrl = `${proto}://${host}/api/process-excel`;

      const processRes = await fetch(processingUrl, {
        method: 'POST',
        body: formData,
      });

      if (!processRes.ok) {
        const errData = await processRes.json().catch(() => ({ error: 'Gagal memproses ulang' }));
        return NextResponse.json(
          { error: errData.error || `Processing gagal (${processRes.status})`, mode: 'blc' },
          { status: processRes.status }
        );
      }

      // Return the Excel file
      const excelBuffer = Buffer.from(await processRes.arrayBuffer());
      const outName = processRes.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] || 'reprocess.xlsx';

      return new Response(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${outName}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (page === 'akumulasi') {
      // Akumulasi: return files as downloadable blobs for client-side re-processing
      // Since akumulasi pipeline runs in-browser, we return the file data
      const files = rows.map((row) => ({
        id: row.id,
        file_name: row.file_name,
        file_size: row.file_size,
        // Return base64-encoded bytes for client reconstruction
        file_data: Buffer.from(row.file_bytes).toString('base64'),
      }));

      return NextResponse.json({
        mode: 'akumulasi',
        message: 'File akumulasi siap untuk diproses ulang di dashboard.',
        files,
      });
    }

    return NextResponse.json({ error: `Tipe proses tidak dikenali: ${page}` }, { status: 400 });
  } catch (error) {
    console.error('Reprocess error:', error);
    return NextResponse.json({ error: `Gagal memproses ulang: ${error.message}` }, { status: 500 });
  }
}
