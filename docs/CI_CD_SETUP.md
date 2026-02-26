# CI/CD Pipeline Setup

Automated Docker build, test, scan, and push pipeline using GitHub Actions.

## What's Automated

### Pipeline 1: Docker Build & Test (On Every Push/PR)

**Trigger:** Push to `main`/`develop`, PR to `main`/`develop`

**Steps:**

1.  **Lint Dockerfiles** - Validate Docker syntax with Hadolint
2.  **Build Images** - Build 8 Docker images in parallel
3.  **Scan Vulnerabilities** - Security scan with Trivy
4.  **Test Containers** - Run gateway & user-app test
5.  **Generate Report** - Summary to GitHub

**Duration:** ~10-15 minutes

**Files:** `.github/workflows/docker-build-test.yml`

---

### Pipeline 2: Build & Push to Docker Hub (On Main/Tag)

**Trigger:** Push to `main` branch or Git tag (e.g., `v1.0.0`)

**Steps:**

1.  **Build Images** - Build 8 images with cache
2.  **Push to Docker Hub** - Push all images
3.  **Create Release** - GitHub release notes (if tag)

**Duration:** ~15-20 minutes

**Files:** `.github/workflows/docker-push.yml`

---

## Setup Instructions

### Step 1: Create GitHub Secrets

Go to GitHub → Settings → Secrets and Variables → Actions

**Add these secrets:**

```
DOCKER_USERNAME = your_docker_hub_username
DOCKER_PASSWORD = your_docker_hub_password (NOT your account password!)
```

**How to get Docker password:**

1. Go to https://hub.docker.com/settings/security
2. Create "New Access Token"
3. Copy token and paste as DOCKER_PASSWORD

### Step 2: Push Workflows to GitHub

```bash
git add .github/workflows/
git commit -m "ci: add Docker build and push pipelines"
git push origin main
```

### Step 3: Verify Setup

Go to GitHub → Actions

Should see workflows:

- `Docker Build & Test Pipeline`
- `Docker Build & Push to Hub`

---

## Workflow Details

### Workflow 1: docker-build-test.yml

**Runs on:**

- Push to `main` or `develop`
- Pull Request to `main` or `develop`
- Manual trigger (workflow_dispatch)

**Paths that trigger (changes to):**

- `apps/**`
- `libs/**`
- `Dockerfile*`
- `.github/workflows/docker-build-test.yml`
- `scripts/**`

**Jobs (parallel):**

#### Job 1: lint-dockerfiles

```bash
hadolint Dockerfile.*
```

- Validates Dockerfile syntax
- Checks best practices
- ~2 minutes

#### Job 2: build-images (8 parallel)

```bash
docker buildx build -f Dockerfile.app .
```

- Builds each image independently
- Artifacts stored for next jobs
- ~5-10 minutes total

#### Job 3: scan-images (8 parallel)

```bash
trivy image-ref scan
```

- Security vulnerability scanning
- Results in GitHub Security tab
- ~2-3 minutes per image

#### Job 4: test-containers (2 parallel)

```bash
docker run <image>
```

- Tests gateway + user-app
- Validates startup
- ~3-5 minutes total

#### Job 5: report

- Summary to GitHub Actions UI

---

### Workflow 2: docker-push.yml

**Runs on:**

- Push to `main` branch
- Git tag push (e.g., `v1.0.0`)
- Manual trigger with version input

**Example:**

```bash
# Auto on push to main
git push origin main
→ Builds & pushes with version: latest

# Auto on tag
git tag v1.0.0
git push origin v1.0.0
→ Builds & pushes with version: v1.0.0

# Manual
GitHub Actions UI → Run workflow
→ Input version: v1.1.0
→ Builds & pushes with version: v1.1.0
```

**Output:**

- Images on Docker Hub
- GitHub Release notes (for tags)

---

## Viewing Results

### GitHub Actions UI

```
GitHub → Actions → Workflow runs
```

**Shows:**

- Pass/ Fail for each job
- Duration
- Logs for each step
- Artifacts

### Security Scanning Results

```
GitHub → Security → Code scanning
```

**Shows:**

- Vulnerability severity
- Details & fixes
- Affected files

### Docker Hub

```
https://hub.docker.com/r/yourusername
```

**Shows:**

- Images pushed
- 🏷 Tags (latest, v1.0.0, etc.)
- Push dates

---

## Manual Builds vs Automated

### Manual (Local)

```bash
export DOCKER_USERNAME=yourusername
export VERSION=v1.0.0
./scripts/build-all-images.sh  # ~5-10 minutes
./scripts/push-all-images.sh   # ~3-5 minutes
```

### Automated (GitHub Actions)

```bash
git push origin main
# Automatically:
# 1. Lint
# 2. Build (in CI environment)
# 3. Test
# 4. Scan
# 5. Report
```

**Advantages:**

- Consistent environment (Ubuntu)
- Automated testing
- Security scanning
- No local setup needed
- Historical logs
- Parallel builds

---

## Customization

### Change Build Trigger

**File:** `.github/workflows/docker-build-test.yml`

```yaml
on:
  push:
    branches: [main] # Only main, not develop
  pull_request:
    branches: [main]
```

### Add More Tests

```yaml
- name: Run Custom Tests
  run: |
    docker exec app-container npm test
```

### Change Scan Tool

Replace Trivy with Grype, Snyk, etc.

### Add Deployment Step

```yaml
- name: Deploy to Staging
  run: |
    curl -X POST ${{ secrets.DEPLOY_WEBHOOK }} \
      -d "version=$VERSION"
```

---

## Best Practices

### 1. Use Tags for Releases

```bash
git tag v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
# Automatically triggers docker-push.yml
# Creates GitHub Release
```

### 2. Review Security Scans

Check GitHub → Security → Code scanning regularly

### 3. Cache Docker Layers

Already configured in `docker-push.yml`:

```yaml
cache-from: type=registry,ref=...
cache-to: type=registry,ref=...
```

→ Faster builds, same image

### 4. Monitor Workflow Runs

Set up notifications:

- GitHub → Settings → Notifications
- Slack integration
- Email alerts

---

## Troubleshooting

### Docker Login Failed

```
Error: Username or password invalid
```

**Fix:**

1. Verify DOCKER_USERNAME in secrets
2. Regenerate DOCKER_PASSWORD (access token)
3. Update secrets

### Build Failed

Check logs:

```
GitHub Actions → Workflow run → Failed job → Logs
```

### Images Not Pushed

1. Check Docker Hub login
2. Check repository exists
3. Check DOCKER_USERNAME correct

### Slow Builds

- Docker layer cache not working?
- Check internet bandwidth
- Consider GitHub-hosted runners with more resources

---

## Example Workflows

### Release New Version

```bash
# 1. Make changes
git add .
git commit -m "feat: new feature"

# 2. Create tag
git tag v1.1.0
git push origin main
git push origin v1.1.0

# GitHub Actions automatically:
# Tests code
# Builds images
# Scans vulnerabilities
# Pushes to Docker Hub
# Creates release notes
```

### Deploy to Production

```bash
# After CI passes
export VERSION=v1.1.0
export DOCKER_USERNAME=yourusername

# On each production host
cd deploys
./deploy.sh gateway
./deploy.sh user-app
# ... etc
```

---

## Security Considerations

### Secrets Management

- Access tokens, not passwords
- Secrets never logged
- Use GitHub secrets (encrypted)
- Rotate tokens regularly

### Vulnerability Scanning

- All images scanned
- Results in GitHub Security
- Fails build on critical issues (can configure)

### Image Signing

- Recommended: Use Docker Content Trust (DCT)
- Sign images before push
- Verify signatures before deploy

---

## Related Documentation

- `.github/workflows/docker-build-test.yml` - Build & test workflow
- `.github/workflows/docker-push.yml` - Push workflow
- `DEPLOYMENT_GUIDE_VI.md` - Manual deployment
- `deploys/README.md` - Deployment reference

---

## Summary

**What CI/CD does:**

1.  Automatic testing on every push
2.  Security scanning
3.  Builds consistent images
4.  Pushes to Docker Hub
5.  Fails fast on errors

**Time saved:**

- Manual build: ~10 minutes
- CI build: Same but automated + tested
- Multiple builds: Parallel execution

**Quality improved:**

- Consistent builds
- Security scanned
- Tests passing
- Historical tracking

Ready to use!

--- **Created:** 2024-11-13
**Status:** Ready to Deploy
