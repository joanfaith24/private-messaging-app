import { useState, useEffect } from "react";
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
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
        await updateDoc(doc(db, "users", currentUser.uid), {
          isOnline: true,
          lastSeen: serverTimestamp()
        });

        window.addEventListener("beforeunload", async () => {
          await updateDoc(doc(db, "users", currentUser.uid), {
            isOnline: false,
            lastSeen: serverTimestamp()
          });
        });
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

        {/* Sidebar - full width on mobile, fixed width on desktop */}
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

        {/* Chat - hidden on mobile when sidebar is shown */}
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