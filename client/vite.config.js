import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:5000';
const DOWN = 'API server işləmir (port 5000). Layihənin ƏSAS qovluğunda "npm run dev" işlədin.';

// Server işləmirsə: konsolda bir dəfə aydın mesaj yaz, brauzerə də 503 + izahat qaytar
const proxy = {
  target: API,
  configure: (p) => {
    let warned = false;
    p.removeAllListeners('error');
    p.on('error', (err, req, res) => {
      if (!warned) { warned = true; console.error('\n❌ ' + DOWN + '\n   (client qovluğunda yox, ezze-perfumes qovluğunda; əvvəl "npm run install-all")\n'); }
      if (res && typeof res.writeHead === 'function' && !res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: DOWN }));
      }
    });
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': proxy, '/uploads': proxy } },
});
