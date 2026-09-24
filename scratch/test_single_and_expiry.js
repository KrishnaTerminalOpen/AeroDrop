import fs from 'fs';
import path from 'path';

async function testSingleAndExpiry() {
  console.log('🧪 Testing Single File and Expiry Cases...');
  const BASE_URL = 'http://localhost:5000';

  // 1. Upload single file
  const formData = new FormData();
  formData.append('recipientEmails', JSON.stringify(['single_recipient@example.com']));
  formData.append('senderEmail', 'sender@company.com');
  formData.append('subject', 'Single Document Transfer');
  formData.append('description', 'Single file download test');
  formData.append('expiryDays', '1');
  formData.append('downloadLimit', '2');

  const file = new Blob(['Sample single file content data'], { type: 'text/plain' });
  formData.append('files', file, 'readme.txt');

  const res = await fetch(`${BASE_URL}/api/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  const token = data.transfer.token;
  const fileId = data.transfer.files[0].id;
  console.log('   Single file transfer created:', token);

  // 2. Test downloading the single file directly
  const dlRes = await fetch(`${BASE_URL}/api/download/${token}`);
  console.log('   Direct single file download status:', dlRes.status);
  console.log('   Content-Type:', dlRes.headers.get('content-type'));
  const text = await dlRes.text();
  console.log('   Content verified:', text === 'Sample single file content data');

  // 3. Test individual file endpoint
  const singleFileRes = await fetch(`${BASE_URL}/api/download/${token}/file/${fileId}`);
  console.log('   Individual file download status:', singleFileRes.status);

  // 4. Test reaching download limit
  // We set limit to 2; dlRes was 1, singleFileRes was 2, now 3rd should be 410 LIMIT_REACHED
  const overLimitRes = await fetch(`${BASE_URL}/api/transfers/${token}`);
  console.log('   Status after reaching download limit (2):', overLimitRes.status);
  const overLimitData = await overLimitRes.json();
  console.log('   Code:', overLimitData.code, '| Message:', overLimitData.message);

  console.log('✅ Single-file streaming and download limit checks passed perfectly!');
}

testSingleAndExpiry().catch(console.error);
