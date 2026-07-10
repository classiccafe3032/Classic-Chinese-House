import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:4000",
  {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  }
);

socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("❌ Socket disconnected");
});