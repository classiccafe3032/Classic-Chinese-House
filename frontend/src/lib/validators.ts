/**
 * Name Validation
 * - Only alphabetic characters (A-Z, a-z) and spaces
 * - Length: 2 to 20 characters
 */
export const validateName = (name: string, isRequired: boolean = true): string | null => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return isRequired ? "Name is required." : null;
  }
  if (trimmedName.length < 2) return "Name must be at least 2 characters long.";
  if (trimmedName.length > 20) return "Name cannot exceed 20 characters.";
  
  const nameRegex = /^[A-Za-z\s]+$/;
  if (!nameRegex.test(trimmedName)) {
    return "Name can only contain alphabets and spaces.";
  }
  
  return null;
};

/**
 * Mobile Number Validation
 * - Exactly 10 digits (0-9)
 * - No country code, spaces, or symbols
 */
export const validateMobile = (mobile: string, isRequired: boolean = true): string | null => {
  const trimmedMobile = mobile.trim();
  if (!trimmedMobile) {
    return isRequired ? "Mobile number is required." : null;
  }
  
  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(trimmedMobile)) {
    return "Mobile number must be exactly 10 digits.";
  }
  
  return null;
};

/**
 * GST Number Validation (India)
 * - Must follow the strict 15-character GSTIN format
 */
export const validateGST = (gst: string): string | null => {
  const trimmedGst = gst.trim().toUpperCase();
  if (!trimmedGst) return null; // GST is optional in settings, so empty is allowed. If you want strict required, change this.
  
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstRegex.test(trimmedGst)) {
    return "Invalid GSTIN format (e.g., 27ABCDE1234F1Z5).";
  }
  
  return null;
};
