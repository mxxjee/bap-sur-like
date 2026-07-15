# 밥서라이크

> 먹고, 커지고, 살아남아라!

`밥서라이크`는 무한리필 식당에서 몰려오는 음식 몬스터를 포크로 처치하고, 음식 조각을 직접 먹어 성장하며 3분 동안 살아남는 모바일 세로형 Canvas 웹게임입니다. HTML, CSS, JavaScript만 사용하며 별도의 빌드 과정 없이 GitHub Pages에서 실행됩니다.

## 핵심 규칙

1. 가장 가까운 음식 몬스터를 향해 포크가 자동으로 발사됩니다.
2. 처치된 몬스터는 경험치 음식 조각을 떨어뜨립니다.
3. 조각에 직접 접근해 먹으면 경험치와 몸집이 함께 증가합니다.
4. 몸집 단계가 커질수록 충돌 범위가 늘고 이동 속도는 느려집니다.
5. 경험치가 가득 차면 월드가 완전히 멈추고 강화 카드가 표시됩니다.
6. 강화를 선택하면 영구 능력치는 유지된 채 몸집과 임시 속도 감소가 초기화됩니다.
7. 체력이 0이 되면 패배하고 3분 동안 생존하면 승리합니다.

보스, NPC, 상점, 장비, 인벤토리, 로그인, 온라인 랭킹은 포함하지 않습니다.

## 조작 방법

### PC

- 이동: `W`, `A`, `S`, `D` 또는 방향키
- 일시 정지 / 재개: `ESC` 또는 `P`
- 레벨업 카드 선택: 숫자키 `1`, `2`, `3` 또는 마우스 클릭
- 공격: 자동

### 모바일

- 화면 왼쪽 아래 가상 조이스틱을 터치하고 드래그해 이동합니다.
- 터치를 놓으면 조이스틱이 중앙으로 돌아옵니다.
- 화면 위쪽의 일시 정지 버튼으로 게임을 멈추거나 재개합니다.
- 공격은 자동입니다.

## 로컬 실행

브라우저 보안 정책과 선택적 Supabase 설정 로딩을 위해 파일을 직접 여는 방식보다 정적 웹서버 사용을 권장합니다.

Python이 설치되어 있다면 저장소 최상위에서 다음 명령을 실행합니다.

```bash
python -m http.server 8000
```

Node.js가 있다면 다음과 같은 정적 서버도 사용할 수 있습니다.

```bash
npx serve .
```

이후 브라우저에서 `http://localhost:8000`에 접속합니다. 빌드와 패키지 설치는 필요하지 않습니다.

## GitHub Pages 배포

1. GitHub 저장소의 **Settings → Pages**로 이동합니다.
2. **Build and deployment**의 Source를 **Deploy from a branch**로 선택합니다.
3. 배포할 브랜치와 `/(root)` 폴더를 선택합니다.
4. 저장 후 표시되는 Pages URL로 접속합니다.

`index.html`은 저장소 최상위에 있고, CSS와 JavaScript는 모두 `./` 상대경로를 사용합니다. 따라서 `https://사용자.github.io/저장소명/` 형태의 프로젝트 하위 경로에서도 동작합니다.

## Supabase 평가 기능 설정

평가 기능을 설정하지 않아도 게임 플레이, 의견 입력 검증, 미연결 안내와 실패 평가의 로컬 임시 저장은 정상 동작합니다.

### 1. 프로젝트와 테이블 만들기

1. Supabase에서 새 프로젝트를 생성합니다.
2. Supabase 대시보드의 **SQL Editor**를 엽니다.
3. [supabase_setup.sql](./supabase_setup.sql)의 전체 내용을 실행합니다.

SQL은 다음을 구성합니다.

- `feedback` 테이블과 필드 검증 제약
- Row Level Security 활성화
- 익명 사용자의 `SELECT`, `INSERT` 정책
- 익명 사용자의 `UPDATE`, `DELETE` 권한 차단
- 최신순 조회를 위한 인덱스

### 2. 브라우저 연결 정보 설정

```bash
cp supabase-config.example.js supabase-config.js
```

Windows PowerShell에서는 다음 명령을 사용할 수 있습니다.

```powershell
Copy-Item .\supabase-config.example.js .\supabase-config.js
```

생성한 `supabase-config.js`의 값을 Supabase 프로젝트 설정에 표시되는 Project URL과 Publishable Key로 바꿉니다.

```javascript
window.BAPSUR_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  key: "YOUR_PUBLISHABLE_OR_ANON_KEY"
};
```

브라우저에는 Publishable Key 또는 legacy anon key만 사용합니다. Secret Key, `service_role` 키, 데이터베이스 비밀번호는 절대로 넣지 마세요.

`supabase-config.js`는 [.gitignore](./.gitignore)에 포함되어 Git에 올라가지 않습니다. 배포 환경에는 이 파일을 별도 배치해야 하며, 공개 웹앱에서 사용하는 Publishable/anon 키의 실제 보안 경계는 [supabase_setup.sql](./supabase_setup.sql)의 RLS 정책입니다.

### 3. 평가 데이터 확인

Supabase 대시보드의 **Table Editor → feedback**에서 등록된 별점, 의견, 게임 결과와 플레이 통계를 확인할 수 있습니다. 게임의 `평가 보기` 화면은 최신 평가를 최대 10개 표시합니다.

전송이 실패하면 평가가 브라우저 `localStorage`의 `bapsur-pending-feedback`에 최대 20개 임시 저장되며, 다음에 Supabase가 연결되었을 때 다시 전송을 시도합니다.

## 주요 파일과 클래스

| 파일 | 역할 |
| --- | --- |
| `index.html` | Canvas, HUD, 시작·조작·레벨업·일시정지·결과·평가 화면 |
| `style.css` | 9:16 반응형 레이아웃과 전체 도트 UI |
| `game.js` | 게임 루프, 전투, 경험치, 몸집, 레벨업, 입력, 도트 렌더링 |
| `feedback.js` | 평가 검증, Supabase 등록·조회, 미연결·실패 처리 |
| `vendor/supabase.min.js` | 상대경로로 포함한 공식 Supabase JavaScript 브라우저 클라이언트 |
| `assets/favicon.svg` | 직접 제작한 픽셀 밥그릇 파비콘 |
| `supabase-config.example.js` | 공개 브라우저 연결 정보 예시 |
| `supabase_setup.sql` | 테이블, 제약 조건, RLS 정책과 권한 설정 |

`game.js`의 주요 클래스는 다음과 같습니다.

- `Game`: 상태 전환, 게임 루프, 충돌, UI 갱신
- `Player`: 영구 능력치와 임시 몸집·속도 상태
- `Enemy`, `Projectile`, `ExperienceFood`: 월드 객체
- `UpgradeManager`: 중복 없는 강화 후보와 최대 단계
- `VirtualJoystick`: 단일 Pointer ID 기반 모바일 입력
- `SpriteRenderer`: 사각 픽셀 조합 도트 스프라이트
- `AudioManager`: Web Audio API 효과음
- `FeedbackManager`: Supabase와 평가 모달

## 구현된 기능

- 225 × 400 내부 해상도의 9:16 Canvas와 픽셀 확대
- 키보드와 가상 조이스틱 이동, 자동 포크 공격
- 감자튀김, 햄버거, 도넛, 피자, 케이크 도트 몬스터와 2프레임 이동 애니메이션
- 시간대별 적 추가·체력·속도·생성 빈도 상승
- 체력, 피격 무적, 붉은 점멸, 밀어내기, 화면 흔들림
- 최대 100마리의 적, 200개의 경험치 조각, 360개의 파티클 제한
- 경험치 조각 흡수, 섭취 연출, 4단계 몸집·속도 시스템
- 월드가 정지하는 레벨업과 누적 가능한 8종 강화
- 일반 일시 정지와 레벨업 상태 분리
- 승리·패배 통계, 재시작, 메인 화면 복귀
- Web Audio API 효과음과 음소거
- 별점·500자 의견 모달, Supabase 평가 등록·조회, RLS SQL
- Supabase 미설정 안내와 실패 의견 `localStorage` 임시 저장

## 현재 제한사항

- Supabase 프로젝트와 `supabase-config.js`는 배포자가 직접 구성해야 합니다.
- 온라인 평가 기능은 실제 Supabase 연결 정보와 네트워크가 있어야 통합 확인할 수 있습니다.
- 게임 진행 데이터나 최고 점수는 저장하지 않습니다.
- 도트 그래픽은 별도 이미지 파일 대신 Canvas 사각 픽셀 조합으로 렌더링합니다.
