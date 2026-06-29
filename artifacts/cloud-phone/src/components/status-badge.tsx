import { EmulatorStatus } from "@workspace/api-client-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: EmulatorStatus }) {
  const isStopped = status === EmulatorStatus.stopped;
  const isStarting = status === EmulatorStatus.starting;
  const isRunning = status === EmulatorStatus.running;
  const isStopping = status === EmulatorStatus.stopping;
  const isError = status === EmulatorStatus.error;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-3 w-3">
        {(isStarting || isRunning) && (
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              isStarting ? "bg-yellow-400" : "bg-green-400"
            )}
          ></span>
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-3 w-3 border border-background/50",
            isStopped && "bg-muted-foreground",
            isStarting && "bg-yellow-500",
            isRunning && "bg-green-500",
            isStopping && "bg-orange-500",
            isError && "bg-red-500"
          )}
        ></span>
      </div>
      <span className={cn(
        "text-xs font-semibold capitalize",
        isStopped && "text-muted-foreground",
        isStarting && "text-yellow-500",
        isRunning && "text-green-500",
        isStopping && "text-orange-500",
        isError && "text-red-500"
      )}>
        {status}
      </span>
    </div>
  );
}
