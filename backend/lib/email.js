import nodemailer from "nodemailer";

export async function sendOtpEmail({ to, otp, fullName }) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const fromName = process.env.SMTP_FROM_NAME || "Ignito Experia";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user || "no-reply@experia.com";

  if (!user || user.includes("your-gmail")) {
    console.warn(`[EMAIL_WARNING] SMTP_USER is not configured in backend/.env. OTP for ${to} is: ${otp}`);
    return { success: false, mode: "DEV_LOG", message: "SMTP credentials not configured in backend/.env" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: `Password Reset OTP Code - ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #dc2626; margin-top: 0; font-size: 22px;">Ignito Experia</h2>
        <p style="color: #334155; font-size: 15px;">Hello <strong>${fullName || to}</strong>,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">You requested a password reset for your account. Please use the following 6-digit OTP code to verify your request:</p>
        <div style="background-color: #f8fafc; border: 1px border #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.4;">This code is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">© Ignito Experia Virtual Labs. All rights reserved.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL_SUCCESS] OTP Email sent successfully to ${to}: MessageID ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL_ERROR] Failed to send OTP email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}
