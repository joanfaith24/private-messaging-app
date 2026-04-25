
import { useState } from "react";
import { auth, googleProvider } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const saveUserToFirestore = async (user) => {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email,
      photoURL: user.photoURL || null,
      createdAt: new Date()
    }, { merge: true });
  };

  const handleSubmit = async () => {
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        await saveUserToFirestore({ ...result.user, displayName });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserToFirestore(result.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-2">💬 MessageApp</h1>
        <h2 className="text-gray-400 text-center mb-6">{isLogin ? "Welcome back!" : "Create an account"}</h2>

        {!isLogin && (
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full p-3 mb-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
        />

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg mb-3 transition"
        >
          {isLogin ? "Login" : "Sign Up"}
        </button>

        <button
          onClick={handleGoogle}
          className="w-full p-3 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-lg mb-3 transition"
        >
          Sign in with Google
        </button>

        <p className="text-gray-400 text-center text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 ml-1 hover:underline"
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Auth;

