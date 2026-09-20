/**
 * NoteCraft Extension Central Configuration
 *
 * Switch between LOCAL development and RENDER production backend URLs.
 * 
 * LOCAL MODE:   "http://localhost:8000"
 * RENDER MODE:  "https://notecraft-backend-4ktk.onrender.com"
 */
export const LOCAL_BACKEND_URL = "http://localhost:8000";
export const PROD_BACKEND_URL = "https://notecraft-backend-4ktk.onrender.com";

// Set active BACKEND_URL to production Render service
export const BACKEND_URL = PROD_BACKEND_URL;

const CONFIG = {
  BACKEND_URL,
  LOCAL_BACKEND_URL,
  PROD_BACKEND_URL,
};

export default CONFIG;

