import '../server/env.js';
import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server.js';

export const config = {
  maxDuration: 30,
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}
