/**
 * 구글 지도 단축 URL 펼치기 (Cloudflare Worker)
 * ────────────────────────────────────────────────
 * maps.app.goo.gl 같은 단축 URL을 받아 리다이렉트를 따라가
 * 좌표가 들어 있는 최종 URL과 본문 일부를 돌려줍니다.
 * 구글의 쿠키 동의(consent) 페이지는 자동으로 우회합니다.
 *
 * 배포 방법:
 *  1) https://dash.cloudflare.com → Workers & Pages → Create → Start with Hello World!
 *  2) 이 파일 내용을 그대로 붙여넣고 Deploy
 *  3) 발급된 주소(예: https://xxx.workers.dev)를 HTML의 "Worker 주소"에 입력
 *
 * 호출 예: https://xxx.workers.dev/?url=https://maps.app.goo.gl/abcd
 */
export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const target = new URL(request.url).searchParams.get('url');
    if (!target || !/^https?:\/\//i.test(target)) {
      return json({ error: 'url 파라미터가 필요합니다.' }, 400, cors);
    }
    // 구글/단축 도메인만 허용 (오픈 프록시 악용 방지)
    let host;
    try { host = new URL(target).hostname.toLowerCase(); } catch { host = ''; }
    const allowed = ['goo.gl', 'app.goo.gl', 'maps.app.goo.gl', 'google.com', 'maps.google.com', 'g.co'];
    if (!allowed.some(d => host === d || host.endsWith('.' + d))) {
      return json({ error: '허용되지 않은 도메인: ' + host }, 403, cors);
    }

    try {
      const r = await expand(target, 0);
      return json(r, 200, cors);
    } catch (e) {
      return json({ error: '펼치기 실패: ' + String(e) }, 502, cors);
    }
  },
};

// 리다이렉트를 따라가되, 구글 동의 페이지를 만나면 continue= 목표로 점프
async function expand(url, depth) {
  const resp = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      // 쿠키 동의 페이지 우회용 쿠키
      'Cookie': 'CONSENT=YES+cb.20210720-07-p0.en+FX+410; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
    },
  });
  const finalUrl = resp.url;
  const body = (await resp.text()).slice(0, 400000);

  // 동의 페이지에 걸렸으면 그 안의 실제 목적지(continue=)로 한 번 더 진행
  if (depth < 3 && /consent\.(google|youtube)\./i.test(finalUrl)) {
    let cont = null;
    try { cont = new URL(finalUrl).searchParams.get('continue'); } catch {}
    if (!cont) {
      const m = body.match(/continue=([^"'&\\\s]+)/);
      if (m) { try { cont = decodeURIComponent(m[1]); } catch { cont = m[1]; } }
    }
    if (cont && /^https?:\/\//i.test(cont)) {
      const next = await expand(cont, depth + 1);
      // 다음 단계의 결과를 쓰되, 동의 우회 경로였음을 표시
      return { finalUrl: next.finalUrl, body: next.body, viaConsent: true, consentUrl: finalUrl };
    }
  }
  return { finalUrl, body };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}
