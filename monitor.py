from flask import Flask, render_template, jsonify, request, make_response
from flask_cors import CORS
import mysql.connector
import psycopg2
import psycopg2.extras
import time
import logging
import os
import json

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

print(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")

# Ensure template directory is correctly set
template_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates'))
static_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'))
app = Flask(__name__,
           template_folder=template_dir,
           static_folder=static_dir)

# Enable CORS
CORS(app, supports_credentials=True)

# Add this after CORS(app)
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Add new global variables
current_db_config = None
is_monitoring_paused = False  # New global variable for pause state

# Remove hardcoded credentials and make connection dependent on configuration
def get_db_connection():
    global current_db_config
    if not current_db_config:
        raise Exception("No database configured")
    
    if current_db_config.get('db_type') == 'postgresql':
        # PostgreSQL connection
        conn_params = {
            'host': current_db_config['host'],
            'user': current_db_config['user'],
            'password': current_db_config['password'],
            'database': current_db_config['database']
        }
        return psycopg2.connect(**conn_params)
    else:
        # MySQL connection (default)
        return mysql.connector.connect(**{k: v for k, v in current_db_config.items() if k not in ['db_type', 'type']})

def load_last_used_database():
    global current_db_config
    try:
        db_configs_raw = request.cookies.get('db_configs', '{}')
        if not db_configs_raw:
            current_db_config = None
            return False
            
        from urllib.parse import unquote
        db_configs = json.loads(unquote(db_configs_raw))
        
        if not db_configs:
            current_db_config = None
            return False
            
        last_used = request.cookies.get('last_used_db')
        if last_used and last_used in db_configs:
            config = db_configs[last_used]
            # Ensure both type and db_type are set correctly
            db_type = config.get('type') or config.get('db_type', 'mysql')
            config.update({
                'type': db_type,
                'db_type': db_type
            })
            current_db_config = config
            return True
        else:
            # If no last_used but configs exist, use the first one
            first_config = next(iter(db_configs.values()))
            first_config['db_type'] = first_config.get('type', 'mysql')
            current_db_config = first_config
            return True
    except Exception as e:
        logger.error(f"Error loading last database: {e}")
        current_db_config = None
        return False

@app.route('/api/database', methods=['GET', 'POST', 'DELETE'])
def handle_database():
    global current_db_config
    
    # For GET requests, always try to sync with client cookies first
    if request.method == 'GET':
        if not load_last_used_database():
            current_db_config = None
            return jsonify({})
            
    if request.method == 'DELETE':
        current_db_config = None
        response = make_response(jsonify({
            'status': 'success',
            'message': 'Database configuration cleared'
        }))
        response.delete_cookie('db_configs')
        response.delete_cookie('last_used_db')
        return response
    
    if request.method == 'POST':
        data = request.json
        try:
            db_type = data.get('type', 'mysql')  # Use 'type' from frontend form
            
            # Test connection based on database type
            if db_type == 'postgresql':
                connection = psycopg2.connect(
                    host=data['host'],
                    user=data['user'],
                    password=data['password'],
                    database=data['database']
                )
            else:
                connection = mysql.connector.connect(
                    host=data['host'],
                    user=data['user'],
                    password=data['password'],
                    database=data['database']
                )
            connection.close()
            
            # If successful, update current config
            current_db_config = {
                'host': data['host'],
                'user': data['user'],
                'password': data['password'],
                'database': data['database'],
                'type': db_type,  # Always store the type field
                'db_type': db_type  # Keep db_type for backward compatibility
            }
            
            response = make_response(jsonify({
                'status': 'success',
                'message': 'Database connection updated'
            }))
            
            try:
                db_configs = json.loads(request.cookies.get('db_configs') or '{}')
            except json.JSONDecodeError:
                db_configs = {}
                
            db_key = f"{data['host']}/{data['database']}"
            db_configs[db_key] = current_db_config
            
            # URL encode the JSON string before setting cookie
            from urllib.parse import quote
            encoded_configs = quote(json.dumps(db_configs))
            response.set_cookie('db_configs', encoded_configs, max_age=30*24*60*60)
            response.set_cookie('last_used_db', db_key, max_age=30*24*60*60)
            
            return response
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 400

    # GET method - check if we actually have a config
    if not current_db_config:
        # Try to load from cookies
        load_last_used_database()
        
    safe_config = dict(current_db_config or {})
    if 'password' in safe_config:
        safe_config['password'] = '********'
    return jsonify(safe_config)

# Define tables to ignore
IGNORED_TABLES = {'SequelizeMeta'}

# Modify get_table_names() to include primary key info
def get_table_names():
    """Get table names with better connection handling and retries"""
    max_retries = 3
    retry_delay = 1  # seconds
    last_error = None
    tables = []

    for attempt in range(max_retries):
        connection = None
        cursor = None
        try:
            # Attempt database connection
            connection = get_db_connection()
            cursor = connection.cursor()
            
            # Get table information based on database type
            if current_db_config.get('db_type') == 'postgresql':
                # PostgreSQL query
                cursor.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_type = 'BASE TABLE'
                """)
                table_names = [table[0] for table in cursor.fetchall()]
                
                for table_name in table_names:
                    if table_name not in IGNORED_TABLES:
                        try:
                            # Check if table exists
                            cursor.execute("""
                                SELECT EXISTS (
                                    SELECT FROM information_schema.tables
                                    WHERE table_schema = 'public'
                                    AND table_name = %s
                                )
                            """, (table_name,))
                            result = cursor.fetchone()
                            exists = result[0] if result else False
                            if exists:  # Only add if table exists
                                # Get primary key info for PostgreSQL
                                cursor.execute("""
                                    SELECT a.attname
                                    FROM pg_index i
                                    JOIN pg_attribute a ON a.attrelid = i.indrelid
                                    AND a.attnum = ANY(i.indkey)
                                    WHERE i.indrelid = %s::regclass
                                    AND i.indisprimary
                                """, (table_name,))
                                pk = cursor.fetchone()
                                tables.append({
                                    'name': table_name,
                                    'pk': pk[0] if pk else None
                                })
                        except psycopg2.Error as e:
                            logger.error(f"Error getting primary key for table {table_name}: {e}")
                            continue
            else:
                # MySQL query
                # First get list of existing tables
                cursor.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = DATABASE()
                """)
                existing_tables = {table[0] for table in cursor.fetchall()}
                
                cursor.execute("SHOW TABLES")
                for table in cursor.fetchall():
                    table_name = table[0]
                    if table_name not in IGNORED_TABLES and table_name in existing_tables:
                        # Get primary key info for MySQL
                        cursor.execute("""
                            SELECT COLUMN_NAME
                            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                            WHERE TABLE_SCHEMA = DATABASE()
                            AND TABLE_NAME = %s
                            AND CONSTRAINT_NAME = 'PRIMARY'
                        """, (table_name,))
                        pk = cursor.fetchone()
                        tables.append({
                            'name': table_name,
                            'pk': pk[0] if pk else None
                        })
            
            # If we get here, query was successful
            return tables

        except Exception as e:
            last_error = e
            logger.error(f"Error in get_table_names() attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
        
        finally:
            # Clean up database resources
            if cursor:
                try:
                    cursor.close()
                except:
                    pass
            if connection:
                try:
                    connection.close()
                except:
                    pass

    # If we get here, all retries failed
    if last_error:
        raise last_error
    return tables

# Update the index route without referrer check
@app.route('/')
def index():
    global current_db_config
    try:
        # Always sync with client cookies first
        if not load_last_used_database():
            current_db_config = None
            tables = []
        else:
            try:
                connection = get_db_connection()
                connection.close()
                tables = get_table_names()
            except Exception as e:
                logger.error(f"Database connection test failed: {e}")
                current_db_config = None
                tables = []
        app.jinja_env.cache = {}
        preferred_theme = request.cookies.get('preferred_theme', 'light')
        preferred_language = request.cookies.get('preferred_language', 'en')
        
        response = make_response(render_template('index.html', 
            tables=tables, 
            preferred_theme=preferred_theme,
            preferred_language=preferred_language,
            has_database=bool(current_db_config)
        ))
        
        # Set default cookies if not present
        if 'preferred_language' not in request.cookies:
            response.set_cookie('preferred_language', 'en', max_age=365*24*60*60)
        if 'preferred_theme' not in request.cookies:
            response.set_cookie('preferred_theme', 'light', max_age=365*24*60*60)
            
        return response
    except Exception as e:
        logger.error(f"Error rendering template: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# Add a new endpoint to check connection status
@app.route('/connection')
def check_connection():
    # Return 200 with no_database status when no database is configured
    if not current_db_config:
        return jsonify({"status": "no_database"})
    
    try:
        connection = get_db_connection()
        if current_db_config.get('db_type') == 'postgresql':
            cursor = connection.cursor()
            cursor.execute('SELECT 1')
            cursor.close()
        else:
            connection.ping(reconnect=True)
        connection.close()
        return jsonify({"status": "connected"})
    except Exception as e:
        logger.error(f"Connection check failed: {e}")
        return jsonify({"status": "disconnected"}), 503

# Add new endpoint to handle monitoring pause state
@app.route('/monitoring/state', methods=['POST'])
def set_monitoring_state():
    global is_monitoring_paused
    try:
        data = request.json
        is_monitoring_paused = data.get('paused', False)
        return jsonify({'status': 'success', 'paused': is_monitoring_paused})
    except Exception as e:
        logger.error(f"Error setting monitoring state: {e}")
        return jsonify({'error': str(e)}), 500

# Update data endpoint without referrer check
@app.route('/data/<table_name>')
def data_table(table_name):
    global is_monitoring_paused
    
    # If monitoring is paused and this is not an explicit data request (no limit param)
    if is_monitoring_paused and 'limit' not in request.args:
        return jsonify({'paused': True}), 202
        
    if table_name in IGNORED_TABLES:
        return jsonify({'error': 'Table is ignored'}), 400
    try:
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)

        connection = get_db_connection()
        if current_db_config.get('db_type') == 'postgresql':
            cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            # Check if table exists
            try:
                # First check if table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = %s
                    )
                """, (table_name,))
                result = cursor.fetchone()
                exists = result[0] if not isinstance(result, dict) else result['exists']
                if not exists:
                    return jsonify({'error': f'Table {table_name} does not exist'}), 404
                
                # Verify table is queryable
                cursor.execute('SELECT 1 FROM information_schema.columns WHERE table_name = %s LIMIT 1', (table_name,))
                if not cursor.fetchone():
                    return jsonify({'error': f'Table {table_name} exists but has no columns'}), 500
            except psycopg2.Error as e:
                logger.error(f"Error checking table {table_name}: {e}")
                return jsonify({'error': str(e)}), 500
        else:
            cursor = connection.cursor(dictionary=True)
            # Check if table exists
            cursor.execute("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                AND table_name = %s
            """, (table_name,))
            if not cursor.fetchone()['COUNT(*)']:
                return jsonify({'error': f'Table {table_name} does not exist'}), 404

        # Get row count
        if current_db_config.get('db_type') == 'postgresql':
            try:
                # Get count with better error handling
                try:
                    cursor.execute(f'SELECT COUNT(*) as count FROM "{table_name}"')
                    result = cursor.fetchone()
                    row_count = result['count'] if isinstance(result, dict) else result[0]
                except psycopg2.Error as e:
                    logger.error(f"Error getting count for table {table_name}: {e}")
                    return jsonify({'error': f'Error getting count: {str(e)}'}), 500
                
                # Get the columns in order for PostgreSQL with error handling
                try:
                    cursor.execute("""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                        AND table_name = %s
                        ORDER BY ordinal_position""", (table_name,))
                    columns_info = cursor.fetchall()
                    columns = [col['column_name'] for col in columns_info]  # Use column name since using RealDictCursor
                    
                    if not columns:
                        logger.error(f"No columns found for table {table_name}")
                        return jsonify({'error': f'No columns found for table {table_name}'}), 500
                except psycopg2.Error as e:
                    logger.error(f"Error getting columns for table {table_name}: {e}")
                    return jsonify({'error': f'Error getting columns: {str(e)}'}), 500
                
                # Build response
                response = {
                    'count': row_count,
                    'columns': columns,
                    'limited': False,
                    'data': []  # Initialize empty data array
                }
                
                # Fetch data only if a non-zero limit is specified
                if limit > 0:
                    try:
                        # Always use descending order on first column with error handling
                        if not columns:
                            raise ValueError("No columns available for sorting")
                        
                        sort_column = columns[0]
                        query = f'SELECT * FROM "{table_name}" ORDER BY "{sort_column}" DESC LIMIT %s OFFSET %s'
                        
                        cursor.execute(query, (limit, offset))
                        rows = cursor.fetchall()
                        # RealDictCursor already returns dict-like objects, no need for dict() conversion
                        response['data'] = list(rows)
                        response['limited'] = offset + limit < row_count
                    except (psycopg2.Error, ValueError) as e:
                        logger.error(f"Error fetching data from table {table_name}: {e}")
                        return jsonify({'error': f'Error fetching data: {str(e)}'}), 500
            except Exception as e:
                logger.error(f"PostgreSQL specific error for {table_name}: {str(e)}")
                raise
        else:
            # MySQL logic remains the same
            cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
            row_count = cursor.fetchone()['count']
            
            cursor.execute(f"SHOW COLUMNS FROM {table_name}")
            columns_info = cursor.fetchall()
            columns = [col['Field'] for col in columns_info]
            
            # Always initialize data array in response
            response = {
                'count': row_count,
                'columns': columns,
                'limited': False,
                'data': []  # Initialize empty data array for both paths
            }
            
            # Only fetch data if a positive limit is specified
            if limit and limit > 0:
                sort_column = columns[0]
                cursor.execute(
                    f"SELECT * FROM {table_name} ORDER BY `{sort_column}` DESC LIMIT %s OFFSET %s",
                    (limit, offset)
                )
                response['data'] = cursor.fetchall()
                response['limited'] = offset + limit < row_count

        return jsonify(response)
    except (mysql.connector.Error, psycopg2.Error) as e:
        error_msg = str(e)
        if isinstance(e, psycopg2.Error):
            logger.error(f"PostgreSQL error for table {table_name}: {e}")
            if 'does not exist' in str(e):
                return jsonify({'error': f'Table {table_name} does not exist'}), 404
        else:
            logger.error(f"MySQL error for table {table_name}: {e}")
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        logger.error(f"Error fetching data for table {table_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'connection' in locals():
            connection.close()

@app.route('/add/<table_name>', methods=['POST'])
def add_row(table_name):
    try:
        data = request.json
        connection = get_db_connection()

        if current_db_config.get('db_type') == 'postgresql':
            try:
                # Use RealDictCursor for PostgreSQL
                cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                
                # Get column information including primary key info
                cursor.execute("""
                    SELECT DISTINCT ON (c.column_name)
                        c.column_name,
                        c.data_type,
                        c.is_nullable,
                        c.column_default,
                        CASE
                            WHEN pk.contype = 'p' THEN true
                            ELSE false
                        END as is_primary
                    FROM information_schema.columns c
                    LEFT JOIN pg_attribute a ON
                        a.attname = c.column_name AND
                        a.attrelid = %s::regclass
                    LEFT JOIN (
                        SELECT contype, conkey, conrelid
                        FROM pg_constraint
                        WHERE contype = 'p'
                    ) pk ON
                        pk.conrelid = a.attrelid AND
                        a.attnum = ANY(pk.conkey)
                    WHERE c.table_name = %s
                    AND c.table_schema = 'public'
                    ORDER BY c.column_name, c.ordinal_position
                """, (table_name, table_name))
                columns_info = cursor.fetchall()
                
                # Prepare columns and values with appropriate defaults
                columns = []
                values = []
                for col in columns_info:
                    col_name = col['column_name']
                    
                    # Skip auto-incrementing columns
                    if col['data_type'] == 'integer' and col['column_default'] and 'nextval' in str(col['column_default']):
                        continue
                        
                    columns.append(col_name)
                    
                    # For UUID primary keys, always generate a new UUID
                    if col['data_type'] == 'uuid' and col['is_primary']:
                        import uuid
                        values.append(str(uuid.uuid4()))
                    else:
                        # For all other fields, just use NULL
                        values.append(None)
                
                # Validate column-value alignment
                if len(columns) != len(values):
                    raise ValueError(f"Column-value mismatch: {len(columns)} columns vs {len(values)} values")
                
                # Insert empty row
                columns_str = ', '.join(f'"{col}"' for col in columns)
                values_str = ', '.join(['%s'] * len(values))  # Ensure placeholders match values
                
                query = f'INSERT INTO "{table_name}" ({columns_str}) VALUES ({values_str}) RETURNING *'
                logger.debug(f"PostgreSQL insert query for {table_name}: {query}")
                logger.debug(f"Values: {values}")
                logger.debug(f"Columns: {columns}")
                
                cursor.execute(query, values)
                new_row = cursor.fetchone()
                connection.commit()
                
                return jsonify(dict(new_row))
            except psycopg2.Error as e:
                logger.error(f"PostgreSQL error adding row to {table_name}: {str(e)}")
                connection.rollback()
                return jsonify({'error': str(e)}), 500
        else:
            cursor = connection.cursor(dictionary=True)
            cursor.execute("SET FOREIGN_KEY_CHECKS=0")
            
            # Get column info and exclude auto-increment columns
            cursor.execute(f"SHOW COLUMNS FROM {table_name}")
            columns_info = cursor.fetchall()
            
            # Identify columns that need default values
            insert_columns = []
            for col in columns_info:
                # Skip auto-increment columns
                if 'auto_increment' in col['Extra'].lower():
                    continue
                
                # Include other columns
                insert_columns.append(col['Field'])
            
            # Create minimal INSERT statement
            if insert_columns:
                # For tables with required columns, use DEFAULT keyword
                columns_str = ', '.join([f'`{col}`' for col in insert_columns])
                values_str = 'DEFAULT, ' * (len(insert_columns)-1) + 'DEFAULT'
                query = f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str})"
            else:
                # For tables with only auto-increment columns
                query = f"INSERT INTO {table_name} () VALUES ()"
            
            cursor.execute(query)
            cursor.execute(f"SELECT * FROM {table_name} WHERE id = LAST_INSERT_ID()")
            new_row = cursor.fetchone()
            
            connection.commit()
            return jsonify(new_row)

    except Exception as e:
        logger.error(f"Error adding empty row to {table_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'connection' in locals():
            connection.close()

@app.route('/delete/<table_name>/<row_id>', methods=['DELETE'])
def delete_row(table_name, row_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        if current_db_config.get('db_type') == 'postgresql':
            try:
                # Delete the row
                cursor.execute(f'DELETE FROM "{table_name}" WHERE id = %s', (row_id,))
            except psycopg2.Error as e:
                return jsonify({'error': str(e)}), 500
        else:
            # MySQL
            try:
                # Disable foreign key checks
                cursor.execute("SET FOREIGN_KEY_CHECKS=0")
                # Delete the row
                cursor.execute(f"DELETE FROM {table_name} WHERE id = %s", (row_id,))
                # Re-enable foreign key checks
                cursor.execute("SET FOREIGN_KEY_CHECKS=1")
            except mysql.connector.Error as e:
                return jsonify({'error': str(e)}), 500

        connection.commit()
        return jsonify({'success': True})

    except Exception as e:
        logger.error(f"Error deleting row from {table_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'connection' in locals():
            connection.close()

@app.route('/update/<table_name>/<row_id>/<column>', methods=['PUT'])
def update_cell(table_name, row_id, column):
    try:
        data = request.json
        if 'value' not in data:
            return jsonify({'error': 'No value provided'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        if current_db_config.get('db_type') == 'postgresql':
            try:
                cursor.execute(f'UPDATE "{table_name}" SET "{column}" = %s WHERE id = %s',
                          (data['value'], row_id))
            except psycopg2.Error as e:
                return jsonify({'error': str(e)}), 500
        else:
            try:
                # Disable foreign key checks
                cursor.execute("SET FOREIGN_KEY_CHECKS=0")
                cursor.execute(f"UPDATE {table_name} SET {column} = %s WHERE id = %s",
                             (data['value'], row_id))
                # Re-enable foreign key checks
                cursor.execute("SET FOREIGN_KEY_CHECKS=1")
            except mysql.connector.Error as e:
                return jsonify({'error': str(e)}), 500

        connection.commit()
        return jsonify({'success': True})

    except Exception as e:
        logger.error(f"Error updating cell in {table_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'connection' in locals():
            connection.close()
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        if current_db_config.get('db_type') == 'postgresql':
            try:
                # Disable foreign key checks
                cursor.execute("SET session_replication_role = 'replica';")
                # Delete the row
                cursor.execute(f'DELETE FROM "{table_name}" WHERE id = %s', (row_id,))
                # Re-enable foreign key checks
                cursor.execute("SET session_replication_role = 'origin';")
            except psycopg2.Error as e:
                return jsonify({'error': str(e)}), 500
        else:
            # MySQL
            try:
                # Disable foreign key checks
                cursor.execute("SET FOREIGN_KEY_CHECKS=0")
                # Delete the row
                cursor.execute(f"DELETE FROM {table_name} WHERE id = %s", (row_id,))
                # Re-enable foreign key checks
                cursor.execute("SET FOREIGN_KEY_CHECKS=1")
            except mysql.connector.Error as e:
                return jsonify({'error': str(e)}), 500

        connection.commit()
        return jsonify({'success': True})

    except Exception as e:
        logger.error(f"Error deleting row from {table_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'connection' in locals():
            connection.close()

# Update schema endpoint without referrer check
@app.route('/schema')
def get_schema():
    try:
        global current_db_config
        
        if not current_db_config:
            logger.error("No database configured for schema request")
            return jsonify({'error': 'No database configured'}), 400
            
        tables = {}
        relationships = []

        # Get schema information based on database type
        if current_db_config.get('db_type') == 'postgresql':
            connection = get_db_connection()
            cursor = connection.cursor()
            
            # Get all tables
            cursor.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
            """)
            table_names = [row[0] for row in cursor.fetchall()]
            
            # Get columns for each table
            for table_name in table_names:
                if table_name not in IGNORED_TABLES:
                    try:
                        # Get columns
                        cursor.execute("""
                            SELECT
                                column_name,
                                data_type,
                                is_nullable,
                                column_default,
                                (SELECT true
                                 FROM pg_index i
                                 JOIN pg_attribute a ON a.attrelid = i.indrelid
                                 AND a.attnum = ANY(i.indkey)
                                 WHERE i.indrelid = pc.table_name::regclass
                                 AND i.indisprimary
                                 AND a.attname = pc.column_name)
                                as is_primary
                            FROM information_schema.columns pc
                            WHERE table_schema = 'public'
                            AND table_name = %s
                            ORDER BY ordinal_position
                        """, (table_name,))
                    except psycopg2.Error as e:
                        logger.warning(f"Skipping table {table_name}: {str(e)}")
                        continue
                    
                    columns = []
                    for col in cursor.fetchall():
                        columns.append({
                            'name': col[0],
                            'type': col[1],
                            'is_nullable': col[2] == 'YES',
                            'default': col[3],
                            'is_primary': col[4] or False
                        })
                    
                    tables[table_name] = columns
                    
                    try:
                        # Create a new cursor with RealDictCursor for foreign keys
                        dict_cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                        dict_cursor.execute("""
                            SELECT
                                con.conname as constraint_name,
                                src.relname as table_name,
                                att.attname as column_name,
                                dst.relname as foreign_table_name,
                                att2.attname as foreign_column_name
                            FROM pg_constraint con
                            JOIN pg_class src ON src.oid = con.conrelid
                            JOIN pg_class dst ON dst.oid = con.confrelid
                            JOIN pg_namespace nsp ON nsp.oid = con.connamespace
                            JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
                            JOIN pg_attribute att2 ON att2.attrelid = con.confrelid AND att2.attnum = ANY(con.confkey)
                            WHERE con.contype = 'f'
                            AND nsp.nspname = 'public'
                            AND src.relname = %s;
                        """, (table_name,))
                        
                        fk_results = dict_cursor.fetchall()
                        
                        for row in fk_results:
                            
                            if row['foreign_table_name'] not in IGNORED_TABLES:
                                rel = {
                                    'from': {
                                        'table': row['table_name'],
                                        'column': row['column_name']
                                    },
                                    'to': {
                                        'table': row['foreign_table_name'],
                                        'column': row['foreign_column_name']
                                    }
                                }
                                relationships.append(rel)
                        dict_cursor.close()
                    except psycopg2.Error as e:
                        logger.warning(f"Error getting foreign keys for table {table_name}: {str(e)}")
                        continue
            
            cursor.close()
            connection.close()
        else:
            # MySQL connection with manual schema extraction
            connection = get_db_connection()
            cursor = connection.cursor(dictionary=True)
            
            # Get all tables
            cursor.execute("SHOW TABLES")
            table_names = [table['Tables_in_' + current_db_config['database']] for table in cursor.fetchall()]
            
            # Get columns and relationships for each table
            for table_name in table_names:
                if table_name not in IGNORED_TABLES:
                    try:
                        # Get columns with types and primary key info
                        cursor.execute(f"SHOW COLUMNS FROM {table_name}")
                        columns = []
                        for col in cursor.fetchall():
                            columns.append({
                                'name': col['Field'],
                                'type': col['Type'],
                                'is_nullable': col['Null'] == 'YES',
                                'default': col['Default'],
                                'is_primary': col['Key'] == 'PRI'
                            })
                        tables[table_name] = columns
                        
                        # Get foreign key relationships
                        cursor.execute("""
                            SELECT
                                COLUMN_NAME,
                                REFERENCED_TABLE_NAME,
                                REFERENCED_COLUMN_NAME
                            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                            WHERE TABLE_SCHEMA = DATABASE()
                            AND TABLE_NAME = %s
                            AND REFERENCED_TABLE_NAME IS NOT NULL
                        """, (table_name,))
                    except mysql.connector.Error as e:
                        logger.warning(f"Error processing table {table_name}: {str(e)}")
                        continue
                    
                    for fk in cursor.fetchall():
                        if fk['REFERENCED_TABLE_NAME'] not in IGNORED_TABLES:
                            relationships.append({
                                'from': {'table': table_name, 'column': fk['COLUMN_NAME']},
                                'to': {'table': fk['REFERENCED_TABLE_NAME'], 'column': fk['REFERENCED_COLUMN_NAME']}
                            })
            
            cursor.close()
            connection.close()

        # Define colors for tables
        theme_colors = [
            '#C5CAE9',  # theme-0 (Indigo)
            '#B2DFDB',  # theme-1 (Teal)
            '#F8BBD0',  # theme-2 (Pink)
            '#FFE0B2',  # theme-3 (Orange)
            '#C8E6C9',  # theme-4 (Green)
            '#E1BEE7',  # theme-5 (Purple)
            '#B3E5FC',  # theme-6 (Light Blue)
            '#FFF9C4',  # theme-7 (Yellow)
            '#D7CCC8',  # theme-8 (Brown)
            '#CFD8DC',  # theme-9 (Blue Grey)
        ]

        # Return the schema data for mermaid.js
        return jsonify({
            'tables': tables,
            'relationships': relationships,
            'theme_colors': theme_colors
        })

    except Exception as e:
        logger.error(f"Error generating schema: {e}")
        return jsonify({'error': str(e)}), 500

# Update CORS headers to be more permissive
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Cookie'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    return response

# Add error handlers
@app.errorhandler(500)
def handle_500(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(404)
def handle_404(e):
    logger.error(f"Not found: {e}")
    return jsonify({"error": "Not found"}), 404

# Modify the main block to ensure proper network binding
if __name__ == '__main__':
    try:
        # Remove database connection test
        # Create template directory if it doesn't exist
        os.makedirs(template_dir, exist_ok=True)
        logger.info(f"Template directory: {template_dir}")
        
        # Create static directory if it doesn't exist
        os.makedirs(os.path.join(static_dir, 'js'), exist_ok=True)
        
        # Start Flask app with proper host binding
        logger.info("Starting Flask app...")
        app.run(
            host='0.0.0.0',  # Allow all incoming connections
            port=5046,
            debug=True,     # Changed to False for security
            threaded=True,
            use_reloader=False  # Disable reloader when using threads
        )
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
