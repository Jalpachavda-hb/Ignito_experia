const embed =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWFkbWluLTAwMSIsInNlc3Npb25JZCI6InNlc3NfMjNlNjc5NzgiLCJzY29wZSI6Imp1cHl0ZXItZW1iZWQiLCJpYXQiOjE3Nzk0NTMxOTcsImV4cCI6MTc3OTQ2NzU5N30.D6ejyzJi09fiNo0yaynLTgySNCvcwEabAf5JxTRbA7w";
const base = "http://localhost:8082/api/lab-sessions/sess_23e67978/jupyter";

const labRes = await fetch(`${base}/lab?access_token=${embed}`);
console.log("lab", labRes.status, "set-cookie", labRes.headers.get("set-cookie")?.slice(0, 60));
const html = await labRes.text();
console.log("baseUrl", html.match(/"baseUrl":\s*"[^"]*"/)?.[0]);
console.log("has base tag", html.includes("<base href"));

const cookie = labRes.headers.get("set-cookie")?.split(";")[0] || "";
const jsUrl = html.match(/src="([^"]+main[^"]+)"/)?.[1];
if (jsUrl) {
  const jsRes = await fetch(jsUrl.startsWith("http") ? jsUrl : `http://localhost:8082${jsUrl}`, {
    headers: { Cookie: cookie },
  });
  console.log("main.js with cookie only", jsRes.status);
}
