from django.contrib import admin

from .models import EmergencyAlert, LocationAudit


@admin.register(LocationAudit)
class LocationAuditAdmin(admin.ModelAdmin):
    list_display = ("created_at", "device_id", "event_type", "building", "floor", "room", "beacon_id")
    list_filter = ("event_type",)
    search_fields = ("device_id", "beacon_id")


@admin.register(EmergencyAlert)
class EmergencyAlertAdmin(admin.ModelAdmin):
    list_display = ("created_at", "device_id", "emergency_type", "priority", "source_category", "location_method")
    list_filter = ("emergency_type", "source_category")
