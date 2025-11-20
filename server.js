const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const { fromUrl } = require("instagram-url-direct"); // ✅ FIXED IMPORT

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Video Downloader API is running!",
    status: "OK",
    server: "Render",
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true,
    message: "✅ Backend is working perfectly!",
    server: "https://downloder-server-js.onrender.com"
  });
});

// Video info endpoint - FIXED
app.post("/api/video-info", async (req, res) => {
  try {
    const { url } = req.body;
    
    console.log("📥 Processing URL:", url);

    if (!url) {
      return res.json({ success: false, error: "URL is required" });
    }

    // YOUTUBE - FIXED with error handling
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      try {
        const info = await ytdl.getInfo(url);
        const details = info.videoDetails;

        const formats = [
          { quality: "720p", format: "mp4", size: "15-25 MB" },
          { quality: "480p", format: "mp4", size: "8-15 MB" },
          { quality: "360p", format: "mp4", size: "5-10 MB" },
          { quality: "Audio", format: "mp3", size: "3-8 MB" }
        ];

        return res.json({
          success: true,
          platform: "youtube",
          title: details.title,
          thumbnail: details.thumbnails[0].url,
          duration: details.lengthSeconds,
          author: details.author?.name || "Unknown",
          formats: formats
        });
      } catch (youtubeError) {
        console.log("YouTube error:", youtubeError.message);
        return res.json({ 
          success: false, 
          error: "YouTube video not available or private" 
        });
      }
    }

    // INSTAGRAM - FIXED IMPORT
    if (url.includes("instagram.com")) {
      try {
        const result = await fromUrl(url); // ✅ FIXED: using fromUrl
        
        if (!result || !result.url_list || result.url_list.length === 0) {
          return res.json({ 
            success: false, 
            error: "No video found on Instagram URL" 
          });
        }

        const videoUrl = result.url_list[0];
        const formats = [
          { quality: "HD", format: "mp4", size: "5-20 MB" },
          { quality: "Audio", format: "mp3", size: "1-5 MB" }
        ];

        return res.json({
          success: true,
          platform: "instagram",
          title: "Instagram Video",
          thumbnail: "",
          duration: "0",
          formats: formats,
          videoUrl: videoUrl
        });
      } catch (instagramError) {
        console.log("Instagram error:", instagramError.message);
        return res.json({ 
          success: false, 
          error: "Invalid Instagram URL or video not available" 
        });
      }
    }

    // TIKTOK - Basic support
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

    return res.json({ 
      success: false, 
      error: "Unsupported platform. Use YouTube, Instagram, or TikTok URLs." 
    });

  } catch (error) {
    console.error("❌ Server Error:", error);
    return res.json({ 
      success: false, 
      error: "Server error. Please try again later." 
    });
  }
});

// Download endpoint - SIMPLIFIED for now
app.post("/api/download", async (req, res) => {
  try {
    const { url, format, platform } = req.body;

    console.log(`📥 Download request: ${platform}, ${format}`);

    if (platform === "youtube") {
      try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, "_");
        
        // For YouTube, return stream URL
        const downloadUrl = `${req.protocol}://${req.get('host')}/api/stream-youtube?url=${encodeURIComponent(url)}&format=${format}`;
        
        return res.json({
          success: true,
          downloadUrl: downloadUrl,
          filename: `${title}.${format === "mp3" ? "mp3" : "mp4"}`,
          title: info.videoDetails.title,
          message: "Download ready!"
        });
      } catch (error) {
        return res.json({ success: false, error: "YouTube download failed" });
      }
    }

    if (platform === "instagram") {
      try {
        const result = await fromUrl(url); // ✅ FIXED
        const videoUrl = result.url_list[0];
        
        return res.json({
          success: true,
          downloadUrl: videoUrl,
          filename: `instagram_${Date.now()}.${format === "mp3" ? "mp3" : "mp4"}`,
          title: "Instagram Video",
          message: "Download ready!"
        });
      } catch (error) {
        return res.json({ success: false, error: "Instagram download failed" });
      }
    }

    return res.json({ success: false, error: "Unsupported platform" });

  } catch (error) {
    console.error("Download error:", error);
    return res.json({ success: false, error: "Download failed" });
  }
});

// YouTube streaming endpoint
app.get("/api/stream-youtube", (req, res) => {
  try {
    const { url, format } = req.query;
    
    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    res.setHeader("Content-Disposition", "attachment");

    if (format === "mp3") {
      res.setHeader("Content-Type", "audio/mpeg");
      ytdl(url, { filter: "audioonly", quality: "highestaudio" }).pipe(res);
    } else {
      res.setHeader("Content-Type", "video/mp4");
      ytdl(url, { quality: "highest" }).pipe(res);
    }

  } catch (error) {
    console.error("Stream error:", error);
    res.status(500).send("Streaming failed");
  }
});

// Platform detection
app.post("/api/detect-platform", (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.json({ success: false, error: "URL is required" });
    }

    let platform = "unknown";
    
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      platform = "youtube";
    } else if (url.includes("instagram.com")) {
      platform = "instagram";
    } else if (url.includes("tiktok.com")) {
      platform = "tiktok";
    }

    res.json({ success: true, platform });

  } catch (error) {
    res.json({ success: false, error: "Platform detection failed" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Video Downloader Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Render URL: https://downloder-server-js.onrender.com`);
  console.log(`✅ Backend is ready!`);
}); 