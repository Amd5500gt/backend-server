const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const igdl = require("instagram-url-direct");
const ffmpeg = require("fluent-ffmpeg");
const stream = require("stream");
const axios = require("axios");

const app = express();

// Render gives dynamic PORT
const PORT = process.env.PORT || 3000;

// Your domain (local or Render)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// =============================
// 📌 Health Check
// =============================
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Video Downloader API is running!",
    version: "2.0",
    developer: "JStool@Harjeet",
    endpoints: {
      videoInfo: "POST /api/video-info",
      download: "POST /api/download",
      health: "GET /api/health"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "✅ Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// =============================
// 📌 Platform Detection
// =============================
app.post("/api/detect-platform", (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    let platform = "unknown";
    
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      platform = "youtube";
    } else if (url.includes("instagram.com")) {
      platform = "instagram";
    } else if (url.includes("tiktok.com")) {
      platform = "tiktok";
    } else if (url.includes("facebook.com") || url.includes("fb.watch")) {
      platform = "facebook";
    }

    res.json({ platform, success: true });
  } catch (error) {
    res.status(500).json({ error: "Platform detection failed" });
  }
});

// =============================
// 📌 Enhanced Video Info API
// =============================
app.post("/api/video-info", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("📥 Processing URL:", url);

    // YOUTUBE
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getInfo(url);
      const details = info.videoDetails;

      const formats = [
        { quality: "720p", format: "mp4", size: "15-25 MB", itag: 22 },
        { quality: "480p", format: "mp4", size: "8-15 MB", itag: 18 },
        { quality: "360p", format: "mp4", size: "5-10 MB", itag: 17 },
        { quality: "Audio", format: "mp3", size: "3-8 MB", itag: "mp3" }
      ];

      return res.json({
        success: true,
        platform: "youtube",
        title: details.title,
        thumbnail: details.thumbnails[details.thumbnails.length - 1].url,
        duration: details.lengthSeconds,
        author: details.author?.name || "Unknown",
        viewCount: details.viewCount,
        formats: formats,
        videoUrl: url
      });
    }

    // INSTAGRAM
    if (url.includes("instagram.com")) {
      const result = await igdl(url);
      
      if (!result || !result.url_list || result.url_list.length === 0) {
        return res.status(400).json({ error: "Unable to fetch Instagram video. The video might be private or the URL is invalid." });
      }

      const videoUrl = result.url_list[0];
      
      const formats = [
        { quality: "HD", format: "mp4", size: "5-50 MB" },
        { quality: "Audio", format: "mp3", size: "1-5 MB" }
      ];

      return res.json({
        success: true,
        platform: "instagram",
        title: "Instagram Video",
        thumbnail: "",
        duration: "0",
        videoUrl: videoUrl,
        formats: formats
      });
    }

    // TIKTOK (Basic support)
    if (url.includes("tiktok.com")) {
      return res.json({
        success: true,
        platform: "tiktok",
        title: "TikTok Video",
        thumbnail: "",
        duration: "0",
        formats: [
          { quality: "HD", format: "mp4", size: "5-20 MB" },
          { quality: "Audio", format: "mp3", size: "1-3 MB" }
        ]
      });
    }

    res.status(400).json({ 
      error: "Unsupported platform",
      message: "Please provide a valid YouTube, Instagram, or TikTok URL"
    });

  } catch (err) {
    console.error("❌ Video info error:", err);
    
    if (err.message.includes("Private video")) {
      return res.status(400).json({ error: "This video is private and cannot be downloaded" });
    }
    
    if (err.message.includes("Video unavailable")) {
      return res.status(400).json({ error: "Video is unavailable or has been removed" });
    }

    res.status(500).json({ 
      error: "Failed to fetch video information",
      details: "Please check the URL and try again. Make sure the video is public and accessible."
    });
  }
});

// =============================
// 📌 Enhanced Download API
// =============================
app.post("/api/download", async (req, res) => {
  try {
    const { url, format, platform, quality } = req.body;

    if (!url || !platform) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    console.log(`📥 Download request: ${platform}, ${format}, ${quality}`);

    // YOUTUBE DOWNLOAD
    if (platform === "youtube") {
      const info = await ytdl.getInfo(url);
      const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, "_");
      
      let downloadUrl;
      
      if (format === "mp3") {
        // MP3 download - stream through conversion
        downloadUrl = `${BASE_URL}/api/stream-audio?url=${encodeURIComponent(url)}`;
      } else {
        // MP4 download - choose quality based on itag
        let itag = 22; // Default 720p
        if (quality === "480p") itag = 18;
        if (quality === "360p") itag = 17;
        
        downloadUrl = `${BASE_URL}/api/stream-video?url=${encodeURIComponent(url)}&itag=${itag}`;
      }

      return res.json({
        success: true,
        downloadUrl: downloadUrl,
        filename: `${title}.${format === "mp3" ? "mp3" : "mp4"}`,
        title: info.videoDetails.title,
        message: "Download ready! The file will start downloading shortly."
      });
    }

    // INSTAGRAM DOWNLOAD
    if (platform === "instagram") {
      const result = await igdl(url);
      
      if (!result || !result.url_list || result.url_list.length === 0) {
        return res.status(400).json({ error: "Unable to fetch Instagram video" });
      }

      const videoUrl = result.url_list[0];
      
      if (format === "mp3") {
        // For MP3, we'll stream and convert
        return res.json({
          success: true,
          downloadUrl: `${BASE_URL}/api/stream-instagram-audio?url=${encodeURIComponent(videoUrl)}`,
          filename: `instagram_audio_${Date.now()}.mp3`,
          title: "Instagram Audio"
        });
      } else {
        // Direct MP4 download
        return res.json({
          success: true,
          downloadUrl: videoUrl,
          filename: `instagram_video_${Date.now()}.mp4`,
          title: "Instagram Video"
        });
      }
    }

    // TIKTOK DOWNLOAD (Placeholder)
    if (platform === "tiktok") {
      return res.json({
        success: true,
        downloadUrl: url, // In real implementation, you'd process TikTok URL
        filename: `tiktok_${Date.now()}.mp4`,
        title: "TikTok Video",
        message: "TikTok download feature coming soon!"
      });
    }

    res.status(400).json({ error: "Unsupported platform for download" });

  } catch (err) {
    console.error("❌ Download error:", err);
    res.status(500).json({ 
      error: "Download failed",
      details: "Please try again. If the problem persists, the video might not be available for download."
    });
  }
});

// =============================
// 📌 STREAM route for YOUTUBE VIDEO
// =============================
app.get("/api/stream-video", (req, res) => {
  try {
    const { url, itag = 22 } = req.query;

    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Type", "video/mp4");

    ytdl(url, { quality: itag })
      .on("error", (error) => {
        console.error("Stream error:", error);
        res.status(500).send("Streaming failed");
      })
      .pipe(res);

  } catch (err) {
    console.error("Stream video error:", err);
    res.status(500).send("Streaming failed");
  }
});

// =============================
// 📌 STREAM route for YOUTUBE AUDIO (MP3)
// =============================
app.get("/api/stream-audio", (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Type", "audio/mpeg");

    const audioStream = ytdl(url, { 
      filter: "audioonly",
      quality: "highestaudio"
    });

    ffmpeg(audioStream)
      .audioBitrate(128)
      .audioChannels(2)
      .audioFrequency(44100)
      .format("mp3")
      .on("error", (error) => {
        console.error("FFmpeg error:", error);
        res.status(500).send("Audio conversion failed");
      })
      .pipe(res, { end: true });

  } catch (err) {
    console.error("Stream audio error:", err);
    res.status(500).send("Audio streaming failed");
  }
});

// =============================
// 📌 STREAM route for INSTAGRAM AUDIO (MP3)
// =============================
app.get("/api/stream-instagram-audio", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Type", "audio/mpeg");

    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream"
    });

    ffmpeg(response.data)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .format("mp3")
      .on("error", (error) => {
        console.error("Instagram FFmpeg error:", error);
        res.status(500).send("Audio conversion failed");
      })
      .pipe(res, { end: true });

  } catch (err) {
    console.error("Instagram audio stream error:", err);
    res.status(500).send("Instagram audio streaming failed");
  }
});

// =============================
// 📌 Preview API (for your preview feature)
// =============================
app.post("/api/preview", async (req, res) => {
  try {
    const { url, platform } = req.body;

    if (platform === "youtube") {
      const info = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(info.formats, { quality: "lowest" });
      
      return res.json({
        success: true,
        previewUrl: format.url,
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds
      });
    }

    if (platform === "instagram") {
      const result = await igdl(url);
      return res.json({
        success: true,
        previewUrl: result.url_list[0],
        title: "Instagram Video",
        duration: "0"
      });
    }

    res.status(400).json({ error: "Preview not available for this platform" });

  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Preview generation failed" });
  }
});

// =============================
// 📌 Error Handling Middleware
// =============================
app.use((error, req, res, next) => {
  console.error("🚨 Server Error:", error);
  res.status(500).json({ 
    error: "Internal server error",
    message: "Something went wrong. Please try again later."
  });
});

// =============================
// 📌 404 Handler
// =============================
app.use("*", (req, res) => {
  res.status(404).json({ 
    error: "Endpoint not found",
    availableEndpoints: [
      "POST /api/video-info",
      "POST /api/download", 
      "POST /api/detect-platform",
      "POST /api/preview",
      "GET /api/health"
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Video Downloader Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`👨‍💻 Developer: JStool@Harjeet`);
  console.log(`✨ Supported platforms: YouTube, Instagram, TikTok`);
});