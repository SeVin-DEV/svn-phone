import { useListDeviceProfiles } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, HardDrive, MemoryStick, MonitorSmartphone, Smartphone, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function ProfilesPage() {
  const { data: profiles, isLoading } = useListDeviceProfiles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Profiles</h1>
          <p className="text-muted-foreground">Hardware presets for quick emulator creation.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Custom Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-4"><Skeleton className="h-10 w-full" /></CardHeader>
              <CardContent><Skeleton className="h-32 w-full" /></CardContent>
            </Card>
          ))
        ) : (
          profiles?.map(profile => (
            <Card key={profile.id} className="flex flex-col border-border/60 hover:border-primary/50 transition-colors">
              <CardHeader className="pb-4 border-b border-border/30">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-accent/50 rounded-lg">
                      <Smartphone className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{profile.name}</CardTitle>
                      <CardDescription className="text-xs">{profile.manufacturer} {profile.model}</CardDescription>
                    </div>
                  </div>
                  {profile.isBuiltIn && (
                    <Badge variant="secondary" className="text-[10px] font-normal uppercase tracking-wider">Built-in</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-1">
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Cpu className="h-3 w-3" /> Compute
                    </span>
                    <span className="text-sm font-medium">{profile.hardware.cpuCores} Cores</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <MemoryStick className="h-3 w-3" /> Memory
                    </span>
                    <span className="text-sm font-medium">{Math.round(profile.hardware.ramMb / 1024)} GB RAM</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <HardDrive className="h-3 w-3" /> Storage
                    </span>
                    <span className="text-sm font-medium">{profile.hardware.storageGb} GB SSD</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <MonitorSmartphone className="h-3 w-3" /> Display
                    </span>
                    <span className="text-sm font-medium">{profile.hardware.screenWidth} × {profile.hardware.screenHeight}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
