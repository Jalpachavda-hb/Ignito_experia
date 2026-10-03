import { execSync } from 'child_process';
const out = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:list', { encoding: 'utf-8' });
console.log(out);
