import nodemailer from "nodemailer";

// ─── Build Transporter ────────────────────────────────────────────────────────
function createTransporter() {
  const host    = process.env.SMTP_HOST;
  const port    = Number(process.env.SMTP_PORT || 587);
  const user    = process.env.SMTP_USER;
  const pass    = process.env.SMTP_PASS;
  const secure  = process.env.SMTP_SECURE === "true"; // true for port 465

  if (!host || !user || !pass) {
    console.warn(
      "[EmailService] SMTP not fully configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). " +
      "Emails will be logged to console only."
    );
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }, // allow self-signed certs in dev
  });
}

const transporter = createTransporter();

// ─── Sender defaults ─────────────────────────────────────────────────────────
const FROM_NAME  = process.env.SMTP_FROM_NAME  || "Ignito Experia";
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@ignito.app";
const FRONTEND_URL = process.env.FRONTEND_URL  || "http://localhost:5173";

// ─── Generic send helper ─────────────────────────────────────────────────────
async function sendMail({ to, subject, html, text }) {
  const from = `"${FROM_NAME}" <${FROM_EMAIL}>`;

  if (!transporter) {
    // Dev fallback — print to console
    console.log("\n══════════════════════════════════════════════");
    console.log(`[EmailService] DEV MODE — would send email`);
    console.log(`  To     : ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body   : ${text || "(html only)"}`);
    console.log("══════════════════════════════════════════════\n");
    return { messageId: "dev-console" };
  }

  try {
    const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`[EmailService] Sent to ${to} — messageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[EmailService] Failed to send to ${to}:`, err.message);
    throw err;
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * Welcome / Registration confirmation email.
 * No email-verification link required — user can log in immediately.
 */
export async function sendWelcomeEmail({ to, fullName }) {
  const loginUrl = `${FRONTEND_URL}/sign-in`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to IgnitoExperia</title>
  <style>
    body { margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; background:#f0f4ff; }
    .wrapper { max-width:600px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding:40px 32px; text-align:center; }
    .header img { height:48px; margin-bottom:12px; }
    .header h1 { margin:0; color:#ffffff; font-size:26px; font-weight:700; letter-spacing:-0.5px; }
    .header p  { margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px; }
    .body { padding:36px 32px; color:#374151; }
    .body h2 { margin:0 0 12px; font-size:20px; color:#1f2937; }
    .body p  { margin:0 0 16px; font-size:15px; line-height:1.7; color:#4b5563; }
    .btn { display:inline-block; margin:8px 0 24px; padding:14px 32px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff !important; font-size:15px; font-weight:600; text-decoration:none; border-radius:10px; letter-spacing:0.2px; }
    .divider { border:none; border-top:1px solid #e5e7eb; margin:24px 0; }
    .info-box { background:#f8faff; border:1px solid #e0e7ff; border-radius:10px; padding:18px 20px; margin-bottom:20px; }
    .info-box p { margin:0; font-size:14px; color:#4b5563; }
    .info-box strong { color:#4f46e5; }
    .footer { background:#f9fafb; padding:24px 32px; text-align:center; border-top:1px solid #f3f4f6; }
    .footer p { margin:0; font-size:13px; color:#9ca3af; line-height:1.6; }
    .footer a { color:#4f46e5; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🎉 Welcome to IgnitoExperia!</h1>
      <p>Your virtual laboratory journey begins now</p>
    </div>
    <div class="body">
      <h2>Hi ${fullName},</h2>
      <p>
        We're thrilled to have you on board! Your account has been created successfully
        and you're all set to start exploring the virtual lab environment.
      </p>

      <div class="info-box">
        <p>📧 <strong>Account:</strong> ${to}</p>
        <p style="margin-top:8px">🎓 <strong>Role:</strong> Student</p>
        <p style="margin-top:8px">✅ <strong>Status:</strong> Active — you can log in immediately</p>
      </div>

      <p>Click the button below to sign in and start your first lab session:</p>
      <a href="${loginUrl}" class="btn">Go to Login →</a>

      <hr class="divider" />

      <p style="font-size:14px; color:#6b7280;">
        If you didn't create this account, you can safely ignore this email.
        Your account will remain inactive until you choose to use it.
      </p>
    </div>
    <div class="footer">
      <p>
        © ${new Date().getFullYear()} IgnitoExperia. All rights reserved.<br />
        <a href="${FRONTEND_URL}">ignito.app</a> · Built for the next generation of learners
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Welcome to IgnitoExperia, ${fullName}!\n\nYour account (${to}) has been created. Log in at: ${loginUrl}`;

  return sendMail({ to, subject: "🎉 Welcome to IgnitoExperia — Account Created!", html, text });
}

/**
 * Password reset email.
 */
export async function sendPasswordResetEmail({ to, fullName, resetToken }) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Reset Your Password</title>
  <style>
    body { margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; background:#f0f4ff; }
    .wrapper { max-width:600px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#dc2626,#b91c1c); padding:36px 32px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:24px; font-weight:700; }
    .header p  { margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px; }
    .body { padding:36px 32px; color:#374151; }
    .body h2 { margin:0 0 12px; font-size:20px; color:#1f2937; }
    .body p  { margin:0 0 16px; font-size:15px; line-height:1.7; color:#4b5563; }
    .btn { display:inline-block; margin:8px 0 24px; padding:14px 32px; background:linear-gradient(135deg,#dc2626,#b91c1c); color:#fff !important; font-size:15px; font-weight:600; text-decoration:none; border-radius:10px; }
    .warning-box { background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:16px 20px; margin-bottom:20px; font-size:14px; color:#92400e; }
    .footer { background:#f9fafb; padding:24px 32px; text-align:center; border-top:1px solid #f3f4f6; }
    .footer p { margin:0; font-size:13px; color:#9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
      <p>IgnitoExperia Security</p>
    </div>
    <div class="body">
      <h2>Hi ${fullName},</h2>
      <p>We received a request to reset the password for your IgnitoExperia account.</p>
      <p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
      <a href="${resetUrl}" class="btn">Reset My Password →</a>
      <div class="warning-box">
        ⚠️ If you did not request a password reset, please ignore this email. Your password will remain unchanged.
      </div>
      <p style="font-size:13px; color:#6b7280;">
        Or paste this URL in your browser:<br />
        <a href="${resetUrl}" style="color:#4f46e5; word-break:break-all;">${resetUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} IgnitoExperia. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Hi ${fullName},\n\nReset your IgnitoExperia password here (expires in 15 minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;

  return sendMail({ to, subject: "🔐 Reset Your IgnitoExperia Password", html, text });
}

export default { sendWelcomeEmail, sendPasswordResetEmail };
