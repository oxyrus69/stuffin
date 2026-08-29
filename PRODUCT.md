# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Satu pengguna utama: admin/PPIC internal pabrik sepatu (pemilik aplikasi) yang memproses laporan produksi harian setiap pagi. Antarmuka berbahasa Indonesia. Tidak ada pengguna eksternal; aplikasi internal dengan kunci akses bersama ("jinji").

## Product Purpose

HOPE mengotomatisasi dua pekerjaan Excel harian yang sebelumnya manual:

1. **Proses BLC** — menggabungkan banyak file laporan harian JIT (`.xlsx`/`.xls`, termasuk export HTML-GBK dari ERP Tiongkok) menjadi satu sheet `Blc` berformat: filter order NB (`U**N*`, contoh U07NB0001), buang duplikat (file paling awal menang), urutkan OrdNo mengikuti tahun fiskal (U07→U08→U09→U10→U11→U12→U01→…→U06), lalu hasilkan `BLC HDU <bulan>.<tanggal> PAGI.xlsx` — atau menimpa sheet Blc di dalam Stuffing List (`Stuffing_Terupdate.xlsx`).
2. **Akumulasi** — membaca laporan harian per line (STT = output Sewing, ASS = input Assembling), mengisi template mingguan (`akumulasi-template.xlsx`), menghitung ulang Total, dan mengunduh `akumulasi.xlsx`.

Sukses = kedua file hasil itu terbuka bersih di Excel tanpa dialog repair dan siap dikirim tanpa edit manual.

## Positioning

Semua pemrosesan berjalan sepenuhnya di browser (fflate + SheetJS + OOXML surgery) — file produksi tidak pernah meninggalkan perangkat, sehingga batas upload ±4.5 MB Vercel tidak relevan. Penyuntingan OOXML bedah-per-dua (ganti hanya sheet target, append style, buang calcChain usang) menghasilkan file yang Excel terima tanpa perbaikan — kegagalan library round-trip penuh yang dipelajari dari kejadian nyata.

## Operating Context

- Ritual harian pagi: laporan JIT pagi → BLC PAGI; laporan harian line → akumulasi mingguan.
- Sumber data berupa export .XLS dari ERP Tiongkok (GBK/HTML, kadang frameset `sheet001.htm`), sering tanpa ekstensi yang jujur.
- Nama file mengikuti pola `BLC HDU <bulan>.<tanggal> PAGI`; baris 4 sheet = jumlah baris data + 5 (konvensi legacy).
- Terminologi: OrdNo NB (`U**N*` mis. U07NB0001), line Sewing S01–S18/T02/T03/IP, Assembling A01–A18, kolom mingguan D1…D31.
- Referensi output benar: `references/OUTPUT_SEWING_ASSEMBLY_CORRECt.xlsx` dan folder `references/` untuk file uji.

## Capabilities and Constraints

- Diploy di Vercel (`vercel.json`); basis data Neon PostgreSQL via `DATABASE_URL` (`.env.local`), tabel `processing_history` & `auth_attempts` (best-effort).
- Autentikasi: kunci akses tunggal `jinji` (override via `AUTH_TOKEN`), cookie HttpOnly `app_auth=authenticated` 7 hari, middleware memproteksi `/dashboard`.
- Riwayat proses ke Neon direncanakan tetapi sengaja ditunda — halaman Riwayat & Pengaturan tetap placeholder "Soon" untuk saat ini (keputusan pemilik: "nanti saja").
- Proses Excel harus tetap client-side; hindari round-trip workbook penuh melalui library kedua.
- Output file harus selalu lolos buka Excel tanpa dialog repair (perbaikan calcChain/definedName/externalLink adalah perilaku produk, bukan bonus).

## Brand Commitments

- Nama mengikat: **HOPE** — tagline penuh **"Help Out Purest Entity"**.
- Makna yang dijaga (kata pemilik): *"secercah harapan untuk tetap bertahan hidup"* — diekspresikan antara lain lewat animasi glow pada teks tagline di footer dashboard.
- Bahasa antarmuka: Indonesia. Avatar operator: "OP".

## Evidence on Hand

- File uji nyata di `references/` (Data JIT, Stuffing List, ASS/STT) dan acuan output benar `references/OUTPUT_SEWING_ASSEMBLY_CORRECt.xlsx`.
- Template resmi `public/akumulasi-template.xlsx`.
- Tidak ada testimoni, logo berkas, atau materi pemasaran — jangan mengarang; aplikasi internal tanpa halaman publik.

## Product Principles

1. File keluar harus bersih di Excel — tanpa dialog repair, tanpa langkah manual tambahan.
2. Data tidak boleh meninggalkan perangkat pengguna; pemrosesan client-side adalah fitur kepercayaan.
3. Ergonomi untuk pemakai harian tunggal: sedikit langkah, pesan jelas berbahasa Indonesia, bantuan yang bisa ditindaklanjuti saat file ditolak.
4. Menghormati pola kerja yang sudah ada (nama file, urutan baris, konvensi legacy) daripada menyeragamkannya.
