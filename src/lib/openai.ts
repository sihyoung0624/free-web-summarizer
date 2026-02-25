import { OpenAI } from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSummary(content: string) {
    const prompt = `
당신은 웹페이지 요약 전문가입니다. 아래 본문 내용을 바탕으로 규칙에 맞춰 요약 JSON을 생성하세요.

[규칙]
1. 반드시 한국어로 작성한다.
2. 원문에 없는 내용을 절대 추론하거나 추가하지 않는다.
3. 불확실한 경우 "원문에 명확히 없어 단정 불가"라고 명시한다.
4. JSON 외의 텍스트는 절대 출력하지 않는다.

[출력 포맷]
{
  "one_line": "한 줄 요약 (30자 내외)",
  "bullets": [
    "핵심 포인트 1",
    "핵심 포인트 2",
    "핵심 포인트 3",
    "핵심 포인트 4",
    "핵심 포인트 5"
  ],
  "numbers": [
    "중요 숫자나 조건이 있으면 기재",
    "없으면 빈 배열"
  ]
}

[본문]
${content}
`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });

    const summary = response.choices[0].message.content;
    if (!summary) throw new Error('요약 생성에 실패했습니다.');

    return JSON.parse(summary);
}
