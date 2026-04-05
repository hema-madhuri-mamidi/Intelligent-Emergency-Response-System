from rest_framework import serializers

from .models import EmergencyAlert, LocationAudit


class LocationAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationAudit
        fields = [
            "device_id",
            "event_type",
            "building",
            "floor",
            "room",
            "beacon_id",
            "emergency_type",
            "metadata",
            "client_ts",
        ]


class EmergencyAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyAlert
        fields = [
            "device_id",
            "emergency_type",
            "priority",
            "source_category",
            "location_method",
            "building",
            "floor",
            "room",
            "pin_label",
            "location_detail",
            "location_type",
            "beacon_id",
        ]
