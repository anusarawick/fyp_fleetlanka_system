import { getPasswordRequirements, getPasswordStrength, PasswordPolicyContext } from "../utils/passwordPolicy";

type PasswordStrengthGuideProps = {
  password: string;
  context?: PasswordPolicyContext;
};

export default function PasswordStrengthGuide({ password, context = {} }: PasswordStrengthGuideProps) {
  const requirements = getPasswordRequirements(password, context).filter(
    (requirement) => requirement.label !== "No personal information"
  );
  const strengthLevel = getPasswordStrength(password, context);
  const strengthLabel = {
    empty: "Required",
    weak: "Weak",
    fair: "Fair",
    strong: "Strong",
  }[strengthLevel];

  return (
    <div className="password-guidance" aria-label="Password requirements">
      <div className="password-strength">
        <span>Password strength</span>
        <strong className={`password-strength__label password-strength__label--${strengthLevel}`}>
          {strengthLabel}
        </strong>
      </div>
      <span className={`password-meter password-meter--${strengthLevel}`} aria-hidden="true">
        <span />
      </span>
      <ul className="password-checklist">
        {requirements.map((requirement) => (
          <li className={requirement.met ? "password-check password-check--met" : "password-check"} key={requirement.label}>
            <span aria-hidden="true">{requirement.met ? "✓" : ""}</span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
