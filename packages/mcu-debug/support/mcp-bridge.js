#!/usr/bin/env node

const fs = require("fs");
const net = require("net");
const path = require("path");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 51234;

function parseArgs(argv) {
    const opts = {
        host: process.env.MCU_DEBUG_MCP_HOST || DEFAULT_HOST,
        port: process.env.MCU_DEBUG_MCP_PORT ? Number(process.env.MCU_DEBUG_MCP_PORT) : DEFAULT_PORT,
        portFile: process.env.MCU_DEBUG_MCP_PORT_FILE || "",
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--host" && argv[i + 1]) {
            opts.host = argv[++i];
        } else if (arg === "--port" && argv[i + 1]) {
            opts.port = Number(argv[++i]);
        } else if (arg === "--port-file" && argv[i + 1]) {
            opts.portFile = argv[++i];
        }
    }

    if (!opts.portFile) {
        const workspacePortFile = path.join(process.cwd(), ".vscode", "mcu-debug-mcp-port.json");
        if (fs.existsSync(workspacePortFile)) {
            opts.portFile = workspacePortFile;
        }
    }

    return opts;
}

function readPortFile(portFile) {
    if (!portFile) {
        return {};
    }
    try {
        const data = JSON.parse(fs.readFileSync(portFile, "utf8"));
        return {
            host: typeof data.host === "string" ? data.host : undefined,
            port: Number(data.port),
        };
    } catch (err) {
        console.error(`MCP Bridge Warning: Could not read port file ${portFile}: ${err.message}`);
        return {};
    }
}

function resolveEndpoint() {
    const opts = parseArgs(process.argv.slice(2));
    const fromFile = readPortFile(opts.portFile);
    const host = fromFile.host || opts.host || DEFAULT_HOST;
    const port = Number.isInteger(fromFile.port) && fromFile.port > 0 ? fromFile.port : opts.port;

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        console.error(`MCP Bridge Error: Invalid MCU-Debug MCP port: ${port}`);
        process.exit(1);
    }

    return { host, port, portFile: opts.portFile };
}

const endpoint = resolveEndpoint();

const socket = net.connect(endpoint.port, endpoint.host, () => {
    // Pipe standard input (Agent -> Bridge) to socket (Bridge -> Extension)
    process.stdin.pipe(socket);
    // Pipe socket (Extension -> Bridge) to standard output (Bridge -> Agent)
    socket.pipe(process.stdout);
});

socket.on("error", (err) => {
    const portFileHint = endpoint.portFile ? ` Port file: ${endpoint.portFile}.` : "";
    console.error(`MCP Bridge Error: Could not connect to MCU-Debug at ${endpoint.host}:${endpoint.port}. Is debugging active?${portFileHint}`, err.message);
    process.exit(1);
});

process.on("SIGINT", () => {
    socket.destroy();
    process.exit(0);
});
