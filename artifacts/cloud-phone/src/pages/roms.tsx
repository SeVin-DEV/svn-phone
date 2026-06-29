import { useState, useRef } from "react";
import { useListRoms, useDeleteRom, useUploadRom, getListRomsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HardDrive, Upload, Trash2, Package, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROM_TYPE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  "redroid-gsi": { label: "Redroid GSI", description: "Generic System Image for Redroid containers", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  "qemu-arm":    { label: "QEMU ARM64",  description: "ARM64 ROM/custom ROM for QEMU aarch64",      color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  "qemu-x86":    { label: "QEMU x86",    description: "x86/x86_64 GSI for QEMU (faster on x86 hosts)", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  "custom":      { label: "Custom",      description: "Other ROM format",                             color: "bg-muted text-muted-foreground border-border" },
};

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function RomsPage() {
  const { data: roms = [], isLoading } = useListRoms();
  const deleteRom = useDeleteRom();
  const uploadRom = useUploadRom();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    romType: "redroid-gsi",
    androidVersion: "14.0",
    deviceName: "",
    description: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !form.name) {
      setForm(prev => ({ ...prev, name: f.name.replace(/\.[^.]+$/, "") }));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", form.name);
      fd.append("romType", form.romType);
      fd.append("androidVersion", form.androidVersion);
      if (form.deviceName) fd.append("deviceName", form.deviceName);
      if (form.description) fd.append("description", form.description);

      await uploadRom.mutateAsync({ data: fd as unknown as Parameters<typeof uploadRom.mutateAsync>[0]["data"] });
      queryClient.invalidateQueries({ queryKey: getListRomsQueryKey() });
      setShowUpload(false);
      setFile(null);
      setForm({ name: "", romType: "redroid-gsi", androidVersion: "14.0", deviceName: "", description: "" });
      toast({ title: "ROM uploaded", description: `"${form.name}" has been added to the library.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteRom.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRomsQueryKey() });
        toast({ title: "ROM deleted" });
        setDeleteTarget(null);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Delete failed";
        toast({ title: "Cannot delete ROM", description: msg, variant: "destructive" });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ROM Library</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage system images for Redroid containers and QEMU emulators.
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload ROM
        </Button>
      </div>

      {/* ROM type legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(ROM_TYPE_LABELS).map(([key, val]) => (
          <div key={key} className="flex items-start gap-2 p-3 border border-border rounded-lg bg-card">
            <Badge variant="outline" className={`text-[10px] shrink-0 ${val.color}`}>{val.label}</Badge>
            <p className="text-[11px] text-muted-foreground leading-tight">{val.description}</p>
          </div>
        ))}
      </div>

      {/* ROM list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading ROM library…</div>
      ) : roms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold">No ROMs yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload a .img or .zip file to get started.</p>
            </div>
            <Button onClick={() => setShowUpload(true)} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" /> Upload first ROM
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {roms.map((rom) => {
            const typeInfo = ROM_TYPE_LABELS[rom.romType] ?? ROM_TYPE_LABELS.custom;
            return (
              <Card key={rom.id} className="group hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{rom.name}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${typeInfo.color}`}>
                        {typeInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Android {rom.androidVersion}</span>
                      <span>·</span>
                      <span>{formatSize(rom.sizeMb)}</span>
                      {rom.deviceName && <><span>·</span><span>{rom.deviceName}</span></>}
                      {rom.description && <><span>·</span><span className="truncate max-w-[200px]">{rom.description}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(rom.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(rom.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload ROM Image</DialogTitle>
            <DialogDescription>
              Supported formats: .img, .zip, .raw, .bin, .iso, .gz, .xz — up to 8 GB.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File picker */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="text-sm font-medium truncate max-w-[280px]">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(Math.round(file.size / 1024 / 1024))}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select a ROM image file</p>
                </div>
              )}
              <input ref={fileRef} type="file" className="hidden" accept=".img,.zip,.raw,.bin,.iso,.gz,.xz" onChange={handleFileChange} />
            </div>

            <div className="space-y-2">
              <Label>ROM Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. LineageOS 21 x86_64" className="bg-accent/20" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>ROM Type</Label>
                <Select value={form.romType} onValueChange={v => setForm(p => ({ ...p, romType: v }))}>
                  <SelectTrigger className="bg-accent/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="redroid-gsi">Redroid GSI</SelectItem>
                    <SelectItem value="qemu-arm">QEMU ARM64</SelectItem>
                    <SelectItem value="qemu-x86">QEMU x86</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Android Version</Label>
                <Select value={form.androidVersion} onValueChange={v => setForm(p => ({ ...p, androidVersion: v }))}>
                  <SelectTrigger className="bg-accent/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["15.0","14.0","13.0","12.0","11.0","10.0","9.0"].map(v => (
                      <SelectItem key={v} value={v}>Android {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Device Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.deviceName} onChange={e => setForm(p => ({ ...p, deviceName: e.target.value }))} placeholder="e.g. Pixel 7 Pro, Galaxy S23" className="bg-accent/20" />
            </div>

            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. rooted, GMS removed…" className="bg-accent/20" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!file || !form.name || uploading} className="gap-2">
              {uploading ? "Uploading…" : <><Upload className="h-4 w-4" /> Upload ROM</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ROM?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ROM file from disk. Any emulators currently using it must be reassigned first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
