# Setup Guide

This guide walks you through everything you need to set up on your computer to work on the Koemerle app.
Follow the steps in order. Ask Joro if anything is unclear.

---

## Overview of what you will install

1. A GitHub account (to access the shared code repository)
2. Git (to sync code between your computer and GitHub)
3. A code editor (VS Code)
4. Node.js (required for Claude Code and the app)
5. Claude Code (the AI assistant that helps you write code)
6. Python *(only if we go with Variant B — skip for now)*

---

## Step 1: Create a GitHub Account

1. Go to [github.com](https://github.com)
2. Click **Sign up**
3. Choose a username, enter your email and a password
4. Complete the verification and confirm your email
5. Send Joro your GitHub username so he can add you to the repository

Once Joro has added you, you will receive an email invitation — **accept it**.

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

## Step 5: Install Node.js

Node.js is required for Claude Code and for running the app locally.

### Mac

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the one labelled "Recommended For Most Users")
3. Run the installer and follow the steps
4. Open Terminal and verify:
   ```
   node --version
   npm --version
   ```
   Both should print a version number.

### Windows

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version
3. Run the installer — click **Next** through all steps, defaults are fine
4. Open a new **Command Prompt** or **Git Bash** and verify:
   ```
   node --version
   npm --version
   ```
   Both should print a version number.

---

## Step 6: Install Claude Code

Claude Code is an AI assistant that runs in the terminal and helps you write and edit code.

### Create an Anthropic account

1. Go to [claude.ai](https://claude.ai) and sign up (or log in if you already have an account)
2. You need a **Claude Max** subscription ($100/month) to use Claude Code — check with Joro about billing

*Alternative: Joro can share an API key with you if he sets one up — in that case skip the account step and he will give you a key to use in the next step.*

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

## Step 7: Download the project (clone the repository)

1. Open Terminal (Mac) or Git Bash (Windows)
2. Navigate to where you want to store the project, for example your home folder:
   ```
   cd ~
   ```
3. Clone the repository (replace the URL with the actual one Joro sends you):
   ```
   git clone https://github.com/JOROS_USERNAME/koemerle.git
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

## Step 8: Open Claude Code in the project

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

### 1. Get the latest changes from GitHub (always do this first)

```
git pull
```

### 2. Work on the app

Use Claude Code in the terminal or VS Code to make changes.

### 3. Save your changes to GitHub

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
Don't panic. Tell Joro — he will help you resolve it.

---

## Additional setup (depending on tech stack)

### If we go with Variant B (Python backend)

Install Python:

**Mac:**
```
brew install python
```
*(If `brew` is not found, install Homebrew first: [brew.sh](https://brew.sh))*

**Windows:**
1. Go to [python.org/downloads](https://python.org/downloads)
2. Download the latest version, run the installer
3. **Important:** tick the checkbox **"Add Python to PATH"** before clicking Install

Verify:
```
python --version
```

### App dependencies

Once the project structure is set up, there will be one more step to install the app's packages. That will be added here when the time comes.
