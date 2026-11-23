# MeInsert — Kebijakan Privasi

**Indonesia** · [English](PRIVACY-en.md) · [Kebijakan Penggunaan](TERMS.md) · [README](README.md)

Terakhir diperbarui: **23 November 2026**.

## 1. Pernyataan utama: berkas tetap di perangkat

**Isi berkas yang Anda pilih, metadata yang dibaca atau diedit, sampul, dan
hasil pemrosesan tidak pernah dikirim atau diunggah ke server oleh aplikasi
MeInsert resmi. Seluruh pemrosesan tersebut berlangsung secara lokal di browser.**

MeInsert tidak memiliki endpoint upload berkas, akun pengguna, atau penyimpanan
berkas server. Engine pengeditan file tidak menggunakan telemetri untuk membaca
isi berkas maupun perubahan metadata. **Situs resmi menggunakan Cloudflare Web
Analytics untuk statistik kunjungan dan performa situs**, terpisah dari proses
pengeditan lokal (lihat Bagian 3). Kebijakan ini berlaku untuk kode resmi;
tidak menjamin perilaku fork, situs yang dimodifikasi, ekstensi browser, malware,
sistem operasi, atau aplikasi lain.

Pernyataan ini mengenai **berkas dan metadata yang Anda proses**, bukan berarti
browser sama sekali tidak berkomunikasi dengan hosting saat membuka situs.

## 2. Alur pemrosesan data

1. **Memuat aplikasi:** browser meminta HTML, CSS, JavaScript, font, ikon,
   dan engine yang diperlukan dari origin situs. ExifTool WASM serta beberapa
   pustaka diambil saat pertama dibutuhkan, lalu dapat disimpan di cache.
2. **Memilih berkas:** pemilih berkas atau drag-and-drop memberikan akses ke
   berkas yang Anda pilih. Aplikasi tidak memindai seluruh disk Anda.
3. **Membaca:** browser dan Web Workers/WASM membaca byte berkas lokal dan
   menampilkan field, raw tag, sampul, serta pratinjau. Tidak ada upload.
4. **Mengedit dan meninjau:** perubahan disimpan dalam state/memori browser;
   dialog menampilkan rencana dan risiko sebelum penulisan.
5. **Menulis dan memverifikasi:** hasil baru dibuat lokal dan dibaca ulang untuk
   dibandingkan dengan rencana perubahan. Pemrosesan batch mengikuti prinsip sama.
6. **Mengunduh:** browser menyimpan hasil atau ZIP/laporan ke lokasi yang Anda
   pilih. Jika API penyimpanan file digunakan, akses diberikan melalui izin
   browser. Berkas asli tidak ditimpa otomatis oleh MeInsert.

## 3. Jaringan dan log hosting

Untuk menyajikan situs, operator hosting/CDN dapat menerima informasi permintaan
seperti alamat IP, waktu akses, URL aset, user-agent, dan header browser. Kebijakan
logging dan masa simpan ditentukan operator hosting, bukan engine metadata lokal.
Self-hosting juga dapat menghasilkan log Apache atau server Anda sendiri.

**Permintaan aset aplikasi tersebut tidak berisi berkas atau metadata yang
Anda pilih untuk diedit.** Jangan menaruh informasi sensitif pada URL situs.
Mengikuti tautan eksternal, misalnya GitHub, membuka layanan dengan kebijakan
privasinya sendiri. Laporan masalah/email yang Anda kirim secara sukarela keluar
dari perangkat dan tunduk pada layanan penerimanya.


### Analitik website pada situs resmi

Situs resmi `https://meinsert.my.id/` menggunakan **Cloudflare Web Analytics**
untuk memahami jumlah kunjungan, halaman publik yang dibuka, sumber kunjungan,
dan performa situs. Layanan ini dapat memproses URL halaman, informasi referer,
serta informasi teknis browser, perangkat, dan permintaan jaringan sesuai
praktik dan kebijakan penyedianya. Statistik halaman yang dibuka **bukan**
rekaman isi berkas atau riwayat edit metadata; informasi teknis dan log jaringan
tetap dapat diproses oleh penyedia infrastruktur.

**Analitik situs tidak dirancang untuk menerima isi berkas yang dipilih, tag
metadata yang dibaca atau diubah, atau berkas hasil ekspor.** Engine editor
tidak mengirimkan data tersebut ke Cloudflare Web Analytics. Situs resmi tidak
memerlukan akun untuk mengedit file; pengunjung tetap perlu memahami bahwa
kunjungan halaman publik dapat tercatat sebagai trafik. Hindari memasukkan
informasi sensitif pada URL atau parameter kueri.

Cloudflare Web Analytics adalah layanan berbeda dari cache dan pengamanan
jaringan Cloudflare. Detail pemrosesan dan penyimpanan data oleh Cloudflare
tunduk pada [kebijakan privasi Cloudflare](https://www.cloudflare.com/privacypolicy/).
Instalasi pihak lain/self-hosted mungkin tidak menggunakan layanan yang sama.

### Crawling dan pengindeksan mesin pencari

Mesin pencari seperti Google dapat mengakses dan mengindeks **halaman publik**
MeInsert agar situs dapat ditemukan melalui hasil pencarian. Crawling mesin
pencari berbeda dari Cloudflare Web Analytics dan **tidak membutuhkan akses
ke berkas lokal yang Anda proses**. Penggunaan analitik bukan syarat agar
website dapat di-crawl atau diindeks.

## 4. Penyimpanan browser dan salinan lokal

- `localStorage` menyimpan preferensi, termasuk tema dan bahasa
  (`meinsert-theme`, `meinsert-language`); bukan isi berkas metadata.
- `localStorage` juga menyimpan satu cap waktu (timestamp) pada kunci
  `meinsert.policyAck` untuk mengingat bahwa pemberitahuan kebijakan telah
  diakui, berlaku selama 30 hari. Ini **hanyalah cap waktu pengakuan lokal** —
  bukan analitik, bukan pelacakan, tidak diunggah, dan akan terhapus jika Anda
  membersihkan data penyimpanan browser.
- Service worker/Cache Storage menyimpan **aset aplikasi**, font, pustaka,
  dan WASM untuk penggunaan offline; bukan arsip unggahan atau koleksi berkas Anda.
- Berkas, pratinjau/object URL, perubahan, dan output dapat berada di memori
  selama sesi. Aplikasi berupaya melepaskan resource, tetapi tidak menjamin
  penghapusan forensik dari RAM, swap, cache sistem, atau pemulihan sesi browser.
- Unduhan dan laporan JSON/CSV dapat berisi nama berkas dan metadata Anda.
  Berkas tersebut tetap tersimpan sampai Anda sendiri menghapusnya dan dapat
  ikut sinkronisasi cloud/backup perangkat yang diatur di luar MeInsert.

Engine opsional untuk audio, gambar/video, PDF, dan Office diunduh hanya saat
Anda memintanya dari **Pengaturan → Penyimpanan & Offline**. Unduhan ini
disimpan di cache browser perangkat Anda, bersifat lokal, bukan analitik, dan
tidak pernah diunggah ke server. Anda dapat menghapusnya kapan saja dari
Pengaturan. Jika Save-Data aktif, MeInsert memaksa mode hemat dan tidak
mengunduh engine opsional.

Tutup sesi dan hapus data situs melalui pengaturan browser untuk menghapus
preferensi/cache aplikasi. Hapus unduhan/laporan secara terpisah. Tidak ada
salinan berkas server MeInsert yang perlu diminta untuk dihapus.

## 5. Batas privasi dan keamanan

Offline tidak otomatis berarti aman dari semua ancaman. Gunakan sumber resmi,
browser yang diperbarui, serta perangkat dan ekstensi yang Anda percayai.
Jangan menganggap penghapusan satu field menghapus semua informasi pribadi:
data dapat tersimpan pada tag lain, sampul, konten visual/audio, atau laporan.
Periksa hasil dengan alat independen sebelum membagikannya. Aplikasi tidak
menjamin anonimitas, sanitasi menyeluruh, atau validitas tanda tangan digital.

## 6. Larangan pemalsuan dan konsekuensi hukum

**Privasi lokal bukan izin untuk melakukan pemalsuan. Pemalsuan identitas,
atribusi, dokumen, bukti, asal-usul, atau tanggal untuk menipu atau melakukan
pelanggaran hukum dilarang.** Koreksi metadata dan penghapusan informasi pribadi
yang sah tidak otomatis merupakan pemalsuan.

**Pemalsuan atau penyalahgunaan yang terbukti melanggar hukum dapat dikenai
sanksi pidana, perdata, dan/atau administratif sesuai hukum yang berlaku.**
Hukuman ditentukan oleh fakta, yurisdiksi, dan proses/keputusan pihak berwenang,
bukan otomatis oleh MeInsert. Aplikasi tidak mengunggah berkas untuk mendeteksi
pemalsuan dan tidak menyediakan pemantauan atau pelaporan pengguna secara otomatis.
Lihat [Kebijakan Penggunaan](TERMS.md).

## 7. Kontak dan perubahan

Proyek: https://github.com/mifada2543/meinsert  
Email: mifada2543@gmail.com

Jangan melampirkan berkas sensitif atau metadata pribadi ketika melapor.
Kebijakan ini dapat diperbarui sesuai perilaku kode resmi; tanggal revisi
tercantum di atas. Hak atas kode tetap diatur [LICENSE](LICENSE).
