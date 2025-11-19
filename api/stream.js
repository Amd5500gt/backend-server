const ytdl = require("ytdl-core");

module.exports = (req, res) => {
  try {
    const url = req.query.url;
    const format = req.query.format;

    res.setHeader("Content-Disposition", "attachment");

    if (format === "mp3") {
      ytdl(url, { filter: "audioonly" }).pipe(res);
    } else {
      ytdl(url, { quality: "highest" }).pipe(res);
    }

  } catch (err) {
    res.status(500).send("Stream failed");
  }
};
