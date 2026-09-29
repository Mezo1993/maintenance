const SUPABASE_URL = "https://ccypshhswmzsyevprzyt.supabase.co";
const SUPABASE_KEY = "sb_publishable_sh84TNwey2Wvwbbs_6ZkBQ_PoSdwFw9";

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
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&select=value`,
        { headers: { apikey: SUPABASE_KEY } }
      );
      if (!res.ok) {
        const t = await res.text();
        return { statusCode: 502, headers, body: JSON.stringify({ error: t }) };
      }
      const rows = await res.json();
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
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_storage`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { statusCode: 502, headers, body: JSON.stringify({ error: t }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((err && err.message) || err) }) };
  }
};
