import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, created_at, stuffing_file_name, inspection_file_name, blc_file_name,
             pack_blc_updated, po_passed, po_rejected, si_blc_updated,
             output_size_kb, status, error_message
      FROM processing_history
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return NextResponse.json({ history: rows });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: `Gagal mengambil riwayat: ${error.message}`, history: [] }, { status: 500 });
  }
}
