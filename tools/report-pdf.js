/* Bhojpurify · 23B2509 — render REPORT.md to REPORT.pdf with the installed Edge/Chrome. Usage: node tools/report-pdf.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');

const root = path.join(__dirname, '..');
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const md = fs.readFileSync(path.join(root, 'REPORT.md'), 'utf8');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bhojpurify — Report — 23B2509</title>
<style>
  body { font-family: "Segoe UI", "Nirmala UI", "Noto Sans Devanagari", sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1f2933; }
  h1 { color: #0f766e; font-size: 20pt; margin: 0 0 4px; } h2 { color: #0f766e; border-bottom: 2px solid #d6f0ec; padding-bottom: 3px; margin-top: 18px; page-break-after: avoid; }
  h3 { margin: 12px 0 4px; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; page-break-inside: auto; } tr { page-break-inside: avoid; }
  th, td { border: 1px solid #e4ddd0; padding: 4px 6px; vertical-align: top; text-align: left; } th { background: #f3efe6; }
  code, pre { font-family: Consolas, monospace; font-size: 9pt; } pre { background: #f6f8fa; padding: 8px; border-radius: 6px; white-space: pre-wrap; }
  blockquote { border-left: 4px solid #b45309; margin: 6px 0; padding: 4px 10px; background: #fffbeb; }
  img { border: 1px solid #e4ddd0; border-radius: 6px; } p:has(img) { page-break-inside: avoid; }
  hr { border: 0; border-top: 1px solid #e4ddd0; }
</style></head><body>${marked.parse(md)}</body></html>`;
const tmp = path.join(root, 'REPORT.html');
fs.writeFileSync(tmp, html);
(async () => {
  const browser = await puppeteer.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();
  await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.pdf({ path: path.join(root, 'REPORT.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#666">Bhojpurify · ET617 · 23B2509 · page <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
  await browser.close();
  fs.unlinkSync(tmp);
  console.log('REPORT.pdf written');
})().catch(e => { console.error(e); process.exit(1); });
