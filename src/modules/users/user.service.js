import { userRepository } from './user.repository.js';
import { ApiError } from '../../common/errors/apiError.js';

export class UserService {
  constructor(repo = userRepository) {
    this.userRepo = repo;
  }

  async createUser({ mobile, email, name, avatar }) {
    const existingMobile = await this.userRepo.findByMobile(mobile);
    if (existingMobile) {
      throw new ApiError(409, 'User with this mobile number already exists');
    }

    if (email) {
      const existingEmail = await this.userRepo.findByEmail(email);
      if (existingEmail) {
        throw new ApiError(409, 'User with this email already exists');
      }
    }

    return this.userRepo.create({
      mobile,
      email,
      name,
      avatar,
    });
  }

  async getUserById(id) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    return user;
  }

  async getUserByMobile(mobile) {
    const user = await this.userRepo.findByMobile(mobile);
    if (!user) {
      throw new ApiError(404, 'User not found with this mobile number');
    }
    return user;
  }

  async updateUserProfile(id, updateData) {
    const existing = await this.getUserById(id);
    if (updateData.email && updateData.email !== existing.email) {
      const emailUser = await this.userRepo.findByEmail(updateData.email);
      if (emailUser && emailUser.id !== id) {
        throw new ApiError(409, 'User with this email already exists');
      }
    }
    if (updateData.mobile && updateData.mobile !== existing.mobile) {
      const mobileUser = await this.userRepo.findByMobile(updateData.mobile);
      if (mobileUser && mobileUser.id !== id) {
        throw new ApiError(409, 'User with this mobile number already exists');
      }
    }
    return this.userRepo.update(id, updateData);
  }

  async listUsers(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const { total, users } = await this.userRepo.list({
      skip,
      take: limit,
      status: query.status,
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const userService = new UserService();
