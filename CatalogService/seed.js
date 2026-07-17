const Database = require('better-sqlite3');

const db = new Database('catalog.sqlite');

console.log('Creating tables...');

db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    supplierId INTEGER PRIMARY KEY,
    supplierName TEXT NOT NULL,
    address TEXT,
    telephoneNumber TEXT,
    faxNumber TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS catalogs (
    catalogId INTEGER PRIMARY KEY,
    catalogDescription TEXT NOT NULL,
    supplierId INTEGER NOT NULL,
    catalogType TEXT NOT NULL,
    FOREIGN KEY (supplierId) REFERENCES suppliers (supplierId) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS items (
    itemId INTEGER PRIMARY KEY,
    itemDescription TEXT NOT NULL,
    unitCost REAL NOT NULL,
    supplierId INTEGER NOT NULL,
    itemDetails TEXT,
    catalogId INTEGER NOT NULL,
    FOREIGN KEY (supplierId) REFERENCES suppliers (supplierId) ON DELETE RESTRICT,
    FOREIGN KEY (catalogId) REFERENCES catalogs (catalogId) ON DELETE CASCADE
  );
`);

console.log('Inserting sample data...');

const insertSupplier = db.prepare('INSERT OR IGNORE INTO suppliers (supplierId, supplierName, address, telephoneNumber, faxNumber, email) VALUES (?, ?, ?, ?, ?, ?)');
insertSupplier.run(1, 'Tech Solutions', '123 Tech Lane', '123-456-7890', '123-456-7891', 'contact@techsolutions.com');
insertSupplier.run(2, 'Book World', '456 Book St', '098-765-4321', '098-765-4322', 'info@bookworld.com');
insertSupplier.run(3, 'Home Goods Co', '789 Home Ave', '555-555-5555', '555-555-5556', 'sales@homegoodsco.com');
insertSupplier.run(4, 'Toy Universe', '321 Toy Blvd', '444-444-4444', '444-444-4445', 'hello@toyuniverse.com');

const insertCatalog = db.prepare('INSERT OR IGNORE INTO catalogs (catalogId, catalogDescription, supplierId, catalogType) VALUES (?, ?, ?, ?)');
insertCatalog.run(1, 'Laptops and Desktops', 1, 'Computers');
insertCatalog.run(2, 'Fiction and Non-Fiction', 2, 'Books');
insertCatalog.run(3, 'Furniture and Decor', 3, 'Home');
insertCatalog.run(4, 'Action Figures and Board Games', 4, 'Toys');

const insertItem = db.prepare('INSERT OR IGNORE INTO items (itemId, itemDescription, unitCost, supplierId, itemDetails, catalogId) VALUES (?, ?, ?, ?, ?, ?)');
// Computers
insertItem.run(101, 'High Performance Laptop', 1200.50, 1, 'http://example.com/laptop1', 1);
insertItem.run(102, 'Gaming Desktop', 2500.00, 1, 'http://example.com/desktop1', 1);
insertItem.run(103, 'Office Mouse', 25.99, 1, 'http://example.com/mouse1', 1);

// Books
insertItem.run(201, 'The Great Novel', 15.99, 2, 'http://example.com/book1', 2);
insertItem.run(202, 'Science Encyclopedia', 45.50, 2, 'http://example.com/book2', 2);

// Home
insertItem.run(301, 'Comfortable Sofa', 499.99, 3, 'http://example.com/sofa', 3);
insertItem.run(302, 'Dining Table', 299.00, 3, 'http://example.com/table', 3);

// Toys
insertItem.run(401, 'Super Hero Action Figure', 19.99, 4, 'http://example.com/toy1', 4);
insertItem.run(402, 'Strategy Board Game', 39.99, 4, 'http://example.com/toy2', 4);

console.log('Data prepared successfully in catalog.sqlite');
db.close();
