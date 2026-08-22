import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const refDir = path.join(process.cwd(), 'references');
    const files = await fs.readdir(refDir);
    const xlsxFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

    const fileDetails = await Promise.all(
      xlsxFiles.map(async (name) => {
        const filePath = path.join(refDir, name);
        const stat = await fs.stat(filePath);
        return {
          name,
          sizeKB: (stat.size / 1024).toFixed(1),
          modified: stat.mtime.toISOString(),
        };
      })
    );

    return NextResponse.json({ files: fileDetails });
  } catch (error) {
    console.error('References fetch error:', error);
    return NextResponse.json({ error: `Gagal mengambil daftar file: ${error.message}`, files: [] }, { status: 500 });
  }
}
