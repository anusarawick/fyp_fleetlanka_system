import {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    ReactNode,
    FormEvent,
} from "react";
import { supabase } from "../services/supabase";
import { apiGet, apiPatch, apiPost } from "../services/api";

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
    token: string | undefined;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const pendingSignOutRef = useRef(false);
    const suppressListenerRef = useRef(false);

    const token = accessToken ?? undefined;

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
                setOrgId(null);
                setOrgName("");
                setRole(null);
                pendingSignOutRef.current = false;
            }
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    async function handleInactiveDriverSignOut() {
        setError("This account is inactive. Please contact your manager.");
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
            throw err;
        } finally {
            setProfileLoading(false);
        }
    }

    useEffect(() => {
        if (!token) return;
        loadProfile().catch((e) => setError(e.message));
    }, [token]);

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
            setAccessToken(sessionToken);
            setEmail(data.session?.user?.email ?? "");
        } catch (err: any) {
            setError(err.message || "Login failed");
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
                setAccessToken(data.session.access_token);
                setEmail(data.session.user?.email ?? "");
                setFullName(fullName);
                setOrgName(resolvedOrgName);
            } else {
                // Email confirmation may be required
                setError("Account created! Please check your email to confirm.");
            }
        } catch (err: any) {
            setError(err.message || "Signup failed");
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
        } catch (err: any) {
            setError(err.message || "Profile update failed");
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
        } catch (err: any) {
            setError(err.message || "Password update failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleSignOut() {
        pendingSignOutRef.current = true;
        await supabase.auth.signOut();
        setAccessToken(null);
        setOrgId(null);
        setOrgName("");
        setRole(null);
        setFullName("");
        setPhone("");
        localStorage.removeItem("fleetlanka.profile.name");
        localStorage.removeItem("fleetlanka.profile.phone");
        localStorage.removeItem("fleetlanka.profile.orgName");
        pendingSignOutRef.current = false;
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
