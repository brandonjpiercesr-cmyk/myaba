// ⬡B:911.aba_dials:TEST:dial_routing_guard:20260416⬡
// Guard test — fails build if MyABA.jsx loses ABA Dials routing.
// Another session wiped this wiring on April 16. Never again.

const fs = require('fs');
const path = require('path');

const MYABA_PATH = path.join(__dirname, '..', 'src', 'MyABA.jsx');
const content = fs.readFileSync(MYABA_PATH, 'utf8');

const REQUIRED_PATTERNS = [
  {
    name: 'DialModeView import',
    pattern: /import\s+DialModeView\s+from\s+["']\.\/views\/DialModeView/,
    fix: 'Add: import DialModeView from "./views/DialModeView.jsx";',
  },
  {
    name: 'dial click handler',
    pattern: /app\.id\s*===\s*["']dial["']\s*\)\s*\{\s*setMainTab\(\s*["']dial["']/,
    fix: 'Add: else if(app.id==="dial"){setMainTab("dial")}',
  },
  {
    name: 'phone → dial backward compat handler',
    pattern: /app\.id\s*===\s*["']phone["']\s*\)\s*\{\s*setMainTab\(\s*["']dial["']/,
    fix: 'Add: else if(app.id==="phone"){setMainTab("dial")} — backward compat for old app registry',
  },
  {
    name: 'dial render',
    pattern: /mainTab\s*===\s*["']dial["']\s*&&\s*<DialModeView/,
    fix: 'Add: {mainTab==="dial"&&<DialModeView userId={...}/>}',
  },
  {
    name: 'dial header title',
    pattern: /mainTab\s*===\s*["']dial["']\s*\?\s*["']ABA Dials["']/,
    fix: 'Add: mainTab==="dial"?"ABA Dials" to the header title ternary',
  },
  {
    name: 'dial APP_COLORS entry',
    pattern: /dial\s*:\s*["']#F59E0B["']/,
    fix: 'Add: dial: "#F59E0B" to APP_COLORS',
  },
];

let failed = 0;
console.log('\n=== ABA Dials Routing Guard ===\n');

for (const check of REQUIRED_PATTERNS) {
  if (check.pattern.test(content)) {
    console.log('  ✓ ' + check.name);
  } else {
    console.log('  ✗ MISSING: ' + check.name);
    console.log('    FIX: ' + check.fix);
    failed++;
  }
}

if (failed > 0) {
  console.log('\n' + failed + ' of ' + REQUIRED_PATTERNS.length + ' DIAL routing patterns missing from MyABA.jsx');
  console.log('See brain memo: source=911.aba_dials.do_not_break_myaba_routing.20260416');
  console.log('If you merged a branch that overwrote these, restore them before pushing.\n');
  process.exit(1);
}

console.log('\nAll DIAL routing patterns present. Safe to deploy.\n');
process.exit(0);
