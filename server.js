// server.js
import { Server } from "socket.io";
import http from "http";
import express from "express";
import path from "path";

class MyServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);

    this.start();
    this.serveDashboard();
  }

  serveDashboard() {
    this.app.get("/", (req, res) => {
      const dashboardPath = new URL("./dashboard.html", import.meta.url)
        .pathname;
      console.log(dashboardPath);
      const normalizedPath = path.normalize(dashboardPath);
      res.sendFile(normalizedPath);
    });
  }

  start() {
    this.server.listen(3000, () => {
      console.log("Dashboard server running on http://localhost:3000");
    });
  }

  emitMessage(event, data) {
    this.io.emit(event, data);
  }
}

export default new MyServer();
