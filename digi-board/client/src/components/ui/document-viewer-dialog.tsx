import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

interface DocumentViewerDialogProps {
    url: string | null;
    title: string;
    open: boolean;
    onClose: () => void;
}

export function DocumentViewerDialog({ url, title, open, onClose }: DocumentViewerDialogProps) {
    if (!url || !open) return null;

    const handleDownload = () => {
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.download = title + (url.split('.').pop() ? `.${url.split('.').pop()}` : '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getFilePreview = () => {
        if (!url) return null;

        const fileType = url.split('.').pop()?.toLowerCase();

        // Function to get Google Docs Viewer URL
        const getGoogleDocsViewerUrl = (fileUrl: string) => {
            // Convert relative URL to absolute URL for Google Docs Viewer
            const absoluteUrl = new URL(fileUrl, window.location.origin).toString();
            return `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;
        };

        switch (fileType) {
            case 'pdf':
                return (
                    <div className="flex flex-col h-[85vh] w-full">
                        <div className="flex justify-end mb-2">
                            <Button
                                variant="outline"
                                onClick={handleDownload}
                                className="flex items-center gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Download PDF
                            </Button>
                        </div>
                        <iframe
                            src={url}
                            className="w-full flex-1 border rounded-md shadow-sm"
                            title={title}
                        />
                    </div>
                );
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'webp':
                return (
                    <div className="flex flex-col h-[85vh] w-full">
                        <div className="flex justify-end mb-2">
                            <Button
                                variant="outline"
                                onClick={handleDownload}
                                className="flex items-center gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Download Image
                            </Button>
                        </div>
                        <div className="flex-1 flex items-center justify-center bg-gray-50 border rounded-md overflow-hidden p-4">
                            <img
                                src={url}
                                alt={title}
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                    </div>
                );
            case 'doc':
            case 'docx':
            case 'ppt':
            case 'pptx':
            case 'xls':
            case 'xlsx':
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

                if (isLocalhost) {
                    return (
                        <div className="flex flex-col items-center justify-center h-[50vh] bg-gray-50 border rounded-md p-8 text-center">
                            <div className="mb-4 p-4 bg-orange-100 text-orange-800 rounded-full">
                                <Download className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-[#2C3E50] mb-2">Local Development Mode</h3>
                            <p className="text-[#2C3E50]/70 mb-6 max-w-md">
                                Microsoft Office documents cannot be previewed on localhost because the cloud viewer (Google Docs) cannot access your local network.
                                <br /><br />
                                Please download the file to view it, or deploy the application to a public server.
                            </p>
                            <Button
                                onClick={handleDownload}
                                className="flex items-center gap-2 bg-[#1976D2] hover:bg-[#1976D2]/90"
                            >
                                <Download className="h-4 w-4" />
                                Download Document
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col h-[85vh] w-full">
                        <div className="flex justify-end mb-2">
                            <Button
                                variant="outline"
                                onClick={handleDownload}
                                className="flex items-center gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Download Document
                            </Button>
                        </div>
                        <iframe
                            src={getGoogleDocsViewerUrl(url)}
                            className="w-full flex-1 border rounded-md shadow-sm"
                            title={title}
                        />
                    </div>
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-[50vh] bg-gray-50 border rounded-md">
                        <p className="text-lg text-gray-600 mb-4">
                            Browser preview not available for this file type
                        </p>
                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            className="flex items-center gap-2 bg-[#1976D2] text-white hover:bg-[#1976D2]/90 hover:text-white"
                        >
                            <Download className="h-4 w-4" />
                            Download Full File Instead
                        </Button>
                    </div>
                );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] flex flex-col p-2 pt-10 md:p-6 overflow-hidden">
                <DialogHeader className="flex-shrink-0 absolute top-2 left-4 z-10">
                    <DialogTitle className="text-lg md:text-xl font-bold bg-white/90 backdrop-blur-sm px-3 py-1 rounded-md text-[#2C3E50]">{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 h-full w-full overflow-hidden">
                    {getFilePreview()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
