const https = require("https");

const SUPABASE_HOST = "ccypshhswmzsyevprzyt.supabase.co";
const SUPABASE_KEY = "sb_publishable_sh84TNwey2Wvwbbs_6ZkBQ_PoSdwFw9";

function request(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: SUPABASE_HOST, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
      }
    );
    req.on("error", (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    if (event.httpMethod === "GET") {
      const key = event.queryStringParameters && event.queryStringParameters.key;
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "missing key" }) };
      }
      const path = `/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&select=value`;
      const res = await request(path, "GET", { apikey: SUPABASE_KEY });
      if (res.statusCode >= 300) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: res.body }) };
      }
      let rows = [];
      try { rows = JSON.parse(res.body); } catch {}
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ value: rows[0] ? rows[0].value : [] }),
      };
    }

    if (event.httpMethod === "POST") {
      const parsed = JSON.parse(event.body || "{}");
      const key = parsed.key;
      const value = parsed.value;
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "missing key" }) };
      }
      const bodyStr = JSON.stringify({ key, value, updated_at: new Date().toISOString() });
      const res = await request("/rest/v1/app_storage", "POST", {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
        "Content-Length": Buffer.byteLength(bodyStr),
      }, bodyStr);
      if (res.statusCode >= 300) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: res.body }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((err && err.message) || err) }) };
  }
};
