import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model } = mongoose;

// ─── USER ───────────────────────────────────────────────
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'inventory_manager', 'salesperson'], default: 'salesperson' },
  phone: String,
  avatar: String,
  assignedWarehouses: [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(pwd) { return bcrypt.compare(pwd, this.password); };
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = model('User', userSchema);

// ─── WAREHOUSE ──────────────────────────────────────────
const warehouseSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  address: { street: String, city: String, state: String, country: String, zip: String },
  phone: String,
  email: String,
  manager: { type: Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  notes: String,
}, { timestamps: true });

export const Warehouse = model('Warehouse', warehouseSchema);

// ─── BRAND ──────────────────────────────────────────────
const brandSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  logo: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Brand = model('Brand', brandSchema);

// ─── CATEGORY ───────────────────────────────────────────
const categorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  description: String,
  parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  image: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Category = model('Category', categorySchema);

// ─── VENDOR ─────────────────────────────────────────────
const vendorSchema = new Schema({
  name: { type: String, required: true },
  company: String,
  email: { type: String },
  phone: String,
  address: { street: String, city: String, state: String, country: String, zip: String },
  taxId: String,
  paymentTerms: { type: String, default: 'NET30' },
  creditLimit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  notes: String,
  isActive: { type: Boolean, default: true },
  rating: { type: Number, min: 1, max: 5, default: 3 },
}, { timestamps: true });

export const Vendor = model('Vendor', vendorSchema);

// ─── PRODUCT ────────────────────────────────────────────
const productSchema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  barcode: { type: String, unique: true, sparse: true },
  barcodeType: { type: String, default: 'CODE128' },
  description: String,
  category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  vendors: [{ type: Schema.Types.ObjectId, ref: 'Vendor' }],
  brand: { type: Schema.Types.ObjectId, ref: 'Brand', default: null },
  articleNumber: { type: String, trim: true },
  size: { type: String, trim: true },
  sizeUnit: { type: String, trim: true },
  image: { type: String },
  unit: { type: String, default: 'pcs' },
  costPrice: { type: Number, required: true, default: 0 },
  sellingPrice: { type: Number, required: true, default: 0 },
  taxRate: { type: Number, default: 0 },
  images: [String],
  reorderPoint: { type: Number, default: 10 },
  maxStock: { type: Number, default: 1000 },
  isActive: { type: Boolean, default: true },
  tags: [String],
  // Measurement-based pricing
  pricingMode: { type: String, enum: ['per_piece', 'per_sqm', 'per_meter'], default: 'per_piece' },
  dimensionLength: { type: Number, default: 0 },
  dimensionWidth: { type: Number, default: 0 },
  dimensionUnit: { type: String, enum: ['ft', 'm', 'cm', 'inch'], default: 'ft' },
  // Packaging type
  productType: { type: String, enum: ['standard', 'box', 'set'], default: 'standard' },
  // For box products
  piecesPerBox: { type: Number, default: 1 },
  canSellLoose: { type: Boolean, default: true },
  // For set products
  setComponents: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
  }],
}, { timestamps: true });

export const Product = model('Product', productSchema);

// ─── INVENTORY ──────────────────────────────────────────
const inventorySchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  quantity: { type: Number, default: 0 },       // boxes (for box products) or pieces/sets
  looseQuantity: { type: Number, default: 0 },  // loose pieces (only for box products)
  reservedQuantity: { type: Number, default: 0 },
  location: String,
}, { timestamps: true });

inventorySchema.index({ product: 1, warehouse: 1 }, { unique: true });
inventorySchema.virtual('availableQuantity').get(function() {
  return this.quantity - this.reservedQuantity;
});

export const Inventory = model('Inventory', inventorySchema);

// ─── INVENTORY MOVEMENT ──────────────────────────────────
const inventoryMovementSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  type: { type: String, enum: ['in', 'out', 'transfer', 'adjustment', 'return', 'breakage'], required: true },
  movementUnit: { type: String, enum: ['pieces', 'boxes'], default: 'pieces' },
  quantity: { type: Number, required: true },
  previousQuantity: Number,
  newQuantity: Number,
  reference: String,
  referenceType: { type: String, enum: ['purchase', 'sale', 'transfer', 'adjustment', 'return', 'breakage'] },
  notes: String,
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const InventoryMovement = model('InventoryMovement', inventoryMovementSchema);

// ─── BREAKAGE ────────────────────────────────────────────
const breakageSchema = new Schema({
  breakageNumber: { type: String, unique: true },
  type: { type: String, enum: ['broken', 'missing'], default: 'broken' },
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, enum: ['pieces', 'boxes'], default: 'pieces' },
  source: { type: String, enum: ['shipping', 'handling', 'storage', 'inspection', 'other'], default: 'shipping' },
  purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  inspection: { type: Schema.Types.ObjectId, ref: 'InventoryInspection' },
  notes: String,
  date: { type: Date, default: Date.now },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'confirmed', 'resolved'], default: 'confirmed' },
}, { timestamps: true });

export const Breakage = model('Breakage', breakageSchema);

// ─── INVENTORY INSPECTION ───────────────────────────────
const inspectionItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  expectedQty: { type: Number, default: 0 },
  expectedLooseQty: { type: Number, default: 0 },
  actualQty: { type: Number, default: null },
  actualLooseQty: { type: Number, default: null },
  discrepancyType: { type: String, enum: ['broken', 'missing', null], default: null },
  notes: String,
});

const inventoryInspectionSchema = new Schema({
  inspectionNumber: { type: String, unique: true },
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  status: { type: String, enum: ['draft', 'submitted', 'verified'], default: 'draft' },
  items: [inspectionItemSchema],
  notes: String,
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
}, { timestamps: true });

export const InventoryInspection = model('InventoryInspection', inventoryInspectionSchema);

// ─── VENDOR PAYMENT ─────────────────────────────────────
const vendorPaymentSchema = new Schema({
  vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'cheque', 'bank_transfer', 'online'], required: true, default: 'cash' },
  referenceNumber: String,
  notes: String,
  date: { type: Date, default: Date.now },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const VendorPayment = model('VendorPayment', vendorPaymentSchema);

// ─── PURCHASE ORDER ─────────────────────────────────────
const purchaseOrderSchema = new Schema({
  poNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['standard', 'direct_sale'], default: 'standard' },
  poPaymentTerms: { type: String, enum: ['credit', 'prepaid', 'partial'], default: 'credit' },
  advanceAmount: { type: Number, default: 0 },
  vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  status: { type: String, enum: ['draft', 'ordered', 'partial', 'received', 'cancelled', 'direct_sale'], default: 'draft' },
  customer: { name: String, phone: String, email: String },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    orderedQty: { type: Number, required: true },
    receivedQty: { type: Number, default: 0 },
    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, default: 0 },
    total: Number,
  }],
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  saleGrandTotal: { type: Number, default: 0 },
  expectedDate: Date,
  receivedDate: Date,
  notes: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  paidAmount: { type: Number, default: 0 },
  linkedSaleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
}, { timestamps: true });

export const PurchaseOrder = model('PurchaseOrder', purchaseOrderSchema);

// ─── SALE / POS ─────────────────────────────────────────
const saleSchema = new Schema({
  saleNumber: { type: String, required: true, unique: true },
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  isDirectSale: { type: Boolean, default: false },
  customer: {
    name: String,
    email: String,
    phone: String,
  },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: String,
    barcode: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    total: Number,
    sellingUnit: { type: String, enum: ['box', 'loose', null], default: null },
  }],
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'bank_transfer', 'cheque', 'credit'], default: 'cash' },
  amountPaid: { type: Number, default: 0 },
  changeAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['completed', 'pending', 'cancelled', 'refunded'], default: 'completed' },
  notes: String,
  soldBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Sale = model('Sale', saleSchema);

// ─── COUNTER (for auto-increment numbers) ───────────────
const counterSchema = new Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});

export const Counter = model('Counter', counterSchema);

// ─── STORE SETTINGS (singleton) ─────────────────────────
const storeSettingsSchema = new Schema({
  name: { type: String, default: 'StockFlow' },
  tagline: { type: String, default: 'Inventory & Point of Sale System' },
  logo: String,
  address: { street: String, city: String, state: String, country: String, zip: String },
  phone: String,
  email: String,
  website: String,
  taxNumber: String,
  currency: { type: String, default: 'Rs' },
  receiptFooter: { type: String, default: 'Thank you for your purchase!' },
}, { timestamps: true });

export const StoreSettings = model('StoreSettings', storeSettingsSchema);
