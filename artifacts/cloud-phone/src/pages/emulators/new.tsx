import { useState } from "react";
import {
  useCreateEmulator,
  useListDeviceProfiles,
  useListAndroidVersions,
  useListRoms,
  getListEmulatorsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Cpu, HardDrive, MemoryStick, Smartphone, ChevronLeft, Check, Camera, MonitorSmartphone, Container, Monitor, Layers } from "lucide-react";
import { Link } from "wouter";

const EMULATOR_TYPES = [
  {
    id: "redroid" as const,
    label: "Redroid",
    subtitle: "Docker (recommended)",
    description: "Fastest startup. Runs Android in a container via the Redroid image. Requires binder_linux kernel module.",
    icon: Container,
    badge: "Docker",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    requiresRom: false,
  },
  {
    id: "qemu" as const,
    label: "QEMU",
    subtitle: "Full emulation",
    description: "Full-system emulation. Boots from a .img ROM file. Best for ARM/x86 device dumps and custom ROMs.",
    icon: Monitor,
    badge: "QEMU",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    requiresRom: true,
  },
  {
    id: "avd" as const,
    label: "AVD",
    subtitle: "Android SDK",
    description: "Standard Google emulator via the Android SDK. Requires Android SDK installed on the host.",
    icon: Layers,
    badge: "SDK",
    badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    requiresRom: false,
  },
];

export function NewEmulatorPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: profiles } = useListDeviceProfiles();
  const { data: androidVersions } = useListAndroidVersions();
  const { data: roms = [] } = useListRoms();
  const createEmu = useCreateEmulator();

  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [emulatorType, setEmulatorType] = useState<"redroid" | "qemu" | "avd">("redroid");
  const [romId, setRomId] = useState<string>("");

  const [formData, setFormData] = useState({
    name: "My Android Device",
    androidVersion: "14.0",
    apiLevel: 34,
    ramMb: 4096,
    cpuCores: 4,
    storageGb: 16,
    screenWidth: 1080,
    screenHeight: 2400,
    screenDpi: 420,
    hasGpu: true,
    hasCamera: false,
  });

  const selectedType = EMULATOR_TYPES.find(t => t.id === emulatorType)!;

  // Filter ROMs compatible with the selected emulator type
  const compatibleRoms = roms.filter(r => {
    if (emulatorType === "redroid") return r.romType === "redroid-gsi" || r.romType === "custom";
    if (emulatorType === "qemu") return r.romType === "qemu-arm" || r.romType === "qemu-x86" || r.romType === "custom";
    return false;
  });

  const handleSubmit = () => {
    let hardware = { ...formData };

    if (mode === "preset" && selectedProfileId) {
      const profile = profiles?.find(p => p.id === selectedProfileId);
      if (profile) {
        hardware = { ...hardware, ...profile.hardware };
      }
    }

    createEmu.mutate(
      {
        data: {
          name: formData.name,
          emulatorType,
          deviceProfileId: mode === "preset" ? selectedProfileId || null : null,
          romId: romId || null,
          androidVersion: formData.androidVersion,
          apiLevel: formData.apiLevel,
          hardware: {
            ramMb: hardware.ramMb,
            cpuCores: hardware.cpuCores,
            storageGb: hardware.storageGb,
            screenWidth: hardware.screenWidth,
            screenHeight: hardware.screenHeight,
            screenDpi: hardware.screenDpi,
            hasGpu: hardware.hasGpu,
            hasCamera: hardware.hasCamera,
          },
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmulatorsQueryKey() });
          setLocation("/emulators");
        },
      }
    );
  };

  const isValid = !createEmu.isPending &&
    (mode !== "preset" || selectedProfileId) &&
    (!selectedType.requiresRom || romId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/emulators">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Emulator</h1>
          <p className="text-muted-foreground">Configure a new virtual Android device.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          {/* Emulator type */}
          <Card>
            <CardHeader>
              <CardTitle>Emulator Backend</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              {EMULATOR_TYPES.map(type => {
                const Icon = type.icon;
                const active = emulatorType === type.id;
                return (
                  <div
                    key={type.id}
                    onClick={() => { setEmulatorType(type.id); setRomId(""); }}
                    className={`relative flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      active ? "border-primary bg-primary/5" : "border-border/50 bg-card hover:border-primary/40"
                    }`}
                  >
                    {active && (
                      <div className="absolute top-3 right-3 text-primary">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{type.label}</span>
                        <Badge variant="outline" className={`text-[10px] py-0 ${type.badgeClass}`}>{type.badge}</Badge>
                        <span className="text-xs text-muted-foreground">{type.subtitle}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{type.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ROM selection (Redroid optional, QEMU required) */}
          {(emulatorType === "redroid" || emulatorType === "qemu") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  ROM Image
                  {selectedType.requiresRom && <Badge variant="destructive" className="text-[10px] py-0">Required</Badge>}
                  {!selectedType.requiresRom && <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">Optional</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {compatibleRoms.length === 0 ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed border-border">
                    <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">No compatible ROMs</p>
                      <p className="text-muted-foreground text-xs">
                        Upload a {emulatorType === "redroid" ? "Redroid GSI" : "QEMU ARM/x86"} image in the{" "}
                        <Link href="/roms" className="text-primary underline-offset-2 hover:underline">ROM Library</Link> first.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Select value={romId} onValueChange={setRomId}>
                    <SelectTrigger className="bg-accent/20">
                      <SelectValue placeholder={selectedType.requiresRom ? "Select a ROM image…" : "Use default image (no ROM)"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!selectedType.requiresRom && (
                        <SelectItem value="">Use default Redroid image</SelectItem>
                      )}
                      {compatibleRoms.map(rom => (
                        <SelectItem key={rom.id} value={rom.id}>
                          {rom.name} — Android {rom.androidVersion} ({Math.round(rom.sizeMb / 1024 * 10) / 10} GB)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          )}

          {/* Basic settings */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Instance Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-accent/20"
                />
              </div>

              <div className="space-y-2">
                <Label>Android Version</Label>
                <Select
                  value={formData.androidVersion}
                  onValueChange={(val) => {
                    const v = androidVersions?.find(a => a.version === val);
                    if (v) setFormData({ ...formData, androidVersion: val, apiLevel: v.apiLevel });
                  }}
                >
                  <SelectTrigger className="bg-accent/20">
                    <SelectValue placeholder="Select Android Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {androidVersions?.map(av => (
                      <SelectItem key={av.version} value={av.version}>
                        Android {av.version} (API {av.apiLevel}) — {av.name}
                        {!av.isInstalled && " (Requires Download)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Hardware */}
          <Card>
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle>Hardware Configuration</CardTitle>
                <div className="flex bg-accent/20 p-1 rounded-md border border-border/50">
                  <button
                    className={`px-3 py-1 text-xs font-medium rounded ${mode === "preset" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setMode("preset")}
                  >
                    Preset Profile
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-medium rounded ${mode === "custom" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setMode("custom")}
                  >
                    Custom Build
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {mode === "preset" ? (
                profiles && profiles.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {profiles.map(profile => (
                      <div
                        key={profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                        className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedProfileId === profile.id
                            ? "border-primary bg-primary/5"
                            : "border-border/50 bg-card hover:border-primary/50"
                        }`}
                      >
                        {selectedProfileId === profile.id && (
                          <div className="absolute top-3 right-3 text-primary">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">{profile.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground mb-3">{profile.manufacturer} {profile.model}</span>
                        <div className="mt-auto pt-3 border-t border-border/50 grid grid-cols-2 gap-y-2 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> {profile.hardware.cpuCores} Cores</div>
                          <div className="flex items-center gap-1.5"><MemoryStick className="h-3 w-3" /> {Math.round(profile.hardware.ramMb / 1024)} GB</div>
                          <div className="flex items-center gap-1.5"><HardDrive className="h-3 w-3" /> {profile.hardware.storageGb} GB</div>
                          <div className="flex items-center gap-1.5"><MonitorSmartphone className="h-3 w-3" /> {profile.hardware.screenHeight}p</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Loading profiles…</p>
                )
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label className="flex items-center gap-2"><Cpu className="h-4 w-4" /> CPU Cores</Label>
                      <span className="text-sm font-mono">{formData.cpuCores} vCPU</span>
                    </div>
                    <Slider min={1} max={8} step={1} value={[formData.cpuCores]} onValueChange={([val]) => setFormData({ ...formData, cpuCores: val })} />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label className="flex items-center gap-2"><MemoryStick className="h-4 w-4" /> Memory (RAM)</Label>
                      <span className="text-sm font-mono">{formData.ramMb} MB ({Math.round(formData.ramMb / 1024)} GB)</span>
                    </div>
                    <Slider min={1024} max={8192} step={512} value={[formData.ramMb]} onValueChange={([val]) => setFormData({ ...formData, ramMb: val })} />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> Internal Storage</Label>
                      <span className="text-sm font-mono">{formData.storageGb} GB</span>
                    </div>
                    <Slider min={4} max={64} step={4} value={[formData.storageGb]} onValueChange={([val]) => setFormData({ ...formData, storageGb: val })} />
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
                    <div className="space-y-3">
                      <Label>Resolution Width</Label>
                      <Input type="number" value={formData.screenWidth} onChange={(e) => setFormData({ ...formData, screenWidth: parseInt(e.target.value) || 0 })} className="bg-accent/20" />
                    </div>
                    <div className="space-y-3">
                      <Label>Resolution Height</Label>
                      <Input type="number" value={formData.screenHeight} onChange={(e) => setFormData({ ...formData, screenHeight: parseInt(e.target.value) || 0 })} className="bg-accent/20" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-accent/10">
                    <div className="space-y-0.5">
                      <Label className="text-base flex items-center gap-2"><MonitorSmartphone className="h-4 w-4" /> Hardware GPU</Label>
                      <p className="text-xs text-muted-foreground">Use host GPU for rendering</p>
                    </div>
                    <Switch checked={formData.hasGpu} onCheckedChange={(checked) => setFormData({ ...formData, hasGpu: checked })} />
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-accent/10">
                    <div className="space-y-0.5">
                      <Label className="text-base flex items-center gap-2"><Camera className="h-4 w-4" /> Virtual Camera</Label>
                      <p className="text-xs text-muted-foreground">Enable mock camera support</p>
                    </div>
                    <Switch checked={formData.hasCamera} onCheckedChange={(checked) => setFormData({ ...formData, hasCamera: checked })} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Backend</span>
                <div className="flex items-center gap-1.5">
                  <selectedType.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{selectedType.label}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Android</span>
                <span className="font-medium">v{formData.androidVersion}</span>
              </div>
              {(emulatorType === "redroid" || emulatorType === "qemu") && (
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">ROM</span>
                  <span className="font-medium truncate max-w-[120px]">
                    {romId ? roms.find(r => r.id === romId)?.name ?? "Selected" : emulatorType === "qemu" ? "⚠ Required" : "Default"}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Compute</span>
                <span className="font-medium">{mode === "preset" ? "From Profile" : `${formData.cpuCores} vCPU`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Memory</span>
                <span className="font-medium">{mode === "preset" ? "From Profile" : `${formData.ramMb} MB`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium">{mode === "preset" ? "From Profile" : `${formData.storageGb} GB`}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!isValid}>
                {createEmu.isPending ? "Creating…" : "Launch Instance"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
