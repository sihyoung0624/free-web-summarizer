import { Readability } from '@mozilla/readability';
import { DOMParser } from 'linkedom';

export async function extractContent(html: string, url: string) {
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const reader = new Readability(dom);
    const article = reader.parse();

    if (!article) {
        throw new Error('본문을 추출할 수 없는 페이지입니다.');
    }

    // 텍스트 정규화 및 길이 제한 (20,000자)
    const content = article.textContent || '';
    const cleanContent = content
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20000);

    return {
        title: article.title,
        content: cleanContent,
        excerpt: article.excerpt,
    };
}

export function isValidUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}
