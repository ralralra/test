# MAKE:LAB

구글시트 · Apps Script · AI Studio · HTML/CSS/JavaScript로 만드는 프로젝트 소개 페이지입니다.

## GitHub Pages 게시

1. 저장소 **Settings → Pages**를 엽니다.
2. **Source: Deploy from a branch**를 선택합니다.
3. **Branch: main / 폴더: /(root)**로 설정하고 Save를 누릅니다.
4. 배포 완료 후 `https://ralralra.github.io/test/`에서 확인합니다.

별도 빌드나 npm 설치가 필요 없는 정적 웹페이지입니다. Pages 설정과 배포 완료 여부는 GitHub에서 확인해야 합니다.

## 파일

- `index.html`: 페이지 내용과 구조
- `styles.css`: 반응형 디자인, 가운데 메시지 강조
- `app.js`: 프로젝트 필터/상세, Apps Script 연결, 메시지 등록 및 자동 스크롤
- `.nojekyll`: 정적 파일을 그대로 배포

## 응원 메시지

`app.js`의 `API_URL`에 지정된 기존 Apps Script 서버를 사용합니다.

- 조회: GET `?action=list&limit=100`
- 등록: POST, `Content-Type: text/plain;charset=utf-8`, JSON `{action:"save",nickname,message}`
- 서버에서 `success: true`를 확인한 뒤에만 저장 완료로 표시합니다.
- 별명 20자, 메시지 300자. 저장되는 시트는 서버의 `data`입니다.
- 메시지는 위로 끊김 없이 흐르며, 마지막 글 다음에 첫 글이 이어져 무한 반복됩니다. 가운데에 온 메시지를 선명하게 표시합니다.
- 속도는 `app.js`의 `SCROLL_SPEED`(초당 px, 기본 22 ≈ 메시지당 약 4.4초)로 조절합니다. 약 45초마다 목록을 새로 조회합니다.
- 화면 안에 보이는 카드만 렌더링하므로 글이 많아도 가볍습니다. 1건이면 가운데에 고정하고, 등록된 글이 없으면 빈 상태를 표시합니다.
- 마우스를 올리거나 일시정지 버튼을 누르면 가장 가까운 메시지를 가운데에 맞춰 정지합니다. 휴대폰에서 터치해도 멈추지 않습니다. 화면 밖/다른 탭에서는 흐르지 않습니다.
- 운영체제의 움직임 줄이기 설정이면 자동 재생을 기본 정지합니다.
- 긴 글은 전체 보기로 확인할 수 있습니다. 사용자 글은 HTML로 실행하지 않고 텍스트로 출력합니다.
- 저장 응답이 끊기면 자동 재전송하지 않습니다. 새로고침으로 등록 여부를 먼저 확인합니다.
- 별명만 브라우저에 기억하며, 응원 데이터는 구글시트에서 조회합니다.

서버는 **나로 실행 / 모든 사용자 접근** 웹 앱으로 배포해야 합니다. Google Workspace 정책에 따라 외부 접근이 제한될 수 있습니다. `mode: 'no-cors'`는 응답 확인을 막으므로 사용하지 않습니다. 다른 도메인에서의 최종 저장 응답은 실제 배포 환경에서 확인하세요.

관리자는 구글시트의 공개여부를 `N`으로 바꾸어 글을 숨길 수 있습니다. 기존 서버에는 로그인 인증/CAPTCHA/강한 도배 차단이 없으므로 공개 운영 규모가 커지면 별도 보완이 필요합니다.

## 로컬 실행

이 폴더에서 `python3 -m http.server 8000`을 실행하고 `http://localhost:8000`에 접속합니다.

## 수정

소개 문구는 `index.html`, 색상은 `styles.css`의 `:root`, 프로젝트 상세 내용은 `app.js`의 `projects`를 수정하세요. 구글시트·Apps Script의 관리자 정보나 API 비밀키를 이 저장소에 올리지 마세요.

Google Fonts의 Noto Sans KR을 사용하며, 로딩되지 않으면 시스템 글꼴로 표시합니다. 프로젝트 카드 화면은 구현 아이디어를 소개하는 예시로, 실제 완성 앱이나 사용자 후기로 표시하지 않습니다.

## 참고

- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/content
