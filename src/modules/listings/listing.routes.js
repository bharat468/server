import { Router } from 'express';
import { listingController } from './listing.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/validators/request.validator.js';
import { createListingSchema, updateListingSchema } from '../../common/validators/listing.validator.js';

const router = Router();

// Public Marketplace Routes (No Auth Required)
router.get('/public', listingController.listPublic);
router.get('/public/:id', listingController.getPublic);

// Protected Owner Listing Management Routes
router.use(authenticate);

router.get('/', listingController.listOwner);
router.post('/', validateRequest(createListingSchema), listingController.create);
router.patch('/:id', validateRequest(updateListingSchema), listingController.update);
router.delete('/:id', listingController.delete);

export default router;
