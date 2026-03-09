const cron = require('node-cron');
const fetch = require('node-fetch');

console.log('⏰ Scheduler module loaded');

// Function to get the correct base URL for different environments
function getBaseUrl() {
  // Check if running in Railway environment
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`;
  }
  // Check if running in Railway with different env var
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  // Default to localhost for local development
  return 'http://localhost:3000';
}

// Schedule automatic news fetching every 4 hours
// This will run at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
cron.schedule('0 */4 * * *', async () => {
  const baseUrl = getBaseUrl();
  console.log('🔄 Starting scheduled news fetch at', new Date().toISOString());
  console.log('📡 Using base URL:', baseUrl);
  
  try {
    const response = await fetch(`${baseUrl}/api/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Scheduled fetch completed successfully');
      console.log('📊 Fetch results:', JSON.stringify(result.results, null, 2));
      
      // Update last auto fetch time
      try {
        await fetch(`${baseUrl}/api/update-last-fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ timestamp: new Date().toISOString() })
        });
        console.log('✅ Last fetch time updated successfully');
      } catch (updateError) {
        console.warn('⚠️  Failed to update last fetch time:', updateError.message);
      }
    } else {
      console.error('❌ Scheduled fetch failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error during scheduled fetch:', error.message);
  }
}, {
  scheduled: true,
  timezone: "Asia/Hong_Kong"
});

// Also schedule a daily full refresh at 1 PM Hong Kong time
cron.schedule('0 13 * * *', async () => {
  const baseUrl = getBaseUrl();
  console.log('🔄 Starting daily full refresh at', new Date().toISOString());
  console.log('📡 Using base URL:', baseUrl);
  
  try {
    const response = await fetch(`${baseUrl}/api/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Daily refresh completed successfully');
      console.log('📊 Daily refresh results:', JSON.stringify(result.results, null, 2));
      
      // Update last auto fetch time
      try {
        await fetch(`${baseUrl}/api/update-last-fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ timestamp: new Date().toISOString() })
        });
        console.log('✅ Last fetch time updated successfully');
      } catch (updateError) {
        console.warn('⚠️  Failed to update last fetch time:', updateError.message);
      }
    } else {
      console.error('❌ Daily refresh failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error during daily refresh:', error.message);
  }
}, {
  scheduled: true,
  timezone: "Asia/Hong_Kong"
});

// Test endpoint to manually trigger last fetch time update
cron.schedule('*/5 * * * *', async () => {
  const baseUrl = getBaseUrl();
  console.log('🧪 Testing last fetch time update at', new Date().toISOString());
  console.log('📡 Using base URL:', baseUrl);
  
  try {
    const response = await fetch(`${baseUrl}/api/test-update-last-fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      console.log('✅ Test update completed successfully');
    } else {
      console.error('❌ Test update failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error during test update:', error.message);
  }
}, {
  scheduled: true,
  timezone: "Asia/Hong_Kong"
});

console.log('⏰ News scheduler started');
console.log('📅 Schedule:');
console.log('   - Every 4 hours: Regular news fetch');
console.log('   - Daily at 1 PM: Full refresh');
console.log('   - Every 5 minutes: Test last fetch time update');
console.log('   - Timezone: Asia/Hong_Kong');
console.log('🌐 Environment detection:');
console.log('   - Railway Static URL:', process.env.RAILWAY_STATIC_URL || 'Not set');
console.log('   - Railway Public Domain:', process.env.RAILWAY_PUBLIC_DOMAIN || 'Not set');
console.log('   - Default Base URL: http://localhost:3000');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('🛑 Scheduler stopped');
  process.exit(0);
});
