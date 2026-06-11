const embed =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWFkbWluLTAwMSIsInNlc3Npb25JZCI6InNlc3NfMjNlNjc5NzgiLCJzY29wZSI6Imp1cHl0ZXItZW1iZWQiLCJpYXQiOjE3Nzk0NTMxOTcsImV4cCI6MTc3OTQ2NzU5N30.D6ejyzJi09fiNo0yaynLTgySNCvcwEabAf5JxTRbA7w";
const base = "http://localhost:8082/api/lab-sessions/sess_23e67978/jupyter";
const r = await fetch(`${base}/lab?access_token=${embed}`);
const html = await r.text();
console.log("status", r.status, "len", html.length);
const m1 = html.match(/"baseUrl":\s*"[^"]*"/);
const m2 = html.match(/src="[^"]+"/);
console.log("baseUrl", m1?.[0]);
console.log("src", m2?.[0]);
const r2 = await fetch("http://localhost:8082/static/lab/");
console.log("root /static", r2.status);
const r3 = await fetch(`${base}/static/lab/?access_token=${embed}`);
console.log("proxy static dir", r3.status);
