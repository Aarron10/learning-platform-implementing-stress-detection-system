import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { Assignment } from "@shared/schema";
import { format } from "date-fns";
import { AIProctor } from "./ai-proctor"; // NEW IMPORT

interface AssignmentViewerDialogProps {
  assignment: Assignment | null;
  onClose: () => void;
}

export function AssignmentViewerDialog({ assignment, onClose }: AssignmentViewerDialogProps) {
  if (!assignment) return null;

  return (
    <Dialog open={!!assignment} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl sm:max-w-[700px] overflow-hidden">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>{assignment.title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[#2C3E50]/70">Description</h3>
            <p className="text-[#2C3E50] whitespace-pre-wrap">{assignment.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[#2C3E50]/70">Due Date</h3>
              <p className="text-[#2C3E50]">
                {format(new Date(assignment.dueDate), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[#2C3E50]/70">Status</h3>
              <p className="text-[#2C3E50] capitalize">{assignment.status}</p>
            </div>
          </div>

          {assignment.classId && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[#2C3E50]/70">Class</h3>
              <p className="text-[#2C3E50]">{assignment.classId}</p>
            </div>
          )}

          {assignment.attachmentUrl && (
            <div className="space-y-2 p-4 bg-[#F5F7FA] rounded-md border border-gray-100">
              <h3 className="text-sm font-medium text-[#2C3E50]/70">Study Material</h3>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="bg-white border-[#1976D2]/20 text-[#1976D2] hover:bg-[#1976D2]/5"
                  onClick={() => assignment.attachmentUrl && window.open(assignment.attachmentUrl, "_blank")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  View/Download Attachment
                </Button>
              </div>
            </div>
          )}

          {/* AI PROCTOR INTEGRATION */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-md font-semibold text-[#2C3E50] mb-2">Smart Study Session</h3>
            <AIProctor assignmentId={assignment.id} />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
} 