from django.contrib import admin

from .models import BloodRequest


@admin.register(BloodRequest)
class BloodRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'department', 'blood_group', 'units_requested', 'requested_by', 'request_date', 'status']
    list_filter = ['status', 'blood_group', 'department']
    search_fields = ['requested_by__email', 'requested_by__full_name', 'department__name']
    readonly_fields = ['request_date']
