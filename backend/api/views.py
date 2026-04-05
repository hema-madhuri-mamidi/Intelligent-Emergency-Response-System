from rest_framework import generics, status
from rest_framework.response import Response

from .models import EmergencyAlert, LocationAudit
from .serializers import EmergencyAlertSerializer, LocationAuditSerializer


class LocationEventCreate(generics.CreateAPIView):
    """
    POST /api/location-events/
    Frontend logs: checkin_saved, emergency_checkin_yes/no, beacon_*, manual_quick_entry, emergency_dispatched, etc.
    """

    queryset = LocationAudit.objects.all()
    serializer_class = LocationAuditSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        return Response({"ok": True, "id": ser.instance.pk}, status=status.HTTP_201_CREATED)


class EmergencyCreate(generics.CreateAPIView):
    """
    POST /api/emergencies/
    Called when an alert is created after hybrid location resolution.
    """

    queryset = EmergencyAlert.objects.all()
    serializer_class = EmergencyAlertSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        return Response({"ok": True, "id": ser.instance.pk}, status=status.HTTP_201_CREATED)
