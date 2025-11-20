const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const igdl = require("instagram-url-direct");

const app = express();

// Render gives dynamic PORT
const PORT = process.env.PORT || 3000;

// Your domain (local or Render)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());

// =============================
// 📌 Video Info API
// =============================
app.post("/api/video-info", async (req, res) => {
  try {
    const { url } = req.body;

    // YOUTUBE
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getInfo(url);
      const details = info.videoDetails;

      return res.json({
        success: true,
        platform: "youtube",
        title: details.title,
        thumbnail: details.thumbnails[details.thumbnails.length - 1].url,
        duration: details.lengthSeconds,
        formats: [
          { quality: "720p", format: "mp4" },
          { quality: "480p", format: "mp4" },
          { quality: "Audio", format: "mp3" }
        ]
      });
    }

    // INSTAGRAM
    if (url.includes("instagram.com")) {
      const result = await igdl(url);
      if (!result || !result.url_list || result.url_list.length === 0) {
        return res.status(400).json({ error: "Unable to fetch Instagram video" });
      }

      return res.json({
        success: true,
        platform: "instagram",
        title: "Instagram Reel",
        thumbnail: "",
        duration: "0",
        videoUrl: result.url_list[0],
        formats: [
          { quality: "HD", format: "mp4" },
          { quality: "Audio", format: "mp3" }
        ]
      });
    }

    res.status(400).json({ error: "Unsupported platform" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch video information" });
  }
});

// =============================
// 📌 Download API
// =============================
app.post("/api/download", async (req, res) => {
  try {
    const { url, format, platform } = req.body;

    // YOUTUBE DOWNLOAD
    if (platform === "youtube") {
      const info = await ytdl.getInfo(url);
      const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, "_");

      return res.json({
        success: true,
        downloadUrl: `${BASE_URL}/api/stream?url=${encodeURIComponent(url)}&format=${format}`,
        filename: `${title}.${format === "mp3" ? "mp3" : "mp4"}`
      });
    }

    // INSTAGRAM DOWNLOAD
    if (platform === "instagram") {
      const result = await igdl(url);
      const directUrl = result.url_list[0];

      return res.json({
        success: true,
        downloadUrl: directUrl,
        filename: `instagram_${Date.now()}.mp4`
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Download failed" });
  }
});

// =============================
// 📌 STREAM route for YOUTUBE
// =============================
app.get("/api/stream", (req, res) => {
  try {
    const { url, format } = req.query;

    res.setHeader("Content-Disposition", "attachment");

    if (format === "mp3") {
      ytdl(url, { filter: "audioonly" }).pipe(res);
    } else {
      ytdl(url, { quality: "highestvideo" }).pipe(res);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Streaming failed");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
