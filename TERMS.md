# MeInsert — Kebijakan Penggunaan

**Indonesia** · [English](TERMS-en.md) · [Privasi](PRIVACY.md) · [README](README.md)

Terakhir diperbarui: **15 November 2026**.

## 1. Ruang lingkup

MeInsert adalah editor metadata lokal untuk gambar, audio, video, dan PDF.
Kebijakan ini menjelaskan penggunaan yang diperbolehkan, larangan penyalahgunaan,
serta batas kemampuan aplikasi. Kebijakan ini bukan nasihat hukum.

Hak menggunakan, menyalin, memodifikasi, dan mendistribusikan kode diatur oleh
[AGPL-3.0-or-later](LICENSE) dan lisensi komponen masing-masing. Dokumen ini
tidak menambahkan pembatasan lisensi perangkat lunak, mengurangi hak yang
diberikan lisensi, atau mengubah ketentuan hukumnya. Larangan penyalahgunaan
di bawah menyatakan kebijakan proyek dan kewajiban hukum pengguna.

## 2. Penggunaan yang diperbolehkan

Gunakan MeInsert hanya pada berkas yang Anda miliki atau berhak edit, misalnya
untuk memperbaiki judul, mengorganisasi koleksi, menambahkan atribusi yang benar,
atau menghapus informasi pribadi dari salinan yang boleh Anda ubah.

Pengeditan metadata untuk koreksi atau perlindungan privasi yang sah bukan
dengan sendirinya pemalsuan. Pastikan perubahan tidak menyesatkan pihak lain,
melanggar hak orang lain, atau mengganggu kewajiban penyimpanan bukti.

## 3. Larangan pemalsuan dan penyalahgunaan

**Pemalsuan untuk menipu, menyamar, atau melakukan tindakan melawan hukum dilarang.**
Anda dilarang menggunakan MeInsert untuk:

- Memalsukan identitas pembuat, pemilik, sumber, tanggal, lokasi, tanda tangan,
  atau riwayat berkas untuk mengelabui pihak lain.
- Memalsukan dokumen, bukti, kredensial, atribusi hak cipta, atau keterangan
  keaslian; menyajikan hasil edit sebagai berkas asli atau bersertifikat secara palsu.
- Menghapus atau mengubah informasi pengelolaan hak cipta tanpa hak, menjiplak,
  menipu, melanggar privasi, atau membantu tindak pidana.
- Merusak atau menyembunyikan barang bukti yang wajib dipertahankan.

**Tindakan pemalsuan atau penyalahgunaan yang terbukti melanggar hukum dapat
dikenai sanksi pidana, perdata, dan/atau administratif sesuai hukum yang berlaku.**
Jenis dan besaran hukuman ditentukan berdasarkan yurisdiksi, fakta perkara,
serta proses dan keputusan pihak berwenang; bukan ditetapkan atau dijatuhkan
secara otomatis oleh MeInsert. Aplikasi bukan alat pemantauan, penyidikan,
pelaporan otomatis, atau penegakan hukum.

## 4. Alur penggunaan dan tanggung jawab

1. Buka aplikasi; browser mengambil berkas aplikasi dan engine yang diperlukan.
2. Pilih berkas lokal. Browser membacanya menggunakan JavaScript, Web Workers,
   dan/atau WebAssembly. **Isi berkas dan metadata yang Anda edit tidak dikirim
   atau diunggah ke server oleh aplikasi MeInsert resmi.**
3. Periksa metadata dan ubah hanya bagian yang berhak Anda ubah.
4. Tinjau rencana perubahan dan peringatan sebelum menyetujui penulisan.
5. Aplikasi membuat hasil lokal, membacanya ulang, dan melaporkan temuan integritas.
6. Unduh salinan hasil atau ZIP/laporan batch. Simpan berkas asli sebagai cadangan
   dan periksa hasil sebelum digunakan atau dibagikan.

Lihat [Kebijakan Privasi](PRIVACY.md) untuk perbedaan antara isi berkas lokal,
preferensi browser, cache aplikasi, dan log akses hosting.

## 5. Batas kemampuan dan risiko

- MeInsert tidak mengesahkan identitas, kepemilikan, keaslian, atau legalitas berkas.
  Metadata yang bisa diedit bukan bukti keaslian dengan sendirinya.
- Menulis ulang metadata dapat menghilangkan tag yang tidak didukung, mengubah
  struktur container, timestamp, atau durasi. Temuan integritas bukan jaminan
  validitas semua konten. Lihat [keterbatasan](README.md#keterbatasan).
- **Mengedit PDF bertanda tangan digital dapat membatalkan validitas tanda
  tangannya.** Mempertahankan byte tanda tangan bukan mempertahankan validitasnya.
  Gunakan salinan, simpan dokumen asli, dan lakukan verifikasi independen.
- Dukungan format, cover, ukuran, memori, dan fitur browser terbatas. FLAC-in-Ogg
  dan Speex tidak didukung; sebagian pemutar tidak menampilkan cover Ogg/Opus.
- Penutupan tab, gangguan browser, atau memori habis dapat menghilangkan pekerjaan
  yang belum diunduh. Aplikasi tidak menyediakan penyimpanan server atau pemulihan akun.

## 6. Jaminan, tanggung jawab, dan perubahan

Perangkat lunak disediakan sebagaimana adanya, dengan penyangkalan jaminan dan
batas tanggung jawab sebagaimana diatur dalam LICENSE, sejauh diizinkan hukum.
Dokumen ini tidak menghapus hak atau tanggung jawab yang tidak boleh dikecualikan
menurut hukum. Anda bertanggung jawab atas kewenangan mengedit, ketepatan perubahan,
cadangan, dan penggunaan hasilnya.

Kebijakan dapat diperbarui; periksa tanggal dan versi dalam repositori. Fork,
ekstensi browser, atau situs yang dimodifikasi dapat memiliki perilaku dan kebijakan
berbeda dari versi resmi.

## 7. Kontak

Proyek: https://github.com/mifada2543/meinsert  
Email: mifada2543@gmail.com

Jangan mengirim berkas sensitif, bukti asli, atau metadata pribadi melalui laporan
masalah/email. Gunakan contoh sintetis dan detail yang sudah disamarkan.
