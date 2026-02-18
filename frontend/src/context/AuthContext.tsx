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
    handleLogin: (e: FormEvent, expectedRole?: "manager" | "driver") => Promise<void>;
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
    const [role, setRole] = useState<string | null>(null);
    const [fullName, setFullName] = useState(() => localStorage.getItem("fleetlanka.profile.name") || "");
    const [phone, setPhone] = useState(() => localStorage.getItem("fleetlanka.profile.phone") || "");
    const [profileLoading, setProfileLoading] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [expectedRole, setExpectedRole] = useState<"manager" | "driver" | null>(() => {
        const stored = localStorage.getItem("fleetlanka.loginRole");
        return stored === "manager" || stored === "driver" ? stored : null;
    });
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
                if (session && expectedRole && !role) {
                    setRole(expectedRole);
                }
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
                setRole(null);
                setExpectedRole(null);
                pendingSignOutRef.current = false;
            }
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    async function loadProfile() {
        if (!token) return;
        setProfileLoading(true);
        try {
            const profile = await apiGet<{ org_id: string; role: string; full_name?: string; phone?: string }>(
                "/profiles/me",
                token
            );
            if (expectedRole === "manager" && profile.role === "driver") {
                setError("Driver accounts must use the Driver login.");
                pendingSignOutRef.current = true;
                await supabase.auth.signOut();
                setAccessToken(null);
                setOrgId(null);
                setRole(null);
                return;
            }
            if (expectedRole === "driver" && profile.role !== "driver") {
                setError("Manager accounts must use the Manager login.");
                pendingSignOutRef.current = true;
                await supabase.auth.signOut();
                setAccessToken(null);
                setOrgId(null);
                setRole(null);
                return;
            }
            setOrgId(profile.org_id);
            setRole(profile.role);
            const nameValue = profile.full_name || "";
            const phoneValue = profile.phone || "";
            setFullName(nameValue);
            setPhone(phoneValue);
            localStorage.setItem("fleetlanka.profile.name", nameValue);
            localStorage.setItem("fleetlanka.profile.phone", phoneValue);
        } finally {
            setProfileLoading(false);
        }
    }

    useEffect(() => {
        if (!token) return;
        loadProfile().catch((e) => setError(e.message));
    }, [token, expectedRole]);

    async function handleLogin(e: FormEvent, loginRole?: "manager" | "driver") {
        e.preventDefault();
        setError(null);
        setLoading(true);
        suppressListenerRef.current = true;
        if (loginRole) {
            setExpectedRole(loginRole);
            localStorage.setItem("fleetlanka.loginRole", loginRole);
        }
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword(
                { email, password }
            );
            if (authError) throw authError;
            const metaRole = data.user?.user_metadata?.role as
                | "manager"
                | "driver"
                | "owner"
                | "service"
                | undefined;
            if (loginRole && metaRole) {
                const isDriver = metaRole === "driver";
                if (loginRole === "manager" && isDriver) {
                    pendingSignOutRef.current = true;
                    await supabase.auth.signOut();
                    setAccessToken(null);
                    setOrgId(null);
                    setRole(null);
                    setError("Driver accounts must use the Driver login.");
                    return;
                }
                if (loginRole === "driver" && !isDriver) {
                    pendingSignOutRef.current = true;
                    await supabase.auth.signOut();
                    setAccessToken(null);
                    setOrgId(null);
                    setRole(null);
                    setError("Manager accounts must use the Manager login.");
                    return;
                }
            }
            setAccessToken(data.session?.access_token ?? null);
            setEmail(data.session?.user?.email ?? "");
            if (loginRole) {
                setRole(loginRole);
            }
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
        setExpectedRole("manager");
        localStorage.setItem("fleetlanka.loginRole", "manager");
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
            const updated = await apiPatch<{ full_name?: string; phone?: string }>(
                "/profiles/me",
                payload,
                token
            );
            const nameValue = updated.full_name || "";
            const updatedPhone = updated.phone || "";
            setFullName(nameValue);
            setPhone(updatedPhone);
            localStorage.setItem("fleetlanka.profile.name", nameValue);
            localStorage.setItem("fleetlanka.profile.phone", updatedPhone);
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
        setRole(null);
        setFullName("");
        setPhone("");
        setExpectedRole(null);
        localStorage.removeItem("fleetlanka.loginRole");
        localStorage.removeItem("fleetlanka.profile.name");
        localStorage.removeItem("fleetlanka.profile.phone");
        pendingSignOutRef.current = false;
    }

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                orgId,
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
