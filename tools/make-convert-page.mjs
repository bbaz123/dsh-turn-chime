import fs from 'node:fs';

const [mp3Path, outPath] = process.argv.slice(2);
const mp3 = fs.readFileSync(mp3Path);
const b64 = mp3.toString('base64');

const page = `<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><title>convert-inline</title></head>
<body>
<pre id="log">start</pre>
<script>
var B64 = "${b64}";
var lines = [];
function log(m) { lines.push(m); document.getElementById('log').textContent = lines.join('\\n'); }

function b64ToBytes(b64) {
  var bin = atob(b64);
  var u = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function encodeWav(ab) {
  var numCh = ab.numberOfChannels, sr = ab.sampleRate, len = ab.length;
  var blockAlign = numCh * 2, dataBytes = len * blockAlign;
  var buffer = new ArrayBuffer(44 + dataBytes), view = new DataView(buffer);
  function wstr(o, s) { for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); }
  wstr(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); wstr(36, 'data'); view.setUint32(40, dataBytes, true);
  var chans = [], c, i;
  for (c = 0; c < numCh; c++) chans.push(ab.getChannelData(c));
  var off = 44;
  for (i = 0; i < len; i++) {
    for (c = 0; c < numCh; c++) {
      var s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return buffer;
}

function report() { return fetch('/diag', { method: 'POST', body: lines.join('\\n') }); }

(function () {
  try {
    var bytes = b64ToBytes(B64);
    log('mp3 bytes=' + bytes.length);
    var ac = new OfflineAudioContext(1, 1, 44100);
    ac.decodeAudioData(bytes.buffer.slice(0)).then(function (decoded) {
      log('DECODE_OK ch=' + decoded.numberOfChannels + ' sr=' + decoded.sampleRate + ' dur=' + decoded.duration.toFixed(3));
      var wav = encodeWav(decoded);
      log('WAV bytes=' + wav.byteLength);
      return fetch('/wav', { method: 'POST', body: wav });
    }).then(function (r) {
      log('POST /wav -> ' + (r ? r.status : 'n/a'));
      return report();
    }).catch(function (e) {
      log('FAIL ' + (e && e.name) + ' :: ' + (e && e.message));
      return report();
    });
  } catch (e) {
    log('OUTER ' + e);
    report();
  }
})();
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, page);
console.log(`wrote ${outPath} htmlBytes=${page.length} mp3Bytes=${mp3.length}`);
