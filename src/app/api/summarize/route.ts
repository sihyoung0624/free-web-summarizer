import { NextRequest, NextResponse } from 'next/server';
import { isValidUrl, extractContent } from '@/lib/utils';
import { generateSummary } from '@/lib/openai';
import { checkRateLimit, saveSummary } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('[API] GET request received for health check');
    return NextResponse.json({
        status: 'ok',
        version: '1.0.2',
        message: 'Summary API is ready. Use POST to summarize.'
    });
}

export async function POST(req: NextRequest) {
    console.log('[API] POST request started');
    try {
        // 1. IP 기반 레이트리밋 체크
        const isAllowed = await checkRateLimit(req);
        if (!isAllowed) {
            console.warn('[API] Rate limit exceeded');
            return NextResponse.json(
                { error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
                { status: 429 }
            );
        }

        // 2. 입력 URL 검증
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error('[API] JSON parse error');
            return NextResponse.json({ error: '올바르지 않은 요청 형식입니다.' }, { status: 400 });
        }

        const { url } = body;
        if (!url || !isValidUrl(url)) {
            console.warn('[API] Invalid URL provided:', url);
            return NextResponse.json(
                { error: '올바른 HTTP/HTTPS URL을 입력해주세요.' },
                { status: 400 }
            );
        }

        console.log('[API] Fetching content for:', url);

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
            console.error('[API] Target fetch failed:', response.status);
            return NextResponse.json(
                { error: `웹페이지를 가져오는데 실패했습니다: ${response.statusText}` },
                { status: response.status }
            );
        }

        let html = await response.text();

        // 메모리 최적화
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // 4. 본문 추출 및 요약
        const extracted = await extractContent(html, url);
        console.log('[API] Extraction success, length:', extracted.content.length);

        if (extracted.content.length < 100) {
            return NextResponse.json(
                { error: '페이지에서 본문 내용을 충분히 찾을 수 없습니다. 본문이 있는 기사 페이지를 시도해 보세요.' },
                { status: 400 }
            );
        }

        const summary = await generateSummary(extracted.content);

        // 5. 공유 ID 생성 및 저장
        const randomId = Math.random().toString(36).substring(2, 10);
        await saveSummary(randomId, {
            url,
            title: extracted.title,
            ...summary,
        });

        console.log('[API] Success! Summary ID:', randomId);
        return NextResponse.json({ id: randomId, ...summary });
    } catch (error: any) {
        console.error('[API] Fatal Error:', error);
        const message = error.name === 'AbortError' ? '요청 시간이 초과되었습니다 (10초).' : '요약 처리 중 오류가 생겼습니다.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
