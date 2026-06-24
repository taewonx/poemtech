/**
 * Phase 3: B2B/C2C 폼 체크 위젯 스텁
 *
 * 코치 웹사이트에 임베드할 수 있는 경량 React 위젯입니다.
 * 실제 배포 시 별도 번들로 빌드하거나 iframe으로 호스팅합니다.
 */

interface FormCheckWidgetProps {
  coachId: string;
  price?: number;
  onComplete?: (submissionId: string) => void;
}

export function FormCheckWidget({ coachId, price, onComplete }: FormCheckWidgetProps) {
  return (
    <div className="form-check-widget">
      <h3>폼 체크 요청</h3>
      <p>코치 ID: {coachId}</p>
      {price && <p>가격: ₩{price.toLocaleString()}</p>}
      <p className="widget-notice">
        Phase 3에서 활성화됩니다. Presigned URL 업로드 + 결제 연동이 필요합니다.
      </p>
      <button
        type="button"
        disabled
        onClick={() => onComplete?.('stub-id')}
      >
        영상 업로드 및 결제 (준비중)
      </button>
    </div>
  );
}
