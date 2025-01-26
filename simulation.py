import mysql.connector
from datetime import datetime
import random
import string

from config import MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST

# Database configuration
DB_CONFIG = {
    'user': MYSQL_USER,
    'password': MYSQL_PASSWORD,
    'host': MYSQL_HOST,
    'database': 'mock_db'
}

def connect_db():
    """Create database connection"""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except mysql.connector.Error as err:
        print(f"Failed to connect to database: {err}")
        raise

def get_random_string(length=8):
    """Generate random string"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def add_random_row(cursor, table):
    """Add one row to specified table"""
    # Disable foreign key checks
    cursor.execute("SET FOREIGN_KEY_CHECKS=0")
    
    try:
        # Get column information
        cursor.execute(f"DESCRIBE {table}")
        columns = cursor.fetchall()
        
        # Prepare column values
        values = []
        col_names = []
        for col in columns:
            col_name = col[0]
            col_type = col[1]
            
            # Skip auto_increment columns
            if col[5] == 'auto_increment':
                continue
                
            col_names.append(col_name)
            
            # Generate appropriate value based on column type
            if 'int' in col_type:
                values.append(random.randint(1, 1000))
            elif 'decimal' in col_type or 'float' in col_type:
                values.append(round(random.uniform(1, 1000), 2))
            elif 'datetime' in col_type:
                values.append(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            elif 'date' in col_type:
                values.append(datetime.now().strftime('%Y-%m-%d'))
            elif 'bool' in col_type or 'tinyint(1)' in col_type:
                values.append(random.choice([0, 1]))
            else:  # Treat as string
                values.append(f"test_{get_random_string()}")

        # Insert the row
        if col_names:
            placeholders = ','.join(['%s'] * len(col_names))
            query = f"INSERT INTO {table} ({','.join(col_names)}) VALUES ({placeholders})"
            cursor.execute(query, values)
            print(f"Added row to {table} with id {cursor.lastrowid}")
    finally:
        # Re-enable foreign key checks
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")

def delete_latest_row(cursor, table):
    """Delete the latest row from specified table"""
    # Disable foreign key checks
    cursor.execute("SET FOREIGN_KEY_CHECKS=0")
    
    try:
        # Get the latest row id
        cursor.execute(f"SELECT id FROM {table} ORDER BY id DESC LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            row_id = result[0]
            cursor.execute(f"DELETE FROM {table} WHERE id = %s", (row_id,))
            print(f"Deleted row {row_id} from {table}")
    finally:
        # Re-enable foreign key checks
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")

def update_latest_row(cursor, table):
    """Update one cell in the latest row of specified table"""
    # Disable foreign key checks
    cursor.execute("SET FOREIGN_KEY_CHECKS=0")
    
    try:
        # Get columns that can be updated
        cursor.execute(f"DESCRIBE {table}")
        columns = cursor.fetchall()
        updateable_columns = [
            col[0] for col in columns 
            if col[5] != 'auto_increment' and col[0] != 'id'
        ]
        
        if not updateable_columns:
            return
            
        # Get the latest row
        cursor.execute(f"SELECT id FROM {table} ORDER BY id DESC LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            row_id = result[0]
            # Choose random column to update
            column = random.choice(updateable_columns)
            
            # Get column type
            col_info = next(col for col in columns if col[0] == column)
            col_type = col_info[1]
            
            # Generate new value based on type
            if 'int' in col_type:
                new_value = random.randint(1, 1000)
            elif 'decimal' in col_type or 'float' in col_type:
                new_value = round(random.uniform(1, 1000), 2)
            elif 'datetime' in col_type:
                new_value = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            elif 'date' in col_type:
                new_value = datetime.now().strftime('%Y-%m-%d')
            elif 'bool' in col_type or 'tinyint(1)' in col_type:
                new_value = random.choice([0, 1])
            else:  # Treat as string
                new_value = f"updated_{get_random_string()}"
            
            cursor.execute(
                f"UPDATE {table} SET {column} = %s WHERE id = %s",
                (new_value, row_id)
            )
            print(f"Updated {column} in {table} row {row_id}")
    finally:
        # Re-enable foreign key checks
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")

def main():
    """Run each operation on a different table"""
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        print("\n=== Running Database Operations ===")
        
        # Add row to products
        print("\nAdding row to products...")
        add_random_row(cursor, 'products')
        conn.commit()
        
        # Update row in orders
        print("\nUpdating row in orders...")
        update_latest_row(cursor, 'orders')
        conn.commit()
        
        # Delete row from users
        print("\nDeleting row from users...")
        delete_latest_row(cursor, 'users')
        conn.commit()
        
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
        
    print("\n=== Operations Completed ===")

if __name__ == "__main__":
    main()