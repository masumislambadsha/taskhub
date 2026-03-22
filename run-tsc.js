const { execSync } = require('child_process');
try {
  execSync('npx tsc --noEmit', { encoding: 'utf8' });
  console.log('No TS errors');
} catch (e) {
  require('fs').writeFileSync('tsc-errors-clean.txt', e.stdout, 'utf8');
  console.log('TS errors written to tsc-errors-clean.txt');
}
