# 🔄 Sync Flow for app.famly.ai – Base44 → Your Repo

This guide explains how to keep your GitHub repository (`casepruis/app.famly`) up to date with the source code exported from Base44 (`base44dev/famlyai-1eac46be`).

---

## 🔧 Setup – Remotes

Your Git configuration should include two remotes:

base44 https://github.com/base44dev/famlyai-1eac46be.git (fetch)
base44 https://github.com/base44dev/famlyai-1eac46be.git (push)
origin git@github.com:casepruis/app.famly.git (fetch)
origin git@github.com:casepruis/app.famly.git (push)

If not yet set up, add the Base44 repo:

```bash
git remote add base44 https://github.com/base44dev/famlyai-1eac46be.git
## 🔄 How to Sync with Base44
```
When Base44 pushes new changes, follow this manual sync flow:

1. Fetch changes from Base44
```bash
git fetch base44
```

2. Merge their changes into your current branch (usually main)
```bash
git merge base44/main --allow-unrelated-histories -m "Sync from Base44"
```
If there are merge conflicts, Git will show you which files need fixing.

3. Resolve any conflicts if needed
```bash
git add .
git commit -m "Resolved merge conflicts from Base44"
```
4. Push to your own GitHub repository
```bash
git push origin main
```
## 💡 Best Practices
Only pull from base44, never push to it.
Make your edits and improvements in your own repo (origin).
If Base44 changes their structure significantly, consider re-syncing from scratch.

## 🤖 Optional Automation (GitHub Action)

You can automate syncing using GitHub Actions. Ask ChatGPT to generate a .github/workflows/sync.yml file that:

Pulls from base44

Merges into main

Pushes to origin

## 📌 Summary

base44 = source (read-only)

origin = your GitHub repo (where you work)

Keep them in sync by pulling from Base44 and pushing to your repo

Maintained by Pruis for app.famly.ai