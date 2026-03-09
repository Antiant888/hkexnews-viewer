# HKEX News Viewer

A web application for viewing and searching Hong Kong Exchange (HKEX) news and announcements.

## Features

- **Real-time News Fetching**: Automatically fetches latest news from HKEX APIs
- **Search & Filter**: Search through news content and filter by stock codes
- **Presets**: Pre-configured filters for different types of announcements
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
hkexnews-viewer/
├── server.js              # Express server
├── package.json           # Node.js dependencies
├── config/
│   ├── sources.json       # HKEX API endpoints
│   └── filters.json       # Preset filters
├── data/
│   └── all-news.json      # Local news storage
├── public/
│   ├── index.html         # Main HTML page
│   ├── app.js            # Frontend JavaScript
│   └── styles.css        # CSS styles
├── lib/
│   └── store.js          # Data fetching and storage logic
├── scripts/
│   └── fetch.js          # Manual fetch script
├── Dockerfile            # Docker configuration
├── railway.json          # Railway deployment config
└── .gitignore            # Git ignore rules
```

## Local Development

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd hkexnews-viewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Fetching News

To fetch the latest news from HKEX APIs:

```bash
npm run fetch
```

Or use the "Fetch latest" button in the web interface.

### Automatic News Fetching

The application includes an automatic scheduler that fetches new news:

- **Every 4 hours**: Regular news updates
- **Daily at 2 AM**: Full refresh of all news sources
- **Timezone**: Asia/Hong_Kong

The scheduler runs automatically in production and logs its activities.

## Deployment

This application is configured for deployment on Railway with GitHub integration.

### Requirements

- GitHub account
- Railway account (free tier)

### Deployment Steps

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app)
   - Sign in with your GitHub account
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Railway will automatically detect the Node.js app and deploy it

3. **Configure Persistent Storage**:
   - In Railway dashboard, go to your project
   - Add a "PostgreSQL" or "Redis" service for persistent storage
   - Or use Railway's built-in persistent volumes

4. **Access Your App**:
   - Railway will provide a URL like `https://your-app.up.railway.app`
   - Your app will be live and accessible to the public

### Environment Variables

The application uses the following environment variables (automatically set by Railway):

- `PORT`: Port number (set by Railway)
- `NODE_ENV`: Environment (production)

### Data Persistence

The application now uses PostgreSQL for storing news data. For production deployment on Railway:

- In the Railway dashboard, add a PostgreSQL service to your project.
- Railway will automatically set the `DATABASE_URL` environment variable.
- Data will persist across deployments in the database.
- Initial fetch may take a few minutes to populate the database.

For local development, set up a local PostgreSQL database and set `DATABASE_URL` in your environment (e.g., `postgres://user:pass@localhost:5432/dbname`).

## API Endpoints

### GET /api/news

Retrieve news items with optional filtering.

**Query Parameters:**
- `q`: Search query (searches title, content, and summary)
- `preset`: Preset filter name

**Example:**
```
GET /api/news?q=earnings
GET /api/news?preset=quarterly-reports
```

### POST /api/fetch

Trigger manual news fetching.

**Body:**
```json
{
  "url": "https://example.com/api/news"
}
```

## Configuration

### Sources Configuration (`config/sources.json`)

Configure which HKEX APIs to fetch from:

```json
[
  {
    "name": "MainBoard",
    "baseUrl": "https://www1.hkexnews.hk/ncms/json/eds/lcisehk7relsdc",
    "dynamic": true
  }
]
```

### Filters Configuration (`config/filters.json`)

Create preset filters for common searches:

```json
[
  {
    "name": "Quarterly Reports",
    "keywords": ["quarterly", "Q1", "Q2", "Q3", "Q4", "earnings"]
  }
]
```

## Monitoring

After deployment:

1. **Health Checks**: The app includes basic health monitoring
2. **Logs**: View logs in Railway dashboard
3. **Performance**: Monitor response times and resource usage

## Troubleshooting

### Common Issues

1. **News not updating**: Check if fetch is working in Railway logs
2. **Slow loading**: Initial fetch may take time to populate database
3. **API errors**: HKEX APIs may have rate limits or temporary outages

### Debugging

1. Check Railway logs for error messages
2. Verify HKEX API endpoints are accessible
3. Ensure sufficient storage space for news data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues and questions:
- Create a GitHub issue
- Check the Railway documentation for deployment questions
- Review HKEX API documentation for data-related questions