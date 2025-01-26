from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, text
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from faker import Faker
import random
from datetime import datetime

# Initialize Faker with additional providers
fake = Faker()
Base = declarative_base()

# Custom product name generator function
def generate_product_name():
    patterns = [
        f"{fake.color_name()} {fake.word()} {fake.word()}",
        f"{fake.word().title()} {fake.word()} Pro",
        f"Premium {fake.word().title()} {fake.word().title()}",
        f"{fake.word().title()} {random.choice(['Max', 'Elite', 'Pro', 'Plus'])}",
        f"{fake.word().title()} {fake.word().title()} {str(random.randint(100, 999))}"
    ]
    return random.choice(patterns)

# Database Models
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True)
    email = Column(String(100))
    created_at = Column(DateTime)
    is_active = Column(Boolean)
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    orders = relationship("Order", back_populates="user")
    addresses = relationship("Address", back_populates="user")

class UserProfile(Base):
    __tablename__ = 'user_profiles'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    full_name = Column(String(100))
    address = Column(String(500))  # Increased from 200
    phone = Column(String(50))     # Increased from 20
    birth_date = Column(DateTime)
    user = relationship("User", back_populates="profile")

class Product(Base):
    __tablename__ = 'products'
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(String(500))
    price = Column(Float)
    category_id = Column(Integer, ForeignKey('categories.id'))
    stock = Column(Integer)
    created_at = Column(DateTime)
    category = relationship("Category", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    inventory = relationship("Inventory", back_populates="product")

class Category(Base):
    __tablename__ = 'categories'
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    description = Column(String(200))
    products = relationship("Product", back_populates="category")

class Order(Base):
    __tablename__ = 'orders'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    order_date = Column(DateTime)
    total_amount = Column(Float)
    status = Column(String(20))
    shipping_address_id = Column(Integer, ForeignKey('addresses.id', ondelete='SET NULL'))
    tracking_number = Column(String(50))
    estimated_delivery = Column(DateTime)
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")
    payment = relationship("Payment", back_populates="order", uselist=False)
    shipping_address = relationship("Address", back_populates="orders")

class OrderItem(Base):
    __tablename__ = 'order_items'
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('orders.id'))
    product_id = Column(Integer, ForeignKey('products.id'))
    quantity = Column(Integer)
    price = Column(Float)
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

class PaymentMethod(Base):
    __tablename__ = 'payment_methods'
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    payments = relationship("Payment", back_populates="method")  # e.g. "Credit Card"

class Payment(Base):
    __tablename__ = 'payments'
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('orders.id'))
    method_id = Column(Integer, ForeignKey('payment_methods.id'))
    amount = Column(Float)
    order = relationship("Order", back_populates="payment")
    method = relationship("PaymentMethod", back_populates="payments")

class PaymentLog(Base):
    __tablename__ = 'payment_logs'
    id = Column(Integer, primary_key=True)
    payment_id = Column(Integer, ForeignKey('payments.id'))
    status = Column(String(20))
    details = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    payment = relationship("Payment")

class Return(Base):
    __tablename__ = 'returns'
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('orders.id'))
    reason = Column(String(200))
    order = relationship("Order")

class ReturnItem(Base):
    __tablename__ = 'return_items'
    id = Column(Integer, primary_key=True)
    return_id = Column(Integer, ForeignKey('returns.id'))
    product_id = Column(Integer, ForeignKey('products.id'))
    return_qty = Column(Integer)
    returns_ref = relationship("Return")
    product = relationship("Product")

class Supplier(Base):
    __tablename__ = 'suppliers'
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    supplier_products = relationship("SupplierProduct", back_populates="supplier")

class SupplierProduct(Base):
    __tablename__ = 'supplier_products'
    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey('suppliers.id'))
    product_id = Column(Integer, ForeignKey('products.id'))
    supplier = relationship("Supplier", back_populates="supplier_products")
    product = relationship("Product")

class Warehouse(Base):
    __tablename__ = 'warehouses'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True)
    location = Column(String(200))
    capacity = Column(Integer)
    inventory = relationship("Inventory", back_populates="warehouse")

class Coupon(Base):
    __tablename__ = 'coupons'
    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True)
    discount_amount = Column(Float)

class CouponUsage(Base):
    __tablename__ = 'coupon_usage'
    id = Column(Integer, primary_key=True)
    coupon_id = Column(Integer, ForeignKey('coupons.id'))
    user_id = Column(Integer, ForeignKey('users.id'))

class Address(Base):
    __tablename__ = 'addresses'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), index=True)
    street = Column(String(100))
    city = Column(String(50))
    state = Column(String(50))
    zip_code = Column(String(20))
    is_primary = Column(Boolean, default=False)
    user = relationship("User", back_populates="addresses")
    orders = relationship("Order", back_populates="shipping_address")

class Inventory(Base):
    __tablename__ = 'inventory'
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), index=True)
    warehouse_id = Column(Integer, ForeignKey('warehouses.id', ondelete='CASCADE'), index=True)
    quantity = Column(Integer)
    last_restocked = Column(DateTime)
    product = relationship("Product", back_populates="inventory")
    warehouse = relationship("Warehouse", back_populates="inventory")

class PurchaseOrder(Base):
    __tablename__ = 'purchase_orders'
    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey('suppliers.id', ondelete='CASCADE'))
    order_date = Column(DateTime, default=datetime.utcnow)
    expected_delivery = Column(DateTime)
    status = Column(String(20), default='ordered')
    items = relationship("PurchaseOrderItem", back_populates="order")

class PurchaseOrderItem(Base):
    __tablename__ = 'purchase_order_items'
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('purchase_orders.id', ondelete='CASCADE'))
    product_id = Column(Integer, ForeignKey('products.id', ondelete='RESTRICT'))
    quantity = Column(Integer)
    unit_cost = Column(Float)
    order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")

def create_database_with_name(db_name):
    from config import MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST

    # Drop and recreate the database
    temp_engine = create_engine(f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/')
    with temp_engine.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
        conn.execute(text(f"CREATE DATABASE {db_name}"))
        conn.commit()
    temp_engine.dispose()
    
    # Now connect to the database and create tables
    engine = create_engine(f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{db_name}')
    
    # Separate main tables vs. all tables
    main_tables = [
        User.__table__,
        UserProfile.__table__,
        Product.__table__,
        Category.__table__,
        Order.__table__,
        OrderItem.__table__,
        Address.__table__  # Added to fix the foreign key reference
    ]
    # If 'fake_db', create all
    if db_name == 'fake_db':
        Base.metadata.create_all(engine)
    else:
        Base.metadata.create_all(engine, tables=main_tables)
    
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Create Categories
        categories = []
        for _ in range(10):
            category = Category(
                name=fake.unique.company(),
                description=fake.catch_phrase()
            )
            categories.append(category)
        session.add_all(categories)
        session.commit()

        # Create Products
        products = []
        for _ in range(100):
            product = Product(
                name=generate_product_name(),
                description=fake.text(max_nb_chars=200),
                price=round(random.uniform(10.0, 1000.0), 2),
                category_id=random.choice(categories).id,
                stock=random.randint(0, 1000),
                created_at=fake.date_time_between(start_date='-2y')
            )
            products.append(product)
        session.add_all(products)
        session.commit()

        # Create Users and Profiles
        users = []
        for _ in range(50):
            user = User(
                username=fake.unique.user_name(),
                email=fake.email(),
                created_at=fake.date_time_between(start_date='-1y'),
                is_active=random.choice([True, False])
            )
            profile = UserProfile(
                user=user,
                full_name=fake.name(),
                address=fake.address(),
                phone=fake.phone_number(),
                birth_date=fake.date_of_birth()
            )
            users.append(user)
        session.add_all(users)
        session.commit()

        # Create Orders and OrderItems
        orders = []
        for _ in range(200):
            user = random.choice(users)
            order = Order(
                user_id=user.id,
                order_date=fake.date_time_between(start_date='-6m'),
                status=random.choice(['pending', 'completed', 'cancelled']),
                total_amount=0.0
            )
            
            # Add 1-5 items to each order
            order_total = 0.0
            for _ in range(random.randint(1, 5)):
                product = random.choice(products)
                quantity = random.randint(1, 5)
                item_price = product.price
                order_total += item_price * quantity
                
                order_item = OrderItem(
                    order=order,
                    product_id=product.id,
                    quantity=quantity,
                    price=item_price
                )
                
            order.total_amount = round(order_total, 2)
            orders.append(order)
        
        session.add_all(orders)
        session.commit()
    
    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
    finally:
        session.close()

def main():
    create_database_with_name('mock_db')
    create_database_with_name('fake_db')

if __name__ == "__main__":
    main()
    print("Databases created successfully with sample data!")
