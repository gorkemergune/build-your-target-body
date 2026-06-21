import * as WebBrowser from "expo-web-browser";
import { getFitbitAuthUrl, exchangeFitbitCode } from "../api/wearable";
import type { WearableConnection } from "../api/wearable";

WebBrowser.maybeCompleteAuthSession();

const FITBIT_REDIRECT_URI = "buildyourtargetbody://fitbit/callback";

export async function connectFitbit(): Promise<WearableConnection | null> {
  try {
    const { auth_url } = await getFitbitAuthUrl(FITBIT_REDIRECT_URI);

    const result = await WebBrowser.openAuthSessionAsync(auth_url, FITBIT_REDIRECT_URI);

    if (result.type !== "success" || !result.url) {
      return null;
    }

    const url = new URL(result.url);
    const code = url.searchParams.get("code");

    if (!code) return null;

    const connection = await exchangeFitbitCode(code, FITBIT_REDIRECT_URI);
    return connection;
  } catch {
    return null;
  }
}
