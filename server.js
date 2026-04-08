const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data', 'waitlist.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clawcorp2026';

const ZEABUR_EMAIL_API_KEY = process.env.ZEABUR_EMAIL_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || '';

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

app.use(express.json());
app.use(express.static(__dirname));

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
    ? '你已加入 ClawCorp 候补名单'
    : 'You\'re on the ClawCorp waitlist';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2F0E9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px 40px">

    <!-- Logo -->
    <div style="text-align:center;padding:40px 0 32px">
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;background:#1A1C1E;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#FFD233;vertical-align:middle">C</div>
        <span style="font-size:20px;font-weight:800;color:#1A1C1E;vertical-align:middle;letter-spacing:-0.3px">ClawCorp</span>
      </div>
    </div>

    <!-- Card -->
    <div style="background:#1A1C1E;border-radius:32px;padding:48px 40px;text-align:center">

      <!-- Badge -->
      <div style="display:inline-block;background:rgba(255,210,51,0.15);border:1px solid rgba(255,210,51,0.25);border-radius:999px;padding:6px 18px;font-size:12px;font-weight:700;color:#FFD233;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:28px">
        ${isZh ? '候补名单' : 'Waitlist'}
      </div>

      <!-- Title -->
      <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.2">
        ${isZh ? '你已成功加入候补名单 🎉' : 'You\'re in. Welcome aboard 🎉'}
      </h1>

      <!-- Subtitle -->
      <p style="margin:0 0 32px;font-size:16px;color:rgba(255,255,255,0.5);line-height:1.7;max-width:360px;margin-left:auto;margin-right:auto">
        ${isZh
          ? '我们正在内测阶段，一旦有名额开放，你将<strong style="color:rgba(255,255,255,0.85)">第一时间</strong>收到通知。'
          : 'We\'re in closed beta. You\'ll be the <strong style="color:rgba(255,255,255,0.85)">first to know</strong> when a spot opens up.'}
      </p>

      <!-- Divider -->
      <div style="width:48px;height:2px;background:rgba(255,255,255,0.08);margin:0 auto 32px"></div>

      <!-- Tagline -->
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.25);line-height:1.6">
        ${isZh
          ? '你只需输入一句话，剩下的交给 <span style="color:#FFD233;font-weight:700">AI 军团</span>。'
          : 'You type one prompt, the <span style="color:#FFD233;font-weight:700">AI Army</span> does the rest.'}
      </p>
    </div>

    <!-- Footer -->
    <p style="text-align:center;margin:24px 0 0;font-size:12px;color:#999">
      ClawCorp &nbsp;·&nbsp; ${isZh ? '全 AI 员工的公司操作系统' : 'The AI-native company OS'}
    </p>

  </div>
</body>
</html>`;

  const text = isZh
    ? `感谢加入 ClawCorp 候补名单！我们将在有名额时第一时间通知你。\n\n你只需输入一句话，剩下的交给 AI 军团。`
    : `Thanks for joining the ClawCorp waitlist! You'll be the first to know when a spot opens.\n\nYou type one prompt, the AI Army does the rest.`;

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

// GET /api/admin/export — download CSV
app.get('/api/admin/export', requireAdmin, (req, res) => {
  const list = readEmails();
  const rows = ['id,email,createdAt,ip'];
  list.forEach(e => {
    rows.push(`${e.id},"${e.email}","${e.createdAt}","${e.ip}"`);
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clawcorp-waitlist-${Date.now()}.csv"`);
  res.send('\uFEFF' + rows.join('\n')); // BOM for Excel
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
