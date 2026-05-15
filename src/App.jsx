import { useState, useEffect } from "react";
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp} from "firebase/firestore";
import Auth from "./components/Auth.jsx";
import Navbar from "./components/Navbar.jsx";
import UserList from "./components/UserList.jsx";
import Chat from "./components/Chat.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);

        // ── Use setDoc with merge:true so it works for NEW and EXISTING users ──
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email,
          photoURL: currentUser.photoURL || null,
          isOnline: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

        // ── Set offline on tab close (sync, not async — more reliable) ──
        const setOffline = () => {
          // Use sendBeacon for reliable fire-and-forget on tab close
          const userRef = doc(db, "users", currentUser.uid);
          setDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp(),
          }, { merge: true });
        };

        window.addEventListener("beforeunload", setOffline);
        window.addEventListener("pagehide", setOffline);

        // Cleanup
        return () => {
          setOffline();
          window.removeEventListener("beforeunload", setOffline);
          window.removeEventListener("pagehide", setOffline);
        };

      } else {
        // User logged out — already handled in Navbar but fallback here
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleSelectUser = (selected) => {
    setSelectedUser(selected);
    if (isMobile) setShowSidebar(false);
  };

  const handleShowSidebar = () => {
    setShowSidebar(true);
    if (isMobile) setSelectedUser(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <Navbar user={user} />
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        {showSidebar && (
          <div className={`${isMobile ? "w-full" : "w-64 shrink-0"} bg-gray-800 flex flex-col border-r border-gray-700 relative`}>
            <UserList
              currentUser={user}
              onSelectUser={handleSelectUser}
              selectedUser={selectedUser}
              onHideSidebar={() => setShowSidebar(false)}
            />
          </div>
        )}

        {/* Chat */}
        {(!isMobile || !showSidebar) && (
          <div className="flex-1 flex flex-col min-w-0">
            <Chat
              currentUser={user}
              selectedUser={selectedUser}
              showSidebar={showSidebar}
              onShowSidebar={handleShowSidebar}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
