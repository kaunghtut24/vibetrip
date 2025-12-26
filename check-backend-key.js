// Check what API key the backend is seeing
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

console.log('=== Backend Environment Check ===');
console.log('API Key present:', Boolean(apiKey));
console.log('API Key length:', apiKey?.length || 0);
console.log('API Key prefix:', apiKey?.substring(0, 10) + '...');
console.log('API Key suffix:', '...' + apiKey?.substring(apiKey.length - 6));
console.log('\nPORT:', process.env.PORT || '(not set, will use default)');
console.log('GOOGLE_MAPS_API_KEY present:', Boolean(process.env.GOOGLE_MAPS_API_KEY));

