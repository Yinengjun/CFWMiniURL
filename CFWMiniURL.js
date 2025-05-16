const TG_BOT_TOKEN = 'your_bot_token_here';
const TG_CHAT_ID = 'your_chat_id_here';

const URL_MAP = {
  "abc123": {
    url: "https://target.com/api/data?secret=abc",
    note: "用户数据接口"
  },
  "xyz789": {
    url: "https://another.com/hidden?token=123",
    note: "内部统计服务"
  }
};

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const token = url.pathname.slice(1);
  const record = URL_MAP[token];

  if (!record) {
    return new Response("Not found", { status: 404 });
  }

  const { url: targetUrl, note } = record;

  let success = false;
  let fetchResponse;

  try {
    fetchResponse = await fetch(targetUrl);
    success = fetchResponse.ok;
  } catch (e) {
    success = false;
  }

  if (success) {
    await sendTelegramNotification({
      token,
      note,
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
      ua: request.headers.get("User-Agent") || "unknown",
      time: new Date().toISOString(),
    });
  }

  return fetchResponse || new Response("Fetch failed", { status: 502 });
}

async function sendTelegramNotification({ token, note, ip, ua, time }) {
  let locationText = "未知";
  let mapUrl = "";

  try {
    const geoRes = await fetch(`https://ipwho.is/${ip}?lang=zh-CN&fields=country,region,city,latitude,longitude,flag.emoji`);
    if (geoRes.ok) {
      const geo = await geoRes.json();
      if (geo.success !== false) {
        const { country, region, city, latitude, longitude, flag } = geo;
        locationText = `${flag.emoji || ""}${country || ""}${region || ""}${city || ""}`;
        mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      }
    }
  } catch (e) {
    locationText = "查询失败";
  }

  const message = `
🔔 <b>访问通知</b>
📍 路径: <code>${token}</code>
📝 备注: ${note}
🌐 IP: <code>${ip}</code>
🔍 位置: <a href="${mapUrl}">${locationText}</a>
🕒 时间: <code>${time}</code>
🧭 UA: <code>${ua}</code>
✅ 状态: <b>成功访问</b>
  `.trim();

  const tgUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TG_CHAT_ID,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  await fetch(tgUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

