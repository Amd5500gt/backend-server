const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const { fromUrl } = require("instagram-url-direct");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/downloads', express.static('downloads'));

// Create downloads directory
if (!fs.existsSync('downloads')) {
  fs.mkdirSync('downloads');
}

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 REAL Video Downloader - Like SnapTube",
    status: "OK",
    features: ["Real File Downloads", "YouTube MP4/MP3", "Instagram Videos"],
    timestamp: new Date().toISOString()
  });
});

// =============================
// 🎯 REAL YOUTUBE DOWNLOAD WITH FILE CREATION
// =============================
const downloadYouTubeVideo = async (url, format, quality) => {
  try {
    // Fix YouTube URL
    let youtubeUrl = url;
    if (url.includes('youtu.be')) {
      const videoId = url.split('/').pop().split('?')[0];
      youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error("Invalid YouTube URL");
    }

    const info = await ytdl.getInfo(youtubeUrl);
    const details = info.videoDetails;

    // Generate safe filename
    const safeTitle = details.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
    const timestamp = Date.now();
    const filename = `${safeTitle}_${timestamp}.${format === 'mp3' ? 'mp3' : 'mp4'}`;
    const filePath = path.join(__dirname, 'downloads', filename);

    return new Promise((resolve, reject) => {
      if (format === 'mp3') {
        // Download as MP3
        const audioStream = ytdl(youtubeUrl, { 
          filter: 'audioonly',
          quality: 'highestaudio'
        });

        ffmpeg(audioStream)
          .audioBitrate(128)
          .toFormat('mp3')
          .on('error', (err) => {
            reject(new Error(`MP3 conversion failed: ${err.message}`));
          })
          .on('end', () => {
            resolve({
              success: true,
              downloadUrl: `/downloads/${filename}`,
              filename: filename,
              title: details.title,
              format: 'mp3',
              quality: '128kbps',
              message: "MP3 download ready!"
            });
          })
          .save(filePath);

      } else {
        // Download as MP4
        let itag;
        switch (quality) {
          case '720p': itag = 22; break;
          case '480p': itag = 18; break;
          case '360p': itag = 18; break;
          default: itag = 18;
        }

        const videoStream = ytdl(youtubeUrl, { quality: itag });
        const writeStream = fs.createWriteStream(filePath);

        videoStream.pipe(writeStream);

        writeStream.on('finish', () => {
          resolve({
            success: true,
            downloadUrl: `/downloads/${filename}`,
            filename: filename,
            title: details.title,
            format: 'mp4',
            quality: quality,
            message: "MP4 download ready!"
          });
        });

        writeStream.on('error', (err) => {
          reject(new Error(`Video download failed: ${err.message}`));
        });
      }
    });

  } catch (error) {
    throw new Error(`YouTube download failed: ${error.message}`);
  }
};

// =============================
// 🎯 REAL INSTAGRAM DOWNLOAD WITH FILE CREATION
// =============================
const downloadInstagramVideo = async (url, format) => {
  try {
    console.log("🔍 Downloading Instagram video...");
    
    const result = await fromUrl(url);
    
    if (!result || !result.url_list || result.url_list.length === 0) {
      throw new Error("No video found on Instagram");
    }

    const videoUrl = result.url_list[0];
    const timestamp = Date.now();
    const filename = `instagram_${timestamp}.mp4`;
    const filePath = path.join(__dirname, 'downloads', filename);

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      
      axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
      })
      .then(response => {
        response.data.pipe(writeStream);

        writeStream.on('finish', () => {
          resolve({
            success: true,
            downloadUrl: `/downloads/${filename}`,
            filename: filename,
            title: "Instagram Video",
            format: 'mp4',
            quality: 'HD',
            message: "Instagram download ready!"
          });
        });

        writeStream.on('error', (err) => {
          reject(new Error(`Instagram download failed: ${err.message}`));
        });
      })
      .catch(err => {
        reject(new Error(`Instagram fetch failed: ${err.message}`));
      });
    });

  } catch (error) {
    throw new Error(`Instagram download failed: ${error.message}`);
  }
};

// =============================
// 🎯 MAIN DOWNLOAD ENDPOINT - CREATES ACTUAL FILES
// =============================
app.post("/api/download", async (req, res) => {
  try {
    const { url, format, platform, quality } = req.body;

    console.log(`📥 REAL Download: ${platform}, ${format}, ${quality}`);

    if (!url || !platform) {
      return res.json({ 
        success: false, 
        error: "URL and platform are required" 
      });
    }

    let result;

    if (platform === "youtube") {
      result = await downloadYouTubeVideo(url, format, quality);
    } else if (platform === "instagram") {
      result = await downloadInstagramVideo(url, format);
    } else {
      return res.json({ 
        success: false, 
        error: "Unsupported platform" 
      });
    }

    // Add server URL to download path
    result.downloadUrl = `https://${req.get('host')}${result.downloadUrl}`;
    
    res.json(result);

  } catch (error) {
    console.error("❌ Download error:", error.message);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// =============================
// 🎯 VIDEO INFO ENDPOINT
// =============================
app.post("/api/video-info", async (req, res) => {
  try {
    const { url } = req.body;
    
    console.log("📥 Video Info:", url);

    if (!url) {
      return res.json({ success: false, error: "URL is required" });
    }

    // YOUTUBE INFO
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      try {
        let youtubeUrl = url;
        if (url.includes('youtu.be')) {
          const videoId = url.split('/').pop().split('?')[0];
          youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }

        if (!ytdl.validateURL(youtubeUrl)) {
          return res.json({ 
            success: false, 
            error: "Invalid YouTube URL" 
          });
        }

        const info = await ytdl.getInfo(youtubeUrl);
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
          thumbnail: details.thumbnails[0]?.url || "",
          duration: details.lengthSeconds,
          author: details.author?.name || "Unknown",
          formats: formats,
          videoUrl: youtubeUrl
        });

      } catch (youtubeError) {
        return res.json({ 
          success: false, 
          error: "YouTube video not available" 
        });
      }
    }

    // INSTAGRAM INFO
    if (url.includes("instagram.com")) {
      try {
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
          videoUrl: url
        });

      } catch (instagramError) {
        return res.json({ 
          success: false, 
          error: "Instagram video not available" 
        });
      }
    }

    return res.json({ 
      success: false, 
      error: "Unsupported platform" 
    });

  } catch (error) {
    return res.json({ 
      success: false, 
      error: "Failed to get video information" 
    });
  }
});

// =============================
// 🎯 TEST ENDPOINT
// =============================
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true,
    message: "✅ REAL Downloader is Working!",
    features: [
      "Actual File Downloads",
      "YouTube MP4 Downloads",
      "YouTube MP3 Conversions", 
      "Instagram Video Downloads",
      "Like SnapTube - Real Files"
    ]
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error("🚨 Server Error:", error);
  res.status(500).json({ 
    success: false,
    error: "Internal server error" 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 REAL FILE DOWNLOADER Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Render: https://downloder-server-js.onrender.com`);
  console.log(`🎯 YouTube: ✅ REAL File Downloads`);
  console.log(`📷 Instagram: ✅ REAL File Downloads`);
  console.log(`💾 Files: ✅ Saved on Server`);
});