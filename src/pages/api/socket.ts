// src/pages/api/socket.ts
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "../../types";

export const config = { api: { bodyParser: false } };

/**
 * This API route was previously attempting to run a WebSocket server,
 * which is an unstable pattern in a serverless environment and caused
 * the Next.js application to fail on startup.
 *
 * This file's logic has been removed to ensure the application starts reliably.
 * To re-enable real-time features, a standalone, persistent WebSocket server
 * (separate from the Next.js API routes) must be implemented.
 */
export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  res.status(404).json({ message: "This endpoint is currently disabled. A standalone WebSocket server is required." });
}
