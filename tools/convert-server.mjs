import http from 'node:http';
import fs from 'node:fs';

const [mp3Path, outPath, portArg] = process.argv.slice(2);
const PORT = Number(portArg || 8791);

const html = fs.readFileSync(new URL('./convert.html', import.meta.url));

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/convert'))) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/sound.mp3')) {
    const buf = fs.readFileSync(mp3Path);
    res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': buf.length });
    res.end(buf);
    return;
  }
  if (req.method === 'POST' && req.url === '/wav') {
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
  if (req.method === 'POST' && req.url === '/error') {
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
setTimeout(() => { console.log('SERVER_TIMEOUT'); process.exit(2); }, 240000);
