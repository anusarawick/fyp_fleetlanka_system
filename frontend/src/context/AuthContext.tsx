import {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback,
    ReactNode,
    FormEvent,
} from "react";
import { supabase } from "../services/supabase";
import { apiGet, apiPatch, apiPost, isAuthSessionExpiredError } from "../services/api";
import { useFeedback } from "./FeedbackContext";

type AuthContextType = {
    accessToken: string | null;
    orgId: string | null;
    orgName: string;
    role: string | null;
    fullName: string;
    phone: string;
    profileLoading: boolean;
    authReady: boolean;
    error: string | null;
    loading: boolean;
    passwordChangeRequiresLogin: boolean;
    email: string;
    password: string;
    setEmail: (v: string) => void;
    setPassword: (v: string) => void;
    setError: (v: string | null) => void;
    setLoading: (v: boolean) => void;
    handleLogin: (e: FormEvent) => Promise<void>;
    handleSignup: (e: FormEvent, name?: string, orgName?: string) => Promise<void>;
    handleUpdateProfile: (name: string, phone: string) => Promise<void>;
    handleChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    handleSignOut: () => Promise<void>;
    clearPasswordChangeRedirect: () => void;
    token: string | undefined;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getPasswordChangeErrorMessage(error: unknown) {
    const rawMessage = error instanceof Error ? error.message : String(error || "");
    try {
        const parsed = JSON.parse(rawMessage);
        const detail = parsed?.detail;
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail?.password_errors) && detail.password_errors.length > 0) {
            return detail.password_errors[0];
        }
    } catch {
        // Non-JSON errors already have the message we need.
    }
    return rawMessage || "Could not update your password.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const feedback = useFeedback();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [orgName, setOrgName] = useState(() => localStorage.getItem("fleetlanka.profile.orgName") || "");
    const [role, setRole] = useState<string | null>(null);
    const [fullName, setFullName] = useState(() => localStorage.getItem("fleetlanka.profile.name") || "");
    const [phone, setPhone] = useState(() => localStorage.getItem("fleetlanka.profile.phone") || "");
    const [profileLoading, setProfileLoading] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [passwordChangeRequiresLogin, setPasswordChangeRequiresLogin] = useState(false);
    const pendingSignOutRef = useRef(false);
    const suppressListenerRef = useRef(false);
    const sessionExpiredNotifiedRef = useRef(false);

    const token = accessToken ?? undefined;

    const setError = useCallback((value: string | null) => {
        setErrorState(null);
        if (value) {
            feedback.error("Action failed", value);
        }
    }, [feedback]);

    const clearAuthState = useCallback(() => {
        setAccessToken(null);
        setOrgId(null);
        setOrgName("");
        setRole(null);
        setFullName("");
        setPhone("");
        localStorage.removeItem("fleetlanka.profile.name");
        localStorage.removeItem("fleetlanka.profile.phone");
        localStorage.removeItem("fleetlanka.profile.orgName");
    }, []);

    const clearPasswordChangeRedirect = useCallback(() => {
        setPasswordChangeRequiresLogin(false);
    }, []);

    const handleExpiredSession = useCallback(async () => {
        if (sessionExpiredNotifiedRef.current) return;
        sessionExpiredNotifiedRef.current = true;
        pendingSignOutRef.current = true;
        await supabase.auth.signOut().catch(() => undefined);
        clearAuthState();
        pendingSignOutRef.current = false;
        feedback.error("Session expired", "Please sign in again to continue.");
    }, [clearAuthState, feedback]);

    useEffect(() => {
        let isMounted = true;
        const restoreSession = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                const session = data.session;
                if (!isMounted) return;
                setAccessToken(session?.access_token ?? null);
                setEmail(session?.user?.email ?? "");
            } finally {
                if (isMounted) setAuthReady(true);
            }
        };

        restoreSession();

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) return;
            if (event === "SIGNED_IN" && pendingSignOutRef.current) {
                return;
            }
            if (event === "SIGNED_IN" && suppressListenerRef.current) {
                return;
            }
            setAccessToken(session?.access_token ?? null);
            setEmail(session?.user?.email ?? "");
            if (!session && event === "SIGNED_OUT") {
                clearAuthState();
                pendingSignOutRef.current = false;
            }
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, [clearAuthState]);

    useEffect(() => {
        const onExpiredSession = () => {
            handleExpiredSession();
        };
        window.addEventListener("fleetlanka:auth-session-expired", onExpiredSession);
        return () => window.removeEventListener("fleetlanka:auth-session-expired", onExpiredSession);
    }, [handleExpiredSession]);

    async function handleInactiveDriverSignOut() {
        feedback.error("Account inactive", "This account is inactive. Please contact your manager.");
        pendingSignOutRef.current = true;
        await supabase.auth.signOut();
        setAccessToken(null);
        setOrgId(null);
        setRole(null);
    }

    async function fetchProfileForToken(accessTokenValue: string) {
        return apiGet<{ org_id: string; org_name?: string; role: string; status?: string; full_name?: string; phone?: string }>(
            "/profiles/me",
            accessTokenValue
        );
    }

    async function applyProfile(profile: { org_id: string; org_name?: string; role: string; status?: string; full_name?: string; phone?: string }) {
        if ((profile.role === "driver" || profile.role === "service") && profile.status !== "active") {
            await handleInactiveDriverSignOut();
            return false;
        }
        setOrgId(profile.org_id);
        const orgNameValue = profile.org_name || "";
        setOrgName(orgNameValue);
        setRole(profile.role);
        const nameValue = profile.full_name || "";
        const phoneValue = profile.phone || "";
        setFullName(nameValue);
        setPhone(phoneValue);
        localStorage.setItem("fleetlanka.profile.name", nameValue);
        localStorage.setItem("fleetlanka.profile.phone", phoneValue);
        localStorage.setItem("fleetlanka.profile.orgName", orgNameValue);
        return true;
    }

    async function loadProfile() {
        if (!token) return;
        setProfileLoading(true);
        try {
            const profile = await fetchProfileForToken(token);
            await applyProfile(profile);
        } catch (err: any) {
            const message = err?.message || "Profile load failed";
            if (message.includes("Inactive account")) {
                await handleInactiveDriverSignOut();
                return;
            }
            if (isAuthSessionExpiredError(err)) {
                await handleExpiredSession();
                return;
            }
            throw err;
        } finally {
            setProfileLoading(false);
        }
    }

    useEffect(() => {
        if (!token) return;
        loadProfile().catch((e) => {
            if (isAuthSessionExpiredError(e)) return;
            feedback.error("Profile load failed", e.message);
        });
    }, [handleExpiredSession, token]);

    async function handleLogin(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        suppressListenerRef.current = true;
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword(
                { email, password }
            );
            if (authError) throw authError;
            const sessionToken = data.session?.access_token ?? null;
            if (!sessionToken) {
                throw new Error("Login failed");
            }
            const profile = await fetchProfileForToken(sessionToken);
            const allowed = await applyProfile(profile);
            if (!allowed) return;
            sessionExpiredNotifiedRef.current = false;
            setPasswordChangeRequiresLogin(false);
            setAccessToken(sessionToken);
            setEmail(data.session?.user?.email ?? "");
        } catch (err: any) {
            feedback.error("Login failed", err.message || "Check your email and password, then try again.");
        } finally {
            suppressListenerRef.current = false;
            setLoading(false);
        }
    }

    async function handleSignup(e: FormEvent, name?: string, orgName?: string) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        suppressListenerRef.current = true;
        try {
            const fullName = name || email.split("@")[0];
            const resolvedOrgName = orgName?.trim() ? orgName.trim() : `${fullName} Org`;
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        name: fullName,
                        role: "manager",
                        org_name: resolvedOrgName,
                    },
                },
            });
            if (authError) throw authError;
            if (data.session) {
                sessionExpiredNotifiedRef.current = false;
                setPasswordChangeRequiresLogin(false);
                setAccessToken(data.session.access_token);
                setEmail(data.session.user?.email ?? "");
                setFullName(fullName);
                setOrgName(resolvedOrgName);
                feedback.success("Account created", "Your manager workspace is ready.");
            } else {
                // Email confirmation may be required
                feedback.success("Account created", "Please check your email to confirm your account.");
            }
        } catch (err: any) {
            feedback.error("Signup failed", err.message || "Could not create your account.");
        } finally {
            suppressListenerRef.current = false;
            setLoading(false);
        }
    }

    async function handleUpdateProfile(name: string, phoneValue: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            const payload = {
                full_name: name || undefined,
                phone: phoneValue || undefined,
            };
            const updated = await apiPatch<{ full_name?: string; phone?: string; org_name?: string }>(
                "/profiles/me",
                payload,
                token
            );
            const nameValue = updated.full_name || "";
            const updatedPhone = updated.phone || "";
            const updatedOrgName = updated.org_name || orgName;
            setFullName(nameValue);
            setPhone(updatedPhone);
            setOrgName(updatedOrgName);
            localStorage.setItem("fleetlanka.profile.name", nameValue);
            localStorage.setItem("fleetlanka.profile.phone", updatedPhone);
            localStorage.setItem("fleetlanka.profile.orgName", updatedOrgName);
            feedback.success("Profile updated");
        } catch (err: any) {
            feedback.error("Profile update failed", err.message || "Could not update your profile.");
        } finally {
            setLoading(false);
        }
    }

    async function handleChangePassword(currentPassword: string, newPassword: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiPost(
                "/profiles/me/password",
                { current_password: currentPassword, new_password: newPassword },
                token
            );
            feedback.success("Password updated", "Please sign in again with your new password.");
            setPasswordChangeRequiresLogin(true);
            pendingSignOutRef.current = true;
            await supabase.auth.signOut().catch(() => undefined);
            clearAuthState();
            pendingSignOutRef.current = false;
        } catch (err: any) {
            throw new Error(getPasswordChangeErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleSignOut() {
        pendingSignOutRef.current = true;
        await supabase.auth.signOut();
        clearAuthState();
        pendingSignOutRef.current = false;
        feedback.info("Signed out");
    }

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                orgId,
                orgName,
                role,
                fullName,
                phone,
                profileLoading,
                authReady,
                error,
                loading,
                passwordChangeRequiresLogin,
                email,
                password,
                setEmail,
                setPassword,
                setError,
                setLoading,
                handleLogin,
                handleSignup,
                handleUpdateProfile,
                handleChangePassword,
                handleSignOut,
                clearPasswordChangeRedirect,
                token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
