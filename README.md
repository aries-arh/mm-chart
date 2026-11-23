# 📊 EasyMMC — Aplikasi Man-Machine Chart

**EasyMMC** adalah aplikasi visualisasi kerja berbasis web untuk memetakan hubungan waktu kerja antara **Operator (Man)** dan **Mesin (Machine)**. Aplikasi ini menggabungkan antarmuka sederhana untuk pengguna lapangan yang awam istilah teknik dengan fitur analisis lanjutan untuk kebutuhan **Teknik Industri** (*Mode Hybrid*).

---

## ✨ Fitur Utama Saat Ini

### 1. Kode Warna & 4 Kategori Aktivitas
* 🟩 **Kerja Mandiri (Hijau):** Operator bekerja di luar mesin (mengambil bahan, inspeksi kualitas, merapikan hasil).
* 🟦 **Kerja di Mesin (Biru):** Operator berinteraksi langsung dengan mesin (memasang part ke jig, menekan tombol *Start*, melepas hasil).
* 🟨 **Mesin Jalan Otomatis (Oranye):** Mesin memproses barang secara otomatis tanpa dipegang operator.
* ⬜ **Menunggu / Menganggur (Abu-abu):** Waktu kosong (*idle time*) ketika operator menunggu mesin atau mesin menunggu operator.

### 2. Mode Input Hybrid (Sederhana & Lanjutan)
* **Mode Sederhana (Default):**
  * **Template Siap Pakai:** `1 Operator · 1 Mesin`, `1 Operator · 2 Mesin`, `2 Operator · 2 Mesin`, atau `Mulai Kosong`.
  * **Tambah Cepat:** Pilih pelaku kerja, jenis aktivitas, aturan waktu mulai (*setelah pelaku ini*, *setelah semua*, *detik ke-0*, atau *manual*), serta tombol durasi cepat `-5 / -1 / +1 / +5`.
  * **Daftar Langkah Interaktif:** Kartu langkah kerja dapat digeser (*drag-and-drop*) untuk menukar urutan dan disesuaikan durasinya langsung.
* **Mode Lanjutan (Teknik Industri):**
  * Mendukung hingga **20 Operator** dan **20 Mesin**.
  * **Multi-Cycle:** Menampilkan dan mengedit hingga **20 siklus** sekaligus dengan pengaturan waktu mulai masing-masing siklus (*overlap*) serta tombol **Salin Siklus Sebelumnya**.
  * **Tabel Input Presisi:** Pengeditan langsung mulai dan durasi tiap langkah kerja dalam format tabel.

### 3. Tiga Format Grafik & Interaksi Langsung
* **Grafik Vertikal (Atas ke Bawah):** Tarik balok ke atas/bawah untuk menggeser waktu mulai, atau tarik tepi bawah balok untuk mengubah durasi.
* **Timeline Horizontal:** Menampilkan jalur kronologis per pelaku kerja untuk satu maupun banyak siklus.
* **Tabel Angka:** Ringkasan waktu kerja aktif, waktu menganggur, dan persentase kesibukan per pelaku kerja serta daftar langkah kerja.
* Mendukung kontrol **Zoom** (`50%`–`300%`) dan pembacaan otomatis 3 KPI utama (**Total Waktu 1 Siklus**, **Kesibukan Operator**, **Kesibukan Mesin**) beserta estimasi kapasitas (`unit/jam`).

### 4. Fitur Analisis, Pengukuran Lapangan & Panduan
* **Kotak Saran Kaizen & Deteksi Otomatis:** Mendeteksi bagian menganggur terpanjang dan jadwal yang bentrok, lengkap dengan saran perbaikan.
* **Simulasi Before vs After:** Menyimpan kondisi awal (*Before*) dan membandingkan selisih efisiensi serta kapasitas dengan kondisi sesudah perbaikan (*After*).
* **Stopwatch Lapangan (Time Study):** Mencatat durasi aktivitas langsung saat mengamati operator/mesin di lini produksi dan mengirimkannya ke grafik dalam sekali klik.
* **Proyek Tersimpan (`LocalStorage`):** Perubahan tersimpan otomatis di browser dan mendukung penyimpanan banyak skenario proses.
* **Panduan Penggunaan Terintegrasi:** Tersedia tab **Panduan** di dalam aplikasi berisi tutorial langkah demi langkah.

### 5. Ekspor & Impor Laporan
* **Export PNG:** Mengunduh gambar sesuai format tampilan grafik yang sedang dipilih (*Grafik Vertikal*, *Timeline Horizontal*, atau *Tabel Angka*).
* **Export PDF:** Membuat dan mengunduh file `.pdf` siap cetak secara langsung sesuai tampilan grafik aktif.
* **Export / Import CSV:** File CSV mencakup ringkasan KPI, matriks visual grafik (`MATRIKS GRAFIK VERTIKAL` atau `MATRIKS TIMELINE HORIZONTAL`), ringkasan pelaku kerja, dan tabel `DATA LANGKAH KERJA` yang kompatibel untuk diimpor kembali.
* **Export Excel (`.xls`):** Laporan Excel bergrafik warna (*rowspan* vertikal atau *colspan* horizontal sesuai format grafik) beserta tabel ringkasan dan daftar langkah kerja.
* **Unduh / Muat JSON (Mode Lanjutan):** Cadangan penuh seluruh siklus dan konfigurasi proyek.

---

## 💻 Cara Menjalankan di Komputer Lokal

Aplikasi ini dikonfigurasi menggunakan **port tetap `4800`** untuk pemakaian lokal (menghindari port `3000`, `3001`, dan `4500`).

### Opsi 1 — Windows (Sekali Klik dengan `.bat`)
1. Pastikan **Node.js** (v18 atau lebih baru) sudah terpasang.
2. Klik ganda file **`start-easymmc.bat`**.
3. Skrip otomatis memeriksa Node.js, menjalankan `npm install` jika belum ada, menyalakan server di port **`4800`**, dan membuka `http://localhost:4800` di browser.

### Opsi 2 — Terminal (Windows / macOS / Linux)
```bash
npm install
npm run local
```
Lalu buka browser ke: `http://localhost:4800`

* Untuk menjalankan dengan port kustom lain:
  ```bash
  node server.js --port=5050
  ```
* Untuk menjalankan dengan port default (`3000` atau `PORT` environment variable):
  ```bash
  npm start
  ```

### Opsi 3 — Tanpa Node.js (Alternatif Statis)
Seluruh logika kalkulasi, grafik, ekspor, dan penyimpanan berjalan di sisi browser:
* Buka file `index.html` langsung di browser, atau jalankan server statis seperti:
  ```bash
  python -m http.server 4800
  ```

---

## 📁 Struktur Berkas Proyek

* `index.html` — Struktur halaman utama, panel input, area grafik, tab Before vs After, Stopwatch, Proyek Tersimpan, dan Panduan.
* `styles.css` — Tata letak, tema warna, gaya komponen grafik vertikal/horizontal, dan tampilan responsif.
* `script.js` — Logika kalkulasi siklus & utilisasi, interaksi drag-and-drop/resize, Kaizen advisor, stopwatch, `LocalStorage`, serta generator ekspor PNG, PDF, CSV, Excel, dan JSON.
* `server.js` — Server statis Express ringan dengan dukungan `--port` dan `process.env.PORT`.
* `package.json` — Konfigurasi dependensi (`express`) dan skrip `dev`, `start`, `local`, `build`, `lint`.
* `start-easymmc.bat` — Skrip peluncur instan untuk Windows pada port tetap `4800`.
