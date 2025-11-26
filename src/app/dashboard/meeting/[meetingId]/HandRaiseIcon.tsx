
"use client";
import React, { useEffect, useState } from "react";
import { Hand } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandRaiseIconProps {
  isRaised: boolean; // whether participant raised hand
  onClick?: () => void;
  isFirst?: boolean;
}

const HandRaiseIcon: React.FC<HandRaiseIconProps> = ({
  isRaised,
  isFirst,
  onClick,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isRaised) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 800); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [isRaised]);

  const green = "hsl(98, 60%, 50%)";

  if (!isRaised) {
    return null; // Don't render anything if hand is not raised
  }

  // Determine if the icon should be filled. It's filled if the hand is raised AND it's NOT the first one.
  const shouldBeFilled = isRaised && !isFirst;

  return (
    <div
      onClick={onClick}
      title={isFirst ? "First hand raised" : "Hand raised"}
      className={cn(
        "cursor-pointer transition-transform duration-300 relative",
        isAnimating && "animate-hand-wave", // Apply wave animation
        isRaised && "scale-110"
      )}
      style={{
        width: "40px",
        height: "40px",
        filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.25))",
        transformOrigin: "bottom center",
      }}
    >
      <Hand
        className="w-full h-full transition-colors duration-300"
        fill={shouldBeFilled ? green : "none"}
        stroke={green}
        strokeWidth={2}
      />
      {isFirst && (
         <span
          className="absolute -top-1 -right-1 text-yellow-400 text-xs font-bold"
          style={{
            textShadow: "0 0 6px rgba(255,215,0,0.7)",
          }}
        >
          ⭐
        </span>
      )}
    </div>
  );
};

export default HandRaiseIcon;
