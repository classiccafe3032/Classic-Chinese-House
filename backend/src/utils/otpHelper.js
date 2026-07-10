const crypto = require("crypto");

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function verifyOTP(otp, hash) {
  return hashOTP(otp) === hash;
}

module.exports = { generateOTP, hashOTP, verifyOTP };
