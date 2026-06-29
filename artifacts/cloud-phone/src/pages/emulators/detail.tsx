import { useGetEmulator, useStartEmulator, useStopEmulator, getGetEmulatorQueryKey, EmulatorStatus } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ChevronLeft, Play, Square, Terminal, Cpu, HardDrive, MemoryStick, MonitorSmartphone, Wifi, Camera } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export function EmulatorDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  
  const { data: emulator, isLoading } = useGetEmulator(id, {
    query: { queryKey: getGetEmulatorQueryKey(id), refetchInterval: 3000 }
  });

  const startEmu = useStartEmulator();
  const stopEmu = useStopEmulator();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="w-8 h-8" />
          <Skeleton className="w-64 h-8" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Skeleton className="h-[600px]" /></div>
          <div><Skeleton className="h-[400px]" /></div>
        </div>
      </div>
    );
  }

  if (!emulator) return <div>Emulator not found</div>;

  const handleStart = () => {
    startEmu.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEmulatorQueryKey(id) })
    });
  };

  const handleStop = () => {
    stopEmu.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEmulatorQueryKey(id) })
    });
  };

  const isRunning = emulator.status === EmulatorStatus.running;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/emulators">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              {emulator.name}
              <StatusBadge status={emulator.status} />
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">ID: {emulator.id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {emulator.status === EmulatorStatus.stopped && (
            <Button onClick={handleStart} disabled={startEmu.isPending} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
              <Play className="h-4 w-4 mr-2" /> Start Device
            </Button>
          )}
          {(emulator.status === EmulatorStatus.running || emulator.status === EmulatorStatus.starting) && (
            <Button onClick={handleStop} disabled={stopEmu.isPending} variant="destructive">
              <Square className="h-4 w-4 mr-2" /> Stop Device
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Display Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card overflow-hidden flex flex-col h-[650px]">
            <CardHeader className="border-b border-border/50 py-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4" /> Live Screen — VNC
                </CardTitle>
                {isRunning && emulator.vncPort && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-500 flex items-center gap-1.5"><Wifi className="h-3 w-3"/> Connected</span>
                    <span className="bg-background border border-border px-2 py-0.5 rounded font-mono">
                      localhost:{emulator.vncPort}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative bg-black/90 flex items-center justify-center">
              {!isRunning ? (
                <div className="flex flex-col items-center text-muted-foreground">
                  <MonitorSmartphone className="h-16 w-16 mb-4 opacity-20" />
                  <p>Emulator is currently offline.</p>
                  <p className="text-sm mt-1">Start the device to view the screen.</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className="relative border-[12px] border-neutral-900 rounded-[2.5rem] bg-black shadow-2xl overflow-hidden" 
                       style={{ 
                         aspectRatio: `${emulator.hardware.screenWidth}/${emulator.hardware.screenHeight}`,
                         height: '80%'
                       }}>
                    
                    {/* Simulated Screen */}
                    <div className="absolute inset-0 bg-zinc-900 flex flex-col">
                      {/* Status bar */}
                      <div className="h-6 w-full px-4 flex justify-between items-center text-[10px] text-white">
                        <span>12:00</span>
                        <div className="flex gap-1">
                          <Wifi className="w-3 h-3" />
                          <div className="w-4 h-3 bg-white/80 rounded-[1px]" />
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-center flex-col">
                        <div className="text-primary font-bold text-2xl tracking-widest opacity-20">ANDROID</div>
                        <div className="mt-8 text-xs text-white/50 text-center px-8">
                          Screen stream placeholder.<br/>Connect via VNC for live view.
                        </div>
                      </div>
                      {/* Nav bar */}
                      <div className="h-10 w-full flex justify-around items-center px-8">
                        <div className="w-3 h-3 bg-white/40 rotate-180" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'}} />
                        <div className="w-4 h-4 rounded-full bg-white/40" />
                        <div className="w-3 h-3 rounded-sm bg-white/40" />
                      </div>
                    </div>

                    {/* Camera cutout */}
                    <div className="absolute top-0 inset-x-0 flex justify-center">
                      <div className="w-1/3 h-5 bg-neutral-900 rounded-b-2xl" />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-4">
                    <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white backdrop-blur">
                      Connect via noVNC
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Android OS</span>
                <span className="font-medium text-sm">v{emulator.androidVersion} (API {emulator.apiLevel})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Created</span>
                <span className="font-medium text-sm">{new Date(emulator.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Uptime</span>
                <span className="font-medium text-sm">
                  {emulator.uptimeSeconds ? `${Math.floor(emulator.uptimeSeconds / 60)} mins` : '-'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hardware Specification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-md text-primary"><Cpu className="h-4 w-4"/></div>
                  <div>
                    <p className="text-xs text-muted-foreground">CPU Cores</p>
                    <p className="font-medium text-sm">{emulator.hardware.cpuCores}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-md text-primary"><MemoryStick className="h-4 w-4"/></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Memory</p>
                    <p className="font-medium text-sm">{Math.round(emulator.hardware.ramMb / 1024)} GB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-md text-primary"><HardDrive className="h-4 w-4"/></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Storage</p>
                    <p className="font-medium text-sm">{emulator.hardware.storageGb} GB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-md text-primary"><MonitorSmartphone className="h-4 w-4"/></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Display</p>
                    <p className="font-medium text-sm">{emulator.hardware.screenWidth}x{emulator.hardware.screenHeight}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-md text-primary"><Terminal className="h-4 w-4"/></div>
                  <div>
                    <p className="text-xs text-muted-foreground">GPU Mode</p>
                    <p className="font-medium text-sm">{emulator.hardware.hasGpu ? 'Hardware' : 'Software'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-md text-primary"><Camera className="h-4 w-4"/></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Camera</p>
                    <p className="font-medium text-sm">{emulator.hardware.hasCamera ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isRunning && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base text-primary">Connection Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ADB Connection Command</p>
                  <div className="bg-black/50 p-2 rounded border border-border/50 font-mono text-xs text-green-400 overflow-x-auto">
                    adb connect localhost:{emulator.adbPort}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">VNC Address</p>
                  <div className="bg-black/50 p-2 rounded border border-border/50 font-mono text-xs text-blue-400">
                    localhost:{emulator.vncPort}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
