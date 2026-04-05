from django.urls import path

from . import views

urlpatterns = [
    path("location-events/", views.LocationEventCreate.as_view()),
    path("emergencies/", views.EmergencyCreate.as_view()),
]
