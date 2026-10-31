# Push CoursePulse to the existing GitHub repository

The remote repository already has its `main` branch initialized. Do not force-push over it.

From the folder where you downloaded and extracted this project, run:

```bash
git clone https://github.com/akashsharmapb09-cpu/coursePulse.site.git
cd coursePulse.site
# Copy/extract the CoursePulse project files into this folder before continuing.
git add -A
git commit -m "feat: add CoursePulse production application"
git push origin main
```

Do not copy `.env.local`, `.env`, `node_modules`, `.next`, Prisma database passwords, or service-role keys into Git.
