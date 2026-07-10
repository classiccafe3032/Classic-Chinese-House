import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift,
  Copy,
  Share2,
  ArrowLeft,
  Sparkles,
  Phone,
  IndianRupee,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiCreatePaidVoucher } from "@/lib/apiClient";
import { Link } from "react-router-dom";

export default function GiftVoucher() {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [loading, setLoading] = useState(false);


  const [voucher, setVoucher] = useState<{
    code: string;
    value: number;
  } | null>(null);

  const presetAmounts = [100, 200, 500, 1000];

  const isValidPhone = /^\d{10}$/.test(phone.trim());
  const parsedAmount = Number(amount);
  const isValidAmount = parsedAmount >= 100;
  const isValidCustomCode =
    !customCode.trim() || /^[A-Za-z0-9]{5,}$/.test(customCode.trim());
  const canSubmit =
    isValidAmount && isValidPhone && isValidCustomCode && !loading;

  async function handleCreate() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      // TODO: Razorpay payment flow will be added here
      // For now, directly create the voucher
      const result = await apiCreatePaidVoucher(
        parsedAmount,
        phone.trim(),
        customCode.trim() || undefined,
      );
      setVoucher({ code: result.code, value: result.value });
      toast({ title: "Voucher created!", description: `Code: ${result.code}` });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!voucher) return;
    navigator.clipboard.writeText(voucher.code);
    toast({ title: "Copied!", description: "Code copied to clipboard" });
  }

function shareWhatsApp() {
  if (!voucher) return;

  const text = `🎁 Hey! I got you a treat from Classic Chinese! 🍜

Use this gift voucher when you visit the store and order from the online menu.

🎟 Voucher Code: *${voucher.code}*
💰 Worth: ₹${voucher.value}

1️⃣ Visit the store  
2️⃣ Open the online menu  
3️⃣ Apply this voucher while placing your order

Order here:
${window.location.origin}

Enjoy your food! 😋`;

  const encoded = encodeURIComponent(text);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const url = isMobile
    ? `whatsapp://send?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.location.href = url;
}

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <AnimatePresence mode="wait">
          {!voucher ? (
            <motion.div
              key="form"
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-border shadow-lg">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Gift className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Gift a Voucher</CardTitle>
                  <CardDescription>
                    Purchase a one-time use voucher to share with a friend 🧇
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-2">
                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" /> Amount (₹)
                    </Label>
                    <Input
                      type="number"
                      min={100}
                      placeholder="Minimum ₹100"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                      {presetAmounts.map((a) => (
                        <Button
                          key={a}
                          type="button"
                          size="sm"
                          variant={parsedAmount === a ? "default" : "outline"}
                          onClick={() => setAmount(String(a))}
                          className="text-xs"
                        >
                          ₹{a}
                        </Button>
                      ))}
                    </div>
                    {amount && !isValidAmount && (
                      <p className="text-xs text-destructive">
                        Minimum amount is ₹100
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Your Phone Number
                    </Label>
                    <Input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit number"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, ""))
                      }
                    />
                    {phone && !isValidPhone && (
                      <p className="text-xs text-destructive">
                        Enter a valid 10-digit phone number
                      </p>
                    )}
                  </div>

                  {/* Custom Code */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Custom Code (Optional)
                    </Label>
                    <Input
                      placeholder="Leave empty to auto-generate"
                      maxLength={20}
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                    />
                    {customCode && !isValidCustomCode && (
                      <p className="text-xs text-destructive">
                        Code must be at least 5 characters, letters & numbers
                        only
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!canSubmit}
                    onClick={handleCreate}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Creating…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Generate Voucher
                      </span>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Payment integration coming soon. Vouchers are currently free
                    to test.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: "spring" }}
            >
              <Card className="border-border shadow-lg text-center">
                <CardContent className="pt-8 pb-6 space-y-5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="text-5xl"
                  >
                    🎉
                  </motion.div>

                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Voucher Created!
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Share this code with your friend
                    </p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-muted rounded-xl p-5"
                  >
                    <p className="text-3xl font-mono font-bold tracking-widest text-primary">
                      {voucher.code}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Worth{" "}
                      <span className="font-semibold text-foreground">
                        ₹{voucher.value}
                      </span>{" "}
                      · One-time use
                    </p>
                  </motion.div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={copyCode}
                    >
                      <Copy className="w-4 h-4 mr-2" /> Copy Code
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={shareWhatsApp}
                    >
                      <Share2 className="w-4 h-4 mr-2" /> WhatsApp
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="text-sm"
                    onClick={() => {
                      setVoucher(null);
                      setAmount("");
                      setPhone("");
                      setCustomCode("");
                    }}
                  >
                    Create Another Voucher
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
