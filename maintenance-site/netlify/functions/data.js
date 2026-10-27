const https = require("https");

// DATA_JS_VERSION: 3 (Buffer.concat UTF-8)
const SUPABASE_HOST = "ccypshhswmzsyevprzyt.supabase.co";
const SUPABASE_KEY = "sb_publishable_sh84TNwey2Wvwbbs_6ZkBQ_PoSdwFw9";

function request(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: SUPABASE_HOST, path, method, headers },
      (res) => {
        // نجمع الـ Buffers ثم نفك الترميز مرة واحدة: دمج الأجزاء كنص يكسر الحروف العربية
        // (حرف من بايتين قد ينقسم بين جزأين فيتحول إلى ��)
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.setTimeout(8000, () => req.destroy(new Error("Supabase timeout")));
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
    "Content-Type": "application/json; charset=utf-8",
    // يمنع أي وسيط (بروكسي الشركة أو المتصفح) من إعادة نسخة قديمة
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
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
      // الأحدث أولًا، حتى لو وُجد أكثر من صف لنفس المفتاح
      const path =
        `/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}` +
        `&select=value,updated_at&order=updated_at.desc&limit=1`;
      const res = await request(path, "GET", { apikey: SUPABASE_KEY });
      if (res.statusCode >= 300) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: res.body }) };
      }
      let rows = [];
      try {
        rows = JSON.parse(res.body);
      } catch (e) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: "bad response from database" }) };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          value: rows[0] ? rows[0].value : [],
          updated_at: rows[0] ? rows[0].updated_at : null,
          fn_version: 3,
        }),
      };
    }

    if (event.httpMethod === "POST") {
      const parsed = JSON.parse(event.body || "{}");
      const key = parsed.key;
      const value = parsed.value;
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "missing key" }) };
      }
      if (!Array.isArray(value)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "value must be an array" }) };
      }
      const updatedAt = new Date().toISOString();
      const bodyStr = JSON.stringify({ key, value, updated_at: updatedAt });
      const res = await request(
        "/rest/v1/app_storage",
        "POST",
        {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json; charset=utf-8",
          Prefer: "resolution=merge-duplicates,return=minimal",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
        bodyStr
      );
      if (res.statusCode >= 300) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: res.body }) };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, updated_at: updatedAt, count: value.length }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((err && err.message) || err) }) };
  }
};
