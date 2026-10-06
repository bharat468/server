import { paymentService } from './payment.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class PaymentController {
  list = asyncHandler(async (_req, res) => {
    const payments = await paymentService.listPayments();
    res.status(200).json(
      new ApiResponse(200, payments, 'Payments retrieved successfully')
    );
  });

  get = asyncHandler(async (req, res) => {
    const payment = await paymentService.getPayment(req.params.id);
    res.status(200).json(
      new ApiResponse(200, payment, 'Payment retrieved successfully')
    );
  });

  create = asyncHandler(async (req, res) => {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json(
      new ApiResponse(201, payment, 'Payment created successfully')
    );
  });

  update = asyncHandler(async (req, res) => {
    const payment = await paymentService.updatePayment(req.params.id, req.body);
    res.status(200).json(
      new ApiResponse(200, payment, 'Payment updated successfully')
    );
  });

  delete = asyncHandler(async (req, res) => {
    await paymentService.deletePayment(req.params.id);
    res.status(200).json(
      new ApiResponse(200, null, 'Payment deleted successfully')
    );
  });
}

export const paymentController = new PaymentController();
