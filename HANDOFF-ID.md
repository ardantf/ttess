# Handoff: Kryvora Genesis Fusion + Node Reserve Registry

## Yang sudah jalan

- Web menampilkan Genesis Key milik wallet dari indeks Arbitrum, lalu mengecek tiap Key dengan `ownerOf` di kontrak Genesis Key. Tidak ada inventori demo.
- Holder bisa reserve atau release satu Key lewat tanda tangan wallet. Reserve dicatat di registry server; NFT tidak dipindah atau dibakar. Challenge terikat wallet, token ID, kontrak, chain, aksi, nonce, dan masa berlaku.
- Registry mengecek ulang kepemilikan saat dibaca. Jika Key pindah wallet, reserve pemilik lama dibatalkan. Penyimpanan memakai file JSON lokal dengan penulisan atomik.
- Web menghitung **1 Genesis Key = 1 Node Unit**, baik dalam status free maupun reserved. Lima Key tetap menampilkan lima unit dan pratinjau kuota Node Pool **300.000 KRV** berdasarkan 60.000 KRV per unit.
- Dua Key yang sudah di-reserve bisa dipilih sebagai calon pasangan. Aturan tier dan peluang Fusion yang tampil hanya ilustrasi. Tombol eksekusi dinonaktifkan dan endpoint eksekusi mengembalikan HTTP 410.

## Yang harus dilanjutkan

1. Sepakati sumber tier resmi. Metadata NFT saat ini menulis tier `Genesis`; Standard/Overclocked/Quantum/Celestial pada web masih kelas sementara dari hash aplikasi.
2. Rancang, audit, dan deploy Fusion Vault. Bila dua Key masuk ke satu Core, Core harus menyimpan lineage dua token ID asal dan hak dua Node Unit. Tentukan secara eksplisit perilaku sukses/gagal dan mekanisme keluar sebelum mengaktifkan tombol Fusion.
3. Integrasikan portal task: `effectiveNodeUnits = original Keys yang bebas + token ID asal unik di dalam Fusion Cores`. Hitung tiap token ID sekali saja. Jangan langsung memakai `balanceOf` sebagai total sesudah Fusion aktif. Kuota 60.000 KRV per unit di web masih pratinjau, belum klaim atau payout.
4. Ganti file JSON dengan database bersama jika dijalankan dalam lebih dari satu instance. Batasi CORS ke origin web resmi, tambah pembatasan request dan pemantauan RPC/indexer, lalu lakukan review keamanan sebelum rilis publik.
5. Uji end-to-end dengan holder multi-Key dan alur transfer NFT. Untuk contoh lima Key, reserve dan Fusion di masa depan tidak boleh mengurangi lima unit atau pratinjau kuota 300.000 KRV.

## Menjalankan lokal

Gunakan Node 20/22 LTS. Jalankan `npm ci --legacy-peer-deps --registry=https://registry.npmjs.org/ --ignore-scripts --no-audit --no-fund`. Salin `.env.example` ke `.env` dan pilih lokasi `NODE_REGISTRY_FILE` yang bisa ditulis. Untuk pengembangan, jalankan `npm run serve` dan `npm run dev` di terminal terpisah. Untuk mode build, jalankan `npm start`. Pemeriksaan: `npm test`, `npm run lint`, `npm run build`.

Lihat `README.md` untuk API, asumsi, dan alur uji lebih rinci. File registry di `data/`, `.env` pribadi, `node_modules/`, dan output build `dist/` tidak termasuk paket handoff.
