import { User } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for demo purposes
// In production, you would use a proper database like PostgreSQL, MongoDB, etc.
class UserService {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();

  /**
   * Create a new user
   */
  async createUser(email: string, walletId?: string, walletAddress?: string): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = this.usersByEmail.get(email);
      if (existingUser) {
        return existingUser;
      }

      const user: User = {
        id: uuidv4(),
        email,
        walletId,
        walletAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.users.set(user.id, user);
      this.usersByEmail.set(email, user);

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        hasWallet: !!walletId,
      });

      return user;
    } catch (error: any) {
      logger.error('Failed to create user', {
        email,
        error: error.message,
      });
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = this.users.get(userId);
      return user || null;
    } catch (error: any) {
      logger.error('Failed to get user by ID', {
        userId,
        error: error.message,
      });
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = this.usersByEmail.get(email);
      return user || null;
    } catch (error: any) {
      logger.error('Failed to get user by email', {
        email,
        error: error.message,
      });
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Update user wallet information
   */
  async updateUserWallet(
    userId: string,
    walletId: string,
    walletAddress: string
  ): Promise<User> {
    try {
      const user = this.users.get(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      user.walletId = walletId;
      user.walletAddress = walletAddress;
      user.updatedAt = new Date();

      this.users.set(userId, user);
      this.usersByEmail.set(user.email, user);

      logger.info('User wallet updated', {
        userId,
        walletId,
        walletAddress,
      });

      return user;
    } catch (error: any) {
      logger.error('Failed to update user wallet', {
        userId,
        walletId,
        error: error.message,
      });
      throw new Error(`Failed to update user wallet: ${error.message}`);
    }
  }

  /**
   * Get all users (for admin purposes)
   */
  async getAllUsers(): Promise<User[]> {
    try {
      return Array.from(this.users.values());
    } catch (error: any) {
      logger.error('Failed to get all users', {
        error: error.message,
      });
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  /**
   * Delete user (for testing purposes)
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      
      if (!user) {
        return false;
      }

      this.users.delete(userId);
      this.usersByEmail.delete(user.email);

      logger.info('User deleted', { userId });
      return true;
    } catch (error: any) {
      logger.error('Failed to delete user', {
        userId,
        error: error.message,
      });
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Get user count
   */
  async getUserCount(): Promise<number> {
    return this.users.size;
  }
}

export const userService = new UserService();