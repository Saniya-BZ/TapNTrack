from flask import Flask, render_template, request, redirect, url_for, jsonify, session, Blueprint
import psycopg2
from psycopg2.extras import RealDictCursor
from functools import wraps
from datetime import datetime, timedelta
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash


app = Flask(__name__)

print("Starting Flask application...")


CORS(app, 
     resources={r"/api/*": {"origins": "http://localhost:3000"}},
     supports_credentials=True)

app.config['SECRET_KEY'] = 'rfid-admin-dev-secret-key-2024'

# main where rfid logs data are coming
@app.route("/access", methods=["POST"])
def handle_access():
    print("----- RECEIVED ACCESS REQUEST -----")
    
    # Print raw request data
    print("Raw Request:", request)
    
    data = request.get_json()
    print("Parsed JSON Data:", data)
    
    # Validate required fields
    required_fields = ['uid', 'time', 'access']  # Remove product_id from required fields
    for field in required_fields:
        if field not in data:
            error_msg = f"Missing required field: {field}"
            print(f"VALIDATION ERROR: {error_msg}")
            return jsonify({
                "message": error_msg,
                "status": "error"
            }), 400
    
    # Get product_id or set to NULL if not found
    product_id = data.get('product_id')
    
    print(f"Access attempt - UID: {data['uid']}, Product: {product_id or 'Unknown'}, Status: {data['access']}")
    
    try:
        # Store in database
        print("Connecting to database...")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First check if the product_id exists in productstable
        if product_id:
            cursor.execute("SELECT 1 FROM productstable WHERE product_id = %s", (product_id,))
            product_exists = cursor.fetchone() is not None
        else:
            product_exists = False
            
        # If product doesn't exist, set it to NULL for the insert
        if not product_exists:
            print(f"Warning: Product {product_id} does not exist in products table. Setting to NULL.")
            product_id = None
        
        print("Executing database insert...")
        cursor.execute("""
            INSERT INTO access_requests (uid, timestamp, product_id, access_status)
            VALUES (%s, %s, %s, %s)
        """, (data['uid'], data['time'], product_id, data['access']))
        
        print(f"Database insert successful, rows affected: {cursor.rowcount}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        response_data = {
            "message": "Access request processed successfully",
            "data": data,
            "status": "success",
            "product_found": product_exists
        }
        
        print("Response Data Sent to Client:", response_data)
        print("----- ACCESS REQUEST COMPLETED -----")
        return jsonify(response_data)
        
    except Exception as e:
        print(f"ERROR PROCESSING ACCESS REQUEST: {str(e)}")
        import traceback
        traceback.print_exc()
        
        error_response = {
            "message": f"Error processing access request: {str(e)}",
            "status": "error"
        }
        print("Error Response:", error_response)
        return jsonify(error_response), 500


# Simple session dictionary - will be reset on server restart
active_sessions = {}

# Database connection parameters
DB_HOST = "localhost"
DB_NAME = "accessdb"
DB_USER = "postgres"
DB_PASSWORD = "postgres"
DB_PORT = "5432"

# Database connection function
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None


# # Helper function to convert database records to JSON-serializable format
def serialize_record(record):
    if not record:
        return None
        
    # Convert to dict if it's not already
    if not isinstance(record, dict):
        record = dict(record)
    
    # Convert non-serializable types
    for key, value in record.items():
        if isinstance(value, datetime):
            record[key] = value.isoformat()
        elif isinstance(value, timedelta):
            record[key] = value.total_seconds()
    
    return record



def init_users_table():
    """Initialize the users table and create default admin user"""
    try:
        print("Starting user table initialization...")
        conn = get_db_connection()
        if not conn:
            print("Failed to connect to database during initialization")
            return
            
        cursor = conn.cursor()
        
        # Create users table if it doesn't exist
        print("Creating users table if it doesn't exist...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'manager',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        
        # Check if there are any users
        print("Checking if users exist...")
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()['count']
        print(f"Found {user_count} existing users")
        
        # Create default admin user if no users exist
        if user_count == 0:
            print("Creating default admin user...")
            hashed_password = generate_password_hash('VSDevelopers')
            cursor.execute("""
                INSERT INTO users (email, password, role)
                VALUES (%s, %s, %s)
            """, ('zenvinnovations.com', hashed_password, 'admin'))
            
            print("Created default admin user: zenvinnovations.com")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("Users table initialized successfully")
        
    except Exception as e:
        print(f"Error initializing users table: {str(e)}")
        # Add more detail about the error
        import traceback
        traceback.print_exc()
# Initialize the users table when the app starts
print("Initializing users table...")
init_users_table()


#################
# API ENDPOINTS #
#################

# Instead, define the login route directly on the app
@app.route('/api/login', methods=['POST'])
def login():
    """Login endpoint that checks against users table"""
    try:
        data = request.get_json()
        print("Received login data:", data)  # Debugging
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # For testing, accept hardcoded credentials
        if email == "zenvinnovations.com" and password == "VSDevelopers":
            # Set session data
            session['authenticated'] = True
            session['user_id'] = 1
            session['email'] = email
            session['role'] = 'admin'
            
            print(f"Hardcoded user authenticated: {email} with role: admin")
            
            # Return user data
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': 1,
                    'email': email,
                    'role': 'admin'
                }
            })
        
        # Try database authentication
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Find user by email
        cursor.execute("SELECT id, email, password, role FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        # Check if user exists and password is correct
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Set session data
        session['authenticated'] = True
        session['user_id'] = user['id']
        session['email'] = user['email']
        session['role'] = user['role']
        
        print(f"User authenticated: {user['email']} with role: {user['role']}")  # Debugging
        
        # Return user data without password
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'role': user['role']
            }
        })
        
    except Exception as e:
        print(f"Login error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500





@app.route('/api/logout', methods=['POST'])
# @api_auth_required
def api_logout():
    auth_header = request.headers.get('Authorization')
    if auth_header:
        token = auth_header.split('Bearer ')[1] if 'Bearer ' in auth_header else auth_header
        if token in active_sessions:
            active_sessions.pop(token)
            return jsonify({'success': True, 'message': 'Logged out successfully'})
    
    return jsonify({'error': 'Invalid session'}), 400

@app.route('/api/dashboard')
# @api_auth_required
def api_dashboard():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Total entries
        cursor.execute("SELECT COUNT(*) as total FROM access_requests")
        total_entries = cursor.fetchone()['total']
        
        # Today's entries
        today = datetime.now().strftime('%Y-%m-%d')
        cursor.execute("SELECT COUNT(*) as count FROM access_requests WHERE DATE(created_at) = %s", (today,))
        today_entries = cursor.fetchone()['count']
        
        # Get unique rooms (assuming product_id is room)
        cursor.execute("SELECT COUNT(DISTINCT product_id) as count FROM access_requests")
        unique_rooms = cursor.fetchone()['count']
        
        # Get unique users (assuming uid is user)
        cursor.execute("SELECT COUNT(DISTINCT uid) as count FROM access_requests")
        unique_users = cursor.fetchone()['count']
        
        # Get access status counts
        cursor.execute("SELECT COUNT(*) as count FROM access_requests WHERE access_status LIKE '%Granted%'")
        granted_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM access_requests WHERE access_status LIKE '%Denied%'")
        denied_count = cursor.fetchone()['count']
        
        # Get daily trend data (last 7 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=6)
        
        # Format dates for SQL
        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = (end_date + timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Get daily counts
        cursor.execute("""
            SELECT DATE(created_at) as check_date, COUNT(*) as count
            FROM access_requests
            WHERE created_at >= %s AND created_at < %s
            GROUP BY check_date
            ORDER BY check_date
        """, (start_date_str, end_date_str))
        
        daily_data = {}
        for row in cursor.fetchall():
            # Convert date to string for JSON serialization
            daily_data[row['check_date'].strftime('%Y-%m-%d')] = row['count']
        
        # Fill in date sequence and counts
        daily_labels = []
        daily_counts = []
        current_date = start_date
        
        while current_date <= end_date:
            date_str = current_date.strftime('%Y-%m-%d')
            daily_labels.append(date_str)
            count = daily_data.get(date_str, 0)
            daily_counts.append(count)
            current_date += timedelta(days=1)
        
        # Get recent entries
        cursor.execute("SELECT * FROM access_requests ORDER BY created_at DESC LIMIT 10")
        recent_entries = cursor.fetchall()
        
        # Convert recent entries to serializable format
        serialized_entries = []
        for entry in recent_entries:
            serialized_entry = serialize_record(entry)
            serialized_entries.append(serialized_entry)
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'total_entries': total_entries,
            'today_entries': today_entries,
            'unique_rooms': unique_rooms,
            'unique_users': unique_users,
            'granted_count': granted_count,
            'denied_count': denied_count,
            'daily_labels': daily_labels,
            'daily_counts': daily_counts,
            'recent_entries': serialized_entries
        })
    except Exception as e:
        print(f"Dashboard API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'An error occurred fetching dashboard data'}), 500

@app.route('/api/rfid_entries')
# @api_auth_required
def api_rfid_entries():
    try:
        # Pagination
        page = request.args.get('page', 1, type=int)
        per_page = 10
        offset = (page - 1) * per_page
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Get total count for pagination
        cursor.execute("SELECT COUNT(*) as total FROM access_requests")
        total_entries = cursor.fetchone()['total']
        
        # Get entries for current page
        cursor.execute("""
            SELECT * FROM access_requests
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, (per_page, offset))
        entries = cursor.fetchall()
        
        # Convert entries to serializable format
        serialized_entries = []
        for entry in entries:
            serialized_entry = serialize_record(entry)
            serialized_entries.append(serialized_entry)
        
        cursor.close()
        conn.close()
        
        # Calculate total pages
        total_pages = (total_entries + per_page - 1) // per_page
        
        return jsonify({
            'entries': serialized_entries,
            'page': page,
            'total_pages': total_pages,
            'total_entries': total_entries
        })
    except Exception as e:
        print(f"RFID Entries API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'An error occurred fetching RFID entries'}), 500
    
@app.route('/api/checkin_trends')
# @api_auth_required
def api_checkin_trends():
    try:
        # Get query parameters
        period = request.args.get('period', '7')
        
        # Handle custom date range
        if period == 'custom':
            start_date_str = request.args.get('start_date')
            end_date_str = request.args.get('end_date')
            
            if not start_date_str or not end_date_str:
                return jsonify({'error': 'Start date and end date required for custom period'}), 400
                
            # Parse date strings to datetime objects
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            # Calculate date range based on period
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=int(period))
            
        # Add one day to end_date to include the entire end day
        end_date_inclusive = end_date + timedelta(days=1)
            
        # Connect to database
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Get check-in data for the selected period
        cursor.execute("""
            SELECT 
                created_at,
                access_status
            FROM 
                access_requests
            WHERE 
                created_at >= %s AND created_at < %s
            ORDER BY 
                created_at
        """, (start_date, end_date_inclusive))
        
        # Fetch all access records
        access_records = cursor.fetchall()
        
        if not access_records:
            return jsonify({
                'error': 'No data available for the selected period',
                'total_entries': 0,
                'avg_daily': 0,
                'granted_count': 0,
                'granted_percentage': 0,
                'denied_count': 0,
                'denied_percentage': 0,
                'date_labels': [],
                'daily_counts': [],
                'hourly_counts': [0] * 24,
                'day_of_week_counts': [0] * 7,
                'max_daily': 0,
                'max_day': 'N/A',
                'min_daily': 0,
                'min_day': 'N/A',
                'most_active_hour': 0,
                'most_active_dow': 0
            })
        
        # Process the data
        daily_data = {}
        hourly_counts = [0] * 24
        day_of_week_counts = [0] * 7
        granted_count = 0
        denied_count = 0
        
        # Count check-ins by date, hour, and day of week
        for record in access_records:
            # Handle RealDictRow or regular tuple
            if isinstance(record, dict):
                timestamp = record.get('created_at')
                access_status = record.get('access_status', '')
            else:
                timestamp = record[0]
                access_status = record[1] if len(record) > 1 else ''
            
            # Skip if timestamp is None
            if not timestamp:
                continue
                
            # Get date components
            date_only = timestamp.date()
            hour = timestamp.hour
            day_of_week = timestamp.weekday()  # 0 is Monday, 6 is Sunday
            
            # Count by date
            if date_only not in daily_data:
                daily_data[date_only] = 0
            daily_data[date_only] += 1
            
            # Count by hour
            hourly_counts[hour] += 1
            
            # Count by day of week
            day_of_week_counts[day_of_week] += 1
            
            # Count by access status
            if 'granted' in access_status.lower():
                granted_count += 1
            elif 'denied' in access_status.lower():
                denied_count += 1
        
        # Sort dates and prepare labels and data for daily trend chart
        sorted_dates = sorted(daily_data.keys())
        date_labels = [date.strftime('%Y-%m-%d') for date in sorted_dates]
        daily_counts = [daily_data[date] for date in sorted_dates]
        
        # Calculate statistics
        total_entries = len(access_records)
        num_days = (sorted_dates[-1] - sorted_dates[0]).days + 1 if sorted_dates else 1
        avg_daily = total_entries / num_days
        
        # Calculate percentages
        granted_percentage = (granted_count / total_entries * 100) if total_entries > 0 else 0
        denied_percentage = (denied_count / total_entries * 100) if total_entries > 0 else 0
        
        # Find max and min daily check-ins
        max_daily = max(daily_data.values()) if daily_data else 0
        max_day_date = next((date for date, count in daily_data.items() if count == max_daily), None)
        max_day = max_day_date.strftime('%Y-%m-%d') if max_day_date else 'N/A'
        
        min_daily = min(daily_data.values()) if daily_data else 0
        min_day_date = next((date for date, count in daily_data.items() if count == min_daily), None)
        min_day = min_day_date.strftime('%Y-%m-%d') if min_day_date else 'N/A'
        
        # Find most active hour and day of week
        most_active_hour = hourly_counts.index(max(hourly_counts))
        most_active_dow = day_of_week_counts.index(max(day_of_week_counts))
        
        # Close database connection
        cursor.close()
        conn.close()
        
        # Return JSON response
        return jsonify({
            'total_entries': total_entries,
            'avg_daily': avg_daily,
            'granted_count': granted_count,
            'granted_percentage': granted_percentage,
            'denied_count': denied_count,
            'denied_percentage': denied_percentage,
            'date_labels': date_labels,
            'daily_counts': daily_counts,
            'hourly_counts': hourly_counts,
            'day_of_week_counts': day_of_week_counts,
            'max_daily': max_daily,
            'max_day': max_day,
            'min_daily': min_daily,
            'min_day': min_day,
            'most_active_hour': most_active_hour,
            'most_active_dow': most_active_dow
        })
        
    except Exception as e:
        print(f"Checkin Trends API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@app.route('/api/room_frequency', methods=['GET'])
def room_frequency_api():
    # Connect to database
    conn = get_db_connection()
    if not conn:
        return jsonify({
            'error': "Unable to connect to database",
            'room_stats': [],
            'total_rooms': 0,
            'total_access': 0,
            'avg_access_per_room': 0
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # First, verify data exists and log details
        cursor.execute("SELECT COUNT(*) FROM access_requests")
        total_records = cursor.fetchone()
        
        # Handle RealDictRow
        if isinstance(total_records, dict):
            record_count = total_records.get('count', 0)
        else:
            # Fallback for regular tuple
            record_count = total_records[0] if total_records else 0
        
        print(f"Total records in access_requests: {record_count}")
        
        if record_count == 0:
            return jsonify({
                'error': "No records found in access_requests table",
                'room_stats': [],
                'total_rooms': 0,
                'total_access': 0,
                'avg_access_per_room': 0
            }), 404
        
        # Query to get room access statistics
        cursor.execute("""
            SELECT 
                product_id,
                COUNT(*) AS total_access,
                SUM(CASE WHEN access_status LIKE '%Granted%' THEN 1 ELSE 0 END) AS access_granted,
                SUM(CASE WHEN access_status LIKE '%Denied%' THEN 1 ELSE 0 END) AS access_denied,
                COALESCE(
                    (SELECT EXTRACT(HOUR FROM created_at)
                     FROM access_requests ar2
                     WHERE ar2.product_id = ar.product_id
                     GROUP BY EXTRACT(HOUR FROM created_at)
                     ORDER BY COUNT(*) DESC
                     LIMIT 1),
                    -1
                ) AS most_active_hour,
                COALESCE(
                    (SELECT EXTRACT(DOW FROM created_at)
                     FROM access_requests ar2
                     WHERE ar2.product_id = ar.product_id
                     GROUP BY EXTRACT(DOW FROM created_at)
                     ORDER BY COUNT(*) DESC
                     LIMIT 1),
                    -1
                ) AS most_active_day
            FROM 
                access_requests ar
            GROUP BY 
                product_id
            ORDER BY 
                total_access DESC
        """)
        
        # Fetch room statistics
        room_stats = cursor.fetchall()
        
        # Debug print raw room stats
        print("Raw Room Stats:")
        for stat in room_stats:
            print(stat)
        
        # Day mapping
        day_mapping = {
            0: "Sunday", 1: "Monday", 2: "Tuesday", 
            3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday"
        }
        
        # Process room statistics
        processed_room_stats = []
        for stat in room_stats:
            # Handle RealDictRow or regular tuple
            if isinstance(stat, dict):
                room_stat = {
                    'room_id': str(stat.get('product_id', 'Unknown')),
                    'total_access': int(stat.get('total_access', 0)),
                    'access_granted': int(stat.get('access_granted', 0)),
                    'access_denied': int(stat.get('access_denied', 0)),
                    'most_active_hour': f"{int(stat.get('most_active_hour', -1))}:00" if stat.get('most_active_hour', -1) != -1 else 'N/A',
                    'most_active_day': day_mapping.get(int(stat.get('most_active_day', -1)), 'N/A') if stat.get('most_active_day', -1) != -1 else 'N/A'
                }
            else:
                # Fallback for regular tuple
                room_stat = {
                    'room_id': str(stat[0]) if stat[0] is not None else 'Unknown',
                    'total_access': int(stat[1]) if stat[1] is not None else 0,
                    'access_granted': int(stat[2]) if stat[2] is not None else 0,
                    'access_denied': int(stat[3]) if stat[3] is not None else 0,
                    'most_active_hour': f"{int(stat[4])}:00" if stat[4] is not None and stat[4] != -1 else 'N/A',
                    'most_active_day': day_mapping.get(int(stat[5]), 'N/A') if stat[5] is not None and stat[5] != -1 else 'N/A'
                }
            
            processed_room_stats.append(room_stat)
        
        # Calculate additional overall statistics
        total_rooms = len(processed_room_stats)
        total_access = sum(stat['total_access'] for stat in processed_room_stats)
        avg_access_per_room = total_access / total_rooms if total_rooms > 0 else 0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'room_stats': processed_room_stats,
            'total_rooms': total_rooms,
            'total_access': total_access,
            'avg_access_per_room': round(avg_access_per_room, 2)
        })
    
    except Exception as e:
        # Comprehensive error logging
        import traceback
        print("Detailed error in room_frequency route:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"An error occurred: {str(e)}",
            'room_stats': [],
            'total_rooms': 0,
            'total_access': 0,
            'avg_access_per_room': 0
        }), 500
    

@app.route('/api/manage_tables', methods=['GET', 'POST'])
def manage_tables_api():
    """
    API endpoint for managing products and cards tables
    GET: Retrieve current products and cards
    POST: Process changes to products and cards
    """
    # Check authentication (middleware would handle this in a real app)
    # Here we're assuming authentication is handled by a separate middleware
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database",
            'products': [],
            'cards': []
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # Handle POST request (form submission)
        if request.method == 'POST':
            try:
                # Get request JSON data
                data = request.get_json()
                
                if not data:
                    return jsonify({
                        'error': "No data provided"
                    }), 400
                
                product_changes = data.get('product_changes', [])
                card_changes = data.get('card_changes', [])
                
                # Process product changes
                for change in product_changes:
                    action = change.get('action')
                    product_id = change.get('product_id')
                    
                    if action == 'add':
                        room_id = change.get('room_id')
                        cursor.execute("""
                            INSERT INTO productstable (product_id, room_no) 
                            VALUES (%s, %s)
                            ON CONFLICT (product_id) DO UPDATE 
                            SET room_no = EXCLUDED.room_no
                        """, (product_id, room_id))
                    
                    elif action == 'delete':
                        cursor.execute("DELETE FROM productstable WHERE product_id = %s", (product_id,))
                
                # Process card changes
                for change in card_changes:
                    action = change.get('action')
                    product_id = change.get('product_id')
                    
                    if action == 'add':
                        card_id = change.get('card_id')
                        cursor.execute("""
                            INSERT INTO cardids (product_id, cardids) 
                            VALUES (%s, %s)
                            ON CONFLICT (product_id, cardids) DO UPDATE 
                            SET product_id = EXCLUDED.product_id
                        """, (product_id, card_id))
                    
                    elif action == 'delete':
                        card_id = change.get('card_id')
                        cursor.execute("DELETE FROM cardids WHERE product_id = %s AND cardids = %s", 
                                      (product_id, card_id))
                
                # Commit changes
                conn.commit()
                
                # Get updated data
                cursor.execute("SELECT product_id, room_no as room_id FROM productstable ORDER BY product_id")
                products = cursor.fetchall()
                
                cursor.execute("SELECT product_id, cardids as card_id FROM cardids ORDER BY product_id, cardids")
                cards = cursor.fetchall()
                
                cursor.close()
                conn.close()
                
                return jsonify({
                    'success': "Changes saved successfully!",
                    'products': products,
                    'cards': cards
                })
                
            except Exception as e:
                # Rollback in case of error
                conn.rollback()
                
                import traceback
                print("Error in manage_tables_api POST:")
                print(traceback.format_exc())
                
                return jsonify({
                    'error': f"Error saving changes: {str(e)}"
                }), 500
        
        # Handle GET request (retrieve current data)
        cursor.execute("SELECT product_id, room_no as room_id FROM productstable ORDER BY product_id")
        products = cursor.fetchall()
        
        cursor.execute("SELECT product_id, cardids as card_id FROM cardids ORDER BY product_id, cardids")
        cards = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'products': products,
            'cards': cards
        })
    
    except Exception as e:
        # Comprehensive error logging
        import traceback
        print("Detailed error in manage_tables_api route:")
        print(traceback.format_exc())
        
        if conn:
            conn.close()
        
        return jsonify({
            'error': f"An error occurred: {str(e)}",
            'products': [],
            'cards': []
        }), 500
    

@app.route('/api/product', methods=['POST'])
def add_product():
    """API endpoint for adding a single product"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        # Get request JSON data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': "No data provided"
            }), 400
        
        product_id = data.get('product_id')
        room_id = data.get('room_id')
        
        if not product_id or not room_id:
            return jsonify({
                'error': "Product ID and Room ID are required"
            }), 400
        
        cursor = conn.cursor()
        
        # Insert the new product
        cursor.execute("""
            INSERT INTO productstable (product_id, room_no) 
            VALUES (%s, %s)
            ON CONFLICT (product_id) DO UPDATE 
            SET room_no = EXCLUDED.room_no
        """, (product_id, room_id))
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': "Product added successfully!",
            'product': {
                'product_id': product_id,
                'room_id': room_id
            }
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in add_product API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error adding product: {str(e)}"
        }), 500


    
@app.route('/api/product/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    """API endpoint for deleting a single product and its related data"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # Begin transaction
        conn.autocommit = False
        
        # Get count of related records before deletion (for reporting)
        cursor.execute("SELECT COUNT(*) FROM cardids WHERE product_id = %s", (product_id,))
        related_cards = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) FROM access_requests WHERE product_id = %s", (product_id,))
        related_entries = cursor.fetchone()['count']
        
        # Delete related cards first
        cursor.execute("DELETE FROM cardids WHERE product_id = %s", (product_id,))
        
        # Delete related access entries
        cursor.execute("DELETE FROM access_requests WHERE product_id = %s", (product_id,))
        
        # Finally delete the product
        cursor.execute("DELETE FROM productstable WHERE product_id = %s", (product_id,))
        
        # Check if product was actually deleted
        if cursor.rowcount == 0:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"Product with ID {product_id} not found"
            }), 404
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': f"Product deleted successfully along with {related_cards} related cards and {related_entries} access entries"
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in delete_product API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error deleting product: {str(e)}"
        }), 500

@app.route('/api/card', methods=['POST'])
def add_card():
    """API endpoint for adding a single card"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        # Get request JSON data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': "No data provided"
            }), 400
        
        product_id = data.get('product_id')
        card_id = data.get('card_id')
        
        if not product_id or not card_id:
            return jsonify({
                'error': "Product ID and Card ID are required"
            }), 400
        
        cursor = conn.cursor()
        
        # Check if product exists
        cursor.execute("SELECT 1 FROM productstable WHERE product_id = %s", (product_id,))
        if cursor.fetchone() is None:
            conn.close()
            return jsonify({
                'error': f"Product with ID {product_id} does not exist"
            }), 400
        
        # Format card_id as a PostgreSQL array literal
        card_id_array = '{' + card_id + '}'
        
        # Check if the card already exists
        cursor.execute("SELECT 1 FROM cardids WHERE product_id = %s AND cardids = %s", 
                      (product_id, card_id_array))
        if cursor.fetchone() is not None:
            conn.close()
            return jsonify({
                'error': f"Card with Product ID {product_id} and Card ID {card_id} already exists"
            }), 400
            
        # Insert the new card without using ON CONFLICT
        cursor.execute("""
            INSERT INTO cardids (product_id, cardids) 
            VALUES (%s, %s)
        """, (product_id, card_id_array))
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': "Card added successfully!",
            'card': {
                'product_id': product_id,
                'card_id': card_id
            }
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in add_card API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error adding card: {str(e)}"
        }), 500
@app.route('/api/card/<product_id>/<card_id>', methods=['DELETE'])
def delete_card(product_id, card_id):
    """API endpoint for deleting a single card"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # Format card_id as a PostgreSQL array literal
        card_id_array = '{' + card_id + '}'
        
        # Delete the card
        cursor.execute("DELETE FROM cardids WHERE product_id = %s AND cardids = %s", 
                      (product_id, card_id_array))
        
        # Check if a row was actually deleted
        if cursor.rowcount == 0:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"Card with Product ID {product_id} and Card ID {card_id} not found"
            }), 404
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': "Card deleted successfully!"
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in delete_card API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error deleting card: {str(e)}"
        }), 500



@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all users"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database",
                'users': []
            }), 500
            
        cursor = conn.cursor()
        
        # Query all users
        cursor.execute("""
            SELECT id, email, role, created_at 
            FROM users 
            ORDER BY created_at DESC
        """)
        
        users = cursor.fetchall()
        
        # Convert to list of dictionaries if using RealDictCursor
        if users:
            # Make sure created_at is properly serialized
            for user in users:
                if 'created_at' in user and user['created_at']:
                    if isinstance(user['created_at'], datetime):
                        user['created_at'] = user['created_at'].isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify({'users': users})
        
    except Exception as e:
        print(f"Error getting users: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error fetching users: {str(e)}",
            'users': []
        }), 500

@app.route('/api/users', methods=['POST'])
def add_user():
    """Add a new user"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'manager')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
            
        # Validate email format
        if '@' not in email:
            return jsonify({'error': 'Invalid email format'}), 400
            
        # Validate role
        if role not in ['admin', 'manager']:
            return jsonify({'error': 'Invalid role. Must be admin or manager'}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            cursor.close()
            conn.close()
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Check if users table exists, create if not
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            print("Users table doesn't exist. Creating it now...")
            cursor.execute("""
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'manager',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            conn.commit()
            print("Users table created successfully")
        
        # Hash the password
        hashed_password = generate_password_hash(password)
        
        print(f"Adding new user: {email} with role: {role}")
        
        # Insert new user
        cursor.execute("""
            INSERT INTO users (email, password, role, created_at)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (email, hashed_password, role, datetime.now()))
        
        new_user_id = cursor.fetchone()['id']
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"User {email} added successfully with ID {new_user_id}")
        
        return jsonify({
            'message': 'User created successfully',
            'user_id': new_user_id
        }), 201
        
    except Exception as e:
        print(f"Error adding user: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error adding user: {str(e)}"}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
            
        # Prevent deleting the main admin account
        if user['email'] == 'zenvinnovations.com':
            cursor.close()
            conn.close()
            return jsonify({'error': 'Cannot delete the main admin account'}), 403
        
        print(f"Deleting user with ID {user_id} (email: {user['email']})")
        
        # Delete the user
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"User deleted successfully")
        
        return jsonify({'message': 'User deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting user: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error deleting user: {str(e)}"}), 500



if __name__ == '__main__':
    print("Starting Flask application...")
    app.config['DEBUG'] = True
    app.run(debug=True, host='0.0.0.0', port=5000)