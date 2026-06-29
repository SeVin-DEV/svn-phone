import { useGetSystemResources, useListEmulators, getGetSystemResourcesQueryKey, getListEmulatorsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, HardDrive, MemoryStick, Smartphone, Play, Plus, Clock, Server } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const { data: sys, isLoading: sysLoading } = useGetSystemResources({
    query: { queryKey: getGetSystemResourcesQueryKey(), refetchInterval: 10000 }
  });
  
  const { data: emulators, isLoading: emuLoading } = useListEmulators({
    query: { queryKey: getListEmulatorsQueryKey(), refetchInterval: 10000 }
  });

  const activeEmulators = emulators?.filter(e => ['running', 'starting'].includes(e.status)) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
        <p className="text-muted-foreground">Real-time overview of your cloud emulator infrastructure.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {sysLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)
        ) : sys ? (
          <>
            <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sys.cpuUsagePercent}%</div>
                <Progress value={sys.cpuUsagePercent} className="mt-3 h-1.5" />
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(sys.ramUsedMb / 1024)}GB</div>
                <p className="text-xs text-muted-foreground mt-1">
                  of {Math.round(sys.ramTotalMb / 1024)}GB total
                </p>
                <Progress value={(sys.ramUsedMb / sys.ramTotalMb) * 100} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sys.storageUsedGb.toFixed(1)}GB</div>
                <p className="text-xs text-muted-foreground mt-1">
                  of {sys.storageTotalGb}GB total
                </p>
                <Progress value={(sys.storageUsedGb / sys.storageTotalGb) * 100} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
                <Smartphone className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{sys.runningEmulators}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  max {sys.maxEmulators} concurrent
                </p>
                <Progress value={(sys.runningEmulators / sys.maxEmulators) * 100} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Emulators</CardTitle>
                <CardDescription>Your recently active virtual devices.</CardDescription>
              </div>
              <Link href="/emulators/new">
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" /> New
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {emuLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : emulators?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                <Smartphone className="h-8 w-8 mb-3 opacity-50" />
                <p>No emulators created yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {emulators?.slice(0, 5).map(emu => (
                  <div key={emu.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-accent/20 hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-card flex items-center justify-center border border-border shadow-sm">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <Link href={`/emulators/${emu.id}`} className="font-medium hover:underline hover:text-primary transition-colors">
                          {emu.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={emu.status} />
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Android {emu.androidVersion} (API {emu.apiLevel})
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/emulators/${emu.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Play className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>System Load</CardTitle>
            <CardDescription>Live telemetry from the host server.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            {/* Visual representation of server load - animated rings */}
            <div className="relative flex items-center justify-center h-full py-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border border-primary/20 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute w-48 h-48 border border-primary/40 rounded-full animate-[spin_8s_linear_infinite_reverse]" />
                <div className="absolute w-32 h-32 border border-primary/60 rounded-full animate-[spin_6s_linear_infinite]" />
                <div className="absolute w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur shadow-[0_0_30px_rgba(var(--primary),0.3)]">
                  <Server className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="absolute bottom-0 inset-x-0 flex justify-between px-8">
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{sys?.cpuUsagePercent || 0}%</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">CPU</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{Math.round((sys?.ramUsedMb || 0) / 1024)}G</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">RAM</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{activeEmulators.length}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">VMDs</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
