import { PrismaClient, Prisma } from '@prisma/client';
import { Request, Response } from 'express';

// Initialize Prisma client with connection pooling
const prisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Helper function to handle BigInt serialization
const serializeBigInt = (data: any): any => {
  if (typeof data === 'bigint') {
    return data.toString();
  }
  if (Array.isArray(data)) {
    return data.map(serializeBigInt);
  }
  if (data && typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return data;
};

// Define types for our search results
interface CityResult {
  type: 'city';
  cityName: string;
  cityCode: string;
  countryName: string | null;
  countryCode: string | null;
  hotelCount: number;
  hotelCodes: string[];
}

interface HotelResult {
  type: 'hotel';
  id: bigint;
  code: string | null;
  name: string | null;
  description: string | null;
  attractions: any;
  images: any;
  address: string | null;
  pinCode: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  map: string | null;
  rating: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  facilities: any;
  cityCode: string | null;
  cityName: string | null;
  countryName: string | null;
  countryCode: string | null;
}

type SearchResult = CityResult | HotelResult;

interface SearchResponse {
  success: boolean;
  data: {
    resultType: 'city' | 'hotel' | 'mixed';
    results: SearchResult[];
  };
}

// Define types for database entities
interface City {
  id: bigint;
  name: string | null;
  code: string | null;
  country?: {
    name: string | null;
    code: string | null;
  } | null;
}

interface Hotel {
  id: bigint;
  code: string | null;
  name: string | null;
  description: string | null;
  attractions: any;
  images: any;
  address: string | null;
  pinCode: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  map: string | null;
  rating: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  facilities: any;
  cityCode: string | null;
  cityName: string | null;
  countryName: string | null;
  countryCode: string | null;
}

interface HotelCode {
  code: string | null;
  cityCode: string | null;
}


// Define types for our search results
interface CityResult {
  type: 'city';
  cityName: string;
  cityCode: string;
  countryName: string | null;
  countryCode: string | null;
  hotelCount: number;
  hotelCodes: string[];
}

interface HotelResult {
  type: 'hotel';
  id: bigint;
  code: string | null;
  name: string | null;
  description: string | null;
  attractions: any;
  images: any;
  address: string | null;
  pinCode: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  map: string | null;
  rating: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  facilities: any;
  cityCode: string | null;
  cityName: string | null;
  countryName: string | null;
  countryCode: string | null;
}


interface SearchResponse {
  success: boolean;
  data: {
    resultType: 'city' | 'hotel' | 'mixed';
    results: SearchResult[];
  };
}

export const searchHotelsByFilters = async (req: Request, res: Response): Promise<Response<SearchResponse>> => {
  try {
    // Get search parameters from request body
    const { searchTerm } = req.body;

    // Validate input
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }

    // Trim searchTerm for consistency
    const trimmedSearchTerm = searchTerm.trim();
    
    // Initialize result containers
    const categorizedResults = {
      hotels: [] as HotelResult[],
      cities: {} as Record<string, CityResult>,
      countries: {} as Record<string, { countryName: string; countryCode: string; count: number }>
    };
    
    let resultType: 'city' | 'hotel' | 'mixed' = 'mixed';
    let exactMatchFound = false;

    // Use a transaction to ensure data consistency
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      try {
        // Perform a single query to check for both city and hotel matches
        const [exactCities, prefixCities, exactHotels, prefixHotels] = await Promise.all([
          tx.cities.findMany({
            where: {
              name: {
                equals: trimmedSearchTerm,
                mode: 'insensitive'
              }
            },
            select: {
              id: true,
              name: true,
              code: true,
              country: {
                select: {
                  name: true,
                  code: true
                }
              }
            },
            take: 25
          }),
          
          tx.cities.findMany({
            where: {
              name: {
                startsWith: trimmedSearchTerm,
                mode: 'insensitive'
              }
            },
            select: {
              id: true,
              name: true,
              code: true,
              country: {
                select: {
                  name: true,
                  code: true
                }
              }
            },
            take: 25
          }),

          tx.hotels.findMany({
            where: {
              name: {
                equals: trimmedSearchTerm,
                mode: 'insensitive'
              }
            },
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              attractions: true,
              images: true,
              address: true,
              pinCode: true,
              phoneNumber: true,
              faxNumber: true,
              map: true,
              rating: true,
              checkInTime: true,
              checkOutTime: true,
              facilities: true,
              cityCode: true,
              cityName: true,
              countryName: true,
              countryCode: true
            }
          }),

          tx.hotels.findMany({
            where: {
              name: {
                startsWith: trimmedSearchTerm,
                mode: 'insensitive'
              }
            },
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              attractions: true,
              images: true,
              address: true,
              pinCode: true,
              phoneNumber: true,
              faxNumber: true,
              map: true,
              rating: true,
              checkInTime: true,
              checkOutTime: true,
              facilities: true,
              cityCode: true,
              cityName: true,
              countryName: true,
              countryCode: true
            },
            take: 20
          })
        ]);
        
        // Process city results
        if (exactCities && exactCities.length > 0) {
          resultType = 'city';
          exactMatchFound = true;
          exactCities.forEach((city: City) => {
            if (city.name && city.code) {
              categorizedResults.cities[city.name] = {
                type: 'city',
                cityName: city.name,
                cityCode: city.code,
                countryName: city.country?.name || null,
                countryCode: city.country?.code || null,
                hotelCount: 0,
                hotelCodes: []
              };
            }
          });
        } else {
          prefixCities?.forEach((city: City) => {
            if (city.name && city.code) {
              categorizedResults.cities[city.name] = {
                type: 'city',
                cityName: city.name,
                cityCode: city.code,
                countryName: city.country?.name || null,
                countryCode: city.country?.code || null,
                hotelCount: 0,
                hotelCodes: []
              };
            }
          });
        }

        // Process hotel results
        if (exactHotels && exactHotels.length > 0 && !exactMatchFound) {
          resultType = 'hotel';
          exactMatchFound = true;
          exactHotels.forEach((hotel: Hotel) => {
            categorizedResults.hotels.push({
              type: 'hotel',
              id: hotel.id,
              code: hotel.code,
              name: hotel.name,
              description: hotel.description,
              attractions: hotel.attractions || [],
              images: hotel.images || [],
              address: hotel.address,
              pinCode: hotel.pinCode,
              phoneNumber: hotel.phoneNumber,
              faxNumber: hotel.faxNumber,
              map: hotel.map,
              rating: hotel.rating,
              checkInTime: hotel.checkInTime,
              checkOutTime: hotel.checkOutTime,
              facilities: hotel.facilities || [],
              cityCode: hotel.cityCode,
              cityName: hotel.cityName,
              countryName: hotel.countryName,
              countryCode: hotel.countryCode
            });
          });
        } else {
          prefixHotels?.forEach((hotel: Hotel) => {
            categorizedResults.hotels.push({
              type: 'hotel',
              id: hotel.id,
              code: hotel.code,
              name: hotel.name,
              description: hotel.description,
              attractions: hotel.attractions || [],
              images: hotel.images || [],
              address: hotel.address,
              pinCode: hotel.pinCode,
              phoneNumber: hotel.phoneNumber,
              faxNumber: hotel.faxNumber,
              map: hotel.map,
              rating: hotel.rating,
              checkInTime: hotel.checkInTime,
              checkOutTime: hotel.checkOutTime,
              facilities: hotel.facilities || [],
              cityCode: hotel.cityCode,
              cityName: hotel.cityName,
              countryName: hotel.countryName,
              countryCode: hotel.countryCode
            });
          });
        }

      } catch (error) {
        console.error('Search error:', error);
      }
    }, {
      timeout: 30000, // Increase timeout to 30 seconds
      maxWait: 95000 // Maximum time to wait for transaction to start
    });

    // Create a single merged array with type information
    const mergedResults: SearchResult[] = [
      ...Object.values(categorizedResults.cities).map(city => ({ ...city, type: 'city' as const })),
      ...categorizedResults.hotels
    ];

    // Serialize the response to handle BigInt values
    const serializedResponse = {
      success: true,
      data: {
        resultType,
        results: serializeBigInt(mergedResults)
      }
    };

    return res.status(200).json(serializedResponse);
  } catch (error) {
    console.error('Error searching hotels:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      error: 'Internal server error'
    });
  }
};
