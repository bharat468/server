import { authService } from '../../modules/auth/auth.service.js';
import { userRepository } from '../../modules/users/user.repository.js';
import { ApiError } from '../errors/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required. Please provide a Bearer token in Authorization header.');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new ApiError(401, 'Authentication token is missing');
  }

  const decoded = authService.verifyJwt(token);

  const user = await userRepository.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'User account associated with this token does not exist');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, `Your account is currently ${user.status.toLowerCase()}. Please contact support.`);
  }

  req.user = user;
  next();
});
