import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Bell, BriefcaseBusiness, CheckCircle2, Clock3, Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { apiGet, apiPatch, apiPost, isAuthSessionExpiredError } from "../services/api";
import { useFeedback } from "../context/FeedbackContext";
import { useNotifications } from "../context/NotificationContext";
import PasswordStrengthGuide from "../components/PasswordStrengthGuide";
import { validatePassword } from "../utils/passwordPolicy";

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

type NotificationPreferences = {
    documents: boolean;
    maintenance: boolean;
    approvals: boolean;
    ml: boolean;
    bookings: boolean;
    payments: boolean;
    chat: boolean;
    trips: boolean;
    fuel: boolean;
};

type PasswordErrors = Partial<Record<"current" | "new" | "confirm", string>>;

type PasswordFieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    visible: boolean;
    onToggle: () => void;
    error?: string;
    onClearError: () => void;
    children?: ReactNode;
};

const defaultNotificationPreferences: NotificationPreferences = {
    documents: true,
    maintenance: true,
    approvals: true,
    ml: true,
    bookings: true,
    payments: true,
    chat: true,
    trips: true,
    fuel: true,
};

const notificationPreferenceLabels: Record<keyof NotificationPreferences, { title: string; description: string; roles: Array<"manager" | "owner" | "service" | "driver"> }> = {
    documents: {
        title: "Documents",
        description: "Expiry and renewal reminders.",
        roles: ["manager", "owner"],
    },
    maintenance: {
        title: "Maintenance",
        description: "Service due and overdue alerts.",
        roles: ["manager", "owner"],
    },
    approvals: {
        title: "Approvals",
        description: "Service completion review actions.",
        roles: ["manager", "owner", "service"],
    },
    ml: {
        title: "ML Risk",
        description: "Predictive maintenance risk alerts.",
        roles: ["manager", "owner"],
    },
    bookings: {
        title: "Bookings",
        description: "Service booking assignments and status changes.",
        roles: ["manager", "owner", "service"],
    },
    payments: {
        title: "Payments",
        description: "Checkout, payment, and settlement updates.",
        roles: ["manager", "owner", "service"],
    },
    chat: {
        title: "Chat",
        description: "New manager and service-center messages.",
        roles: ["manager", "owner", "service"],
    },
    trips: {
        title: "Trips",
        description: "Trip assignments and trip status updates.",
        roles: ["manager", "owner", "driver"],
    },
    fuel: {
        title: "Fuel",
        description: "Driver fuel log submissions.",
        roles: ["manager", "owner"],
    },
};

function PasswordField({
    label,
    value,
    onChange,
    placeholder,
    visible,
    onToggle,
    error,
    onClearError,
    children,
}: PasswordFieldProps) {
    return (
        <label className="profile-field">
            <span>{label}</span>
            <span className="profile-password-control">
                <input
                    type={visible ? "text" : "password"}
                    aria-label={label}
                    value={value}
                    onChange={(event) => {
                        onChange(event.target.value);
                        if (error) onClearError();
                    }}
                    placeholder={placeholder}
                    aria-invalid={Boolean(error)}
                />
                <button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>
                    {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
            </span>
            {error && <span className="profile-field-error">{error}</span>}
            {children}
        </label>
    );
}

function isCurrentPasswordError(message: string) {
    return /current password|invalid login credentials|invalid credentials/i.test(message);
}

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
    const { refreshNotifications } = useNotifications();
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
    const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
    const [preferencesLoading, setPreferencesLoading] = useState(false);
    const [preferencesSaving, setPreferencesSaving] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPreferencesModal, setShowPreferencesModal] = useState(false);
    const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});

    const roleLabel =
        role === "manager" || role === "owner"
            ? "Fleet Manager"
            : role === "service"
                ? "Service Center"
                : "Driver";
    const initials = localName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";
    const workspaceName = organizationName?.trim() || "Organization not recorded";
    const preferenceKeys = visiblePreferenceKeys();
    const enabledPreferenceCount = preferenceKeys.filter((key) => notificationPreferences[key]).length;

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

    useEffect(() => {
        if (!token) return;
        setPreferencesLoading(true);
        apiGet<NotificationPreferences>("/notifications/preferences", token)
            .then((prefs) => setNotificationPreferences({ ...defaultNotificationPreferences, ...prefs }))
            .catch((err: any) => {
                if (isAuthSessionExpiredError(err)) return;
                feedback.error("Notification preferences unavailable", err.message || "Could not load notification preferences");
            })
            .finally(() => setPreferencesLoading(false));
    }, [feedback, token]);

    async function handleProfileUpdate(e: FormEvent) {
        e.preventDefault();
        if (onUpdateProfile) {
            await onUpdateProfile(localName, localPhone);
        }
    }

    async function handlePasswordChange(e: FormEvent) {
        e.preventDefault();
        const nextErrors: PasswordErrors = {};
        if (!currentPassword) nextErrors.current = "Current password is required.";
        const passwordError = validatePassword(newPassword, {
            requireStrong: true,
            context: { email, fullName: localName, orgName: organizationName },
        });
        if (passwordError) nextErrors.new = passwordError;
        if (!confirmPassword) {
            nextErrors.confirm = "Confirm your new password.";
        } else if (newPassword !== confirmPassword) {
            nextErrors.confirm = "Passwords do not match.";
        }
        setPasswordErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        if (!onChangePassword) return;
        try {
            await onChangePassword(currentPassword, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordErrors({});
            setShowPasswordModal(false);
        } catch (err: any) {
            const message = err?.message || "Could not update your password.";
            if (isCurrentPasswordError(message)) {
                setPasswordErrors((current) => ({ ...current, current: "Current password is incorrect." }));
                return;
            }
            setPasswordErrors((current) => ({ ...current, new: message }));
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

    function visiblePreferenceKeys() {
        const normalizedRole = role as "manager" | "owner" | "service" | "driver";
        return (Object.keys(notificationPreferenceLabels) as Array<keyof NotificationPreferences>)
            .filter((key) => notificationPreferenceLabels[key].roles.includes(normalizedRole));
    }

    function setPreference(key: keyof NotificationPreferences, value: boolean) {
        setNotificationPreferences((current) => ({ ...current, [key]: value }));
    }

    function setAllVisiblePreferences(value: boolean) {
        setNotificationPreferences((current) => {
            const next = { ...current };
            preferenceKeys.forEach((key) => {
                next[key] = value;
            });
            return next;
        });
    }

    async function handlePreferencesSave() {
        if (!token) return;
        setPreferencesSaving(true);
        try {
            const updated = await apiPatch<NotificationPreferences>(
                "/notifications/preferences",
                notificationPreferences,
                token
            );
            setNotificationPreferences({ ...defaultNotificationPreferences, ...updated });
            await refreshNotifications();
            feedback.success("Preferences saved", "Notification preferences were updated.");
            setShowPreferencesModal(false);
        } catch (err: any) {
            feedback.error("Preference save failed", err.message || "Could not update notification preferences");
        } finally {
            setPreferencesSaving(false);
        }
    }

    function closePasswordModal() {
        setShowPasswordModal(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordErrors({});
    }

    return (
        <section className="section">
            <div className="profile-page profile-page--manager">
                <div className="profile-layout">
                    <section className="profile-card profile-card--account">
                        <div className="profile-card__header">
                            <div>
                                <h3>Profile Details</h3>
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
                        <section className="profile-card profile-summary-card">
                            <div className="profile-card__header">
                                <div>
                                    <h3>Password & Security</h3>
                                    <p>Update your password and keep your account secure.</p>
                                </div>
                            </div>
                            <div className="profile-summary-card__body">
                                <div className="profile-summary-card__icon"><Lock aria-hidden="true" /></div>
                                <div>
                                    <strong>Password protected</strong>
                                    <span>Change your password from a secure dialog when needed.</span>
                                </div>
                            </div>
                            <div className="profile-form__actions">
                                <button className="btn btn--primary" type="button" onClick={() => setShowPasswordModal(true)}>
                                    Change Password
                                </button>
                            </div>
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

                        <section className="profile-card profile-summary-card">
                            <div className="profile-card__header">
                                <div>
                                    <h3>Notification Preferences</h3>
                                    <p>Control which in-app notification categories appear.</p>
                                </div>
                            </div>
                            <div className="profile-summary-card__body">
                                <div className="profile-summary-card__icon"><Bell aria-hidden="true" /></div>
                                <div>
                                    <strong>{enabledPreferenceCount} of {preferenceKeys.length} categories enabled</strong>
                                    <span>Critical account and compliance alerts always remain enabled.</span>
                                </div>
                            </div>
                            <div className="profile-form__actions">
                                <button className="btn btn--primary" type="button" onClick={() => setShowPreferencesModal(true)}>
                                    Change Preferences
                                </button>
                            </div>
                        </section>

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

            {showPasswordModal && (
                <div className="modal-backdrop" role="presentation">
                    <div className="modal modal--form profile-settings-modal" role="dialog" aria-modal="true" aria-label="Change password">
                        <div className="modal__header">
                            <div>
                                <h3>Change Password</h3>
                                <p className="modal__subtle">Update your password to keep your account secure.</p>
                            </div>
                            <button className="modal__close" type="button" onClick={closePasswordModal} aria-label="Close password dialog">
                                ✕
                            </button>
                        </div>
                        <form className="profile-form profile-form--password" onSubmit={handlePasswordChange}>
                            <PasswordField
                                label="Current Password"
                                value={currentPassword}
                                onChange={setCurrentPassword}
                                placeholder="Enter current password"
                                visible={showCurrentPassword}
                                onToggle={() => setShowCurrentPassword((value) => !value)}
                                error={passwordErrors.current}
                                onClearError={() => setPasswordErrors((current) => ({ ...current, current: undefined }))}
                            />
                            <PasswordField
                                label="New Password"
                                value={newPassword}
                                onChange={setNewPassword}
                                placeholder="Enter new password"
                                visible={showNewPassword}
                                onToggle={() => setShowNewPassword((value) => !value)}
                                error={passwordErrors.new}
                                onClearError={() => setPasswordErrors((current) => ({ ...current, new: undefined }))}
                            >
                                <PasswordStrengthGuide password={newPassword} context={{ email, fullName: localName, orgName: organizationName }} />
                            </PasswordField>
                            <PasswordField
                                label="Confirm New Password"
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                placeholder="Confirm new password"
                                visible={showConfirmPassword}
                                onToggle={() => setShowConfirmPassword((value) => !value)}
                                error={passwordErrors.confirm}
                                onClearError={() => setPasswordErrors((current) => ({ ...current, confirm: undefined }))}
                            />
                            <div className="modal__actions">
                                <button className="btn btn--secondary" type="button" onClick={closePasswordModal}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn--primary"
                                    type="submit"
                                    disabled={!currentPassword || !newPassword || !confirmPassword || loading}
                                >
                                    {loading ? "Updating..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPreferencesModal && (
                <div className="modal-backdrop" role="presentation">
                    <div className="modal modal--wide modal--form profile-settings-modal" role="dialog" aria-modal="true" aria-label="Notification preferences">
                        <div className="modal__header">
                            <div>
                                <h3>Notification Preferences</h3>
                                <p className="modal__subtle">Choose which in-app notification categories appear in your notification inbox.</p>
                            </div>
                            <button className="modal__close" type="button" onClick={() => setShowPreferencesModal(false)} aria-label="Close notification preferences">
                                ✕
                            </button>
                        </div>

                        <div className="profile-notification-list profile-notification-list--modal">
                            <div className="profile-notification-row profile-notification-row--locked">
                                <span className="profile-notification-row__icon"><ShieldCheck aria-hidden="true" /></span>
                                <span className="profile-notification-row__body">
                                    <strong>Critical & Account</strong>
                                    <small>Account status and critical safety/compliance alerts always remain enabled.</small>
                                </span>
                                <span className="profile-status-chip">Required</span>
                            </div>

                            {preferenceKeys.map((key) => {
                                const item = notificationPreferenceLabels[key];
                                return (
                                    <label className="profile-notification-row toggle-switch" key={key}>
                                        <span className="profile-notification-row__icon"><Bell aria-hidden="true" /></span>
                                        <span className="profile-notification-row__body">
                                            <strong>{item.title}</strong>
                                            <small>{item.description}</small>
                                        </span>
                                        <input
                                            className="toggle-switch__input"
                                            type="checkbox"
                                            checked={notificationPreferences[key]}
                                            onChange={(event) => setPreference(key, event.target.checked)}
                                            disabled={preferencesLoading || preferencesSaving}
                                        />
                                        <span className="toggle-switch__track" aria-hidden="true">
                                            <span className="toggle-switch__thumb" />
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        <div className="modal__actions">
                            <button
                                className="btn btn--secondary"
                                type="button"
                                onClick={() => setAllVisiblePreferences(true)}
                                disabled={preferencesLoading || preferencesSaving}
                            >
                                Enable All
                            </button>
                            <button
                                className="btn btn--secondary"
                                type="button"
                                onClick={() => setAllVisiblePreferences(false)}
                                disabled={preferencesLoading || preferencesSaving}
                            >
                                Disable All
                            </button>
                            <button className="btn btn--secondary" type="button" onClick={() => setShowPreferencesModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn--primary"
                                type="button"
                                onClick={handlePreferencesSave}
                                disabled={preferencesLoading || preferencesSaving || !token}
                            >
                                {preferencesSaving ? "Saving..." : preferencesLoading ? "Loading..." : "Save Preferences"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
