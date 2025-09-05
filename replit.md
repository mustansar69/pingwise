# Overview

Ping Wise is a real-time network monitoring dashboard that provides comprehensive insights into network performance. The application continuously monitors network metrics like ping times, download/upload speeds, jitter, and packet loss, presenting them through an intuitive web interface with real-time updates and historical data visualization.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Vanilla HTML/CSS/JavaScript with Tailwind CSS for styling
- **Real-time Communication**: Socket.IO client for live data updates
- **Visualization**: ECharts library for interactive charts and graphs
- **Theme**: Custom maroon-themed UI with glassmorphism design elements
- **Responsive Design**: Mobile-first approach using Tailwind's responsive utilities

## Backend Architecture
- **Framework**: Flask web framework with Python
- **Real-time Engine**: Flask-SocketIO for WebSocket connections
- **Threading**: Asynchronous background monitoring using Python threading
- **Data Storage**: In-memory data structures with deques for time-series data
- **Monitoring Pattern**: Singleton pattern for NetworkMonitor class to ensure single instance

## Data Management
- **Current Data**: Real-time metrics stored in dictionary format
- **Historical Data**: Time-series data stored in collections.deque with different retention periods:
  - 1-minute data: 24 hours (1440 points)
  - 5-minute data: 24 hours (288 points)  
  - 1-hour data: 7 days (168 points)
  - 24-hour data: 30 days (30 points)

## API Design
- **RESTful Endpoints**: JSON API for network status and historical data
- **WebSocket Events**: Real-time data broadcasting to connected clients
- **Error Handling**: Comprehensive exception handling with logging

## Network Monitoring
- **Simulated Metrics**: Currently uses simulated network data for demonstration
- **Extensible Design**: Architecture ready for integration with actual network monitoring tools
- **Background Processing**: Continuous monitoring thread that doesn't block the main application

# External Dependencies

## Core Framework Dependencies
- **Flask**: Web application framework
- **Flask-SocketIO**: WebSocket support for real-time communication
- **Werkzeug**: WSGI utilities including ProxyFix middleware

## Frontend Libraries
- **Tailwind CSS**: Utility-first CSS framework via CDN
- **ECharts**: Data visualization library via CDN
- **Socket.IO**: Client-side WebSocket library via CDN
- **Google Fonts**: Inter font family for typography

## Development Tools
- **Python Logging**: Built-in logging for debugging and monitoring
- **Threading**: Python's threading module for background tasks

## Production Considerations
- **Session Management**: Flask sessions with configurable secret key
- **CORS**: Configured for cross-origin requests
- **Proxy Support**: ProxyFix middleware for deployment behind reverse proxies
- **Environment Variables**: Support for production configuration via environment variables