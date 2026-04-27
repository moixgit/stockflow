db = db.getSiblingDB('stockflow');

db.createCollection('users');

db.users.insertOne({
  name: 'System Admin',
  email: 'admin@stockflow.com',
  password: '$2b$10$rOzJqQ3mB1vX8KpL7dNt4.Yf6GhI2wE5sA9cP0uM3nT1xZ4jKbVeW', // admin123
  role: 'admin',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print('✅ StockFlow initialized with default admin: admin@stockflow.com / admin123');
