// popup.js

let threadData = null;

const $ = id => document.getElementById(id);

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

function setButtonsDisabled(disabled) {
  ['btnArchiveThread', 'btnDownloadMedia', 'btnDownloadImages', 'btnDownloadVideos']
    .forEach(id => $$(id) && ($$(id).disabled = disabled));
}

function $$(id) { return document.getElementById(id); }

// Get current active tab info
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Inject content script and get thread data
async function fetchThreadData() {
  const tab = await getCurrentTab();
  if (!tab || !tab.url) return null;

  const match = tab.url.match(/boards\.4chan\.org\/(\w+)\/thread\/(\d+)/);
  if (!match) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Run in page context to scrape thread data
        const posts = [];
        const board = location.pathname.split('/')[1];
        const threadId = location.pathname.split('/')[3];

        document.querySelectorAll('.postContainer').forEach(pc => {
          const post = {};
          post.id = pc.id.replace('pc', '');

          // Subject / name
          const subject = pc.querySelector('.subject');
          const name = pc.querySelector('.name');
          if (subject) post.subject = subject.textContent.trim();
          if (name) post.name = name.textContent.trim();

          // Timestamp
          const time = pc.querySelector('.dateTime');
          if (time) post.time = time.getAttribute('data-utc');

          // Comment text
          const comment = pc.querySelector('.postMessage');
          if (comment) post.comment = comment.innerHTML;

          // File/media — check .fileInfo first (has the real full-res link for ALL types)
          // .fileThumb only exists for images, not webm/mp4
          const fileInfo = pc.querySelector('.fileText a, .fileInfo a');
          const videoEl = pc.querySelector('video source, video[src]');

          if (videoEl) {
            // Inline video element (4chan renders webm/mp4 as <video>)
            const src = videoEl.src || videoEl.getAttribute('src');
            if (src) {
              post.fileUrl = src.startsWith('//') ? 'https:' + src : src;
              post.filename = post.fileUrl.split('/').pop().split('?')[0];
              post.isVideo = true;
            }
          } else if (fileInfo) {
            const href = fileInfo.href || fileInfo.getAttribute('href');
            if (href) {
              post.fileUrl = href.startsWith('//') ? 'https:' + href : href;
              post.filename = post.fileUrl.split('/').pop().split('?')[0];
              const ext = post.filename.split('.').pop().toLowerCase();
              post.isVideo = ['webm', 'mp4', 'mov'].includes(ext);
            }
          }

          // Fallback: scan all links in the post for cdn media
          if (!post.fileUrl) {
            const allLinks = Array.from(pc.querySelectorAll('a[href]'));
            for (const a of allLinks) {
              const href = a.href || '';
              if (/4cdn\.org\/.+\.(webm|mp4|jpg|jpeg|png|gif)(\?|$)/i.test(href)) {
                post.fileUrl = href;
                post.filename = href.split('/').pop().split('?')[0];
                const ext = post.filename.split('.').pop().toLowerCase();
                post.isVideo = ['webm', 'mp4'].includes(ext);
                break;
              }
            }
          }

          posts.push(post);
        });

        const images = posts.filter(p => p.fileUrl && !p.isVideo).map(p => p.fileUrl);
        const videos = posts.filter(p => p.fileUrl && p.isVideo).map(p => p.fileUrl);

        return {
          board,
          threadId,
          url: location.href,
          title: document.title,
          posts,
          images,
          videos,
          html: document.documentElement.outerHTML
        };
      }
    });

    return results && results[0] ? results[0].result : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Update the UI with thread data
function updateUI(data) {
  if (!data) {
    $('threadInfo').innerHTML = '<span>⚠ NOT ON A 4CHAN THREAD</span>';
    $('threadInfo').className = 'thread-info no-thread';
    $('statsBar').style.display = 'none';
    return;
  }

  threadData = data;

  $('threadInfo').className = 'thread-info';
  $('threadInfo').innerHTML = `
    <div class="thread-meta">
      <div class="thread-board">/${data.board}/ · #${data.threadId}</div>
      <div class="thread-title">${escapeHtml(data.title)}</div>
    </div>
  `;

  $('statsBar').style.display = 'grid';
  $('statPosts').textContent = data.posts.length;
  $('statImages').textContent = data.images.length;
  $('statVideos').textContent = data.videos.length;

  const total = data.images.length + data.videos.length;
  $('mediaBadge').textContent = total;
  $('imagesBadge').textContent = data.images.length;
  $('videosBadge').textContent = data.videos.length;

  // Enable buttons
  $('btnArchiveThread').disabled = false;
  if (total > 0) $('btnDownloadMedia').disabled = false;
  if (data.images.length > 0) $('btnDownloadImages').disabled = false;
  if (data.videos.length > 0) $('btnDownloadVideos').disabled = false;

  setStatus('READY');
  log(`Thread loaded: /${data.board}/ #${data.threadId}`, 'ok');
  log(`${data.posts.length} posts · ${data.images.length} images · ${data.videos.length} videos`, 'info');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Archive thread as standalone HTML
async function archiveThread() {
  if (!threadData) return;
  setStatus('ARCHIVING...', true);
  setProgress(0, 'Building archive...', true);
  log('Archiving thread HTML...', 'info');

  try {
    // Build self-contained HTML archive
    const archiveHtml = buildArchiveHtml(threadData);
    const blob = new Blob([archiveHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const filename = `4chan_${threadData.board}_${threadData.threadId}_${Date.now()}.html`;

    await chrome.downloads.download({
      url,
      filename,
      saveAs: false
    });

    log(`Saved: ${filename}`, 'ok');
    setStatus('DONE', false);
    hideProgress();
  } catch (e) {
    log('Error: ' + e.message, 'err');
    setStatus('ERROR');
    hideProgress();
  }
}

function buildArchiveHtml(data) {
  const postRows = data.posts.map(p => {
    const mediaHtml = p.fileUrl ? (p.isVideo
      ? `<div class="post-media"><a href="${escapeHtml(p.fileUrl)}" target="_blank">🎬 ${escapeHtml(p.filename)}</a></div>`
      : `<div class="post-media"><a href="${escapeHtml(p.fileUrl)}" target="_blank"><img src="${escapeHtml(p.fileUrl)}" loading="lazy" style="max-width:200px;max-height:200px"/></a></div>`
    ) : '';

    const subjectHtml = p.subject ? `<span class="subject">${escapeHtml(p.subject)}</span> ` : '';
    const date = p.time ? new Date(parseInt(p.time) * 1000).toLocaleString() : '';

    return `<div class="post" id="p${p.id}">
      <div class="post-header">${subjectHtml}<span class="name">${escapeHtml(p.name || 'Anonymous')}</span> <span class="date">${date}</span> <span class="postid">No.${p.id}</span></div>
      ${mediaHtml}
      <div class="post-body">${p.comment || ''}</div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>4chan Archive — /${data.board}/ #${data.threadId}</title>
<style>
  body { background: #1a1a1a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; margin: 0; padding: 20px; }
  h1 { color: #d42b43; font-size: 18px; border-bottom: 2px solid #d42b43; padding-bottom: 8px; margin-bottom: 16px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
  .post { background: #222; border: 1px solid #333; border-left: 3px solid #9b2335; margin-bottom: 10px; padding: 10px 12px; }
  .post-header { margin-bottom: 6px; font-size: 11px; }
  .subject { color: #81b4f0; font-weight: bold; }
  .name { color: #789922; font-weight: bold; }
  .date { color: #555; }
  .postid { color: #666; }
  .post-media { margin: 8px 0; }
  .post-media img { border: 1px solid #333; display: block; }
  .post-media a { color: #81b4f0; }
  .post-body { line-height: 1.6; }
  .post-body a { color: #81b4f0; }
  .greentext { color: #789922; }
  a { color: #81b4f0; }
</style>
</head>
<body>
<h1>/${data.board}/ — Thread #${data.threadId}</h1>
<div class="meta">
  Archived from: <a href="${data.url}">${data.url}</a><br>
  Archived on: ${new Date().toLocaleString()}<br>
  Posts: ${data.posts.length} · Images: ${data.images.length} · Videos: ${data.videos.length}
</div>
${postRows}
</body>
</html>`;
}

// Wait for a download ID to reach a terminal state (complete or interrupted).
function waitForDownload(downloadId) {
  return new Promise((resolve) => {
    function listener(delta) {
      if (delta.id !== downloadId) return;
      if (delta.state) {
        if (delta.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(listener);
          resolve(true);
        } else if (delta.state.current === 'interrupted') {
          chrome.downloads.onChanged.removeListener(listener);
          resolve(false);
        }
      }
    }
    chrome.downloads.onChanged.addListener(listener);
    // 5 min safety timeout per file (large webms)
    setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      resolve(false);
    }, 5 * 60 * 1000);
  });
}

// Download one file with up to `retries` retry attempts
async function downloadOne(url, filepath, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let downloadId;
    try {
      downloadId = await chrome.downloads.download({ url, filename: filepath, saveAs: false });
    } catch (e) {
      if (attempt === retries) return { ok: false, reason: e.message };
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    const ok = await waitForDownload(downloadId);
    if (ok) return { ok: true };

    const [item] = await chrome.downloads.search({ id: downloadId });
    const reason = item ? item.error : 'unknown';
    if (attempt < retries) {
      log(`↺ retry ${attempt + 1}/${retries}: ${filepath.split('/').pop()} (${reason})`, '');
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    } else {
      return { ok: false, reason };
    }
  }
}

// Download media files — fully sequential, waits for each to finish before starting next
async function downloadMedia(urls, label) {
  if (!urls || urls.length === 0) return;

  ['btnArchiveThread','btnDownloadMedia','btnDownloadImages','btnDownloadVideos']
    .forEach(id => $(id).disabled = true);

  setStatus('DOWNLOADING...', true);
  log(`Starting ${urls.length} ${label}...`, 'info');

  let done = 0;
  const failed = [];
  const folderName = `4chan_${threadData.board}_${threadData.threadId}`;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = url.split('/').pop().split('?')[0];
    setProgress((i / urls.length) * 100, `${label} ${i + 1} / ${urls.length}`);

    const result = await downloadOne(url, `${folderName}/${filename}`);
    if (result.ok) {
      done++;
      log(`✓ [${done}/${urls.length}] ${filename}`, 'ok');
    } else {
      failed.push(filename);
      log(`✗ ${filename}: ${result.reason}`, 'err');
    }

    await new Promise(r => setTimeout(r, 300));
  }

  setProgress(100, 'Complete');
  setTimeout(hideProgress, 1500);
  log(`${done}/${urls.length} downloaded` + (failed.length ? `, ${failed.length} failed` : ''), done === urls.length ? 'ok' : 'err');
  setStatus(failed.length ? 'DONE (errors)' : 'DONE ✓');

  ['btnArchiveThread','btnDownloadMedia','btnDownloadImages','btnDownloadVideos']
    .forEach(id => $(id).disabled = false);
}

// Wire up buttons
$('btnArchiveThread').addEventListener('click', archiveThread);

$('btnDownloadMedia').addEventListener('click', () => {
  if (!threadData) return;
  const all = [...threadData.images, ...threadData.videos];
  downloadMedia(all, 'files');
});

$('btnDownloadImages').addEventListener('click', () => {
  if (!threadData) return;
  downloadMedia(threadData.images, 'images');
});

$('btnDownloadVideos').addEventListener('click', () => {
  if (!threadData) return;
  downloadMedia(threadData.videos, 'videos');
});

// Init
(async () => {
  setStatus('SCANNING...');
  setProgress(0, 'Loading thread data...', true);
  const data = await fetchThreadData();
  hideProgress();
  updateUI(data);
  if (!data) {
    setStatus('NO THREAD');
    log('Navigate to a 4chan thread and reopen.', 'err');
  }
})();
