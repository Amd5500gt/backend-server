const ytdl = require("ytdl-core");
const igdl = require("instagram-url-direct");

module.exports = async (req, res) => {
  try {
    let body = "";

    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      const { url } = JSON.parse(body || "{}");

      if (!url) return res.status(400).json({ error: "URL required" });

      // YOUTUBE
      if (ytdl.validateURL(url)) {
        const info = await ytdl.getInfo(url);
        const details = info.videoDetails;

        return res.json({
          success: true,
          platform: "youtube",
          title: details.title,
          thumbnail: details.thumbnails.pop().url,
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

        return res.json({
          success: true,
          platform: "instagram",
          videoUrl: result.url_list[0]
        });
      }

      res.status(400).json({ error: "Unsupported link" });
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
