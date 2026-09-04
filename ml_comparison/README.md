# ML Comparison - Blood Bank Demand Forecasting

**Purpose:** Standalone comparison of OLS Linear Regression vs Random Forest for blood demand forecasting. Zero connection to production system. Reads database only, never writes.

## How to run

1. Create a virtual environment inside this folder:
   python -m venv ml_venv

2. Activate it:
   ml_venv\Scripts\activate

3. Install dependencies:
   pip install -r requirements.txt

4. Run the comparison:
   python train_and_compare.py

5. Open results in browser:
   Open results_viewer.html

## Output files (generated in output/ folder)

- chart1_mae_comparison.png — MAE comparison bar chart
- chart2_predictions_bplus.png — B+ actual vs predicted line chart
- chart3_summary_table.png — full results table image
- results.csv — raw metrics for all blood groups

## Notes

- Script reads D:\FYP\backend\db.sqlite3 in read-only mode
- Uses only simulation issuance records (23-month history July 2024 - May 2026)
- Does not modify any production file
