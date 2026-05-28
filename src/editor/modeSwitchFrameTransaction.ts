/**
 * Mode switching capture monotonic frame id: passed with `SourceModeEnterAnchor`, used for diagnosis and snapshot deduplication.
 */

/** Incremented with each successful capture*/
let monotonicCaptureFrameId = 1

export function allocModeSwitchCaptureFrameId(): number {
  const id = monotonicCaptureFrameId
  monotonicCaptureFrameId += 1
  return id
}
