"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Decoder: () => Decoder,
  TcpPortScanner: () => TcpPortScanner,
  ValueHandleRegistry: () => ValueHandleRegistry,
  ValueHandleRegistryPrimitive: () => ValueHandleRegistryPrimitive,
  WaitForPort: () => WaitForPort,
  commandExists: () => commandExists,
  computeProxyLaunchPolicy: () => computeProxyLaunchPolicy,
  findAvailablePortRange: () => findAvailablePortRange,
  resolveProxyNetworkMode: () => resolveProxyNetworkMode
});
module.exports = __toCommonJS(index_exports);

// src/find-free-ports.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var net = __toESM(require("net"));
var lockfile = __toESM(require("proper-lockfile"));
var import_events = require("events");
var PortRangeLock = class {
  constructor(lockPaths, ports) {
    this.lockPaths = lockPaths;
    this.ports = ports;
  }
  async release() {
    await Promise.all(this.lockPaths.map((p) => lockfile.unlock(p).catch(() => {
    })));
  }
};
var allLockFiles = [];
var TcpPortScanner = class _TcpPortScanner {
  static LoopbackAddr = "127.0.0.1";
  static AllInterfaces = "0.0.0.0";
  static PortAllocated = new import_events.EventEmitter();
  // Anything allocated using findFreePorts() is added into this set. Never cleared but clients can feel free to clear
  // findFreePorts() will avoid these ports
  static AvoidPorts = /* @__PURE__ */ new Set();
  static EmitAllocated(ports) {
    if (ports && ports.length) {
      for (const p of ports) {
        _TcpPortScanner.AvoidPorts.add(p);
      }
      _TcpPortScanner.PortAllocated.emit("allocated", ports);
    }
  }
  static async unlockPortsIfFree(ports) {
    for (const lock2 of allLockFiles) {
      const intersection = lock2.ports.filter((p) => ports.includes(p));
      if (intersection.length === lock2.ports.length) {
        try {
          await lock2.release();
        } catch {
        }
      }
    }
  }
  /**
   * Checks to see if the port is in use by creating a server on that port. You should use the function
   * `isPortInUseEx()` if you want to do a more exhaustive check or a general purpose use for any host
   *
   * @param port port to use. Must be > 0 and <= 65535
   * @param host host ip address(es) to use. This should be an alias to a localhost. (Default: check both 127.0.0.1
   * and 0.0.0.0 covers all interfaces -- needed for macOS)
   * @param avoid if port is in this list, it is considered "in use"
   * @returns Promise that resolves to true if the port is in use, false otherwise
   */
  static async isPortInUse(port, avoid, hosts) {
    if (avoid && avoid.has(port)) {
      return true;
    }
    const hostsToCheck = hosts && hosts.length ? hosts : [_TcpPortScanner.LoopbackAddr, _TcpPortScanner.AllInterfaces];
    for (const h of hostsToCheck) {
      const inUse = await _TcpPortScanner.checkPortStatus(port, h);
      if (inUse) {
        return true;
      }
    }
    return false;
  }
  static checkPortStatus(port, host) {
    return new Promise((resolve, reject) => {
      const server = net.createServer(() => {
      });
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        } else {
          reject(err);
        }
      });
      server.once("close", () => {
        resolve(false);
      });
      server.listen(port, host, () => {
        server.close();
      });
    });
  }
  /**
   * Scan for free ports (no one listening) on the specified host.
   * Don't like the interface but trying to keep compatibility with `portastic.find()`. Unlike
   * `portastic` the default ports to retrieve is 1 and we also have the option of returning
   * consecutive ports
   *
   * Detail: While this function is async, promises are chained to find open ports recursively
   *
   * @param0
   * @param host Use any string that is a valid host name or ip address
   * @return a Promise with an array of ports or null when cb is used
   */
  static findFreePorts(numPorts, options = {}) {
    return new Promise((resolve, reject) => {
      findAvailablePortRange(numPorts, options.start ?? 3e4, options.consecutive ?? false, options.avoid).then((lock2) => {
        allLockFiles.push(lock2);
        _TcpPortScanner.EmitAllocated(lock2.ports);
        resolve(lock2.ports);
      }).catch((err) => {
        reject(err);
      });
    });
  }
};
async function tryReserveRange(start, count, consecutive = false, avoid) {
  const ports = [];
  const lockPaths = [];
  const releaseLocks = [];
  try {
    for (let i = 0; ports.length < count; i++) {
      const port = start + i;
      if (port > 65535) {
        throw new Error("Out of ports");
      }
      const lockPath = path.join(os.tmpdir(), `mcu-debug-port-${port}.lock`);
      const inUse = await TcpPortScanner.isPortInUse(port, avoid);
      if (inUse) {
        if (consecutive) {
          throw new Error(`Port ${port} is already in use`);
        } else {
          continue;
        }
      }
      try {
        if (!fs.existsSync(lockPath)) {
          fs.writeFileSync(lockPath, "");
        }
        const release = await lockfile.lock(lockPath, { stale: 3e4 });
        lockPaths.push(lockPath);
        releaseLocks.push(release);
        ports.push(port);
      } catch (e) {
        if (consecutive) {
          throw e;
        }
        continue;
      }
    }
    return new PortRangeLock(lockPaths, ports);
  } catch (err) {
    try {
      await Promise.all(releaseLocks.map((r) => r().catch(() => {
      })));
    } catch (e) {
      console.error(`Error releasing port locks: ${e.toString()}`);
    }
    return null;
  }
}
async function findAvailablePortRange(count, preferredStart, consecutive, avoid) {
  for (let base = preferredStart ?? 3e4; base < 65535; base += 10) {
    const result = await tryReserveRange(base, count, consecutive, avoid);
    if (result) return result;
  }
  throw new Error(`Could not find ${count} consecutive free ports`);
}
process.on("exit", async () => {
  for (const lock2 of allLockFiles) {
    try {
      await lock2.release();
    } catch {
    }
  }
});

// src/command-exists.ts
var fs2 = require("fs");
var path2 = require("path");
var process2 = require("process");
function commandExists(commandName) {
  const envPath = process2.env.PATH || "";
  const pathDirs = envPath.split(path2.delimiter);
  const extensions = process2.platform === "win32" ? [".exe", ".cmd", ".bat", ".sh"] : [""];
  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const fullPath = path2.join(dir, commandName + ext);
      try {
        fs2.accessSync(fullPath, fs2.constants.F_OK | fs2.constants.X_OK);
        return true;
      } catch (err) {
        continue;
      }
    }
  }
  return false;
}

// src/handles.ts
var ValueHandleRegistry = class {
  keyToHandle = /* @__PURE__ */ new Map();
  handleToObj = /* @__PURE__ */ new Map();
  counter = 0;
  /**
   * Get a handle for an object. If the object (by value) has been seen before,
   * returns the existing handle. Otherwise, creates a new one.
   */
  addObject(obj) {
    const key = this.getKey(obj);
    let handle = this.keyToHandle.get(key);
    if (handle !== void 0) {
      return handle;
    }
    handle = ++this.counter;
    this.keyToHandle.set(key, handle);
    this.handleToObj.set(handle, obj);
    return handle;
  }
  getHandle(obj) {
    const key = this.getKey(obj);
    const handle = this.keyToHandle.get(key);
    return handle;
  }
  getObject(handle) {
    return this.handleToObj.get(handle);
  }
  getObjectByKey(key) {
    const k = this.getKey(key);
    const handle = this.keyToHandle.get(k);
    if (handle !== void 0) {
      return this.handleToObj.get(handle);
    }
    return void 0;
  }
  release(handle) {
    const obj = this.handleToObj.get(handle);
    if (!obj) return false;
    const key = this.getKey(obj);
    this.keyToHandle.delete(key);
    this.handleToObj.delete(handle);
    return true;
  }
  /**
   * Determines the unique key for an object using the hybrid strategy.
   */
  getKey(obj) {
    if (isValueIdentifiable(obj)) {
      return obj.toValueKey();
    }
    return this.stableStringify(obj);
  }
  /**
   * Recursively stringifies an object with sorted keys.
   * Respects IValueIdentifiable during recursion.
   */
  stableStringify(val) {
    if (isValueIdentifiable(val)) {
      return val.toValueKey();
    }
    if (val === null || typeof val !== "object") {
      return JSON.stringify(val);
    }
    if (val instanceof Date) return JSON.stringify(val.toISOString());
    if (val instanceof RegExp) return JSON.stringify(val.toString());
    if (Array.isArray(val)) {
      return "[" + val.map((item) => this.stableStringify(item)).join(",") + "]";
    }
    const keys = Object.keys(val).sort();
    const parts = keys.map((key) => {
      return JSON.stringify(key) + ":" + this.stableStringify(val[key]);
    });
    return "{" + parts.join(",") + "}";
  }
  clear() {
    this.keyToHandle.clear();
    this.handleToObj.clear();
    this.counter = 0;
  }
};
function isValueIdentifiable(obj) {
  return obj && typeof obj.toValueKey === "function";
}
var ValueHandleRegistryPrimitive = class {
  keyToHandle = /* @__PURE__ */ new Map();
  handleToItem = /* @__PURE__ */ new Map();
  counter = 0;
  add(item) {
    const existing = this.keyToHandle.get(item);
    if (existing !== void 0) {
      return existing;
    }
    this.counter++;
    this.keyToHandle.set(item, this.counter);
    this.handleToItem.set(this.counter, item);
    return this.counter;
  }
  get(handle) {
    return this.handleToItem.get(handle);
  }
  release(handle) {
    const obj = this.handleToItem.get(handle);
    if (!obj) return false;
    this.keyToHandle.delete(obj);
    this.handleToItem.delete(handle);
    return true;
  }
  clear() {
    this.keyToHandle.clear();
    this.handleToItem.clear();
    this.counter = 0;
  }
};

// src/wait-for-port.ts
var net2 = __toESM(require("net"));
var DefaultWaitCallbacks = {
  silent: {
    setup: () => {
    },
    starting: () => {
    },
    tryConnect: () => {
    },
    connected: () => {
    },
    timeout: () => {
    }
  },
  verbose: {
    starting: ({ host, port }) => {
      console.log(`Waiting for ${host}:${port} to become available...`);
    },
    setup: (socket) => {
      console.log(`Socket created: ${socket.remoteAddress}:${socket.remotePort}`);
    },
    tryConnect: () => {
      console.log("Trying to connect...");
    },
    connected: (socket) => {
      console.log("Connected!");
    },
    timeout: () => {
      console.log("Timeout reached, giving up.");
    }
  }
};
var WaitForPort = class {
  constructor(params) {
    this.params = params;
  }
  IPv6enabled = true;
  returnedSocket = false;
  createConnectionWithTimeout(ipVersion, timeout, callback) {
    let timer = null;
    const opts = {
      host: this.params.host,
      port: this.params.port,
      family: ipVersion,
      autoSelectFamily: true
    };
    const socket = net2.createConnection(opts, (err) => {
      if (!err && timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!this.returnedSocket) {
        return callback(err);
      }
    });
    this.params.callbacks.setup?.(socket);
    socket.on("error", (error) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!this.returnedSocket) {
        socket.destroy();
        callback(error);
      }
    });
    timer = setTimeout(() => {
      socket.destroy();
      const error = new Error(`Timeout trying to open socket to ${this.params.host}:${this.params.port}, IPv${ipVersion}`);
      error.code = "ECONNTIMEOUT";
      callback(error);
    }, timeout);
    return socket;
  }
  checkHttp(socket, ipVersion, timeout, callback) {
    const request = `GET ${this.params.path} HTTP/1.1\r
Host: ${this.params.host}\r
\r
`;
    let timer = null;
    timer = setTimeout(() => {
      socket.destroy();
      const error = new Error(`Timeout waiting for data from ${this.params.host}:${this.params.port}, IPv${ipVersion}`);
      error.code = "EREQTIMEOUT";
      callback(error);
    }, timeout);
    socket.on("data", function(data) {
      const response = data.toString();
      const statusLine = response.split("\n")[0];
      if (timer) clearTimeout(timer);
      const statusLineParts = statusLine.split(" ");
      if (statusLineParts.length < 2 || statusLineParts[1].startsWith("2") === false) {
        const error = new Error("Invalid response from server");
        error.code = "ERESPONSE";
        callback(error);
      }
      callback();
    });
    socket.write(request);
  }
  //  This function attempts to open a connection, given a limited time window.
  //  This is the function which we will run repeatedly until we connect.
  tryConnect(ipVersion, timeout) {
    return new Promise((resolve, reject) => {
      try {
        const socket = this.createConnectionWithTimeout(ipVersion, this.params.interval || 1e3, (err) => {
          if (err) {
            if (err.code === "ECONNREFUSED" || err.code === "EACCES") {
              socket.destroy();
              return resolve([false]);
            } else if (err.code === "ECONNTIMEOUT") {
              socket.destroy();
              return resolve([false]);
            } else if (err.code === "ECONNRESET") {
              socket.destroy();
              return resolve([false]);
            } else if (this.IPv6enabled === true && (err.code === "EADDRNOTAVAIL" || err.code === "ENOTFOUND")) {
              this.IPv6enabled = false;
              socket.destroy();
              return resolve([false]);
            } else if (err.code === "ENOTFOUND") {
              socket.destroy();
              if (this.params.waitForDns === true) return resolve([false]);
              return reject(new Error(`The address '${this.params.host}' cannot be found`));
            }
            socket.destroy();
            if (ipVersion === 6) {
              this.IPv6enabled = false;
              return resolve([false]);
            }
            return reject(err);
          }
          if (this.params.protocol !== "http") {
            return resolve([true, socket]);
          }
          this.checkHttp(socket, ipVersion, timeout, (err2) => {
            if (err2) {
              if (err2.code === "EREQTIMEOUT") {
                socket.destroy();
                return resolve([false]);
              } else if (err2.code === "ERESPONSE") {
                socket.destroy();
                return resolve([false]);
              }
              socket.destroy();
              return reject(err2);
            }
            return resolve([true, socket]);
          });
        });
      } catch (err) {
        return reject(err);
      }
    });
  }
  waitPort() {
    this.returnedSocket = false;
    this.IPv6enabled = true;
    return new Promise((resolve, reject) => {
      validateParameters(this.params);
      const host = this.params.host;
      const port = this.params.port;
      const interval = this.params.interval;
      const timeout = this.params.timeout;
      const startTime = /* @__PURE__ */ new Date();
      const connectTimeout = 1e3;
      const outputFunction = this.params.callbacks || DefaultWaitCallbacks.silent;
      outputFunction.starting({ host, port });
      const loop = (ipVersion = 4) => {
        outputFunction.tryConnect?.();
        this.tryConnect(ipVersion, connectTimeout).then(([open, socket]) => {
          if (open) {
            this.returnedSocket = true;
            outputFunction.connected(socket);
            return resolve({ open: true, ipVersion, socket });
          }
          const now = /* @__PURE__ */ new Date();
          const delta = now.getTime() - startTime.getTime();
          if (timeout && delta > timeout) {
            outputFunction.timeout();
            return resolve({ open: false });
          }
          if (this.IPv6enabled && ipVersion === 4 && !net2.isIP(host)) {
            return loop(6);
          }
          return setTimeout(loop, interval);
        }).catch((err) => {
          return reject(err);
        });
      };
      loop();
    });
  }
};
function validateParameters(params) {
  params.protocol = params.protocol || "tcp";
  params.host = params.host || "127.0.0.1";
  params.port = params.port || 80;
  params.path = params.path || "/";
  params.interval = params.interval || 1e3;
  params.timeout = params.timeout || 0;
  params.waitForDns = params.waitForDns || false;
}

// src/run-decoder.ts
var child_process = __toESM(require("child_process"));
var import_events2 = require("events");
var Decoder = class extends import_events2.EventEmitter {
  spec;
  process;
  constructor(spec) {
    super();
    this.spec = Object.assign({}, spec);
    this.spec.cwd = spec.cwd || process.cwd();
    this.spec.env = { ...process.env, ...spec.env || {} };
  }
  getProgram() {
    return this.spec.program;
  }
  getArgs() {
    return this.spec.args;
  }
  getCwd() {
    return this.spec.cwd;
  }
  runProgram(stdio) {
    return new Promise((resolve, reject) => {
      const obj = {
        cwd: this.getCwd(),
        env: this.spec.env,
        detached: true
      };
      if (stdio) {
        obj.stdio = stdio;
      }
      this.process = child_process.spawn(this.getProgram(), this.getArgs(), obj);
      this.process.stdout?.on("data", (data) => {
        this.emit("stdout", data);
      });
      this.process.stderr?.on("data", (data) => {
        this.emit("stderr", data);
      });
      this.process.on("close", (code) => {
        this.emit("close", code);
      });
      this.process.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });
      this.process.on("spawn", () => {
        resolve();
      });
      this.on("stdin", async (data) => {
        await this.writeStdin(data);
      });
    });
  }
  setStdinPiped(stream) {
    stream.pipe(this.process?.stdin);
  }
  setStdoutPiped(stream) {
    this.process?.stdout?.pipe(stream);
  }
  setStderrPiped(stream) {
    this.process?.stderr?.pipe(stream);
  }
  async writeStdin(data) {
    if (this.process && this.process.stdin && this.process.stdin.writable) {
      if (!this.process.stdin.write(data)) {
        await this.process.stdin.once("drain", () => {
        });
      }
    }
  }
  close() {
    if (this.process) {
      this.process.stdin?.end();
      setTimeout(() => {
        this.process?.stdout?.destroy();
        this.process?.stderr?.destroy();
        this.process?.kill();
        this.process = void 0;
      }, 10);
    }
  }
  dispose() {
    this.close();
    this.removeAllListeners();
  }
};

// src/proxy-network.ts
function resolveProxyNetworkMode(hostType = "auto", remoteName) {
  if (hostType === "local") {
    return "local";
  }
  if (hostType === "ssh") {
    return "ssh";
  }
  if (!remoteName) {
    return "auto-local";
  }
  if (remoteName === "wsl") {
    return "auto-wsl";
  }
  if (remoteName === "dev-container") {
    return "auto-dev-container";
  }
  if (remoteName === "ssh-remote") {
    return "auto-ssh-remote";
  }
  return `auto-${remoteName}`;
}
function computeProxyLaunchPolicy(mode) {
  if (mode === "local" || mode === "auto-local" || mode === "ssh" || mode === "auto-ssh-remote") {
    return {
      mode,
      bindHost: "127.0.0.1",
      proxyHostForDA: "127.0.0.1",
      reason: "Loopback-only mode"
    };
  }
  if (mode === "auto-dev-container") {
    return {
      mode,
      bindHost: "127.0.0.1",
      proxyHostForDA: "host.docker.internal",
      reason: "Container reaches host through host.docker.internal"
    };
  }
  if (mode === "auto-wsl") {
    return {
      mode,
      bindHost: "0.0.0.0",
      proxyHostForDA: "<wsl-gateway-ip>",
      reason: "WSL mode may require host bind outside loopback for NAT"
    };
  }
  return {
    mode,
    bindHost: "127.0.0.1",
    proxyHostForDA: "127.0.0.1",
    reason: "Fallback policy"
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Decoder,
  TcpPortScanner,
  ValueHandleRegistry,
  ValueHandleRegistryPrimitive,
  WaitForPort,
  commandExists,
  computeProxyLaunchPolicy,
  findAvailablePortRange,
  resolveProxyNetworkMode
});
//# sourceMappingURL=index.js.map
