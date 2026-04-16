# CAPSTONE QA TEST CASE DOCUMENT

**Capstone Title:** Kalinga: An Intelligent Digital Rehabilitation Management and Admission System Using Predictive Analytics  
**Written Date:** April 16, 2026  
**Document Version:** 1.0  
**Prepared For:** Software Progress Testing (Web + Mobile)  
**Testing Type:** Functional, Validation, Navigation, Role Access, UX, Error Handling

---

## Test Execution Summary Sheet

| Field | Value |
|---|---|
| Test Conditions Date | ____________________ |
| Total Test Cases | 220 |
| Passed | ____________________ |
| Failed | ____________________ |
| Pass Rating Formula | `# Passed / # Total * 100` |
| Tester Name | ____________________ |
| Adviser Signature | ____________________ |

---

## Standard Result Columns (for each test case)

- **Actual Result**
- **Pass / Fail**
- **Comments / Suggestions**

> Note: Keep this document as your master sheet, then duplicate rows to encode actual run results per test cycle.

---

## A. WEB SYSTEM TEST CASES (120 Cases)

### A1. Public Pages and Authentication

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| WTC-001 | Landing | Open landing page | Navigate to web root URL | Hero, nav, and sections render |
| WTC-002 | Landing | Get Started CTA | Click `Get Started` | Redirect to `/login` |
| WTC-003 | Landing | Desktop login button | Click header `Login` | Redirect to `/login` |
| WTC-004 | Landing | Mobile menu login | Mobile width, open menu, click login | Redirect to `/login` |
| WTC-005 | Landing | Footer links visibility | Scroll to footer | Contact and legal items visible |
| WTC-006 | Login | Family valid login | Select Family, valid credentials, submit | Redirect to `/home` |
| WTC-007 | Login | Nurse valid login | Select Nurse, valid credentials, submit | Redirect to `/nurse-dashboard` |
| WTC-008 | Login | Admin valid login | Select Admin, valid credentials, submit | Redirect to `/admin-dashboard` |
| WTC-009 | Login | Missing account type | Keep account type empty, submit | Validation error shown |
| WTC-010 | Login | Invalid email format | Enter invalid email, submit | Validation error shown |
| WTC-011 | Login | Empty fields | Submit with empty credentials | Required error shown |
| WTC-012 | Login | Password toggle | Click eye icon | Password show/hide toggles |
| WTC-013 | Login | Remember me toggle | Toggle remember me | State toggles correctly |
| WTC-014 | Login | Forgot password link | Click forgot password | Redirect to `/forgot` |
| WTC-015 | Login | Sign up link | Click sign up | Redirect to `/signup` |
| WTC-016 | Login | Google OAuth start | Click continue with Google | OAuth flow opens |
| WTC-017 | Signup | Valid signup | Fill valid form + terms + submit | Account created |
| WTC-018 | Signup | Missing full name | Leave full name empty | Validation error |
| WTC-019 | Signup | Missing email | Leave email empty | Validation error |
| WTC-020 | Signup | Password mismatch | Enter different confirm password | Validation error |
| WTC-021 | Signup | Weak password length | Password < 8 chars | Validation error |
| WTC-022 | Signup | Terms unchecked | Submit without accepting terms | Submission blocked |
| WTC-023 | Forgot Password | Valid request | Enter valid email, submit | Goes to verify screen |
| WTC-024 | OTP Verify | Correct 4-digit OTP | Enter valid OTP | Proceeds to new password |
| WTC-025 | OTP Verify | Incomplete OTP | Enter fewer than 4 digits | Submission blocked |
| WTC-026 | New Password | Valid reset | Enter valid matching passwords | Password reset success |
| WTC-027 | New Password | Mismatch reset | Enter non-matching values | Validation error |
| WTC-028 | Role Guard | Family blocked from admin page | Login family, open `/admin-dashboard` | Redirected to allowed page |
| WTC-029 | Role Guard | Nurse blocked from admin page | Login nurse, open `/admin-dashboard` | Redirected to nurse page |
| WTC-030 | Role Guard | Unauthenticated protected route | Open protected route while logged out | Redirected to `/login` |

### A2. Family Web Modules

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| WTC-031 | Family Home | Home dashboard load | Login as family and open home | Dashboard loads fully |
| WTC-032 | Family Home | Quick action: Admission | Click Admission quick action | Redirect to `/admission` |
| WTC-033 | Family Home | Quick action: Services | Click Services quick action | Redirect to `/services` |
| WTC-034 | Family Home | Quick action: Weekly Report | Click weekly report action | Report modal/section opens |
| WTC-035 | Family Home | Patient list rendering | Ensure linked patient exists | Patient cards display |
| WTC-036 | Family Home | Recovery progress display | Open patient card | Progress bar and percent shown |
| WTC-037 | Family Admission | Required fields validation | Submit empty admission form | Required errors shown |
| WTC-038 | Family Admission | Invalid email validation | Enter invalid guardian email | Validation error |
| WTC-039 | Family Admission | Terms required | Leave terms unchecked and submit | Submission blocked |
| WTC-040 | Family Admission | Reason dropdown required | Do not select reason, submit | Validation error |
| WTC-041 | Family Admission | Valid admission submit | Complete form correctly and submit | Success prompt shown |
| WTC-042 | Family Admission | Admission persistence | Refresh after submit | Request remains saved |
| WTC-043 | Family Services | Services page load | Open `/services` | Fees and inclusions visible |
| WTC-044 | Family Services | Admission fee expand | Expand admission card | Inclusion details visible |
| WTC-045 | Family Services | Monthly fee expand | Expand monthly section | Grouped inclusions visible |
| WTC-046 | Family Services | Admit button action | Click `Admit a patient` | Redirects to admission form |
| WTC-047 | Family Progress | Progress page load | Open `/progress` | Patient progress grid appears |
| WTC-048 | Family Progress | View details action | Click patient view details | Detail panel opens |
| WTC-049 | Family Progress | Discharge request submit | Request discharge for patient | Pending discharge created |
| WTC-050 | Family Progress | Prevent duplicate discharge | Request discharge again same patient | No duplicate pending request |

### A3. Nurse and Admin Web Modules

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| WTC-051 | Nurse Dashboard | Weekly report form load | Login nurse, open dashboard | Form sections visible |
| WTC-052 | Nurse Dashboard | Fill weekly report fields | Fill core inputs and vitals | Accepts valid entries |
| WTC-053 | Nurse Dashboard | Submit weekly report | Submit completed form | Submission flow successful |
| WTC-054 | Nurse DB | Patient database load | Open nurse patient database | Rows and filters visible |
| WTC-055 | Nurse DB | Search patient | Search by partial name | Matching rows filtered |
| WTC-056 | Nurse DB | Sort patient list | Change sort option | Row order updates |
| WTC-057 | Nurse DB | View patient details | Click row `View` | Details panel opens |
| WTC-058 | Nurse Profile | Open nurse profile | Navigate to profile | Profile info and controls visible |
| WTC-059 | Nurse Profile | Change password nav | Click change password | Redirect to nurse change pass |
| WTC-060 | Nurse Profile | Logout | Click logout | Returns to login |

### A4. Admin Approvals, Analytics, and Management

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| WTC-061 | Admin Dashboard | Dashboard cards load | Login admin and open dashboard | Metrics and pending cards visible |
| WTC-062 | Admin Admissions | Open pending admissions modal | Click pending admissions card | Modal opens with requests |
| WTC-063 | Admin Admissions | Decline admission request | Click decline on a request | Request removed from pending |
| WTC-064 | Admin Admissions | Approve admission opens confirm | Click approve | Confirmation modal appears |
| WTC-065 | Admin Admissions | 2FA modal appears | Proceed from confirm | OTP modal appears |
| WTC-066 | Admin Admissions | Approve with OTP | Enter valid OTP and confirm | Admission approved |
| WTC-067 | Admin Discharges | Open pending discharge modal | Click pending discharges card | Discharge list appears |
| WTC-068 | Admin Discharges | Decline discharge | Click decline | Request removed from pending |
| WTC-069 | Admin Discharges | Approve discharge flow | Approve + OTP confirm | Patient discharged |
| WTC-070 | Admin Dashboard | Activity log update | Approve/decline any request | New activity entry logged |
| WTC-071 | Admin Analytics | Open analytics page | Navigate to `/analytics` | Charts/cards render |
| WTC-072 | Admin Analytics | Filters visible | Check filter controls | Filters displayed and usable |
| WTC-073 | Admin Analytics | Export controls visible | Locate export area | PDF/CSV/Print controls present |
| WTC-074 | Admin Patient DB | Open admin patient DB | Navigate to admin DB page | Table and count visible |
| WTC-075 | Admin Patient DB | Search functionality | Search by patient name | Filtered results shown |
| WTC-076 | Admin Patient DB | View details | Click `View` on patient row | Detail panel opens |
| WTC-077 | Admin Patient DB | Delete flow open | Click trash icon | Delete confirm prompt shown |
| WTC-078 | Admin Patient DB | Delete confirm/cancel | Test cancel and confirm paths | Correct behavior per action |
| WTC-079 | Global Web UX | Responsive mobile layout | Resize to mobile widths | Layout remains usable |
| WTC-080 | Global Web Error | Offline submit handling | Disable internet and submit form | Friendly error, no crash |

### A5. Extended Web Test Pack (Security, Data Integrity, Accessibility, Compatibility)

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| WTC-081 | Auth Security | SQL-like input in login | Enter `' OR 1=1 --` in identifier and submit | Login fails safely, no crash |
| WTC-082 | Auth Security | Script-like input in signup name | Enter `<script>alert(1)</script>` in full name | Input handled safely, no script execution |
| WTC-083 | Auth Security | Repeated wrong login attempts | Submit wrong password 10 times | App remains stable, controlled error responses |
| WTC-084 | Session | Session survives page refresh | Login then refresh protected page | User stays logged in |
| WTC-085 | Session | Logout clears protected access | Logout then open protected URL | Redirected to login |
| WTC-086 | Role Isolation | Family cannot access nurse route | Login family, open `/nurse-dashboard` | Redirected to family route |
| WTC-087 | Role Isolation | Nurse cannot access family-only action | Login nurse and open family admission route | Route blocked/redirected |
| WTC-088 | Role Isolation | Admin can access admin modules | Login admin and open all admin pages | Access granted |
| WTC-089 | Admission Data | Phone login resolver works | Login via phone/contact path | Correct user resolved and authenticated |
| WTC-090 | Admission Data | Missing required DB field fallback | Submit admission with minimal allowed fields | Request still stored correctly |
| WTC-091 | Admin Approval | Approve admission updates counts | Approve one request from modal | Pending decreases; patient count increases |
| WTC-092 | Admin Approval | Decline admission updates counts | Decline one admission | Pending decreases; declined reflects update |
| WTC-093 | Admin Discharge | Approve discharge removes active patient | Approve discharge request | Active patient removed from list |
| WTC-094 | Admin Discharge | Decline discharge retains patient | Decline discharge request | Patient remains active |
| WTC-095 | Admin Activity | Activity feed insert on approval | Approve any request | Activity feed shows new entry |
| WTC-096 | Admin Activity | Activity feed clear action | Click clear all in dashboard | Activity list empties |
| WTC-097 | Analytics Export | Export CSV file content | Apply filters then export CSV | CSV downloaded with matching filtered rows |
| WTC-098 | Analytics Export | Export PDF download works | Click Export PDF | `.pdf` file downloads successfully |
| WTC-099 | Analytics Export | PDF includes filters and metrics | Open exported PDF | Header/filters/metrics visible and readable |
| WTC-100 | Analytics Export | PDF includes patient rows | Export with known dataset | Patient table appears in PDF |
| WTC-101 | Analytics Filters | Period filter updates metrics | Switch weekly/monthly/yearly | KPI values change accordingly |
| WTC-102 | Analytics Filters | Program filter applies | Select each program | Chart/KPI values update |
| WTC-103 | Analytics Filters | Gender filter applies | Select Male/Female/Other | Filtered values update |
| WTC-104 | Analytics Filters | Age filter applies | Select age bracket | Dataset scoped to bracket |
| WTC-105 | Analytics Filters | Outcome filter applies | Select outcome (e.g. Discharged) | Result set updates |
| WTC-106 | Analytics Filters | Therapist filter applies | Select therapist value | Data limited to therapist |
| WTC-107 | Accessibility | Keyboard nav on login form | Use tab/enter only | Fields/buttons usable by keyboard |
| WTC-108 | Accessibility | Focus visibility | Navigate key controls via keyboard | Focus indicator visible |
| WTC-109 | Accessibility | Color contrast spot check | Check key text over backgrounds | Readable contrast in critical actions |
| WTC-110 | Compatibility | Chrome compatibility | Run smoke tests in Chrome | Works without critical issue |
| WTC-111 | Compatibility | Edge compatibility | Run smoke tests in Edge | Works without critical issue |
| WTC-112 | Compatibility | Firefox compatibility | Run smoke tests in Firefox | Works without critical issue |
| WTC-113 | Responsiveness | 1366x768 layout | Test dashboard, analytics, forms | No clipping/overlap |
| WTC-114 | Responsiveness | 1920x1080 layout | Test key pages | Layout scales correctly |
| WTC-115 | Responsiveness | 768px breakpoint behavior | Test sidebars/navbars around breakpoint | Correct desktop/mobile switching |
| WTC-116 | Error Handling | Supabase env missing on web | Remove env values and open app | Warning shown; app fails gracefully |
| WTC-117 | Error Handling | API failure during approve | Simulate network failure during approve | Error shown, no data corruption |
| WTC-118 | Regression | Full family flow | Signup/login -> admission -> progress/services/profile | End-to-end flow works |
| WTC-119 | Regression | Full nurse flow | Nurse login -> weekly report -> patient DB -> profile | End-to-end flow works |
| WTC-120 | Regression | Full admin flow | Admin login -> review -> approve/decline -> analytics export | End-to-end flow works |

---

## B. MOBILE APP TEST CASES (100 Cases)

### B1. App Start, Onboarding, and Authentication

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| MTC-001 | Splash | App launch | Open mobile app | Splash screen appears |
| MTC-002 | Splash | Splash transition | Wait for load completion | Navigates to onboarding/login |
| MTC-003 | Onboarding | Swipe next slide | Swipe left | Next onboarding slide shown |
| MTC-004 | Onboarding | Swipe previous slide | Swipe right | Previous slide shown |
| MTC-005 | Onboarding | Pagination sync | Move across slides | Active dot updates correctly |
| MTC-006 | Onboarding | Get started button | Tap Get Started | Opens login screen |
| MTC-007 | Login | Family login success | Valid family credentials, tap sign in | Navigates to home tab |
| MTC-008 | Login | Empty fields validation | Submit empty login form | Error message shown |
| MTC-009 | Login | Invalid identifier | Enter invalid email/phone | Validation error |
| MTC-010 | Login | Weak password validation | Enter weak password | Validation error shown |
| MTC-011 | Login | Password eye toggle | Tap eye icon | Password visibility toggles |
| MTC-012 | Login | Forgot password navigation | Tap forgot password | Navigates to forget screen |
| MTC-013 | Login | Sign up navigation | Tap sign up link | Navigates to signup screen |
| MTC-014 | Login | Google OAuth flow | Tap Continue with Google | OAuth starts |
| MTC-015 | Login | Staff account blocked | Login as nurse/admin | Blocked with web-only message |
| MTC-016 | Signup | Valid signup | Complete signup + terms | Account creation success |
| MTC-017 | Signup | Terms required | Submit without terms | Submission blocked |
| MTC-018 | Forgot Pass | Send verification | Enter valid email and submit | Verification step proceeds |
| MTC-019 | OTP | OTP validation | Enter correct OTP | Moves to new password |
| MTC-020 | New Password | Reset password success | Set valid password and confirm | Password reset success |

### B2. Family Tabs: Home, Services, Progress, Messages, Profile

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| MTC-021 | Home | Home screen load | Login and open home tab | Header/cards render |
| MTC-022 | Home | User profile initials | Observe avatar initials | Correct initials displayed |
| MTC-023 | Home | Notifications modal | Tap notification icon | Dropdown/modal opens |
| MTC-024 | Home | Quick action weekly report | Tap Weekly Report tile | Redirects to report/progress area |
| MTC-025 | Home | Quick action services | Tap Services tile | Opens services screen |
| MTC-026 | Home | Quick action admission | Tap Admission tile | Opens admission form |
| MTC-027 | Home | Load patient cards | With existing patient data | Patient cards and progress shown |
| MTC-028 | Home | Empty patient state | No patient linked | Empty state with CTA shown |
| MTC-029 | Services | Services page load | Open services tab | Fees/inclusions layout visible |
| MTC-030 | Services | Admission fee card expand | Tap admission card | Inclusions expand/collapse |
| MTC-031 | Services | Monthly sections expand | Toggle monthly section | Items display correctly |
| MTC-032 | Services | Admit a patient CTA | Tap button | Redirect to admission form |
| MTC-033 | Progress | Progress tab navigation | Tap bottom nav progress | Progress tab opens |
| MTC-034 | Progress | Weekly report detail open | Tap week/report item | Detail content opens |
| MTC-035 | Progress | Discharge action | Start discharge request | Discharge flow triggered |
| MTC-036 | Messages | Open messages tab | Tap messages icon/tab | Inbox list loads |
| MTC-037 | Messages | Search thread | Enter search keyword | Thread list filters |
| MTC-038 | Messages | Open thread | Tap a conversation | Chat view opens |
| MTC-039 | Messages | Send message | Type and send text | User message appears |
| MTC-040 | Messages | Message receipt updates | Wait after send | Sent/delivered/seen status updates |
| MTC-041 | Profile | Open profile tab | Tap profile tab | Profile screen loads |
| MTC-042 | Profile | Edit profile mode | Tap edit profile | Inputs become editable |
| MTC-043 | Profile | Save profile changes | Edit fields and save | Changes persist |
| MTC-044 | Profile | Upload profile photo gallery | Tap edit avatar > upload | Image selected and displayed |
| MTC-045 | Profile | Take profile photo camera | Tap edit avatar > camera | Captured image displayed |
| MTC-046 | Profile | Change password navigation | Tap change password | Opens change password screen |
| MTC-047 | Profile | Notification settings navigation | Tap notification settings | Opens notification screen |
| MTC-048 | Profile | Toggle preferences | Toggle translate/tagalog option | Preference saved locally |
| MTC-049 | Profile | Logout flow | Tap logout and confirm | Returns to login |
| MTC-050 | Tabs | Bottom navigation consistency | Switch all tabs repeatedly | No navigation break/crash |

### B3. Admission and Discharge Forms, Validation, and Error Handling

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| MTC-051 | Admission Form | Load admission form | Open admission form screen | All fields and sections visible |
| MTC-052 | Admission Form | Required fields validation | Submit empty form | Required field errors shown |
| MTC-053 | Admission Form | Email format validation | Enter invalid email | Email validation error |
| MTC-054 | Admission Form | Phone format validation | Enter invalid phone | Phone validation error |
| MTC-055 | Admission Form | Birthday picker open | Tap birthday input | Date picker opens |
| MTC-056 | Admission Form | Future date blocked | Select future birth date | Validation error/prevention |
| MTC-057 | Admission Form | Reason required | Do not choose reason and submit | Validation error shown |
| MTC-058 | Admission Form | Terms required | Leave terms unchecked | Submission blocked |
| MTC-059 | Admission Form | Save draft | Fill partial form and save draft | Draft saved successfully |
| MTC-060 | Admission Form | Restore draft | Reopen form after save draft | Previous values restored |
| MTC-061 | Admission Form | Reset form | Tap reset form | Fields cleared and draft removed |
| MTC-062 | Admission Form | Valid submit success | Fill valid form and submit | Success modal shown |
| MTC-063 | Admission Form | Activity log append | Submit valid request | Activity entry created |
| MTC-064 | Discharge Form | Load discharge form | Open discharge form | Form fields display |
| MTC-065 | Discharge Form | Required-field validation | Submit with missing fields | Alert/validation shown |
| MTC-066 | Discharge Form | Invalid date format | Enter invalid date | Validation error shown |
| MTC-067 | Discharge Form | Invalid phone digits | Enter non-numeric/short number | Validation error shown |
| MTC-068 | Discharge Form | Valid discharge submit | Fill all required and submit | Submission success shown |
| MTC-069 | Global Mobile Error | Offline submission handling | Disable data/Wi-Fi and submit | Friendly error displayed |
| MTC-070 | Global Mobile UX | Orientation/responsive check | Test portrait and landscape | UI remains usable and aligned |

### B4. Extended Mobile Test Pack (Stability, Storage, Device, UX, Regression)

| TC ID | Module | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|---|
| MTC-071 | Login Security | Script-like input in text fields | Enter `<script>` payload in login input | Input treated as plain text, no crash |
| MTC-072 | Login Security | Brute-like repeated invalid login | Submit wrong password repeatedly | App stable, consistent error response |
| MTC-073 | Session | App relaunch keeps session | Login, close app, reopen | User remains logged in |
| MTC-074 | Session | Logout clears session on relaunch | Logout, close app, reopen | User starts at login |
| MTC-075 | Home Data | Pull-to-refresh/reopen data sync | Open home after admin-side updates | Home data reflects latest backend state |
| MTC-076 | Home UX | Notification modal close on backdrop | Open notifications and tap outside | Modal closes properly |
| MTC-077 | Home UX | Community banner dismiss persistence | Dismiss banner then revisit home | Banner stays dismissed |
| MTC-078 | Services UX | Services screen close/back action | Use close action in services | Returns to intended route |
| MTC-079 | Admission Validation | Middle initial constraints | Enter non-letter chars in middle initial | Invalid chars filtered out |
| MTC-080 | Admission Validation | Date picker cancel behavior | Open iOS/Android picker then cancel | Field remains unchanged |
| MTC-081 | Admission Validation | Terms modal agree action | Open terms and tap agree | Checkbox toggles true |
| MTC-082 | Admission UX | Progress indicator updates per field | Fill fields gradually | Completion percent increases correctly |
| MTC-083 | Admission UX | Submit button loading state | Submit valid form | Button shows submitting state |
| MTC-084 | Admission Data | Submission with optional fields blank | Leave optional fields empty and submit | Submission still succeeds |
| MTC-085 | Admission Error | Submit while offline | Disconnect network and submit | Friendly error, form remains intact |
| MTC-086 | Messages UX | Long message wrapping | Send very long text | Bubble wraps, layout not broken |
| MTC-087 | Messages UX | Auto-scroll behavior near bottom | Send message while at bottom | Chat remains pinned to latest message |
| MTC-088 | Messages UX | Manual scroll-up preservation | Scroll up then new message arrives | User position not forcibly reset |
| MTC-089 | Messages UX | Thread search no result state | Search nonexistent thread | Empty-state text shown |
| MTC-090 | Messages UX | Selection mode actions | Select chat(s), mark/archive/delete | Selected actions execute correctly |
| MTC-091 | Profile Data | Load profile from Supabase | Open profile with configured backend | Name/email/phone/address loaded |
| MTC-092 | Profile Data | Save edited profile fields | Edit name/phone/address and save | Saved values persist on reopen |
| MTC-093 | Profile Media | Camera permission denied flow | Deny permission then take photo | Graceful failure, no crash |
| MTC-094 | Profile Media | Gallery permission denied flow | Deny library permission then upload | Graceful failure, no crash |
| MTC-095 | Profile UX | Toggle Tagalog preference persistence | Toggle switch, restart app | Preference persists |
| MTC-096 | Device Compatibility | Android phone smoke test | Run full nav + login + forms on Android | Stable behavior |
| MTC-097 | Device Compatibility | iOS phone smoke test | Run full nav + login + forms on iOS | Stable behavior |
| MTC-098 | Device Compatibility | Small-screen layout check | Test narrow screen device | No critical clipping/overlap |
| MTC-099 | Regression | Family end-to-end mobile flow | Login -> admission -> messages -> profile -> logout | End-to-end works |
| MTC-100 | Regression | Mobile + web consistency check | Submit on mobile, verify on web admin | Data appears consistently |

---

## C. Recommended Additional Stress/Regression Pass (Optional)

Run these high-value regressions before demo:

1. **Role switch regression:** family, nurse, admin login in sequence.
2. **Admission-discharge chain:** submit family admission -> admin approve -> submit discharge -> admin approve.
3. **Cross-platform consistency:** same account data appears in web and mobile.
4. **Session persistence:** app/web restart while logged in.
5. **Network interruption tests:** submit during intermittent connection.

---

## D. Export Instructions (Word/PDF)

### To Word
1. Open this file in Cursor or VS Code preview.
2. Copy all content and paste into Microsoft Word.
3. Set page size to A4, table font 9-10 pt.
4. Save as `.docx`.

### To PDF
1. Open Word file.
2. `File > Save As > PDF`.
3. Use filename: `Capstone_QA_Test_Cases_Web_Mobile_v1.pdf`.

---

## E. Suggested Filenames for Submission

- `Capstone_QA_Test_Cases_Web_and_Mobile.docx`
- `Capstone_QA_Test_Cases_Web_and_Mobile.pdf`
- `Capstone_QA_Test_Cases_Web_and_Mobile_ExecutionLog.xlsx`

