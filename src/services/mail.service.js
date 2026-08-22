import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter(){
  if(transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

  if(host && user && pass){
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  } else if(user && pass){
    // Gmail shortcut
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }
  return transporter;
}

const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'DO OR DIE <no-reply@doordie.app>';
const RED = '#8f2318';
const EMAIL_STYLE = 'font-family:Georgia,serif;color:#111;line-height:1.6;border:1px solid #171717;padding:24px;max-width:540px;margin:0 auto;background:#fff;';

function wrapHtml(inner){
  return `
    <div style="background:#f4f4f2;padding:24px 12px;">
      <div style="${EMAIL_STYLE}">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#55554f;margin-bottom:18px;border-bottom:1px solid #ececea;padding-bottom:8px;">
          Do or Die - Accountability Ledger
        </div>
        ${inner}
        <div style="margin-top:24px;border-top:1px solid #ececea;padding-top:12px;font-size:10px;color:#9c9c96;text-align:center;letter-spacing:.06em;text-transform:uppercase;">
          No editing the past.
        </div>
      </div>
    </div>
  `;
}

export async function sendMail({ to, subject, html, text }){
  const client = getTransporter();
  if(!client){
    console.log('\n[MAIL SERVICE] (SMTP not configured in .env - logging email)');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', text || html);
    console.log('------------------------------------------------------------\n');
    return { ok: true, simulated: true };
  }

  try {
    const info = await client.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text,
      html
    });
    return { ok: true, messageId: info.messageId };
  } catch(err){
    console.error('[MAIL SERVICE] Send error:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function sendPasswordResetEmail(email, name, resetUrl){
  const html = wrapHtml(`
    <h2 style="font-size:20px;font-weight:600;margin:0 0 10px;color:#111;">Password Reset Request</h2>
    <p style="font-size:14px;color:#444;">Hello <strong>${name || 'there'}</strong>,</p>
    <p style="font-size:13px;color:#444;">We received a request to reset your DO OR DIE account password. Click the button below to choose a new password:</p>
    <div style="text-align:center;margin:26px 0;">
      <a href="${resetUrl}" style="background:#111111;color:#ffffff;text-decoration:none;padding:12px 24px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:bold;display:inline-block;">
        Reset Password
      </a>
    </div>
    <p style="font-size:11px;color:#777;margin-top:20px;">Or copy and paste this URL into your browser:</p>
    <p style="font-size:11px;color:#8f2318;word-break:break-all;">${resetUrl}</p>
    <p style="font-size:11px;color:#999;margin-top:24px;">This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
  `);

  return sendMail({
    to: email,
    subject: 'DO OR DIE - Password Reset Request',
    text: `Reset your DO OR DIE password: ${resetUrl} (expires in 1 hour)`,
    html
  });
}

export async function sendMorningBriefing(email, name, tasks, dateStr){
  let taskTable = '<p style="color:#777;font-style:italic;">No tasks scheduled for today.</p>';
  if(tasks && tasks.length){
    const rows = tasks.map(t => `
      <tr>
        <td style="padding:8px 10px 8px 0;border-top:1px solid #ececea;font-weight:bold;">${t.name}</td>
        <td style="padding:8px 10px;border-top:1px solid #ececea;color:#555;">${t.time_label || t.timeLabel}</td>
        <td style="padding:8px 0;border-top:1px solid #ececea;font-weight:bold;color:${t.importance === 'HIGH' ? RED : '#111'};">${t.importance}</td>
      </tr>
    `).join('');
    taskTable = `<table style="width:100%;border-collapse:collapse;font-size:13px;">${rows}</table>`;
  }

  const html = wrapHtml(`
    <p style="font-size:14px;margin:0 0 14px;"><strong>${name}</strong>, here is what you owe today (${dateStr}):</p>
    ${taskTable}
    <p style="color:${RED};font-style:italic;margin-top:20px;font-size:12px;">"You can improve tomorrow. You cannot rewrite yesterday."</p>
  `);

  return sendMail({
    to: email,
    subject: `DO OR DIE - Your tasks for ${dateStr}`,
    html
  });
}

export async function sendEveningReport(email, name, report, dateStr){
  const { total, completed, pending, pct } = report;
  if(total === 0) return { ok: true, skipped: true };

  let message = '';
  let color = '#111';
  if(completed.length === 0){
    message = '0% completed. You are falling behind. Do not let today slip away.';
    color = RED;
  } else if(pct === 100){
    message = '100% complete. Outstanding discipline. Keep the streak alive.';
  } else {
    message = `${pct}% done. Tasks missed today will be permanently locked at midnight.`;
    color = RED;
  }

  let lists = '';
  if(completed.length){
    lists += `<p style="margin:14px 0 4px;font-weight:bold;font-size:12px;text-transform:uppercase;color:#111;">Completed</p>
              <ul style="margin:0;padding-left:18px;font-size:13px;">${completed.map(t => `<li>${t.name}</li>`).join('')}</ul>`;
  }
  if(pending.length){
    lists += `<p style="margin:14px 0 4px;font-weight:bold;font-size:12px;text-transform:uppercase;color:${RED};">Pending</p>
              <ul style="margin:0;padding-left:18px;font-size:13px;color:${RED};">${pending.map(t => `<li>${t.name}</li>`).join('')}</ul>`;
  }

  const html = wrapHtml(`
    <p style="margin:0 0 8px;font-size:14px;">Evening report for <strong>${dateStr}</strong></p>
    <div style="font-size:32px;font-weight:bold;margin:10px 0;">${completed.length} / ${total} <span style="font-size:18px;font-weight:normal;color:#666;">(${pct}%)</span></div>
    ${lists}
    <p style="font-weight:bold;color:${color};margin-top:20px;font-size:13px;">${message}</p>
  `);

  return sendMail({
    to: email,
    subject: `DO OR DIE - Evening report ${dateStr}`,
    html
  });
}
