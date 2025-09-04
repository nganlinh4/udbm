from flask import Flask, render_template, jsonify, request, make_response, url_for, send_file
from flask_cors import CORS
import mysql.connector
import psycopg2

import psycopg2.extras
import time
import logging
import os
import json
import io
import csv
import pandas as pd
from datetime import timedelta, datetime, date
from decimal import Decimal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Suppress verbose debug logs from mysql.connector
logging.getLogger('mysql.connector').setLevel(logging.WARNING)

def make_json_serializable(obj):
    """
    Convert non-JSON-serializable objects to JSON-serializable formats.
    Handles timedelta, datetime, date, Decimal, and other common PostgreSQL types.
    """
    if isinstance(obj, timedelta):
        # Convert timedelta to string representation (e.g., "0:01:23.456789")
        return str(obj)
    elif isinstance(obj, (datetime, date)):
        # Convert datetime/date to ISO format string
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        # Convert Decimal to float
        return float(obj)
    elif isinstance(obj, (dict, list)):
        # Recursively process dictionaries and lists
        if isinstance(obj, dict):
            return {key: make_json_serializable(value) for key, value in obj.items()}
        else:
            return [make_json_serializable(item) for item in obj]
    else:
        # Return as-is for JSON-serializable types
        return obj

def process_database_rows(rows):
    """
    Process database rows to make them JSON serializable.
    """
    processed_rows = []
    for row in rows:
        if isinstance(row, dict):
            # Handle RealDictCursor results (PostgreSQL)
            processed_row = {key: make_json_serializable(value) for key, value in row.items()}
        else:
            # Handle regular cursor results or other formats
            processed_row = make_json_serializable(row)
        processed_rows.append(processed_row)
    return processed_rows

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


# Scan endpoint to list databases available for given credentials
@app.route('/api/scan/databases', methods=['POST'])
def scan_databases():
    try:
        data = request.json or {}
        db_type = (data.get('type') or data.get('db_type') or 'mysql').lower()
        host = data.get('host')
        user = data.get('user')
        password = data.get('password')

        if not host:
            return jsonify({'error': 'host is required'}), 400
        if not user:
            return jsonify({'error': 'user is required'}), 400
        # password may be empty; allow empty string

        if db_type == 'postgresql':
            # Need a database to connect to; try common postgres maintenance DB
            conn = psycopg2.connect(host=host, user=user, password=password, database=data.get('database') or 'postgres')
            cur = conn.cursor()
            cur.execute("""
                SELECT datname
                FROM pg_database
                WHERE datistemplate = false
                ORDER BY datname
            """)
            rows = cur.fetchall()
            cur.close()
            conn.close()
            dbs = [r[0] for r in rows]
        else:
            # MySQL: connect without selecting a specific database
            conn = mysql.connector.connect(host=host, user=user, password=password)
            cur = conn.cursor()
            cur.execute("SHOW DATABASES")
            rows = cur.fetchall()
            cur.close()
            conn.close()
            # Filter out system databases
            system_dbs = {"information_schema", "performance_schema", "mysql", "sys"}
            dbs = [r[0] for r in rows if isinstance(r, (list, tuple)) and r and r[0] not in system_dbs]

        return jsonify({'databases': dbs})
    except mysql.connector.Error as e:
        logger.error(f"Error scanning databases: {e}")
        # MySQL auth error code 1045 -> Unauthorized
        if getattr(e, 'errno', None) == 1045:
            return jsonify({'error': 'auth', 'message': str(e)}), 401
        return jsonify({'error': str(e)}), 400
    except psycopg2.Error as e:
        logger.error(f"Error scanning databases (pg): {e}")
        # PostgreSQL password/auth failure codes: 28P01 / 28000
        if getattr(e, 'pgcode', None) in ('28P01', '28000'):
            return jsonify({'error': 'auth', 'message': str(e)}), 401
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error scanning databases: {e}")
        return jsonify({'error': str(e)}), 400


# Scan endpoint to list users/roles available (best-effort; may require privileges)
@app.route('/api/scan/users', methods=['POST'])
def scan_users():
    try:
        data = request.json or {}
        db_type = (data.get('type') or data.get('db_type') or 'mysql').lower()
        host = data.get('host')
        user = data.get('user')
        password = data.get('password')

        if not host:
            return jsonify({'error': 'host is required'}), 400
        if not user:
            return jsonify({'error': 'user is required'}), 400
        # password may be empty

        if db_type == 'postgresql':
            conn = psycopg2.connect(host=host, user=user, password=password, database=data.get('database') or 'postgres')
            cur = conn.cursor()
            cur.execute("""
                SELECT rolname
                FROM pg_roles
                WHERE rolcanlogin
                ORDER BY rolname
            """)
            rows = cur.fetchall()
            cur.close()
            conn.close()
            users = [r[0] for r in rows]
        else:
            conn = mysql.connector.connect(host=host, user=user, password=password)
            cur = conn.cursor()
            # Access to mysql.user may be restricted; handle errors gracefully
            try:
                cur.execute("SELECT user FROM mysql.user")
                rows = cur.fetchall()
                users = sorted({r[0] for r in rows if isinstance(r, (list, tuple)) and r})
            except Exception:
                # Fallback: show only the current user
                users = [user]
            finally:
                cur.close()
                conn.close()

        return jsonify({'users': users})
    except mysql.connector.Error as e:
        logger.error(f"Error scanning users: {e}")
        if getattr(e, 'errno', None) == 1045:
            return jsonify({'error': 'auth', 'message': str(e)}), 401
        return jsonify({'error': str(e)}), 400
    except psycopg2.Error as e:
        logger.error(f"Error scanning users (pg): {e}")
        if getattr(e, 'pgcode', None) in ('28P01', '28000'):
            return jsonify({'error': 'auth', 'message': str(e)}), 401
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error scanning users: {e}")
        return jsonify({'error': str(e)}), 400

# Define tables to ignore
IGNORED_TABLES = {'SequelizeMeta'}

# Modify get_table_names() to include primary key info
def build_where_clause(filters, db_type='mysql'):
    """Build WHERE clause from filters dictionary"""
    if not filters:
        return "", []

    where_conditions = []
    params = []

    for column, values in filters.items():
        if not values:
            continue

        # Escape column name based on database type
        if db_type == 'postgresql':
            escaped_column = f'"{column}"'
        else:
            escaped_column = f'`{column}`'

        if len(values) == 1:
            where_conditions.append(f"{escaped_column} = %s")
            params.append(values[0])
        else:
            # Multiple values - use IN clause
            placeholders = ', '.join(['%s'] * len(values))
            where_conditions.append(f"{escaped_column} IN ({placeholders})")
            params.extend(values)

    where_clause = " WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    return where_clause, params

def build_order_clause(sort_column, sort_direction, db_type='mysql'):
    """Build ORDER BY clause from sort parameters"""
    if not sort_column:
        return ""

    # Escape column name based on database type
    if db_type == 'postgresql':
        escaped_column = f'"{sort_column}"'
    else:
        escaped_column = f'`{sort_column}`'

    direction = "ASC" if sort_direction == 'asc' else "DESC"
    return f" ORDER BY {escaped_column} {direction}"

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

        # Let client decide theme and language (OS defaults) unless cookies already exist
        preferred_theme = request.cookies.get('preferred_theme')
        preferred_language = request.cookies.get('preferred_language')

        response = make_response(render_template('index.html',
            tables=tables,
            preferred_theme=preferred_theme or '',
            preferred_language=preferred_language or '',
            has_database=bool(current_db_config)
        ))

        # Do not set defaults here; the frontend will apply OS-based defaults and may set cookies later
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

# Add endpoint to get unique values for a column
@app.route('/data/<table_name>/column/<column_name>/values')
def get_column_values(table_name, column_name):
    if table_name in IGNORED_TABLES:
        return jsonify({'error': 'Table is ignored'}), 400

    try:
        connection = get_db_connection()

        if current_db_config.get('db_type') == 'postgresql':
            cursor = connection.cursor()
            # Verify column exists
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
            """, (table_name, column_name))
            if not cursor.fetchone():
                return jsonify({'error': f'Column {column_name} does not exist in table {table_name}'}), 404

            # Get unique values (limit to reasonable number)
            query = f'SELECT DISTINCT "{column_name}" FROM "{table_name}" WHERE "{column_name}" IS NOT NULL ORDER BY "{column_name}" LIMIT 1000'
            cursor.execute(query)
            results = cursor.fetchall()
            values = [row[0] for row in results if row[0] is not None]
        else:
            cursor = connection.cursor(dictionary=True)
            # Verify column exists
            cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", (column_name,))
            if not cursor.fetchone():
                return jsonify({'error': f'Column {column_name} does not exist in table {table_name}'}), 404

            # Get unique values (limit to reasonable number)
            query = f"SELECT DISTINCT `{column_name}` FROM {table_name} WHERE `{column_name}` IS NOT NULL ORDER BY `{column_name}` LIMIT 1000"
            cursor.execute(query)
            results = cursor.fetchall()
            values = [row[column_name] for row in results if row[column_name] is not None]

        return jsonify({'values': values})
    except (mysql.connector.Error, psycopg2.Error) as e:
        logger.error(f"Error getting column values for {table_name}.{column_name}: {e}")
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Error getting column values for {table_name}.{column_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'connection' in locals():
            connection.close()

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

        # Get filter parameters
        filters = {}
        for key, value in request.args.items():
            if key.startswith('filter_'):
                column_name = key[7:]  # Remove 'filter_' prefix
                if value:  # Only add non-empty filters
                    # Parse multiple values separated by commas
                    filter_values = [v.strip() for v in value.split(',') if v.strip()]
                    if filter_values:
                        filters[column_name] = filter_values

        # Get sort parameters
        sort_column = request.args.get('sort_column')
        sort_direction = request.args.get('sort_direction', 'desc').lower()
        if sort_direction not in ['asc', 'desc']:
            sort_direction = 'desc'

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
                # Build WHERE clause for filters
                where_clause, filter_params = build_where_clause(filters, 'postgresql')

                # Get count with better error handling
                try:
                    count_query = f'SELECT COUNT(*) as count FROM "{table_name}"{where_clause}'
                    cursor.execute(count_query, filter_params)
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
                        # Use provided sort column or default to first column
                        if not columns:
                            raise ValueError("No columns available for sorting")

                        # Use provided sort column or default to first column
                        if sort_column and sort_column in columns:
                            effective_sort_column = sort_column
                        else:
                            effective_sort_column = columns[0]
                            if not sort_column:
                                sort_direction = 'desc'  # Default to desc for first column

                        # Build ORDER BY clause
                        order_clause = build_order_clause(effective_sort_column, sort_direction, 'postgresql')
                        query = f'SELECT * FROM "{table_name}"{where_clause}{order_clause} LIMIT %s OFFSET %s'

                        # Combine filter params with limit/offset params
                        query_params = filter_params + [limit, offset]
                        cursor.execute(query, query_params)
                        rows = cursor.fetchall()
                        # RealDictCursor already returns dict-like objects, process for JSON serialization
                        response['data'] = process_database_rows(rows)
                        response['limited'] = offset + limit < row_count
                    except (psycopg2.Error, ValueError) as e:
                        logger.error(f"Error fetching data from table {table_name}: {e}")
                        return jsonify({'error': f'Error fetching data: {str(e)}'}), 500
            except Exception as e:
                logger.error(f"PostgreSQL specific error for {table_name}: {str(e)}")
                raise
        else:
            # MySQL logic with filters
            where_clause, filter_params = build_where_clause(filters, 'mysql')

            count_query = f"SELECT COUNT(*) as count FROM {table_name}{where_clause}"
            cursor.execute(count_query, filter_params)
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
                # Use provided sort column or default to first column
                if sort_column and sort_column in columns:
                    effective_sort_column = sort_column
                else:
                    effective_sort_column = columns[0]
                    if not sort_column:
                        sort_direction = 'desc'  # Default to desc for first column

                # Build ORDER BY clause
                order_clause = build_order_clause(effective_sort_column, sort_direction, 'mysql')
                data_query = f"SELECT * FROM {table_name}{where_clause}{order_clause} LIMIT %s OFFSET %s"
                query_params = filter_params + [limit, offset]
                cursor.execute(data_query, query_params)
                rows = cursor.fetchall()
                response['data'] = process_database_rows(rows)
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

                # Process the new row for JSON serialization
                processed_row = make_json_serializable(dict(new_row))
                return jsonify(processed_row)
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
            # Process the new row for JSON serialization
            processed_row = make_json_serializable(new_row)
            return jsonify(processed_row)

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

@app.route('/delete/<table>/column/<column>/value/<value>', methods=['DELETE'])
def delete_rows_by_column_value(table, column, value):
    connection = None
    try:
        # Validate input parameters
        if table in IGNORED_TABLES:
            return jsonify({'error': 'Cannot delete from ignored table'}), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        # Validate table exists
        if current_db_config.get('db_type') == 'postgresql':
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = %s
                )
            """, (table,))
            table_exists = cursor.fetchone()[0]
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE()
                AND table_name = %s
            """, (table,))
            table_exists = cursor.fetchone()[0] > 0

        if not table_exists:
            return jsonify({'error': 'Table not found'}), 404

        # Validate column exists
        if current_db_config.get('db_type') == 'postgresql':
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = %s
                    AND column_name = %s
                )
            """, (table, column))
            column_exists = cursor.fetchone()[0]
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                AND table_name = %s
                AND column_name = %s
            """, (table, column))
            column_exists = cursor.fetchone()[0] > 0

        if not column_exists:
            return jsonify({'error': 'Column not found in table'}), 404

        # Build safe query using properly quoted identifiers
        if current_db_config.get('db_type') == 'postgresql':
            query = f'DELETE FROM "{table}" WHERE "{column}" = %s'
        else:
            query = f'DELETE FROM `{table}` WHERE `{column}` = %s'

        # Execute delete with parameterized value
        cursor.execute(query, (value,))
        affected_rows = cursor.rowcount
        connection.commit()

        return jsonify({
            'success': True,
            'message': f'Deleted {affected_rows} row(s)',
            'deleted_rows': affected_rows
        })

    except (mysql.connector.Error, psycopg2.Error) as e:
        logger.error(f"Database error deleting rows: {str(e)}")
        if connection:
            connection.rollback()
        error_msg = str(e)
        if 'foreign key constraint' in error_msg.lower():
            return jsonify({'error': 'Cannot delete due to foreign key constraints'}), 409
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        if connection:
            connection.rollback()
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        if connection:
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

def calculate_d3_metadata(tables, relationships):
    """Calculate metadata for D3 force-directed layout optimization"""

    # Count relationships per table to identify hub tables
    node_weights = {}
    for table_name in tables.keys():
        if table_name not in IGNORED_TABLES:
            node_weights[table_name] = 0

    # Count incoming and outgoing relationships
    for rel in relationships:
        from_table = rel['from']['table']
        to_table = rel['to']['table']

        if from_table not in IGNORED_TABLES:
            node_weights[from_table] = node_weights.get(from_table, 0) + 1
        if to_table not in IGNORED_TABLES:
            node_weights[to_table] = node_weights.get(to_table, 0) + 1

    # Identify primary tables (high relationship count)
    max_weight = max(node_weights.values()) if node_weights else 0
    primary_tables = [table for table, weight in node_weights.items()
                     if weight >= max_weight * 0.7 and weight > 2]

    # Generate cluster hints based on table naming patterns
    cluster_hints = {}
    for table_name in tables.keys():
        if table_name not in IGNORED_TABLES:
            # Simple clustering based on common prefixes/suffixes
            if any(keyword in table_name.lower() for keyword in ['user', 'account', 'auth']):
                cluster_hints[table_name] = 'user_management'
            elif any(keyword in table_name.lower() for keyword in ['order', 'payment', 'transaction']):
                cluster_hints[table_name] = 'commerce'
            elif any(keyword in table_name.lower() for keyword in ['product', 'item', 'catalog']):
                cluster_hints[table_name] = 'catalog'
            elif any(keyword in table_name.lower() for keyword in ['log', 'audit', 'history']):
                cluster_hints[table_name] = 'logging'
            else:
                cluster_hints[table_name] = 'general'

    return {
        'node_weights': node_weights,
        'primary_tables': primary_tables,
        'cluster_hints': cluster_hints,
        'total_tables': len([t for t in tables.keys() if t not in IGNORED_TABLES]),
        'total_relationships': len(relationships)
    }

# Update schema endpoint without referrer check
@app.route('/schema')
def get_schema():
    try:
        schema_type = request.args.get('type', 'mermaid')
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

        # Handle D3 force-directed format
        if schema_type == 'd3':
            # Calculate metadata for D3 force-directed layout
            d3_metadata = calculate_d3_metadata(tables, relationships)

            return jsonify({
                'tables': tables,
                'relationships': relationships,
                'theme_colors': theme_colors,
                'd3_metadata': d3_metadata
            })

        # Default: Return mermaid.js format
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

# Add custom query endpoint
@app.route('/download/xlsx', methods=['POST'])
def download_xlsx():
    try:
        data = request.json
        if not data or not data.get('data') or not data.get('filename'):
            return jsonify({'error': 'Invalid request data'}), 400

        # Convert JSON data to pandas DataFrame
        df = pd.DataFrame(data['data'])

        # Process DataFrame before converting to Excel
        for column in df.columns:
            # Convert JSON objects in cells to strings
            df[column] = df[column].apply(lambda x:
                json.dumps(x, ensure_ascii=False) if isinstance(x, dict) else x
            )

        # Create a BytesIO object to store the Excel file
        excel_file = io.BytesIO()

        # Write to Excel file
        df.to_excel(excel_file, index=False, engine='openpyxl')
        excel_file.seek(0)

        return send_file(
            excel_file,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=data['filename']
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/download/<table_name>/csv')
def download_table_csv(table_name):
    try:
        connection = get_db_connection()
        cursor = None

        if current_db_config.get('db_type') == 'postgresql':
            cursor = connection.cursor()
        else:
            cursor = connection.cursor(dictionary=True)

        # Get column names
        if current_db_config.get('db_type') == 'postgresql':
            cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 0')
            columns = [desc[0] for desc in cursor.description]
            cursor.fetchall()  # Fetch (and discard) results before closing
        else:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 0")
            columns = [desc[0] for desc in cursor.description]
            cursor.fetchall()  # Fetch (and discard) results before closing

        # Close and create new cursor to avoid unread results
        cursor.close()
        if current_db_config.get('db_type') == 'postgresql':
            cursor = connection.cursor()
        else:
            cursor = connection.cursor(dictionary=True)

        # Create in-memory file
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(columns)

        # Fetch and write data in chunks with proper cursor handling
        chunk_size = 5000
        offset = 0

        while True:
            if current_db_config.get('db_type') == 'postgresql':
                query = f'SELECT * FROM "{table_name}" ORDER BY "{columns[0]}" LIMIT %s OFFSET %s'
            else:
                query = f"SELECT * FROM {table_name} ORDER BY `{columns[0]}` LIMIT %s OFFSET %s"

            cursor.execute(query, (chunk_size, offset))
            rows = cursor.fetchall()
            if not rows:
                break

            for row in rows:
                if current_db_config.get('db_type') == 'postgresql':
                    processed_row = []
                    for value in row:
                        processed_row.append(json.dumps(value) if isinstance(value, (dict, list))
                                          else (str(value) if value is not None else ''))
                else:
                    processed_row = []
                    for col in columns:
                        value = row[col] if isinstance(row, dict) else row[columns.index(col)]
                        processed_row.append(json.dumps(value) if isinstance(value, (dict, list))
                                          else (str(value) if value is not None else ''))
                writer.writerow(processed_row)

            offset += chunk_size
            connection.commit()  # Clear any pending results

        # Prepare response
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'{table_name}_{time.strftime("%Y%m%d_%H%M%S")}.csv'
        )

    except Exception as e:
        logger.error(f"Error downloading CSV for table {table_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if 'connection' in locals():
            connection.close()

@app.route('/download/<table_name>/xlsx')
def download_table_xlsx(table_name):
    try:
        connection = get_db_connection()
        cursor = None

        # First get column names
        if current_db_config.get('db_type') == 'postgresql':
            cursor = connection.cursor()
            cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 0')
        else:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 0")
        cursor.fetchall()  # Fetch (and discard) results before closing

        columns = [desc[0] for desc in cursor.description]
        cursor.close()

        # Create a new cursor for data fetching
        if current_db_config.get('db_type') == 'postgresql':
            cursor = connection.cursor()
        else:
            cursor = connection.cursor(dictionary=True)

        # Create Excel file in memory
        output = io.BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
        workbook = writer.book
        worksheet = workbook.add_worksheet(table_name)

        # Write headers
        for col_num, column in enumerate(columns):
            worksheet.write(0, col_num, column)

        # Fetch and write data in chunks
        chunk_size = 5000
        offset = 0
        row_num = 1

        while True:
            if current_db_config.get('db_type') == 'postgresql':
                query = f'SELECT * FROM "{table_name}" ORDER BY "{columns[0]}" LIMIT %s OFFSET %s'
            else:
                query = f"SELECT * FROM {table_name} ORDER BY `{columns[0]}` LIMIT %s OFFSET %s"

            cursor.execute(query, (chunk_size, offset))
            rows = cursor.fetchall()
            if not rows:
                break

            for row in rows:
                for col_num, value in enumerate(row if isinstance(row, (list, tuple)) else [row[col] for col in columns]):
                    if isinstance(value, (dict, list)):
                        worksheet.write(row_num, col_num, json.dumps(value, ensure_ascii=False))
                    else:
                        worksheet.write(row_num, col_num, str(value) if value is not None else '')
                row_num += 1

            offset += chunk_size
            connection.commit()  # Clear any pending results

        writer.close()
        output.seek(0)

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'{table_name}_{time.strftime("%Y%m%d_%H%M%S")}.xlsx'
        )

    except Exception as e:
        logger.error(f"Error downloading XLSX for table {table_name}: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if 'connection' in locals():
            connection.close()

@app.route('/execute_query', methods=['POST'])
def execute_query():
    if not current_db_config:
        return jsonify({'error': 'No database configured'}), 400

    try:
        data = request.json
        if not data or 'query' not in data:
            return jsonify({'error': 'No query provided'}), 400

        query = data['query'].strip()
        if not query:
            return jsonify({'error': 'Empty query'}), 400

        connection = get_db_connection()
        cursor = None

        try:
            # Use buffered cursor to prevent "Unread result found" errors
            if current_db_config.get('db_type') == 'postgresql':
                cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            else:
                cursor = connection.cursor(dictionary=True, buffered=True)

            cursor.execute(query)

            # Check if query returns results by examining cursor description
            if cursor.description:
                # Query returns results (SELECT, SHOW, DESCRIBE, EXPLAIN, etc.)
                results = cursor.fetchall()
                if isinstance(results, list):
                    results = [dict(row) for row in results]

                # For queries that return results, also check if there are more result sets
                # This handles cases like stored procedures with multiple result sets
                all_results = [results]
                if hasattr(cursor, 'nextset'):
                    try:
                        while cursor.nextset():
                            if cursor.description:
                                more_results = cursor.fetchall()
                                if isinstance(more_results, list):
                                    more_results = [dict(row) for row in more_results]
                                all_results.append(more_results)
                    except Exception:
                        # No more result sets or error - that's fine
                        pass

                # If only one result set, return it directly; otherwise return all
                final_results = all_results[0] if len(all_results) == 1 else all_results

                return jsonify({
                    'success': True,
                    'results': final_results,
                    'rowCount': len(final_results) if isinstance(final_results, list) else sum(len(r) for r in final_results),
                    'hasMultipleResultSets': len(all_results) > 1
                })
            else:
                # Query doesn't return results (INSERT, UPDATE, DELETE, etc.)
                connection.commit()
                rowcount = cursor.rowcount if cursor.rowcount >= 0 else 0
                return jsonify({
                    'success': True,
                    'message': f'Query executed successfully. Rows affected: {rowcount}',
                    'rowCount': rowcount
                })

        finally:
            if cursor:
                cursor.close()
            connection.close()

    except Exception as e:
        logger.error(f"Error executing custom query: {e}")
        return jsonify({'error': str(e)}), 500

# Local image serving endpoint
@app.route('/api/local-image')
def serve_local_image():
    """
    Serve local images for the image display feature.
    Accepts a 'path' parameter with the full local file path.
    """
    try:
        logger.info(f"Local image request received. Args: {request.args}")
        image_path = request.args.get('path')
        logger.info(f"Requested image path: {image_path}")

        if not image_path:
            logger.error("No path parameter provided")
            return jsonify({'error': 'No path parameter provided'}), 400

        # Security check: ensure the path exists and is a file
        if not os.path.exists(image_path):
            logger.error(f"File not found: {image_path}")
            return jsonify({'error': 'File not found'}), 404

        if not os.path.isfile(image_path):
            logger.error(f"Path is not a file: {image_path}")
            return jsonify({'error': 'Path is not a file'}), 400

        # Check if it's an image file by extension
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'}
        file_ext = os.path.splitext(image_path)[1].lower()
        if file_ext not in image_extensions:
            logger.error(f"File is not a supported image format: {image_path}")
            return jsonify({'error': 'File is not a supported image format'}), 400

        # Determine MIME type
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        }

        mime_type = mime_types.get(file_ext, 'application/octet-stream')
        logger.info(f"Serving image: {image_path} with MIME type: {mime_type}")

        # Serve the file
        return send_file(
            image_path,
            mimetype=mime_type,
            as_attachment=False,
            download_name=os.path.basename(image_path)
        )

    except Exception as e:
        logger.error(f"Error serving local image: {e}")
        return jsonify({'error': f'Failed to serve image: {str(e)}'}), 500

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
            port=5080,
            debug=False,    # Set to False for production
            threaded=True,
            use_reloader=False  # Disable reloader when using threads
        )
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
