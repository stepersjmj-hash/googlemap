/**
 * 구글 지도 단축 URL 펼치기 (Cloudflare Worker)
 * ────────────────────────────────────────────────
 * maps.app.goo.gl 같은 단축 URL을 받아 리다이렉트를 따라가
 * 좌표가 들어 있는 최종 URL과 본문 일부를 돌려줍니다.
 * 구글의 쿠키 동의(consent) 페이지는 자동으로 우회하고,
 * 봇 확인(/sorry/) 페이지에 걸리면 그 직전 목적지 URL을 돌려줍니다.
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
      const r = await expand(target);
      return json(r, 200, cors);
    } catch (e) {
      return json({ error: '펼치기 실패: ' + String(e) }, 502, cors);
    }
  },
};

// 리다이렉트를 한 단계씩 직접 따라간다.
// 구글이 봇 확인(/sorry/)이나 동의(consent) 페이지로 보내면 그 안의 continue= 목적지를 꺼낸다.
//  - 동의 페이지: 쿠키를 실어 continue 목적지로 계속 진행
//  - 봇 확인 페이지: 다시 요청해도 또 걸리므로 continue 목적지를 최종 URL로 삼고 멈춘다
//    (단축 URL의 첫 리다이렉트 목적지에 이미 Plus Code(!20s…)가 들어 있어 좌표 추출에 충분)
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  // 쿠키 동의 페이지 우회용 쿠키
  'Cookie': 'CONSENT=YES+cb.20210720-07-p0.en+FX+410; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
};
const MAX_HOPS = 10;

function continueTarget(url) {
  let cont = null;
  try { cont = new URL(url).searchParams.get('continue'); } catch {}
  return cont && /^https?:\/\//i.test(cont) ? cont : null;
}
const isConsent = u => /^https?:\/\/consent\.(google|youtube)\./i.test(u);
const isSorry   = u => /^https?:\/\/(www\.)?google\.[a-z.]+\/sorry\//i.test(u);

async function expand(url) {
  let cur = url, viaConsent = false, consentUrl = null;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (isSorry(cur)) {
      const cont = continueTarget(cur);
      return { finalUrl: cont || cur, body: '', blocked: true, blockedUrl: cur, viaConsent, consentUrl };
    }
    if (isConsent(cur)) {
      const cont = continueTarget(cur);
      if (cont) { viaConsent = true; consentUrl = cur; cur = cont; continue; }
    }
    const resp = await fetch(cur, { redirect: 'manual', headers: HEADERS });
    const loc = resp.headers.get('location');
    if (resp.status >= 300 && resp.status < 400 && loc) {
      cur = new URL(loc, cur).href;
      continue;
    }
    let body = (await resp.text()).slice(0, 400000);
    // 리다이렉트 없이 본문에서 동의 페이지로 넘기는 경우
    if (isConsent(resp.url || cur)) {
      const m = body.match(/continue=([^"'&\\\s]+)/);
      let cont = null;
      if (m) { try { cont = decodeURIComponent(m[1]); } catch { cont = m[1]; } }
      if (cont && /^https?:\/\//i.test(cont)) { viaConsent = true; consentUrl = cur; cur = cont; continue; }
    }
    return { finalUrl: resp.url || cur, body, viaConsent, consentUrl };
  }
  return { finalUrl: cur, body: '', error: '리다이렉트가 너무 많습니다.' };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}
