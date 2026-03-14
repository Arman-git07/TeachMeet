"use client";

import React from "react";
import { Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import ControlButton from "@/components/ControlButton";

type CameraToggleProps = {
  isCameraOn: boolean;
  onToggle: () => void;
  className?: string;
};

const CameraToggle = React.forwardRef<HTMLButtonElement, CameraToggleProps>(
  ({ isCameraOn, onToggle, className }, ref) => {
    return (
      <ControlButton
  onClick={onToggle}
  className={cn(
    !isCameraOn && "bg-destructive hover:bg-destructive/90",
    className
  )}
>
        {isCameraOn ? (
          <Video className="h-6 w-6" />
        ) : (
          <VideoOff className="h-6 w-6" />
        )}
      </ControlButton>
    );
  }
);

CameraToggle.displayName = "CameraToggle";

export default CameraToggle;
