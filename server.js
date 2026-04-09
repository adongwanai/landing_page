const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data', 'waitlist.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clawcorp2026';
const EXPORT_USERNAME = process.env.EXPORT_USERNAME || 'Nolan';
const EXPORT_PASSWORD = process.env.EXPORT_PASSWORD || '';

const ZEABUR_EMAIL_API_KEY = process.env.ZEABUR_EMAIL_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || '';

// Preload QR code as base64 for email embedding
const QR_CODE_PATH = path.join(__dirname, 'assets', 'qrcode.jpg');
const QR_CODE_B64 = fs.existsSync(QR_CODE_PATH)
  ? `data:image/jpeg;base64,${fs.readFileSync(QR_CODE_PATH).toString('base64')}`
  : '';

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

app.use(express.json());
app.use(express.static(__dirname));

// Serve favicon.ico → assets/icon.png
app.get('/favicon.ico', (_req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'icon.png'));
});

// ── Helpers ──────────────────────────────────────────────
function readEmails() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveEmails(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function requireAdmin(req, res, next) {
  const auth = req.headers['x-admin-password'];
  if (auth !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '未授权' });
  }
  next();
}

function requireExportAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const b64 = authHeader.startsWith('Basic ') ? authHeader.slice(6) : '';
  const [user, pass] = Buffer.from(b64, 'base64').toString().split(':');
  if (user === EXPORT_USERNAME && pass === EXPORT_PASSWORD) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="ClawCorp Export"');
  res.status(401).send('Unauthorized');
}

// ── Email ─────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  if (!ZEABUR_EMAIL_API_KEY || !EMAIL_FROM) {
    console.log('[email] skipped — ZEABUR_EMAIL_API_KEY or EMAIL_FROM not set');
    return;
  }
  console.log(`[email] sending to ${to} subject="${subject}"`);
  try {
    const res = await fetch('https://api.zeabur.com/api/v1/zsend/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZEABUR_EMAIL_API_KEY}`,
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });
    const data = await res.json();
    console.log(`[email] response ${res.status}:`, JSON.stringify(data));
  } catch (err) {
    console.error('[email] send failed:', err.message);
  }
}

function buildWelcomeEmail(email, lang) {
  const isZh = lang !== 'en';

  const subject = isZh
    ? '你已加入 ClawCorp 候补名单 ✦'
    : 'You\'re on the ClawCorp waitlist ✦';

  const html = `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${isZh ? 'ClawCorp 候补确认' : 'ClawCorp Waitlist Confirmation'}</title>
</head>
<body style="margin:0;padding:0;background:#F2F0E9;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0E9;padding:48px 0 64px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">

  <!-- Logo row -->
  <tr><td style="padding:0 24px 36px;text-align:center">
    <table cellpadding="0" cellspacing="0" style="display:inline-table">
      <tr>
        <td style="width:36px;height:36px;background:#1A1C1E;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;font-weight:800;color:#FFD233;letter-spacing:-0.3px">C</td>
        <td style="padding-left:10px;font-size:18px;font-weight:800;color:#1A1C1E;letter-spacing:-0.3px;vertical-align:middle">ClawCorp</td>
      </tr>
    </table>
  </td></tr>

  <!-- Main card -->
  <tr><td style="padding:0 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1C1E;border-radius:28px;overflow:hidden">

    <!-- Top accent bar -->
    <tr><td style="height:3px;background:linear-gradient(90deg,#FFD233,#FF6B4A)"></td></tr>

    <!-- Card body -->
    <tr><td style="padding:48px 40px 40px;text-align:center">

      <!-- Badge -->
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">
        <tr><td style="background:rgba(255,210,51,0.12);border:1px solid rgba(255,210,51,0.22);border-radius:999px;padding:5px 16px;font-size:11px;font-weight:700;color:#FFD233;letter-spacing:0.1em;text-transform:uppercase">
          ${isZh ? '✦ &nbsp;已确认' : '✦ &nbsp;Confirmed'}
        </td></tr>
      </table>

      <!-- Headline -->
      <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.25">
        ${isZh ? '你已加入候补名单' : 'You\'re on the list'}
      </h1>

      <!-- Body -->
      <p style="margin:0 0 36px;font-size:15px;color:rgba(255,255,255,0.48);line-height:1.8;max-width:340px;margin-left:auto;margin-right:auto">
        ${isZh
          ? '我们正在内测阶段。一旦有名额开放，<span style="color:rgba(255,255,255,0.85);font-weight:600">你将第一个收到通知</span>。感谢你的关注与耐心等待。'
          : 'We\'re currently in closed beta. <span style="color:rgba(255,255,255,0.85);font-weight:600">You\'ll be the first to know</span> when a spot opens. Thanks for your patience.'}
      </p>

      <!-- Divider -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
        <tr>
          <td style="border-top:1px solid rgba(255,255,255,0.06)"></td>
        </tr>
      </table>

      <!-- Tagline -->
      <p style="margin:0 0 36px;font-size:13px;color:rgba(255,255,255,0.22);line-height:1.7;font-style:italic">
        ${isZh
          ? '"你只需输入一句话，剩下的交给 <span style="color:#FFD233;font-style:normal;font-weight:700">AI 军团</span>。"'
          : '"You type one prompt, the <span style="color:#FFD233;font-style:normal;font-weight:700">AI Army</span> does the rest."'}
      </p>

      ${QR_CODE_B64 ? `
      <!-- Divider -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
        <tr><td style="border-top:1px solid rgba(255,255,255,0.06)"></td></tr>
      </table>

      <!-- QR Code -->
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.08em;text-transform:uppercase">
        ${isZh ? '扫码加入内测群' : 'Join the Beta Group'}
      </p>
      <img src="${QR_CODE_B64}"
        alt="${isZh ? '微信内测群二维码' : 'WeChat Beta Group QR'}"
        style="max-width:220px;width:100%;height:auto;border-radius:12px;border:2px solid rgba(255,255,255,0.08);background:#fff;display:block;margin:0 auto 12px">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2)">
        ${isZh ? '微信扫码 · 有效期至 4/16' : 'WeChat scan · Valid until Apr 16'}
      </p>
      ` : ''}

    </td></tr>
  </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:28px 24px 0;text-align:center">
    <p style="margin:0 0 6px;font-size:12px;color:#aaa">
      ClawCorp &nbsp;·&nbsp; ${isZh ? '全 AI 员工的公司操作系统' : 'The AI-native company OS'}
    </p>
    <p style="margin:0;font-size:11px;color:#bbb">
      ${isZh
        ? `此邮件发送至 ${email}，因为你在 clawcorp.top 提交了候补申请。`
        : `This email was sent to ${email} because you signed up at clawcorp.top.`}
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = isZh
    ? `你已加入 ClawCorp 候补名单\n\n我们正在内测阶段，一旦有名额开放，你将第一个收到通知。\n\n"你只需输入一句话，剩下的交给 AI 军团。"\n\n— ClawCorp 团队\nclawcorp.top`
    : `You're on the ClawCorp waitlist\n\nWe're in closed beta. You'll be the first to know when a spot opens.\n\n"You type one prompt, the AI Army does the rest."\n\n— The ClawCorp Team\nclawcorp.top`;

  return { subject, html, text };
}

async function sendWelcomeEmail(email, lang) {
  const { subject, html, text } = buildWelcomeEmail(email, lang);
  await sendEmail({ to: email, subject, html, text });
}

async function sendAdminNotification(email) {
  if (!ADMIN_NOTIFY_EMAIL) return;
  await sendEmail({
    to: ADMIN_NOTIFY_EMAIL,
    subject: `[ClawCorp] 新候补报名：${email}`,
    html: `
      <div style="font-family:sans-serif;padding:24px;background:#f5f5f5;border-radius:12px;max-width:400px">
        <div style="font-size:13px;font-weight:700;color:#999;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px">ClawCorp · Waitlist</div>
        <div style="font-size:18px;font-weight:700;color:#1A1C1E;margin-bottom:4px">${email}</div>
        <div style="font-size:13px;color:#999">${new Date().toISOString()}</div>
      </div>`,
    text: `新候补报名：${email}`,
  });
}

// ── Public API ────────────────────────────────────────────

// POST /api/waitlist  — submit email
app.post('/api/waitlist', async (req, res) => {
  const { email, lang } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: '请输入有效邮箱' });
  }

  const list = readEmails();
  const exists = list.some(e => e.email === email.toLowerCase().trim());
  if (exists) {
    return res.json({ ok: true, message: '已在候补名单中' });
  }

  list.push({
    id: Date.now(),
    email: email.toLowerCase().trim(),
    createdAt: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
  });

  saveEmails(list);

  // Send emails asynchronously (don't block the response)
  sendWelcomeEmail(email.toLowerCase().trim(), lang).catch(() => {});
  sendAdminNotification(email.toLowerCase().trim()).catch(() => {});

  res.json({ ok: true, message: '成功加入候补名单' });
});

// ── Admin API (password protected) ───────────────────────

// GET /api/admin/list — paginated list
app.get('/api/admin/list', requireAdmin, (req, res) => {
  const list = readEmails();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const start = (page - 1) * limit;

  res.json({
    total: list.length,
    page,
    limit,
    data: list.slice(start, start + limit).reverse(),
  });
});

// GET /api/admin/export — download CSV (x-admin-password header, for admin.html)
app.get('/api/admin/export', requireAdmin, (_req, res) => {
  const list = readEmails();
  const rows = ['id,email,createdAt,ip'];
  list.forEach(e => {
    rows.push(`${e.id},"${e.email}","${e.createdAt}","${e.ip}"`);
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clawcorp-waitlist-${Date.now()}.csv"`);
  res.send('\uFEFF' + rows.join('\n'));
});

// GET /export — browser-friendly CSV download with HTTP Basic Auth
app.get('/export', requireExportAuth, (_req, res) => {
  const list = readEmails();
  const rows = ['id,email,createdAt,ip'];
  list.forEach(e => {
    rows.push(`${e.id},"${e.email}","${e.createdAt}","${e.ip}"`);
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clawcorp-waitlist-${Date.now()}.csv"`);
  res.send('\uFEFF' + rows.join('\n'));
});

// DELETE /api/admin/delete/:id — remove one entry
app.delete('/api/admin/delete/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  let list = readEmails();
  const before = list.length;
  list = list.filter(e => e.id !== id);
  if (list.length === before) return res.status(404).json({ error: '未找到' });
  saveEmails(list);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  Clawcorp Landing  →  http://localhost:${PORT}`);
  console.log(`  Admin Panel       →  http://localhost:${PORT}/admin.html`);
  console.log(`  Admin Password    →  ${ADMIN_PASSWORD}`);
  console.log(`  Email enabled     →  ${ZEABUR_EMAIL_API_KEY ? 'YES' : 'NO (set ZEABUR_EMAIL_API_KEY)'}\n`);
});
