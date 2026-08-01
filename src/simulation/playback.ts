export interface PlaybackAdvance {
  time: number;
  reachedScheduledPause: boolean;
}

export function getNextIntegerSecond(time: number): number {
  return Math.floor(Math.max(0, time)) + 1;
}

export function advancePlayback(
  currentTime: number,
  elapsedSeconds: number,
  scheduledPauseTime: number | null,
): PlaybackAdvance {
  const nextTime = currentTime + Math.max(0, elapsedSeconds);

  if (scheduledPauseTime !== null && nextTime >= scheduledPauseTime) {
    return {
      time: scheduledPauseTime,
      reachedScheduledPause: true,
    };
  }

  return {
    time: nextTime,
    reachedScheduledPause: false,
  };
}
