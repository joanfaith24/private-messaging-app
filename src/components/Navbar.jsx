import { auth, db } from "../firebase.js";
import { signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function Navbar({ user }) {
  const handleLogout = async () => {
    // ── Set offline BEFORE signing out ──
    await setDoc(doc(db, "users", user.uid), {
      isOnline: false,
      lastSeen: serverTimestamp(),
    }, { merge: true });

    await signOut(auth);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-800 shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-2xl">💬</span>
        <h1 className="text-white font-bold text-xl">MessageApp</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt="avatar"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {user.displayName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
          )}
          <span className="text-gray-300 text-sm">
            {user.displayName || user.email}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Navbar;
