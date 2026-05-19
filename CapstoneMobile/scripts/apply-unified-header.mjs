/**
 * Replaces duplicated notification modal + top bar with FamilyMobilePageHeader.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const tabs = path.join(root, 'app', 'tabs');

const configs = [
  { file: 'appointments.tsx', title: 'Appointments', showLogo: false },
  { file: 'reports.tsx', title: 'Weekly Reports', showLogo: false },
  { file: 'progress.tsx', title: 'Request Management', showLogo: false },
  { file: 'services.tsx', title: 'Services', showLogo: false },
];

const modalBlockRe =
  /<Modal\s+visible=\{showNotifications\}[\s\S]*?<\/Modal>\s*\n\s*\n\s*<View style=\{styles\.(?:topBar|mobileTopBar)[\s\S]*?<\/View>\s*\n/;

const importNeedle = /import \{ notificationTextMobile \} from ['"]\.\.\/\.\.\/lib\/familyNotificationsMobile['"];\s*\nimport \{ useFamilyNotificationsState \} from ['"]\.\.\/\.\.\/lib\/useFamilyNotificationsMobile['"];\s*\n/;

const importReplacement = `import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';\nimport { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';\n`;

const stateRe =
  /const \[showNotifications, setShowNotifications\] = useState\(false\);\s*\n\s*const \[userInitials, setUserInitials\] = useState\('FU'\);\s*\n/;

const notifStateRe =
  /const \{ notificationItems, setNotificationItems \} = useFamilyNotificationsState\(familyUserId\);\s*\n/;

const userEffectRe =
  /useEffect\(\(\) => \{\s*let mounted = true;\s*\(async \(\) => \{[\s\S]*?setUserInitials\(deriveInitials\(resolved\)\);[\s\S]*?\}\)\(\);\s*return \(\) => \{\s*mounted = false;\s*\};\s*\}, \[\]\);\s*\n\s*\n/;

for (const { file, title, showLogo } of configs) {
  const fp = path.join(tabs, file);
  let src = fs.readFileSync(fp, 'utf8');
  if (!src.includes('FamilyMobilePageHeader')) {
    if (!importNeedle.test(src)) {
      console.warn('skip imports', file);
    } else {
      src = src.replace(importNeedle, importReplacement);
    }
    if (stateRe.test(src)) {
      src = src.replace(stateRe, "const { displayName } = useFamilyUserMobile();\n");
    }
    src = src.replace(notifStateRe, '');
    if (userEffectRe.test(src)) {
      src = src.replace(userEffectRe, '');
    }
    const header = `<FamilyMobilePageHeader title="${title}" showLogo={${showLogo}} />\n\n      `;
    if (modalBlockRe.test(src)) {
      src = src.replace(modalBlockRe, header);
      src = src.replace(
        /paddingTop: insets\.top,\s*/g,
        ''
      );
    } else {
      console.warn('skip modal block', file);
    }
    fs.writeFileSync(fp, src);
    console.log('patched', file);
  } else {
    console.log('already', file);
  }
}
