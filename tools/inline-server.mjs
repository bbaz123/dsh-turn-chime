import http from 'node:http';
import fs from 'node:fs';

const [pagePath, outPath, portArg] = process.argv.slice(2);
const PORT = Number(portArg || 8795);

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  console.log(`REQ ${req.method} ${req.url}`);

  if (req.method === 'GET' && url === '/') {
    const html = fs.readFileSync(pagePath);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': html.length });
    res.end(html);
    return;
  }

  const body = [];
  req.on('data', (c) => body.push(c));
  req.on('end', () => {
    if (req.method === 'POST' && url === '/wav') {
      const buf = Buffer.concat(body);
      fs.writeFileSync(outPath, buf);
      console.log(`OK_WAV ${outPath} bytes=${buf.length}`);
      res.writeHead(200, { 'access-control-allow-origin': '*' });
      res.end('ok');
      setTimeout(() => process.exit(0), 300);
      return;
    }
    if (req.method === 'POST' && url === '/diag') {
      console.log('--- DIAG ---\n' + Buffer.concat(body).toString('utf8') + '\n--- END ---');
      res.writeHead(200, { 'access-control-allow-origin': '*' });
      res.end('ok');
      setTimeout(() => process.exit(0), 300);
      return;
    }
    res.writeHead(404); res.end('nope');
  });
});

server.listen(PORT, '127.0.0.1', () => console.log('LISTEN ' + PORT));
setTimeout(() => { console.log('SERVER_TIMEOUT'); process.exit(2); }, 180000);
