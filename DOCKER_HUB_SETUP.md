# ��� Docker Hub Setup & Push Images - Hướng Dẫn 2024

Hướng dẫn chi tiết để setup Docker Hub và đẩy images lên.

## ��� Mục Lục

1. [Tạo Docker Hub Account](#tạo-docker-hub-account)
2. [Tạo Access Token](#tạo-access-token)
3. [Login Docker Locally](#login-docker-locally)
4. [Push Images Lên Hub](#push-images-lên-hub)
5. [Verify Images](#verify-images)
6. [Cleanup Local](#cleanup-local)

---

## ��� Tạo Docker Hub Account

### Step 1: Truy cập Docker Hub

**URL:** https://hub.docker.com

### Step 2: Click "Sign Up"

1. Nhập email
2. Nhập username: **haongo123** ✓
3. Nhập password (mạnh, 8+ ký tự)
4. Nhập full name (có thể để trống)
5. Agree Terms
6. Click "Sign Up"

### Step 3: Verify Email

1. Check email nhập ở bước 2
2. Click link verify trong email
3. Confirm account

**Done!** Account Docker Hub đã tạo xong.

---

## ��� Tạo Access Token (NOT Password)

**QUAN TRỌNG:** Dùng Access Token, KHÔNG dùng password của account!

### Step 1: Truy cập Security Settings

1. Login Docker Hub: https://hub.docker.com/login
2. Click avatar (phải trên cùng)
3. Click "Account Settings"
4. Click "Security" (menu trái)

### Step 2: Tạo Personal Access Token

1. Tìm section "Access Tokens"
2. Click "Generate new token"
3. Token name: `deployment` (hoặc tên tuỳ ý)
4. Access permissions: Select "Read & Write"
   - Read & Write (để push images)
5. Click "Generate"

### Step 3: Copy Token

```
 COPY TOKEN NGAY - Chỉ hiện 1 lần!
```

Token sẽ trông như:

```
dckr_pat_xxxxxxxxxxxxxxxxxxxxxxxx
```

**Copy và lưu ở chỗ an toàn (mật khẩu)** - Đây chính là DOCKER_PASSWORD

---

## ��� Login Docker Locally

### Step 1: Open Terminal/PowerShell

**Windows PowerShell:**

```powershell
docker login
```

**Or Bash:**

```bash
docker login
```

### Step 2: Nhập Credentials

```
Username: haongo123
Password: dckr_pat_xxxxxxxxxxxxxxxxxxxxxxxx  (paste token, không show)
```

**Expected Output:**

```
Login Succeeded
```

**SUCCESS!** Bây giờ máy local được phép push lên Docker Hub.

### Step 3: Verify Login

```bash
docker info | grep Username
# Output: Username: haongo123
```

---

## ��� Push Images Lên Hub

### Method 1: Push Manually (Nếu chưa có Images)

**Bước 1: Build Images**

```bash
cd backend-luan-van

export DOCKER_USERNAME=haongo123
export VERSION=v1.0.0

# Build all 8 images
chmod +x scripts/build-all-images.sh
./scripts/build-all-images.sh
```

**Output:**

```
 All images built successfully!
lv-gateway:v1.0.0
lv-user-app:v1.0.0
... etc
```

**Bước 2: Push Images**

```bash
chmod +x scripts/push-all-images.sh
./scripts/push-all-images.sh
```

**Output:**

```
 All images pushed successfully!

��� Images available at Docker Hub:
docker pull haongo123/lv-gateway:v1.0.0
docker pull haongo123/lv-user-app:v1.0.0
... etc
```

### Method 2: Individual Push (Nếu chỉ push 1 image)

```bash
# Tag image
docker tag lv-gateway:latest haongo123/lv-gateway:v1.0.0

# Push
docker push haongo123/lv-gateway:v1.0.0
```

### Method 3: One-Liner (Push All)

```bash
for app in gateway user-app product-app order-app cart-app payment-app report-app ar-app; do
  docker tag lv-$app:latest haongo123/lv-$app:v1.0.0
  docker push haongo123/lv-$app:v1.0.0
done
```

---

## Verify Images Trên Docker Hub

### Step 1: Truy cập Docker Hub

URL: https://hub.docker.com/r/haongo123

### Step 2: Check Images

**Nên thấy:**

```
lv-gateway
lv-user-app
lv-product-app
lv-order-app
lv-cart-app
lv-payment-app
lv-report-app
lv-ar-app
```

Mỗi image có:

- ���️ Tags: v1.0.0, latest
- ��� Pushed date: vừa push
- ��� Size: ~100-150MB mỗi cái

### Step 3: Pull & Test

```bash
# Pull từ Docker Hub
docker pull haongo123/lv-gateway:v1.0.0

# Verify
docker image inspect haongo123/lv-gateway:v1.0.0
```

---

## ��� Cleanup Local

### Xóa Local Images (Optional)

```bash
# Remove all lv-* images (local)
docker rmi lv-*:*

# Or specific
docker rmi lv-gateway:latest
docker rmi haongo123/lv-gateway:v1.0.0
```

**LƯU Ý:** Images vẫn an toàn trên Docker Hub, chỉ xóa local.

---

## ��� Full Workflow Example

**Scenario: Deploy v1.0.0 mới**

```bash
# 1. Build all images
cd backend-luan-van
export DOCKER_USERNAME=haongo123
export VERSION=v1.0.0
./scripts/build-all-images.sh

# 2. Push to Docker Hub
./scripts/push-all-images.sh

# 3. Verify on Docker Hub
# Visit: https://hub.docker.com/r/haongo123

# 4. Deploy on host
ssh user@app-host
cd deploys
export DOCKER_USERNAME=haongo123
export VERSION=v1.0.0
./deploy.sh gateway
```

---

## ��� Docker Hub Dashboard

### Access

URL: https://hub.docker.com/dashboard

**Shows:**

- ��� Repositories (8 repositories: lv-gateway, lv-user-app, etc.)
- ��� Pull counts (bao nhiêu lần mọi người pull)
- ���️ Tags (v1.0.0, latest, etc.)
- ��� Description
- ⭐ Stars

### Image Details

Click vào 1 image (e.g., lv-gateway):

**Shows:**

- ��� Size: ~120MB
- ��� Last pushed: 2024-11-13
- ���️ Tags: v1.0.0, latest
- ��� Dockerfile content (nếu public)
- ��� Pull command:
  ```bash
  docker pull haongo123/lv-gateway:v1.0.0
  ```

---

## ��� Security Best Practices

### 1. Token Management

**DO:**

- Dùng Access Token (NOT password)
- Rotate token hàng 3-6 tháng
- Tạo token cho từng CI/CD pipeline
- Revoke old tokens

❌ **DON'T:**

- Push password lên Git
- Share token công khai
- Dùng token cá nhân cho công việc

### 2. Image Visibility

**Public (mặc định):**

```
Ai cũng có thể: docker pull haongo123/lv-gateway
```

**Private (nếu cần):**

1. Docker Hub → Repositories → Settings
2. Repository visibility → Private
3. Invite members để access

### 3. Clean Up Unused Tokens

```
Docker Hub → Account Settings → Security
→ Personal Access Tokens
→ Delete unused tokens
```

---

## ��� Troubleshooting

### Error: "permission denied"

```
Error response from daemon: push access denied for haongo123/lv-gateway
```

**Fix:**

1. Check login: `docker logout && docker login`
2. Nhập đúng username: **haongo123**
3. Nhập đúng token (không phải password account)
4. Token phải có "Read & Write" permission

### Error: "unauthorized"

```
Error: 401 Unauthorized
```

**Fix:**

1. Check token còn hiệu lực
2. Generate token mới nếu cần
3. Login lại: `docker login`

### Error: "manifest not found"

```
Error: manifest for haongo123/lv-gateway:latest not found
```

**Fix:**

1. Build image trước: `./scripts/build-all-images.sh`
2. Push image: `./scripts/push-all-images.sh`
3. Check tag đúng: `docker images | grep lv-`

### Slow Upload

```
Pushing takes forever...
```

**Fix:**

- Check internet: `speedtest-cli` hoặc speedtest.net
- Try từng image: `docker push haongo123/lv-gateway:v1.0.0`
- Compress image (nếu cần): Trong Dockerfile
- Push lúc traffic thấp (đêm)

### Login Error

```
Error: credential not found
```

**Fix:**

```bash
# Clear credentials
docker logout

# Login lại
docker login
# Username: haongo123
# Password: dckr_pat_xxxxx (token)
```

---

## ��� Checklist

**Before Push:**

- [ ] Account Docker Hub created (haongo123)
- [ ] Access Token generated
- [ ] Token saved safely
- [ ] Local login successful: `docker login`
- [ ] Images built: `./scripts/build-all-images.sh`
- [ ] Images tagged correctly

**During Push:**

- [ ] Running: `./scripts/push-all-images.sh`
- [ ] Monitoring upload progress
- [ ] No errors in logs

**After Push:**

- [ ] Check Docker Hub dashboard
- [ ] Verify 8 images pushed
- [ ] Check tags: v1.0.0, latest
- [ ] Verify sizes: ~100-150MB each
- [ ] Test pull: `docker pull haongo123/lv-gateway:v1.0.0`

---

## ��� Tips & Tricks

### Faster Builds with Cache

```bash
# Push with cache (cần Docker 20.10+)
docker buildx build \
  --cache-from type=registry,ref=haongo123/lv-gateway:buildcache \
  -t haongo123/lv-gateway:v1.0.0 \
  -f Dockerfile.gateway \
  --push .
```

Already configured in scripts!

### Multi-platform Builds

```bash
# Build for ARM64 + AMD64 (cho M1 Mac + Linux)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t haongo123/lv-gateway:v1.0.0 \
  -f Dockerfile.gateway \
  --push .
```

### Automated Push (GitHub Actions)

Already configured! File: `.github/workflows/docker-push.yml`

Just push to main:

```bash
git push origin main
# → Auto builds & pushes
```

---

## ��� References

- **Docker Hub:** https://hub.docker.com
- **Docker Docs:** https://docs.docker.com/docker-hub/
- **Access Tokens:** https://docs.docker.com/security/for-developers/access-tokens/
- **Image Pushing:** https://docs.docker.com/docker-hub/repos/

---

## ✨ Summary

```
Step 1: Create Docker Hub account (haongo123)
Step 2: Generate Access Token
Step 3: docker login (username + token)
Step 4: ./scripts/build-all-images.sh
Step 5: ./scripts/push-all-images.sh
Step 6: Verify on Docker Hub
Step 7: Ready to deploy!
```

**Time:** ~30 minutes (đợi build & upload)

---

**Updated:** 2024-11-13
**Version:** Latest
**Status:** Ready to Use
