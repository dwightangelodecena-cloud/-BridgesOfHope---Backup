import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";
import { formatAuthError } from "./authErrors";

export function getMobileOAuthRedirectUrl(): string {
  return Linking.createURL("auth/callback");
}

export type MobileGoogleResult =
  | { status: "signed_in" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function signInWithGoogleMobile(): Promise<MobileGoogleResult> {
  const redirectTo = getMobileOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) {
    return { status: "error", message: formatAuthError(error) };
  }
  if (!data?.url) {
    return { status: "error", message: "Could not start Google sign-in." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    if (result.type === "cancel") {
      return { status: "cancelled" };
    }
    return { status: "error", message: "Sign-in was not completed." };
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    result.url
  );
  if (exchangeError) {
    return { status: "error", message: formatAuthError(exchangeError) };
  }
  return { status: "signed_in" };
}

export async function ensureFamilyAccountOrSignOut(): Promise<
  "ok" | "staff"
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.user_metadata?.account_type ?? "family").toLowerCase();
  if (role !== "family") {
    await supabase.auth.signOut();
    return "staff";
  }
  return "ok";
}
