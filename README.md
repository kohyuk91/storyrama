# StoryRama

Next.js 15 프로젝트 with TypeScript and TailwindCSS

## 시작하기

### 1. 의존성 설치

```bash
npm install
# 또는
yarn install
# 또는
pnpm install
```

### 2. Clerk 설정

1. [Clerk](https://clerk.com)에서 새 애플리케이션을 생성하세요.
2. `.env.local` 파일에 Clerk API 키를 추가하세요:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트를 생성하세요.
2. `.env.local` 파일에 Supabase 설정을 추가하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Supabase 대시보드에서 SQL Editor를 열고 다음 순서로 마이그레이션을 실행하세요:
   - `supabase/migrations/001_create_projects_table.sql` - projects 테이블 생성
   - `supabase/migrations/002_add_user_id_to_projects.sql` - user_id 컬럼 추가
   - `supabase/migrations/003_create_scenes_table.sql` - scenes 테이블 생성
   - `supabase/migrations/004_create_shots_table.sql` - shots 테이블 생성

### 4. 개발 서버 실행

```bash
npm run dev
# 또는
yarn dev
# 또는
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

## 프로젝트 구조

```
STORYRAMA/
├── app/                # App Router 디렉토리
│   ├── layout.tsx     # 루트 레이아웃
│   ├── page.tsx       # 홈 페이지
│   └── globals.css    # 전역 스타일
├── public/            # 정적 파일
├── package.json
├── tsconfig.json      # TypeScript 설정
├── next.config.ts     # Next.js 설정
└── tailwind.config.ts # TailwindCSS 설정
```

## 기술 스택

- **Next.js 15** - React 프레임워크
- **TypeScript** - 타입 안정성
- **TailwindCSS** - 유틸리티 기반 CSS 프레임워크
- **React 19** - UI 라이브러리
- **Clerk** - 인증 및 사용자 관리
- **Supabase** - 백엔드 및 데이터베이스

