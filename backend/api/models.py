from django.db import models


class LocationAudit(models.Model):
    """Every check-in change, beacon attempt, and step in the hybrid location flow."""

    device_id = models.CharField(max_length=64, db_index=True)
    event_type = models.CharField(max_length=48, db_index=True)
    building = models.CharField(max_length=200, blank=True)
    floor = models.CharField(max_length=80, blank=True)
    room = models.CharField(max_length=80, blank=True)
    beacon_id = models.CharField(max_length=120, blank=True)
    emergency_type = models.CharField(max_length=32, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    client_ts = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"


class EmergencyAlert(models.Model):
    """Dispatched emergency after location resolution (check-in / BLE / manual)."""

    device_id = models.CharField(max_length=64, db_index=True)
    emergency_type = models.CharField(max_length=32)
    priority = models.CharField(max_length=16)
    source_category = models.CharField(max_length=16)
    location_method = models.CharField(max_length=64, blank=True)
    building = models.CharField(max_length=200, blank=True)
    floor = models.CharField(max_length=80, blank=True)
    room = models.CharField(max_length=80, blank=True)
    pin_label = models.CharField(max_length=120, blank=True)
    location_detail = models.CharField(max_length=400, blank=True)
    location_type = models.CharField(max_length=80, blank=True)
    beacon_id = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.emergency_type} ({self.source_category})"
