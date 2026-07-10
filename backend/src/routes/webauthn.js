const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const redisClient = require("../../config/redis");
const { adminAuth, JWT_SECRET } = require("../middleware/adminAuth");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// RP Info Helper
const rpName = "Classic Chinese Admin";

function getRPInfo(req) {
  // Use the origin header sent by the browser, fallback to env variable or localhost
  const clientOrigin = req.headers.origin || process.env.CORS_ORIGIN || "http://localhost:8080";
  let rpID;
  try {
    rpID = new URL(clientOrigin).hostname;
  } catch(e) {
    rpID = "localhost";
  }
  return { rpID, expectedOrigin: clientOrigin };
}

// Helpers for auth
const REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
  path: "/",
};

async function logAdminLogin({ success, adminId, businessId, req }) {
  try {
    await pool.query(
      `INSERT INTO admin_login_logs 
       (success, admin_id, ip_address, user_agent, business_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [success, adminId, req.ip, req.headers["user-agent"], businessId || null]
    );
  } catch (err) {
    console.error("Login log error:", err);
  }
}

// ======================================================
// GENERATE REGISTRATION OPTIONS (Requires Admin Login)
// ======================================================
router.get("/generate-registration-options", adminAuth, async (req, res) => {
  try {
    // Get admin details
    const result = await pool.query("SELECT mobile_number, webauthn_user_id FROM admin_account WHERE id = $1", [req.admin.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Admin not found" });
    
    const admin = result.rows[0];
    
    // Get existing passkeys
    const passkeys = await pool.query("SELECT credential_id FROM admin_passkeys WHERE admin_id = $1", [req.admin.id]);
    
    const { rpID } = getRPInfo(req);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(admin.webauthn_user_id, 'utf8'),
      userName: admin.mobile_number,
      attestationType: "none",
      excludeCredentials: passkeys.rows.map((pk) => ({
        id: pk.credential_id,
        type: "public-key",
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    // Save challenge to session/redis
    await redisClient.setEx(`webauthn:challenge:${req.admin.id}`, 300, options.challenge);

    res.json(options);
  } catch (err) {
    console.error("Generate reg options error:", err);
    res.status(500).json({ error: "Failed to generate registration options" });
  }
});

// ======================================================
// VERIFY REGISTRATION RESPONSE (Requires Admin Login)
// ======================================================
router.post("/verify-registration", adminAuth, async (req, res) => {
  try {
    const { body } = req;
    const expectedChallenge = await redisClient.get(`webauthn:challenge:${req.admin.id}`);
    
    if (!expectedChallenge) {
      return res.status(400).json({ error: "Registration session expired" });
    }

    const { rpID, expectedOrigin } = getRPInfo(req);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
      
      const admin = await pool.query("SELECT webauthn_user_id FROM admin_account WHERE id = $1", [req.admin.id]);

      await pool.query(
        `INSERT INTO admin_passkeys 
         (credential_id, public_key, webauthn_user_id, counter, device_type, backed_up, transports, admin_id, business_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          credential.id,
          credential.publicKey,
          admin.rows[0].webauthn_user_id,
          credential.counter,
          credentialDeviceType,
          credentialBackedUp,
          credential.transports ? credential.transports.join(",") : "",
          req.admin.id,
          req.business_id
        ]
      );

      await redisClient.del(`webauthn:challenge:${req.admin.id}`);
      
      return res.json({ verified: true });
    }

    res.status(400).json({ error: "Verification failed" });
  } catch (err) {
    console.error("Verify registration error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// GENERATE AUTHENTICATION OPTIONS (Public)
// ======================================================
router.get("/generate-authentication-options", async (req, res) => {
  try {
    const { rpID } = getRPInfo(req);

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    // Save challenge mapped by some generic session ID
    const authSessionId = crypto.randomBytes(32).toString("hex");
    await redisClient.setEx(`webauthn:auth_challenge:${authSessionId}`, 300, options.challenge);

    // Give the frontend the sessionId to send back
    res.json({ options, authSessionId });
  } catch (err) {
    console.error("Generate auth options error:", err);
    res.status(500).json({ error: "Failed to generate authentication options" });
  }
});

// ======================================================
// VERIFY AUTHENTICATION RESPONSE (Public)
// ======================================================
router.post("/verify-authentication", async (req, res) => {
  try {
    const { body, authSessionId } = req.body;
    
    if (!authSessionId) return res.status(400).json({ error: "Missing session ID" });
    
    const expectedChallenge = await redisClient.get(`webauthn:auth_challenge:${authSessionId}`);
    
    if (!expectedChallenge) {
      return res.status(400).json({ error: "Authentication session expired" });
    }

    const credentialID = body.id;
    const passkeyResult = await pool.query("SELECT * FROM admin_passkeys WHERE credential_id = $1", [credentialID]);
    
    if (!passkeyResult.rows.length) {
      return res.status(400).json({ error: "Passkey not found. Please register it first." });
    }

    const passkey = passkeyResult.rows[0];

    const { rpID, expectedOrigin } = getRPInfo(req);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: passkey.public_key,
        counter: Number(passkey.counter),
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update counter
      await pool.query("UPDATE admin_passkeys SET counter = $1 WHERE credential_id = $2", [
        authenticationInfo.newCounter,
        passkey.credential_id
      ]);

      await redisClient.del(`webauthn:auth_challenge:${authSessionId}`);
      
      // LOG IN THE ADMIN!
      const adminResult = await pool.query(
        `SELECT a.id, a.business_id, b.features, b.name as business_name
         FROM admin_account a
         JOIN businesses b ON a.business_id = b.id
         WHERE a.id = $1`,
        [passkey.admin_id]
      );
      
      const admin = adminResult.rows[0];
      
      const token = jwt.sign(
        { 
          id: admin.id, 
          role: "admin",
          business_id: admin.business_id 
        },
        JWT_SECRET,
        { expiresIn: "10h" }
      );

      const refreshToken = crypto.randomBytes(40).toString("hex");

      await redisClient.setEx(
        `refresh_token:${refreshToken}`,
        REFRESH_TOKEN_EXPIRY_SECONDS,
        JSON.stringify({ 
          adminId: admin.id, 
          business_id: admin.business_id 
        })
      );

      res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

      await logAdminLogin({
        success: true,
        adminId: admin.id,
        businessId: admin.business_id,
        req
      });

      return res.json({ 
        verified: true,
        message: "Login successful", 
        token,
        user: { name: admin.business_name, role: "admin" },
        features: admin.features || {} 
      });
    }

    res.status(400).json({ error: "Verification failed" });
  } catch (err) {
    console.error("Verify authentication error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
