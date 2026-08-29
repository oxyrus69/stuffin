---
name: HOPE
description: Alat kerja gelap presisi-rendah — otomatisasi BLC & Akumulasi dalam satu ruang kerja mono hitam-putih
colors:
  void-black: "#000000"
  surface-black: "#0a0a0a"
  raised-black: "#111111"
  hover-black: "#1a1a1a"
  hairline: "#1f1f1f"
  hairline-soft: "#232323"
  hairline-strong: "#262626"
  ink-white: "#ffffff"
  text-primary: "#ededed"
  text-secondary: "#888888"
  text-tertiary: "#666666"
  status-green: "#4ade80"
  status-red: "#f87171"
  beacon-amber: "#facc15"
typography:
  display:
    fontFamily: "Inter, Geist Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.08em"
    textTransform: uppercase
  label-soft:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink-white}"
    textColor: "#000000"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "#ededed"
    textColor: "#000000"
  button-secondary:
    backgroundColor: "{colors.surface-black}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface-black}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  nav-item-active:
    backgroundColor: "{colors.ink-white}"
    textColor: "#000000"
    rounded: "{rounded.sm}"
  avatar-operator:
    backgroundColor: "{colors.ink-white}"
    textColor: "#000000"
    size: "32px"
---

# Design System: HOPE

## Overview

**Creative North Star: "Lampu Kerja Tengah Malam"**

HOPE adalah ruang kerja gelap tunggal: hitam pekat sebagai kanvas, garis rambut 1px sebagai struktur, dan putih sebagai satu-satunya lampu. Sistem ini percaya bahwa di alat kerja harian, cahaya harus langkah — setiap elemen putih di layar adalah tempat mata seharusnya mendarat. Warna lain tidak boleh bersaing dengan lampu itu; hijau, merah, dan amber hanya menyala saat sistem berbicara tentang status. Satu-satunya glow dekoratif dalam seluruh sistem adalah tagline "Help Out Purest Entity" di footer — secercah harapan yang berdenyut pelan, sesuai makna nama produk itu sendiri.

Suara sistem ini adalah presisi senyap: tenang, teratur, dingin-lurus, tapi selalu responsif. Hover berubah tegas (border putih, isi putih), fokus terlihat jelas, transisi 150–200 ms tanpa teater. Anti-referensi yang ditolak tegas: dashboard SaaS warna-warni, gradien dekoratif, glassmorphism, dan bayangan lembut sebagai dekorasi.

**Key Characteristics:**
- Force-dark monokrom; kontras dari nilai hitam berlapis (#000 → #0a0a0a → #111 → #1a1a1a), bukan dari bayangan
- Aksen tunggal putih (#ffffff) — tombol utama, nav aktif, avatar, hover border
- Tipografi Inter/Geist dengan tracking negatif halus (-0.01 s/d -0.03em); mono hanya untuk label teknis dan jejak breadcrumb
- Semantik warna terbatas: hijau #4ade80 sukses, merah #f87171 galat, amber #facc15 bantuan — tidak pernah dekoratif
- Kedalaman = border + tonal layering; shadow hanya untuk overlay di atas konten

## Colors

Palet mono kontras tegas: hitam berjenjang sebagai bidang, putih sebagai satu-satunya suara, semantik tiga warna untuk status.

### Primary
- **Ink White** (#ffffff): satu-satunya aksen. Tombol primer, item nav aktif (teks hitam di atasnya), avatar operator, ikon brand, hover-border pada kontrol. Kelangkaannya adalah kekuatannya.

### Secondary
- *(tidak ada — sistem sengaja tidak punya aksen kedua; status memakai trio semantik di bawah)*

### Tertiary (semantik status)
- **Status Green** (#4ade80): pesan sukses, titik sukses — selalu di atas latar #0a1a0a dengan border #1a3a1a.
- **Status Red** (#f87171): pesan galat, dropzone error — latar #1a0a0a, border #3a1a1a.
- **Beacon Amber** (#facc15): kartu bantuan/panduan (💡) dan peringatan — selalu berpasangan dengan latar #1a1a0a.

### Neutral
- **Void Black** (#000000): latar shell penuh, sidebar, header, footer, kanvas `pre`/kode.
- **Surface Black** (#0a0a0a): kartu, dropzone, dropdown, input-card — lapisan pertama di atas void.
- **Raised Black** (#111111): isi header tabel, hover baris/nav, badge "Soon".
- **Hover Black** (#1a1a1a): hover tombol sekunder & ghost, kartu navigasi cepat saat disentuh.
- **Hairline** (#1f1f1f): border kartu, pembagi, garis footer — border default sistem.
- **Hairline Soft** (#232323): border elemen pasif (ikon tombol, pill, dropdown item).
- **Hairline Strong** (#262626): border komponen interaktif (dropzone, tombol sekunder, scrollbar, garis timeline) — juga warna scrollbar.
- **Text Primary** (#ededed): teks isi utama di atas hitam.
- **Text Secondary** (#888888): deskripsi, subjudul, label sekunder.
- **Text Tertiary** (#666666): teks tersier, ikon pasif, breadcrumb, jejak mono.
- **Placeholder** (#666): input placeholder — lebih redup dari teks sekunder.

### Named Rules
**The One Light Rule.** Putih adalah satu-satunya warna aksen. Pada layar apa pun, elemen putih isi-penuh ≤ 10% area — tombol utama, satu nav aktif, avatar. Jika dua elemen bersaing jadi "terang", salah satunya salah.

**The Status Trio Rule.** Hijau/merah/amber hanya untuk menyatakan keadaan (sukses, gagal, bantuan). Tidak pernah dipakai dekoratif, tidak pernah di chrome tetap.

## Typography

**Display/Body Font:** Inter (fallback "Geist Sans", ui-sans-serif, system-ui, Segoe UI, Roboto) — diaktifkan dengan `font-feature-settings: "ss01","ss02"` pada shell dashboard.
**Label/Mono Font:** Geist Mono / ui-monospace — untuk label teknis, tanggal, breadcrumb, ukuran file.

**Character:** Geist sans dengan tracking negatif memberi rasa instrumen presisi; mono hanya muncul untuk data teknis — label uppercase berjarak lebar (0.08em), bukan untuk kalimat.

### Hierarchy
- **Display** (600, 22px, -0.03em): angka statistik besar di kartu ringkasan. Langka.
- **Title** (600, 13–14px, -0.01/-0.02em): judul halaman, judul kartu, label tombol, nama menu.
- **Body** (400, 14px, -0.01em, line-height ~1.4): deskripsi, pesan status, panduan.
- **Label** (500, 10–12px mono, uppercase, tracking 0.08em): label metrik, breadcrumb, header kolom tabel, "SOON" badge.

### Named Rules
**The Tracking-Down Rule.** Semua teks ukuran ≥13px memakai tracking negatif halus (-0.01 s.d. -0.03em); mono uppercase justru melebar (0.08em). Tidak ada teks besar dengan tracking normal.

## Layout

Shell aplikasi tinggi penuh (`h-screen`, `overflow-hidden`): sidebar kiri (220px; 56px saat ciut; off-canvas + scrim blur di mobile), header 64px, konten utama scrollable dengan kontainer `max-width: 1160px`, padding 16px (mobile) / 24px (desktop). Ritme konten: kolom `space-y-4` (16px) antar-blok; dalam kartu `p-4`; grid kartu navigasi `gap-3` dengan min-height 96px per kartu; grid responsif 1→2→3 kolom (sm/lg). Footer duduk `mt-8` di bawah breadcrumb halaman; breadcrumb mono kecil (`stuffing / <halaman>`) selalu ada di atas konten.

## Elevation & Depth

Sistem ini flat-by-default: kedalaman disampaikan lewat lapisan warna hitam (#000 → #0a0a0a → #111 → #1a1a1a) dan garis rambut 1px (#1f1f1f / #232323 / #262626) — bukan bayangan. Satu-satunya shadow struktural adalah overlay (dropdown profil, popover bantuan): `0 8px 24px rgba(0,0,0,0.5–0.6)`. Fokus keyboard memakai ring, bukan shadow lembut: `focus-visible:ring-2 ring-white/20`.

### Shadow Vocabulary
- **Overlay Drop** (`0 8px 24px rgba(0,0,0,0.5–0.6)`): dropdown profil, popover bantuan error — satu-satunya bayangan yang sah.

### Named Rules
**The Flat-By-Default Rule.** Permukaan datar saat diam. Kedalaman dibangun dari border 1px + lapisan hitam; shadow muncul hanya saat elemen melayang DI ATAS konten lain (dropdown/popover), bukan sebagai dekorasi kartu.

## Shapes

Bahasa bentuk: kotak bersudut kecil, konsisten. Radius 8px (`rounded-lg`) untuk kartu dan dropzone; 6px (rounded-md) untuk tombol, input, item nav, pill kecil; 12px (`rounded-xl`) hanya untuk kartu navigasi beranda yang besar; lingkaran penuh untuk avatar, angka langkah, dan pill status. Border selalu 1px solid; satu-satunya border putus-putus adalah dropzone unggah (1px dashed) — dashed berarti "boleh diisi file". Tidak ada lengkung organik, tidak ada blob, tidak ada clip-path.

## Components

Karakter komponen: tenang tapi responsif — diam-diam rapi, menyala tegas saat disentuh, transisi 150–200ms tanpa teater.

### Buttons
- **Shape:** rounded-md (6px), tinggi 32px (h-8), padding horizontal 14px, teks 13–14px medium.
- **Primary:** latar #ffffff, teks #000000, border #ffffff; hover → #ededed; disabled opacity 50%.
- **Secondary:** latar #0a0a0a, border #262626, teks #ededed; hover → border putih + latar #1a1a1a.
- **Ghost:** transparan, teks #888; hover → teks putih + latar #1a1a1a.
- **Focus:** ring 2px putih transparan (focus-visible), tanpa shadow.

### Dropzones (unggah file)
- **Shape:** rounded-lg, border 1px **dashed** #262626, padding 40px vertikal, teks tengah.
- **Hover/Active:** border jadi **solid** putih, latar #111 — dashed→solid adalah sinyal "siap menerima".
- **Error:** border merah gelap + latar semu merah.

### Cards / Containers
- **Corner Style:** 8px (rounded-lg).
- **Background:** #0a0a0a di atas kanvas #000.
- **Border:** 1px #1f1f1f (hairline); header kartu dipisah border-b, bukan latar berbeda.
- **Shadow Strategy:** tidak ada (lihat Elevation).
- **Internal Padding:** 16px (p-4); header kartu px-4 py-3.5.

### Chips / Badge
- **Style:** pill `rounded-full`, border #232323, latar #111, teks 10px #888; dipakai untuk "Soon", "Opsional", tag mode.

### Status Message
- **Style:** baris flex dengan border 1px + latar tint gelap: sukses `#1a3a1a/#0a1a0a` teks #4ade80; gagal `#3a1a1a/#1a0a0a` teks #f87171; netral border #262626 latar #111. Titik 6px atau spinner berputar di depan; tombol bantuan "?" bulat 28px muncul popover gelap.

### Navigation
- **Sidebar:** item 13px medium #888; hover latar #111 teks putih; aktif latar **putih** teks hitam (inversi penuh, bukan warna). Label seksi "MENU" mono 11px #666 tracking lebar. Collapse ke 56px menyembunyikan teks, ikon tetap.
- **Aktif di header:** judul 13–14px semibold + pill mono uppercase id halaman.

### Signature Component: The HOPE Glow
Tagline "Help Out Purest Entity" di footer diberi animasi `hope-glow` 3 detik (text-shadow berdenyut 0.1→0.4 alpha putih) — satu-satunya tempat teks menyala. Ini ekspresi makna merek ("secercah harapan untuk tetap bertahan hidup"): jangan dipindah, jangan ditiru di elemen lain.

## Do's and Don'ts

### Do:
- **Do** pakai lapisan hitam (#000 → #0a0a0a → #111 → #1a1a1a) untuk kedalaman; struktur dari border 1px #1f1f1f/#262626.
- **Do** buat kontrol responsif-tenang: hover mengubah border/fill ke putih atau #1a1a1a dengan transisi 150–200ms `ease`.
- **Do** pakai mono uppercase tracking-0.08em hanya untuk label/data teknis (breadcrumb, tanggal, metrik, ukuran file).
- **Do** pertahankan teks 13–14px sebagai ukuran kerja default; 22px hanya untuk angka statistik.
- **Do** beri umpan balik status dengan titik kecil + border/latar tint (hijau/merah/amber) di area konten, bukan di chrome.

### Don't:
- **Don't** menambah warna aksen baru atau gradien dekoratif — putih adalah satu-satunya aksen; warna hanya untuk status.
- **Don't** memakai box-shadow untuk kartu atau tombol; shadow hanya untuk overlay (dropdown/popover) `0 8px 24px rgba(0,0,0,0.5+)`.
- **Don't** memakai glassmorphism/backdrop-blur di dalam dashboard; itu milik halaman login lama yang **wajib disatukan** ke dunia gelap Vercel pada pekerjaan berikutnya (drift diakui: login masih gradien indigo — perlakukan sebagai hutang, jangan tiru).
- **Don't** membangkitkan CSS legacy tema terang di `globals.css` (.file-card, .btn-primary indigo, .sidebar slate) — sudah mati; jangan dihidupkan kembali.
- **Don't** memakai rounded > 12px di kontrol; 8px adalah batas wajar kartu, 12px hanya untuk tile navigasi beranda.
