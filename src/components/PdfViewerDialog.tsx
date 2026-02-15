import { useState } from "react";
import { X, Download, ExternalLink, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
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
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  const handleDownload = async () => {
    try {
      const response = await fetch(pdfUrl, {
        mode: 'cors',
        credentials: 'omit',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const fileName = `${title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`;
        
        // Use Web Share API for mobile if available
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
          const file = new File([blob], fileName, { type: 'application/pdf' });
          try {
            await navigator.share({ files: [file], title: title });
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') return;
          }
        }
        
        // Fallback: blob download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        throw new Error('Fetch failed');
      }
    } catch (error) {
      // Final fallback
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenExternal = () => {
    window.open(pdfUrl, '_blank');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Use the direct PDF URL for the iframe viewer
  const viewerUrl = pdfUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={`${isFullscreen ? 'max-w-[100vw] h-[100vh] m-0 rounded-none' : 'max-w-5xl h-[90vh]'} p-0 gap-0 flex flex-col bg-background/95 backdrop-blur-xl border-primary/20`}
      >
        {/* Header */}
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
            
            {/* Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="h-7 w-7"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium min-w-[40px] text-center">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="h-7 w-7"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                className="h-8 w-8 hidden sm:flex"
                title="Rotate"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-8 w-8"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenExternal}
                className="h-8 w-8"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="hidden sm:flex gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 ml-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* PDF Viewer */}
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
            style={isEmbed ? undefined : {
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            title={`Book: ${title}`}
            onLoad={() => setIsLoading(false)}
            allow="autoplay"
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Mobile Download Button */}
        <div className="sm:hidden p-3 border-t border-border/50 bg-muted/30">
          <Button
            onClick={handleDownload}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfViewerDialog;
