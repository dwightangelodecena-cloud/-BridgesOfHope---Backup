import fs from 'fs';

const p = new URL('../src/pages/family/home.jsx', import.meta.url);
let text = fs.readFileSync(p, 'utf8');
const startMarker = '        {/* ── Top Nav ── */}';
const endMarker = '        {/* ── Scroll content ── */}';
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker);
if (start === -1 || end === -1) {
  console.error('markers not found', start, end);
  process.exit(1);
}
const replacement = '        <FamilyPageHeader title="Dashboard" subtitle={`${greeting}, ${displayName}`} />\n\n';
text = text.slice(0, start) + replacement + text.slice(end);
fs.writeFileSync(p, text);
console.log('patched home.jsx header');
