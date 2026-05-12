import { FormEvent, useEffect, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Clock3, Eye, EyeOff, Lock, Mail, UserRound, WalletCards } from "lucide-react";
import { apiGet, apiPost } from "../services/api";
import { useFeedback } from "../context/FeedbackContext";

type ProfileSettingsProps = {
    email: string;
    role: string;
    organizationName?: string;
    name: string;
    phone: string;
    profileLoading?: boolean;
    onUpdateProfile?: (name: string, phone: string) => Promise<void>;
    onChangePassword?: (currentPassword: string, newPassword: string) => Promise<void>;
    loading?: boolean;
    token?: string;
};

type ServicePortalMe = {
    center: {
        id: string;
        name: string;
        payment_access_enabled?: boolean;
        stripe_account_id?: string;
        stripe_onboarding_status?: string;
    };
};

export default function ProfileSettings({
    email,
    role,
    organizationName,
    name,
    phone,
    profileLoading = false,
    onUpdateProfile,
    onChangePassword,
    loading = false,
    token
}: ProfileSettingsProps) {
    const feedback = useFeedback();
    const [localName, setLocalName] = useState(name || "");
    const [localPhone, setLocalPhone] = useState(phone || "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [serviceCenter, setServiceCenter] = useState<ServicePortalMe["center"] | null>(null);
    const [paymentSetupLoading, setPaymentSetupLoading] = useState(false);

    const roleLabel =
        role === "manager" || role === "owner"
            ? "Fleet Manager"
            : role === "service"
                ? "Service Center"
                : "Driver";
    const initials = localName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";
    const workspaceName = organizationName?.trim() || "Organization not recorded";

    useEffect(() => {
        setLocalName(name || "");
    }, [name]);

    useEffect(() => {
        setLocalPhone(phone || "");
    }, [phone]);

    useEffect(() => {
        if (role !== "service" || !token) return;
        apiGet<ServicePortalMe>("/service-portal/me", token)
            .then(async (data) => {
                if (data.center.payment_access_enabled) {
                    const status = await apiGet<Partial<ServicePortalMe["center"]>>(
                        "/service-portal/payments/account-status",
                        token
                    ).catch(() => null);
                    setServiceCenter(status ? { ...data.center, ...status } : data.center);
                    return;
                }
                setServiceCenter(data.center);
            })
            .catch(() => setServiceCenter(null));
    }, [role, token]);

    async function handleProfileUpdate(e: FormEvent) {
        e.preventDefault();
        if (onUpdateProfile) {
            await onUpdateProfile(localName, localPhone);
        }
    }

    async function handlePasswordChange(e: FormEvent) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            feedback.error("Passwords do not match", "Confirm password must match the new password.");
            return;
        }
        if (onChangePassword) {
            await onChangePassword(currentPassword, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        }
    }

    function resetProfileForm() {
        setLocalName(name || "");
        setLocalPhone(phone || "");
    }

    async function handleStripeSetup() {
        if (!token) return;
        setPaymentSetupLoading(true);
        try {
            const account = await apiPost<ServicePortalMe["center"]>(
                "/service-portal/payments/connect-account",
                {},
                token
            );
            setServiceCenter((prev) => ({ ...(prev || account), ...account }));
            const link = await apiPost<{ url: string }>(
                "/service-portal/payments/onboarding-link",
                {},
                token
            );
            feedback.info("Opening Stripe", "Continue setup in Stripe onboarding.");
            window.location.href = link.url;
        } catch (err: any) {
            feedback.error("Stripe setup failed", err.message || "Stripe setup failed");
        } finally {
            setPaymentSetupLoading(false);
        }
    }

    function paymentSetupLabel() {
        if (!serviceCenter?.stripe_account_id) return "Set up Stripe payments";
        if (serviceCenter.stripe_onboarding_status === "connected") return "Payments connected";
        return "Continue Stripe setup";
    }

    function PasswordField({
        label,
        value,
        onChange,
        placeholder,
        visible,
        onToggle,
    }: {
        label: string;
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        visible: boolean;
        onToggle: () => void;
    }) {
        return (
            <label className="profile-field">
                <span>{label}</span>
                <span className="profile-password-control">
                    <input
                        type={visible ? "text" : "password"}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder={placeholder}
                    />
                    <button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>
                        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                </span>
            </label>
        );
    }

    return (
        <section className="section">
            <div className="profile-page profile-page--manager">
                <div className="profile-layout">
                    <section className="profile-card profile-card--account">
                        <div className="profile-card__header">
                            <div>
                                <h3>Account Profile</h3>
                                <p>Update your personal information and contact details.</p>
                            </div>
                        </div>

                        <div className="profile-identity">
                            <div className="profile-identity__avatar">{initials}</div>
                            <div>
                                <div className="profile-identity__title">
                                    <strong>{localName || "User"}</strong>
                                    <span>{roleLabel}</span>
                                </div>
                                <p>{workspaceName}</p>
                            </div>
                        </div>

                        <form className="profile-form" onSubmit={handleProfileUpdate}>
                            <label className="profile-field">
                                <span>Full Name</span>
                                <input
                                    type="text"
                                    value={localName}
                                    onChange={(e) => setLocalName(e.target.value)}
                                    placeholder="Enter your full name"
                                />
                                <small>Enter your full name as it appears on your account.</small>
                            </label>

                            <label className="profile-field">
                                <span>Email Address</span>
                                <span className="profile-readonly-control">
                                    <input type="email" value={email} disabled />
                                    <Lock aria-hidden="true" />
                                </span>
                                <small>Email address cannot be changed. Contact support if you need assistance.</small>
                            </label>

                            <label className="profile-field">
                                <span>Phone Number</span>
                                <input
                                    type="tel"
                                    value={localPhone}
                                    onChange={(e) => setLocalPhone(e.target.value)}
                                    placeholder="+94 77 123 4567"
                                />
                                <small>Enter a valid phone number for important notifications.</small>
                            </label>

                            <label className="profile-field">
                                <span>Role</span>
                                <input type="text" value={roleLabel} disabled />
                                <small>Your role determines the level of access and permissions.</small>
                            </label>

                            <div className="profile-form__actions">
                                <button className="btn btn--secondary" type="button" onClick={resetProfileForm}>
                                    Cancel
                                </button>
                                <button className="btn btn--primary" type="submit" disabled={loading || profileLoading}>
                                    {loading || profileLoading ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </section>

                    <div className="profile-side-stack">
                        <section className="profile-card">
                            <div className="profile-card__header">
                                <div>
                                    <h3>Change Password</h3>
                                    <p>Update your password to keep your account secure.</p>
                                </div>
                            </div>

                            <form className="profile-form profile-form--password" onSubmit={handlePasswordChange}>
                                <PasswordField
                                    label="Current Password"
                                    value={currentPassword}
                                    onChange={setCurrentPassword}
                                    placeholder="Enter current password"
                                    visible={showCurrentPassword}
                                    onToggle={() => setShowCurrentPassword((value) => !value)}
                                />
                                <PasswordField
                                    label="New Password"
                                    value={newPassword}
                                    onChange={setNewPassword}
                                    placeholder="Enter new password"
                                    visible={showNewPassword}
                                    onToggle={() => setShowNewPassword((value) => !value)}
                                />
                                <PasswordField
                                    label="Confirm New Password"
                                    value={confirmPassword}
                                    onChange={setConfirmPassword}
                                    placeholder="Confirm new password"
                                    visible={showConfirmPassword}
                                    onToggle={() => setShowConfirmPassword((value) => !value)}
                                />
                                <p className="profile-password-hint">Password must be at least 8 characters and include uppercase, lowercase, number, and special character.</p>
                                <div className="profile-form__actions">
                                    <button
                                        className="btn btn--primary"
                                        type="submit"
                                        disabled={!currentPassword || !newPassword || !confirmPassword || loading}
                                    >
                                        {loading ? "Updating..." : "Update Password"}
                                    </button>
                                </div>
                            </form>
                        </section>

                        {role === "service" && serviceCenter?.payment_access_enabled && (
                            <section className="profile-card">
                                <div className="profile-card__header">
                                    <div>
                                        <h3>Payment Setup</h3>
                                        <p>Connect Stripe to receive approved service booking payments.</p>
                                    </div>
                                </div>

                                <div className="profile-info-list">
                                    <div className="profile-info-row">
                                        <WalletCards aria-hidden="true" />
                                        <span>Stripe Status</span>
                                        <strong className="profile-status-chip">
                                            {serviceCenter.stripe_onboarding_status === "connected"
                                                ? "Connected"
                                                : serviceCenter.stripe_account_id
                                                    ? "Setup Pending"
                                                    : "Not Started"}
                                        </strong>
                                    </div>
                                </div>
                                <div className="profile-form__actions">
                                    <button
                                        className="btn btn--primary"
                                        type="button"
                                        onClick={handleStripeSetup}
                                        disabled={paymentSetupLoading || serviceCenter.stripe_onboarding_status === "connected"}
                                    >
                                        {paymentSetupLoading ? "Opening Stripe..." : paymentSetupLabel()}
                                    </button>
                                </div>
                            </section>
                        )}

                        <section className="profile-card">
                            <div className="profile-card__header">
                                <div>
                                    <h3>Account & Workspace</h3>
                                    <p>View your account and workspace information.</p>
                                </div>
                            </div>

                            <div className="profile-info-list">
                                <div className="profile-info-row">
                                    <CheckCircle2 aria-hidden="true" />
                                    <span>Account Status</span>
                                    <strong className="profile-status-chip">Active</strong>
                                </div>
                                <div className="profile-info-row">
                                    <UserRound aria-hidden="true" />
                                    <span>Access Role</span>
                                    <strong>{roleLabel}</strong>
                                </div>
                                <div className="profile-info-row">
                                    <BriefcaseBusiness aria-hidden="true" />
                                    <span>Organization</span>
                                    <strong>{workspaceName}</strong>
                                </div>
                                <div className="profile-info-row">
                                    <Clock3 aria-hidden="true" />
                                    <span>Last Login</span>
                                    <strong>May 9, 2026, 07:34 PM</strong>
                                </div>
                                <div className="profile-info-row">
                                    <Mail aria-hidden="true" />
                                    <span>Linked Email</span>
                                    <strong>{email}</strong>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>
            </div>
        </section>
    );
}
