# Park Find - Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Technical Stack](#technical-stack)
5. [Project Structure](#project-structure)
6. [Core Components](#core-components)
7. [Services](#services)
8. [Database](#database)
9. [API Integration](#api-integration)
10. [User Interface](#user-interface)
11. [Configuration](#configuration)
12. [Development](#development)
13. [Deployment](#deployment)

## Overview

Park Find is a comprehensive parking management application built with React Native and Expo, designed to help users find available parking spots in Melbourne, Australia. The app provides real-time parking sensor data, favorites management, speech recognition search, and intelligent routing capabilities.

### Key Capabilities
- **Real-time Parking Data**: Live parking sensor information from Melbourne's open data API
- **Smart Search**: Text and voice search with intelligent filtering
- **Favorites Management**: Save and organize favorite parking spots with custom names
- **Interactive Mapping**: Web-based interactive map with parking spot visualization
- **Cross-platform**: Runs on iOS, Android, and Web
- **Offline Support**: Caching and local storage for improved performance
- **Accessibility**: Voice search and screen reader support

## Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Presentation  │    │    Business     │    │      Data       │
│     Layer       │◄──►│     Logic       │◄──►│     Layer       │
│                 │    │     Layer       │    │                 │
│ • React Native  │    │ • Services      │    │ • APIs          │
│ • Components    │    │ • Utilities     │    │ • IndexedDB     │
│ • Screens       │    │ • Hooks         │    │ • AsyncStorage  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Platform Support
- **iOS**: Native iOS app via Expo
- **Android**: Native Android app via Expo  
- **Web**: Progressive Web App with full functionality
- **Cross-platform**: Shared codebase with platform-specific optimizations

## Features

### 1. Real-time Parking Information
- **Live Data**: Real-time parking sensor status from Melbourne City Council
- **Status Indicators**: Clear visual indicators for available/occupied spots
- **Auto-refresh**: Automatic data updates every 2 minutes
- **Manual Refresh**: Pull-to-refresh and manual refresh buttons
- **Last Updated**: Timestamp showing when data was last refreshed

### 2. Advanced Search & Filtering
- **Text Search**: Search by street name, zone number, or location
- **Voice Search**: Speech-to-text search functionality (web only)
- **Smart Filters**:
  - Availability status (Available Right Now - default)
  - Parking type (All, Metered, Loading Zone, etc.)
  - Sign type restrictions
  - Time-based restrictions
- **Sorting Options**: Distance, availability, zone number, last updated

### 3. Favorites Management
- **Save Spots**: Add parking spots to favorites with custom names
- **Custom Naming**: Modal dialog for personalized spot names
- **Favorites Screen**: Dedicated screen showing all saved spots
- **Status Updates**: Real-time status updates for favorite spots
- **Bulk Management**: Clear all favorites option

### 4. Interactive Mapping
- **Web Map**: Full interactive map with parking spot markers (web only)
- **Split Layout**: List view alongside embedded map
- **Marker Clustering**: Efficient display of multiple parking spots
- **User Location**: GPS-based location services
- **Responsive Design**: Adapts to different screen sizes

### 5. Intelligent Distance Calculation
- **Routing Service**: Integration with OpenRouteService for accurate distances
- **Hybrid Calculation**: Smart switching between routing API and straight-line distance
- **Caching**: Route caching to minimize API calls
- **Fallback**: Graceful fallback to straight-line distance when routing unavailable

### 6. Data Persistence & Logging
- **Favorites Storage**: IndexedDB for web, AsyncStorage for mobile
- **Usage Logging**: Website access and GPS coordinate logging
- **Session Management**: User session tracking
- **Privacy-focused**: Local storage with optional analytics

## Technical Stack

### Frontend Framework
- **React Native**: 0.79.5 - Cross-platform mobile development
- **Expo**: ~53.0.20 - Development platform and build tools
- **TypeScript**: ~5.8.3 - Type safety and developer experience

### Navigation & Routing
- **Expo Router**: ~5.1.4 - File-based routing system
- **React Navigation**: Bottom tabs and stack navigation

### UI & Styling
- **React Native Elements**: Native UI components
- **Expo Vector Icons**: Icon library
- **Custom Styling**: Platform-specific styles with responsive design

### Location & Mapping
- **Expo Location**: GPS and location services
- **React Native Maps**: Native map components
- **Web Maps**: Custom HTML/JavaScript map implementation

### Storage & Database
- **IndexedDB**: Web browser database
- **AsyncStorage**: Mobile local storage
- **Custom Database Service**: Abstraction layer for cross-platform storage

### External APIs
- **Melbourne Open Data**: Parking sensor and restriction data
- **OpenRouteService**: Routing and distance calculations
- **IP Geolocation**: User location detection

### Development Tools
- **ESLint**: Code linting and formatting
- **Babel**: JavaScript compilation
- **Metro**: React Native bundler

## Project Structure

```
park-find/
├── app/                          # Expo Router app directory
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── parking-map.tsx       # Main parking map screen
│   │   ├── favourites.tsx        # Favorites management screen
│   │   └── _layout.tsx           # Tab layout configuration
│   ├── +not-found.tsx           # 404 error screen
│   ├── _layout.tsx              # Root layout
│   └── index.tsx                # App entry point
├── src/                         # Source code
│   ├── components/              # Reusable UI components
│   │   ├── favorites/           # Favorites-related components
│   │   │   └── FavoriteNameModal.tsx
│   │   ├── location/            # Location-related components
│   │   │   └── UserLocationDisplay.tsx
│   │   ├── map/                 # Map-related components
│   │   │   └── ParkingSensorsMap.tsx
│   │   ├── routing/             # Routing-related components
│   │   │   ├── RouteVisualization.tsx
│   │   │   └── RoutingSetupGuide.tsx
│   │   ├── parking/             # Parking-specific components
│   │   ├── search/              # Search-related components
│   │   ├── ui/                  # Generic UI components
│   │   └── common/              # Common shared components
│   ├── services/                # Business logic services
│   │   ├── api/                 # API integration
│   │   │   └── parkingSensorsApi.ts
│   │   ├── database/            # Data persistence
│   │   │   ├── favoritesService.ts
│   │   │   ├── loggingService.ts
│   │   │   └── webDatabaseService.ts
│   │   ├── routing/             # Distance & routing
│   │   │   └── routingService.ts
│   │   ├── location/            # Location services (empty)
│   │   ├── search/              # Search services (tests only)
│   │   └── storage/             # Storage services (empty)
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/                   # Utility functions
│   │   ├── distance.ts
│   │   └── hybridDistanceCalculator.ts
│   ├── config/                  # Configuration files
│   │   └── routing.ts
│   ├── hooks/                   # Custom React hooks
│   │   └── useWebsiteLogging.ts
│   ├── screens/                 # Screen components (empty directories)
│   │   ├── favorites/           # Favorites screen components
│   │   └── parking/             # Parking screen components
│   ├── contexts/                # React contexts (empty)
│   ├── stores/                  # State management stores (empty)
│   └── constants/               # App constants
├── components/                  # Expo default components
│   ├── Collapsible.tsx          # Collapsible UI component
│   ├── ExternalLink.tsx         # External link handler
│   ├── HelloWave.tsx            # Welcome animation component
│   ├── HapticTab.tsx            # Haptic feedback tab component
│   ├── ParallaxScrollView.tsx   # Parallax scroll component
│   ├── ThemedText.tsx           # Theme-aware text component
│   ├── ThemedView.tsx           # Theme-aware view component
│   └── ui/                      # UI-specific components
│       ├── IconSymbol.tsx       # Cross-platform icon component
│       ├── IconSymbol.ios.tsx   # iOS-specific icon implementation
│       ├── TabBarBackground.tsx # Tab bar background (web/Android)
│       └── TabBarBackground.ios.tsx # iOS tab bar background
├── constants/                   # Theme and color constants
│   └── Colors.ts                # Color scheme definitions
├── hooks/                       # Platform-specific hooks
│   ├── useColorScheme.ts        # Color scheme hook
│   ├── useColorScheme.web.ts    # Web-specific color scheme
│   └── useThemeColor.ts         # Theme color utility hook
├── assets/                      # Static assets
│   ├── fonts/                   # Custom fonts
│   └── images/                  # Images and icons
├── dist/                        # Built web application
├── docs/                        # Documentation
└── app.json                     # Expo configuration
```

## Core Components

### 1. ParkingSensorsMap
**Location**: `src/components/map/ParkingSensorsMap.tsx`

The main component that orchestrates the entire parking experience.

**Key Features**:
- Real-time data fetching and display
- Search and filtering functionality
- Speech recognition integration
- Favorites management
- Responsive layout (split-screen on wide screens)
- Interactive map embedding (web only)

**Props**:
```typescript
interface ParkingSensorsMapProps {
  initialRegion?: Region;
  showUserLocation?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}
```

**State Management**:
- Parking sensor markers
- User location and permissions
- Search query and filters
- Loading and error states
- Favorites tracking
- Speech recognition status

### 2. FavoriteNameModal
**Location**: `src/components/favorites/FavoriteNameModal.tsx`

Modal component for customizing favorite parking spot names.

**Features**:
- Custom name input with validation
- Default name option
- Location display
- Responsive design
- Accessibility support

**Props**:
```typescript
interface FavoriteNameModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (customName: string) => void;
  defaultName: string;
  streetAddress: string;
}
```

### 3. UserLocationDisplay
**Location**: `src/components/location/UserLocationDisplay.tsx`

Handles user location detection and display with permission management.

**Features**:
- GPS location detection with high accuracy
- Permission request handling
- Location refresh functionality
- Error handling and retry mechanisms
- Formatted coordinate display with accuracy

**Props**:
```typescript
interface UserLocationDisplayProps {
  onLocationUpdate?: (location: Location.LocationObject | null) => void;
  showRefreshButton?: boolean;
}
```

**States**:
- Location permission status
- Current user location
- Loading and error states
- Location accuracy information

### 4. RouteVisualization
**Location**: `src/components/routing/RouteVisualization.tsx`

Displays driving routes with distance and duration information.

**Features**:
- Route calculation using hybrid distance calculator
- Turn-by-turn directions display
- Route summary with metrics
- Expandable directions list
- Error handling for routing failures

**Props**:
```typescript
interface RouteVisualizationProps {
  from: Coordinate;
  to: Coordinate;
  onRouteCalculated?: (route: RouteInfo) => void;
  showDirections?: boolean;
}
```

### 5. RoutingSetupGuide
**Location**: `src/components/routing/RoutingSetupGuide.tsx`

Guides users through OpenRouteService API key setup for enhanced routing.

**Features**:
- Step-by-step setup instructions
- API key testing functionality
- Direct link to OpenRouteService signup
- Configuration validation
- Setup completion handling

**Props**:
```typescript
interface RoutingSetupGuideProps {
  onSetupComplete?: () => void;
  onClose?: () => void;
}
```

### 6. Expo Default Components

#### ThemedText & ThemedView
**Locations**: `components/ThemedText.tsx`, `components/ThemedView.tsx`

Theme-aware components that automatically adapt to light/dark mode.

**ThemedText Types**:
- `default`: Standard text styling
- `title`: Large title text
- `defaultSemiBold`: Semi-bold default text
- `subtitle`: Subtitle styling
- `link`: Link-styled text

#### IconSymbol
**Locations**: `components/ui/IconSymbol.tsx`, `components/ui/IconSymbol.ios.tsx`

Cross-platform icon component using SF Symbols on iOS and Material Icons elsewhere.

**Features**:
- Platform-specific icon rendering
- Consistent icon mapping across platforms
- Size and color customization
- Accessibility support

#### ExternalLink
**Location**: `components/ExternalLink.tsx`

Handles external links with platform-appropriate behavior.

**Features**:
- In-app browser on mobile
- New tab opening on web
- Consistent link handling across platforms

#### Collapsible
**Location**: `components/Collapsible.tsx`

Expandable/collapsible content container with smooth animations.

#### HapticTab
**Location**: `components/HapticTab.tsx`

Tab component with haptic feedback on supported platforms.

#### TabBarBackground
**Locations**: `components/ui/TabBarBackground.tsx`, `components/ui/TabBarBackground.ios.tsx`

Platform-specific tab bar background implementations:
- iOS: Blur effect with system chrome material
- Web/Android: Opaque background

## Services

### 1. Parking Sensors API Service
**Location**: `src/services/api/parkingSensorsApi.ts`

Handles all interactions with Melbourne's parking data APIs.

**Key Methods**:
- `fetchParkingSensors()`: Get parking sensor data with pagination
- `fetchMultiplePages()`: Batch fetch for large datasets
- `getAvailableParkingSpots()`: Filter for unoccupied spots only
- `convertToEnhancedMarkers()`: Transform API data to app format
- `fetchSignPlatesData()`: Get parking restriction information

**Data Sources**:
- On-street parking bay sensors
- Sign plates and parking restrictions
- Street segment information

### 2. Favorites Service
**Location**: `src/services/database/favoritesService.ts`

Manages user's favorite parking spots with cross-platform storage.

**Key Methods**:
- `addFavorite()`: Save parking spot with optional custom name
- `removeFavorite()`: Remove spot from favorites
- `getAllFavorites()`: Retrieve all saved spots
- `isFavorite()`: Check if spot is favorited
- `clearAllFavorites()`: Remove all favorites

**Storage Strategy**:
- Web: IndexedDB for persistent storage
- Mobile: AsyncStorage (SQLite planned for future)

### 3. Routing Service
**Location**: `src/services/routing/routingService.ts`

Intelligent distance calculation with API optimization.

**Features**:
- OpenRouteService integration
- Route caching for performance
- Fallback to straight-line distance
- Rate limiting and error handling
- Multiple routing profiles (driving, walking, cycling)

**Configuration**:
- Configurable API endpoints
- Cache expiry settings
- Request timeout and retry logic
- Straight-line distance thresholds

### 4. Database Services

#### Web Database Service
**Location**: `src/services/database/webDatabaseService.ts`

IndexedDB wrapper providing SQL-like interface for web browsers.

**Object Stores**:
- `favorites`: User's saved parking spots
- `website_access_logs`: Usage analytics
- `gps_logs`: Location tracking data

#### Logging Service
**Location**: `src/services/database/loggingService.ts`

Tracks user interactions and system usage.

**Logging Types**:
- Website access with IP and user agent
- GPS coordinates and location data
- Session management
- Error tracking

## Database

### Schema Design

#### Favorites Table
```sql
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  streetAddress TEXT NOT NULL,
  restriction TEXT NOT NULL,
  isOccupied BOOLEAN NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  zoneNumber TEXT,
  kerbsideId TEXT,
  customName TEXT,
  dateAdded TEXT NOT NULL,
  lastUpdated TEXT NOT NULL
);
```

#### Website Access Logs
```sql
CREATE TABLE website_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ipAddress TEXT NOT NULL,
  userAgent TEXT,
  timestamp TEXT NOT NULL,
  sessionId TEXT,
  pageUrl TEXT
);
```

#### GPS Logs
```sql
CREATE TABLE gps_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  altitude REAL,
  heading REAL,
  speed REAL,
  timestamp TEXT NOT NULL,
  sessionId TEXT,
  activityType TEXT NOT NULL
);
```

### Data Flow
1. **API Data**: Melbourne parking sensors → Enhanced markers
2. **User Actions**: Favorites, search, filters → Local storage
3. **Location Data**: GPS → Distance calculations → Routing service
4. **Analytics**: User interactions → Logging service → Local database

## API Integration

### Melbourne Open Data APIs

#### 1. Parking Bay Sensors
**Endpoint**: `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-parking-bay-sensors/records`

**Data Fields**:
- `kerbsideid`: Unique sensor identifier
- `status_description`: "Present" or "Unoccupied"
- `status_timestamp`: Last update time
- `zone_number`: Parking zone identifier
- `location`: GPS coordinates

#### 2. Sign Plates Data
**Endpoint**: `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/sign-plates-located-in-each-parking-zone/records`

**Purpose**: Parking restrictions and time limits

#### 3. Street Segments
**Endpoint**: `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/parking-zones-linked-to-street-segments/records`

**Purpose**: Street address mapping

### OpenRouteService API
**Endpoint**: `https://api.openrouteservice.org/v2/directions`

**Features**:
- Multiple routing profiles
- Turn-by-turn directions
- Route geometry
- Distance and duration calculations

**Rate Limits**:
- Free tier: 2000 requests/day, 40 requests/minute
- Implemented rate limiting and caching

## User Interface

### Design Principles
- **Mobile-first**: Optimized for mobile devices
- **Responsive**: Adapts to different screen sizes
- **Accessible**: Screen reader support, high contrast
- **Intuitive**: Clear visual hierarchy and navigation
- **Performance**: Smooth animations and fast loading

### Layout Strategies

#### Split-screen Layout (Wide screens)
```
┌─────────────────┬─────────────────┐
│                 │                 │
│   Parking List  │  Interactive    │
│   & Controls    │     Map         │
│                 │                 │
└─────────────────┴─────────────────┘
```

#### Stacked Layout (Mobile)
```
┌─────────────────┐
│   Parking List  │
│   & Controls    │
├─────────────────┤
│  Interactive    │
│     Map         │
└─────────────────┘
```

### Visual Elements

#### Status Indicators
- 🅿️ Available parking (green)
- 🚗 Occupied parking (red)
- ⏰ Time-restricted parking (orange)
- 🚫 No parking/loading zone (gray)

#### Interactive Elements
- Search bar with voice input
- Filter dropdowns
- Sort options
- Refresh controls
- Favorite heart icons

### Accessibility Features
- Screen reader support
- High contrast mode
- Voice search capability
- Keyboard navigation
- Focus indicators

## Configuration

### Environment Variables
```bash
# Optional: OpenRouteService API key for routing
EXPO_PUBLIC_ORS_API_KEY=your_api_key_here
```

### Routing Configuration
**Location**: `src/config/routing.ts`

```typescript
interface RoutingEnvironmentConfig {
  ORS_API_KEY?: string;
  ORS_BASE_URL: string;
  ENABLE_ROUTING: boolean;
  CACHE_ENABLED: boolean;
  CACHE_EXPIRY_HOURS: number;
  STRAIGHT_LINE_THRESHOLD_KM: number;
  MAX_RETRIES: number;
  REQUEST_TIMEOUT_MS: number;
  DEBUG_ROUTING: boolean;
}
```

### Expo Configuration
**Location**: `app.json`

**Key Configuration**:
- **App Metadata**: Name, version, description
- **Platform Settings**: iOS and Android specific configurations
- **Permissions**: Location access permissions with user-friendly messages
- **Splash Screen**: Custom splash screen with app icon
- **Maps Integration**: Google Maps API key configuration
- **Routing**: File-based routing with typed routes
- **Plugins**: Expo plugins for location, maps, and splash screen

**Location Permissions**:
```json
{
  "locationAlwaysAndWhenInUsePermission": "Allow Park Find to use your location to find nearby parking spots.",
  "locationAlwaysPermission": "Allow Park Find to use your location to find nearby parking spots.",
  "locationWhenInUsePermission": "Allow Park Find to use your location to find nearby parking spots."
}
```

### Platform-specific Settings
- **Web**: Extended timeouts, IndexedDB storage, iframe map embedding
- **iOS**: Native map components, haptic feedback, SF Symbols, blur effects
- **Android**: Material Design icons, native storage, standard tab bars

## Development

### Prerequisites
- Node.js 18+ and npm
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Setup Instructions
```bash
# Clone repository
git clone <repository-url>
cd park-find

# Install dependencies
npm install

# Start development server
npx expo start

# Platform-specific commands
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

### Development Workflow
1. **Code Changes**: Edit files in `src/` or `app/`
2. **Hot Reload**: Changes reflect immediately in development
3. **Testing**: Test on multiple platforms
4. **Linting**: Run `npm run lint` for code quality
5. **Building**: Use `npm run build:web` for production

### Debugging
- **React Native Debugger**: For mobile debugging
- **Browser DevTools**: For web debugging
- **Expo DevTools**: For Expo-specific features
- **Console Logging**: Extensive logging throughout the app

## Deployment

### Web Deployment
```bash
# Build for production
npm run build:web

# Deploy to Netlify
npm run deploy:netlify
```

### Mobile App Deployment
```bash
# Build for app stores
npx expo build:ios
npx expo build:android

# Or use EAS Build (recommended)
npx eas build --platform all
```

### Environment Setup
- **Development**: Local development server
- **Staging**: Netlify preview deployments
- **Production**: Netlify production deployment

### Performance Optimization
- **Code Splitting**: Lazy loading of components
- **Image Optimization**: Compressed assets
- **Caching**: API response and route caching
- **Bundle Analysis**: Regular bundle size monitoring

## Advanced Features

### Speech Recognition
**Platform**: Web only (uses Web Speech API)

**Implementation**:
- Browser-native speech recognition
- Real-time transcription
- Visual feedback during listening
- Automatic search query population
- Error handling for unsupported browsers

**Usage Flow**:
1. User clicks microphone icon
2. Browser requests microphone permission
3. Speech recognition starts with visual indicator
4. User speaks search query
5. Transcribed text populates search field
6. Search results update automatically

**Browser Support**:
- Chrome/Chromium: Full support
- Firefox: Limited support
- Safari: Partial support
- Edge: Full support

### Intelligent Filtering System

#### Available Right Now Filter (Default)
- Shows only unoccupied parking spots
- Real-time status updates
- Prioritizes immediate availability

#### Advanced Filters
```typescript
interface FilterOptions {
  availability: 'all' | 'available' | 'occupied';
  parkingType: 'all' | 'metered' | 'loading' | 'disabled' | 'motorcycle';
  signType: 'all' | 'no_restrictions' | 'time_limited' | 'permit_required';
  timeRestrictions: 'all' | 'current_time_ok' | 'no_restrictions';
  maxDistance: number; // in kilometers
}
```

#### Smart Sorting
- **Distance**: Closest to user location first
- **Availability**: Available spots prioritized
- **Zone Number**: Numerical ordering
- **Last Updated**: Most recently updated first
- **Restriction Type**: By parking type and restrictions

### Location Services

#### GPS Integration
- **Permission Handling**: Graceful permission requests with user-friendly messages
- **Accuracy Levels**: High accuracy GPS for precise distance calculations
- **Real-time Updates**: Live location tracking when app is active
- **Privacy**: All location data stored locally only
- **Error Recovery**: Automatic retry mechanisms for location failures
- **Permission States**: Handles granted, denied, and undetermined states

#### UserLocationDisplay Component Features
- **Coordinate Display**: Formatted latitude/longitude with accuracy
- **Refresh Control**: Manual location refresh with loading states
- **Permission UI**: Inline permission request buttons
- **Error Handling**: Clear error messages with retry options
- **Loading States**: Visual feedback during location acquisition

#### Distance Calculation Hierarchy
1. **Routing API**: Accurate driving distances via OpenRouteService
2. **Hybrid Calculator**: Intelligent switching between routing and straight-line
3. **Cached Routes**: Previously calculated routes for performance
4. **Straight-line Fallback**: Immediate distance when routing unavailable

### Advanced Routing Features

#### Route Visualization
- **Turn-by-turn Directions**: Detailed navigation instructions
- **Route Metrics**: Distance, duration, and calculation method indicators
- **Visual Feedback**: Route summary with expandable directions
- **Error Handling**: Graceful fallback when routing fails
- **Multiple Profiles**: Support for driving, walking, cycling routes

#### Routing Setup Guide
- **API Key Management**: Step-by-step OpenRouteService setup
- **Testing Interface**: Built-in API key validation
- **External Links**: Direct links to service registration
- **Configuration Persistence**: Saves API keys for future use
- **Setup Validation**: Confirms successful configuration

### Data Synchronization

#### Real-time Updates
- **Auto-refresh**: Every 2 minutes by default
- **Manual Refresh**: Pull-to-refresh and button controls
- **Background Sync**: Updates when app returns to foreground
- **Conflict Resolution**: Latest data always wins

#### Offline Capabilities
- **Cached Data**: Last known parking status
- **Favorites Access**: Always available offline
- **Search History**: Recent searches cached
- **Graceful Degradation**: Clear offline indicators

## Type Definitions

### Core Types
```typescript
// Parking sensor data from API
interface ParkingSensorRecord {
  lastupdated: string;
  status_timestamp: string;
  zone_number: number;
  status_description: 'Present' | 'Unoccupied';
  kerbsideid: number;
  location: {
    lon: number;
    lat: number;
  };
}

// Enhanced marker with additional data
interface EnhancedParkingSensorMarker {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  description: string;
  isOccupied: boolean;
  lastUpdated: Date;
  zoneNumber: number;
  kerbsideId: number;
  restrictions: ParkingRestriction[];
  currentRestriction: string;
  isRestricted: boolean;
  streetSegment?: StreetSegment;
  streetAddress: string;
}

// Favorite spot data
interface FavoriteSpot {
  id: string;
  title: string;
  streetAddress: string;
  restriction: string;
  isOccupied: boolean;
  latitude: number;
  longitude: number;
  zoneNumber?: string;
  kerbsideId?: string;
  customName?: string;
  dateAdded: string;
  lastUpdated: string;
}

// Routing and distance
interface RouteInfo {
  distance: number; // kilometers
  duration: number; // minutes
  geometry?: number[][]; // coordinate pairs
  instructions?: string[];
}

interface Coordinate {
  latitude: number;
  longitude: number;
}
```

### API Response Types
```typescript
interface ParkingSensorApiResponse {
  total_count: number;
  results: ParkingSensorRecord[];
}

interface ParkingZoneSignPlatesApiResponse {
  total_count: number;
  results: ParkingZoneSignPlate[];
}

interface ApiError {
  message: string;
  status?: number;
  code?: string;
}
```

## Error Handling

### API Error Management
```typescript
class ApiErrorHandler {
  static handle(error: unknown): ApiError {
    if (error instanceof Error) {
      return {
        message: error.message,
        status: 500,
        code: 'UNKNOWN_ERROR'
      };
    }
    // Handle different error types
  }
}
```

### Common Error Scenarios
1. **Network Failures**: Offline mode with cached data
2. **API Rate Limits**: Exponential backoff and user notification
3. **Location Permission Denied**: Fallback to manual location entry
4. **Speech Recognition Errors**: Clear error messages and fallback to text
5. **Storage Quota Exceeded**: Cache cleanup and user notification

### User-Friendly Error Messages
- **Network Issues**: "Unable to connect. Showing cached data."
- **Location Errors**: "Location access needed for distance calculations."
- **API Errors**: "Parking data temporarily unavailable. Please try again."
- **Storage Errors**: "Storage full. Some features may be limited."

## Performance Optimization

### Data Loading Strategies
- **Pagination**: Load parking data in chunks
- **Lazy Loading**: Components loaded on demand
- **Debounced Search**: Prevent excessive API calls
- **Memoization**: Cache expensive calculations

### Memory Management
- **Component Cleanup**: Remove event listeners and timers
- **Image Optimization**: Compressed and appropriately sized assets
- **Bundle Splitting**: Separate chunks for different features
- **Memory Profiling**: Regular monitoring of memory usage

### Network Optimization
- **Request Batching**: Combine multiple API calls
- **Compression**: Gzip compression for API responses
- **CDN Usage**: Static assets served from CDN
- **Caching Headers**: Appropriate cache control headers

## Security Considerations

### Data Privacy
- **Local Storage**: All user data stored locally
- **No Personal Data**: No collection of personal information
- **Anonymous Analytics**: Usage patterns without user identification
- **GDPR Compliance**: User control over data collection

### API Security
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Sanitize all user inputs
- **HTTPS Only**: All API calls over secure connections
- **API Key Protection**: Environment variables for sensitive keys

### Web Security
- **Content Security Policy**: Prevent XSS attacks
- **HTTPS Enforcement**: Secure connections required
- **Input Sanitization**: Clean all user-generated content
- **Dependency Scanning**: Regular security audits

## Testing Strategy

### Testing Structure

#### Test Directories
- `src/services/api/__tests__/`: API service tests
- `src/services/search/__tests__/`: Search functionality tests
- `src/components/parking/__tests__/`: Parking component tests
- `src/__tests__/`: General application tests

#### Unit Testing
```typescript
// Example test structure
describe('ParkingSensorsApi', () => {
  test('should fetch parking data successfully', async () => {
    const api = new ParkingSensorsApiService();
    const result = await api.fetchParkingSensors({ limit: 10 });
    expect(result.results).toHaveLength(10);
  });

  test('should handle API errors gracefully', async () => {
    // Test error handling scenarios
  });

  test('should convert API data to enhanced markers', async () => {
    // Test data transformation
  });
});

describe('FavoritesService', () => {
  test('should add favorite successfully', async () => {
    // Test favorite addition
  });

  test('should retrieve all favorites', async () => {
    // Test favorite retrieval
  });
});
```

#### Integration Testing
- **API Integration**: Test real Melbourne Open Data API responses
- **Database Operations**: Test IndexedDB and AsyncStorage operations
- **Location Services**: Test GPS functionality and permissions
- **Cross-platform**: Test on iOS, Android, and Web platforms
- **Routing Integration**: Test OpenRouteService API integration

#### End-to-End Testing
- **User Workflows**: Complete parking search and favorites workflows
- **Performance Testing**: Load testing with large datasets
- **Accessibility Testing**: Screen reader and keyboard navigation
- **Browser Compatibility**: Cross-browser testing (Chrome, Firefox, Safari, Edge)
- **Mobile Testing**: iOS and Android device testing

#### Component Testing
- **ParkingSensorsMap**: Test search, filtering, and map interactions
- **FavoriteNameModal**: Test modal interactions and validation
- **UserLocationDisplay**: Test location permissions and display
- **RouteVisualization**: Test route calculation and display

## Monitoring & Analytics

### Performance Monitoring
- **Load Times**: Track app startup and screen transitions
- **API Response Times**: Monitor external API performance
- **Error Rates**: Track and alert on error frequencies
- **User Engagement**: Usage patterns and feature adoption

### Health Checks
- **API Availability**: Monitor external service status
- **Database Health**: Check storage operations
- **Location Services**: Verify GPS functionality
- **Speech Recognition**: Test browser API availability

## Future Enhancements

### Planned Features
1. **Push Notifications**: Parking spot availability alerts
2. **Reservation System**: Reserve parking spots in advance
3. **Payment Integration**: Pay for parking through the app
4. **Social Features**: Share parking spots with friends
5. **Machine Learning**: Predict parking availability patterns

### Technical Improvements
1. **Native Mobile Apps**: Full native iOS and Android versions
2. **Offline-first Architecture**: Complete offline functionality
3. **Real-time WebSocket**: Live parking status updates
4. **Advanced Caching**: Intelligent cache management
5. **Performance Optimization**: Further speed improvements

### Platform Expansion
1. **Additional Cities**: Expand beyond Melbourne
2. **Private Parking**: Include private parking facilities
3. **EV Charging**: Electric vehicle charging station integration
4. **Accessibility Features**: Enhanced accessibility support
5. **Multi-language**: Internationalization support

## Troubleshooting

### Common Issues

#### App Won't Load
1. Check internet connection
2. Clear browser cache (web)
3. Restart app (mobile)
4. Check for app updates

#### Location Not Working
1. Enable location permissions
2. Check GPS settings
3. Try manual location entry
4. Restart location services

#### Speech Recognition Not Working
1. Check microphone permissions
2. Verify browser support
3. Test microphone functionality
4. Use text search as fallback

#### Favorites Not Saving
1. Check storage permissions
2. Clear app data and retry
3. Verify available storage space
4. Try incognito/private mode (web)

### Debug Information
- **App Version**: Check package.json version
- **Platform**: iOS/Android/Web
- **Browser**: Version and type (web only)
- **Location**: GPS coordinates and accuracy
- **Network**: Connection type and speed

## Contributing

### Development Guidelines
1. **Code Style**: Follow ESLint configuration
2. **TypeScript**: Use strict type checking
3. **Testing**: Write tests for new features
4. **Documentation**: Update docs for changes
5. **Performance**: Consider performance impact

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass and coverage maintained
- [ ] Documentation updated
- [ ] Performance impact considered
- [ ] Accessibility requirements met

---

*This comprehensive documentation covers every aspect of the Park Find application. For the most up-to-date information, always refer to the source code and commit history.*
