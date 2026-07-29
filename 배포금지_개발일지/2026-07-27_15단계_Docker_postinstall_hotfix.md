# 15단계 개발일지 — Docker postinstall hotfix

## 장애

- main 병합 후 운영 이미지 빌드의 dependencies 단계에서 `npm ci`가 실패했다.
- package lifecycle의 postinstall이 실행하는 호환성 스크립트가 해당 Docker stage에 복사되지 않은 것이 원인이었다.
- 이미지 빌드 단계에서 중단되어 기존 운영 컨테이너 교체와 마이그레이션은 시작되지 않았다.

## 수정

- package manifest 다음에 필요한 postinstall 스크립트 한 파일만 dependencies stage로 복사한다.
- 전체 소스나 비밀값을 의존성 레이어에 포함하지 않는다.
- Dockerfile에서 스크립트 복사가 `npm ci`보다 먼저인지 확인하는 회귀 테스트를 추가한다.

## 추적

- GitHub Issue #96
- 브랜치: `hotfix/docker-postinstall`
