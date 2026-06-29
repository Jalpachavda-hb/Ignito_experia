import fetch from 'node-fetch';
import { ENV } from './config/env.js';

async function test() {
  try {
    const res = await fetch(`${ENV.apiPublicUrl}/files`, {
      headers: { "x-session-id": "sess_3d17023a" } // using the user's session ID from screenshot
    });
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", text);
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}

test();
