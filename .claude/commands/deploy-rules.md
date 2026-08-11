---
description: Deploy firestore.rules to the live moneyduo-b4af3 Firebase project
---

<!-- /deploy-rules: firestore.rules를 실제 moneyduo-b4af3 Firebase 프로젝트에 배포하는 명령어 -->
<!-- firestore.rules를 고친 뒤 git push만 하고 배포를 깜빡하면, 로컬 규칙 파일과 실제 서버 규칙이 어긋나서 "Missing or insufficient permissions" 에러가 날 수 있음 -->
<!-- npm run deploy:rules → package.json에 등록된 스크립트, 실제로는 firebase deploy --only firestore:rules 실행 -->
Run `npm run deploy:rules` (which runs `firebase deploy --only firestore:rules`) to deploy the current [firestore.rules](../../firestore.rules) to the live Firebase project. Show the command output to the user. This only pushes security rules — it does not touch app code or hosting.
