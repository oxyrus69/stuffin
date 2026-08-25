
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX=require('xlsx');
const dir='C:/design Project/stuffing/references/raw jit/';
const seen=new Set(); const pats={};
for(const f of ['0726.XLS','0826.XLS','0926.XLS']){
  const wb=XLSX.readFile(dir+f);
  const aoa=XLSX.utils.sheet_to_json(wb.Sheets.Sheet1,{header:1,defval:null});
  for(let i=1;i<aoa.length;i++){
    const ord=String((aoa[i]||[])[0]??'').trim();
    if(!ord||seen.has(ord))continue;
    seen.add(ord);
    const m=ord.match(/^U(\d{2})([A-Za-z]{0,3})/);
    if(m){const k='U'+m[1]+'+'+m[2];pats[k]=(pats[k]||0)+1;}
  }
}
console.log(JSON.stringify(pats,null,0));
