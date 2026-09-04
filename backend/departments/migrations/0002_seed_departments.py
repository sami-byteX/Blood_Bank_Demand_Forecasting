from django.db import migrations

SEED_DEPARTMENTS = [
    ('Emergency', 'Handles life-threatening emergencies and trauma cases.'),
    ('ICU', 'Intensive Care Unit for critically ill patients requiring constant monitoring.'),
    ('Surgery', 'Pre-operative and post-operative care for surgical patients.'),
    ('Maternity', 'Obstetrics and gynecology ward for maternal and newborn care.'),
    ('General Ward', 'General inpatient care for a wide range of conditions.'),
    ('Outpatient', 'Outpatient consultation and day-care procedures.'),
]


def seed_departments(apps, schema_editor):
    Department = apps.get_model('departments', 'Department')
    for name, description in SEED_DEPARTMENTS:
        Department.objects.get_or_create(name=name, defaults={'description': description, 'is_active': True})


def unseed_departments(apps, schema_editor):
    Department = apps.get_model('departments', 'Department')
    Department.objects.filter(name__in=[name for name, _ in SEED_DEPARTMENTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('departments', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_departments, reverse_code=unseed_departments),
    ]
