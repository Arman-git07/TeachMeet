
"use client";

import React from "react";
import { Video, VideoOff } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type CameraToggleProps = {
  isCameraOn: boolean;
  onToggle: () => void;
};

export default function CameraToggle({ isCameraOn, onToggle }: CameraToggleProps) {
  return (
    <Button
      variant={isCameraOn ? "default" : "destructive"}
      size="icon"
      className={cn(
        "h-14 w-14 rounded-full flex flex-col items-center justify-center gap-1 text-xs text-white",
        !isCameraOn && "bg-destructive hover:bg-destructive/90"
      )}
      onClick={onToggle}
      aria-label={isCameraOn ? "Stop Camera" : "Start Camera"}
    >
      {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
    </Button>
  );
}
