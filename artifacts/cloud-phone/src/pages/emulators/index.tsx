import { useListEmulators, useStartEmulator, useStopEmulator, useDeleteEmulator, getListEmulatorsQueryKey, EmulatorStatus } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Play, Square, Trash2, Plus, Terminal, RefreshCw, Cpu, HardDrive, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export function EmulatorsPage() {
  const queryClient = useQueryClient();
  const { data: emulators, isLoading } = useListEmulators({
    query: { queryKey: getListEmulatorsQueryKey(), refetchInterval: 5000 }
  });
  
  const startEmu = useStartEmulator();
  const stopEmu = useStopEmulator();
  const deleteEmu = useDeleteEmulator();

  const handleStart = (id: string) => {
    startEmu.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEmulatorsQueryKey() })
    });
  };

  const handleStop = (id: string) => {
    stopEmu.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEmulatorsQueryKey() })
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this emulator?")) {
      deleteEmu.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEmulatorsQueryKey() })
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emulator Fleet</h1>
          <p className="text-muted-foreground">Manage your Android virtual devices.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: getListEmulatorsQueryKey() })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link href="/emulators/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Device
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[300px]">Device Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>System</TableHead>
              <TableHead>Hardware</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : emulators?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <Smartphone className="h-8 w-8 mb-2 opacity-50" />
                    <p>No emulators found. Create your first virtual device.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              emulators?.map((emu) => (
                <TableRow key={emu.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <Link href={`/emulators/${emu.id}`} className="font-medium hover:underline text-foreground">
                        {emu.name}
                      </Link>
                      <span className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {emu.id.substring(0, 8)}...
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={emu.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">Android {emu.androidVersion}</span>
                      <span className="text-xs text-muted-foreground">API {emu.apiLevel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-3 w-3" /> {emu.hardware.cpuCores} Cores, {Math.round(emu.hardware.ramMb / 1024)}GB RAM
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="h-3 w-3" /> {emu.hardware.storageGb}GB Storage
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {emu.status === EmulatorStatus.stopped && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-green-500 hover:text-green-600 hover:bg-green-500/10 border-green-500/20"
                          onClick={() => handleStart(emu.id)}
                          disabled={startEmu.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" /> Start
                        </Button>
                      )}
                      
                      {(emu.status === EmulatorStatus.running || emu.status === EmulatorStatus.starting) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 border-orange-500/20"
                          onClick={() => handleStop(emu.id)}
                          disabled={stopEmu.isPending}
                        >
                          <Square className="h-4 w-4 mr-1" /> Stop
                        </Button>
                      )}

                      {emu.status === EmulatorStatus.running && (
                        <Link href={`/emulators/${emu.id}`}>
                          <Button variant="outline" size="sm" className="h-8">
                            <Terminal className="h-4 w-4 mr-1" /> View
                          </Button>
                        </Link>
                      )}

                      {(emu.status === EmulatorStatus.stopped || emu.status === EmulatorStatus.error) && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(emu.id)}
                          disabled={deleteEmu.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
