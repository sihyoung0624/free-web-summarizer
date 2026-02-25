import { NextRequest, NextResponse } from 'next/server';
import { isValidUrl, extractContent } from '@/lib/utils';
import { generateSummary } from '@/lib/openai';
import { checkRateLimit, saveSummary } from '@/lib/kv';

export async function POST(req: NextRequest) {
    try {
        // 1. IP 기반 레이트리밋 체크
        const isAllowed = await checkRateLimit(req);
        if (!isAllowed) {
            return NextResponse.json(
                { error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
                { status: 429 }
            );
        }

        // 2. 입력 URL 검증
        const { url } = await req.json();
        if (!url || !isValidUrl(url)) {
            return NextResponse.json(
                { error: '올바른 HTTP/HTTPS URL을 입력해주세요.' },
                { status: 400 }
            );
        }

        // 3. 웹페이지 HTML 가져오기 (타임아웃 10초)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return NextResponse.json(
                { error: `웹페이지를 가져오는데 실패했습니다: ${response.statusText}` },
                { status: response.status }
            );
        }

        const html = await response.text();

        // 4. 본문 추출 및 요약
        const extracted = await extractContent(html, url);
        const summary = await generateSummary(extracted.content);

        // 5. 공유 ID 생성 및 저장
        const randomId = Math.random().toString(36).substring(2, 10);
        await saveSummary(randomId, {
            url,
            title: extracted.title,
            ...summary,
        });

        return NextResponse.json({ id: randomId, ...summary });
    } catch (error: any) {
        console.error('Summary Error:', error);
        const message = error.name === 'AbortError' ? '요청 시간이 초과되었습니다 (10초).' : '요약 처리 중 오류가 발생했습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
