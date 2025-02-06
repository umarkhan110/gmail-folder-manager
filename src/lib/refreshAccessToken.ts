export async function refreshAccessToken(refreshToken: string | null) {
    if (!refreshToken) {
      console.error("❌ No refresh token available");
      return null;
    }
  
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
  
      const data = await response.json();
      if (!response.ok) throw data;
  
      console.log("✅ Successfully refreshed access token!");
  
      return {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000), // Convert expiry time
        refreshToken: data.refresh_token || null, // Sometimes Google provides a new refresh token
      };
    } catch (error) {
      console.error("⚠️ Error refreshing access token:", error);
      return null;
    }
  }
  