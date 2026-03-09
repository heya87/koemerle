# Setup Guide

This guide walks you through everything you need to set up on your computer to work on the Koemerle app.
Follow the steps in order. Ask Joël if anything is unclear.

---

## Overview of what you will install

1. A GitHub account (to access the shared code repository)
2. Git (to sync code between your computer and GitHub)
3. A code editor (VS Code)
4. Node.js via nvm (required for Claude Code and the app)
5. Docker Desktop (required to run the local database)
6. Claude Code (the AI assistant that helps you write code)

---

## Step 1: Create a GitHub Account

1. Go to [github.com](https://github.com)
2. Click **Sign up**
3. Choose a username, enter your email and a password
4. Complete the verification and confirm your email
5. Send Joël your GitHub username so he can add you to the repository

Once Joël has added you, you will receive an email invitation — **accept it**.

---

## Step 2: Install Git

Git is the tool that syncs your code with GitHub.

### Mac

1. Open the **Terminal** app (search for it with Cmd+Space)
2. Type the following and press Enter:
   ```
   xcode-select --install
   ```
3. A popup will appear — click **Install** and wait for it to finish
4. Verify it worked by typing:
   ```
   git --version
   ```
   You should see something like `git version 2.x.x`

### Windows

1. Go to [git-scm.com/download/win](https://git-scm.com/download/win)
2. Download and run the installer
3. Click **Next** through all steps — the defaults are fine
4. Open the **Git Bash** app that was just installed
5. Verify it worked by typing:
   ```
   git --version
   ```
   You should see something like `git version 2.x.x`

---

## Step 3: Configure Git with your name and email

This makes sure your changes are signed with your name. Open Terminal (Mac) or Git Bash (Windows) and run:

```
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

Use the same email address you used for GitHub.

---

## Step 4: Install VS Code (code editor)

1. Go to [code.visualstudio.com](https://code.visualstudio.com)
2. Download and install the version for your system (Mac or Windows)
3. Open VS Code once to make sure it works

---

## Step 5: Install Node.js via nvm

We use nvm (Node Version Manager) to install and manage Node.js. This is more flexible than installing Node.js directly.

### Mac

1. Open Terminal and run:
   ```
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   ```
2. Close and reopen Terminal (this is required for nvm to be available)
3. Install Node.js 24:
   ```
   nvm install 24
   nvm alias default 24
   ```
4. Verify:
   ```
   node --version
   npm --version
   ```
   Both should print a version number.

### Windows

On Windows, use [nvm-windows](https://github.com/coreybutler/nvm-windows):

1. Go to [github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
2. Download and run `nvm-setup.exe`
3. Open a new **Command Prompt** and run:
   ```
   nvm install 24
   nvm use 24
   ```
4. Verify:
   ```
   node --version
   npm --version
   ```

---

## Step 6: Install Docker Desktop

Docker runs the local database on your computer.

1. Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Download the version for your system (Mac or Windows)
3. Run the installer and follow the steps
4. Open Docker Desktop once — it needs to be running in the background whenever you work on the app
5. Verify in Terminal:
   ```
   docker --version
   ```

---

## Step 7: Install Claude Code

Claude Code is an AI assistant that runs in the terminal and helps you write and edit code.

### Create an Anthropic account

1. Go to [claude.ai](https://claude.ai) and sign up (or log in if you already have an account)
2. You need a **Claude Max** subscription ($100/month) to use Claude Code — check with Joël about billing

*Alternative: Joël can share an API key with you if he sets one up — in that case skip the account step and he will give you a key to use in the next step.*

### Install Claude Code

Open Terminal (Mac) or Git Bash (Windows) and run:

```
npm install -g @anthropic-ai/claude-code
```

Verify it worked:

```
claude --version
```

### Log in to Claude Code

Run:

```
claude
```

The first time you run it, it will ask you to log in to your Anthropic account or enter an API key. Follow the prompts.

---

## Step 8: Download the project (clone the repository)

1. Open Terminal (Mac) or Git Bash (Windows)
2. Navigate to where you want to store the project, for example your home folder:
   ```
   cd ~
   ```
3. Clone the repository:
   ```
   git clone https://github.com/heya87/koemerle.git
   ```
4. Go into the project folder:
   ```
   cd koemerle
   ```
5. Open it in VS Code:
   ```
   code .
   ```

---

## Step 9: Set up the app

1. Go into the app folder:
   ```
   cd app
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Create your local environment file by copying the example:
   ```
   cp .env.example .env
   ```
   Then open `.env` and fill in the values — ask Joël for the passwords.

4. Start the local database:
   ```
   npm run db:start
   ```
   Keep this running in the background (or use Docker Desktop to manage it).

5. Push the database schema:
   ```
   npm run db:push
   ```

6. Start the app:
   ```
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser — you should see the app.

---

## Step 10: Open Claude Code in the project

1. In VS Code, open the Terminal panel (menu: **Terminal → New Terminal**)
2. Make sure you are in the project folder (you should see `koemerle` in the prompt)
3. Start Claude Code:
   ```
   claude
   ```
4. You can now chat with Claude directly about the project — ask it to explain code, make changes, or add features

---

## Daily workflow: how to work on the project

Every time you sit down to work, follow this routine:

### 1. Make sure Docker Desktop is running

The app needs the local database. Open Docker Desktop if it is not already running.

### 2. Get the latest changes from GitHub (always do this first)

```
git pull
```

### 3. Start the app

```
cd app
npm run dev
```

### 4. Work on the app

Use Claude Code in the terminal or VS Code to make changes.

### 5. Save your changes to GitHub

When you are done and things are working, run:

```
git add .
git commit -m "short description of what you changed"
git push
```

Example commit message: `"add meal form"` or `"fix shopping list button"`

---

## Troubleshooting

**`git push` asks for a username and password**
GitHub no longer accepts passwords. You need a Personal Access Token:
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click **Generate new token**, give it a name, set expiry, tick the `repo` checkbox
3. Copy the token and use it as your password when Git asks

**`claude` command not found**
Node.js may not be in your PATH. Try closing and reopening the terminal, then run `npm install -g @anthropic-ai/claude-code` again.

**`git pull` says "merge conflict"**
Don't panic. Tell Joël — he will help you resolve it.

**Docker Desktop is not running**
The app will fail to connect to the database. Open Docker Desktop and wait for it to fully start, then try again.
