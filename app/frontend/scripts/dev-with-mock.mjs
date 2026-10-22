// `npm run dev:mock`: starts the contract mock (3002) and the Vite dev server (5173) proxying /api to it.
import { spawn } from 'node:child_process';

const mockPort = process.env.MOCK_PORT ?? '3002';
const env = { ...process.env, MOCK_PORT: mockPort, API_TARGET: `http://localhost:${mockPort}` };
const kids = [
  spawn(process.execPath, ['mock/server.mjs'], { stdio: 'inherit', env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env }),
];
const stop = () => kids.forEach((k) => k.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
kids.forEach((k) => k.on('exit', stop));
