# MoneyForward Cloud Accounting - CSV Import Format

## Format Specification

- **Encoding**: UTF-8 with BOM (utf-8-sig)
- **Delimiter**: Comma (,)
- **Quoting**: All fields quoted
- **Date format**: YYYY/MM/DD
- **Datetime format**: YYYY/MM/DD HH:MM:SS

## 27 Column Headers (Exact Order)

| # | Header | Japanese | Type | Max Length | Description |
|---|--------|----------|------|------------|-------------|
| 1 | 取引No | Transaction No | Integer | - | Sequential number |
| 2 | 取引日 | Transaction Date | Date | - | YYYY/MM/DD |
| 3 | 借方勘定科目 | Debit Account | String | 30 | e.g. 旅費交通費, 会議費 |
| 4 | 借方補助科目 | Debit Sub Account | String | 30 | Optional |
| 5 | 借方部門 | Debit Department | String | 20 | Optional |
| 6 | 借方取引先 | Debit Partner | String | 255 | Vendor name |
| 7 | 借方税区分 | Debit Tax Class | String | 50 | e.g. 課税仕入 10% |
| 8 | 借方インボイス | Debit Invoice | String | 50 | 適格 / 区分記載 |
| 9 | 借方金額 | Debit Amount | Integer | - | Yen (no decimals) |
| 10 | 借方税額 | Debit Tax Amount | Integer | - | Consumption tax |
| 11 | 貸方勘定科目 | Credit Account | String | 30 | e.g. 未払金, 現金 |
| 12 | 貸方補助科目 | Credit Sub Account | String | 30 | Optional |
| 13 | 貸方部門 | Credit Department | String | 20 | Optional |
| 14 | 貸方取引先 | Credit Partner | String | 255 | Optional |
| 15 | 貸方税区分 | Credit Tax Class | String | 50 | Optional |
| 16 | 貸方インボイス | Credit Invoice | String | 50 | Optional |
| 17 | 貸方金額 | Credit Amount | Integer | - | Must equal debit |
| 18 | 貸方税額 | Credit Tax Amount | Integer | - | Optional |
| 19 | 摘要 | Description | String | 200 | Summary text |
| 20 | 仕訳メモ | Journal Memo | String | 200 | Internal note |
| 21 | タグ | Tag | String | 100 | Classification tag |
| 22 | MF仕訳タイプ | MF Journal Type | String | - | Leave blank for import |
| 23 | 決算整理仕訳 | Closing Entry | String | - | Leave blank (= no) |
| 24 | 作成日時 | Created At | Datetime | - | YYYY/MM/DD HH:MM:SS |
| 25 | 作成者 | Created By | String | - | App identifier |
| 26 | 最終更新日時 | Updated At | Datetime | - | YYYY/MM/DD HH:MM:SS |
| 27 | 最終更新者 | Updated By | String | - | App identifier |

## Example Row

```csv
"1","2026/01/15","会議費","","","サンプル株式会社","課税仕入 10%","適格","11000","1000","未払金","","","","","","11000","1000","会議費 サンプル株式会社 [01HXYZ...]","","","","","2026/01/20 10:30:00","receipt-ocr-app","2026/01/20 10:30:00","receipt-ocr-app"
```
