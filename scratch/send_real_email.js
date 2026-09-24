import fs from 'fs';
import path from 'path';

async function sendRealTestEmail() {
  console.log('🚀 Triggering live real email delivery via Resend API...');
  const BASE_URL = 'http://localhost:5000';

  const formData = new FormData();
  formData.append('recipientEmails', JSON.stringify(['krishnasahu1702@gmail.com']));
  formData.append('senderEmail', 'admin@aerodrop.io');
  formData.append('subject', 'AeroDrop Project Deliverables & Design Tokens (Test Transfer)');
  formData.append('description', 'Hi Krishna,\n\nYour file transfer has been packaged and is ready for download via AeroDrop.\nAll files have been encrypted and scanned for security.');
  formData.append('expiryDays', '7');

  // Attach sample files
  const file1 = new Blob(['AeroDrop Brand Assets & Guidelines v1.0\nHigh-res SVG vectors and style tokens.'], { type: 'text/plain' });
  const file2 = new Blob(['Sprint Roadmap & Milestone Q3/Q4\nRelease candidate deployment notes.'], { type: 'text/plain' });

  formData.append('files', file1, 'AeroDrop_Brand_Assets.txt');
  formData.append('files', file2, 'Sprint_Milestones_Q3.txt');
  formData.append('relativePaths', JSON.stringify(['AeroDrop_Brand_Assets.txt', 'Sprint_Milestones_Q3.txt']));

  console.log('Sending POST /api/upload with real files to krishnasahu1702@gmail.com...');
  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  console.log('Response Status:', res.status);
  console.log('Response Body:', JSON.stringify(data, null, 2));

  if (res.ok) {
    console.log('\n🎉 SUCCESS! Real email was dispatched to krishnasahu1702@gmail.com via Resend!');
    console.log('Transfer Download Link:', data.transfer.downloadUrl);
  } else {
    console.error('\n❌ FAILURE! Provider returned error:', data);
  }
}

sendRealTestEmail().catch(console.error);
