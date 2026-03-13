import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface DeviceFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function DeviceFrame({ children, className }: DeviceFrameProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <IPhoneFrame className={className}>{children}</IPhoneFrame>;
  }

  return <MonitorFrame className={className}>{children}</MonitorFrame>;
}

function MonitorFrame({ children, className }: DeviceFrameProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Monitor body */}
      <div className="w-full rounded-xl border-[3px] border-foreground/20 bg-foreground/5 p-1 shadow-xl">
        {/* Screen bezel */}
        <div className="rounded-lg overflow-hidden bg-background border border-border">
          {/* Top bar with dots */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/80 border-b border-border">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
          </div>
          {/* Screen content */}
          <div className="w-full" style={{ aspectRatio: "16 / 10", maxHeight: "70vh" }}>
            {children}
          </div>
        </div>
      </div>
      {/* Monitor stand */}
      <div className="w-24 h-5 bg-foreground/10 rounded-b-lg border-x-[3px] border-b-[3px] border-foreground/20" />
      <div className="w-40 h-2 bg-foreground/10 rounded-b-xl border-x-[3px] border-b-[3px] border-foreground/20 -mt-px" />
    </div>
  );
}

function IPhoneFrame({ children, className }: DeviceFrameProps) {
  return (
    <div className={cn("flex justify-center py-4 w-full overflow-x-hidden", className)}>
      <div className="relative flex-shrink-0 w-full max-w-[340px] aspect-[9/16] overflow-hidden">
        {/* Phone shell - fixed frame */}
        <div className="absolute inset-0 rounded-[2.5rem] border-[4px] border-foreground/25 bg-foreground/5 shadow-xl pointer-events-none z-10" />
        {/* Notch / Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-foreground/20 rounded-full z-20" />
        {/* Bottom bar */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-foreground/20 rounded-full z-20" />
        {/* Screen area */}
        <div className="absolute inset-[6px] rounded-[2rem] overflow-hidden bg-background">
          <div className="w-full h-full max-w-full overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none [overscroll-behavior-inline:none]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
