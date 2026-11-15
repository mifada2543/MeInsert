MeInsert — PEMBERITAHUAN
=======================

Hak Cipta (C) 2026 mifada2543

MeInsert adalah editor metadata 100% di sisi klien untuk gambar, PDF, audio, dan
video. Seluruh pemrosesan berjalan di browser Anda (WebAssembly + Web Workers).
File tidak pernah diunggah, tidak ada backend, dan tidak perlu akun. Aplikasi
tetap bisa dipakai offline setelah kunjungan pertama, karena service worker
menyimpan app shell di cache.

Kecuali dinyatakan lain pada file atau komponennya, kode sumber pada repositori
ini dilisensikan di bawah GNU Affero General Public License versi 3 atau
yang lebih baru (AGPL-3.0-or-later).
Salinan lisensi tersedia pada file LICENSE.

File NOTICE ini hanya bersifat informatif. File ini tidak mengubah, mengganti,
atau menambahkan ketentuan pada lisensi yang berlaku. Saat mendistribusikan ulang
MeInsert, pertahankan file ini, file LICENSE, serta seluruh pemberitahuan hak cipta
dan lisensi lain yang disertakan pada karya terkait.

PERANGKAT LUNAK DAN TEKNOLOGI PIHAK KETIGA
------------------------------------------

MeInsert membundel perangkat lunak independen berikut di `assets/vendor/` dan
`assets/fonts/`:

* ExifTool 13.60 — oleh Phil Harvey — https://exiftool.org/
  (Perl Artistic License atau GPL; berjalan di dalam build WebAssembly)
* @colorhythm/exiftool-wasm v1.0.5 — https://github.com/6over3/exiftool (Apache-2.0)
* zeroperl — https://github.com/6over3/zeroperl (MIT — runtime Perl-di-WebAssembly)
* Mediabunny v1.65.0 — https://github.com/Vanilagy/mediabunny (MPL-2.0)
* pdf-lib v1.17.1 — https://github.com/Hopding/pdf-lib (MIT)
* fflate v0.8.3 — https://github.com/101arrowz/fflate (MIT)
* browser-id3-writer v6.4.0 — https://github.com/egoroof/browser-id3-writer (MIT)
* Font IBM Plex (Sans, Sans Condensed, Mono) — https://github.com/IBM/plex
  (SIL Open Font License 1.1)

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

AGPLv3, COPYLEFT JARINGAN, DAN MONETISASI
------------------------------------------

MeInsert boleh dimonetisasi (produk berbayar, hosting berbayar, layanan premium).
AGPLv3 bersifat copyleft jaringan, sehingga kewajiban yang berlaku adalah:

* Anda boleh mengenakan biaya atas distribusi, dukungan, atau layanan.
* Saat mendistribusikan perangkat lunak yang tercakup, sediakan Corresponding
  Source sesuai ketentuan AGPLv3 yang berlaku.
* Jika Anda memodifikasi Program dan versi Anda mendukung interaksi jaringan
  jarak jauh, pasal 13 AGPLv3 mewajibkan penawaran yang jelas kepada semua
  pengguna yang berinteraksi dengannya dari jarak jauh untuk memperoleh
  Corresponding Source versi tersebut secara gratis melalui cara yang lazim.
* Modifikasi privat saja tidak mewajibkan publikasi ke umum. Kewajiban tersebut
  berlaku pada karya yang tercakup, bukan otomatis pada perangkat lunak
  independen yang digunakan bersamanya.
* Komponen pihak ketiga di atas tetap tunduk pada lisensinya masing-masing;
  AGPLv3 tidak mengubahnya.

Ringkasnya: monetisasi boleh; kewajiban berbagi sumber yang berlaku tetap harus
dipenuhi. Teks `LICENSE` yang
mengikat; paragraf ini hanya penjelasan bahasa sederhana.

KONTEN PENGGUNA DAN LAYANAN EKSTERNAL
-------------------------------------

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

MEREK DAGANG
------------

MeInsert serta nama dan logo MeInsert digunakan untuk mengidentifikasi proyek ini.
Nama dan logo tersebut tidak boleh digunakan untuk menyiratkan dukungan terhadap
versi yang dimodifikasi atau didistribusikan ulang tanpa izin. ExifTool,
Mediabunny, pdf-lib, fflate, browser-id3-writer, IBM Plex, dan zeroperl adalah
merek dagang pemiliknya masing-masing; penyebutan di sini hanya untuk
identifikasi asal kode yang dibundel, bukan dukungan atau sponsor.

KONTAK
------

Proyek: https://github.com/mifada2543/meinsert
Live:   https://mifada2543.github.io/MeInsert/
Penulis: mifada2543
Email:   mifada2543@gmail.com
