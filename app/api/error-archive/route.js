import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const archiveGroup = formData.get('archive_group');
    const page = formData.get('page');
    const errorMessage = formData.get('error_message') || null;
    const errorStack = formData.get('error_stack') || null;

    if (!archiveGroup || !page) {
      return NextResponse.json({ error: 'archive_group dan page dibutuhkan' }, { status: 400 });
    }

    const files = formData.getAll('files').filter((f) => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file dalam request' }, { status: 400 });
    }

    const inserted = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await sql`
        INSERT INTO error_archives (archive_group, page, file_name, file_size, file_bytes, error_message, error_stack)
        VALUES (${archiveGroup}, ${page}, ${file.name}, ${file.size}, ${buffer}, ${errorMessage}, ${errorStack})
        RETURNING id, created_at, file_name, file_size
      `;
      inserted.push(result[0]);
    }

    return NextResponse.json({ success: true, archived: inserted.length, files: inserted });
  } catch (error) {
    console.error('Error archive failed:', error);
    return NextResponse.json({ error: `Gagal mengarsipkan: ${error.message}` }, { status: 500 });
  }
}