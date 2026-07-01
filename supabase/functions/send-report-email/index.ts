// Deno 글로벌 변수 선언 (IDE 에러 방지용)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// Resend API 엔드포인트
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req: Request) => {
  try {
    // 1. 수퍼베이스 Webhook 페이로드 파싱 (INSERT 시 넘어오는 데이터)
    const payload = await req.json();
    const record = payload.record; // 새로 추가된 leads 데이터

    if (!record || !record.email) {
      return new Response("No email provided", { status: 400 });
    }

    // 2. 상세 분석 JSON 데이터 파싱
    // 문자열로 저장되어 있을 경우 파싱
    const detailedData = typeof record.detailed_analysis === 'string' 
      ? JSON.parse(record.detailed_analysis) 
      : record.detailed_analysis;

    // 3. 통계 및 맞춤형 솔루션 계산
    let repsHtml = '';
    let customSolutionHtml = '';
    const errorCounts: Record<string, number> = {};

    if (detailedData && Array.isArray(detailedData)) {
      // 에러 카운팅
      detailedData.forEach((rep: { errorType?: string[] }) => {
        if (rep.errorType && Array.isArray(rep.errorType)) {
          rep.errorType.forEach((err: string) => {
            errorCounts[err] = (errorCounts[err] || 0) + 1;
          });
        }
      });

      // 자주 발생하는 에러 2가지 기반 맞춤형 솔루션 생성
      const topErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 2);
      if (topErrors.length > 0) {
        customSolutionHtml = topErrors.map(([err, count]) => {
          let advice = '해당 관절의 안정성과 가동성을 높이기 위한 보조 운동을 추가하는 것을 추천합니다.';
          if (err.includes('무릎') || err.includes('Knee')) advice = '발끝과 무릎 방향을 일치시키고 하체 후면 근육(둔근, 햄스트링)을 더 활용해보세요. 밴드를 활용한 웜업이 도움이 될 수 있습니다.';
          else if (err.includes('허리') || err.includes('Back') || err.includes('척추')) advice = '복압(브레이싱)을 단단히 잡고 척추 중립을 유지하는 연습이 필요합니다. 가벼운 무게부터 시작해 코어 활성화에 집중하세요.';
          else if (err.includes('깊이') || err.includes('Depth') || err.includes('가동범위')) advice = '고관절 가동성이 제한되어 있거나 유연성이 부족할 수 있습니다. 고관절 및 발목 스트레칭을 병행하면 더 안정적인 깊이를 만들 수 있습니다.';
          else if (err.includes('중심') || err.includes('Balance')) advice = '발바닥 전체(삼각대)로 지면을 꽉 누르는 느낌에 집중하세요. 무게 중심이 앞이나 뒤로 쏠리지 않도록 주의해야 합니다.';
          else if (err.includes('시선') || err.includes('Head')) advice = '시선이 너무 올라가거나 내려가면 척추 중립이 깨집니다. 약 1~2m 앞 바닥을 자연스럽게 응시하세요.';

          return `
            <div style="margin-bottom: 15px;">
              <p style="margin: 0; font-weight: bold; color: #2d3748;">🚨 주요 문제: ${err} (${count}회 발생)</p>
              <p style="margin: 5px 0 0 0; color: #4a5568; font-size: 14px; line-height: 1.5;">💡 <strong>솔루션:</strong> ${advice}</p>
            </div>
          `;
        }).join('');
      } else {
        customSolutionHtml = `
          <div style="margin-bottom: 15px;">
            <p style="margin: 0; font-weight: bold; color: #38a169;">✨ 완벽에 가까운 자세입니다!</p>
            <p style="margin: 5px 0 0 0; color: #4a5568; font-size: 14px; line-height: 1.5;">💡 <strong>솔루션:</strong> 현재 폼을 아주 잘 유지하고 있습니다. 부상 위험이 적으므로, 점진적 과부하를 통해 무게를 늘리거나 템포를 조절하여 자극을 극대화해보세요.</p>
          </div>
        `;
      }

      // 횟수별 HTML 리스트
      repsHtml = detailedData.map((rep: { repIndex: number; errorType?: string[]; duration?: number; maxDepth?: string; }) => {
        const errorText = rep.errorType && rep.errorType.length > 0 
          ? `<span style="color: #e53e3e; font-weight: bold;">개선 필요:</span> ${rep.errorType.join(', ')}` 
          : `<span style="color: #38a169; font-weight: bold;">완벽함!</span>`;
        
        const durationSec = rep.duration ? rep.duration.toFixed(1) + '초' : '-';
        const depthMap: Record<string, string> = { 'deep': '풀 (안정적)', 'parallel': '패러렐 (적절)', 'partial': '하프 (부족)', 'standing': '스탠딩' };
        const depthLabel = rep.maxDepth ? (depthMap[rep.maxDepth] || rep.maxDepth) : '-';

        return `
          <tr style="border-bottom: 1px solid #edf2f7; font-size: 14px;">
            <td style="padding: 12px; font-weight: bold; color: #4a5568;">${rep.repIndex}회차</td>
            <td style="padding: 12px; color: #718096;">${durationSec}</td>
            <td style="padding: 12px; color: #718096;">${depthLabel}</td>
            <td style="padding: 12px;">${errorText}</td>
          </tr>
        `;
      }).join('');
    }

    // 4. 이메일 발송용 HTML 템플릿 생성
    const htmlContent = `
      <div style="font-family: 'Pretendard', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7fafc; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2d3748; margin-bottom: 10px;">🏋️ FormTech AI 프리미엄 리포트</h1>
          <p style="color: #718096; font-size: 16px;">${record.name}님의 ${record.exercise} 분석 결과입니다.</p>
        </div>

        <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px;">
          <h2 style="color: #2d3748; font-size: 20px; border-bottom: 2px solid #edf2f7; padding-bottom: 10px;">📊 종합 평가</h2>
          <div style="display: flex; justify-content: space-between; margin-top: 15px;">
            <div>
              <p style="color: #a0aec0; margin: 0; font-size: 14px;">정확도 점수</p>
              <p style="color: #3182ce; font-size: 32px; font-weight: bold; margin: 5px 0;">${record.score}점</p>
            </div>
            <div style="text-align: right;">
              <p style="color: #a0aec0; margin: 0; font-size: 14px;">총 수행 횟수</p>
              <p style="color: #2d3748; font-size: 32px; font-weight: bold; margin: 5px 0;">${record.reps}회</p>
            </div>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #ebf8ff; border-radius: 8px;">
            <p style="margin: 0; color: #2b6cb0; font-weight: bold;">💡 AI 핵심 코멘트</p>
            <p style="margin: 8px 0 0 0; color: #2c5282;">${record.feedback}</p>
          </div>
        </div>

        <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px;">
          <h2 style="color: #2d3748; font-size: 20px; border-bottom: 2px solid #edf2f7; padding-bottom: 10px;">🩺 전문가 맞춤 교정 솔루션</h2>
          <div style="margin-top: 15px; padding: 15px; background-color: #f7fafc; border-radius: 8px; border-left: 4px solid #3182ce;">
            ${customSolutionHtml}
          </div>
        </div>

        <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <h2 style="color: #2d3748; font-size: 20px; border-bottom: 2px solid #edf2f7; padding-bottom: 10px;">🔍 횟수별 심층 분석 (수행 시간 및 가동 범위)</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left;">
            <thead>
              <tr style="background-color: #f7fafc; color: #4a5568; font-size: 14px;">
                <th style="padding: 12px; border-radius: 8px 0 0 8px;">횟수</th>
                <th style="padding: 12px;">수행 시간</th>
                <th style="padding: 12px;">최대 깊이</th>
                <th style="padding: 12px; border-radius: 0 8px 8px 0;">분석 결과</th>
              </tr>
            </thead>
            <tbody>
              ${repsHtml}
            </tbody>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #a0aec0; font-size: 12px;">
          <p>이 메일은 FormTech AI에 의해 자동 발송되었습니다.</p>
          <p>© ${new Date().getFullYear()} FormTech. All rights reserved.</p>
        </div>
      </div>
    `;

    // 5. Resend API를 통해 이메일 발송 요청
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FormTech <onboarding@resend.dev>", // TODO: 발송자 도메인 변경 필요
        to: [record.email],
        subject: `[FormTech] ${record.name}님의 프리미엄 AI 분석 리포트 도착!`,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      console.error("Resend API Error:", data);
      return new Response(JSON.stringify({ error: data }), { status: 400 });
    }
  } catch (error: unknown) {
    console.error("Edge Function Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});
