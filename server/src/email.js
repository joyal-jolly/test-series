/**
 * Email Service supporting Resend and Brevo (Sendinblue)
 * Built with native fetch for Cloudflare Workers & Node.js compatibility.
 */

function parseFromAddress(fromStr = '') {
  const defaultName = 'Mentaura CA';
  const defaultEmail = 'onboarding@resend.dev';

  if (!fromStr) {
    return { name: defaultName, email: defaultEmail };
  }

  // Format: "Name <email@example.com>" or "email@example.com"
  const match = fromStr.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].trim() || defaultName,
      email: match[2].trim(),
    };
  }

  return { name: defaultName, email: fromStr.trim() };
}

function getEmailTemplate({ otp, recipientEmail }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Mentaura CA Verification Code</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f6f8; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="500" border="0" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">MENTAURA CA</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">Assessment &amp; Evaluation Portal</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="color: #1e293b; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">Verify Your Email Address</h2>
              <p style="color: #475569; font-size: 14px; line-height: 22px; margin: 0 0 24px 0;">
                Thank you for registering with Mentaura CA. Please use the verification code below to complete your student account creation for <strong>${recipientEmail}</strong>.
              </p>

              <!-- OTP Code Display -->
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 700; letter-spacing: 12px; color: #0284c7; display: inline-block; padding-left: 12px;">
                  ${otp}
                </span>
                <p style="color: #64748b; font-size: 12px; margin: 10px 0 0 0;">Valid for <strong>10 minutes</strong></p>
              </div>

              <p style="color: #64748b; font-size: 13px; line-height: 20px; margin: 0 0 8px 0;">
                If you did not request this verification code, please disregard this email.
              </p>
              <p style="color: #dc2626; font-size: 12px; line-height: 18px; margin: 0;">
                &#9888; For security reasons, never share this OTP with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 20px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} Mentaura CA Residential Campus, Vazhakulam, Ernakulam.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Resolves configuration values checking process.env and Cloudflare Workers env.
 * In local Node.js, reloads dotenv if keys are not currently in memory.
 */
async function getEmailConfig() {
  // If in Node.js and keys aren't in memory yet, reload .env
  if (typeof process !== 'undefined' && process.env) {
    if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY) {
      try {
        const { default: dotenv } = await import('dotenv');
        dotenv.config({ path: './server/.env' });
        dotenv.config({ path: '../server/.env' });
        dotenv.config({ path: '.env' });
      } catch {}
    }
  }

  let cfEnv = {};
  try {
    const cw = await import('cloudflare:workers');
    cfEnv = cw.env || {};
  } catch {}

  const resendKey = (process.env.RESEND_API_KEY || cfEnv.RESEND_API_KEY)?.trim();
  const brevoKey = (
    process.env.BREVO_API_KEY ||
    process.env.BRAVO_API_KEY ||
    cfEnv.BREVO_API_KEY ||
    cfEnv.BRAVO_API_KEY
  )?.trim();
  const rawFrom =
    (process.env.EMAIL_FROM || cfEnv.EMAIL_FROM)?.trim() ||
    'Mentaura CA <onboarding@resend.dev>';

  return { resendKey, brevoKey, rawFrom };
}

/**
 * Sends a 4-digit OTP email using Resend or Brevo based on available API keys.
 * If no key is configured in dev, logs the code gracefully.
 */
export async function sendOtpEmail({ email, otp }) {
  const { resendKey, brevoKey, rawFrom } = await getEmailConfig();
  const subject = `${otp} is your Mentaura CA verification code`;
  const html = getEmailTemplate({ otp, recipientEmail: email });

  // 1. Resend
  if (resendKey) {
    let res;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: rawFrom,
          to: [email],
          subject,
          html,
        }),
      });
    } catch (fetchErr) {
      console.error('[Resend Network Error]:', fetchErr);
      throw new Error(`Unable to connect to Resend email service: ${fetchErr.message}`);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errMsg = data.message || `Resend request failed (${res.status})`;
      if (res.status === 403 && errMsg.toLowerCase().includes('testing emails')) {
        errMsg =
          'Resend is in test mode and can only deliver to your verified Resend account email. Please verify your custom domain in Resend Dashboard (resend.com/domains) or test using your Resend account email.';
      }
      console.error('[Email/Resend Error]', errMsg);
      throw new Error(errMsg);
    }
    console.log(`[Email/Resend] Sent OTP to ${email} (ID: ${data.id})`);
    return { provider: 'resend', id: data.id };
  }

  // 2. Brevo (Sendinblue)
  if (brevoKey) {
    if (brevoKey.startsWith('xsmtpsib-')) {
      const hint =
        'Your Brevo key starts with "xsmtpsib-", which is an SMTP password, not a REST API key. In your Brevo dashboard, go to "SMTP & API" -> click the "API Keys" tab (not the SMTP tab) -> click "Generate a new API key" (it starts with "xkeysib-").';
      console.error('[Brevo Key Error]:', hint);
      throw new Error(hint);
    }

    const sender = parseFromAddress(rawFrom);
    let res;
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email }],
          subject,
          htmlContent: html,
        }),
      });
    } catch (fetchErr) {
      console.error('[Brevo Network Error]:', fetchErr);
      throw new Error(`Unable to connect to Brevo email service: ${fetchErr.message}`);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errMsg = data.message || `Brevo request failed (${res.status})`;
      if (errMsg.toLowerCase().includes('sender email is not valid')) {
        errMsg =
          `Brevo rejected sender "${sender.email}". Make sure "${sender.email}" is added as an authorized Sender in Brevo Dashboard (Senders & IP -> Senders).`;
      }
      console.error('[Email/Brevo Error]', errMsg);
      throw new Error(errMsg);
    }
    console.log(`[Email/Brevo] Sent OTP to ${email} (MessageID: ${data.messageId})`);
    return { provider: 'brevo', messageId: data.messageId };
  }

  // 3. Fallback when neither key is provided
  console.log('\n======================================================');
  console.log(`[EMAIL NOTICE] ✉️  Verification OTP for ${email}:`);
  console.log(`>>>  ${otp}  <<< (valid for 10 minutes)`);
  console.log('Set RESEND_API_KEY or BREVO_API_KEY in server/.env to send real emails.');
  console.log('======================================================\n');

  return { provider: 'dev-console', simulated: true, otp };
}

/**
 * Sends a generic HTML email via Resend or Brevo.
 */
export async function sendEmail({ to, subject, html, replyTo, toName }) {
  const { resendKey, brevoKey, rawFrom } = await getEmailConfig();

  // 1. Resend
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: rawFrom,
          to: Array.isArray(to) ? to : [to],
          reply_to: replyTo || undefined,
          subject,
          html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Resend failed with status ${res.status}`);
      }
      return { provider: 'resend', id: data.id };
    } catch (err) {
      console.error('[sendEmail/Resend Error]:', err.message);
      throw err;
    }
  }

  // 2. Brevo
  if (brevoKey) {
    const sender = parseFromAddress(rawFrom);
    const toList = Array.isArray(to)
      ? to.map((e) => ({ email: e }))
      : [{ email: to, name: toName || undefined }];

    try {
      const payload = {
        sender,
        to: toList,
        subject,
        htmlContent: html,
      };
      if (replyTo) {
        payload.replyTo = { email: replyTo };
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Brevo failed with status ${res.status}`);
      }
      return { provider: 'brevo', messageId: data.messageId };
    } catch (err) {
      console.error('[sendEmail/Brevo Error]:', err.message);
      throw err;
    }
  }

  // 3. Fallback dev console
  console.log('\n======================================================');
  console.log(`[EMAIL NOTICE] ✉️  To: ${to} | Subject: ${subject}`);
  console.log('Set RESEND_API_KEY or BREVO_API_KEY in server/.env to send real emails.');
  console.log('======================================================\n');
  return { provider: 'dev-console', simulated: true };
}

/**
 * Send contact form submission email to Admin and acknowledgment to User.
 */
export async function sendContactEmails({ name, email, subject, message }) {
  const adminEmail = process.env.CONTACT_RECEIVER_EMAIL || process.env.ADMIN_EMAIL || 'mentauraca.testseries@gmail.com';
  const cleanSubject = subject?.trim() || 'General Enquiry';

  // 1. Notification to Campus Admin
  const adminHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; padding: 20px 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 18px;">New Contact &amp; Admission Enquiry</h2>
      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Mentaura CA Assessment Portal</p>
    </div>
    <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 100px; font-weight: 600;">From:</td>
          <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #2563eb;">${escapeHtml(email)}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Subject:</td>
          <td style="padding: 8px 0; color: #0f172a;">${escapeHtml(cleanSubject)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Time:</td>
          <td style="padding: 8px 0; color: #64748b;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
        </tr>
      </table>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <strong style="display: block; margin-bottom: 8px; color: #334155;">Message:</strong>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; color: #0f172a; border-left: 4px solid #3b82f6;">${escapeHtml(message)}</div>
      </div>
      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
        💡 You can reply directly to this email to respond to <strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}).
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // 2. Acknowledgment to Sender
  const userHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; padding: 22px 26px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 18px;">Thank You for Contacting Mentaura CA</h2>
      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Residential CA Campus &middot; Vazhakulam, Ernakulam</p>
    </div>
    <div style="padding: 24px 26px; color: #1e293b; font-size: 14px; line-height: 1.65;">
      <p style="margin-top: 0;">Dear <strong>${escapeHtml(name)}</strong>,</p>
      <p>
        Thank you for reaching out to us regarding <strong>${escapeHtml(cleanSubject)}</strong>. We have successfully received your enquiry.
      </p>
      <p>
        Our campus admissions and academic team is reviewing your message and will respond to you shortly at <strong>${escapeHtml(email)}</strong>.
      </p>
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 14px 18px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #475569;">
        <strong style="color: #1e293b; display: block; margin-bottom: 4px;">Summary of your message:</strong>
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
      </div>
      <p style="font-size: 13px; color: #64748b;">
        If you have urgent questions, feel free to call or WhatsApp us directly at <a href="tel:+916282955052" style="color: #2563eb; font-weight: 600;">+91 6282955052</a>.
      </p>
      <p style="margin-bottom: 0; margin-top: 24px; color: #334155; font-size: 13px;">
        Warm regards,<br>
        <strong>Mentaura CA Academic Office</strong><br>
        Kadalikadu P.O., Vazhakulam, Ernakulam, Kerala
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Helper escape
  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Attempt to deliver notification to Admin (with reply-to as sender)
  let adminRes = null;
  try {
    adminRes = await sendEmail({
      to: adminEmail,
      subject: `New Enquiry from ${name}: ${cleanSubject}`,
      html: adminHtml,
      replyTo: email,
    });
  } catch (err) {
    console.error('[sendContactEmails - Admin Error]:', err.message);
  }

  // Attempt to deliver confirmation to User
  let userRes = null;
  try {
    userRes = await sendEmail({
      to: email,
      toName: name,
      subject: `Enquiry Received: ${cleanSubject} — Mentaura CA`,
      html: userHtml,
    });
  } catch (err) {
    console.error('[sendContactEmails - User Acknowledgment Error]:', err.message);
  }

  return { adminRes, userRes };
}
