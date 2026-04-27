# 4chan Thread Archiver — Chrome Extension

A dark, minimal Chrome extension to archive 4chan threads and download all media.

## Features

- **Archive Thread (HTML)** — saves a self-contained `.html` file of the entire thread with all posts, names, dates, and embedded image previews
- **Download All Media** — batch-downloads every image and video/WebM in the thread
- **Images Only** — download only image files (jpg, png, gif)
- **Videos / WebMs Only** — download only video files (webm, mp4)
- Live post/image/video counter
- Activity log in the popup
- Small floating `◈` button injected on thread pages

## Install (Developer Mode)

1. Unzip or extract this folder somewhere permanent on your computer.
2. Open Chrome and go to: `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the `4chan-archiver` folder.
6. The extension icon will appear in your toolbar.

## Usage

1. Navigate to any 4chan thread, e.g. `https://boards.4chan.org/g/thread/12345`
2. Click the **4ARCH** extension icon in your toolbar.
3. The popup will scan the page and show post/image/video counts.
4. Click the action you want:
   - **Archive Thread (HTML)** → downloads a `4chan_BOARD_THREADID_TIMESTAMP.html` file
   - **Download All Media / Images Only / Videos Only** → downloads files into a folder named `4chan_BOARD_THREADID/`

## Notes

- Downloads go to your browser's default downloads folder (or ask-where-to-save if you have that setting enabled).
- Media files are downloaded sequentially with a small delay to be respectful to 4cdn.org servers.
- The HTML archive includes inline image previews (loaded from 4cdn.org) and full post text.
- No data is sent anywhere — everything runs locally in your browser.
