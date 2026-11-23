import test from "node:test";
import assert from "node:assert/strict";

process.env.BASE_DOMAIN = "ignitoexperia.com";
process.env.LEGACY_BASE_DOMAINS = "experia.ignitolearn.com";

const { slugFromHost, portalHostForSlug } = await import("../../lib/tenantSlug.js");
const { platformApexFor, isPlatformMainHost } = await import("../../lib/platformDomain.js");

test("new live apex is the main site, not a university slug", () => {
  // Regression: "ignitoexperia.com" used to yield slug "ignitoexperia".
  assert.equal(slugFromHost("ignitoexperia.com"), "");
  assert.equal(slugFromHost("www.ignitoexperia.com"), "");
  assert.equal(slugFromHost("ignitoexperia.com:443"), "");
  assert.equal(isPlatformMainHost("ignitoexperia.com"), true);
});

test("university portal subdomains resolve to their slug on new and legacy apex", () => {
  assert.equal(slugFromHost("gtu.ignitoexperia.com"), "gtu");
  assert.equal(slugFromHost("baou.experia.ignitolearn.com"), "baou");
  assert.equal(slugFromHost("experia.ignitolearn.com"), "");
  assert.equal(slugFromHost("a.b.ignitoexperia.com"), "", "nested labels are not a slug");
  assert.equal(slugFromHost("www.ignitoexperia.com"), "");
  assert.equal(slugFromHost("api.ignitoexperia.com"), "", "reserved label");
});

test("local development hosts", () => {
  assert.equal(slugFromHost("localhost:5173"), "");
  assert.equal(slugFromHost("gtu.localhost:5173"), "gtu");
  assert.equal(slugFromHost("127.0.0.1"), "");
  assert.equal(slugFromHost("3.7.254.15"), "");
});

test("unknown two-label domains are never treated as a slug", () => {
  assert.equal(slugFromHost("example.com"), "");
  assert.equal(slugFromHost("gtu.example.com"), "gtu");
});

test("portal host for a slug follows the request's apex", () => {
  assert.equal(portalHostForSlug("gtu", "ignitoexperia.com"), "gtu.ignitoexperia.com");
  assert.equal(portalHostForSlug("gtu", "baou.ignitoexperia.com"), "gtu.ignitoexperia.com");
  assert.equal(portalHostForSlug("gtu", "experia.ignitolearn.com"), "gtu.experia.ignitolearn.com");
});

test("refresh-cookie apex", () => {
  assert.equal(platformApexFor("gtu.ignitoexperia.com"), "ignitoexperia.com");
  assert.equal(platformApexFor("https://ignitoexperia.com/login"), "ignitoexperia.com");
  assert.equal(platformApexFor("baou.experia.ignitolearn.com"), "experia.ignitolearn.com");
  assert.equal(platformApexFor("localhost"), "");
});
