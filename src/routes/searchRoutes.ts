import express, { Request, Response } from 'express';
import { searchHotelsByFilters } from '../controllers/searchController';

const router = express.Router();

// Search hotels and cities by term
router.post('/search', async (req: Request, res: Response) => {
  await searchHotelsByFilters(req, res);
});

export default router; 