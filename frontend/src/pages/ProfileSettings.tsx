import { useEffect, useState, FormEvent } from "react";

type ProfileSettingsProps = {
    email: string;
    role: string;
    name: string;
    phone: string;
    profileLoading?: boolean;
    onUpdateProfile?: (name: string, phone: string) => Promise<void>;
    onChangePassword?: (currentPassword: string, newPassword: string) => Promise<void>;
    loading?: boolean;
};

export default function ProfileSettings({
    email,
    role,
    name,
    phone,
    profileLoading = false,
    onUpdateProfile,
    onChangePassword,
    loading = false
}: ProfileSettingsProps) {
    const [localName, setLocalName] = useState(name || "");
    const [localPhone, setLocalPhone] = useState(phone || "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const roleLabel =
        role === "manager" || role === "owner"
            ? "Fleet Manager"
            : role === "service"
                ? "Service Center"
                : "Driver";
    const initials = localName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

    useEffect(() => {
        setLocalName(name || "");
    }, [name]);

    useEffect(() => {
        setLocalPhone(phone || "");
    }, [phone]);

    async function handleProfileUpdate(e: FormEvent) {
        e.preventDefault();
        if (onUpdateProfile) {
            await onUpdateProfile(localName, localPhone);
            setSuccessMessage("Profile updated successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        }
    }

    async function handlePasswordChange(e: FormEvent) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert("Passwords do not match");
            return;
        }
        if (onChangePassword) {
            await onChangePassword(currentPassword, newPassword);
            setSuccessMessage("Password changed successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setSuccessMessage(""), 3000);
        }
    }

    return (
        <section className="section">
        <div className="profile-page profile-page--manager">
            {successMessage && (
                <div className="alert alert--success">{successMessage}</div>
            )}

            <div className="profile-header">
                <div className="profile-header__avatar">{initials}</div>
                <div className="profile-header__info">
                    <h2>{localName || "User"}</h2>
                    <span className="profile-header__role">{roleLabel}</span>
                    <span className="profile-header__email">{email}</span>
                </div>
            </div>

            <div className="profile-grid">
                <section className="profile-section">
                    <div className="profile-section__header">
                        <div>
                            <h3>Personal Information</h3>
                            <p className="muted">Update your personal details</p>
                        </div>
                    </div>

                    <form className="form" onSubmit={handleProfileUpdate}>
                        <div className="form-row">
                            <label>
                                Full Name
                                <input
                                    type="text"
                                    value={localName}
                                    onChange={(e) => setLocalName(e.target.value)}
                                    placeholder="Enter your full name"
                                />
                            </label>
                            <label>
                                Phone Number
                                <input
                                    type="tel"
                                    value={localPhone}
                                    onChange={(e) => setLocalPhone(e.target.value)}
                                    placeholder="+94 77 123 4567"
                                />
                            </label>
                        </div>

                        <label>
                            Email Address
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="input--disabled"
                            />
                            <span className="form-hint">Email cannot be changed</span>
                        </label>

                        <label>
                            Role
                            <input
                                type="text"
                                value={roleLabel}
                                disabled
                                className="input--disabled"
                            />
                            <span className="form-hint">Contact admin to change role</span>
                        </label>

                        <button
                            className="btn btn--primary"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </form>
                </section>

                <section className="profile-section">
                    <div className="profile-section__header">
                        <div>
                            <h3>Security</h3>
                            <p className="muted">Manage your password</p>
                        </div>
                    </div>

                    <form className="form" onSubmit={handlePasswordChange}>
                        <label>
                            Current Password
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                            />
                        </label>

                        <label>
                            New Password
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                            />
                        </label>

                        <label>
                            Confirm New Password
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                            />
                        </label>

                        <button
                            className="btn btn--secondary"
                            type="submit"
                            disabled={!currentPassword || !newPassword || !confirmPassword}
                        >
                            Change Password
                        </button>
                    </form>
                </section>

                <section className="profile-section">
                    <div className="profile-section__header">
                        <div>
                            <h3>Preferences</h3>
                            <p className="muted">Customize your experience</p>
                        </div>
                    </div>

                    <div className="preference-list">
                        <div className="preference-item">
                            <div className="preference-item__info">
                                <span className="preference-item__label">Email Notifications</span>
                                <span className="preference-item__desc">Receive email alerts for important updates</span>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle__slider"></span>
                            </label>
                        </div>

                        <div className="preference-item">
                            <div className="preference-item__info">
                                <span className="preference-item__label">Push Notifications</span>
                                <span className="preference-item__desc">Get notified on your device</span>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle__slider"></span>
                            </label>
                        </div>

                        <div className="preference-item">
                            <div className="preference-item__info">
                                <span className="preference-item__label">Maintenance Reminders</span>
                                <span className="preference-item__desc">Alerts for upcoming vehicle maintenance</span>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle__slider"></span>
                            </label>
                        </div>

                        <div className="preference-item">
                            <div className="preference-item__info">
                                <span className="preference-item__label">Document Expiry Alerts</span>
                                <span className="preference-item__desc">Notify before documents expire</span>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle__slider"></span>
                            </label>
                        </div>
                    </div>
                </section>

                <section className="profile-section profile-section--danger">
                    <div className="profile-section__header">
                        <div>
                            <h3>Critical Actions</h3>
                            <p className="muted">Irreversible actions</p>
                        </div>
                    </div>

                    <div className="danger-actions">
                        <div className="danger-item">
                            <div>
                                <span className="danger-item__label">Delete Account</span>
                                <span className="danger-item__desc">Permanently delete your account and data</span>
                            </div>
                            <button className="btn btn--danger">Delete Account</button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
        </section>
    );
}
