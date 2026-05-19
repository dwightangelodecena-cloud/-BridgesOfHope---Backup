import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const patches = [
  {
    file: 'src/pages/family/reports.jsx',
    start: '        {/* Top Nav */}',
    end: '        {/* Mobile Top Bar */}',
    replacement: '        <FamilyPageHeader title="Weekly Reports" />\n\n        {/* Mobile Top Bar */}',
  },
  {
    file: 'src/pages/family/appointments.jsx',
    start: '        {/* Top Nav */}',
    end: '        <div className="scroll-area"',
    replacement: '        <FamilyPageHeader title="Appointments" />\n\n        <div className="scroll-area"',
  },
  {
    file: 'src/pages/family/requestmanagement.jsx',
    start: '        <header className="top-nav">',
    end: '        <div className="mobile-top-bar">',
    replacement:
      "        <FamilyPageHeader title=\"Request Management\" />\n\n        <div className=\"mobile-top-bar\" style={{ display: 'none' }} aria-hidden>",
  },
  {
    file: 'src/pages/family/profile.jsx',
    start: '        {/* DESKTOP TOP NAV — exact copy from home.jsx */}',
    end: '        <div className="mobile-only mobile-top-bar">',
    replacement:
      "        <FamilyPageHeader title=\"Profile\" />\n\n        <div className=\"mobile-only mobile-top-bar\" style={{ display: 'none' }} aria-hidden>",
  },
];

for (const patch of patches) {
  const filePath = path.join(root, patch.file);
  let text = fs.readFileSync(filePath, 'utf8');
  const start = text.indexOf(patch.start);
  const end = text.indexOf(patch.end);
  if (start === -1 || end === -1 || end < start) {
    console.error('FAIL', patch.file, { start, end });
    process.exitCode = 1;
    continue;
  }
  text = text.slice(0, start) + patch.replacement + text.slice(end);
  fs.writeFileSync(filePath, text);
  console.log('OK', patch.file);
}
