// Vercel serverless entry point. Deliberately does NOT use src/server.ts —
// that calls httpServer.listen() and wires up Socket.io, neither of which
// work in a serverless function (no persistent process to hold a socket
// server or a listening port). This just exports the Express app itself,
// which Vercel's Node runtime knows how to invoke per-request.
//
// Requires ../dist/app (not ../src/app) because vercel.json's buildCommand
// runs `npm run build` first, which also rewrites the "@/..." path aliases
// to relative requires via tsc-alias — plain Node (which is what runs this
// file) can't resolve "@/..." on its own.
//
// Socket.io (Live/SOS realtime) and the BullMQ push worker do not run in
// this deployment — see the plan doc for why Vercel was flagged as a poor
// fit for those two features specifically.
const { createApp } = require("../dist/app");

module.exports = createApp();
