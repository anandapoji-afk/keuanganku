/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  experimental: {
    // Default Next.js utk Server Action cuma 1MB — terlalu kecil utk upload
    // bukti transaksi (apalagi dikirim sbg base64, yg menambah ukuran ~33%).
    // Dinaikkan jauh di atas limit praktis foto kamera HP (biasanya 3-8MB)
    // supaya tidak lagi jadi pembatas. Next.js tidak punya opsi "tanpa batas"
    // literal, tapi di luar angka ini kemungkinan akan kena batas lain dulu
    // (lihat catatan Vercel & Supabase di bawah).
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

module.exports = nextConfig;
