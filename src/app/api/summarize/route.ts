import { NextRequest, NextResponse } from 'next/server';
import { isValidUrl, extractContent } from '@/lib/utils';
import { generateSummary } from '@/lib/openai';
import { checkRateLimit, saveSummary } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function GET() {
    console.log('[API] GET request received for health check');
    return NextResponse.json({
        status: 'ok',
        version: '1.0.5',
        message: 'Summary API is live and ready.'
    });
}

export async function POST(req: NextRequest) {
    console.log('[API] POST request started');
    try {
        // 1. IP 기반 레이트리밋 체크
        let isAllowed = false;
        try {
            isAllowed = await checkRateLimit(req);
        } catch (kvError: any) {
            console.error('[API] KV Error:', kvError);
            return NextResponse.json({
                error: '저장소 연결 오류 (KV). 환경 변수 설정을 확인해주세요.',
                details: kvError.message || 'Unknown KV error'
            }, { status: 500 });
        }

        if (!isAllowed) {
            return NextResponse.json({ error: '요청 한도를 초과했습니다.' }, { status: 429 });
        }

        // 2. 입력 URL 검증
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: '올바르지 않은 요청 형식입니다.' }, { status: 400 });
        }

        const { url } = body;
        if (!url || !isValidUrl(url)) {
            return NextResponse.json({ error: '올바른 URL을 입력해주세요.' }, { status: 400 });
        }

        // 3. 웹페이지 HTML 가져오기
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return NextResponse.json({ error: `페이지 접근 실패: ${response.status}` }, { status: response.status });
        }

        let html = await response.text();
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // 4. 본문 추출 및 요약
        const extracted = await extractContent(html, url);
        if (extracted.content.length < 100) {
            return NextResponse.json({ error: '본문 내용이 적어 요약할 수 없습니다.' }, { status: 400 });
        }

        const summary = await generateSummary(extracted.content);

        // 5. 저장
        const randomId = Math.random().toString(36).substring(2, 10);
        try {
            await saveSummary(randomId, { url, title: extracted.title, ...summary });
        } catch (kvSaveError: any) {
            console.error('[API] KV Save Error:', kvSaveError);
        }

        return NextResponse.json({ id: randomId, ...summary });
    } catch (error: any) {
        console.error('[API] Fatal Error:', error);
        return NextResponse.json({
            error: '요청 처리 중 문제가 발생했습니다.',
            details: error.message
        }, { status: 500 });
    }
}
