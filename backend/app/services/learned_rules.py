"""Learned rules store – accumulates vendor→account mappings from human corrections.

Storage format (JSON):
{
  "vendor_rules": {
    "normalized_vendor_name": {
      "debit_account": "旅費交通費",
      "credit_account": "未払金",
      "debit_tax_class": "課税仕入 10%",
      "description_template": "交通費 {vendor_name}",
      "count": 3
    },
    ...
  },
  "keyword_rules": {
    "keyword_in_vendor_or_desc": { ... same shape ... }
  }
}

Lookup priority (in journal_builder):
  1. Exact vendor name match from learned vendor_rules  (highest confidence)
  2. Keyword match from learned keyword_rules
  3. Static CSV rules_master.csv  (original fallback)
"""

import json
import logging
from pathlib import Path
from threading import Lock

from app.config import settings

logger = logging.getLogger(__name__)

_STORE_PATH = Path(settings.storage_root) / "learned_rules.json"
_lock = Lock()


def _empty_store() -> dict:
    return {"vendor_rules": {}, "keyword_rules": {}}


def _load_store() -> dict:
    if not _STORE_PATH.exists():
        return _empty_store()
    try:
        with open(_STORE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "vendor_rules" not in data:
            data["vendor_rules"] = {}
        if "keyword_rules" not in data:
            data["keyword_rules"] = {}
        return data
    except Exception as e:
        logger.warning("Failed to load learned rules, starting fresh: %s", e)
        return _empty_store()


def _save_store(store: dict) -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


def _normalize_vendor(vendor_name: str) -> str:
    """Normalize vendor name for matching (lowercase, strip whitespace)."""
    return vendor_name.strip().lower()


# ── Public API ──────────────────────────────────────────────


def learn_from_approval(
    vendor_name: str | None,
    description: str | None,
    debit_account: str,
    credit_account: str,
    debit_tax_class: str | None,
) -> None:
    """Record a human-approved mapping so future receipts auto-classify."""
    if not vendor_name:
        return

    rule_data = {
        "debit_account": debit_account,
        "credit_account": credit_account,
        "debit_tax_class": debit_tax_class or "課税仕入 10%",
        "description_template": f"{{vendor_name}}",
    }

    with _lock:
        store = _load_store()

        # Vendor-level rule (exact match)
        key = _normalize_vendor(vendor_name)
        existing = store["vendor_rules"].get(key)
        if existing and existing.get("debit_account") == debit_account:
            existing["count"] = existing.get("count", 1) + 1
        else:
            rule_data["count"] = 1
            store["vendor_rules"][key] = rule_data

        _save_store(store)

    logger.info(
        "Learned rule: vendor=%s → debit=%s, credit=%s",
        vendor_name, debit_account, credit_account,
    )


def lookup_vendor_rule(vendor_name: str | None) -> dict | None:
    """Look up a learned rule by exact vendor name. Returns rule dict or None."""
    if not vendor_name:
        return None
    key = _normalize_vendor(vendor_name)
    store = _load_store()
    rule = store["vendor_rules"].get(key)
    if rule:
        logger.debug("Learned rule hit for vendor '%s': %s", vendor_name, rule.get("debit_account"))
    return rule


def lookup_keyword_rule(vendor_name: str | None, description: str | None) -> dict | None:
    """Look up a learned keyword rule. Returns rule dict or None."""
    search_text = f"{vendor_name or ''} {description or ''}".lower()
    if not search_text.strip():
        return None
    store = _load_store()
    best: dict | None = None
    best_count = 0
    for keyword, rule in store["keyword_rules"].items():
        if keyword in search_text:
            count = rule.get("count", 1)
            if count > best_count:
                best = rule
                best_count = count
    return best


def get_all_learned_rules() -> dict:
    """Return the full learned rules store (for debugging / admin)."""
    return _load_store()
