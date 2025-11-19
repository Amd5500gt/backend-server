const igdl = require("instagram-url-direct");

module.exports = async (req, res) => {
  try {
    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {
      const { url, platform, format } = JSON.parse(body || "{}");

      if (platform === "instagram") {
        const result = await igdl(url);
        return res.json({
          success: true,
          downloadUrl: result.url_list[0]
        });
      }

      // YOUTUBE
      if (platform === "youtube") {
        return res.json({
          success: true,
          downloadUrl: `/api/stream?url=${encodeURIComponent(url)}&format=${format}`
        });
      }

      res.status(400).json({ error: "Invalid platform" });
    });

  } catch (err) {
    res.status(500).json({ error: "Download Error" });
  }
};
