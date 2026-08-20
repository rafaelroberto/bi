/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Gera arquivos HTML/JS estáticos compatíveis com o GitHub Pages
  images: {
    unoptimized: true, // Necessário para exportação estática
  },
};

export default nextConfig;
