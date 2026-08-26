
import fs from 'fs';
const { fillAkumulasi, parseDailyFile, parseWorkbookAny, detectKind } = await import('file:///C:/design%20Project/stuffing/lib/akumulasiClient.js');
const dir='C:/design Project/stuffing/references/akumulasi/';
const read = async (p) => new Uint8Array(fs.readFileSync(p));
(async () => {
  const sttBytes = await read(dir+'STT 24.XLS');
  const assBytes = await read(dir+'ASS 24.XLS');
  let sewParsed = parseDailyFile(parseWorkbookAny(sttBytes));
  let assParsed = parseDailyFile(parseWorkbookAny(assBytes));
  console.log('stt lines:', sewParsed.lines.size, '| ass lines:', assParsed.lines.size);
  const k1=detectKind(sewParsed), k2=detectKind(assParsed);
  console.log('k1:',k1,'k2:',k2);
})();
