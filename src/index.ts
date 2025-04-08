import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Search hotels
app.get('/api/hotels/search', async (req: Request, res: Response) => {
  try {
    const { location, minPrice, maxPrice, amenities } = req.query;
    
    const where: any = {};
    
    if (location) {
      where.location = {
        contains: location as string,
        mode: 'insensitive'
      };
    }
    
    if (minPrice || maxPrice) {
      where.pricePerNight = {};
      if (minPrice) where.pricePerNight.gte = parseFloat(minPrice as string);
      if (maxPrice) where.pricePerNight.lte = parseFloat(maxPrice as string);
    }
    
    if (amenities) {
      const amenitiesList = (amenities as string).split(',');
      where.amenities = {
        hasEvery: amenitiesList
      };
    }
    
    const hotels = await prisma.hotel.findMany({
      where,
      orderBy: {
        rating: 'desc'
      }
    });
    
    res.json(hotels);
  } catch (error) {
    console.error('Error searching hotels:', error);
    res.status(500).json({ error: 'Failed to search hotels' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 