from __future__ import annotations

import re
from typing import Iterable, Optional

from pydantic import BaseModel


SYMBOL_PATTERN = re.compile(r"[^A-Za-z0-9]")


def password_policy_errors(password: str, personal_values: Iterable[str] = ()) -> list[str]:
    errors: list[str] = []
    if len(password) < 10:
        errors.append("Password must be at least 10 characters.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must include an uppercase letter.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must include a lowercase letter.")
    if not re.search(r"[0-9]", password):
        errors.append("Password must include a number.")
    if not SYMBOL_PATTERN.search(password):
        errors.append("Password must include a symbol.")

    normalized_password = password.lower()
    sensitive_terms: list[str] = []
    for value in personal_values:
        sensitive_terms.extend(
            part.strip().lower()
            for part in re.split(r"[^A-Za-z0-9]+", value or "")
            if len(part.strip()) >= 3
        )
    if any(term in normalized_password for term in sensitive_terms):
        errors.append("Password must not include your name, organization, or email username.")
    return errors


class ProfileOut(BaseModel):
    id: str
    org_id: str
    org_name: Optional[str] = None
    role: str
    status: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str
