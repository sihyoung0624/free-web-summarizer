import { getSummary } from '@/lib/kv';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function SharePage({ params }: { params: { id: string } }) {
    const data: any = await getSummary(params.id);

    if (!data) {
        return (
            <div className="share-container error">
                <h1>만료되었거나 잘못된 링크입니다.</h1>
                <p>링크가 생성된지 7일이 지났거나 잘못된 주소입니다.</p>
                <Link href="/" className="btn-primary">홈으로 돌아가기</Link>
            </div>
        );
    }

    return (
        <div className="share-container">
            <header className="share-header">
                <h1 className="title">{data.title || '웹페이지 요약'}</h1>
                <p className="one-line">"{data.one_line}"</p>
            </header>

            <div className="result-card">
                <section className="summary-section">
                    <h3>핵심 포인트</h3>
                    <ul className="bullets">
                        {data.bullets.map((b: string, i: number) => (
                            <li key={i}>{b}</li>
                        ))}
                    </ul>
                </section>

                {data.numbers && data.numbers.length > 0 && (
                    <section className="numbers-section">
                        <h3>중요 숫자 / 조건</h3>
                        <ul className="numbers">
                            {data.numbers.map((n: string, i: number) => (
                                <li key={i}>{n}</li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="footer-links">
                    <a href={data.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                        원문 바로가기
                    </a>
                </div>
            </div>
        </div>
    );
}
