import { useGetSystemResources, useListAndroidVersions, getGetSystemResourcesQueryKey, getListAndroidVersionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Server, Download, CheckCircle2, HardDrive, Cpu, MemoryStick } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function SystemPage() {
  const { data: sys, isLoading: sysLoading } = useGetSystemResources({
    query: { queryKey: getGetSystemResourcesQueryKey(), refetchInterval: 10000 }
  });
  
  const { data: versions, isLoading: versionsLoading } = useListAndroidVersions({
    query: { queryKey: getListAndroidVersionsQueryKey() }
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Server className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Host System</h1>
          <p className="text-muted-foreground">Server infrastructure and installed SDKs.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4" /> CPU Utilization
            </CardTitle>
            <div className="text-3xl font-bold">{sysLoading ? "-" : sys?.cpuUsagePercent}%</div>
          </CardHeader>
          <CardContent>
            <Progress value={sys?.cpuUsagePercent || 0} className="h-2" />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <MemoryStick className="h-4 w-4" /> Memory Usage
            </CardTitle>
            <div className="text-3xl font-bold">
              {sysLoading ? "-" : Math.round((sys?.ramUsedMb || 0) / 1024)}
              <span className="text-lg text-muted-foreground font-normal ml-1">GB</span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={sys ? (sys.ramUsedMb / sys.ramTotalMb) * 100 : 0} className="h-2" />
            <div className="text-xs text-muted-foreground mt-2 text-right">
              Total: {sys ? Math.round(sys.ramTotalMb / 1024) : "-"} GB
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Disk Space
            </CardTitle>
            <div className="text-3xl font-bold">
              {sysLoading ? "-" : (sys?.storageUsedGb || 0).toFixed(1)}
              <span className="text-lg text-muted-foreground font-normal ml-1">GB</span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={sys ? (sys.storageUsedGb / sys.storageTotalGb) * 100 : 0} className="h-2" />
            <div className="text-xs text-muted-foreground mt-2 text-right">
              Total: {sys?.storageTotalGb || "-"} GB
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Android SDK Versions</CardTitle>
          <CardDescription>Available system images for emulator creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Android Version</TableHead>
                <TableHead>API Level</TableHead>
                <TableHead>Code Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versionsLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                versions?.map((ver) => (
                  <TableRow key={ver.version}>
                    <TableCell className="font-medium">Android {ver.version}</TableCell>
                    <TableCell>API {ver.apiLevel}</TableCell>
                    <TableCell className="text-muted-foreground">{ver.name}</TableCell>
                    <TableCell>{ver.sizeMb ? `${Math.round(ver.sizeMb / 1024)} GB` : 'Unknown'}</TableCell>
                    <TableCell>
                      {ver.isInstalled ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10 gap-1.5">
                          <CheckCircle2 className="h-3 w-3" /> Installed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">Not Downloaded</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!ver.isInstalled && (
                        <Button variant="outline" size="sm" className="h-8">
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
