// popup.js — Imageboard Thread Archiver v2

let threadData = null;

const $ = id => document.getElementById(id);

// ─── Board detection ──────────────────────────────────────────────────────────

const BOARDS = [
  {
    id: '4chan',
    label: '4chan',
    color: '#9b2335',
    match: url => /boards\.4chan\.org\/(\w+)\/thread\/(\d+)/.exec(url),
    parseMatch: m => ({ board: m[1], threadId: m[2] }),
    scraper: scrape4chan,
    folderPrefix: '4chan',
  },
  {
    id: '2ch',
    label: '2ch.hk',
    color: '#1a6da8',
    match: url => /2ch\.hk\/(\w+)\/res\/(\d+)\.html/.exec(url),
    parseMatch: m => ({ board: m[1], threadId: m[2] }),
    scraper: scrape2ch,
    folderPrefix: '2ch',
  },
  {
    id: '420chan',
    label: '420chan',
    color: '#4a7c3f',
    match: url => /420chan\.org\/(\w+)\/res\/(\d+)/.exec(url),
    parseMatch: m => ({ board: m[1], threadId: m[2] }),
    scraper: scrape420chan,
    folderPrefix: '420chan',
  },
  {
    id: 'lainchan',
    label: 'Lainchan',
    color: '#6a5acd',
    match: url => /lainchan\.org\/(\w+)\/res\/(\d+)\.html/.exec(url),
    parseMatch: m => ({ board: m[1], threadId: m[2] }),
    scraper: scrapeLainchan,
    folderPrefix: 'lainchan',
  },
  {
    id: 'wizchan',
    label: 'Wizchan',
    color: '#5a3e7a',
    match: url => /wizchan\.org\/(\w+)\/res\/(\d+)\.html/.exec(url),
    parseMatch: m => ({ board: m[1], threadId: m[2] }),
    scraper: scrapeWizchan,
    folderPrefix: 'wizchan',
  },
];

function detectBoard(url) {
  for (const board of BOARDS) {
    const m = board.match(url);
    if (m) return { boardDef: board, ...board.parseMatch(m) };
  }
  return null;
}

// ─── Per-board page scrapers (run inside page context) ────────────────────────

function scrape4chan() {
  const posts = [];
  const board = location.pathname.split('/')[1];
  const threadId = location.pathname.split('/')[3];

  document.querySelectorAll('.postContainer').forEach(pc => {
    const post = {};
    post.id = pc.id.replace('pc', '');
    const subject = pc.querySelector('.subject');
    const name = pc.querySelector('.name');
    if (subject) post.subject = subject.textContent.trim();
    if (name) post.name = name.textContent.trim();
    const time = pc.querySelector('.dateTime');
    if (time) post.time = time.getAttribute('data-utc');
    const comment = pc.querySelector('.postMessage');
    if (comment) post.comment = comment.innerHTML;
    const fileInfo = pc.querySelector('.fileText a, .fileInfo a');
    const videoEl = pc.querySelector('video source, video[src]');
    if (videoEl) {
      const src = videoEl.src || videoEl.getAttribute('src');
      if (src) { post.fileUrl = src.startsWith('//') ? 'https:' + src : src; post.filename = post.fileUrl.split('/').pop().split('?')[0]; post.isVideo = true; }
    } else if (fileInfo) {
      const href = fileInfo.href || fileInfo.getAttribute('href');
      if (href) { post.fileUrl = href.startsWith('//') ? 'https:' + href : href; post.filename = post.fileUrl.split('/').pop().split('?')[0]; const ext = post.filename.split('.').pop().toLowerCase(); post.isVideo = ['webm','mp4','mov'].includes(ext); }
    }
    if (!post.fileUrl) {
      for (const a of Array.from(pc.querySelectorAll('a[href]'))) {
        const href = a.href || '';
        if (/4cdn\.org\/.+\.(webm|mp4|jpg|jpeg|png|gif)(\?|$)/i.test(href)) { post.fileUrl = href; post.filename = href.split('/').pop().split('?')[0]; const ext = post.filename.split('.').pop().toLowerCase(); post.isVideo = ['webm','mp4'].includes(ext); break; }
      }
    }
    posts.push(post);
  });

  return { board, threadId, url: location.href, title: document.title, posts, images: posts.filter(p=>p.fileUrl&&!p.isVideo).map(p=>p.fileUrl), videos: posts.filter(p=>p.fileUrl&&p.isVideo).map(p=>p.fileUrl) };
}

function scrape2ch() {
  const posts = [];
  const parts = location.pathname.split('/');
  const board = parts[1];
  const threadId = parts[3].replace('.html','');

  document.querySelectorAll('.post, article.post').forEach(pc => {
    const post = {};
    const idEl = pc.querySelector('.post-id, [data-num], .postident');
    post.id = idEl ? (idEl.getAttribute('data-num') || idEl.textContent.trim()) : pc.id;
    const nameEl = pc.querySelector('.post-name, .name, .poster-name');
    if (nameEl) post.name = nameEl.textContent.trim();
    const subjectEl = pc.querySelector('.post-subject, .subject');
    if (subjectEl) post.subject = subjectEl.textContent.trim();
    const timeEl = pc.querySelector('time, .datetime, .post-time');
    if (timeEl) post.time = timeEl.getAttribute('datetime') || timeEl.textContent.trim();
    const msgEl = pc.querySelector('.post-message, .postMessage, .message');
    if (msgEl) post.comment = msgEl.innerHTML;
    const fileLink = pc.querySelector('.filesize a, .file-info a, .post-file a');
    const videoEl = pc.querySelector('video source, video[src]');
    if (videoEl) {
      const src = videoEl.src || videoEl.getAttribute('src');
      if (src) { post.fileUrl = src.startsWith('//') ? 'https:' + src : src; post.filename = post.fileUrl.split('/').pop().split('?')[0]; post.isVideo = true; }
    } else if (fileLink) {
      let href = fileLink.href || fileLink.getAttribute('href');
      if (href && href.startsWith('/')) href = 'https://2ch.hk' + href;
      if (href) { post.fileUrl = href; post.filename = post.fileUrl.split('/').pop().split('?')[0]; const ext = post.filename.split('.').pop().toLowerCase(); post.isVideo = ['webm','mp4','mov'].includes(ext); }
    }
    if (!post.fileUrl) {
      for (const a of Array.from(pc.querySelectorAll('a[href]'))) {
        const href = a.href || '';
        if (/\/src\/\d+\.(webm|mp4|jpg|jpeg|png|gif)(\?|$)/i.test(href)) { post.fileUrl = href.startsWith('//') ? 'https:' + href : href; post.filename = post.fileUrl.split('/').pop().split('?')[0]; const ext = post.filename.split('.').pop().toLowerCase(); post.isVideo = ['webm','mp4'].includes(ext); break; }
      }
    }
    posts.push(post);
  });

  return { board, threadId, url: location.href, title: document.title, posts, images: posts.filter(p=>p.fileUrl&&!p.isVideo).map(p=>p.fileUrl), videos: posts.filter(p=>p.fileUrl&&p.isVideo).map(p=>p.fileUrl) };
}

function scrape420chan() {
  const posts = [];
  const parts = location.pathname.split('/');
  const board = parts[1];
  const threadId = parts[3];

  document.querySelectorAll('.post_wrapper, .post, [id^="reply_"], [id^="thread_"]').forEach(pc => {
    const post = {};
    const idMatch = pc.id ? pc.id.match(/\d+/) : null;
    post.id = idMatch ? idMatch[0] : '';
    const nameEl = pc.querySelector('.postername, .name');
    if (nameEl) post.name = nameEl.textContent.trim();
    const subjectEl = pc.querySelector('.filetitle, .subject');
    if (subjectEl) post.subject = subjectEl.textContent.trim();
    const timeEl = pc.querySelector('.posttime, time, .datetime');
    if (timeEl) post.time = timeEl.getAttribute('datetime') || timeEl.textContent.trim();
    const msgEl = pc.querySelector('.message, .postmessage, .post_message');
    if (msgEl) post.comment = msgEl.innerHTML;
    const fileLink = pc.querySelector('.filesize a, .file a, [href*="/src/"]');
    const videoEl = pc.querySelector('video source, video[src]');
    if (videoEl) {
      const src = videoEl.src || videoEl.getAttribute('src');
      if (src) { post.fileUrl = src.startsWith('//') ? 'https:' + src : src; post.filename = post.fileUrl.split('/').pop().split('?')[0]; post.isVideo = true; }
    } else if (fileLink) {
      let href = fileLink.href || fileLink.getAttribute('href');
      if (href && href.startsWith('/')) href = 'https://420chan.org' + href;
      if (href) { post.fileUrl = href; post.filename = post.fileUrl.split('/').pop().split('?')[0]; const ext = post.filename.split('.').pop().toLowerCase(); post.isVideo = ['webm','mp4','mov'].includes(ext); }
    }
    posts.push(post);
  });

  return { board, threadId, url: location.href, title: document.title, posts, images: posts.filter(p=>p.fileUrl&&!p.isVideo).map(p=>p.fileUrl), videos: posts.filter(p=>p.fileUrl&&p.isVideo).map(p=>p.fileUrl) };
}

function scrapeLainchan() {
  const posts = [];
  const parts = location.pathname.split('/');
  const board = parts[1];
  const threadId = parts[3].replace('.html','');

  document.querySelectorAll('.postCell, .innerPost, article[id^="post-"]').forEach(pc => {
    const post = {};
    const idEl = pc.querySelector('.postInfo .linkQuote, [id^="post-"]');
    post.id = idEl ? (idEl.id ? idEl.id.replace('post-','') : idEl.textContent.replace('#','').trim()) : '';
    const nameEl = pc.querySelector('.panelUserName, .name');
    if (nameEl) post.name = nameEl.textContent.trim();
    const subjectEl = pc.querySelector('.labelSubject, .subject');
    if (subjectEl) post.subject = subjectEl.textContent.trim();
    const timeEl = pc.querySelector('time, .labelCreated');
    if (timeEl) post.time = timeEl.getAttribute('datetime') || timeEl.textContent.trim();
    const msgEl = pc.querySelector('.divMessage, .postMessage');
    if (msgEl) post.comment = msgEl.innerHTML;
    const fileLink = pc.querySelector('.uploadCell a[href], .imgLink, .fileThumb');
    const videoEl = pc.querySelector('video source, video[src]');
    if (videoEl) {
      const src = videoEl.src || videoEl.getAttribute('src');
      if (src) { post.fileUrl = src.startsWith('//') ? 'https:' + src : src; post.filename = post.fileUrl.split('/').pop().split('?')[0]; post.isVideo = true; }
    } else if (fileLink) {
      let href = fileLink.href || fileLink.getAttribute('href');
      if (href && href.startsWith('/')) href = 'https://lainchan.org' + href;
      if (href) { post.fileUrl = href; post.filename = post.fileUrl.split('/').pop().split('?')[0]; const ext = post.filename.split('.').pop().toLowerCase(); post.isVideo = ['webm','mp4','mov'].includes(ext); }
    }
    posts.push(post);
  });

  return { board, threadId, url: location.href, title: document.title, posts, images: posts.filter(p=>p.fileUrl&&!p.isVideo).map(p=>p.fileUrl), videos: posts.filter(p=>p.fileUrl&&p.isVideo).map(p=>p.fileUrl) };
}

function scrapeWizchan() {
  const posts = [];
  const parts = location.pathname.split('/');
  const board = parts[1];
  const threadId = parts[3].replace('.html','');

  document.querySelectorAll('.post, .reply').forEach(pc => {
    const post = {};
    const idEl = pc.querySelector('.post_no, [id^="reply_"]');
    post.id = idEl ? (idEl.id ? idEl.id.replace('reply_','') : idEl.textContent.trim()) : pc.id;
    const nameEl = pc.querySelector('.name, .postername');
    if (nameEl) post.name = nameEl.textContent.trim();
    const subjectEl = pc.querySelector('.subject, .filetitle');
    if (subjectEl) post.subject = subjectEl.textContent.trim();
    const timeEl = pc.querySelector('time, .dateTime, .posttime');
    if (timeEl) post.time = timeEl.getAttribute('datetime') || timeEl.textContent.trim();
    const msgEl = pc.querySelector('.body, .post-body, .postMessage');
    if (msgEl) post.comment = msgEl.innerHTML;
    const fileLink = pc.querySelector('.fileinfo a, .filesize a, .file a');
    const videoEl = pc.querySelector('video source, video[src]');
    if (videoEl) {
      const src = videoEl.src || videoEl.getAttribute('src');
      if (src) { post.fileUrl = src.startsWith('//') ? 'https:' + src : src; post.filename = post.fileUrl.split('/').pop().split('?')[0]; post.isVideo = true; }
    } else if (fileLink) {
      let href = fileLink.href || fileLink.getAttribute('href');
      if (href && href.startsWith('/')) href = 'https://wizchan.org' + href;
      if (href) { post.fileUrl = href; post.filename = post.fileUrl.split('/').pop().split('?')[0]; const ext = post.filename.split('.').pop().toLowerCase(); post.isVideo = ['webm','mp4','mov'].includes(ext); }
    }
    posts.push(post);
  });

  return { board, threadId, url: location.href, title: document.title, posts, images: posts.filter(p=>p.fileUrl&&!p.isVideo).map(p=>p.fileUrl), videos: posts.filter(p=>p.fileUrl&&p.isVideo).map(p=>p.fileUrl) };
}

const SCRAPERS = { '4chan': scrape4chan, '2ch': scrape2ch, '420chan': scrape420chan, lainchan: scrapeLainchan, wizchan: scrapeWizchan };

// ─── UI helpers ───────────────────────────────────────────────────────────────

function log(msg, type = '') {
  const logEl = $('log');
  logEl.classList.add('visible');
  const line = document.createElement('div');
  line.className = 'log-line ' + type;
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = `[${time}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text, active = false) {
  $('statusText').textContent = text;
  $('statusDot').className = 'dot' + (active ? ' active' : '');
  const footerEl = $('footerStatus');
  footerEl.className = 'footer-status' + (active ? ' active' : '');
}

function setProgress(pct, text, indeterminate = false) {
  const area = $('progressArea');
  area.classList.add('visible');
  $('progressText').textContent = text;
  $('progressPct').textContent = indeterminate ? '...' : Math.round(pct) + '%';
  const fill = $('progressFill');
  fill.classList.toggle('indeterminate', indeterminate);
  if (!indeterminate) fill.style.width = pct + '%';
}

function hideProgress() {
  $('progressArea').classList.remove('visible');
  $('progressFill').classList.remove('indeterminate');
}

function $$(id) { return document.getElementById(id); }

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Thread fetching ──────────────────────────────────────────────────────────

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchThreadData() {
  const tab = await getCurrentTab();
  if (!tab || !tab.url) return null;
  const detected = detectBoard(tab.url);
  if (!detected) return null;
  const { boardDef } = detected;
  const scraperFn = SCRAPERS[boardDef.id];
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scraperFn });
    const data = results && results[0] ? results[0].result : null;
    if (data) data.boardDef = { id: boardDef.id, label: boardDef.label, color: boardDef.color, folderPrefix: boardDef.folderPrefix };
    return data;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ─── UI update ────────────────────────────────────────────────────────────────

function updateUI(data) {
  if (!data) {
    $('threadInfo').innerHTML = '<span>⚠ NOT ON A SUPPORTED THREAD</span>';
    $('threadInfo').className = 'thread-info no-thread';
    $('statsBar').style.display = 'none';
    return;
  }
  threadData = data;
  if (data.boardDef && data.boardDef.color) document.documentElement.style.setProperty('--accent', data.boardDef.color);
  $('threadInfo').className = 'thread-info';
  $('threadInfo').innerHTML = `<div class="thread-meta"><div class="thread-board">${escapeHtml(data.boardDef ? data.boardDef.label : '')} — /${escapeHtml(data.board)}/ · #${escapeHtml(data.threadId)}</div><div class="thread-title">${escapeHtml(data.title)}</div></div>`;
  $('statsBar').style.display = 'grid';
  $('statPosts').textContent = data.posts.length;
  $('statImages').textContent = data.images.length;
  $('statVideos').textContent = data.videos.length;
  const total = data.images.length + data.videos.length;
  $('mediaBadge').textContent = total;
  $('imagesBadge').textContent = data.images.length;
  $('videosBadge').textContent = data.videos.length;
  $('btnArchiveThread').disabled = false;
  if (total > 0) $('btnDownloadMedia').disabled = false;
  if (data.images.length > 0) $('btnDownloadImages').disabled = false;
  if (data.videos.length > 0) $('btnDownloadVideos').disabled = false;
  setStatus('READY');
  log(`Thread loaded: ${data.boardDef ? data.boardDef.label : '?'} /${data.board}/ #${data.threadId}`, 'ok');
  log(`${data.posts.length} posts · ${data.images.length} images · ${data.videos.length} videos`, 'info');
}

// ─── HTML archive builder ─────────────────────────────────────────────────────

function buildArchiveHtml(data) {
  const accent = (data.boardDef && data.boardDef.color) ? data.boardDef.color : '#9b2335';
  const siteLabel = (data.boardDef && data.boardDef.label) ? data.boardDef.label : 'Archive';
  const postRows = data.posts.map(p => {
    const mediaHtml = p.fileUrl ? (p.isVideo
      ? `<div class="post-media"><a href="${escapeHtml(p.fileUrl)}" target="_blank">🎬 ${escapeHtml(p.filename)}</a></div>`
      : `<div class="post-media"><a href="${escapeHtml(p.fileUrl)}" target="_blank"><img src="${escapeHtml(p.fileUrl)}" loading="lazy" style="max-width:200px;max-height:200px"/></a></div>`
    ) : '';
    const subjectHtml = p.subject ? `<span class="subject">${escapeHtml(p.subject)}</span> ` : '';
    const date = p.time ? (isNaN(p.time) ? p.time : new Date(parseInt(p.time) * 1000).toLocaleString()) : '';
    return `<div class="post" id="p${p.id}"><div class="post-header">${subjectHtml}<span class="name">${escapeHtml(p.name || 'Anonymous')}</span> <span class="date">${escapeHtml(date)}</span> <span class="postid">No.${p.id}</span></div>${mediaHtml}<div class="post-body">${p.comment || ''}</div></div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(siteLabel)} Archive — /${data.board}/ #${data.threadId}</title>
<style>
  body { background: #1a1a1a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; margin: 0; padding: 20px; }
  h1 { color: ${accent}; font-size: 18px; border-bottom: 2px solid ${accent}; padding-bottom: 8px; margin-bottom: 16px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
  .post { background: #222; border: 1px solid #333; border-left: 3px solid ${accent}; margin-bottom: 10px; padding: 10px 12px; }
  .post-header { margin-bottom: 6px; font-size: 11px; }
  .subject { color: #81b4f0; font-weight: bold; }
  .name { color: #789922; font-weight: bold; }
  .date { color: #555; }
  .postid { color: #666; }
  .post-media { margin: 8px 0; }
  .post-media img { border: 1px solid #333; display: block; }
  .post-media a, a { color: #81b4f0; }
  .post-body { line-height: 1.6; }
</style>
</head>
<body>
<h1>${escapeHtml(siteLabel)} — /${data.board}/ Thread #${data.threadId}</h1>
<div class="meta">Archived from: <a href="${data.url}">${escapeHtml(data.url)}</a><br>Archived on: ${new Date().toLocaleString()}<br>Posts: ${data.posts.length} · Images: ${data.images.length} · Videos: ${data.videos.length}</div>
${postRows}
</body>
</html>`;
}

// ─── Archive action ───────────────────────────────────────────────────────────

async function archiveThread() {
  if (!threadData) return;
  setStatus('ARCHIVING...', true);
  setProgress(0, 'Building archive...', true);
  log('Archiving thread HTML...', 'info');
  try {
    const archiveHtml = buildArchiveHtml(threadData);
    const blob = new Blob([archiveHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const prefix = threadData.boardDef ? threadData.boardDef.folderPrefix : 'thread';
    const filename = `${prefix}_${threadData.board}_${threadData.threadId}_${Date.now()}.html`;
    await chrome.downloads.download({ url, filename, saveAs: false });
    log(`Saved: ${filename}`, 'ok');
    setStatus('DONE', false);
    hideProgress();
  } catch (e) {
    log('Error: ' + e.message, 'err');
    setStatus('ERROR');
    hideProgress();
  }
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function waitForDownload(downloadId) {
  return new Promise(resolve => {
    function listener(delta) {
      if (delta.id !== downloadId) return;
      if (delta.state) {
        if (delta.state.current === 'complete') { chrome.downloads.onChanged.removeListener(listener); resolve(true); }
        else if (delta.state.current === 'interrupted') { chrome.downloads.onChanged.removeListener(listener); resolve(false); }
      }
    }
    chrome.downloads.onChanged.addListener(listener);
    setTimeout(() => { chrome.downloads.onChanged.removeListener(listener); resolve(false); }, 5 * 60 * 1000);
  });
}

async function downloadOne(url, filepath, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let downloadId;
    try { downloadId = await chrome.downloads.download({ url, filename: filepath, saveAs: false }); }
    catch (e) { if (attempt === retries) return { ok: false, reason: e.message }; await new Promise(r => setTimeout(r, 800)); continue; }
    const ok = await waitForDownload(downloadId);
    if (ok) return { ok: true };
    const [item] = await chrome.downloads.search({ id: downloadId });
    const reason = item ? item.error : 'unknown';
    if (attempt < retries) { log(`↺ retry ${attempt+1}/${retries}: ${filepath.split('/').pop()} (${reason})`, ''); await new Promise(r => setTimeout(r, 1000*(attempt+1))); }
    else return { ok: false, reason };
  }
}

async function downloadMedia(urls, label) {
  if (!urls || urls.length === 0) return;
  ['btnArchiveThread','btnDownloadMedia','btnDownloadImages','btnDownloadVideos'].forEach(id => $(id).disabled = true);
  setStatus('DOWNLOADING...', true);
  log(`Starting ${urls.length} ${label}...`, 'info');
  let done = 0;
  const failed = [];
  const prefix = threadData.boardDef ? threadData.boardDef.folderPrefix : 'thread';
  const folderName = `${prefix}_${threadData.board}_${threadData.threadId}`;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = url.split('/').pop().split('?')[0];
    setProgress((i / urls.length) * 100, `${label} ${i+1} / ${urls.length}`);
    const result = await downloadOne(url, `${folderName}/${filename}`);
    if (result.ok) { done++; log(`✓ [${done}/${urls.length}] ${filename}`, 'ok'); }
    else { failed.push(filename); log(`✗ ${filename}: ${result.reason}`, 'err'); }
    await new Promise(r => setTimeout(r, 300));
  }
  setProgress(100, 'Complete');
  setTimeout(hideProgress, 1500);
  log(`${done}/${urls.length} downloaded` + (failed.length ? `, ${failed.length} failed` : ''), done === urls.length ? 'ok' : 'err');
  setStatus(failed.length ? 'DONE (errors)' : 'DONE ✓');
  ['btnArchiveThread','btnDownloadMedia','btnDownloadImages','btnDownloadVideos'].forEach(id => $(id).disabled = false);
}

// ─── Wire up buttons ──────────────────────────────────────────────────────────

$('btnArchiveThread').addEventListener('click', archiveThread);
$('btnDownloadMedia').addEventListener('click', () => { if (!threadData) return; downloadMedia([...threadData.images,...threadData.videos],'files'); });
$('btnDownloadImages').addEventListener('click', () => { if (!threadData) return; downloadMedia(threadData.images,'images'); });
$('btnDownloadVideos').addEventListener('click', () => { if (!threadData) return; downloadMedia(threadData.videos,'videos'); });

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  setStatus('SCANNING...');
  setProgress(0, 'Loading thread data...', true);
  const data = await fetchThreadData();
  hideProgress();
  updateUI(data);
  if (!data) { setStatus('NO THREAD'); log('Navigate to a supported imageboard thread and reopen.', 'err'); }
})();
