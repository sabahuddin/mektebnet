const fs = require('fs');
const path = require('path');
const https = require('https');

const extracted = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted-content.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync(path.join(__dirname, 'prod-backup-2026-05-04.json'), 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_SLUG = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1];

function findSectionContent(html, sectionId) {
  const patterns = [
    `id="${sectionId}"`,
    `id="${sectionId.toUpperCase()}"`,
    `id="${sectionId.toLowerCase()}"`,
  ];
  
  for (const pat of patterns) {
    const idx = html.indexOf(pat);
    if (idx < 0) continue;
    
    const tagStart = html.lastIndexOf('<div', idx);
    const contentStart = html.indexOf('>', idx) + 1;
    
    let depth = 1, pos = contentStart;
    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
      else { depth--; pos = nextClose + 6; }
    }
    const contentEnd = pos - 6;
    
    return { tagStart, contentStart, contentEnd, found: true, matchedId: pat };
  }
  return { found: false };
}

function replaceSectionContent(html, sectionId, newContent) {
  const section = findSectionContent(html, sectionId);
  if (!section.found) return { html, changed: false, reason: 'section not found: ' + sectionId };
  
  const before = html.substring(0, section.contentStart);
  const after = html.substring(section.contentEnd);
  const newHtml = before + '\n' + newContent + '\n' + after;
  
  return { html: newHtml, changed: true };
}

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'mekteb.net',
      port: 443,
      path: '/api/admin' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    
    const req = https.request(options, res => {
      let responseData = '';
      res.on('data', c => responseData += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseData) });
        } catch(e) {
          resolve({ status: res.statusCode, body: responseData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE UPDATE ===');
  if (SINGLE_SLUG) console.log('Single slug:', SINGLE_SLUG);
  
  const stats = { updated: 0, skipped: 0, errors: 0, noExtracted: 0 };
  const report = [];
  
  for (const [slug, backupData] of Object.entries(backup)) {
    if (SINGLE_SLUG && slug !== SINGLE_SLUG) continue;
    
    const ext = extracted[slug];
    if (!ext) {
      stats.noExtracted++;
      continue;
    }
    
    let html = backupData.contentHtml;
    if (!html || html.length < 50) {
      report.push({ slug, status: 'SKIP', reason: 'no contentHtml in production' });
      stats.skipped++;
      continue;
    }
    
    let ilmihalChanged = false;
    let pitanjaChanged = false;
    
    if (ext.ilmihal_html && ext.ilmihal_chars > 50) {
      const ilmihalIds = ['ilmihal', 'ILMIHAL'];
      for (const id of ilmihalIds) {
        const result = replaceSectionContent(html, id, ext.ilmihal_html);
        if (result.changed) {
          html = result.html;
          ilmihalChanged = true;
          break;
        }
      }
    }
    
    if (ext.pitanja_html && ext.pitanja_chars > 10) {
      const pitanjaIds = ['pitanja', 'PITANJA', 'ponovi'];
      for (const id of pitanjaIds) {
        const result = replaceSectionContent(html, id, ext.pitanja_html);
        if (result.changed) {
          html = result.html;
          pitanjaChanged = true;
          break;
        }
      }
    }
    
    if (!ilmihalChanged && !pitanjaChanged) {
      report.push({ slug, status: 'SKIP', reason: 'no sections changed' });
      stats.skipped++;
      continue;
    }
    
    const changes = [];
    if (ilmihalChanged) changes.push('ilmihal');
    if (pitanjaChanged) changes.push('pitanja');
    
    if (DRY_RUN) {
      report.push({ slug, id: backupData.id, status: 'WOULD-UPDATE', changes, oldLen: backupData.contentHtml.length, newLen: html.length });
      stats.updated++;
    } else {
      try {
        const resp = await apiRequest('PUT', '/ilmihal/' + backupData.id, { contentHtml: html });
        if (resp.status === 200 && resp.body?.success) {
          report.push({ slug, id: backupData.id, status: 'UPDATED', changes, oldLen: backupData.contentHtml.length, newLen: html.length });
          stats.updated++;
        } else {
          report.push({ slug, id: backupData.id, status: 'ERROR', resp: resp.status, body: JSON.stringify(resp.body).substring(0,200) });
          stats.errors++;
        }
      } catch(e) {
        report.push({ slug, id: backupData.id, status: 'ERROR', error: e.message });
        stats.errors++;
      }
    }
  }
  
  console.log('\n=== REPORT ===');
  report.forEach(r => {
    if (r.status === 'WOULD-UPDATE' || r.status === 'UPDATED') {
      console.log(r.status + ' ' + r.slug + ' (id=' + r.id + '): ' + r.changes.join('+') + ' | ' + r.oldLen + ' -> ' + r.newLen);
    } else {
      console.log(r.status + ' ' + r.slug + ': ' + (r.reason || r.error || ''));
    }
  });
  
  console.log('\n=== SUMMARY ===');
  console.log('Updated:', stats.updated);
  console.log('Skipped:', stats.skipped);
  console.log('Errors:', stats.errors);
  console.log('No extracted data:', stats.noExtracted);
}

main().catch(console.error);
