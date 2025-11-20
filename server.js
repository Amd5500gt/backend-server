const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const { fromUrl } = require("instagram-url-direct");
const axios = require("axios");

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

// Video info endpoint - FIXED FOR ALL VIDEOS
app.post("/api/video-info", async (req, res) => {
  try {
    const { url } = req.body;
    
    console.log("📥 Processing URL:", url);

    if (!url) {
      return res.json({ success: false, error: "URL is required" });
    }

    // YOUTUBE - FIXED with better error handling
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      try {
        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
          return res.json({ 
            success: false, 
            error: "Invalid YouTube URL format" 
          });
        }

        const info = await ytdl.getInfo(url);
        const details = info.videoDetails;

        // Check if video is available
        if (!details || !details.title) {
          return res.json({ 
            success: false, 
            error: "YouTube video not available" 
          });
        }

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
          thumbnail: details.thumbnails[0]?.url || "",
          duration: details.lengthSeconds,
          author: details.author?.name || "Unknown",
          formats: formats,
          videoUrl: url
        });

      } catch (youtubeError) {
        console.log("YouTube error:", youtubeError.message);
        
        if (youtubeError.message.includes("Private")) {
          return res.json({ 
            success: false, 
            error: "This YouTube video is private" 
          });
        } else if (youtubeError.message.includes("unavailable")) {
          return res.json({ 
            success: false, 
            error: "YouTube video is unavailable" 
          });
        } else {
          return res.json({ 
            success: false, 
            error: "Failed to fetch YouTube video info" 
          });
        }
      }
    }

    // INSTAGRAM - FIXED with better error handling
    if (url.includes("instagram.com")) {
      try {
        console.log("🔍 Fetching Instagram video...");
        
        const result = await fromUrl(url);
        
        if (!result) {
          return res.json({ 
            success: false, 
            error: "No data received from Instagram" 
          });
        }

        if (!result.url_list || result.url_list.length === 0) {
          return res.json({ 
            success: false, 
            error: "No video found on this Instagram URL" 
          });
        }

        const videoUrl = result.url_list[0];
        console.log("✅ Instagram video URL found:", videoUrl);

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
        
        if (instagramError.message.includes("No video")) {
          return res.json({ 
            success: false, 
            error: "No video found on this Instagram URL" 
          });
        } else {
          return res.json({ 
            success: false, 
            error: "Failed to fetch Instagram video" 
          });
        }
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

// Download endpoint - SIMPLIFIED for better compatibility
app.post("/api/download", async (req, res) => {
  try {
    const { url, format, platform } = req.body;

    console.log(`📥 Download request: ${platform}, ${format}`);

    if (platform === "youtube") {
      try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, "_");
        
        // For YouTube streaming
        const downloadUrl = `/api/stream-youtube?url=${encodeURIComponent(url)}&format=${format}`;
        
        return res.json({
          success: true,
          downloadUrl: downloadUrl,
          filename: `${title}.${format === "mp3" ? "mp3" : "mp4"}`,
          title: info.videoDetails.title,
          message: "YouTube download ready!"
        });
      } catch (error) {
        console.log("YouTube download error:", error);
        return res.json({ 
          success: false, 
          error: "YouTube download failed. Video might be unavailable." 
        });
      }
    }

    if (platform === "instagram") {
      try {
        console.log("🔍 Getting Instagram download URL...");
        const result = await fromUrl(url);
        
        if (!result || !result.url_list || result.url_list.length === 0) {
          return res.json({ 
            success: false, 
            error: "No Instagram video found" 
          });
        }

        const videoUrl = result.url_list[0];
        console.log("✅ Instagram download URL:", videoUrl);
        
        return res.json({
          success: true,
          downloadUrl: videoUrl,
          filename: `instagram_${Date.now()}.${format === "mp3" ? "mp3" : "mp4"}`,
          title: "Instagram Video",
          message: "Instagram download ready!"
        });
      } catch (error) {
        console.log("Instagram download error:", error);
        return res.json({ 
          success: false, 
          error: "Instagram download failed" 
        });
      }
    }

    return res.json({ 
      success: false, 
      error: "Unsupported platform" 
    });

  } catch (error) {
    console.error("Download endpoint error:", error);
    return res.json({ 
      success: false, 
      error: "Download failed. Please try again." 
    });
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
      ytdl(url, { 
        filter: "audioonly", 
        quality: "highestaudio" 
      }).pipe(res);
    } else {
      res.setHeader("Content-Type", "video/mp4");
      ytdl(url, { 
        quality: "highest" 
      }).pipe(res);
    }

  } catch (error) {
    console.error("Stream error:", error);
    res.status(500).send("Streaming failed");
  }
});

// Instagram streaming endpoint
app.get("/api/stream-instagram", async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    const result = await fromUrl(url);
    const videoUrl = result.url_list[0];

    if (!videoUrl) {
      return res.status(400).send("No video URL found");
    }

    // Stream Instagram video
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream'
    });

    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Type", "video/mp4");
    
    response.data.pipe(res);

  } catch (error) {
    console.error("Instagram stream error:", error);
    res.status(500).send("Instagram streaming failed");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Fixed Video Downloader Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Render URL: https://downloder-server-js.onrender.com`);
  console.log(`✅ Backend is ready and fixed!`);
});