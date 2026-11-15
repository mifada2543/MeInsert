# Fixture pengujian

Folder ini disiapkan untuk berkas uji nyata (gambar, audio, video, PDF)
yang dipakai `tests/e2e/smoke.mjs` dan pengujian round-trip metadata.

Aturan:
- Hanya berkas kecil (< 1 MB) dan bebas metadata pribadi.
- Jangan menaruh file hak cipta milik orang lain tanpa izin.
- Nama berkas memakai format yang explains: `contoh-heic.jpg`, `contoh-flac.flac`.
- Berkas yang dipakai test integritas (signature PDF digital, cover Ogg,
  FLAC-in-Ogg/Speex) sebaiknya dibuat khusus untuk MeInsert supaya aman
  dibagikan sebagai fixture.
