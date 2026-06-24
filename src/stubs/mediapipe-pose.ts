/* eslint-disable @typescript-eslint/no-unused-vars */
/** BlazePose MediaPipe 런타임 스텁 — MoveNet(tfjs)만 사용하므로 번들 호환용 */
export class Pose {
  constructor(_config?: unknown) {}
  setOptions(_opts?: unknown) {}
  onResults(_cb?: unknown) {}
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  send(_input?: unknown): Promise<void> {
    return Promise.resolve();
  }
  close() {}
}
