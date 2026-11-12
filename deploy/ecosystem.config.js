// PM2 process file for the VPS deployment. Runs the HTTP/Socket.io server and
// the BullMQ workers as two separate long-lived processes — the reason we're
// on a VPS instead of Vercel. Both read the same .env in the repo root.
module.exports = {
  apps: [
    {
      name: "abo-api",
      script: "dist/server.js",
      cwd: __dirname + "/..",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
    },
    {
      name: "abo-worker",
      script: "dist/queues/worker.entrypoint.js",
      cwd: __dirname + "/..",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
    },
  ],
};
