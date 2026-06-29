import { useState } from "react";
import { useCreateEmulator, useListDeviceProfiles, useListAndroidVersions, getListEmulatorsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cpu, HardDrive, MemoryStick, Smartphone, ChevronLeft, Check, Camera, MonitorSmartphone } from "lucide-react";
import { Link } from "wouter";

export function NewEmulatorPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: profiles } = useListDeviceProfiles();
  const { data: androidVersions } = useListAndroidVersions();
  const createEmu = useCreateEmulator();

  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  
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
    hasCamera: false
  });

  const handleSubmit = () => {
    let hardware = { ...formData };
    
    // If preset, use profile's hardware but override with what we might have tweaked
    if (mode === "preset" && selectedProfileId) {
      const profile = profiles?.find(p => p.id === selectedProfileId);
      if (profile) {
        hardware = {
          ...hardware,
          ...profile.hardware
        };
      }
    }

    createEmu.mutate({
      data: {
        name: formData.name,
        deviceProfileId: mode === "preset" ? selectedProfileId : null,
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
          hasCamera: hardware.hasCamera
        }
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmulatorsQueryKey() });
        setLocation("/emulators");
      }
    });
  };

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
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-accent/20"
                />
              </div>

              <div className="space-y-2">
                <Label>Android System Image</Label>
                <Select 
                  value={formData.androidVersion} 
                  onValueChange={(val) => {
                    const v = androidVersions?.find(a => a.version === val);
                    if (v) setFormData({...formData, androidVersion: val, apiLevel: v.apiLevel});
                  }}
                >
                  <SelectTrigger className="bg-accent/20">
                    <SelectValue placeholder="Select Android Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {androidVersions?.map(av => (
                      <SelectItem key={av.version} value={av.version}>
                        Android {av.version} (API {av.apiLevel}) - {av.name} {!av.isInstalled && " (Requires Download)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle>Hardware Configuration</CardTitle>
                <div className="flex bg-accent/20 p-1 rounded-md border border-border/50">
                  <button 
                    className={`px-3 py-1 text-xs font-medium rounded ${mode === 'preset' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setMode('preset')}
                  >
                    Preset Profile
                  </button>
                  <button 
                    className={`px-3 py-1 text-xs font-medium rounded ${mode === 'custom' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setMode('custom')}
                  >
                    Custom Build
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {mode === "preset" ? (
                <div className="grid grid-cols-2 gap-3">
                  {profiles?.map(profile => (
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
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{profile.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mb-3">{profile.manufacturer} {profile.model}</span>
                      
                      <div className="mt-auto pt-3 border-t border-border/50 grid grid-cols-2 gap-y-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Cpu className="h-3 w-3"/> {profile.hardware.cpuCores} Cores</div>
                        <div className="flex items-center gap-1.5"><MemoryStick className="h-3 w-3"/> {Math.round(profile.hardware.ramMb/1024)}GB</div>
                        <div className="flex items-center gap-1.5"><HardDrive className="h-3 w-3"/> {profile.hardware.storageGb}GB</div>
                        <div className="flex items-center gap-1.5"><MonitorSmartphone className="h-3 w-3"/> {profile.hardware.screenHeight}p</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label className="flex items-center gap-2"><Cpu className="h-4 w-4"/> CPU Cores</Label>
                      <span className="text-sm font-mono">{formData.cpuCores} vCPU</span>
                    </div>
                    <Slider 
                      min={1} max={8} step={1} 
                      value={[formData.cpuCores]} 
                      onValueChange={([val]) => setFormData({...formData, cpuCores: val})} 
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label className="flex items-center gap-2"><MemoryStick className="h-4 w-4"/> Memory (RAM)</Label>
                      <span className="text-sm font-mono">{formData.ramMb} MB ({Math.round(formData.ramMb/1024)} GB)</span>
                    </div>
                    <Slider 
                      min={1024} max={8192} step={512} 
                      value={[formData.ramMb]} 
                      onValueChange={([val]) => setFormData({...formData, ramMb: val})} 
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label className="flex items-center gap-2"><HardDrive className="h-4 w-4"/> Internal Storage</Label>
                      <span className="text-sm font-mono">{formData.storageGb} GB</span>
                    </div>
                    <Slider 
                      min={4} max={64} step={4} 
                      value={[formData.storageGb]} 
                      onValueChange={([val]) => setFormData({...formData, storageGb: val})} 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
                    <div className="space-y-3">
                      <Label>Resolution Width</Label>
                      <Input 
                        type="number" 
                        value={formData.screenWidth} 
                        onChange={(e) => setFormData({...formData, screenWidth: parseInt(e.target.value) || 0})}
                        className="bg-accent/20"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Resolution Height</Label>
                      <Input 
                        type="number" 
                        value={formData.screenHeight} 
                        onChange={(e) => setFormData({...formData, screenHeight: parseInt(e.target.value) || 0})}
                        className="bg-accent/20"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-accent/10">
                    <div className="space-y-0.5">
                      <Label className="text-base flex items-center gap-2">
                        <MonitorSmartphone className="h-4 w-4"/> Hardware GPU
                      </Label>
                      <p className="text-xs text-muted-foreground">Use host GPU for rendering</p>
                    </div>
                    <Switch 
                      checked={formData.hasGpu}
                      onCheckedChange={(checked) => setFormData({...formData, hasGpu: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-accent/10">
                    <div className="space-y-0.5">
                      <Label className="text-base flex items-center gap-2">
                        <Camera className="h-4 w-4"/> Virtual Camera
                      </Label>
                      <p className="text-xs text-muted-foreground">Enable mock camera support</p>
                    </div>
                    <Switch 
                      checked={formData.hasCamera}
                      onCheckedChange={(checked) => setFormData({...formData, hasCamera: checked})}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Estimated resource usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground text-sm">System</span>
                <span className="font-medium text-sm">Android {formData.androidVersion}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Compute</span>
                <span className="font-medium text-sm">{mode === 'preset' ? 'From Profile' : `${formData.cpuCores} vCPU`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Memory</span>
                <span className="font-medium text-sm">{mode === 'preset' ? 'From Profile' : `${formData.ramMb} MB`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Storage</span>
                <span className="font-medium text-sm">{mode === 'preset' ? 'From Profile' : `${formData.storageGb} GB`}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleSubmit}
                disabled={createEmu.isPending || (mode === 'preset' && !selectedProfileId)}
              >
                {createEmu.isPending ? "Creating..." : "Launch Instance"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
