import { useState, useEffect } from "react";
import { X, Download, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PdfViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
  author?: string;
  isEmbed?: boolean;
}

const PdfViewerDialog = ({ isOpen, onClose, pdfUrl, title, author, isEmbed }: PdfViewerDialogProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerUrl, setViewerUrl] = useState("");

  useEffect(() => {
    if (!pdfUrl) return;
    
    if (isEmbed) {
      // For non-PDF URLs (like Google Books search), use directly
      setViewerUrl(pdfUrl);
    } else {
      // For PDF URLs, use Google Docs viewer to bypass iframe restrictions
      const encodedUrl = encodeURIComponent(pdfUrl);
      setViewerUrl(`https://docs.google.com/gview?url=${encodedUrl}&embedded=true`);
    }
  }, [pdfUrl, isEmbed]);

  const handleDownload = async () => {
    try {
      const response = await fetch(pdfUrl, { mode: 'cors', credentials: 'omit' });
      if (response.ok) {
        const blob = await response.blob();
        const fileName = `${title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`;
        
        if (navigator.canShare?.({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
          try {
            await navigator.share({ files: [new File([blob], fileName, { type: 'application/pdf' })], title });
            return;
          } catch (e: any) { if (e.name === 'AbortError') return; }
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        throw new Error('Fetch failed');
      }
    } catch {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={`${isFullscreen ? 'max-w-[100vw] h-[100vh] m-0 rounded-none' : 'max-w-5xl h-[90vh]'} p-0 gap-0 flex flex-col bg-background/95 backdrop-blur-xl border-primary/20`}
      >
        <DialogHeader className="px-4 py-3 border-b border-border/50 bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold truncate bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {title}
              </DialogTitle>
              {author && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">by {author}</p>
              )}
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8">
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => window.open(pdfUrl, '_blank')} className="h-8 w-8">
                <ExternalLink className="h-4 w-4" />
              </Button>
              {!isEmbed && (
                <Button variant="outline" size="sm" onClick={handleDownload} className="hidden sm:flex gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 ml-1">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden bg-muted/20">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            </div>
          )}
          
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            title={`Book: ${title}`}
            onLoad={() => setIsLoading(false)}
            allow="autoplay"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="sm:hidden p-3 border-t border-border/50 bg-muted/30">
          <Button onClick={handleDownload} className="w-full gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfViewerDialog;
