export type PasswordPolicyContext = {
  email?: string;
  fullName?: string;
  orgName?: string;
};

export type PasswordRequirement = {
  label: string;
  met: boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const symbolPattern = /[^A-Za-z0-9]/;

export function validateEmail(value: string) {
  if (!value.trim()) return "Email address is required.";
  if (!emailPattern.test(value.trim())) return "Enter a valid email address.";
  return "";
}

export function getSensitivePasswordTerms(context: PasswordPolicyContext) {
  const emailName = context.email?.split("@")[0] || "";
  const values = [emailName, context.fullName || "", context.orgName || ""];
  return values
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 3);
}

export function getPasswordRequirements(password: string, context: PasswordPolicyContext = {}): PasswordRequirement[] {
  return [
    { label: "10+ characters", met: password.length >= 10 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Symbol", met: symbolPattern.test(password) },
    ...(
      getSensitivePasswordTerms(context).length
        ? [{
          label: "No personal information",
          met: !password || !getSensitivePasswordTerms(context).some((term) => password.toLowerCase().includes(term)),
        }]
        : []
    ),
  ];
}

export function getPasswordPolicyErrors(password: string, context: PasswordPolicyContext = {}) {
  const errors: string[] = [];
  if (!password) return ["Password is required."];
  if (password.length < 10) errors.push("Use at least 10 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Add an uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Add a lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Add a number.");
  if (!symbolPattern.test(password)) errors.push("Add a symbol.");
  if (getSensitivePasswordTerms(context).some((term) => password.toLowerCase().includes(term))) {
    errors.push("Do not include your name, organization, or email username.");
  }
  return errors;
}

export function validatePassword(
  password: string,
  { requireStrong = false, context = {} }: { requireStrong?: boolean; context?: PasswordPolicyContext } = {},
) {
  if (!password) return "Password is required.";
  if (requireStrong) {
    const errors = getPasswordPolicyErrors(password, context);
    if (errors.length) return errors[0];
  }
  return "";
}

export function getPasswordStrength(password: string, context: PasswordPolicyContext = {}) {
  const requirements = getPasswordRequirements(password, context);
  const metCount = requirements.filter((requirement) => requirement.met).length;
  if (!password) return "empty";
  if (metCount === requirements.length) return "strong";
  if (metCount >= Math.ceil(requirements.length * 0.66)) return "fair";
  return "weak";
}
