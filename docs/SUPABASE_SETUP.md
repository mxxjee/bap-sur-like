# Supabase 평가 기능 설정 가이드

[README로 돌아가기](../README.md)

밥서라이크는 브라우저에서 Supabase JavaScript Client를 사용해 평가를 등록하고 최근 평가, 평균 별점, 전체 평가 수를 조회합니다. 정적 GitHub Pages에서도 동일한 흐름이 유지되며, 서버 전용 비밀 정보는 사용하지 않습니다.

## 1. Supabase 프로젝트 준비

1. Supabase Dashboard에서 새 프로젝트를 생성합니다.
2. 프로젝트가 준비되면 SQL Editor를 엽니다.
3. 저장소의 [`supabase_setup.sql`](../supabase_setup.sql) 내용을 실행합니다.

SQL은 `public.feedback` 테이블과 생성 시간 인덱스를 만들고 RLS를 활성화합니다. 익명 사용자와 로그인 사용자는 유효한 평가를 `INSERT`하고 평가를 `SELECT`할 수 있지만, 클라이언트에서 `UPDATE`하거나 `DELETE`할 수 없습니다.

## 2. `feedback` 테이블 구조

| 필드 | 용도 |
| --- | --- |
| `id` | 평가 식별자 |
| `created_at` | 평가 생성 시각 |
| `rating` | 1~5점 별점 |
| `comment` | 최대 500자의 의견 |
| `game_version` | 평가 당시 게임 버전 |
| `result` | 미완료, 승리, 패배 상태 |
| `survival_time` | 생존 시간(초) |
| `final_level` | 최종 레벨 |
| `kill_count` | 처치 수 |
| `max_body_stage` | 플레이 중 도달한 최대 몸집 단계 |

기존 웹 클라이언트와의 호환성을 위해 테이블 이름과 필드 이름을 임의로 변경하거나 제거하지 마세요.

## 3. 공개용 브라우저 설정

Supabase Dashboard의 프로젝트 설정/API 화면에서 다음 공개용 값만 확인합니다.

- Project URL
- Publishable Key 또는 legacy anon key

[`supabase-config.example.js`](../supabase-config.example.js)를 참고해 저장소 최상위의 `supabase-config.js`를 구성합니다.

```javascript
window.BAPSUR_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  key: "YOUR_PUBLISHABLE_KEY"
};
```

전역 객체 이름 `window.BAPSUR_SUPABASE_CONFIG`와 `url`, `key` 속성 이름은 기존 연동에서 사용하므로 변경하지 마세요. 응답이나 문서에 실제 프로젝트 값을 복사해 노출하지 마세요.

## 4. 스크립트 로드 순서

`index.html`의 런타임 스크립트와 설정 로드는 다음 순서를 유지해야 합니다.

1. `vendor/supabase.min.js`
2. `feedback.js`
3. `game.js`

`feedback.js`는 초기화 중 `./supabase-config.js`를 상대경로로 선택 로드한 뒤 Supabase 클라이언트를 생성합니다. 클라이언트 라이브러리가 먼저 준비되고 평가 모듈이 설정을 로드한 뒤 게임 코드가 실행되는 현재 구조를 유지해야 등록·조회 흐름이 정상 동작합니다.

## 5. 로컬 연동 확인

정적 웹서버를 실행한 뒤 다음 순서로 확인합니다.

1. 시작 화면에서 의견 남기기 모달을 엽니다.
2. 별점을 선택하지 않은 상태로 전송해 입력 검증 안내를 확인합니다.
3. 1~5점 별점과 500자 이하 의견을 입력하고 한 번만 전송합니다.
4. Supabase Dashboard의 Table Editor에서 `feedback` 테이블에 행이 추가됐는지 확인합니다.
5. 게임에서 최근 평가 목록을 열어 방금 등록한 평가를 포함한 최대 10개의 최근 항목을 확인합니다.
6. 평균 별점과 전체 평가 수가 표시되는지 확인합니다.
7. 브라우저 Console에 치명적인 JavaScript 오류가 없는지 확인합니다.

테스트 평가를 반복해서 추가하지 마세요. 등록 테스트가 이미 완료된 환경에서는 기존 평가의 `SELECT`와 UI 표시를 확인하고, 새로운 `INSERT`는 실제로 필요할 때 한 번만 수행합니다.

## 6. INSERT와 SELECT 문제 확인

- `INSERT` 실패 시 브라우저 Console과 Supabase Dashboard의 Logs를 확인합니다.
- `rating`, `comment`, `result`, 생존 시간, 레벨, 처치 수가 SQL 제약 조건을 만족하는지 확인합니다.
- RLS가 활성화되어 있고 공개 `INSERT` 정책이 존재하는지 확인합니다.
- 조회 실패 시 공개 `SELECT` 정책과 `feedback` 테이블 권한을 확인합니다.
- UI에는 최근 10개 평가가 표시되며, 전체 평균과 개수는 별도의 집계 조회 결과를 사용합니다.
- Supabase가 연결되지 않으면 사용자 안내와 `localStorage` 임시 저장 흐름이 유지되어야 합니다.

## 7. GitHub Pages 배포

이 프로젝트는 정적 호스팅이므로 GitHub Pages에서 평가 기능을 사용하려면 `supabase-config.js`도 배포 대상 커밋에 포함되어야 합니다. 배포 전 이 파일에 공개용 Project URL과 Publishable/anon Key만 있는지 다시 확인하세요.

`index.html`, `vendor/supabase.min.js`, `supabase-config.js`, `feedback.js`, `game.js`의 상대경로와 로드 순서를 유지합니다. Pages 배포 후 공개 URL에서 평가 모달, 등록, 최근 평가, 평균 별점, 전체 평가 수와 Console 오류를 다시 확인합니다.

## 8. 보안 경계

Publishable Key와 legacy anon key는 RLS를 전제로 브라우저에서 사용하는 공개 식별 정보입니다. 이 값만으로 서버 관리자 권한을 부여해서는 안 되며, 실제 데이터 접근 범위는 RLS 정책으로 제한해야 합니다.

다음 값은 클라이언트 코드, Git 저장소, GitHub Pages, 문서, 이슈 또는 응답에 절대 추가하지 마세요.

- Secret Key
- `service_role` 키
- 데이터베이스 비밀번호
- PostgreSQL 연결 문자열
- 서버 전용 환경 변수 또는 관리자 토큰

비밀 정보가 발견되면 커밋하거나 Push하지 말고 노출된 키를 즉시 폐기·교체한 뒤 저장소 이력까지 별도로 점검해야 합니다. 공개용 Project URL과 Publishable/anon Key도 현재 정상 연동 값을 임의로 교체하지 마세요.
