import dotenv from 'dotenv';
dotenv.config();
import { execSync } from 'child_process';

const env = { ...process.env, AWS_DEFAULT_REGION: process.env.AWS_REGION || 'ap-south-1' };
try {
  const out = execSync('aws ssm send-command --instance-ids i-05808b206f129878d --document-name AWS-RunShellScript --parameters "commands=pm2 list"', { env, encoding: 'utf-8' });
  const data = JSON.parse(out);
  console.log('CommandId:', data.Command?.CommandId);
} catch (e) {
  console.error(e.message, e.stderr);
}
