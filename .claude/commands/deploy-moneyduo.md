---
description: 수정된 파일을 커밋하고 원격 브랜치로 push
---

<!-- /deploy-moneyduo: 사용자가 수정한 파일들을 확인해서 git commit 후 push까지 한 번에 처리하는 명령어 -->
현재 브랜치의 변경사항을 커밋하고 push한다.

1. `git status`와 `git diff`로 변경된 파일을 확인한다.
2. 변경사항이 없으면 그 사실을 알리고 종료한다.
3. 비밀정보(.env, credentials 등)로 보이는 파일은 제외하고 관련 파일만 `git add`한다.
4. 변경 내용을 요약하는 커밋 메시지를 한글로 작성해 커밋한다 (메시지 끝에 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` 포함).
5. 현재 브랜치를 원격으로 push한다 (upstream이 없으면 `-u`로 설정).
6. 결과를 한글로 간단히 요약해서 보여준다.
