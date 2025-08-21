
"use client";

import React from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";

type Props = { meetingId: string; userId: string };

export default function MeetingClient({ meetingId, userId }: Props) {
  const localRef = React.useRef<HTMLVideoElement>(null);
  const [rtc] = React.useState(() => new MeshRTC({
    roomId: meetingId,
    userId,
    onRemoteStream: (socketId, stream) => {
      // create/attach a remote video tile
      let el = document.getElementById(`remote-${socketId}`) as HTMLVideoElement | null;
      if (!el) {
        el = document.createElement("video");
        el.id = `remote-${socketId}`;
        el.autoplay = true;
        el.playsInline = true;
        el.controls = false;
        el.muted = false;
        el.style.width = "240px";
        el.style.borderRadius = "16px";
        document.getElementById("remotes")?.appendChild(el);
      }
      el.srcObject = stream;
    },
    onRemoteLeft: (socketId) => {
      const el = document.getElementById(`remote-${socketId}`);
      if (el?.parentElement) el.parentElement.removeChild(el);
    },
  }));

  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);

  // Init once
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      await rtc.init();
      if (!mounted) return;
      if (localRef.current) rtc.attachLocal(localRef.current);
    })();
    return () => {
      mounted = false;
      rtc.leave();
    };
    // DO NOT add rtc to deps: we want this to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    await rtc.toggleMic(next);
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    await rtc.toggleCam(next);
  };

  return (
    <div className="w-full h-full grid grid-rows-[1fr_auto] gap-2">
      <div className="relative w-full h-full rounded-2xl bg-slate-800/40 p-3 overflow-auto">
        <div className="grid gap-3 grid-cols-[minmax(240px,400px)_1fr] h-full">
          <video
            ref={localRef}
            id="local"
            className="w-full h-auto rounded-2xl bg-black"
            muted
            playsInline
            autoPlay
          />
          <div id="remotes" className="grid grid-cols-2 md:grid-cols-3 gap-3 content-start" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 p-3">
        <button
          onClick={toggleMic}
          className={`px-4 py-2 rounded-xl ${micOn ? "bg-green-600" : "bg-red-600"}`}
        >
          {micOn ? "Mic On" : "Mic Off"}
        </button>
        <button
          onClick={toggleCam}
          className={`px-4 py-2 rounded-xl ${camOn ? "bg-green-600" : "bg-red-600"}`}
        >
          {camOn ? "Cam On" : "Cam Off"}
        </button>
      </div>
    </div>
  );
}
