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

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트를 생성하세요.
2. 프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Supabase 대시보드에서 SQL Editor를 열고 `supabase/migrations/001_create_projects_table.sql` 파일의 내용을 실행하여 `projects` 테이블을 생성하세요.

### 3. 개발 서버 실행

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
- **Supabase** - 백엔드 및 데이터베이스

