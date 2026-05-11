const http = require("http");
const fs = require("fs");
const path = require("path");
const { PORT, HOST, PUBLIC_DIR, MIME_TYPES } = require("./src/config.js");
const { sendJson } = require("./src/utils.js");
const { handleApi } = require("./src/api.js");
const { initDatabase } = require("./src/db.js");

function serveStatic(req, res, url) {
  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
        res.end(fallback);
      });
      return;
    }

    const extension = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    res.end(content);
  });
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Server error" });
    }
    return;
  }

  serveStatic(req, res, url);
}

if (require.main === module) {
  initDatabase();
  const server = http.createServer(requestHandler);
  server.listen(PORT, HOST, () => {
    console.log(`Vadodara Municipal Services running at http://${HOST}:${PORT}`);
  });
}

module.exports = requestHandler;
