import { useState, useEffect, useRef } from "react";
import { db } from "../firebase.js";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc
} from "firebase/firestore";

function UserList({ currentUser, onSelectUser, selectedUser, onHideSidebar }) {
  const [contacts, setContacts] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showContacts] = useState(true);

  // Track live status listeners so we can clean them up
  const statusUnsubs = useRef({});

  useEffect(() => {
    const contactsRef = collection(db, "contacts", currentUser.uid, "list");

    const unsubscribe = onSnapshot(contactsRef, (snapshot) => {
      const contactList = snapshot.docs.map((d) => d.data());
      setContacts(contactList);

      // ── For each contact, listen LIVE to their users doc for isOnline ──
      contactList.forEach((contact) => {
        // Skip if already listening to this contact
        if (statusUnsubs.current[contact.uid]) return;

        const userRef = doc(db, "users", contact.uid);
        const statusUnsub = onSnapshot(userRef, (userSnap) => {
          if (userSnap.exists()) {
            const liveData = userSnap.data();
            setContacts((prev) =>
              prev.map((c) =>
                c.uid === contact.uid
                  ? { ...c, isOnline: liveData.isOnline ?? false }
                  : c
              )
            );
          }
        });

        statusUnsubs.current[contact.uid] = statusUnsub;

        // ── Listen to last message ──
        const conversationId = [currentUser.uid, contact.uid].sort().join("_");
        const q = query(
          collection(db, "messages"),
          where("conversationId", "==", conversationId)
        );
        onSnapshot(q, (snap) => {
          const msgs = snap.docs.map((d) => d.data());
          const last = msgs.sort((a, b) => b.createdAt - a.createdAt)[0];
          setLastMessages((prev) => ({
            ...prev,
            [contact.uid]: last,
          }));
        });
      });
    });

    return () => {
      unsubscribe();
      // Clean up all status listeners
      Object.values(statusUnsubs.current).forEach((unsub) => unsub());
      statusUnsubs.current = {};
    };
  }, [currentUser]);

  const handleAddContact = async () => {
    setAddError("");
    if (!addEmail.trim()) return;
    if (addEmail.trim() === currentUser.email) {
      setAddError("You can't add yourself!");
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", addEmail.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setAddError("User not found!");
        return;
      }

      const contactData = snapshot.docs[0].data();
      await setDoc(
        doc(db, "contacts", currentUser.uid, "list", contactData.uid),
        contactData
      );

      setAddEmail("");
      setShowAddContact(false);
    } catch {
      setAddError("Something went wrong!");
    }
  };

  const handleDeleteContact = async (contact) => {
    const conversationId = [currentUser.uid, contact.uid].sort().join("_");
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(async (d) => {
      await deleteDoc(doc(db, "messages", d.id));
    });

    await deleteDoc(doc(db, "contacts", currentUser.uid, "list", contact.uid));

    // Clean up status listener for deleted contact
    if (statusUnsubs.current[contact.uid]) {
      statusUnsubs.current[contact.uid]();
      delete statusUnsubs.current[contact.uid];
    }

    setMenuOpen(null);
    if (selectedUser?.uid === contact.uid) {
      onSelectUser(null);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      contact.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-64 shrink-0 bg-gray-800 flex flex-col border-r border-gray-700 relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-bold text-lg">Messages</h2>
          </div>
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
          >
            + Add
          </button>
        </div>

        {/* Add Contact Input */}
        {showAddContact && (
          <div className="mb-3">
            <input
              type="email"
              placeholder="Enter email to add..."
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="w-full p-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none text-sm mb-2"
            />
            {addError && <p className="text-red-400 text-xs mb-2">{addError}</p>}
            <button
              onClick={handleAddContact}
              className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
            >
              Add Contact
            </button>
          </div>
        )}

        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none text-sm"
        />
      </div>

      {/* Contact List */}
      <div
        style={{ display: showContacts ? "block" : "none" }}
        className="flex-1 overflow-y-auto"
      >
        {filteredContacts.length === 0 ? (
          <div className="text-center mt-8">
            <p className="text-gray-400 text-sm">No contacts yet!</p>
            <p className="text-gray-500 text-xs mt-1">Click + Add to add someone</p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const lastMsg = lastMessages[contact.uid];
            return (
              <div
                key={contact.uid}
                className={`relative flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-700 transition border-b border-gray-700 ${
                  selectedUser?.uid === contact.uid ? "bg-gray-700" : ""
                }`}
              >
                {/* Contact Info */}
                <div
                  className="flex items-center gap-3 flex-1 min-w-0"
                  onClick={() => onSelectUser(contact)}
                >
                  <div className="relative">
                    {contact.photoURL ? (
                      <img
                        src={contact.photoURL}
                        alt="avatar"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {contact.displayName?.[0]?.toUpperCase() ||
                          contact.email[0].toUpperCase()}
                      </div>
                    )}
                    {/* ── LIVE status dot ── */}
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${
                        contact.isOnline ? "bg-green-500" : "bg-gray-500"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-white font-medium text-sm">
                        {contact.displayName || contact.email}
                      </p>
                      {lastMsg?.createdAt && (
                        <p className="text-gray-500 text-xs">
                          {lastMsg.createdAt
                            ?.toDate?.()
                            .toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        </p>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs truncate">
                      {lastMsg
                        ? lastMsg.text || "📷 Image"
                        : contact.isOnline
                        ? "🟢 Online"
                        : "⚫ Offline"}
                    </p>
                  </div>
                </div>

                {/* 3 dots menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === contact.uid ? null : contact.uid);
                    }}
                    className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-600 transition"
                  >
                    ⋮
                  </button>

                  {menuOpen === contact.uid && (
                    <div className="absolute right-0 top-8 bg-gray-900 rounded-lg shadow-xl z-10 w-44 border border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteContact(contact);
                        }}
                        className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-800 rounded-lg text-sm"
                      >
                        🗑️ Delete Contact
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hide sidebar button */}
      <button
        onClick={onHideSidebar}
        className="hidden md:flex absolute -right-3 top-1/2 transform -translate-y-1/2 z-20 bg-gray-600 hover:bg-gray-500 text-white rounded-r-full w-3 h-10 items-center justify-center shadow-lg transition text-xs"
      >
        ◀
      </button>
    </div>
  );
}

export default UserList;
