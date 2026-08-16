# CLAUDE.md — 지도 좌표 도구

구글 지도 URL에서 좌표를 추출하고, 사진 EXIF에 GPS를 기록하는 **단일 파일 웹앱**.
사용자용 문서는 [README.md](README.md), 이 문서는 작업 이어가기용 메모.

## 파일 구성

| 파일 | 역할 |
|------|------|
| `index.html` | 앱 전체 (HTML+CSS+JS 한 파일). GitHub Pages 진입점이라 이름 고정 |
| `cloudflare-worker.js` | 단축 URL 펼치기용 워커. 저장소에 보관만 하고, 배포는 Cloudflare 대시보드에 수동 붙여넣기 |
| `start-server.bat` | 로컬 서버 실행 (Python→Node 자동 탐색, 포트 8000) |
| `README.md` | 사용자 문서 |

## 배포

**웹앱** — `main`에 푸시하면 GitHub Pages가 자동 배포.
<https://stepersjmj-hash.github.io/googlemap/> · 반영까지 1~2분, 확인 시 `Ctrl+Shift+R`.

작업은 `feature` 브랜치에서 하고 다음처럼 올린다:

```bash
git checkout main && git merge --ff-only feature && git push origin main && git checkout feature && git merge --ff-only main
```

**워커** — `cloudflare-worker.js`를 고쳤으면 별도로 배포해야 반영된다.
Cloudflare 대시보드 → 해당 워커 → Edit code → 전체 교체 → Deploy. (wrangler 미설정)

## 구조 메모

- 탭 2개: `#tab-extractor` / `#tab-writer`, `switchTab()`으로 전환.
- **추출 순서**: 직접 좌표 파싱 → Plus Code 디코딩 → Worker로 단축 URL 펼치기.
  앞의 두 단계는 `tryExtractAll()` 하나로 묶여 있고, 원본 입력과 Worker가 펼친 URL 양쪽에 같은 함수를 적용한다.
- OLC(Plus Code)는 외부 라이브러리 없이 자체 구현. 단축 코드는 URL 속 도시명(`CITIES` 테이블)을 기준점으로 복원.
- EXIF 쓰기는 piexifjs, ZIP은 JSZip — 둘 다 CDN. 재압축 없이 메타데이터만 삽입해 화질 무손실.
- 저장은 File System Access API(폴더 직접 저장, Chrome·Edge) / JSZip(폴백) 두 갈래.
- Worker 주소는 localStorage(`maps_worker_url`)에 저장. 앱에 하드코딩하지 않음.

## 데이터 소스

**자주 쓰는 좌표** (`COORD_PRESETS`)는 옵시디언 노트에서 옮겨 온 것:
`\\mjj\기타\Obsidian\MJ\지도위치.md` (빈 줄로 그룹 구분, `이름` / `위도, 경도` 2줄씩).
노트가 바뀌면 `index.html`의 `COORD_PRESETS` 배열을 손으로 갱신한다. 그룹명은 노트에 없어서
내용을 보고 붙인 것(집·동네 / 공원·나들이 / 쇼핑 / 여행·리조트).

## 함정

- **`.bat` 파일에 한글 금지.** cmd가 CP949로 읽어 UTF-8 한글이 깨지고, 깨진 글자를 명령으로
  실행하려다 에러가 쏟아진다. 메시지는 전부 ASCII로.
- **단축 URL은 좌표가 아니라 Plus Code로 펼쳐지는 경우가 많다.** (`.../search/C2MC+M36+과천시`)
  그래서 Worker 응답에도 좌표 파싱만이 아니라 Plus Code 디코딩까지 돌려야 한다.
- 구글이 `consent.google.com`으로 리다이렉트하면 좌표가 없다. 워커가 동의 쿠키를 실어 보내고,
  걸리면 `continue=` 파라미터를 따라 재시도한다.
- 좌표 정규식은 `(-?\d+(?:\.\d+)?)` 형태로 쓸 것. `\.?\d+`는 정수 좌표를 놓친다.
  값이 `0`인 좌표 때문에 `if (!lat)` 대신 `if (lat == null)`을 쓴다.
- AI 검색 폴백은 제거됨(2026-08). 외부 API 의존 없음 — 다시 넣지 말 것.

## 관례

- UI 문구·주석·커밋 메시지 모두 한국어. 커밋은 `무엇을 왜` 한 줄 요약체
  (예: `추출기에서 AI 검색 폴백 제거 — Worker 방식만 유지`).
- 기능을 추가하면 README의 해당 섹션도 같은 커밋에서 갱신.
