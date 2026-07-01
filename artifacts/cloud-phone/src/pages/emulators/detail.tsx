import { useState, useEffect } from "react";
import { useGetEmulator, useStartEmulator, useStopEmulator, getGetEmulatorQueryKey, EmulatorStatus } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/status-badge";
import { ChevronLeft, Play, Square, Terminal, Cpu, HardDrive, MemoryStick, MonitorSmartphone, Wifi, Camera, Shield, Key, Plus, Trash2, Save, Settings2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type PropEntry = { key: string; value: string };

type LaunchConfig = {
  enableRoot: boolean;
  enableSELinuxPermissive: boolean;
  buildPropOverrides: PropEntry[];
  extraEnvVars: PropEntry[];
};

const DEFAULT_LAUNCH_CONFIG: LaunchConfig = {
  enableRoot: false,
  enableSELinuxPermissive: false,
  buildPropOverrides: [],
  extraEnvVars: [],
};

function PropTable({
  label,
  icon: Icon,
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  label: string;
  icon: React.ElementType;
  rows: PropEntry[];
  onChange: (rows: PropEntry[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const add = () => onChange([...rows, { key: "", value: "" }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const set = (i: number, field: "key" | "value", val: string) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm">
          <Icon className="h-3.5 w-3.5" /> {label}
        </Label>
        <Button variant="ghost" size="sm" onClick={add} className="h-7 px-2 text-xs gap-1">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-1">No overrides — click Add to create one.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                className="flex-1 h-8 text-xs font-mono bg-accent/20"
                placeholder={keyPlaceholder}
                value={row.key}
                onChange={(e) => set(i, "key", e.target.value)}
              />
              <span className="text-muted-foreground text-xs">=</span>
              <Input
                className="flex-1 h-8 text-xs font-mono bg-accent/20"
                placeholder={valuePlaceholder}
                value={row.value}
                onChange={(e) => set(i, "value", e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmulatorDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: emulator, isLoading } = useGetEmulator(id, {
    query: { queryKey: getGetEmulatorQueryKey(id), refetchInterval: 3000 },
  });

  const startEmu = useStartEmulator();
  const stopEmu = useStopEmulator();

  const [launchConfig, setLaunchConfig] = useState<LaunchConfig>(DEFAULT_LAUNCH_CONFIG);
  const [lcDirty, setLcDirty] = useState(false);
  const [lcSaving, setLcSaving] = useState(false);

  useEffect(() => {
    if (emulator) {
      const raw = (emulator as unknown as { launchConfig?: LaunchConfig }).launchConfig;
      setLaunchConfig(raw ?? DEFAULT_LAUNCH_CONFIG);
      setLcDirty(false);
    }
  }, [emulator?.id]);

  const updateLc = (patch: Partial<LaunchConfig>) => {
    setLaunchConfig((prev) => ({ ...prev, ...patch }));
    setLcDirty(true);
  };

  const saveLaunchConfig = async () => {
    setLcSaving(true);
    try {
      const resp = await fetch(`/api/emulators/${id}/launch-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(launchConfig),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Save failed" }));
        throw new Error(err.message ?? "Save failed");
      }
      setLcDirty(false);
      toast({ title: "Launch config saved", description: "Changes apply on next start." });
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLcSaving(false);
    }
  };

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
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEmulatorQueryKey(id) }),
    });
  };

  const handleStop = () => {
    stopEmu.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEmulatorQueryKey(id) }),
    });
  };

  const isRunning = emulator.status === EmulatorStatus.running;
  const isStopped = emulator.status === EmulatorStatus.stopped;
  const isRedroid = emulator.emulatorType === "redroid";

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
          {isStopped && (
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
        {/* Main Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Screen */}
          <Card className="border-border bg-card overflow-hidden flex flex-col h-[550px]">
            <CardHeader className="border-b border-border/50 py-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4" /> Live Screen — VNC
                </CardTitle>
                {isRunning && emulator.vncPort && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-500 flex items-center gap-1.5"><Wifi className="h-3 w-3" /> Connected</span>
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
                  <div
                    className="relative border-[12px] border-neutral-900 rounded-[2.5rem] bg-black shadow-2xl overflow-hidden"
                    style={{ aspectRatio: `${emulator.hardware.screenWidth}/${emulator.hardware.screenHeight}`, height: "80%" }}
                  >
                    <div className="absolute inset-0 bg-zinc-900 flex flex-col">
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
                          Screen stream placeholder.<br />Connect via VNC for live view.
                        </div>
                      </div>
                      <div className="h-10 w-full flex justify-around items-center px-8">
                        <div className="w-3 h-3 bg-white/40 rotate-180" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
                        <div className="w-4 h-4 rounded-full bg-white/40" />
                        <div className="w-3 h-3 rounded-sm bg-white/40" />
                      </div>
                    </div>
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

          {/* Pre-launch Config */}
          <Card className={lcDirty ? "border-primary/40" : ""}>
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Pre-launch Config
                  {lcDirty && <Badge variant="outline" className="text-[10px] text-primary border-primary/40">Unsaved</Badge>}
                </CardTitle>
                {!isStopped && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Stop emulator to edit</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Applied every time the emulator starts. Changes require a restart.
              </p>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">
              {/* Root + SELinux toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-accent/10">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm">
                      <Key className="h-4 w-4 text-yellow-500" /> Root Access
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {isRedroid ? "Passes androidboot.redroid_root=1" : "Pre-root your ROM before upload"}
                    </p>
                  </div>
                  <Switch
                    checked={launchConfig.enableRoot}
                    disabled={!isStopped || !isRedroid}
                    onCheckedChange={(v) => updateLc({ enableRoot: v })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-accent/10">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-orange-500" /> SELinux Permissive
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Disables SELinux enforcement</p>
                  </div>
                  <Switch
                    checked={launchConfig.enableSELinuxPermissive}
                    disabled={!isStopped || !isRedroid}
                    onCheckedChange={(v) => updateLc({ enableSELinuxPermissive: v })}
                  />
                </div>
              </div>

              {/* Build prop overrides */}
              <PropTable
                label="Build Prop Overrides"
                icon={MonitorSmartphone}
                rows={launchConfig.buildPropOverrides}
                onChange={(rows) => updateLc({ buildPropOverrides: rows })}
                keyPlaceholder="ro.product.model"
                valuePlaceholder="Pixel 7 Pro"
              />

              {/* Extra env vars (Redroid only) */}
              {isRedroid && (
                <PropTable
                  label="Extra Environment Variables (Redroid)"
                  icon={Terminal}
                  rows={launchConfig.extraEnvVars}
                  onChange={(rows) => updateLc({ extraEnvVars: rows })}
                  keyPlaceholder="VARIABLE_NAME"
                  valuePlaceholder="value"
                />
              )}

              {/* Common fingerprint presets */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Fingerprint Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Pixel 7 Pro", model: "Pixel 7 Pro", mfr: "Google", brand: "google" },
                    { label: "Pixel 6", model: "Pixel 6", mfr: "Google", brand: "google" },
                    { label: "Galaxy S23", model: "SM-S911B", mfr: "Samsung", brand: "samsung" },
                    { label: "OnePlus 12", model: "CPH2573", mfr: "OnePlus", brand: "oneplus" },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      disabled={!isStopped}
                      className="h-7 text-xs"
                      onClick={() => {
                        const existing = launchConfig.buildPropOverrides.filter(
                          (r) => !["ro.product.model", "ro.product.manufacturer", "ro.product.brand"].includes(r.key)
                        );
                        updateLc({
                          buildPropOverrides: [
                            ...existing,
                            { key: "ro.product.model", value: preset.model },
                            { key: "ro.product.manufacturer", value: preset.mfr },
                            { key: "ro.product.brand", value: preset.brand },
                          ],
                        });
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!isStopped}
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => updateLc({ buildPropOverrides: [], extraEnvVars: [] })}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Save */}
              {isStopped && (
                <Button
                  onClick={saveLaunchConfig}
                  disabled={lcSaving || !lcDirty}
                  className="w-full gap-2"
                  variant={lcDirty ? "default" : "outline"}
                >
                  <Save className="h-4 w-4" />
                  {lcSaving ? "Saving…" : "Save Launch Config"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                ["Backend", emulator.emulatorType.toUpperCase()],
                ["Android OS", `v${emulator.androidVersion} (API ${emulator.apiLevel})`],
                ["Created", new Date(emulator.createdAt).toLocaleDateString()],
                ["Uptime", emulator.uptimeSeconds ? `${Math.floor(emulator.uptimeSeconds / 60)} mins` : "-"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground text-sm">{label}</span>
                  <span className="font-medium text-sm">{value}</span>
                </div>
              ))}
              {launchConfig.enableRoot && (
                <div className="mt-3 flex items-center gap-2 text-xs text-yellow-500">
                  <Key className="h-3.5 w-3.5" /> Root access enabled
                </div>
              )}
              {launchConfig.enableSELinuxPermissive && (
                <div className="mt-1 flex items-center gap-2 text-xs text-orange-400">
                  <Shield className="h-3.5 w-3.5" /> SELinux permissive
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hardware</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Cpu, label: "CPU", value: `${emulator.hardware.cpuCores} cores` },
                  { icon: MemoryStick, label: "Memory", value: `${Math.round(emulator.hardware.ramMb / 1024)} GB` },
                  { icon: HardDrive, label: "Storage", value: `${emulator.hardware.storageGb} GB` },
                  { icon: MonitorSmartphone, label: "Display", value: `${emulator.hardware.screenWidth}×${emulator.hardware.screenHeight}` },
                  { icon: Terminal, label: "GPU", value: emulator.hardware.hasGpu ? "Hardware" : "Software" },
                  { icon: Camera, label: "Camera", value: emulator.hardware.hasCamera ? "Enabled" : "Disabled" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="p-2 bg-accent rounded-md text-primary"><Icon className="h-4 w-4" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium text-sm">{value}</p>
                    </div>
                  </div>
                ))}
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
                  <p className="text-xs text-muted-foreground">ADB Connect</p>
                  <div className="bg-black/50 p-2 rounded border border-border/50 font-mono text-xs text-green-400 overflow-x-auto">
                    adb connect localhost:{emulator.adbPort}
                  </div>
                </div>
                {emulator.vncPort && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">VNC Address</p>
                    <div className="bg-black/50 p-2 rounded border border-border/50 font-mono text-xs text-blue-400">
                      localhost:{emulator.vncPort}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
