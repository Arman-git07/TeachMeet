"use client";

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
