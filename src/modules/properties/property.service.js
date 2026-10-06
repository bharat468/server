import { propertyRepository } from './property.repository.js';
import { ApiError } from '../../common/errors/apiError.js';

export class PropertyService {
  async listProperties(query = {}) {
    return propertyRepository.list(query);
  }

  async getProperty(id) {
    const property = await propertyRepository.findById(id);
    if (!property) {
      throw new ApiError(404, 'Property not found');
    }
    return property;
  }

  async createProperty(payload) {
    return propertyRepository.create({
      title: payload.title,
      address: payload.address,
      city: payload.city,
      rent: parseFloat(payload.rent),
      bedrooms: parseInt(payload.bedrooms || 1, 10),
      status: payload.status || 'VACANT',
      organizationId: payload.organizationId || null,
      ownerId: payload.ownerId || null,
    });
  }

  async updateProperty(id, payload) {
    await this.getProperty(id);
    const data = { ...payload };
    if (data.rent !== undefined) data.rent = parseFloat(data.rent);
    if (data.bedrooms !== undefined) data.bedrooms = parseInt(data.bedrooms, 10);
    return propertyRepository.update(id, data);
  }

  async deleteProperty(id) {
    await this.getProperty(id);
    return propertyRepository.delete(id);
  }
}

export const propertyService = new PropertyService();
