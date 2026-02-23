# Rules Engine Documentation

## Overview

The rules engine maps receipt data (vendor name, description) to accounting categories (debit/credit accounts, tax classification). It uses two CSV master files.

## Master Files

### rules_master.csv

Located at `backend/master/rules_master.csv`.

| Column | Description |
|--------|-------------|
| keyword | Text to match against vendor + description (case-insensitive) |
| debit_account | Debit account name (勘定科目) |
| credit_account | Credit account name |
| debit_tax_class | Tax classification for debit side |
| description_template | Template for journal description. `{vendor_name}` is replaced. |

The `default` keyword row is used when no other keyword matches.

### tax_master.csv

Located at `backend/master/tax_master.csv`.

| Column | Description |
|--------|-------------|
| tax_class_code | Internal code |
| tax_class_name | Display name (used in MF CSV) |
| tax_rate | Tax rate percentage |
| description | Explanation |

## Matching Algorithm

1. Concatenate `vendor_name` and `description` into a single search string
2. Convert to lowercase
3. Iterate through rules in CSV order
4. Return the first rule whose `keyword` appears in the search string
5. If no match, use the `default` rule

## Journal Description Format

The description always includes the receipt ID in brackets for traceability:

```
{description_template} [{receipt_id}]
```

Truncated to 200 characters (MF CSV limit).

## Adding New Rules

Add a new row to `rules_master.csv`:

```csv
新しいキーワード,勘定科目名,貸方科目名,課税仕入 10%,摘要テンプレート {vendor_name}
```

Rules are evaluated in CSV order (top to bottom). Place more specific rules before general ones.
