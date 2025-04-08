# Hotel Search API

A high-performance hotel search API built with TypeScript, Express, and Prisma.

## Features

- Search for hotels and cities simultaneously
- Optimized for large databases with efficient querying
- TypeScript for type safety
- Prisma for database access
- RESTful API design

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory with:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/database?schema=public"
   PORT=3000
   ```

4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Search Hotels and Cities

```
POST /api/search
```

Request body:
```json
{
  "searchTerm": "your search term"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "resultType": "city|hotel|mixed",
    "results": [
      {
        "type": "city",
        "cityName": "City Name",
        "cityCode": "CITY_CODE",
        "countryName": "Country Name",
        "countryCode": "COUNTRY_CODE",
        "hotelCount": 10,
        "hotelCodes": ["HOTEL1", "HOTEL2", ...]
      },
      {
        "type": "hotel",
        "id": 123,
        "code": "HOTEL_CODE",
        "name": "Hotel Name",
        "description": "Hotel Description",
        "attractions": [...],
        "images": [...],
        "address": "Hotel Address",
        "pinCode": "123456",
        "phoneNumber": "+1234567890",
        "faxNumber": "+1234567891",
        "map": "map_url",
        "rating": 4.5,
        "checkInTime": "14:00",
        "checkOutTime": "12:00",
        "facilities": [...],
        "cityCode": "CITY_CODE",
        "cityName": "City Name",
        "countryName": "Country Name",
        "countryCode": "COUNTRY_CODE"
      }
    ]
  }
}
```

## Performance Optimizations

- Uses Prisma transactions for data consistency
- Efficient querying with selective field fetching
- Batched queries for related data
- Proper indexing on search fields
- Connection pooling for database access

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build the project
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:studio` - Open Prisma Studio for database management

## License

MIT 