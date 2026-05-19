import fs from 'fs';
import path from 'path';

const D = 'div';
const root = path.join(process.cwd(), 'src/pages/admin');
const replacement =
  "          <AdminMessagesNavItem onClick={(e) => { e.stopPropagation(); navigate('/admin-messages'); }} />";
const activeReplacement =
  '          <AdminMessagesNavItem active onClick={(e) => e.stopPropagation()} />';
const importLine = "import { AdminMessagesNavItem } from '@/components/admin/AdminMessagesNavItem';";

const inactiveBlock = [
  `          <${D} className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-messages'); }}>`,
  `            <${D} className="icon-box inactive"><MessageCircle size={22} /></${D}>`,
  `            <span className="sidebar-label">Messages</span>`,
  `          </${D}>`,
].join('\n');

const activeBlock = [
  `          <${D} className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>`,
  `            <${D} className="icon-box active"><MessageCircle size={22} /></${D}>`,
  `            <span className="sidebar-label" style={{ color: '#F54E25' }}>Messages</span>`,
  `          </${D}>`,
].join('\n');

const files = fs.readdirSync(root).filter((f) => f.endsWith('.jsx'));
let count = 0;
for (const f of files) {
  const fp = path.join(root, f);
  let s = fs.readFileSync(fp, 'utf8');
  if (!s.includes('/admin-messages')) continue;
  const orig = s;
  const crlfInactive = inactiveBlock.replace(/\n/g, '\r\n');
  const crlfActive = activeBlock.replace(/\n/g, '\r\n');
  s = s.split(inactiveBlock).join(replacement);
  s = s.split(crlfInactive).join(replacement);
  s = s.split(activeBlock).join(activeReplacement);
  s = s.split(crlfActive).join(activeReplacement);
  if (s.includes('AdminMessagesNavItem') && !s.includes(importLine)) {
    const m = s.match(/^import .+ from 'lucide-react';/m);
    if (m) s = s.replace(m[0], `${m[0]}\n${importLine}`);
  }
  if (s !== orig) {
    fs.writeFileSync(fp, s);
    count++;
    console.log('updated', f);
  }
}
console.log('done', count);
