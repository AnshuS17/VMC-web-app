# Vadodara Municipal Corporation (VMC) Citizen Portal

![VMC Banner](/public/vadodara_palace.png)

A modern, highly professional, and responsive web application designed for the Vadodara Municipal Corporation. It serves as a unified digital platform for citizens to access municipal services, report civic grievances, and track their applications, while providing administrators with a powerful dashboard to manage cases.

## 🚀 Runnable Link (One-Click Environment)

Want to see the app in action immediately without installing anything locally? Click the button below to launch a fully configured, runnable environment in your browser via GitHub Codespaces!

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/AnshuS17/VMC-web-app)

## ✨ Key Features

- **Modern & Minimal UI**: A clean, distraction-free aesthetic with a beautiful monochrome color scheme and highly professional layout.
- **Dual-Card Auth Portal**: An advanced, responsive authentication interface that elegantly stacks on mobile devices.
- **Dark / Light Mode**: Built-in, fully animated theme toggle (with saved preferences) to adapt to user environments.
- **Citizen Grievance System**: Citizens can report location-tagged issues (potholes, garbage, water-logging) complete with automatic geolocation.
- **Admin Case Dashboard**: Real-time visualization using Chart.js to track complaint statuses, priority levels, and service metrics.
- **Role-Based Access**: Secure segregation of views and capabilities between standard citizens and VMC administrators.

## 🛠 Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (No heavy frontend frameworks for maximum performance).
- **Backend**: Node.js, Express.js.
- **Database**: Local JSON-based filesystem store (for portability) and configurable PostgreSQL integration.
- **Security**: Node `crypto` (`scryptSync`) for secure password hashing.

## 💻 Local Setup & Development

To run the application locally on your machine, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AnshuS17/VMC-web-app.git
   cd VMC-web-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3001`

### Default Authentication Roles

For testing the local environment, you can register a new citizen account directly from the **Portal Login**.

## 📄 License

This project is intended for demonstration and developmental purposes.
