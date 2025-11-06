import type { Metadata } from 'next';
import './globals.css';
import ConditionalNavbar from '@/components/ConditionalNavbar';
import ClerkProviderWrapper from '@/components/ClerkProviderWrapper';

export const metadata: Metadata = {
  title: 'StoryRama',
  description: 'StoryRama application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <ClerkProviderWrapper>
          <ConditionalNavbar />
          {children}
        </ClerkProviderWrapper>
      </body>
    </html>
  );
}

