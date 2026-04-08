const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data', 'waitlist.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clawcorp2026';

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

// ── Public API ────────────────────────────────────────────

// POST /api/waitlist  — submit email
app.post('/api/waitlist', (req, res) => {
  const { email } = req.body;

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
  console.log(`  Admin Password    →  ${ADMIN_PASSWORD}\n`);
});
