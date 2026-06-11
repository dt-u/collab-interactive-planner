import http from "http";

const port = process.env.PORT || 3002;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "realtime-service", status: "ok" }));
});

server.listen(Number(port), "0.0.0.0", () => {
  console.log(`realtime-service is listening on 0.0.0.0:${port}`);
});
