import { Trophy, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-md">
            <Trophy className="h-5 w-5 text-accent" />
          </div>
          <span className="font-bold text-xl tracking-tight text-primary">StatChasers</span>
        </div>
        <div className="flex items-center">
          <Badge variant="outline" className="font-medium flex items-center gap-1 border-border/50">
            <Info className="h-3 w-3" />
            2025 Guide
          </Badge>
        </div>
      </div>
    </header>
  );
}
