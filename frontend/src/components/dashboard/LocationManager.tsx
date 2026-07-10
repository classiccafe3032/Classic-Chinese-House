import { useState, useEffect, useCallback } from "react";
import {
  apiGetLocationContent,
  apiUpdateLocationContent,
  apiResolveMapUrl,
  type LocationContent,
} from "@/lib/apiClient";
import { validateMobile } from "@/lib/validators";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import {
  Save,
  Loader2,
  MapPin,
  Phone,
  Clock,
  Instagram,
  Map,
  Link,
} from "lucide-react";

function generateOpeningHoursDisplay(
  openTime: string,
  closeTime: string,
  closedDay: number
) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);

    const hour = h % 12 || 12;
    const period = h >= 12 ? "PM" : "AM";

    return `${hour}${m ? ":" + m.toString().padStart(2, "0") : ""} ${period}`;
  };

  const open = formatTime(openTime);
  const close = formatTime(closeTime);

  // No closed day — open all week
  if (closedDay < 0 || closedDay > 6) {
    return `Mon – Sun: ${open} – ${close} • Open All Days`;
  }

  const startDay = days[(closedDay + 1) % 7];
  const endDay = days[(closedDay + 6) % 7];
  const closed = days[closedDay];

  return `${startDay} – ${endDay}: ${open} – ${close} • ${closed} Closed`;
}

const LocationManager = () => {
  const [data, setData] = useState<LocationContent | null>(null);

  const [mapsLink, setMapsLink] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  /* ---------------- LOAD DATA ---------------- */

  useEffect(() => {
    apiGetLocationContent()
      .then((d) =>
        setData({
          ...d,
          open_time: d.open_time || "18:00",
          close_time: d.close_time || "23:00",
          closed_day: d.closed_day ?? 1,
          opening_hours_display:
            d.opening_hours_display || "Tue - Sun: 6 PM - 11 PM • Mon Closed",
        }),
      )
      .catch(() => toast.error("Failed to load location data"))
      .finally(() => setLoading(false));
  }, []);

  /* ---------------- RESOLVE MAP LINK ---------------- */

  const resolveLink = useCallback(async (link: string) => {
    const trimmed = link.trim();

    if (!trimmed) {
      setPreviewUrl("");
      return;
    }

    if (trimmed.includes("output=embed") || trimmed.includes("/maps/embed")) {
      setPreviewUrl(trimmed);
      return;
    }

    setResolving(true);

    try {
      const embedUrl = await apiResolveMapUrl(trimmed);
      setPreviewUrl(embedUrl);
    } catch {
      toast.error("Could not resolve this Google Maps link");
      setPreviewUrl("");
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    if (!data) return;

    const display = generateOpeningHoursDisplay(
      data.open_time,
      data.close_time,
      data.closed_day,
    );

    setData((prev) =>
      prev ? { ...prev, opening_hours_display: display } : prev,
    );
  }, [data?.open_time, data?.close_time, data?.closed_day]);

  /* ---------------- DEBOUNCE MAP LINK ---------------- */

  useEffect(() => {
    if (!mapsLink.trim()) {
      setPreviewUrl("");
      return;
    }

    const timer = setTimeout(() => resolveLink(mapsLink), 600);

    return () => clearTimeout(timer);
  }, [mapsLink, resolveLink]);

  /* ---------------- SAVE ---------------- */

  const handleSave = async () => {
    if (!data) return;

    const pErr = validateMobile(data.phone || "", true);
    if (pErr) {
      setPhoneError(pErr);
      return;
    }

    setSaving(true);

    try {
      const embedUrl = previewUrl || data.map_embed_url;

      const updated = await apiUpdateLocationContent({
        address: data.address,
        phone: data.phone,

        open_time: data.open_time,
        close_time: data.close_time,
        closed_day: data.closed_day,
        opening_hours_display: data.opening_hours_display,

        instagram_handle: data.instagram_handle,
        instagram_url: data.instagram_url,

        map_embed_url: mapsLink.trim() ? embedUrl : data.map_embed_url,
      });

      setData(updated);
      setMapsLink("");
      setPreviewUrl("");

      toast.success("Location updated!");
    } catch {
      toast.error("Failed to update location");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- LOADING ---------------- */

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const activePreview = previewUrl || data.map_embed_url;

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-bold">Location / Contact</h2>

        <Button
          onClick={handleSave}
          disabled={saving || resolving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* FORM */}

      <div className="grid gap-4">
        {/* ADDRESS */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <MapPin className="w-4 h-4 text-primary" />
            Address
          </Label>

          <Input
            value={data.address || ""}
            onChange={(e) => setData({ ...data, address: e.target.value })}
          />
        </div>

        {/* PHONE */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Phone className="w-4 h-4 text-primary" />
            Phone
          </Label>

          <Input
            value={data.phone || ""}
            onChange={(e) => {
              setData({ ...data, phone: e.target.value.replace(/\D/g, "").slice(0, 10) });
              if (phoneError) setPhoneError("");
            }}
            onBlur={(e) => setPhoneError(validateMobile(e.target.value, true) || "")}
            className={phoneError ? 'border-red-500' : ''}
            maxLength={10}
          />
          {phoneError && <p className="text-red-500 text-xs">{phoneError}</p>}
        </div>

        {/* OPEN TIME */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Clock className="w-4 h-4 text-primary" />
            Open Time
          </Label>

          <Input
            type="time"
            value={data.open_time || ""}
            onChange={(e) => setData({ ...data, open_time: e.target.value })}
            className="dark:[color-scheme:dark]"
          />
          {/* <p className="text-xs text-muted-foreground">
            Format: 24-hour time (example: 18:00 = 6 PM)
          </p> */}
        </div>

        {/* CLOSE TIME */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Clock className="w-4 h-4 text-primary" />
            Close Time
          </Label>

          <Input
            type="time"
            value={data.close_time || ""}
            onChange={(e) => setData({ ...data, close_time: e.target.value })}
            className="dark:[color-scheme:dark]"
          />
          {/* <p className="text-xs text-muted-foreground">
            Example: 23:00 = 11 PM
          </p> */}
        </div>

        {/* CLOSED DAY */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Clock className="w-4 h-4 text-primary" />
            Closed Day
          </Label>

          <select
            value={data.closed_day}
            onChange={(e) =>
              setData({ ...data, closed_day: Number(e.target.value) })
            }
            className="w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={-1}>No Closed Day (Open All Week)</option>
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
            <option value={2}>Tuesday</option>
            <option value={3}>Wednesday</option>
            <option value={4}>Thursday</option>
            <option value={5}>Friday</option>
            <option value={6}>Saturday</option>
          </select>
        </div>

        {/* DISPLAY HOURS */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Clock className="w-4 h-4 text-primary" />
            Opening Hours Display
          </Label>

          <Input
            value={data.opening_hours_display || ""}
            readOnly
            className="bg-muted cursor-not-allowed"
          />

          <p className="text-xs text-muted-foreground">
            Automatically generated from open time, close time and closed day
          </p>
        </div>

        {/* INSTAGRAM HANDLE */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Instagram className="w-4 h-4 text-primary" />
            Instagram Handle
          </Label>

          <Input
            value={data.instagram_handle || ""}
            onChange={(e) =>
              setData({
                ...data,
                instagram_handle: e.target.value,
              })
            }
          />
        </div>

        {/* INSTAGRAM URL */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Instagram className="w-4 h-4 text-primary" />
            Instagram URL
          </Label>

          <Input
            value={data.instagram_url || ""}
            onChange={(e) =>
              setData({
                ...data,
                instagram_url: e.target.value,
              })
            }
          />
        </div>

        {/* MAP LINK */}

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-semibold">
            <Map className="w-4 h-4 text-primary" />
            Google Maps Link
          </Label>

          <Input
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
            placeholder="Paste Google Maps share link"
          />

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Link className="w-3 h-3" />
            {resolving ? "Resolving link..." : "Paste a Google Maps share link"}
          </p>
        </div>
      </div>

      {/* MAP PREVIEW */}

      {activePreview && (
        <div className="space-y-2">
          <Label className="font-semibold">Map Preview</Label>

          <div className="rounded-xl overflow-hidden border border-border h-[200px]">
            <iframe
              src={activePreview}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              title="Map Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManager;
