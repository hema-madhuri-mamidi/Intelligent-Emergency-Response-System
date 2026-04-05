# 🚨 Intelligent Emergency Response System

A smart and scalable emergency management system designed for hospitality environments to ensure fast, accurate, and coordinated responses during critical situations.

---

## 🧠 Problem

In large venues like hotels, emergencies (fire, medical, security) require **instant response and coordination**. However:
- Communication is often delayed
- Exact location of the incident is unclear
- Systems lack intelligent prioritization and automation

---

## 💡 Solution

Our system introduces a **hybrid emergency detection and response platform** that:
- Supports **multi-source emergency detection**
- Uses a **hybrid indoor location system**
- Automatically assigns **priority and responders**
- Provides a **real-time dashboard for monitoring**

---

## 🔥 Key Features

### 🚨 Multi-Source Emergency Detection
- 👤 **User Report** (manual trigger)
- 📡 **Sensor Detection** (simulated IoT alerts)
- 📷 **AI Camera Detection** (image-based simulation)

---

### 📍 Hybrid Indoor Location System
To overcome indoor location challenges:

1. **Check-in Based Location**
   - User’s room is stored during check-in
   - Used for instant emergency reporting

2. **Beacon-Based Detection (Simulated)**
   - Detects nearest device (conceptual IoT integration)

3. **Manual Fallback**
   - Quick selection if automatic detection fails

👉 Ensures: **Fast + Accurate + Reliable location handling**

---

### ⚡ Smart Priority System

| Emergency Type | Priority |
|---------------|---------|
| Fire 🔥        | 🔴 High |
| Medical 🏥     | 🟡 Medium |
| Security 🚨    | 🟢 Low |

---

### 👨‍🚒 Nearest Responder Assignment
- Assigns staff based on location proximity
- Reduces response time significantly

---

### 📊 Live Dashboard
- Displays:
  - Emergency type
  - Location
  - Source (User / Sensor / AI)
  - Priority
  - Assigned staff
  - Status (Pending → In Progress → Resolved)

---

### 🔄 Response Tracking
- Staff can:
  - Accept emergency
  - Mark as resolved

---

## 🛠️ Tech Stack

- **Frontend:** React (Lovable UI)
- **Backend:** Django
- **Database:** SQLite
- **AI Simulation:** Image-based detection (mock logic)
- **Optional:** OpenCV (extendable)

---

## 🧪 How It Works

1. Emergency is triggered (User / Sensor / AI)
2. System determines:
   - Type
   - Priority
   - Location (hybrid system)
3. Assigns nearest responder
4. Displays on dashboard
5. Tracks response status

---

## 🚀 Future Scope

- Real-time CCTV integration
- IoT sensors (smoke, motion, wearables)
- Indoor positioning using Bluetooth beacons
- Mobile app for responders
- Integration with emergency services

---

## 🏆 Key Innovation

> “Fast by default, accurate when needed, reliable always.”

Our hybrid approach ensures:
- ⚡ Speed (check-in based)
- 🎯 Accuracy (beacon/manual override)
- 🔁 Reliability (fallback mechanisms)

---

## 👥 Team

- [Your Name]
- [Teammate 1]
- [Teammate 2]
- [Teammate 3]

---

## 🙌 Conclusion

This system demonstrates how **smart design + practical constraints** can create an effective emergency response solution even without complex infrastructure.
