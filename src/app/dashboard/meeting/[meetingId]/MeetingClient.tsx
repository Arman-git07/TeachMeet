
"use client";

import React from "react";
import { MeshRTC } from "@/lib/webrtc/mesh";

type Props = { 
  meetingId: string; 
  userId: string;
  onMicToggle: (isOn: boolean) => void;
  onCamToggle: (isOn: boolean) => void;
  onUserJoined: (socketId: string) => void;
};

export default function MeetingClient({ meetingId, userId, onMicToggle, onCamToggle, onUserJoined }: Props) {
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
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = "cover";
        el.style.borderRadius = "16px";
        
        const container = document.createElement("div");
        container.id = `remote-container-${socketId}`;
        container.className = "aspect-video bg-muted rounded-2xl overflow-hidden";
        container.appendChild(el);
        document.getElementById("remotes")?.appendChild(container);
      }
      el.srcObject = stream;
    },
    onRemoteLeft: (socketId) => {
      const el = document.getElementById(`remote-container-${socketId}`);
      if (el?.parentElement) el.parentElement.removeChild(el);
    },
    onUserJoined,
  }));

  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);

  // Init once
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      // Load initial state from localStorage
      const desiredCamState = localStorage.getItem('teachmeet-desired-camera-state') !== 'off';
      const desiredMicState = localStorage.getItem('teachmeet-desired-mic-state') === 'on';

      setCamOn(desiredCamState);
      onCamToggle(desiredCamState);
      setMicOn(desiredMicState);
      onMicToggle(desiredMicState);

      await rtc.init(desiredMicState, desiredCamState);
      if (!mounted) return;
      if (localRef.current) rtc.attachLocal(localRef.current);
    })();
    return () => {
      mounted = false;
      rtc.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    onMicToggle(next);
    await rtc.toggleMic(next);
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    onCamToggle(next);
    await rtc.toggleCam(next);
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 w-full h-full grid grid-cols-1 md:grid-cols-4 grid-rows-4 md:grid-rows-1 gap-2 md:gap-4 p-2 md:p-4">
        {/* Remote videos container */}
        <div id="remotes" className="w-full h-full col-span-1 row-span-3 md:col-span-3 md:row-span-1 grid grid-cols-2 grid-rows-2 sm:grid-cols-3 gap-2 md:gap-4" />
        
        {/* Local video tile */}
        <div className="w-full h-full col-span-1 row-span-1 flex items-center justify-center">
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg">
                <video
                    ref={localRef}
                    id="local"
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    autoPlay
                />
            </div>
        </div>
      </div>
      
      {/* Hidden buttons for external control from the main page */}
      <div style={{ display: 'none' }}>
        <button id="meeting-client-mic-toggle" onClick={toggleMic}>Toggle Mic</button>
        <button id="meeting-client-cam-toggle" onClick={toggleCam}>Toggle Cam</button>
      </div>
    </div>
  );
}
