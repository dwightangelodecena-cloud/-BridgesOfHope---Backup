import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/pages/family/reports.jsx');
let text = fs.readFileSync(filePath, 'utf8');
const start = text.indexOf('        {/* Mobile Top Bar */}');
const end = text.indexOf('        {/* ── SCROLL CONTENT ── */}');
if (start === -1 || end === -1) throw new Error('markers missing');
text = text.slice(0, start) + text.slice(end);
fs.writeFileSync(filePath, text);
console.log('trimmed reports duplicate mobile header');
