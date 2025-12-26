// Quick test to verify Gemini API key works
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

console.log('=== Testing Gemini API Key ===');
console.log('1. API Key present:', Boolean(apiKey));
console.log('2. API Key length:', apiKey?.length || 0);
console.log('3. API Key prefix:', apiKey?.substring(0, 10) + '...');

if (!apiKey) {
  console.error('❌ No API key found in .env file');
  process.exit(1);
}

try {
  console.log('\n4. Creating GoogleGenAI client...');
  const client = new GoogleGenAI({ apiKey });
  console.log('✓ Client created');

  console.log('\n5. Testing API call with simple prompt...');
  const result = await client.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Say "Hello" if you can read this.' }]
      }
    ]
  });

  console.log('✓ API call successful!');
  console.log('6. Response:', result.text);
  console.log('\n✅ API KEY IS WORKING!\n');
  process.exit(0);

} catch (error) {
  console.error('\n❌ API call failed:');
  console.error('Error:', error.message);
  
  if (error.status === 403) {
    console.error('\n🔴 This API key has been reported as LEAKED and is disabled.');
    console.error('🔴 You MUST create a new API key at: https://aistudio.google.com/apikey');
  } else if (error.status === 400) {
    console.error('\n⚠️  Invalid model or request format');
  } else if (error.status === 429) {
    console.error('\n⚠️  Rate limit exceeded');
  }
  
  console.error('\nFull error details:', JSON.stringify(error, null, 2));
  process.exit(1);
}

