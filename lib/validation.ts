import { z } from 'zod';

export const customerOrderItemSchema = z.object({
  itemId: z.string().optional(),
  comboId: z.string().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20, 'Maximum 20 per item per order'),
  notes: z.string().max(100, 'Note too long (max 100 characters)').optional().default(''),
}).refine(data => data.itemId || data.comboId, {
  message: 'Must provide either an itemId or a comboId',
});

export const customerPlaceOrderSchema = z.object({
  tableToken: z.string().min(3, 'Invalid table token'),
  notes: z.string().max(200, 'Special instructions too long').optional().default(''),
  items: z.array(customerOrderItemSchema).min(1, 'Order must contain at least one item'),
});

export const waiterPlaceOrderSchema = z.object({
  tableId: z.string().min(1, 'Table is required'),
  notes: z.string().max(200).optional().default(''),
  items: z.array(customerOrderItemSchema).min(1, 'Select at least one item'),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  status: z.enum(['pending', 'approved', 'preparing', 'ready', 'served', 'cancelled']),
});

export const updateItemStatusSchema = z.object({
  itemId: z.string().min(1, 'Order Item ID is required'),
  status: z.enum(['pending', 'approved', 'preparing', 'ready', 'served', 'cancelled']),
});

export const settleBillSchema = z.object({
  tableId: z.string().min(1, 'Table ID is required'),
  paymentMethod: z.enum(['cash', 'upi', 'card']),
  discountPaise: z.number().int().min(0).default(0),
});

export const menuItemSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().max(250).default(''),
  pricePaise: z.number().int().min(100, 'Price must be at least ₹1'),
  dietary: z.enum(['veg', 'non_veg']),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  seatCapacity: z.number().int().min(1).max(30).default(4),
});

export const staffLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
