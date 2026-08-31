import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS processing_history (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        stuffing_file_name TEXT,
        inspection_file_name TEXT,
        blc_file_name TEXT,
        pack_blc_updated INTEGER DEFAULT 0,
        po_passed INTEGER DEFAULT 0,
        po_rejected INTEGER DEFAULT 0,
        si_blc_updated INTEGER DEFAULT 0,
        output_size_kb TEXT,
        status TEXT DEFAULT 'success',
        error_message TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS error_archives (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        archive_group TEXT NOT NULL,
        page TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        file_bytes BYTEA NOT NULL,
        error_message TEXT,
        error_stack TEXT,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_error_archives_group ON error_archives(archive_group);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_error_archives_created ON error_archives(created_at DESC);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_error_archives_page ON error_archives(page);
    `;

    return NextResponse.json({ success: true, message: 'Database tables initialized.' });
  } catch (error) {
    console.error('DB init error:', error);
    return NextResponse.json({ error: `Database init failed: ${error.message}` }, { status: 500 });
  }
}