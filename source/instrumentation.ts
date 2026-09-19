// Runs once when the Next server boots. Starts the weekly report scheduler.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReportScheduler } = await import("./lib/reports");
    startReportScheduler();
  }
}
