from django.contrib import admin

from .models import BloodIssuance


@admin.register(BloodIssuance)
class BloodIssuanceAdmin(admin.ModelAdmin):
    list_display = ['id', 'blood_request', 'blood_unit', 'issued_by', 'issued_date']
    list_filter = ['issued_date']
    search_fields = [
        'issued_by__email',
        'blood_request__department__name',
        'blood_unit__blood_group',
    ]
    readonly_fields = ['issued_date']
