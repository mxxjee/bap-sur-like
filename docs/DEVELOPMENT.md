# 밥서라이크 개발 가이드

[README로 돌아가기](../README.md)

밥서라이크는 별도 빌드 과정 없이 정적 웹서버에서 실행되는 HTML, CSS, JavaScript 프로젝트입니다. `index.html`은 저장소 최상위에 있으며 모든 런타임 파일은 상대경로로 연결됩니다.

## 저장소 받기

```bash
git clone https://github.com/mxxjee/bap-sur-like.git
cd bap-sur-like
git switch feature/polish-pass
```

기능 개발을 시작할 때는 최신 기준 브랜치에서 작업 목적에 맞는 새 브랜치를 만드세요.

```bash
git switch feature/polish-pass
git pull --ff-only
git switch -c feature/작업-이름
```

## 로컬 정적 웹서버 실행

`index.html`을 파일로 직접 열지 말고 저장소 최상위 경로에서 정적 웹서버를 실행합니다.

### Python

```bash
python -m http.server 8000 --bind 0.0.0.0
```

Windows에서 `python` 명령이 등록되지 않았다면 다음 명령을 사용할 수 있습니다.

```bash
py -m http.server 8000 --bind 0.0.0.0
```

### Node.js

```bash
npx serve . -l 8000
```

실행 후 PC 브라우저에서 `http://localhost:8000`에 접속합니다. 서버를 종료하려면 실행한 터미널에서 `Ctrl+C`를 누릅니다.

## PC 브라우저 테스트

1. 브라우저 확대율을 100%로 맞춥니다.
2. 시작 화면, 게임 시작, 키보드 이동, 자동 공격을 확인합니다.
3. 경험치 음식 조각 획득, 몸집 변화, 레벨업, 강화 선택을 확인합니다.
4. 일시 정지와 재시작을 확인합니다.
5. 의견 남기기 모달과 최근 평가 조회를 확인합니다.
6. 개발자 도구 Console에 치명적인 JavaScript 오류가 없는지 확인합니다.

## Chrome 모바일 에뮬레이션

1. Chrome 개발자 도구를 엽니다.
2. Device Toolbar를 활성화합니다.
3. 세로 화면을 선택하고 360×640, 375×667, 390×844, 412×915 등 여러 크기를 테스트합니다.
4. 게임 컨테이너가 화면 안에 들어오는지, UI가 겹치지 않는지 확인합니다.
5. 중앙 하단 가상 조이스틱의 방향, 아날로그 입력, 최대 반경, 중앙 복귀를 확인합니다.
6. 화면 크기를 바꾼 뒤에도 조이스틱 중심 좌표와 입력 방향이 일치하는지 확인합니다.

에뮬레이션은 레이아웃과 포인터 입력을 빠르게 확인하는 용도입니다. 실제 모바일 브라우저의 터치, 주소 표시줄, 안전 영역 동작은 실기기에서도 확인하는 것이 좋습니다.

## 같은 Wi-Fi의 모바일 기기에서 테스트

1. PC와 모바일 기기를 같은 Wi-Fi 네트워크에 연결합니다.
2. PC에서 `--bind 0.0.0.0` 옵션으로 정적 서버를 실행합니다.
3. 운영체제 네트워크 설정에서 PC의 IPv4 주소를 확인합니다.
4. 모바일 브라우저에서 `http://<PC의-IPv4-주소>:8000`으로 접속합니다.

방화벽이 접속을 차단하면 사용 중인 사설 네트워크에서 해당 정적 서버 프로그램과 포트만 허용하세요. 공용 네트워크에서 무분별하게 포트를 열거나 방화벽 전체를 비활성화하지 마세요. 테스트가 끝나면 불필요한 허용 규칙을 정리하세요.

## 브랜치와 커밋 작업 흐름

- 보관용 기준 브랜치와 `main`을 직접 수정하지 않습니다.
- 작업 전에 `git status --short --branch`로 브랜치와 변경 파일을 확인합니다.
- 하나의 작업 범위에 필요한 파일만 수정하고, Supabase 연동과 게임 핵심 규칙의 회귀 여부를 확인합니다.
- `git diff --check`와 `git diff`로 공백 오류와 실제 변경 내용을 검토합니다.
- 필요한 파일만 Stage한 뒤 목적이 드러나는 커밋 메시지를 사용합니다.
- 사용자 확인이나 배포 정책에 따라 현재 작업 브랜치를 원격에 Push합니다.
- 검토와 승인을 거친 뒤에만 `main` 병합을 진행합니다.

일반적인 확인 명령은 다음과 같습니다.

```bash
git status --short --branch
git diff --check
git diff --stat
git add README.md docs/
git commit -m "docs: describe the change"
git push -u origin 현재-브랜치
```

## GitHub Pages 배포 전 점검

- 저장소 최상위에 `index.html`이 있는지 확인합니다.
- HTML, CSS, JavaScript, 이미지 경로가 `/style.css` 같은 루트 절대경로가 아니라 `./style.css` 또는 `style.css` 같은 상대경로인지 확인합니다.
- 대소문자를 포함한 파일 이름과 참조 경로가 정확히 일치하는지 확인합니다.
- `supabase-config.js`가 배포 대상에 포함되고 공개용 Project URL과 Publishable/anon Key만 담고 있는지 확인합니다.
- Secret Key, `service_role` 키, 데이터베이스 비밀번호, PostgreSQL 연결 문자열이 없는지 확인합니다.
- 로컬 정적 서버에서 게임과 평가 등록·조회 기능을 테스트합니다.
- 배포 대상 브랜치에 필요한 변경이 모두 커밋되고 원격에 Push됐는지 확인합니다.
- GitHub 저장소의 Pages 설정과 실제 공개 URL은 저장소 관리자 권한으로 별도 확인합니다.

## 상대경로 원칙

GitHub Pages의 프로젝트 사이트는 저장소 이름 아래 경로에서 서비스될 수 있습니다. 따라서 런타임 파일은 현재 문서를 기준으로 찾는 상대경로를 사용해야 합니다.

```html
<link rel="stylesheet" href="./style.css">
<script src="./vendor/supabase.min.js"></script>
<script src="./feedback.js"></script>
<script src="./game.js"></script>
```

`feedback.js`는 클라이언트를 초기화하기 전에 `./supabase-config.js`를 상대경로로 선택 로드합니다. `/style.css`, `/game.js`처럼 도메인 루트를 가리키는 경로는 프로젝트형 GitHub Pages에서 깨질 수 있으므로 사용하지 않습니다.

Supabase 연동을 설정하거나 점검할 때는 [Supabase 설정 가이드](./SUPABASE_SETUP.md)를 함께 확인하세요.
