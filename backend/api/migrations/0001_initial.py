# Generated manually for environments without django-admin at hand

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="EmergencyAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("device_id", models.CharField(db_index=True, max_length=64)),
                ("emergency_type", models.CharField(max_length=32)),
                ("priority", models.CharField(max_length=16)),
                ("source_category", models.CharField(max_length=16)),
                ("location_method", models.CharField(blank=True, max_length=64)),
                ("building", models.CharField(blank=True, max_length=200)),
                ("floor", models.CharField(blank=True, max_length=80)),
                ("room", models.CharField(blank=True, max_length=80)),
                ("pin_label", models.CharField(blank=True, max_length=120)),
                ("location_detail", models.CharField(blank=True, max_length=400)),
                ("location_type", models.CharField(blank=True, max_length=80)),
                ("beacon_id", models.CharField(blank=True, max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="LocationAudit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("device_id", models.CharField(db_index=True, max_length=64)),
                ("event_type", models.CharField(db_index=True, max_length=48)),
                ("building", models.CharField(blank=True, max_length=200)),
                ("floor", models.CharField(blank=True, max_length=80)),
                ("room", models.CharField(blank=True, max_length=80)),
                ("beacon_id", models.CharField(blank=True, max_length=120)),
                ("emergency_type", models.CharField(blank=True, max_length=32)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("client_ts", models.CharField(blank=True, max_length=40)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
