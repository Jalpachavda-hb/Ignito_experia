import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch("http://localhost:8080/api/files", {
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
