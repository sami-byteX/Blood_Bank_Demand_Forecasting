import sqlite3
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import os
import warnings
warnings.filterwarnings('ignore')

DB_PATH = r'D:\FYP\backend\db.sqlite3'
OUTPUT_DIR = r'D:\FYP\ml_comparison\output'
BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── STEP 1: Load data from SQLite ───────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
query = """
    SELECT strftime('%Y-%m', bi.issued_date) as month,
           bu.blood_group,
           COUNT(*) as units_issued
    FROM issuance_bloodissuance bi
    JOIN donations_bloodunit bu ON bu.id = bi.blood_unit_id
    WHERE bi.notes LIKE '%SIMULATION%'
    GROUP BY month, bu.blood_group
    ORDER BY month, bu.blood_group
"""
df = pd.read_sql_query(query, conn)
conn.close()

if df.empty:
    print("ERROR: No simulation issuance data found in database.")
    print("Make sure seed_proper_data has been run.")
    exit(1)

total_months = df['month'].nunique()
date_range   = f"{df['month'].min()} to {df['month'].max()}"
data_label   = f"{total_months} months simulation data ({date_range})"
print(f"Loaded {len(df)} rows covering {total_months} months ({date_range})")

# ─── STEP 2: Build time series per blood group ────────────────────────────────
all_months   = sorted(df['month'].unique())
month_to_idx = {m: i + 1 for i, m in enumerate(all_months)}

blood_group_data = {}
for bg in BLOOD_GROUPS:
    bg_df  = df[df['blood_group'] == bg].copy()
    bg_full = pd.DataFrame({'month': all_months})
    bg_full = bg_full.merge(bg_df[['month', 'units_issued']], on='month', how='left')
    bg_full['units_issued']  = bg_full['units_issued'].fillna(0).astype(float)
    bg_full['month_idx']     = bg_full['month'].map(month_to_idx)
    bg_full['month_of_year'] = bg_full['month'].apply(lambda x: int(x.split('-')[1]))
    col_mean = bg_full['units_issued'].mean() or 0
    bg_full['rolling_3'] = bg_full['units_issued'].rolling(3, min_periods=1).mean().fillna(col_mean)
    bg_full['rolling_6'] = bg_full['units_issued'].rolling(6, min_periods=1).mean().fillna(col_mean)
    blood_group_data[bg] = bg_full.reset_index(drop=True)

# ─── OLS from scratch (numpy only) ────────────────────────────────────────────
def ols_predict(x_train, y_train, x_test):
    n      = len(x_train)
    sum_x  = np.sum(x_train)
    sum_y  = np.sum(y_train)
    sum_xy = np.sum(x_train * y_train)
    sum_xx = np.sum(x_train * x_train)
    denom  = (n * sum_xx - sum_x ** 2)
    if denom == 0:
        return np.full(len(x_test), np.mean(y_train))
    slope     = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n
    return np.maximum(0, slope * x_test + intercept)

# ─── STEPS 3–6: Train / test / metrics ────────────────────────────────────────
results          = []
predictions_store = {}
features         = ['month_idx', 'month_of_year', 'rolling_3', 'rolling_6']

for bg in BLOOD_GROUPS:
    bg_df = blood_group_data[bg].copy()
    n     = len(bg_df)

    split_idx = int(n * 0.8)
    train = bg_df.iloc[:split_idx]
    test  = bg_df.iloc[split_idx:]

    if len(test) < 2:
        train = bg_df.iloc[:-2]
        test  = bg_df.iloc[-2:]

    if len(train) < 2:
        print(f"  Skipping {bg} — insufficient training data ({n} rows total)")
        continue

    X_train = train[features].values
    X_test  = test[features].values
    y_train = train['units_issued'].values.astype(float)
    y_test  = test['units_issued'].values.astype(float)

    # OLS — uses only month_idx as x
    ols_preds = ols_predict(train['month_idx'].values, y_train, test['month_idx'].values)

    # Random Forest — uses all 4 features
    rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=5)
    rf.fit(X_train, y_train)
    rf_preds = np.maximum(0, rf.predict(X_test))

    ols_mae = mean_absolute_error(y_test, ols_preds)
    rf_mae  = mean_absolute_error(y_test, rf_preds)

    try:
        ols_r2 = r2_score(y_test, ols_preds)
        rf_r2  = r2_score(y_test, rf_preds)
    except Exception:
        ols_r2 = 0.0
        rf_r2  = 0.0

    winner       = 'OLS' if ols_mae <= rf_mae else 'RF'
    ols_better_by = rf_mae - ols_mae

    results.append({
        'blood_group':  bg,
        'ols_mae':      round(ols_mae, 4),
        'rf_mae':       round(rf_mae, 4),
        'ols_r2':       round(ols_r2, 4),
        'rf_r2':        round(rf_r2, 4),
        'winner':       winner,
        'ols_better_by': round(ols_better_by, 4),
    })

    predictions_store[bg] = {
        'y_test':      y_test,
        'ols_preds':   ols_preds,
        'rf_preds':    rf_preds,
        'test_months': test['month_idx'].values,
    }

if not results:
    print("ERROR: No blood groups had sufficient data for comparison.")
    exit(1)

results_df = pd.DataFrame(results)

# ─── STEP 7: Chart 1 — MAE Comparison ─────────────────────────────────────────
plt.style.use('seaborn-v0_8-whitegrid')

fig, ax = plt.subplots(figsize=(12, 6))
x         = np.arange(len(results_df))
bar_width = 0.35

bars1 = ax.bar(x - bar_width / 2, results_df['ols_mae'], bar_width,
               color='#2196F3', label='OLS Linear Regression')
bars2 = ax.bar(x + bar_width / 2, results_df['rf_mae'],  bar_width,
               color='#F44336', label='Random Forest')

for bar in bars1:
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02,
            f'{bar.get_height():.2f}', ha='center', va='bottom', fontsize=9)
for bar in bars2:
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02,
            f'{bar.get_height():.2f}', ha='center', va='bottom', fontsize=9)

ax.set_ylabel('Mean Absolute Error (Lower is Better)')
ax.set_xticks(x)
ax.set_xticklabels(results_df['blood_group'])
ax.set_title('Prediction Accuracy: OLS vs Random Forest')
ax.legend(loc='upper right')
plt.figtext(0.5, -0.02,
            f'Blood Demand Forecasting | {data_label} | 80/20 train-test split',
            ha='center', fontsize=9, color='gray')
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'chart1_mae_comparison.png'), dpi=150, bbox_inches='tight')
plt.close()
print("Chart 1 saved — chart1_mae_comparison.png")

# ─── STEP 8: Chart 2 — B+ Predictions vs Actual ───────────────────────────────
if 'B+' in predictions_store:
    bp = predictions_store['B+']
    fig, ax = plt.subplots(figsize=(14, 5))

    ax.plot(bp['test_months'], bp['y_test'],    color='#212121', lw=2.5, marker='o',  label='Actual Demand')
    ax.plot(bp['test_months'], bp['ols_preds'], color='#2196F3', lw=2,   marker='s',  ls='--', label='OLS Prediction')
    ax.plot(bp['test_months'], bp['rf_preds'],  color='#F44336', lw=2,   marker='^',  ls='--', label='Random Forest')

    ax.fill_between(bp['test_months'], bp['y_test'], bp['ols_preds'], alpha=0.08, color='#2196F3')
    ax.fill_between(bp['test_months'], bp['y_test'], bp['rf_preds'],  alpha=0.08, color='#F44336')

    ax.set_title('B+ Blood Demand: OLS vs Random Forest vs Actual (Test Period)')
    ax.set_ylabel('Units Issued per Month')
    ax.set_xlabel('Month Index')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'chart2_predictions_bplus.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Chart 2 saved — chart2_predictions_bplus.png")
else:
    print("Chart 2 skipped — B+ had insufficient data")

# ─── STEP 9: Chart 3 — Summary Table Image ────────────────────────────────────
fig, ax = plt.subplots(figsize=(13, 4))
ax.axis('off')

col_labels = ['Blood Group', 'OLS MAE', 'RF MAE', 'OLS R²', 'RF R²', 'Winner']
table_data = []
for _, row in results_df.iterrows():
    table_data.append([
        row['blood_group'],
        f"{row['ols_mae']:.2f}",
        f"{row['rf_mae']:.2f}",
        f"{row['ols_r2']:.3f}",
        f"{row['rf_r2']:.3f}",
        row['winner'],
    ])

tbl = ax.table(cellText=table_data, colLabels=col_labels, loc='center', cellLoc='center')
tbl.auto_set_font_size(False)
tbl.set_fontsize(11)
tbl.scale(1.2, 2.0)

for j in range(len(col_labels)):
    tbl[0, j].set_facecolor('#37474F')
    tbl[0, j].set_text_props(color='white', fontweight='bold')

for i in range(len(results_df)):
    row_idx  = i + 1
    bg_color = 'white' if row_idx % 2 == 0 else '#F5F5F5'
    for j in range(len(col_labels)):
        tbl[row_idx, j].set_facecolor(bg_color)
    winner_col = len(col_labels) - 1
    if results_df.iloc[i]['winner'] == 'OLS':
        tbl[row_idx, winner_col].set_facecolor('#BBDEFB')
    else:
        tbl[row_idx, winner_col].set_facecolor('#FFCDD2')

ax.set_title('Model Performance Summary - All Blood Groups', pad=20, fontsize=13, fontweight='bold')
plt.figtext(0.5, 0.01,
            'Lower MAE = Better | Higher R² = Better | Trained on 80% Tested on 20%',
            ha='center', fontsize=9, color='gray')
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'chart3_summary_table.png'), dpi=150, bbox_inches='tight')
plt.close()
print("Chart 3 saved — chart3_summary_table.png")

# ─── STEP 10: Save CSV ────────────────────────────────────────────────────────
results_df.to_csv(os.path.join(OUTPUT_DIR, 'results.csv'), index=False)
print("results.csv saved.")

# ─── STEP 11: Console Summary ─────────────────────────────────────────────────
ols_wins      = (results_df['winner'] == 'OLS').sum()
rf_wins       = (results_df['winner'] == 'RF').sum()
avg_ols_mae   = results_df['ols_mae'].mean()
avg_rf_mae    = results_df['rf_mae'].mean()
overall_winner = 'OLS Linear Regression' if ols_wins >= rf_wins else 'Random Forest'

print("\n" + "=" * 60)
print("  FORECASTING MODEL COMPARISON RESULTS")
print("=" * 60)
print(f"  {'Blood Group':<12} {'OLS MAE':>10} {'RF MAE':>10} {'Winner':>10}")
print("  " + "-" * 46)
for _, row in results_df.iterrows():
    print(f"  {row['blood_group']:<12} {row['ols_mae']:>10.2f} {row['rf_mae']:>10.2f} {row['winner']:>10}")
print("  " + "-" * 46)
print(f"  {'AVERAGE':<12} {avg_ols_mae:>10.2f} {avg_rf_mae:>10.2f}")
print("=" * 60)
print(f"  OLS wins : {ols_wins} blood groups")
print(f"  RF  wins : {rf_wins} blood groups")
print(f"  Overall  : {overall_winner}")
print(f"  Data     : {data_label}")
print("=" * 60)
print("\nDone. Open results_viewer.html in your browser to view charts.")
