"""
Management command: python manage.py audit_data_quality

Read-only data quality audit. Does NOT modify, delete, or create any records.
"""
import inspect
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.constants import MIN_DONATION_INTERVAL_DAYS
from donations.models import BloodUnit, Donation


class Command(BaseCommand):
    help = 'Read-only data quality audit. Reports issues without modifying any data.'

    # ── helpers ───────────────────────────────────────────────────────────────

    def section(self, title):
        self.stdout.write(f'\n[{title}]')
        self.stdout.write('-' * 64)

    def ok(self, msg):
        self.stdout.write(f'  OK  {msg}')

    def warn(self, msg):
        self.stdout.write(f'  !!  {msg}')

    def row(self, msg):
        self.stdout.write(f'  {msg}')

    # ── main ──────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        today = timezone.now().date()

        self.stdout.write('\n' + '=' * 64)
        self.stdout.write('  DATA QUALITY AUDIT REPORT - Blood Bank Management System')
        self.stdout.write(f'  Date: {today}')
        self.stdout.write('=' * 64)

        # ─────────────────────────────────────────────────────────────────────
        # 1. Donation interval violations (< 56 days between same donor)
        # ─────────────────────────────────────────────────────────────────────
        self.section('1  DONATION INTERVAL VIOLATIONS  (< 56 days apart per donor)')

        by_donor = defaultdict(list)
        for d in Donation.objects.select_related('donor__user').order_by('donor_id', 'donation_date'):
            by_donor[d.donor_id].append(d)

        interval_violations = []
        for donations in by_donor.values():
            for i in range(1, len(donations)):
                prev = donations[i - 1]
                curr = donations[i]
                gap = (curr.donation_date.date() - prev.donation_date.date()).days
                if gap < MIN_DONATION_INTERVAL_DAYS:
                    interval_violations.append((prev, curr, gap))

        if not interval_violations:
            self.ok('No violations found.')
        else:
            shown = interval_violations[:10]
            for prev, curr, gap in shown:
                donor_name = prev.donor.user.full_name
                self.row(
                    f'Donor: {donor_name:<20} '
                    f'#{prev.id} ({prev.donation_date.date()}) -> '
                    f'#{curr.id} ({curr.donation_date.date()}) '
                    f'gap={gap} days'
                )
            if len(interval_violations) > 10:
                self.row(f'... and {len(interval_violations) - 10} more violations (seed data expected)')

        # ─────────────────────────────────────────────────────────────────────
        # 2. Blood group mismatches (Donation.blood_group ≠ DonorProfile.blood_group)
        # ─────────────────────────────────────────────────────────────────────
        self.section('2  BLOOD GROUP MISMATCHES  (Donation vs DonorProfile)')

        mismatches = []
        for d in Donation.objects.select_related('donor__user'):
            if d.blood_group != d.donor.blood_group:
                mismatches.append(d)

        if not mismatches:
            self.ok('All donation blood groups match their donor profile.')
        else:
            shown = mismatches[:10]
            for d in shown:
                self.row(
                    f'Donation #{d.id:<4} | Donor: {d.donor.user.full_name:<20} | '
                    f'Recorded: {d.blood_group:<4} | Profile: {d.donor.blood_group}'
                )
            if len(mismatches) > 10:
                self.row(f'... and {len(mismatches) - 10} more')
            self.warn('Run fix_donation_blood_groups to correct these.')

        # ─────────────────────────────────────────────────────────────────────
        # 3. Donations missing a BloodUnit record
        # ─────────────────────────────────────────────────────────────────────
        self.section('3  DONATIONS MISSING BLOOD UNIT RECORDS')

        orphaned = list(
            Donation.objects
            .filter(blood_unit__isnull=True)
            .select_related('donor__user')
        )

        if not orphaned:
            self.ok('Every donation has a linked BloodUnit.')
        else:
            for d in orphaned:
                self.row(
                    f'Donation #{d.id} | Donor: {d.donor.user.full_name} | '
                    f'Date: {d.donation_date.date()} | BG: {d.blood_group}'
                )
            self.warn(f'{len(orphaned)} donation(s) have no BloodUnit - data integrity problem.')

        # ─────────────────────────────────────────────────────────────────────
        # 4. BloodUnits marked available but past their expiry date
        # ─────────────────────────────────────────────────────────────────────
        self.section('4  BLOOD UNITS MARKED available BUT PAST EXPIRY DATE')

        stale = BloodUnit.objects.filter(status='available', expiry_date__lt=today)
        stale_count = stale.count()

        if stale_count == 0:
            self.ok('No stale units found. Inventory status is current.')
        else:
            for u in stale[:5]:
                overdue = (today - u.expiry_date).days
                self.row(
                    f'Unit #{u.id:<4} | BG: {u.blood_group:<4} | '
                    f'Collected: {u.collection_date} | '
                    f'Expired: {u.expiry_date} | '
                    f'{overdue} days overdue'
                )
            if stale_count > 5:
                self.row(f'... and {stale_count - 5} more')
            self.warn(f'{stale_count} unit(s) need status update. Run: python manage.py check_expiry')

        # ─────────────────────────────────────────────────────────────────────
        # 5. Summary counts
        # ─────────────────────────────────────────────────────────────────────
        self.section('5  SUMMARY')

        total_donations  = Donation.objects.count()
        total_units      = BloodUnit.objects.count()
        available_units  = BloodUnit.objects.filter(status='available').count()
        issued_units     = BloodUnit.objects.filter(status='issued').count()
        expired_units    = BloodUnit.objects.filter(status='expired').count()

        self.row(f'Total donations in DB            : {total_donations}')
        self.row(f'Total blood units in DB          : {total_units}')
        self.row(f'  status=available               : {available_units}')
        self.row(f'  status=issued                  : {issued_units}')
        self.row(f'  status=expired                 : {expired_units}')
        self.row('')
        self.row(f'Interval violations (< 56 days)  : {len(interval_violations)}')
        self.row(f'Blood group mismatches           : {len(mismatches)}')
        self.row(f'Donations missing BloodUnit      : {len(orphaned)}')
        self.row(f'Stale available units            : {stale_count}')

        # ─────────────────────────────────────────────────────────────────────
        # 6. Forecasting algorithm audit
        # ─────────────────────────────────────────────────────────────────────
        self.section('6  FORECASTING ALGORITHM AUDIT')

        # 6a. Check for forbidden ML libraries in the Python environment
        forbidden_libs = ['prophet', 'sklearn', 'statsmodels', 'tensorflow', 'torch', 'keras', 'xgboost']
        installed_forbidden = []
        for lib in forbidden_libs:
            try:
                __import__(lib)
                installed_forbidden.append(lib)
            except ImportError:
                pass

        if installed_forbidden:
            self.warn(f'Forbidden ML libraries installed in env: {", ".join(installed_forbidden)}')
        else:
            self.ok('No forbidden ML libraries present in environment.')

        # 6b. Inspect forecasting service source at runtime
        try:
            import forecasting.services as fs_module
            source = inspect.getsource(fs_module)

            # Markers that confirm rolling average is present
            has_rolling = any(k in source for k in [
                'LOOKBACK_WEEKS', 'week_index', 'weekly', 'rolling', 'timedelta(weeks',
            ])
            # Markers that confirm OLS linear regression is implemented from scratch
            has_ols = any(k in source for k in [
                'sum_xy', 'sum_x2', 'slope', 'intercept', 'n * sum',
            ])
            # Markers that would indicate a forbidden import inside the service
            has_forbidden_import = any(k in source for k in [
                'import prophet', 'from prophet',
                'import sklearn', 'from sklearn',
                'import statsmodels', 'from statsmodels',
                'import tensorflow', 'import torch',
            ])

            self.row(f'Rolling average logic found     : {"Yes" if has_rolling else "No - MISSING"}')
            self.row(f'OLS regression from scratch     : {"Yes" if has_ols else "No - MISSING"}')
            self.row(f'Forbidden library import in svc : {"YES - VIOLATION" if has_forbidden_import else "None"}')

            if has_rolling and has_ols and not has_forbidden_import:
                self.ok('Forecasting uses rolling average + plain OLS only. FYP-compliant.')
            elif has_forbidden_import:
                self.warn('Forecasting service imports a forbidden library - must be removed.')
            else:
                self.warn('Forecasting algorithm markers not detected - inspect services.py manually.')

        except ModuleNotFoundError:
            self.warn('forecasting app not found - cannot inspect service.')
        except Exception as exc:
            self.warn(f'Could not inspect forecasting service: {exc}')

        self.stdout.write('\n' + '=' * 64)
        self.stdout.write('  END OF REPORT - Zero records were modified.')
        self.stdout.write('=' * 64 + '\n')
