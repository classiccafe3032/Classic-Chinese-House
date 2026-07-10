import { useState, useEffect } from "react";
import {
  apiAdminRequestSettingsOtp,
  apiAdminChangePassword,
  apiAdminChangeMobile,
  apiAdminChangeEmail,
  apiAdminGetInfo,
  apiWebAuthnGenerateRegistration,
  apiWebAuthnVerifyRegistration,
} from "@/lib/apiClient";
import { startRegistration } from "@simplewebauthn/browser";
import { Capacitor } from "@capacitor/core";
import { registerBiometricDevice } from "@/lib/biometrics";
import { validateMobile } from "@/lib/validators";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Smartphone,
  ShieldCheck,
  Send,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Fingerprint,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Mode = "idle" | "change-password" | "change-mobile" | "change-email";

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[a-zA-Z]/.test(pw)) return "Must contain at least 1 letter";
  if (!/[0-9]/.test(pw)) return "Must contain at least 1 number";
  return null;
}

const AccountSecurity = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("idle");
  const [maskedMobile, setMaskedMobile] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otp, setOtp] = useState("");

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Change mobile & email
  const [newMobile, setNewMobile] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiAdminGetInfo()
      .then((data) => {
        setMaskedMobile(data.mobile);
        setMaskedEmail(data.email);
      })
      .catch(() => {
        setMaskedMobile("Unknown");
        setMaskedEmail("Unknown");
      })
      .finally(() => setLoadingInfo(false));
  }, []);

  const resetForm = () => {
    setMode("idle");
    setOtpSent(false);
    setOtp("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewMobile("");
    setNewEmail("");
    setError("");
    setSuccess("");
    setShowCurrentPw(false);
    setShowNewPw(false);
  };

  const handleRequestOtp = async () => {
    setError("");
    setOtpSending(true);
    try {
      const data = await apiAdminRequestSettingsOtp();
      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: data.message,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOtpSending(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const pwError = validatePassword(newPassword);
    if (pwError) { setError(pwError); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }

    setSubmitting(true);
    try {
      const data = await apiAdminChangePassword(otp, currentPassword, newPassword);
      setSuccess(data.message);
      toast({ title: "Success", description: data.message });
      setTimeout(resetForm, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const pErr = validateMobile(newMobile, true);
    if (pErr) { setError(pErr); return; }
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }

    setSubmitting(true);
    try {
      const data = await apiAdminChangeMobile(otp, newMobile);
      setMaskedMobile(data.mobile);
      setSuccess(data.message);
      toast({ title: "Success", description: data.message });
      setTimeout(resetForm, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newEmail.trim() || !newEmail.includes("@")) { setError("Enter a valid new email address"); return; }
    // OTP is only required if an email was already set
    if (maskedEmail && otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }

    setSubmitting(true);
    try {
      const data = await apiAdminChangeEmail(otp, newEmail);
      setMaskedEmail(data.email);
      setSuccess(data.message);
      toast({ title: "Success", description: data.message });
      setTimeout(resetForm, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterBiometric = async () => {
    try {
      setError("");
      setSuccess("");
      
      if (Capacitor.isNativePlatform()) {
        toast({ title: "Configuring", description: "Linking device hardware..." });
        const success = await registerBiometricDevice();
        if (success) {
          setSuccess("Device successfully registered for biometric login!");
          toast({ title: "Success", description: "You can now log in using FaceID/TouchID!" });
        } else {
          throw new Error("Failed to link biometric hardware");
        }
      } else {
        toast({ title: "Connecting", description: "Generating secure passkey request..." });
        const options = await apiWebAuthnGenerateRegistration();
        const response = await startRegistration({ optionsJSON: options });
        await apiWebAuthnVerifyRegistration(response);

        setSuccess("Device successfully registered for biometric login!");
        toast({ title: "Success", description: "You can now log in using FaceID/TouchID!" });
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Registration cancelled.");
      } else {
        setError(err.message || "Failed to register device");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Info Card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <ShieldCheck className="text-primary" size={20} />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Account Security</h2>
            <p className="text-sm text-muted-foreground">Manage your password and mobile number</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
            <Smartphone size={14} />
            <span>Registered mobile:</span>
            {loadingInfo ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <span className="font-mono font-medium text-foreground">{maskedMobile || "Not Set"}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
            <Send size={14} />
            <span>Recovery email:</span>
            {loadingInfo ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <span className="font-mono font-medium text-foreground">{maskedEmail || "Not Set"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Cards */}
      {mode === "idle" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setMode("change-password")}
            className="bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <KeyRound className="text-primary" size={20} />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Change Password</h3>
            <p className="text-sm text-muted-foreground">Update your admin login password</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setMode("change-mobile")}
            className="bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Smartphone className="text-primary" size={20} />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Change Mobile Number</h3>
            <p className="text-sm text-muted-foreground">Update your registered mobile for OTP</p>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setMode("change-email")}
            className="bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Send className="text-primary" size={20} />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Recovery Email</h3>
            <p className="text-sm text-muted-foreground">Update your email used for receiving OTPs</p>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleRegisterBiometric}
            className="bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Fingerprint className="text-primary" size={20} />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Register Biometric Device</h3>
            <p className="text-sm text-muted-foreground">Enable FaceID / TouchID / Fingerprint login on this device</p>
          </motion.button>
        </div>
      )}

      {/* Change Password Form */}
      <AnimatePresence mode="wait">
        {mode === "change-password" && (
          <motion.div
            key="change-password"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
                <KeyRound size={18} className="text-primary" /> Change Password
              </h3>
              <button onClick={resetForm} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Cancel
              </button>
            </div>

            {/* Error / Success */}
            <AnimatePresence>
              {!!error && (
                <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-destructive text-sm bg-destructive/10 p-3 rounded-xl mb-4">{error}</motion.p>
              )}
              {!!success && (
                <motion.p key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-green-600 dark:text-green-400 text-sm bg-green-500/10 p-3 rounded-xl mb-4 flex items-center gap-2">
                  <CheckCircle2 size={14} /> {success}
                </motion.p>
              )}
            </AnimatePresence>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }}
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm"
                    disabled={submitting}
                  />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    placeholder="Min 8 chars, 1 letter, 1 number"
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-base md:te   xt-sm"
                    disabled={submitting}
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm"
                  disabled={submitting}
                />
              </div>

              {/* OTP Section */}
              <div className="border-t border-border pt-4">
                <label className="text-sm font-medium text-foreground mb-1.5 block">OTP Verification</label>
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={otpSending || !currentPassword || !newPassword}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all disabled:opacity-50"
                  >
                    {otpSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {otpSending ? "Sending..." : "Send OTP to registered mobile"}
                  </button>
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-center tracking-[0.5em] text-lg font-mono"
                    disabled={submitting}
                    autoFocus
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !otpSent || otp.length !== 6 || !currentPassword || !newPassword || !confirmPassword}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {submitting ? "Changing..." : "Change Password"}
              </button>
            </form>
          </motion.div>
        )}

        {/* Change Mobile Form */}
        {mode === "change-mobile" && (
          <motion.div
            key="change-mobile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
                <Smartphone size={18} className="text-primary" /> Change Mobile Number
              </h3>
              <button onClick={resetForm} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Cancel
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-destructive text-sm bg-destructive/10 p-3 rounded-xl mb-4">{error}</motion.p>
              )}
              {success && (
                <motion.p key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-green-600 dark:text-green-400 text-sm bg-green-500/10 p-3 rounded-xl mb-4 flex items-center gap-2">
                  <CheckCircle2 size={14} /> {success}
                </motion.p>
              )}
            </AnimatePresence>

            <form onSubmit={handleChangeMobile} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">New Mobile Number</label>
                <input
                  type="tel"
                  value={newMobile}
                  onChange={(e) => { setNewMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                  placeholder="Enter 10-digit mobile number"
                  className={`w-full px-4 py-3 rounded-xl border ${error ? 'border-destructive' : 'border-border'} bg-background focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm`}
                  disabled={submitting}
                />
              </div>

              {/* OTP Section */}
              <div className="border-t border-border pt-4">
                <label className="text-sm font-medium text-foreground mb-1.5 block">OTP Verification</label>
                <p className="text-xs text-muted-foreground mb-2">OTP will be sent to your <strong>current</strong> registered mobile number</p>
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={otpSending || !newMobile.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all disabled:opacity-50"
                  >
                    {otpSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {otpSending ? "Sending..." : "Send OTP to current mobile"}
                  </button>
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-center tracking-[0.5em] text-lg font-mono"
                    disabled={submitting}
                    autoFocus
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !otpSent || otp.length !== 6 || !newMobile.trim()}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {submitting ? "Updating..." : "Update Mobile Number"}
              </button>
            </form>
          </motion.div>
        )}

        {/* Change Email Form */}
        {mode === "change-email" && (
          <motion.div
            key="change-email"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
                <Send size={18} className="text-primary" /> Recovery Email Address
              </h3>
              <button onClick={resetForm} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Cancel
              </button>
            </div>

            <AnimatePresence>
              {!!error && (
                <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-destructive text-sm bg-destructive/10 p-3 rounded-xl mb-4">{error}</motion.p>
              )}
              {!!success && (
                <motion.p key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-green-600 dark:text-green-400 text-sm bg-green-500/10 p-3 rounded-xl mb-4 flex items-center gap-2">
                  <CheckCircle2 size={14} /> {success}
                </motion.p>
              )}
            </AnimatePresence>

            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">New Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setError(""); }}
                  placeholder="e.g. admin@thechinesehouse.com"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-base md:text-sm"
                  disabled={submitting}
                />
              </div>

              {/* OTP Section (only if an email is already set) */}
              {maskedEmail && (
                <div className="border-t border-border pt-4">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">OTP Verification</label>
                  <p className="text-xs text-muted-foreground mb-2">OTP will be sent to your <strong>current</strong> recovery email address</p>
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={otpSending || !newEmail.trim()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all disabled:opacity-50"
                    >
                      {otpSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {otpSending ? "Sending..." : "Send OTP to current email"}
                    </button>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-ring focus:outline-none text-center tracking-[0.5em] text-lg font-mono"
                      disabled={submitting}
                      autoFocus
                    />
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (!!maskedEmail && (!otpSent || otp.length !== 6)) || !newEmail.trim()}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {submitting ? "Updating..." : (maskedEmail ? "Update Recovery Email" : "Set Recovery Email")}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountSecurity;
