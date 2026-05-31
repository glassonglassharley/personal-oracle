const nodemailer = require('nodemailer');

function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return null;
}

const FROM = process.env.EMAIL_FROM || '"Vice to Value" <noreply@vicetovalueapp.com>';

async function sendMagicLinkEmail({ to, username, magicUrl, purpose }) {
  const transporter = createTransporter();

  const isReset = purpose === 'reset';
  const subject = isReset
    ? 'Reset your Vice to Value password'
    : 'Sign in to Vice to Value';

  const linkText = isReset ? 'Reset my password' : 'Sign in';
  const expiry = '15 minutes';

  const text = [
    `Hi ${username},`,
    '',
    isReset
      ? `Click the link below to reset your password. It expires in ${expiry}.`
      : `Click the link below to sign in to Vice to Value. It expires in ${expiry}.`,
    '',
    magicUrl,
    '',
    "If you didn't request this, you can safely ignore this email.",
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0a1f17;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#11281f;border-radius:16px;padding:32px;border:1px solid rgba(94,196,138,0.15)">
    <p style="font-size:13px;color:rgba(232,239,224,0.5);letter-spacing:0.12em;text-transform:uppercase;margin:0 0 16px">Vice to Value</p>
    <h1 style="font-size:28px;color:#f4f7ee;margin:0 0 16px;font-weight:400">${isReset ? 'Reset your password' : 'Your sign-in link'}</h1>
    <p style="color:rgba(232,239,224,0.65);font-size:15px;line-height:1.6;margin:0 0 24px">
      Hi <strong style="color:#f4f7ee">${username}</strong>, ${isReset ? 'click below to reset your password' : 'click below to sign in'}. This link expires in ${expiry}.
    </p>
    <a href="${magicUrl}" style="display:inline-block;background:#c8952c;color:#120800;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">${linkText} →</a>
    <p style="color:rgba(232,239,224,0.35);font-size:12px;margin:24px 0 0;line-height:1.5">
      If you didn't request this, ignore this email. The link expires automatically.
    </p>
  </div>
</body>
</html>`;

  if (!transporter) {
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL DEV] Magic URL: ${magicUrl}`);
    return;
  }

  await transporter.sendMail({ from: FROM, to, subject, text, html });
}

module.exports = { sendMagicLinkEmail };
