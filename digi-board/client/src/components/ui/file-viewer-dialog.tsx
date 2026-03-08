import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { Material } from "@shared/schema";
import { DocumentViewerDialog } from "./document-viewer-dialog";

interface FileViewerDialogProps {
  material: Material | null;
  onClose: () => void;
}

export function FileViewerDialog({ material, onClose }: FileViewerDialogProps) {
  if (!material) return null;

  return (
    <DocumentViewerDialog
      open={!!material}
      onClose={onClose}
      url={material.fileUrl}
      title={material.title}
    />
  );
} 