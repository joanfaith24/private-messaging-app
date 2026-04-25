import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { db } from "../firebase.js";
import { doc, setDoc } from "firebase/firestore";

function VideoCall({ currentUser, selectedUser, onEndCall, initiatorUid }) {
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const localVideoRef = useRef(null);
  const clientRef = useRef(null);
  const localTracksRef = useRef([]);
  const callStartRef = useRef(Date.now());
  const handleEndCallRef = useRef(null);

  const appId = import.meta.env.VITE_AGORA_APP_ID;
  const channel = [currentUser.uid, selectedUser.uid].sort().join("_");

  const handleEndCall = async () => {
    const duration = Math.floor((Date.now() - callStartRef.current) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    // Signal end to both users with initiator info and duration
    try {
      await setDoc(doc(db, "calls", selectedUser.uid), {
        status: "ended",
        duration: durationText,
        initiatorUid: initiatorUid
      });
      await setDoc(doc(db, "calls", currentUser.uid), {
        status: "ended",
        duration: durationText,
        initiatorUid: initiatorUid
      });
    } catch(err) {
      console.error(err);
    }

    localTracksRef.current.forEach((track) => {
      track.stop();
      track.close();
    });

    try {
      await clientRef.current?.leave();
    } catch(err) {
      console.error("Leave error:", err);
    }

    onEndCall();
  };

  handleEndCallRef.current = handleEndCall;

  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    const init = async () => {
      try {
        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "video") {
            setRemoteUsers((prev) => {
              const exists = prev.find((u) => u.uid === user.uid);
              if (exists) return prev;
              return [...prev, user];
            });
            setTimeout(() => {
              const container = document.getElementById("remote-container");
              if (container) {
                container.innerHTML = "";
                user.videoTrack?.play(container);
              }
            }, 1000);
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
          }
        });

        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "video") {
            setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
          }
        });

        client.on("user-left", async () => {
          await handleEndCallRef.current();
        });

        await client.join(appId, channel, null, null);

        const [micTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          {},
          {
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 15,
              bitrateMin: 400,
              bitrateMax: 800,
            },
            facingMode: "user"
          }
        );

        localTracksRef.current = [micTrack, cameraTrack];
        await client.publish([micTrack, cameraTrack]);

        setTimeout(() => {
          if (localVideoRef.current) {
            cameraTrack.play(localVideoRef.current);
          }
        }, 500);

      } catch (err) {
        console.error("Agora Error:", err);
      }
    };

    init();

    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => {
      window.history.pushState(null, "", window.location.href);
      handleEndCallRef.current();
    };

    return () => {
      localTracksRef.current.forEach((track) => {
        track.stop();
        track.close();
      });
      client.leave();
      window.onpopstate = null;
    };
  }, []);

  const handleMute = () => {
    localTracksRef.current[0]?.setMuted(!muted);
    setMuted(!muted);
  };

  const handleCamera = () => {
    localTracksRef.current[1]?.setMuted(!cameraOff);
    setCameraOff(!cameraOff);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 bg-gray-800">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
          {selectedUser.displayName?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-white font-bold">{selectedUser.displayName || selectedUser.email}</p>
          <p className="text-green-400 text-sm">Video Call in progress...</p>
        </div>
      </div>

      <div className="flex-1 relative">
        <div
          id="remote-container"
          className="w-full h-full bg-gray-900"
          style={{ minHeight: "300px" }}
        >
          {remoteUsers.length === 0 && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
                  {selectedUser.displayName?.[0]?.toUpperCase()}
                </div>
                <p className="text-white text-xl">
                  Waiting for {selectedUser.displayName || selectedUser.email} to join...
                </p>
              </div>
            </div>
          )}
        </div>

        <div
          ref={localVideoRef}
          className="absolute bottom-4 right-4 rounded-xl overflow-hidden border-2 border-blue-500 bg-gray-800"
          style={{ width: "100px", height: "140px" }}
        />
      </div>

      <div className="flex items-center justify-center gap-6 py-6 bg-gray-800">
        <button
          onClick={handleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${
            muted ? "bg-red-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
        >
          {muted ? "🔇" : "🎤"}
        </button>

        <button
          onClick={handleEndCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-2xl transition"
        >
          📵
        </button>

        <button
          onClick={handleCamera}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition ${
            cameraOff ? "bg-red-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
        >
          {cameraOff ? "📷" : "🎥"}
        </button>
      </div>
    </div>
  );
}

export default VideoCall;