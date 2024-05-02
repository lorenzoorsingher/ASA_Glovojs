// server.js
import { Server } from "socket.io";
import http from "http";
import express from "express";
import monitoringScript from "./monitoringScript.js";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve dashboard interface
app.get("/", (req, res) => {
  const dashboardPath = new URL("./dashboard.html", import.meta.url).pathname;
  console.log(dashboardPath);
  const normalizedPath = path.normalize(dashboardPath);
  res.sendFile(normalizedPath);
});

// Start listening
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

// Monitoring script
monitoringScript.on("update", (data) => {
  console.log("EMITTING");
  io.emit("update", data); // Send updates to dashboard
});

monitoringScript.on("update", (data) => {
  console.log("Update event emitted with data:", data);
});
