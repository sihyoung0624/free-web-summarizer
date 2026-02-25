import { NextRequest, NextResponse } from 'next/server';
import { isValidUrl, extractContent } from '@/lib/utils';
import { generateSummary } from '@/lib/openai';
import { checkRateLimit, saveSummary } from '@/lib/kv';

export async function GET() {
    return NextResponse.json({ message: 'Summary API is active. Please use POST method to summarize URLs.' });
}

export async function POST(req: NextRequest) {
    console.log('[API] POST request received');
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
            console.error('[API] Failed to parse request JSON');
            return NextResponse.json({ error: '올바르지 않은 요청 형식입니다.' }, { status: 400 });
        }

        const { url } = body;
        console.log(`[API] Processing URL: ${url}`);

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
            console.error(`[API] Failed to fetch target URL. Status: ${response.status}`);
            return NextResponse.json(
                { error: `웹페이지를 가져오는데 실패했습니다: ${response.statusText}` },
                { status: response.status }
            );
        }

        let html = await response.text();
        console.log(`[API] Fetched HTML length: ${html.length}`);

        // 메모리 절약을 위해 스크립트 및 스타일 태그 제거
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // 4. 본문 추출 및 요약
        const extracted = await extractContent(html, url);
        console.log(`[API] Extracted content length: ${extracted.content.length}`);

        if (extracted.content.length < 100) {
            return NextResponse.json(
                { error: '페이지에서 충분한 정보를 찾을 수 없습니다. 뉴스 기사 같은 본문이 있는 페이지를 입력해 보세요.' },
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

        console.log(`[API] Successfully summarized. ID: ${randomId}`);
        return NextResponse.json({ id: randomId, ...summary });
    } catch (error: any) {
        console.error('Summary API Error:', error);

        let message = '요약 처리 중 오류가 발생했습니다.';
        if (error.name === 'AbortError') {
            message = '요청 시간이 초과되었습니다 (10초).';
        } else if (error.message) {
            message = error.message;
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
