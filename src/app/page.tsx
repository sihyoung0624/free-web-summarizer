'use client';

import { useState } from 'react';

export default function Home() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<any>(null);

    const handleSummarize = async () => {
        if (!url) return;
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch(`/api/summarize?t=${Date.now()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const responseText = await res.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch (e) {
                // JSON 파싱 실패 (HTML 에러 페이지 등)
                throw new Error(`서버 응답 오류 (상태 코드: ${res.status}). 잠시 후 다시 시도해주세요.`);
            }

            if (!res.ok) {
                throw new Error(data.error || '요약 중 오류가 발생했습니다.');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyShareLink = (id: string) => {
        const link = `${window.location.origin}/s/${id}`;
        navigator.clipboard.writeText(link);
        alert('공유 링크가 복사되었습니다!');
    };

    return (
        <div className="home-wrapper">
            <header className="home-header">
                <h1 className="title">Web Summary AI</h1>
                <p className="subtitle">긴 글 읽지 마세요, 핵심만 요약해드립니다.</p>
            </header>

            <div className="input-box">
                <input
                    type="url"
                    placeholder="요약할 웹페이지 URL을 입력하세요 (http/https)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSummarize()}
                />
                <button
                    className="btn-primary"
                    onClick={handleSummarize}
                    disabled={loading || !url}
                >
                    {loading ? <div className="spinner"></div> : '요약하기'}
                </button>
            </div>

            {error && <p className="error-message">{error}</p>}

            {result && (
                <div className="result-card">
                    <p className="one-line">"{result.one_line}"</p>

                    <section>
                        <h3>핵심 포인트</h3>
                        <ul className="bullets">
                            {result.bullets.map((b: string, i: number) => (
                                <li key={i}>{b}</li>
                            ))}
                        </ul>
                    </section>

                    {result.numbers && result.numbers.length > 0 && (
                        <section>
                            <h3>중요 숫자 / 조건</h3>
                            <ul className="numbers">
                                {result.numbers.map((n: string, i: number) => (
                                    <li key={i}>{n}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <div className="footer-links">
                        <button className="btn-secondary" onClick={() => copyShareLink(result.id)}>
                            공유 링크 복사
                        </button>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                            원문 보기
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
