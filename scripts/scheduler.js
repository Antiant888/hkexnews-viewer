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

// Schedule automatic news fetching every hour from 4 PM to 10 AM (overnight and early morning)
// 4 PM to 11 PM: every hour
cron.schedule('0 16-23 * * *', async () => {
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

// 12 AM to 10 AM: every hour
cron.schedule('0 0-10 * * *', async () => {
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

// Exception: Fetch at 12:30 PM
cron.schedule('30 12 * * *', async () => {
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

// Exception: Fetch at 1:00 PM (replaces daily full refresh)
cron.schedule('0 13 * * *', async () => {
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
console.log('📅 New Schedule:');
console.log('   - 4 PM to 11 PM: Every hour (16:00, 17:00, 18:00, 19:00, 20:00, 21:00, 22:00, 23:00)');
console.log('   - 12 AM to 10 AM: Every hour (00:00, 01:00, 02:00, 03:00, 04:00, 05:00, 06:00, 07:00, 08:00, 09:00, 10:00)');
console.log('   - 12:30 PM: Exception fetch');
console.log('   - 1:00 PM: Exception fetch (replaces daily full refresh)');
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
