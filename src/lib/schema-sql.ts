/** The relational model the demo store mirrors — shown read-only in Settings. */
export const SCHEMA_SQL = `CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(30) UNIQUE NOT NULL,          -- admin | storekeeper | cashier
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_id INT NOT NULL,
  full_name VARCHAR(80) NOT NULL,
  username VARCHAR(40) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) UNIQUE NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  contact_person VARCHAR(80),
  phone VARCHAR(30), email VARCHAR(120),
  address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  category_id INT NOT NULL,
  supplier_id INT NULL,
  unit ENUM('pcs','carton','kg','l') NOT NULL DEFAULT 'pcs',
  cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
  sell_price DECIMAL(10,2) NOT NULL CHECK (sell_price >= 0),
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);
CREATE TABLE purchases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ref VARCHAR(20) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  created_by INT NOT NULL,
  status ENUM('ordered','received') DEFAULT 'ordered',
  pay_method ENUM('cash','transfer','debit') NOT NULL DEFAULT 'cash',
  bank ENUM('cbe','boa','awash','dashen','coop',
            'oromiya','shebele','check') NULL,   -- null when paid in cash
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  received_at TIMESTAMP NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE purchase_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ref VARCHAR(20) UNIQUE NOT NULL,
  cashier_id INT NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  pay_method ENUM('cash','transfer','debit') NOT NULL DEFAULT 'cash',
  bank ENUM('cbe','boa','awash','dashen','coop',
            'oromiya','shebele','check') NULL,   -- null when paid in cash
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);
CREATE TABLE sale_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  method ENUM('cash','transfer','debit') NOT NULL,
  bank ENUM('cbe','boa','awash','dashen','coop',
            'oromiya','shebele','check') NULL,
  amount DECIMAL(12,2) NOT NULL,
  change_due DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);
CREATE TABLE inventory_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  type ENUM('initial','purchase','sale','received',
            'damage','lost','adjustment') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,    -- signed: + in / - out
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NULL,
  grp VARCHAR(20) NOT NULL,
  action VARCHAR(40) NOT NULL,
  detail VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);`;
