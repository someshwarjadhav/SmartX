// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// // Dev proxy: the browser talks to localhost (/api, /stipl) and Vite forwards to the portal,
// // so the portal's CORS rules never block sign-in or data calls. Values come from .env.development.
// const portalProxy = {
//   '/api': {
//     target: 'https://smartx.shivinfotech.co.in',
//     changeOrigin: true,
//     secure: false,
//     rewrite: (path: string) => path.replace(/^\/api/, ''),
//   },
//   '/ekoapi': {
//     target: 'http://apix.shivinfotech.co.in',
//     changeOrigin: true,
//     secure: false,
//     rewrite: (path: string) => path.replace(/^\/ekoapi/, ''),
//   },
//   '/stipl': {
//     target: 'https://stipldrive.ddns.net',
//     changeOrigin: true,
//     secure: false,
//     rewrite: (path: string) => path.replace(/^\/stipl/, ''),
//   },
// };

// export default defineConfig({
//   plugins: [react()],
//   server: { proxy: portalProxy },
//   preview: { proxy: portalProxy },
//   build: {
//     chunkSizeWarningLimit: 700,
//     rollupOptions: {
//       output: {
//         manualChunks: {
//           vendor: ['react', 'react-dom', 'react-router-dom'],
//           charts: ['recharts'],
//           motion: ['framer-motion'],
//         },
//       },
//     },
//   },
// });


import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Production React website location
  base: '/prodigy/',

  server: {
    proxy: {
      '/api': {
        target: 'https://smartx.shivinfotech.co.in',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ekoapi': {
        target: 'https://smartx.shivinfotech.co.in',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ekoapi/, ''),
      },
      '/stipl': {
        target: 'https://stipldrive.ddns.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/stipl/, ''),
      },
    },
  },

  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});