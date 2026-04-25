import { useState, useEffect, useRef } from "react";
import { db } from "../firebase.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  updateDoc,
  doc,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import VideoCall from "./VideoCall.jsx";

function Chat({ currentUser, selectedUser, showSidebar, onShowSidebar }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [initiatorUid, setInitiatorUid] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const conversationIdRef = useRef(null);

  const conversationId = selectedUser
    ? [currentUser.uid, selectedUser.uid].sort().join("_")
    : null;

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Listen for messages
  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      snapshot.docs.forEach(async (d) => {
        const msg = d.data();
        if (msg.senderId !== currentUser.uid && !msg.read) {
          await updateDoc(doc(db, "messages", d.id), { read: true });
        }
      });
    });
    return () => unsubscribe();
  }, [conversationId, currentUser]);

  // Listen for calls
  useEffect(() => {
    const callDoc = doc(db, "calls", currentUser.uid);
    const unsubscribe = onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      if (data.status === "calling") {
        setIncomingCall(data);

      } else if (data.status === "ended") {
        // Save call log ONLY if I am the initiator
        if (data.initiatorUid === currentUser.uid) {
          const convId = conversationIdRef.current;
          if (convId && data.duration) {
            try {
              await addDoc(collection(db, "messages"), {
                conversationId: convId,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || currentUser.email,
                senderPhoto: currentUser.photoURL || null,
                text: `📞 ${currentUser.displayName || currentUser.email} called • ${data.duration}`,
                imageUrl: null,
                isCallLog: true,
                read: false,
                createdAt: serverTimestamp()
              });
            } catch(err) {
              console.error("Call log error:", err);
            }
          }
        }

        setInCall(false);
        setIncomingCall(null);
        setInitiatorUid(null);
        await deleteDoc(doc(db, "calls", currentUser.uid));
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Auto scroll
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setIsAtBottom(scrollHeight - scrollTop <= clientHeight + 50);
  };

  const sendMessage = async (imageUrl = null) => {
    if (!text.trim() && !imageUrl) return;
    if (!selectedUser) return;
    try {
      await addDoc(collection(db, "messages"), {
        conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderPhoto: currentUser.photoURL || null,
        text: text.trim(),
        imageUrl: imageUrl || null,
        read: false,
        createdAt: serverTimestamp()
      });
      setText("");
      setIsAtBottom(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      await sendMessage(data.secure_url);
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  const startCall = async () => {
    const uid = currentUser.uid;
    setInitiatorUid(uid);
    await setDoc(doc(db, "calls", selectedUser.uid), {
      from: uid,
      fromName: currentUser.displayName || currentUser.email,
      status: "calling",
      initiatorUid: uid
    });
    setInCall(true);
  };

  const acceptCall = async () => {
    const uid = incomingCall?.from;
    setInitiatorUid(uid);
    await deleteDoc(doc(db, "calls", currentUser.uid));
    setIncomingCall(null);
    setInCall(true);
  };

  const declineCall = async () => {
    await deleteDoc(doc(db, "calls", currentUser.uid));
    setIncomingCall(null);
  };

  const endCall = async () => {
    setInCall(false);
    setInitiatorUid(null);
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          {!showSidebar && (
            <button
              onClick={onShowSidebar}
              className="mb-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
            >
              ◀ Show Contacts
            </button>
          )}
          <p className="text-5xl mb-4">💬</p>
          <p className="text-gray-400 text-xl">Select a user to start chatting!</p>
        </div>

        {incomingCall && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-2xl text-center shadow-xl">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                {incomingCall.fromName?.[0]?.toUpperCase()}
              </div>
              <p className="text-white text-xl font-bold mb-2">{incomingCall.fromName}</p>
              <p className="text-gray-400 mb-6">Incoming Video Call...</p>
              <div className="flex gap-4 justify-center">
                <button onClick={declineCall} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition">
                  ❌ Decline
                </button>
                <button onClick={acceptCall} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition">
                  ✅ Accept
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 min-h-0">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-gray-800 border-b border-gray-700">
        {!showSidebar && (
          <button
            onClick={onShowSidebar}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition"
          >
            ◀
          </button>
        )}
        <div className="relative">
          {selectedUser.photoURL ? (
            <img src={selectedUser.photoURL} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {selectedUser.displayName?.[0]?.toUpperCase() || selectedUser.email[0].toUpperCase()}
            </div>
          )}
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${selectedUser.isOnline ? "bg-green-500" : "bg-gray-500"}`} />
        </div>
        <div>
          <p className="text-white font-bold">{selectedUser.displayName || selectedUser.email}</p>
          <p className="text-xs text-gray-400">{selectedUser.isOnline ? "🟢 Online" : "⚫ Offline"}</p>
        </div>
        <button
          onClick={startCall}
          className="ml-auto shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
        >
          🎥 Video Call
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="p-6 flex flex-col gap-3"
        style={{ overflowY: "scroll", flex: "1 1 0", minHeight: 0 }}
      >
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.uid;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              {!isMe && (
                msg.senderPhoto ? (
                  <img src={msg.senderPhoto} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    {msg.senderName?.[0]?.toUpperCase()}
                  </div>
                )
              )}
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
  isMe
    ? "bg-blue-600 text-white rounded-br-none"
    : "bg-gray-700 text-white rounded-bl-none"
}`}>
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="shared" className="rounded-xl mb-2 max-w-full cursor-pointer" onClick={() => window.open(msg.imageUrl, "_blank")} />
                )}
                {msg.text && <p className="text-sm">{msg.text}</p>}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <p className="text-xs opacity-60">
                    {msg.createdAt?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {isMe && !msg.isCallLog && <span className="text-xs">{msg.read ? "✅" : "⬜"}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-4 bg-gray-800 border-t border-gray-700">
        <input type="file" accept="image/*" ref={fileRef} onChange={handleImageUpload} className="hidden" />
        <button onClick={() => fileRef.current.click()} className="shrink-0 p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition" disabled={uploading}>
          {uploading ? "⏳" : "📷"}
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 p-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 focus:outline-none text-sm"
        />
        <button onClick={() => sendMessage()} className="shrink-0 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition">
          Send
        </button>
      </div>

      {/* Incoming Call */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
          <div className="bg-gray-800 p-8 rounded-2xl text-center shadow-xl">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
              {incomingCall.fromName?.[0]?.toUpperCase()}
            </div>
            <p className="text-white text-xl font-bold mb-2">{incomingCall.fromName}</p>
            <p className="text-gray-400 mb-6">Incoming Video Call...</p>
            <div className="flex gap-4 justify-center">
              <button onClick={declineCall} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition">
                ❌ Decline
              </button>
              <button onClick={acceptCall} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition">
                ✅ Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call */}
      {inCall && (
        <VideoCall
          currentUser={currentUser}
          selectedUser={selectedUser}
          onEndCall={endCall}
          initiatorUid={initiatorUid}
        />
      )}
    </div>
  );
}

export default Chat;