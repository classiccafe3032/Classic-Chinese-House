import { useEffect, useState } from "react";
import type { LocationContent } from "@/lib/apiClient";

export const useRestaurantStatus = (data: LocationContent | null) => {
  const [status, setStatus] = useState({
    open: false,
    message: "",
  });

  const getRestaurantStatus = (data: LocationContent) => {
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const today = now.getDay();

    if (today === data.closed_day) {
      return { open: false, message: "Closed Today" };
    }

    const parseTime = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const openMinutes = parseTime(data.open_time);
    const closeMinutes = parseTime(data.close_time);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let isOpen = false;

    if (closeMinutes > openMinutes) {
      isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } else {
      isOpen = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }

    const formatTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;

      const hour = h % 12 || 12;
      const period = h >= 12 ? "PM" : "AM";

      return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
    };

    if (isOpen) {
      return {
        open: true,
        message: `Open Now • Closes at ${formatTime(closeMinutes)}`,
      };
    }

    if (currentMinutes < openMinutes) {
      return {
        open: false,
        message: `Opens at ${formatTime(openMinutes)}`,
      };
    }

    return { open: false, message: "Closed for Today" };
  };

  useEffect(() => {
    if (!data) return;

    const updateStatus = () => {
      setStatus(getRestaurantStatus(data));
    };

    updateStatus();

    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, [data]);

  return status;
};