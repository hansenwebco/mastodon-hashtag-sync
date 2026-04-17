# Mastodon Hashtag Sync

**Hosted Site:** <a href="http://hashtagsync.stonedonkey.com/" target="_blank">http://hashtagsync.stonedonkey.com/</a>

Mastodon Hashtag Sync is a lightweight, browser-based utility designed to help Mastodon and Fediverse users seamlessly migrate and sync their followed hashtags from one server instance to another. 

Whether you are migrating to a brand-new Mastodon instance or just want to synchronize the tags you follow across multiple alt accounts, this tool ensures you don't lose track of your favorite topics.

## Features
* **Select & Sync:** See exactly which hashtags are missing on your new server and select which ones you want to migrate.
* **Non-Destructive:** The tool *never* unfollows or deletes your existing hashtags. It solely adds new ones.
* **Frictionless OAuth:** Logs into both your source and destination servers simultaneously using Mastodon's native, secure OAuth mechanisms.
* **Clean UI:** A gorgeous, glassmorphism-inspired dark mode interface that dynamically organizes your complex tags.

## Privacy First (Zero-Database Architecture)
Your security and privacy are fundamental to this project. 
* **100% Client-Side:** There is no backend, no telemetry, and no database whatsoever. The application runs entirely within your browser using standard HTML, CSS, and Vanilla JavaScript.
* **Direct Connections:** Your browser communicates *directly* with your Mastodon instances via their public APIs. 
* **Secure Storage:** The OAuth authentication sessions (tokens) are stored strictly within your browser's local storage memory. They are never transmitted externally.

## How It Works
1. **Connect:** Enter the URL for your Source server (where your current hashtags are) and your Destination server (where you want them to go).
2. **Authorize:** You will be securely redirected to your servers to authorize the tool to read and write your followed tags.
3. **Compare & Sync:** The app retrieves your followed hashtags from both servers, calculates the differences, and presents you with a streamlined dashboard. Simply check the boxes for the tags you want to copy over and hit Sync!

## Tech Stack
* HTML5
* CSS3 (Vanilla, utilizing Flexbox/Grid layouts & native CSS variables)
* Vanilla JavaScript (ES Modules, modern Fetch API, LocalStorage)
* [FontAwesome](https://fontawesome.com/) (For scalable vector icons)

## Running Locally
Because there is no build step or backend required, you can run this locally in seconds!
1. Clone the repository.
2. Serve the directory using any basic HTTP web server (e.g., `npx http-server`).
3. Open the port your server provisions in any modern browser.
