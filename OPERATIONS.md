# Flow ERP 운영·복구 절차

## 배포 준비

1. Node.js 20 이상과 MySQL 8을 준비합니다. 앱은 HTTPS를 제공하는 리버스 프록시 뒤에서 실행하고, DB 포트는 앱 서버에서만 접근하도록 제한합니다.
2. `.env.local` 또는 배포 환경변수에 DB 접속 정보와 임의의 `AUTH_SECRET`을 설정합니다. 관리자 MFA를 쓸 때는 `MFA_ENCRYPTION_KEY`에 `openssl rand -base64 32`로 생성한 키를 설정하고 비밀번호 저장소에 별도 백업합니다. 이 키를 잃으면 저장된 MFA 비밀을 복호화할 수 없습니다.
3. `UPLOAD_DIR`을 `public` 바깥의 영속 저장소로 설정합니다. 여러 앱 인스턴스를 운영하면 모든 인스턴스가 같은 읽기·쓰기 저장소를 사용해야 합니다. 앱 사용자에게 디렉터리 접근 권한을 주고, 웹 서버가 이 경로를 직접 공개하지 않게 합니다. 리버스 프록시의 요청 본문 제한도 11MB 정도로 설정합니다.
4. 코드 배포 전 DB 백업을 만들고 `npm run migration:show`로 대기 마이그레이션을 확인한 뒤 `npm run migration:run`을 실행합니다. 마이그레이션은 명시적으로 관리하며 TypeORM `synchronize`는 켜지 않습니다.
5. `npm run build`로 앱을 빌드하고 프로세스 관리자나 컨테이너로 `npm start`를 실행합니다. `GET /api/health`는 앱과 DB 연결을 함께 확인합니다. 배포 환경에서 `scripts/health-check.ps1 -BaseUrl https://서비스주소`를 주기적으로 실행하도록 모니터에 등록하면 상태 확인과 실패 감지를 자동화할 수 있습니다. `OPS_ALERT_WEBHOOK`과 선택적 `OPS_ALERT_TOKEN`을 지정하면 점검 실패를 알림 웹훅으로 보냅니다. 관리자 MFA도 설정합니다.
6. GitHub 저장소는 `.github/workflows/ci.yml`에서 Node 20 설치, 의존성 잠금 설치, 빌드를 수행합니다. 배포 대상 서비스가 저장소에 지정되지 않아 공급자 전용 배포 단계를 넣지 않았습니다. CI 성공 이후 서비스 플랫폼의 배포 연결을 설정하세요.

## 백업

DB와 업로드 파일은 한 번의 백업 세트로 보관합니다. 가능하면 짧은 점검 시간 동안 쓰기를 멈추고, MySQL `mysqldump`의 일관된 트랜잭션 스냅샷과 업로드 저장소 스냅샷을 함께 만듭니다. 백업 파일과 저장소를 암호화된 접근 통제 저장소에 복사합니다.

```bash
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
mysqldump --single-transaction --routines --triggers --events "$DB_NAME" > "flow-erp-db-$backup_stamp.sql"
tar -czf "flow-erp-uploads-$backup_stamp.tar.gz" -C "$UPLOAD_DIR" .
```

DB 비밀번호를 명령행 인자에 넣지 말고, MySQL 옵션 파일이나 비밀 관리자를 사용합니다. 백업 크기와 종료 코드를 확인하고 DB 덤프, 업로드 아카이브, 배포 버전, 마이그레이션 상태를 같은 시각 정보로 묶어 기록합니다. 보존 기간은 조직 정책에 맞추고 오래된 백업을 주기적으로 정리합니다.

Windows 운영 환경에서는 `scripts/backup.ps1`을 작업 스케줄러에 등록할 수 있습니다. `DB_PASSWORD`는 작업 계정의 보호된 환경변수로 제공하고, 업로드 경로와 접근 제한된 출력 경로를 지정합니다. 스크립트는 DB 덤프, 업로드 아카이브, 두 파일의 크기와 SHA-256을 담은 JSON 매니페스트를 같은 UTC 시각 접두사로 생성하며 오래된 파일을 자동 삭제하지 않습니다.

```powershell
./scripts/backup.ps1 -DatabaseName $env:DB_NAME -UploadDir $env:UPLOAD_DIR -OutputDir D:\backups -MysqlHost $env:DB_HOST -MysqlUser $env:DB_USER
```

## 복구

1. 먼저 격리된 복구 환경에서 절차를 검증합니다. 운영 복구가 필요하면 복구 시점과 영향 범위를 정하고 쓰기를 중지합니다.
2. 같은 백업 시점의 DB 덤프와 `UPLOAD_DIR` 아카이브를 복원합니다. 업로드 파일을 복원한 뒤 앱 계정의 파일 권한을 설정합니다.
3. `npm run migration:show`로 DB가 해당 앱 릴리스의 스키마와 맞는지 확인합니다. 실패한 DDL 마이그레이션은 자동 롤백됐다고 가정하지 말고 DB 상태를 점검한 뒤 정방향 복구 계획을 세웁니다.
4. 앱을 시작해 `/api/health`, 관리자 로그인과 MFA, 프로젝트 권한, 문서 다운로드, 보고서와 댓글을 확인합니다. 점검이 끝난 뒤 쓰기를 재개합니다.

DB와 파일 저장소는 서로 다른 시점으로 복원하면 문서 메타데이터와 실제 파일이 어긋날 수 있으므로 같은 백업 세트를 사용합니다. 정기 복구 훈련으로 백업이 실제로 복원되는지 확인합니다.

격리된 복구 환경에서의 예시는 다음과 같습니다. 복구 DB와 새 업로드 디렉터리를 먼저 준비하고, 앱은 검증을 마칠 때까지 그 복구 환경에만 연결합니다.

```bash
mysql "$RESTORE_DB_NAME" < "flow-erp-db-$backup_stamp.sql"
mkdir -p "$RESTORE_UPLOAD_DIR"
tar -xzf "flow-erp-uploads-$backup_stamp.tar.gz" -C "$RESTORE_UPLOAD_DIR"
```

## 알림 전달

사용자는 알림 설정 화면에서 이벤트별 앱 알림을 조정할 수 있습니다. 이메일 전달을 켜려면 `NOTIFICATION_WEBHOOK_URL`에 신뢰하는 메일 릴레이의 POST 엔드포인트를 지정하고, 필요하면 `NOTIFICATION_WEBHOOK_TOKEN`에 Bearer 토큰을 설정합니다. 요청 본문은 `{ to, subject, text, href }` JSON입니다. 웹훅 미설정 환경에서는 이메일 선택이 잠겨 있으며 전송은 시도하지 않습니다. 웹훅이 느리거나 실패하면 핵심 업무 저장은 유지되고 이메일 알림만 실패할 수 있습니다.

## 복구 훈련

`scripts/recovery-drill.ps1`은 기본적으로 드라이런입니다. 실제 격리 복구는 전용 MySQL 계정과 빈 복구 디렉터리를 준비한 후 아래처럼 실행합니다. 스크립트는 고유한 `flow_erp_drill_*` DB를 만들고 덤프·업로드를 복원한 뒤 필수 테이블을 확인합니다. 복구 결과는 검토 전 자동 삭제하지 않습니다.

```powershell
$env:RECOVERY_DB_PASSWORD = (Read-Host 'Recovery database password' -AsSecureString | ConvertFrom-SecureString -AsPlainText)
./scripts/recovery-drill.ps1 -DatabaseDump D:\backups\db.sql -UploadsArchive D:\backups\uploads.tar.gz -RestoreRoot D:\recovery -MysqlHost 127.0.0.1 -MysqlUser recovery_user
./scripts/recovery-drill.ps1 -DatabaseDump D:\backups\db.sql -UploadsArchive D:\backups\uploads.tar.gz -RestoreRoot D:\recovery -MysqlHost 127.0.0.1 -MysqlUser recovery_user -Execute
```

복구 후에는 출력된 DB와 업로드 경로에 앱을 격리 연결하여 로그인, 문서 다운로드, 보고서 확인까지 완료해야 훈련을 마친 것입니다.

## 보안 기능

- 관리자 MFA는 TOTP 인증 앱을 사용합니다. 로그인은 6자리 코드 또는 1회용 복구 코드를 요구하며 세션은 최대 8시간입니다. 복구 코드는 생성 시 한 번만 보여주므로 오프라인의 안전한 곳에 저장합니다. MFA 암호화 키는 백업하고 운영·스테이징에서 서로 다르게 관리합니다.
- 로그인은 이메일 해시 기준 15분 내 5회 실패 후 새 시도를 제한합니다. 민감한 AI 초안, 초대, 댓글, MFA 변경, 업로드 요청은 DB 기반 제한을 사용합니다.
- 문서 업로드는 프로젝트 권한을 확인하고 허용된 형식만 받습니다. 멀티 인스턴스 환경에서는 공유 업로드 저장소와 DB를 함께 백업합니다.
