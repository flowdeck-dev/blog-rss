import https from "node:https";

export const get = (url, { timeoutMs = 20000 } = {}) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "flowdeck-blog-rss/1.0" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`${url} responded ${res.statusCode}`));
        return;
      }
      res.setEncoding("utf8");
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`${url} timed out`)));
    req.on("error", reject);
  });
