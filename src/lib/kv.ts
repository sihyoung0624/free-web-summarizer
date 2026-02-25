import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export async function checkRateLimit(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const key = `rate-limit:${ip}`;

    const count = await kv.incr(key);

    if (count === 1) {
        await kv.expire(key, 60); // 1분 후 만료
    }

    if (count > 5) {
        return false;
    }

    return true;
}

export async function saveSummary(id: string, data: any) {
    const key = `share:${id}`;
    await kv.set(key, {
        ...data,
        created_at: new Date().toISOString(),
    }, {
        ex: 60 * 60 * 24 * 7, // 7일 TTL
    });
}

export async function getSummary(id: string) {
    const key = `share:${id}`;
    return await kv.get(key);
}
