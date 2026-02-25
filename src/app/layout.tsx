import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '무료 웹페이지 요약 서비스',
    description: 'URL을 입력하면 AI가 핵심 내용을 요약해줍니다.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <body>
                <main className="container">{children}</main>
            </body>
        </html>
    );
}
