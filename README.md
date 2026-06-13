# 구글 지도 좌표 추출기

구글 지도 URL에서 **위도·경도**를 뽑아내는 단일 파일 웹 도구입니다.
좌표 URL, Plus Code, 단축 URL(`maps.app.goo.gl`)을 지원하며, 추출한 좌표를
네이버·카카오·구글 지도로 바로 열거나 좌표·JSON으로 복사할 수 있습니다.

빌드 도구·서버·의존성 없이 브라우저에서 바로 동작합니다.

---

## 📁 구성 파일

| 파일 | 설명 |
|------|------|
| [`index.html`](index.html) | 본체. 이 파일 하나로 동작합니다. |
| [`cloudflare-worker.js`](cloudflare-worker.js) | 단축 URL을 펼치는 Cloudflare Worker 코드 (선택) |
| [`start-server.bat`](start-server.bat) | 로컬 서버를 띄우고 브라우저를 여는 실행 파일 (Windows) |
| `README.md` | 이 문서 |

---

## 🚀 빠른 시작

### 방법 A — 그냥 열기
`index.html` 파일을 더블클릭해 브라우저로 엽니다.
좌표 URL·Plus Code 추출은 이것만으로 동작합니다.

### 방법 B — 로컬 서버 (권장)
[`start-server.bat`](start-server.bat) 더블클릭 →
`http://localhost:8000/index.html` 가 자동으로 열립니다.

- Python(`py`/`python`) → Node.js 순으로 설치된 런타임을 자동 탐색합니다.
- 종료: `Local Server - maps` 창을 닫거나 그 창에서 `Ctrl+C`.
- 포트 변경: bat 파일 위쪽 `set "PORT=8000"` 숫자만 수정.

> 단축 URL 펼치기(Worker)나 AI 검색 같은 네트워크 호출은
> `file://`보다 `http://localhost`에서 더 안정적이라 로컬 서버를 권장합니다.

---

## 🧭 지원 형식

추출은 다음 순서로 자동 시도되며, 먼저 성공한 방식에서 멈춥니다.

### 1) 직접 좌표 파싱 (즉시·오프라인)
URL 안에 좌표가 들어 있으면 정규식으로 바로 추출합니다.

| 패턴 | 예시 |
|------|------|
| `@lat,lng,Zz` | `.../@37.5665,126.9780,14z` |
| `q=` / `query=` | `?q=37.5665,126.9780` |
| `ll=` | `?ll=37.5665,126.9780` |
| `/place/.../@` | `.../place/.../@37.56,126.97` |
| `!3d!4d` | `...!3d37.5665!4d126.9780` |
| `destination=` | `?destination=37.56,126.97` |

### 2) Plus Code (즉시·오프라인)
URL 안의 [Open Location Code](https://maps.google.com/pluscodes/)를 자동 감지·디코딩합니다.

- **전체 코드**: `8Q98C2MC+M36` → 바로 디코딩
- **단축 코드**: `C2MC+M36 과천시` → URL 속 **도시명을 기준점**으로 전체 코드를 복원
  - 한국 주요 50여 개 도시 좌표를 내장하고 있어, 도시명이 있으면 그 기준으로 복원합니다.
  - 도시명이 없으면 서울을 기본 기준점으로 사용합니다.

### 3) 단축 URL 펼치기 (Worker 필요)
`maps.app.goo.gl/...` 같은 단축 URL은 좌표를 직접 담고 있지 않습니다.
Cloudflare Worker가 리다이렉트를 따라가 **실제 URL**을 알아낸 뒤,
그 URL에 대해 다시 1)·2) 추출을 적용합니다. (→ [Worker 설정](#%EF%B8%8F-cloudflare-worker-설정))

### 4) AI 웹 검색 (선택 폴백)
위 방법으로 모두 실패할 때, Anthropic API로 좌표를 추적합니다. (→ [API 키 설정](#-ai-검색-api-키-선택))

---

## ☁️ Cloudflare Worker 설정

단축 URL을 처리하려면 워커가 필요합니다. **무료**이며 5분이면 됩니다.

### 왜 필요한가
브라우저는 보안 정책(CORS) 때문에 다른 사이트(`maps.app.goo.gl`)로 직접 요청해
리다이렉트 주소를 읽을 수 없습니다. 그래서 중간에서 대신 펼쳐주는 작은 서버가 필요하며,
Cloudflare Worker가 그 역할을 합니다.

### 배포
1. <https://dash.cloudflare.com> 가입·로그인
2. **Workers & Pages → Create → Start with Hello World!**
3. 이름 입력(예: `maps-expander`) → **Deploy**
4. **Edit code** → 기본 코드를 모두 지우고 [`cloudflare-worker.js`](cloudflare-worker.js) 내용 붙여넣기 → **Deploy**
5. 발급된 주소(`https://maps-expander.<계정>.workers.dev`)를 복사
6. 앱의 **Worker 주소** 칸에 붙여넣기 (브라우저에 저장됨)

### 동작 확인
브라우저 주소창에서 직접 호출해 볼 수 있습니다:

```
https://<당신워커>.workers.dev/?url=https://maps.app.goo.gl/<실제코드>
```

`{"finalUrl":"https://www.google.com/maps/...","body":"..."}` 형태의 JSON이 나오면 정상입니다.

### 특징
- **도메인 화이트리스트**: 구글/`goo.gl` 계열만 허용해 오픈 프록시 악용을 막습니다.
- **동의 페이지 우회**: 구글의 쿠키 동의(`consent.google.com`) 페이지를 자동으로 통과합니다.
- **무료 한도**: 하루 100,000 요청 (개인용으로는 사실상 무제한).

---

## 🤖 AI 검색 API 키 (선택)

단축 URL을 Worker로도 못 풀 때를 위한 마지막 폴백입니다. 없어도 대부분 동작합니다.

1. <https://console.anthropic.com> 에서 API 키 발급 (`sk-ant-...`)
2. 앱의 **Anthropic API 키** 칸에 입력 (브라우저에만 저장)

> ⚠️ **보안**: 이 방식은 브라우저에서 Anthropic API를 직접 호출하므로 **API 키가 클라이언트에 노출**됩니다.
> 본인 PC에서 혼자 쓰는 로컬 도구라면 괜찮지만, **이 HTML을 외부에 공개·배포하지 마세요.**
> 공개가 필요하면 키를 숨기는 별도 프록시 서버를 두어야 합니다.

---

## 🔧 문제 해결

**"단축 URL은 펼쳤지만 좌표를 찾지 못했습니다"**
펼친 URL 안의 좌표/Plus Code를 못 읽은 경우입니다. 페이지를 **강력 새로고침**(`Ctrl+Shift+R`)한 뒤 다시 시도하세요.
그래도 안 되면 위 [동작 확인](#동작-확인)으로 `finalUrl` 값을 확인하세요.

**Worker가 `{"error":"url 파라미터가 필요합니다."}` 반환**
워커를 `?url=...` 없이 호출했기 때문입니다. 반드시 `워커주소/?url=단축URL` 형태로 호출하세요.

**Worker가 `403 허용되지 않은 도메인`**
구글/`goo.gl` 계열이 아닌 주소를 넣었습니다. 구글 지도 URL만 지원합니다.

**`start-server.bat` 실행 시 한글 깨짐·명령 오류**
배치 파일은 ASCII 전용으로 작성돼 있습니다. 직접 수정할 경우 한글을 넣지 말고
UTF-8(BOM 없음) 또는 ANSI로 저장하세요.

**AI 검색이 인증 오류**
API 키가 비었거나 잘못됐습니다. `sk-ant-`로 시작하는 유효한 키인지 확인하세요.

---

## 🔒 개인정보·보안 요약

- 좌표 URL·Plus Code 추출은 **완전히 오프라인**(브라우저 내부)에서 처리됩니다.
- 단축 URL만 Worker로 전송되며, Worker는 구글 외 다른 곳에 데이터를 보내지 않습니다.
- API 키·Worker 주소는 **브라우저 localStorage**에만 저장되고 외부로 전송되지 않습니다.
- 단, AI 검색 사용 시에는 해당 URL이 Anthropic API로 전송됩니다.

---

## 🛠️ 기술 메모

- 순수 HTML/CSS/JavaScript (외부 라이브러리 없음, 폰트만 Google Fonts).
- Open Location Code(Plus Code) 인코딩/디코딩/단축코드 복원을 자체 구현.
- 추출 로직은 `tryExtractAll()` 한 함수로 통합되어, 원본 입력과 Worker가 펼친 URL 모두에 동일 적용됩니다.
