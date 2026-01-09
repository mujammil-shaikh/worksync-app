# WorkSync - Intelligent Hour Tracker

A progressive web app (PWA) for tracking corporate work hours, managing deficits, and calculating daily punch-out times.

## 🚀 How to Run Locally

You need **Node.js** installed on your computer.

1.  **Download the Code**: Save all these files into a folder named `worksync`.
2.  **Open Terminal**: Navigate to that folder.
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Start the App**:
    ```bash
    npm run dev
    ```
5.  **Open Browser**: Go to `http://localhost:3000`.

---

## ☁️ How to Host & Install (Free)

To install this on your iPhone or Android, it needs to be hosted on the web securely.

### Step 1: Push to GitHub
1.  Create a new repository on [GitHub.com](https://github.com) (e.g., `worksync-app`).
2.  In your local folder, run:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/worksync-app.git
    git push -u origin main
    ```

### Step 2: Deploy to Vercel
1.  Go to [Vercel.com](https://vercel.com) and Sign Up/Login.
2.  Click **"Add New..."** -> **"Project"**.
3.  Select **"Import"** next to your `worksync-app` repository.
4.  Leave all settings as default (Framework Preset: Vite).
5.  Click **Deploy**.

### Step 3: Install on Device
1.  Once deployed, Vercel gives you a URL (e.g., `https://worksync-app.vercel.app`).
2.  **Android**: Open the link in Chrome. Tap the **"Install App"** button in the top right header, or tap the Chrome menu (⋮) -> "Install app".
3.  **iOS (iPhone)**: Open the link in Safari. Tap the **Share Button** (box with arrow) -> Scroll down -> **"Add to Home Screen"**.

Now it works exactly like a native app!
