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
        // CITY SEARCH - First priority
        // 1. Try exact match for city (fastest query)
        const exactCities = await tx.cities.findMany({
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
        });
            
        if (exactCities && exactCities.length > 0) {
          // If exact city match found, mark as city result
          resultType = 'city';
          exactMatchFound = true;
          
          // Process city results - only include cities with a code
          exactCities.forEach((city: City) => {
            if (city.name && city.code && !categorizedResults.cities[city.name]) {
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
        
        // 2. If no exact match, try city prefix search
        if (Object.keys(categorizedResults.cities).length === 0) {
          const prefixCities = await tx.cities.findMany({
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
          });
              
          prefixCities?.forEach((city: City) => {
            if (city.name && city.code && !categorizedResults.cities[city.name]) {
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
        
        // Fetch hotel codes for cities in a single query for better performance
        if (Object.keys(categorizedResults.cities).length > 0) {
          try {
            const cityCodes = Object.values(categorizedResults.cities).map(city => city.cityCode);
            
            // Get all hotels for these cities in a single query
            const cityHotels = await tx.hotels.findMany({
              where: {
                cityCode: {
                  in: cityCodes
                }
              },
              select: {
                code: true,
                cityCode: true
              }
            });
            
            // Group hotels by city
            const hotelsByCity: Record<string, string[]> = {};
            cityHotels.forEach((hotel: HotelCode) => {
              if (hotel.code && hotel.cityCode) {
                if (!hotelsByCity[hotel.cityCode]) {
                  hotelsByCity[hotel.cityCode] = [];
                }
                hotelsByCity[hotel.cityCode].push(hotel.code);
              }
            });
            
            // Update city results with hotel counts
            Object.keys(categorizedResults.cities).forEach(cityName => {
              const cityCode = categorizedResults.cities[cityName].cityCode;
              if (hotelsByCity[cityCode]) {
                categorizedResults.cities[cityName].hotelCodes = hotelsByCity[cityCode];
                categorizedResults.cities[cityName].hotelCount = hotelsByCity[cityCode].length;
              }
            });
            
            // Filter out cities with no hotels
            const citiesWithHotels: Record<string, CityResult> = {};
            Object.keys(categorizedResults.cities).forEach(cityName => {
              if (categorizedResults.cities[cityName].hotelCodes.length > 0) {
                citiesWithHotels[cityName] = categorizedResults.cities[cityName];
              }
            });
            categorizedResults.cities = citiesWithHotels;
            
          } catch (error) {
            console.error('Error fetching hotel codes for cities:', error);
          }
        }
      } catch (cityError) {
        console.error('City search error:', cityError);
      }

      try {
        // HOTEL SEARCH - Third priority (but only if no exact match yet)
        // 1. Try exact hotel name first
        const exactHotels = await tx.hotels.findMany({
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
        });
            
        if (exactHotels && exactHotels.length > 0 && !exactMatchFound) {
          resultType = 'hotel';
          exactMatchFound = true;
        }
            
        // Process exact match hotels
        exactHotels?.forEach((hotel: Hotel) => {
          // Format hotel data
          const formattedHotel: HotelResult = {
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
          };
          
          // Add to hotels array
          categorizedResults.hotels.push(formattedHotel);
          
          // Update city count
          if (hotel.cityName && categorizedResults.cities[hotel.cityName]) {
            categorizedResults.cities[hotel.cityName].hotelCount++;
          } else if (hotel.cityName) {
            categorizedResults.cities[hotel.cityName] = {
              type: 'city',
              cityName: hotel.cityName,
              cityCode: hotel.cityCode || '',
              countryName: hotel.countryName,
              countryCode: hotel.countryCode,
              hotelCount: 1,
              hotelCodes: []
            };
          }
          
          // Update country count
          if (hotel.countryName && categorizedResults.countries[hotel.countryName]) {
            categorizedResults.countries[hotel.countryName].count++;
          } else if (hotel.countryName) {
            categorizedResults.countries[hotel.countryName] = {
              countryName: hotel.countryName,
              countryCode: hotel.countryCode || '',
              count: 1
            };
          }
        });
        
        // 2. If we still need more hotels, try prefix search
        if (categorizedResults.hotels.length < 20) {
          const prefixHotels = await tx.hotels.findMany({
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
            take: 20 - categorizedResults.hotels.length
          });
              
          prefixHotels?.forEach((hotel: Hotel) => {
            // Avoid duplicates
            if (!categorizedResults.hotels.some(h => h.code === hotel.code)) {
              // Format hotel data
              const formattedHotel: HotelResult = {
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
              };
              
              // Add to hotels array
              categorizedResults.hotels.push(formattedHotel);
              
              // Update city count
              if (hotel.cityName && categorizedResults.cities[hotel.cityName]) {
                categorizedResults.cities[hotel.cityName].hotelCount++;
              } else if (hotel.cityName) {
                categorizedResults.cities[hotel.cityName] = {
                  type: 'city',
                  cityName: hotel.cityName,
                  cityCode: hotel.cityCode || '',
                  countryName: hotel.countryName,
                  countryCode: hotel.countryCode,
                  hotelCount: 1,
                  hotelCodes: []
                };
              }
              
              // Update country count
              if (hotel.countryName && categorizedResults.countries[hotel.countryName]) {
                categorizedResults.countries[hotel.countryName].count++;
              } else if (hotel.countryName) {
                categorizedResults.countries[hotel.countryName] = {
                  countryName: hotel.countryName,
                  countryCode: hotel.countryCode || '',
                  count: 1
                };
              }
            }
          });
        }
      } catch (hotelError) {
        console.error('Hotel search error:', hotelError);
      }
    }, {
      timeout: 30000, // Increase timeout to 30 seconds
      maxWait: 95000 // Maximum time to wait for transaction to start
    });

    // Create a single merged array with type information
    // First add cities (highest priority)
    const mergedResults: SearchResult[] = Object.values(categorizedResults.cities).map(city => ({
      ...city,
      type: 'city'
    }));
    
    // Finally add hotels (lowest priority)
    mergedResults.push(...categorizedResults.hotels);

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