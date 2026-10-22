import http from 'node:http';
import fs from 'node:fs';

const [mp3Path, outPath, portArg] = process.argv.slice(2);
const PORT = Number(portArg || 8791);
const WAV_PROBE = 'C:\\Windows\\Media\\notify.wav';

const html = fs.readFileSync(new URL('./diag.html', import.meta.url));

function serveFile(res, file, type) {
  try {
    const buf = fs.readFileSync(file);
    res.writeHead(200, { 'content-type': type, 'content-length': buf.length });
    res.end(buf);
  } catch (e) {
    res.writeHead(500); res.end('read fail: ' + e.message);
  }
}

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  console.log(`REQ ${req.method} ${req.url} range=${req.headers.range || '-'} origin=${req.headers.origin || '-'} ua=${(req.headers['user-agent'] || '').slice(0, 40)}`);
  if (req.method === 'GET' && (url === '/' || url.startsWith('/diag.html'))) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  if (req.method === 'GET' && url.startsWith('/sound.mp3')) return serveFile(res, mp3Path, 'audio/mpeg');
  if (req.method === 'GET' && url.startsWith('/test.wav')) return serveFile(res, WAV_PROBE, 'audio/wav');

  if (req.method === 'POST' && url === '/wav') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(outPath, buf);
      console.log(`OK_WAV ${outPath} bytes=${buf.length}`);
      res.writeHead(200); res.end('ok');
      setTimeout(() => process.exit(0), 250);
    });
    return;
  }
  if (req.method === 'POST' && url === '/diag') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      console.log('--- DIAG ---\n' + Buffer.concat(chunks).toString('utf8') + '\n--- END ---');
      res.writeHead(200); res.end('ok');
      setTimeout(() => process.exit(0), 250);
    });
    return;
  }
  if (req.method === 'POST' && url === '/error') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      console.log('PAGE_ERROR ' + Buffer.concat(chunks).toString('utf8'));
      res.writeHead(200); res.end('ok');
      setTimeout(() => process.exit(3), 250);
    });
    return;
  }
  res.writeHead(404); res.end('nope');
});

server.listen(PORT, '127.0.0.1', () => console.log('LISTEN ' + PORT));
setTimeout(() => { console.log('SERVER_TIMEOUT'); process.exit(2); }, 180000);
