# MeInsert — Pemberitahuan

Hak Cipta (C) 2026 mifada2543

MeInsert adalah editor metadata 100% di sisi klien untuk gambar, PDF, audio, dan
video. Seluruh pemrosesan berjalan di browser Anda (WebAssembly + Web Workers).
File tidak pernah diunggah, tidak ada backend, dan tidak perlu akun. Aplikasi
tetap bisa dipakai offline setelah kunjungan pertama, karena service worker
menyimpan app shell di cache.

Kecuali dinyatakan lain pada file atau komponennya, kode sumber pada repositori
ini dilisensikan di bawah MeInsert Source-Available License versi 1.0.
Salinan lisensi tersedia pada file LICENSE. Lisensi ini bukan lisensi *open
source*; ringkasan kewajibannya ada di bawah.

File NOTICE ini hanya bersifat informatif. File ini tidak mengubah, mengganti,
atau menambahkan ketentuan pada lisensi yang berlaku. Saat mendistribusikan ulang
MeInsert, pertahankan file ini, file LICENSE, serta seluruh pemberitahuan hak cipta
dan lisensi lain yang disertakan pada karya terkait.

## Perangkat lunak dan teknologi pihak ketiga

MeInsert membundel perangkat lunak independen berikut di `assets/vendor/` dan
`assets/fonts/`:
- ExifTool 13.60 — oleh Phil Harvey — https://exiftool.org/
  (Perl Artistic License atau GPL; berjalan di dalam build WebAssembly)
- @colorhythm/exiftool-wasm v1.0.5 — https://github.com/6over3/exiftool (Apache-2.0)
- zeroperl — https://github.com/6over3/zeroperl (MIT — runtime Perl-di-WebAssembly)
- Mediabunny v1.65.0 — https://github.com/Vanilagy/mediabunny (MPL-2.0)
- pdf-lib v1.17.1 — https://github.com/Hopding/pdf-lib (MIT)
- fflate v0.8.3 — https://github.com/101arrowz/fflate (MIT)
- browser-id3-writer v6.4.0 — https://github.com/egoroof/browser-id3-writer (MIT)
- Font IBM Plex (Sans, Sans Condensed, Mono) — https://github.com/IBM/plex
  (SIL Open Font License 1.1)
- MEeL — editor LRC & helper teks berirama (kode yang diadaptasi) — © 2026 Mifada
  (mifada2543) — https://github.com/mifada2543/MEeL-HUB (rilis asli: AGPL-3.0-or-later;
  adaptasi di MeInsert: MeInsert Source-Available License v1.0)
  Sumber yang dipakai (repo MEeL, commit `95e4937c74c3929977a907a463a415dcea50d2da`):
  - `assets/js/music/lrc-editor.js` — parser LRC, tap-to-timestamp, kontrol player
  - `assets/css/music/lrc-editor.css` — gaya editor dan karaoke
  - `assets/js/music/watch/karaoke.js` — sinkronisasi baris aktif dan klik-untuk-seek
  - `modules/core/helpers/lyrics.php` — aturan parse/generate LRC
  - `modules/core/helpers/subtitle.php` — konversi SRT ke WebVTT
  File hasil adaptasi di MeInsert:
  - `assets/js/core/timed-text.js` — parser/serializer murni (dari lyrics.php + subtitle.php + lrc-editor.js)
  - `assets/js/ui/timed-text-editor.js` — dialog editor (dari lrc-editor.js + karaoke.js)
  - `assets/css/components/timed-text-editor.css` — gaya editor (dari lrc-editor.css)
  - `assets/vendor/licenses/meel-LICENSE` — teks lisensi AGPL-3.0 dari MEeL-HUB
    asli (provenance; bukan lisensi adaptasi di MeInsert)
  Rincian modifikasi dan indeks atribusi: `assets/THIRD_PARTY_LICENSES.md`.

**`assets/THIRD_PARTY_LICENSES.md` adalah indeks atribusi otoritatif** untuk
bundel ini, dan `assets/vendor/licenses/` memuat teks lisensi aslinya. Jika
sebutan di sana berbeda dengan berkas di `assets/vendor/licenses/`, berkas lisensi
yang berlaku untuk komponen tersebut.

pdf-lib juga membawa dependensi transitif berikut: `pako` (MIT AND Zlib),
`@pdf-lib/standard-fonts` (MIT), `@pdf-lib/upng` (MIT), dan `tslib` (0BSD) —
lihat `assets/vendor/licenses/pdf-lib-dependencies-LICENSES.md`.

Karya merek di `assets/img/` adalah karya asli yang dibuat khusus untuk proyek
ini; lihat `assets/img/PROVENANCE.md`.

Proyek-proyek tersebut merupakan karya terpisah dan diatur oleh lisensi serta
pemberitahuan masing-masing. Nama dan merek dagangnya adalah milik pemilik
masing-masing. Kehadiran suatu teknologi pada daftar ini tidak otomatis berarti
salinan teknologi tersebut selalu didistribusikan pada setiap instalasi MeInsert.

Jika Anda mendistribusikan paket yang mencakup file pihak ketiga, aset bundel,
komponen yang dimodifikasi, media hasil generasi, font, ikon, atau karya lain
yang bukan dibuat oleh penulis proyek, Anda bertanggung jawab menyertakan teks
lisensi dan pemberitahuan atribusi yang diwajibkan oleh karya tersebut. Tinjau
file lisensi dan file pemberitahuan yang disertakan setiap dependensi sebelum
redistribusi.

## Lisensi, batas penggunaan, dan monetisasi

MeInsert Source-Available License v1.0 mengatur penggunaan sebagai berikut.

- **Versi Asli** — salinan rilis resmi yang kode, aset, dan perilakunya tidak
  diubah. Boleh dipakai dan di-host sendiri untuk Penggunaan Internal, termasuk
  kegiatan komersial, tanpa batas jumlah pengguna.
- **Versi Modifikasi** — salinan dengan perubahan pada kode, aset, tampilan,
  fitur, atau perilaku. Penggunaan internal dibatasi maksimal tiga orang;
  pengguna keempat mensyaratkan lisensi berbayar dari Pemegang Hak.
  Penghitungan mencakup semua tim, akun, perangkat, dan instance organisasi
  yang sama; orang yang sama dihitung sekali.
- **Hosting Publik** — menyediakan Versi Asli atau Modifikasi kepada pihak luar
  boleh tanpa batas pengguna jika aksesnya gratis, tanpa iklan, dan Bagian 5
  serta 6 dipatuhi. Akses yang dibatasi pada undangan atau akun tertentu tetap
  dihitung sebagai Hosting Publik.
- **Monetisasi** — izin tertulis terpisah dari Pemegang Hak wajib diperoleh
  sebelum memonetisasi hosting, akses, atau distribusi, termasuk iklan,
  paywall, penjualan salinan, atau penyertaan dalam paket berbayar. Permohonan
  izin dapat dikirim ke mifada2543@gmail.com. Kontribusi sukarela tidak
  memberikan izin monetisasi. Bayaran atas pekerjaan atau jasa yang dilakukan
  dengan MeInsert, seperti fotografi dan penyuntingan metadata, tetap
  diperbolehkan.
- **Atribusi** — saat mendistribusikan atau melakukan Hosting Publik,
  pertahankan LICENSE, NOTICE, pemberitahuan hak cipta, serta teks lisensi
  komponen. Tandai salinan yang dimodifikasi dan berikan akses wajar bagi
  pengguna untuk membaca LICENSE dan NOTICE, misalnya lewat halaman atribusi.
- **Komponen dan rilis terdahulu** — komponen pihak ketiga tetap memakai
  lisensinya masing-masing. Rilis asli MEeL-HUB tetap AGPL-3.0-or-later;
  kode adaptasinya di MeInsert memakai MeInsert Source-Available License v1.0.
  Lisensi ini tidak mencabut hak atas salinan yang sebelumnya dirilis di bawah
  GNU AGPLv3 atau lisensi lain.

Ringkasnya: Versi Asli bebas untuk penggunaan internal, Versi Modifikasi
dibatasi tiga pengguna internal, dan monetisasi memerlukan izin tertulis.
Teks `LICENSE` yang mengikat; bagian ini hanya penjelasan sederhana.

## Konten pengguna dan layanan eksternal

MeInsert membaca dan menulis tag metadata (EXIF, XMP, IPTC, ID3, Vorbis Comment,
Matroska, Info Dictionary PDF) pada berkas yang tetap berada di perangkat Anda.
Alat ini dapat memproses atau menampilkan media Anda, tetapi penulis proyek tidak
memberikan izin untuk mendistribusikan ulang musik, video, buku, karya seni,
merek dagang, atau konten pihak ketiga lainnya hanya karena MeInsert dapat
memproses atau menampilkannya.

Anda bertanggung jawab atas berkas yang Anda edit: jangan menghapus atau memalsukan
hak atribusi pemilik karya, dan patuhi hukum, hak cipta, ketentuan layanan, serta
kewajiban privasi yang berlaku. Mengubah tanda tangan digital, tanda tangan konten,
atau tag pengelolaan hak cipta bisa ilegal di yurisdiksi Anda. Mengedit dokumen
bertanda tangan dapat membatalkan tanda tangannya. Jangan mengandalkan editor
metadata untuk mempertahankan validitas tanda tangan kriptografis; simpan berkas
asli dan verifikasi tanda tangannya secara independen.

MeInsert tidak melakukan analitik, telemetri, maupun profil pengguna. Aplikasi
tidak meminta sumber daya jaringan apa pun selain berkas yang disajikan dari
origin miliknya sendiri (app shell, font, pustaka, dan modul WebAssembly ExifTool
opsional).

## Merek dagang

MeInsert serta nama dan logo MeInsert digunakan untuk mengidentifikasi proyek ini.
Nama dan logo tersebut tidak boleh digunakan untuk menyiratkan dukungan terhadap
versi yang dimodifikasi atau didistribusikan ulang tanpa izin. ExifTool,
Mediabunny, pdf-lib, fflate, browser-id3-writer, IBM Plex, dan zeroperl adalah
merek dagang pemiliknya masing-masing; penyebutan di sini hanya untuk
identifikasi asal kode yang dibundel, bukan dukungan atau sponsor.

## Kontak

- Proyek: https://github.com/mifada2543/meinsert
- Live: https://meinsert.my.id/
- Penulis: mifada2543
- Email: mifada2543@gmail.com
