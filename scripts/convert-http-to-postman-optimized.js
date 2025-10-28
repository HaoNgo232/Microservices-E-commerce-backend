/**
 * Convert tất cả file .http thành 1 Postman Collection tối ưu
 * - Setup chung (register/login) ở đầu
 * - Mỗi service là 1 folder riêng
 * Usage: node scripts/convert-http-to-postman-optimized.js
 */

const fs = require('fs');
const path = require('path');

const httpDir = path.join(__dirname, '..', 'http');
const outputPath = path.join(__dirname, '..', 'postman', 'E-Commerce-API.postman_collection.json');

/**
 * Parse file .http thành các requests
 */
function parseHttpFile(content) {
  const requests = [];
  const lines = content.split('\n');

  let currentRequest = null;
  let currentBody = [];
  let isBody = false;
  let requestDescription = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Lưu comment trước request làm description
    if (line.trim().startsWith('#') && !line.trim().startsWith('###')) {
      requestDescription += line.replace(/^#\s*/, '').trim() + ' ';
      continue;
    }

    // Separator giữa các requests
    if (line.trim() === '###') {
      // Lưu request hiện tại nếu có
      if (currentRequest) {
        if (currentBody.length > 0) {
          currentRequest.body = currentBody.join('\n').trim();
        }
        if (requestDescription.trim()) {
          currentRequest.description = requestDescription.trim();
        }
        requests.push(currentRequest);
        currentRequest = null;
        currentBody = [];
        isBody = false;
        requestDescription = '';
      }
      continue;
    }

    // Bỏ qua dòng biến (@name, @variable)
    if (line.trim().startsWith('@')) {
      continue;
    }

    // Parse HTTP method và URL
    const methodMatch = line.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)/);
    if (methodMatch) {
      // Lưu request trước đó nếu có
      if (currentRequest) {
        if (currentBody.length > 0) {
          currentRequest.body = currentBody.join('\n').trim();
        }
        if (requestDescription.trim()) {
          currentRequest.description = requestDescription.trim();
        }
        requests.push(currentRequest);
        currentBody = [];
        requestDescription = '';
      }

      const method = methodMatch[1];
      const url = methodMatch[2].trim();

      currentRequest = {
        method: method,
        url: url,
        headers: {},
        body: '',
        description: '',
      };
      isBody = false;
      continue;
    }

    // Parse headers (Key: Value)
    if (currentRequest && !isBody && line.includes(':') && !line.trim().startsWith('{')) {
      const headerMatch = line.match(/^([^:]+):\s*(.+)/);
      if (headerMatch) {
        const headerName = headerMatch[1].trim();
        const headerValue = headerMatch[2].trim();
        currentRequest.headers[headerName] = headerValue;
        continue;
      }
    }

    // Empty line sau headers = bắt đầu body
    if (currentRequest && line.trim() === '' && Object.keys(currentRequest.headers).length > 0) {
      isBody = true;
      continue;
    }

    // Parse body
    if (currentRequest && isBody && line.trim() !== '') {
      currentBody.push(line);
    }
  }

  // Lưu request cuối cùng
  if (currentRequest) {
    if (currentBody.length > 0) {
      currentRequest.body = currentBody.join('\n').trim();
    }
    if (requestDescription.trim()) {
      currentRequest.description = requestDescription.trim();
    }
    requests.push(currentRequest);
  }

  return requests;
}

/**
 * Tạo Postman request item
 */
function createPostmanItem(req, name) {
  const item = {
    name: name,
    request: {
      method: req.method,
      header: [],
      url: {
        raw: req.url,
        protocol: req.url.split('://')[0],
        host: req.url.split('://')[1]?.split('/')[0].split(':').map(h => h.replace(/{{|}}/g, '')),
        path: req.url.split('://')[1]?.split('/').slice(1).map(p => p.replace(/\?.*/, '')) || [],
      },
    },
  };

  // Thêm description nếu có
  if (req.description) {
    item.request.description = req.description;
  }

  // Thêm query params nếu có
  if (req.url.includes('?')) {
    const queryString = req.url.split('?')[1];
    const params = queryString.split('&').map(p => {
      const [key, value] = p.split('=');
      return { key, value: value || '', disabled: false };
    });
    item.request.url.query = params;
  }

  // Thêm headers
  for (const [key, value] of Object.entries(req.headers)) {
    item.request.header.push({
      key: key,
      value: value,
      type: 'text',
    });
  }

  // Thêm body nếu có
  if (req.body) {
    item.request.body = {
      mode: 'raw',
      raw: req.body,
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  }

  return item;
}

/**
 * Xác định loại request
 */
function categorizeRequest(req, filename) {
  const url = req.url.toLowerCase();
  const method = req.method;

  // Setup requests (register, login, me)
  if (url.includes('/auth/register') || url.includes('/auth/login') || url.includes('/auth/me')) {
    return { category: 'setup', priority: 1 };
  }

  // Tạo product (dùng trong setup)
  if (method === 'POST' && url.includes('/products') && !url.includes('slug')) {
    return { category: 'setup-product', priority: 2 };
  }

  // Tạo address (dùng trong setup)
  if (method === 'POST' && url.includes('/addresses')) {
    return { category: 'setup-address', priority: 3 };
  }

  // Main requests của từng service
  return { category: 'main', priority: 10 };
}

/**
 * Main function
 */
function main() {
  const collection = {
    info: {
      name: 'E-Commerce Microservices API',
      description: 'Tất cả API endpoints cho hệ thống E-Commerce (NestJS + NATS)',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000',
        type: 'string',
      },
      {
        key: 'userEmail',
        value: 'test@example.com',
        type: 'string',
      },
      {
        key: 'userPassword',
        value: 'Test@123456',
        type: 'string',
      },
      {
        key: 'token',
        value: '',
        type: 'string',
      },
      {
        key: 'userId',
        value: '',
        type: 'string',
      },
      {
        key: 'productId',
        value: '',
        type: 'string',
      },
      {
        key: 'addressId',
        value: '',
        type: 'string',
      },
      {
        key: 'orderId',
        value: '',
        type: 'string',
      },
    ],
    event: [
      {
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: [
            '// Auto-generate unique email for testing',
            'if (!pm.environment.get("userEmail") || pm.environment.get("userEmail") === "test@example.com") {',
            '    const timestamp = Date.now();',
            '    pm.collectionVariables.set("userEmail", `test-${timestamp}@example.com`);',
            '}',
          ],
        },
      },
    ],
  };

  // Folder Setup (chung cho tất cả)
  const setupFolder = {
    name: '🔧 Setup (Run First)',
    description: 'Chạy theo thứ tự để khởi tạo user, token, và dữ liệu cần thiết',
    item: [],
  };

  // Parse user-app.http để lấy setup requests
  const userAppPath = path.join(httpDir, 'user-app.http');
  const userRequests = parseHttpFile(fs.readFileSync(userAppPath, 'utf-8'));

  userRequests.forEach((req, idx) => {
    const { category } = categorizeRequest(req, 'user-app.http');
    if (category === 'setup') {
      let name = `${req.method} ${req.url.split('/').pop().split('?')[0]}`;
      if (req.url.includes('/register')) name = '1. Register User';
      if (req.url.includes('/login')) name = '2. Login & Get Token';
      if (req.url.includes('/me')) name = '3. Get User Info';

      const item = createPostmanItem(req, name);

      // Thêm test script để lưu token và userId
      if (req.url.includes('/login')) {
        item.event = [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'if (pm.response.code === 200) {',
                '    const response = pm.response.json();',
                '    pm.collectionVariables.set("token", response.accessToken);',
                '    console.log("✅ Token saved:", response.accessToken.substring(0, 20) + "...");',
                '}',
              ],
            },
          },
        ];
      }

      if (req.url.includes('/me')) {
        item.event = [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'if (pm.response.code === 200) {',
                '    const response = pm.response.json();',
                '    pm.collectionVariables.set("userId", response.id);',
                '    console.log("✅ User ID saved:", response.id);',
                '}',
              ],
            },
          },
        ];
      }

      setupFolder.item.push(item);
    }
  });

  collection.item.push(setupFolder);

  // Đọc từng file và tạo folder cho mỗi service
  const serviceFiles = [
    { file: 'user-app.http', name: '👤 Users & Addresses', icon: '👤' },
    { file: 'product-app.http', name: '📦 Products & Categories', icon: '📦' },
    { file: 'cart-app.http', name: '🛒 Cart', icon: '🛒' },
    { file: 'order-app.http', name: '📋 Orders', icon: '📋' },
    { file: 'payment-app.http', name: '💳 Payments', icon: '💳' },
    { file: 'ar-app.http', name: '📸 AR Snapshots', icon: '📸' },
    { file: 'report-app.http', name: '📊 Reports', icon: '📊' },
  ];

  serviceFiles.forEach(({ file, name, icon }) => {
    const filePath = path.join(httpDir, file);
    if (!fs.existsSync(filePath)) return;

    const requests = parseHttpFile(fs.readFileSync(filePath, 'utf-8'));
    const serviceFolder = {
      name: name,
      item: [],
    };

    requests.forEach((req, idx) => {
      const { category } = categorizeRequest(req, file);

      // Bỏ qua setup requests (đã có trong Setup folder)
      if (category === 'setup') return;

      // Đặt tên request rõ ràng
      let requestName = `${req.method} ${req.url.split('/').filter(p => p && !p.includes('http')).join('/')}`;
      requestName = requestName.replace(/{{.*?}}/g, ':id').substring(0, 60);

      const item = createPostmanItem(req, requestName);

      // Thêm test script để auto-save IDs
      const testScripts = [];

      if (req.method === 'POST') {
        if (req.url.includes('/products')) {
          testScripts.push(
            'if (pm.response.code === 200 || pm.response.code === 201) {',
            '    const response = pm.response.json();',
            '    if (response.id) pm.collectionVariables.set("productId", response.id);',
            '}',
          );
        }
        if (req.url.includes('/addresses')) {
          testScripts.push(
            'if (pm.response.code === 200 || pm.response.code === 201) {',
            '    const response = pm.response.json();',
            '    if (response.id) pm.collectionVariables.set("addressId", response.id);',
            '}',
          );
        }
        if (req.url.includes('/orders')) {
          testScripts.push(
            'if (pm.response.code === 200 || pm.response.code === 201) {',
            '    const response = pm.response.json();',
            '    if (response.id) pm.collectionVariables.set("orderId", response.id);',
            '}',
          );
        }
      }

      if (testScripts.length > 0) {
        item.event = [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: testScripts,
            },
          },
        ];
      }

      serviceFolder.item.push(item);
    });

    if (serviceFolder.item.length > 0) {
      collection.item.push(serviceFolder);
    }
  });

  // Ghi file
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));

  console.log('✅ Đã tạo Postman Collection tối ưu!');
  console.log('');
  console.log(`📁 File: ${outputPath}`);
  console.log(`📊 Tổng số folders: ${collection.item.length}`);
  console.log(`📝 Tổng số requests: ${collection.item.reduce((sum, folder) => sum + (folder.item?.length || 0), 0)}`);
  console.log('');
  console.log('📋 Hướng dẫn:');
  console.log('   1. Import file vào Postman (Import → Upload Files)');
  console.log('   2. Chạy folder "🔧 Setup" trước (theo thứ tự 1→2→3)');
  console.log('   3. Token và IDs sẽ tự động lưu vào Collection Variables');
  console.log('   4. Test các endpoints khác bình thường');
  console.log('');
  console.log('💡 Tips:');
  console.log('   - Mỗi lần test với user mới, chạy lại folder Setup');
  console.log('   - Check Collection Variables để xem token, userId, productId...');
  console.log('   - Dùng {{baseUrl}} thay vì hardcode localhost:3000');
}

main();

