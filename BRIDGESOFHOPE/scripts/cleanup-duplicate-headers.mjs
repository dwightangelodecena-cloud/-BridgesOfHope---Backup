import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function removeBetween(file, startNeedle, endNeedle) {
  const filePath = path.join(root, file);
  let text = fs.readFileSync(filePath, 'utf8');
  const start = text.indexOf(startNeedle);
  const end = text.indexOf(endNeedle);
  if (start === -1 || end === -1 || end <= start) {
    console.error('skip', file, start, end);
    return;
  }
  text = text.slice(0, start) + text.slice(end);
  fs.writeFileSync(filePath, text);
  console.log('cleaned', file);
}

removeBetween(
  'src/pages/family/requestmanagement.jsx',
  '        <div className="mobile-top-bar" style={{ display: \'none\' }} aria-hidden>',
  '        <div className="content-area"'
);

removeBetween(
  'src/pages/family/profile.jsx',
  '        <div className="mobile-only mobile-top-bar" style={{ display: \'none\' }} aria-hidden>',
  '        <div className="scroll-content">'
);
