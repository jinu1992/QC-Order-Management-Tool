
import { POStatus, type PurchaseOrder, type Customer, type User, type RolePermissions, type InventoryItem } from '../types';

// Helper to generate dynamic dates relative to today
const getDate = (offsetDays: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - offsetDays);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
};

// Helper to get a future date
const getFutureDate = (offsetDays: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
};

export const initialPurchaseOrders: PurchaseOrder[] = [];

export const initialCustomers: Customer[] = [];

// Empty initial users - will be fetched from API
export const initialUsers: User[] = [];

export const initialRolePermissions: RolePermissions = {
    'Admin': ['Dashboard', 'Purchase Orders', 'Uploads', 'File Uploader', 'POC Verification', 'Appointments', 'Sales Orders', 'GRN / POD', 'Reports', 'Finance', 'Inventory', 'Admin'],
    'Key Account Manager': ['Dashboard', 'Purchase Orders', 'Uploads', 'File Uploader', 'POC Verification', 'Appointments', 'Sales Orders', 'GRN / POD', 'Reports', 'Inventory'],
    'Finance Manager': ['Dashboard', 'Finance', 'Reports'],
    'Supply Chain Manager': ['Dashboard', 'Purchase Orders', 'Sales Orders', 'Reports', 'Inventory'],
    'Limited Access': ['Dashboard', 'Purchase Orders'],
};

export const initialInventory: InventoryItem[] = [];
