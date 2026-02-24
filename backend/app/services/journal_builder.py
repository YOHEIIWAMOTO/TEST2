import csv
import logging
from pathlib import Path
from app.models import JournalEntry

logger = logging.getLogger(__name__)

MASTER_DIR = Path(__file__).resolve().parent.parent.parent / "master"


def _load_rules() -> list[dict]:
    rules = []
    rules_path = MASTER_DIR / "rules_master.csv"
    with open(rules_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rules.append(row)
    return rules


def _match_rule(vendor_name: str | None, description: str | None, rules: list[dict]) -> dict:
    search_text = f"{vendor_name or ''} {description or ''}".lower()
    default_rule = None
    for rule in rules:
        if rule["keyword"] == "default":
            default_rule = rule
            continue
        if rule["keyword"].lower() in search_text:
            return rule
    return default_rule or rules[-1]


def _match_with_learned_rules(vendor_name: str | None, description: str | None) -> dict | None:
    """Check learned rules first (vendor exact match, then keyword match)."""
    try:
        from app.services.learned_rules import lookup_vendor_rule, lookup_keyword_rule

        rule = lookup_vendor_rule(vendor_name)
        if rule:
            logger.info("Using learned vendor rule for '%s'", vendor_name)
            return rule

        rule = lookup_keyword_rule(vendor_name, description)
        if rule:
            logger.info("Using learned keyword rule")
            return rule
    except Exception as e:
        logger.warning("Learned rules lookup failed, falling back to CSV: %s", e)

    return None


def build_journal_entry(
    receipt_id: str,
    vendor_name: str | None,
    transaction_date: object,
    total_amount: int | None,
    tax_amount: int | None,
    description: str | None,
) -> JournalEntry:
    # Priority: learned rules → static CSV rules
    rule = _match_with_learned_rules(vendor_name, description)
    if rule is None:
        rules = _load_rules()
        rule = _match_rule(vendor_name, description, rules)

    amount = total_amount or 0
    tax = tax_amount or 0

    desc_template = rule.get("description_template", "経費 {vendor_name}")
    journal_description = desc_template.format(vendor_name=vendor_name or "不明")
    journal_description = f"{journal_description} [{receipt_id}]"
    journal_description = journal_description[:200]

    return JournalEntry(
        receipt_id=receipt_id,
        line_no=1,
        debit_account=rule["debit_account"],
        debit_sub_account=None,
        debit_department=None,
        debit_partner=vendor_name,
        debit_tax_class=rule["debit_tax_class"],
        debit_invoice="適格",
        debit_amount=amount,
        debit_tax_amount=tax,
        credit_account=rule["credit_account"],
        credit_sub_account=None,
        credit_department=None,
        credit_partner=None,
        credit_tax_class=None,
        credit_invoice=None,
        credit_amount=amount,
        credit_tax_amount=tax,
        description=journal_description,
        memo=None,
        tag=None,
    )
