// monitoringScript.js
import { EventEmitter } from "events";

class MonitoringScript extends EventEmitter {
  constructor() {
    super();

    // this.interval = setInterval(() => {
    //   const data = "aa";
    //   this.emit("update", data); // Emit update event
    // }, 1000);
  }

  stop() {
    clearInterval(this.interval);
  }
}

export default new MonitoringScript();
