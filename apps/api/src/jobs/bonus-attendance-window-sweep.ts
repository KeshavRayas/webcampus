import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

let sweepTimer: NodeJS.Timeout | null = null;

async function runSweep(): Promise<void> {
  try {
    const result = await db.bonusAttendanceWindow.updateMany({
      where: {
        isOpen: true,
        expiresAt: { lte: new Date() },
      },
      data: {
        isOpen: false,
        openedAt: null,
        expiresAt: null,
      },
    });

    if (result.count > 0) {
      logger.info(
        `Auto-closed ${result.count} expired bonus attendance window(s)`
      );
    }
  } catch (error) {
    logger.error("Bonus attendance window sweep failed", error);
  }
}

export function startBonusAttendanceWindowSweep(): void {
  if (sweepTimer) {
    return;
  }

  void runSweep();
  sweepTimer = setInterval(() => {
    void runSweep();
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
}

export function stopBonusAttendanceWindowSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
