import { useEffect, useState } from "react";
import { apiGetLocationContent, type LocationContent } from "@/lib/apiClient";
import { socket } from "@/lib/socket";

export const useLocationContent = () => {
  const DEFAULT_LOCATION: LocationContent = {
    id: 1,
    address: "Koregaon Park, Pune, Maharashtra 411001",
    phone: "+91 98765 43210",
    open_time: "19:00:00",
    close_time: "23:00:00",
    closed_day: 1,
    opening_hours_display: "Tue - Sun: 7 PM - 11 PM • Mon Closed",
    instagram_handle: "@classicchinese",
    instagram_url: "https://www.instagram.com/classicchinese",
    map_embed_url: "",
  };

  const [location, setLocation] = useState<LocationContent | null>(null);

  const fetchLocation = async () => {
    try {
      const data = await apiGetLocationContent();
      setLocation(data);
    } catch (err) {
      console.error("Failed to fetch location content, using fallback:", err);
      setLocation(DEFAULT_LOCATION);
    }
  };

  useEffect(() => {
    fetchLocation();

    const handler = () => fetchLocation();

    socket.on("location-updated", handler);

    return () => {
      socket.off("location-updated", handler);
    };
  }, []);

  return location || DEFAULT_LOCATION;
};