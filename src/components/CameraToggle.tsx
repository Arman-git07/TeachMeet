
"use client";

import React from "react";
import { Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import ControlButton from "@/components/ControlButton";
import React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function ControlButton({ className, ...props }: Props) {
  return (
    <button
      className={cn(
        "flex items-center justify-center rounded-full p-3 bg-gray-800 hover:bg-gray-700 text-white",
        className
      )}
      {...props}
    />
  );
}

type CameraToggleProps = {
  isCameraOn: boolean;
  onToggle: () => void;
  className?: string;
};

const CameraToggle = React.forwardRef<HTMLButtonElement, CameraToggleProps>(({ isCameraOn, onToggle, className }, ref) => {
  return (
    <ControlButton
        label={isCameraOn ? "Stop Camera" : "Start Camera"}
        onClick={onToggle}
        className={cn(!isCameraOn && "bg-destructive hover:bg-destructive/90", className)}
        ref={ref}
      >
      {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
    </ControlButton>
  );
});

CameraToggle.displayName = "CameraToggle";

export default CameraToggle;
