const axios = require("axios");

async function sendOTP(mobile, otp) {
  try {
    const response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {
        mobile: `91${mobile}`,
        otp: otp,
      },
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("MSG91 Response:", response.data);
    return response.data;

  } catch (error) {
    console.error(
      "MSG91 Error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to send OTP");
  }
}

// async function sendSMS(mobile, message) {
//   try {
//     const response = await axios.post(
//       "https://control.msg91.com/api/v5/otp",
//       {
//         mobile: `91${mobile}`,
//         otp: message // using OTP route for testing
//       },
//       {
//         headers: {
//           authkey: process.env.MSG91_AUTH_KEY,
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     console.log("MSG91 Response:", response.data);
//     return response.data;

//   } catch (error) {
//     console.error("MSG91 Error:", error.response?.data || error.message);
//     throw error;
//   }
// }

async function sendSMS(mobile, message) {
  console.log("Sending coupon details via SMS");
  console.log("To:", mobile);
  console.log("Message:", message);
}

module.exports = { sendOTP, sendSMS };