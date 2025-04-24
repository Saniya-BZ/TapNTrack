from flask import Flask, render_template, request, redirect, url_for, jsonify, session, Blueprint
import psycopg2
from psycopg2.extras import RealDictCursor
from functools import wraps
from datetime import datetime, timedelta
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import re
import time


app = Flask(__name__)

print("Starting Flask application...")


CORS(app, 
     resources={r"/api/*": {"origins": "http://localhost:3000"}},
     supports_credentials=True)

@app.route("/access", methods=["POST"])
def handle_access():
    print("----- RECEIVED ACCESS REQUEST -----")
    
    # Print raw request data
    print("Raw Request:", request)
    
    data = request.get_json()
    print("Parsed JSON Data:", data)
    
    # Validate required fields
    required_fields = ['uid', 'time', 'access']
    
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
        
        # Check if the product_id exists in EITHER productstable OR vip_rooms
        product_exists = False
        if product_id:
            # Check productstable
            cursor.execute("SELECT 1 FROM productstable WHERE product_id = %s", (product_id,))
            if cursor.fetchone() is not None:
                product_exists = True
            else:
                # Check vip_rooms
                cursor.execute("SELECT 1 FROM vip_rooms WHERE product_id = %s", (product_id,))
                if cursor.fetchone() is not None:
                    product_exists = True
        
        # If product doesn't exist, set it to NULL for the insert
        if not product_exists and product_id:
            print(f"Warning: Product {product_id} does not exist in products or VIP rooms tables. Setting to NULL.")
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
            hashed_password = generate_password_hash('VSDevelopers@123')
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

# DASHBOARD ENDPOINT


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
    

# CHECKIN TRENDS ENDPOINT
        
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
            start_date = end_date - timedelta(days=int(period) - 1)  # Adjusted to include full range
            
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
        
        # Process the data
        daily_data = {}
        hourly_counts = [0] * 24
        day_of_week_counts = [0] * 7
        granted_count = 0
        denied_count = 0
        
        # Generate complete date range
        complete_date_range = []
        current_date = start_date
        while current_date <= end_date:
            # Initialize all dates with zero count
            daily_data[current_date] = 0
            complete_date_range.append(current_date)
            current_date += timedelta(days=1)
        
        if not access_records:
            # Return empty data with the complete date range
            sorted_dates = sorted(daily_data.keys())
            date_labels = [date.strftime('%Y-%m-%d') for date in sorted_dates]
            daily_counts = [0 for _ in sorted_dates]
            
            return jsonify({
                'total_entries': 0,
                'avg_daily': 0,
                'granted_count': 0,
                'granted_percentage': 0,
                'denied_count': 0,
                'denied_percentage': 0,
                'date_labels': date_labels,
                'daily_counts': daily_counts,
                'hourly_counts': hourly_counts,
                'day_of_week_counts': day_of_week_counts,
                'max_daily': 0,
                'max_day': 'N/A',
                'min_daily': 0,
                'min_day': 'N/A',
                'most_active_hour': 0,
                'most_active_dow': 0
            })
        
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
            
            # Count by date - date is already initialized with 0
            if date_only in daily_data:  # Only count if within our date range
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
        num_days = len(sorted_dates)
        avg_daily = total_entries / num_days if num_days > 0 else 0
        
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
        most_active_hour = hourly_counts.index(max(hourly_counts)) if max(hourly_counts) > 0 else 0
        most_active_dow = day_of_week_counts.index(max(day_of_week_counts)) if max(day_of_week_counts) > 0 else 0
        
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


# ROOM FREQUENCY ENDPOINT



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
        
        # First, check if access_requests table has data
        cursor.execute("SELECT COUNT(*) FROM access_requests")
        total_records = cursor.fetchone()
        
        # Handle RealDictRow
        if isinstance(total_records, dict):
            record_count = total_records.get('count', 0)
        else:
            # Fallback for regular tuple
            record_count = total_records[0] if total_records else 0
        
        print(f"Total records in access_requests: {record_count}")
        
        # Initialize empty array for processed stats
        processed_room_stats = []
        
        # Even if no access records, we'll still show rooms with zero stats
        if record_count > 0:
            # Get Room Access statistics for regular rooms
            cursor.execute("""
                SELECT 
                    ar.product_id,
                    p.room_no,
                    'Regular' as room_type,
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
                JOIN
                    productstable p ON ar.product_id = p.product_id
                GROUP BY 
                    ar.product_id, p.room_no
            """)
            
            regular_room_stats = cursor.fetchall()
            
            # Get data for VIP rooms that have access records
            cursor.execute("""
                SELECT 
                    ar.product_id,
                    v.vip_rooms,
                    'VIP' as room_type,
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
                JOIN
                    vip_rooms v ON ar.product_id = v.product_id
                GROUP BY 
                    ar.product_id, v.vip_rooms
            """)
            
            vip_room_stats = cursor.fetchall()
            
            # Process and combine the room statistics
            day_mapping = {
                0: "Sunday", 1: "Monday", 2: "Tuesday", 
                3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday"
            }
            
            # Process regular rooms with access data
            for stat in regular_room_stats:
                if isinstance(stat, dict):
                    room_stat = {
                        'room_id': str(stat.get('room_no', 'Unknown')),
                        'room_type': 'Regular',
                        'total_access': int(stat.get('total_access', 0)),
                        'access_granted': int(stat.get('access_granted', 0)),
                        'access_denied': int(stat.get('access_denied', 0)),
                        'most_active_hour': f"{int(stat.get('most_active_hour', -1))}:00" if stat.get('most_active_hour', -1) != -1 else 'N/A',
                        'most_active_day': day_mapping.get(int(stat.get('most_active_day', -1)), 'N/A') if stat.get('most_active_day', -1) != -1 else 'N/A'
                    }
                else:
                    # Fallback for regular tuple
                    room_stat = {
                        'room_id': str(stat[1]) if stat[1] is not None else 'Unknown',
                        'room_type': 'Regular',
                        'total_access': int(stat[3]) if stat[3] is not None else 0,
                        'access_granted': int(stat[4]) if stat[4] is not None else 0,
                        'access_denied': int(stat[5]) if stat[5] is not None else 0,
                        'most_active_hour': f"{int(stat[6])}:00" if stat[6] is not None and stat[6] != -1 else 'N/A',
                        'most_active_day': day_mapping.get(int(stat[7]), 'N/A') if stat[7] is not None and stat[7] != -1 else 'N/A'
                    }
                processed_room_stats.append(room_stat)
            
            # Process VIP rooms with access data
            for stat in vip_room_stats:
                if isinstance(stat, dict):
                    room_stat = {
                        'room_id': str(stat.get('vip_rooms', 'Unknown')),
                        'room_type': 'VIP',
                        'total_access': int(stat.get('total_access', 0)),
                        'access_granted': int(stat.get('access_granted', 0)),
                        'access_denied': int(stat.get('access_denied', 0)),
                        'most_active_hour': f"{int(stat.get('most_active_hour', -1))}:00" if stat.get('most_active_hour', -1) != -1 else 'N/A',
                        'most_active_day': day_mapping.get(int(stat.get('most_active_day', -1)), 'N/A') if stat.get('most_active_day', -1) != -1 else 'N/A'
                    }
                else:
                    # Fallback for regular tuple
                    room_stat = {
                        'room_id': str(stat[1]) if stat[1] is not None else 'Unknown',
                        'room_type': 'VIP',
                        'total_access': int(stat[3]) if stat[3] is not None else 0,
                        'access_granted': int(stat[4]) if stat[4] is not None else 0,
                        'access_denied': int(stat[5]) if stat[5] is not None else 0,
                        'most_active_hour': f"{int(stat[6])}:00" if stat[6] is not None and stat[6] != -1 else 'N/A',
                        'most_active_day': day_mapping.get(int(stat[7]), 'N/A') if stat[7] is not None and stat[7] != -1 else 'N/A'
                    }
                processed_room_stats.append(room_stat)
        
        # Get ALL regular rooms, including those without access records
        cursor.execute("""
            SELECT 
                product_id,
                room_no,
                'Regular' as room_type
            FROM 
                productstable p
            WHERE p.product_id NOT IN (SELECT DISTINCT product_id FROM access_requests)
        """)
        
        inactive_regular_rooms = cursor.fetchall()
        
        # Get ALL VIP rooms, including those without access records
        cursor.execute("""
            SELECT 
                product_id,
                vip_rooms,
                'VIP' as room_type
            FROM 
                vip_rooms v
            WHERE v.product_id NOT IN (SELECT DISTINCT product_id FROM access_requests)
        """)
        
        inactive_vip_rooms = cursor.fetchall()
        
        # Process inactive regular rooms
        for room in inactive_regular_rooms:
            if isinstance(room, dict):
                room_stat = {
                    'room_id': str(room.get('room_no', 'Unknown')),
                    'room_type': 'Regular',
                    'total_access': 0,
                    'access_granted': 0,
                    'access_denied': 0,
                    'most_active_hour': 'N/A',
                    'most_active_day': 'N/A'
                }
            else:
                room_stat = {
                    'room_id': str(room[1]) if room[1] is not None else 'Unknown',
                    'room_type': 'Regular',
                    'total_access': 0,
                    'access_granted': 0,
                    'access_denied': 0,
                    'most_active_hour': 'N/A',
                    'most_active_day': 'N/A'
                }
            processed_room_stats.append(room_stat)
            
        # Process inactive VIP rooms
        for room in inactive_vip_rooms:
            if isinstance(room, dict):
                room_stat = {
                    'room_id': str(room.get('vip_rooms', 'Unknown')),
                    'room_type': 'VIP',
                    'total_access': 0,
                    'access_granted': 0,
                    'access_denied': 0,
                    'most_active_hour': 'N/A',
                    'most_active_day': 'N/A'
                }
            else:
                room_stat = {
                    'room_id': str(room[1]) if room[1] is not None else 'Unknown',
                    'room_type': 'VIP',
                    'total_access': 0,
                    'access_granted': 0,
                    'access_denied': 0,
                    'most_active_hour': 'N/A',
                    'most_active_day': 'N/A'
                }
            processed_room_stats.append(room_stat)
        
        # If no rooms were found at all, return an appropriate message
        if len(processed_room_stats) == 0:
            return jsonify({
                'error': "No rooms found in the database",
                'room_stats': [],
                'total_rooms': 0,
                'total_access': 0,
                'avg_access_per_room': 0
            }), 404
        
        # Sort by total_access in descending order
        processed_room_stats = sorted(processed_room_stats, key=lambda x: x['total_access'], reverse=True)
        
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
        
        if conn:
            conn.close()
        
        return jsonify({
            'error': f"An error occurred: {str(e)}",
            'room_stats': [],
            'total_rooms': 0,
            'total_access': 0,
            'avg_access_per_room': 0
        }), 500

# MANAGE TABLES ENDPOINT
    


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
    
# ENDPOINT FOR ADDING A PRODUCT IN MANAGE TABLES
    

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



# ENDPOINT FOR DELETING A PRODUCT IN MANAGE TABLES 



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


    



# LOGIN ENDPOINT

@app.route('/api/login', methods=['POST'])
def login():
    """Login route that returns a JWT token"""
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password are required'}), 400
            
        username = data.get('username')
        password = data.get('password')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Find user by email (username is email in this case)
        cursor.execute("SELECT id, email, password, role FROM users WHERE email = %s", (username,))
        
        user = cursor.fetchone()
        
        # Verify credentials
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid username or password'}), 401
            
        # Generate a unique token
        token = str(uuid.uuid4())
        
        # Store token in sessions table (create if not exists)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                token VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # Set expiration to 24 hours from now
        expires_at = datetime.now() + timedelta(hours=24)
        
        # Insert the new session
        cursor.execute("""
            INSERT INTO sessions (user_id, token, expires_at)
            VALUES (%s, %s, %s)
        """, (user['id'], token, expires_at))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        # Return token and user info
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'role': user['role']
            },
            'expires_at': expires_at.isoformat()
        })
        
    except Exception as e:
        print(f"Error during login: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Login failed: {str(e)}"}), 500
    
# LOGOUT ENDPOINT
    
@app.route('/api/logout', methods=['POST'])
def logout():
    """Logout route that invalidates the current token"""
    try:
        # Get the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'message': 'Already logged out'}), 200
            
        # Extract the token
        token = auth_header.split(' ')[1]
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Delete the session
        cursor.execute("DELETE FROM sessions WHERE token = %s", (token,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Logged out successfully'})
        
    except Exception as e:
        print(f"Error during logout: {str(e)}")
        return jsonify({'error': f"Logout failed: {str(e)}"}), 500
    
# CHECK-SESSION ENDPOINT

@app.route('/api/check-session', methods=['GET'])
def check_session():
    """Check if current session is valid and return user info"""
    try:
        # Get current user from token
        current_user = get_current_user_from_token()
        
        if not current_user:
            return jsonify({'error': 'Authentication required', 'authenticated': False}), 401
            
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user['id'],
                'email': current_user['email'],
                'role': current_user['role']
            }
        })
        
    except Exception as e:
        print(f"Error checking session: {str(e)}")
        return jsonify({'error': f"Session check failed: {str(e)}", 'authenticated': False}), 500

 

def get_current_user_from_token():
    """Get the current user from the authentication token"""
    try:
        # Get the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
            
        # Extract the token
        token = auth_header.split(' ')[1]
        
        # Check if token exists in database or validate JWT token
        conn = get_db_connection()
        if not conn:
            return None
            
        cursor = conn.cursor()
        
        # Retrieve user associated with token
        cursor.execute("""
            SELECT u.id, u.email, u.role 
            FROM users u 
            JOIN sessions s ON u.id = s.user_id 
            WHERE s.token = %s AND s.expires_at > NOW()
        """, (token,))
        
        user = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        return user
    except Exception as e:
        print(f"Error getting current user: {str(e)}")
        return None

# GETTING USERS ENDPOINT
    

@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all users based on current user's role"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database",
                'users': []
            }), 500
            
        cursor = conn.cursor()
        
        # Adjust query based on role permissions
        if current_user['role'] == 'super_admin':
            # Super Admin can see all users with added_by info
            cursor.execute("""
                SELECT u.id, u.email, u.role, u.created_at, u.added_by_id,
                       a.email as added_by_email
                FROM users u
                LEFT JOIN users a ON u.added_by_id = a.id
                ORDER BY u.created_at DESC
            """)
        elif current_user['role'] == 'admin':
            # Admin can see all users except super_admins
            cursor.execute("""
                SELECT u.id, u.email, u.role, u.created_at, u.added_by_id,
                       a.email as added_by_email
                FROM users u
                LEFT JOIN users a ON u.added_by_id = a.id
                WHERE u.role != 'super_admin'
                ORDER BY u.created_at DESC
            """)
        elif current_user['role'] == 'manager':
            # Manager can only see managers and clerks
            cursor.execute("""
                SELECT u.id, u.email, u.role, u.created_at, u.added_by_id,
                       a.email as added_by_email
                FROM users u
                LEFT JOIN users a ON u.added_by_id = a.id
                WHERE u.role IN ('manager', 'clerk')
                ORDER BY u.created_at DESC
            """)
        elif current_user['role'] == 'clerk':
            # Clerks have no access to user management
            return jsonify({
                'error': "Insufficient permissions to view users",
                'users': []
            }), 403
        else:
            return jsonify({
                'error': "Invalid role or authentication required",
                'users': []
            }), 401
            
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
        
        return jsonify({
            'users': users,
            'currentUserRole': current_user['role'],
            'currentUserEmail': current_user['email']
        })
        
    except Exception as e:
        print(f"Error getting users: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error fetching users: {str(e)}",
            'users': []
        }), 500

# ENDPOINT FOR ADDING A NEW USER
    
@app.route('/api/users', methods=['POST'])
def add_user():
    """Add a new user based on role permissions"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Get data from request body
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'clerk')  # Default to clerk
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
            
        # Validate email format
        if '@' not in email:
            return jsonify({'error': 'Invalid email format'}), 400
            
        # Validate role
        if role not in ['super_admin', 'admin', 'manager', 'clerk']:
            return jsonify({'error': 'Invalid role. Must be super_admin, admin, manager, or clerk'}), 400
            
        # Role-based permission check
        if current_user['role'] == 'clerk':
            return jsonify({'error': 'Clerks cannot add users'}), 403
            
        elif current_user['role'] == 'manager':
            if role != 'clerk':
                return jsonify({'error': 'Managers can only add clerk users'}), 403
                
        elif current_user['role'] == 'admin':
            if role in ['super_admin', 'admin']:
                return jsonify({'error': 'Admins cannot add super_admin or admin users'}), 403
                
        # Super admins can add any role
            
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
                    role VARCHAR(50) NOT NULL DEFAULT 'clerk',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    added_by_id INTEGER REFERENCES users(id)
                )
            """)
            conn.commit()
            print("Users table created successfully")
        else:
            # Check if added_by_id column exists, add it if not
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                    AND column_name = 'added_by_id'
                )
            """)
            column_exists = cursor.fetchone()['exists']
            
            if not column_exists:
                print("Adding added_by_id column to users table...")
                cursor.execute("""
                    ALTER TABLE users 
                    ADD COLUMN added_by_id INTEGER REFERENCES users(id)
                """)
                conn.commit()
                print("Added added_by_id column successfully")
        
        # Hash the password
        hashed_password = generate_password_hash(password)
        
        print(f"Adding new user: {email} with role: {role}")
        
        # Insert new user with added_by_id
        cursor.execute("""
            INSERT INTO users (email, password, role, created_at, added_by_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (email, hashed_password, role, datetime.now(), current_user['id']))
        
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



# Migration endpoint to set added_by_id for existing users
@app.route('/api/users/migrate-added-by', methods=['POST'])
def migrate_added_by():
    """Migrate existing users to set added_by_id"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Only super admin can run migrations
        if current_user['role'] != 'super_admin':
            return jsonify({'error': 'Only super admin can run migrations'}), 403
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Check if added_by_id column exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
                AND column_name = 'added_by_id'
            )
        """)
        column_exists = cursor.fetchone()['exists']
        
        if not column_exists:
            # Add the column
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN added_by_id INTEGER REFERENCES users(id)
            """)
            conn.commit()
            
        # Get the first super_admin user
        cursor.execute("""
            SELECT id FROM users 
            WHERE role = 'super_admin' 
            ORDER BY created_at 
            LIMIT 1
        """)
        super_admin = cursor.fetchone()
        
        if not super_admin:
            cursor.close()
            conn.close()
            return jsonify({'error': 'No super_admin user found for migration'}), 404
            
        super_admin_id = super_admin['id']
        
        # Set all null added_by_id to super_admin (except super_admin's own)
        cursor.execute("""
            UPDATE users 
            SET added_by_id = %s
            WHERE added_by_id IS NULL AND id != %s
        """, (super_admin_id, super_admin_id))
        
        rows_updated = cursor.rowcount
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': 'User migration completed successfully',
            'users_updated': rows_updated
        })
        
    except Exception as e:
        print(f"Error during migration: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error during migration: {str(e)}"}), 500

# REGISTER GUEST ENDPOINT









@app.route('/api/register_guest', methods=['POST'])
def register_guest():
    """Register a new guest with card and room access"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Only clerk, manager, and admin can register guests
        if current_user['role'] not in ['clerk', 'manager', 'admin']:
            return jsonify({'error': 'Insufficient permissions to register guests'}), 403
            
        # Get data from request body
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Extract guest data
        guest_id = data.get('guestId', '')
        name = data.get('name')
        
        # Handle both old and new ID format
        id_type = data.get('idType', 'aadhar')
        id_number = data.get('idNumber', data.get('aadharNumber', ''))  # Try to get from both fields
        
        address = data.get('address', '')
        room_id = data.get('roomId')
        card_ui_id = data.get('cardUiId')
        checkin_time = data.get('checkinTime')
        checkout_time = data.get('checkoutTime')
        
        # Validate required fields
        if not name or not id_number or not room_id or not card_ui_id:
            return jsonify({'error': 'Name, ID number, Room ID, and Card UI ID are required'}), 400
            
        # Validate ID number format based on type
        if id_type == 'aadhar' and not re.match(r'^\d{12}$', id_number):
            return jsonify({'error': 'Aadhar number must be 12 digits'}), 400
        elif id_type == 'passport' and not re.match(r'^[A-Z0-9]{8}$', id_number, re.IGNORECASE):
            return jsonify({'error': 'Passport number must be 8 characters'}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
                # Check if guest_registrations table exists, create if not
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'guest_registrations'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            print("Creating guest_registrations table...")
            cursor.execute("""
                CREATE TABLE guest_registrations (
                    id SERIAL PRIMARY KEY,
                    guest_id VARCHAR(255),
                    name VARCHAR(255) NOT NULL,
                    id_type VARCHAR(50) NOT NULL DEFAULT 'aadhar',
                    id_number VARCHAR(50) NOT NULL,
                    address TEXT,
                    room_id VARCHAR(255) NOT NULL,
                    card_ui_id VARCHAR(255) NOT NULL,
                    checkin_time TIMESTAMP NOT NULL,
                    checkout_time TIMESTAMP NOT NULL,
                    registered_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            conn.commit()
            print("guest_registrations table created successfully")
        else:
            # Check if id_type column exists, add it if not
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'guest_registrations'
                    AND column_name = 'id_type'
                )
            """)
            column_exists = cursor.fetchone()['exists']
            
            if not column_exists:
                print("Adding id_type column to guest_registrations table...")
                cursor.execute("""
                    ALTER TABLE guest_registrations 
                    ADD COLUMN id_type VARCHAR(50) NOT NULL DEFAULT 'aadhar'
                """)
                
                # Rename aadhar_number to id_number
                cursor.execute("""
                    ALTER TABLE guest_registrations 
                    RENAME COLUMN aadhar_number TO id_number
                """)
                
                conn.commit()
                print("Updated guest_registrations table schema")
        
        # Generate guest_id if not provided
        if not guest_id:
            guest_id = f"G-{int(time.time())}"
        
        print(f"Registering guest: {name} with ID Type: {id_type}, ID Number: {id_number}")
        
        # Check if the table has been updated with the new columns
        try:
            # Try inserting with new column structure
            cursor.execute("""
                INSERT INTO guest_registrations (
                    guest_id, name, id_type, id_number, address, room_id, 
                    card_ui_id, checkin_time, checkout_time, registered_by, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                guest_id, name, id_type, id_number, address, room_id, 
                card_ui_id, checkin_time, checkout_time, current_user['id'], datetime.now()
            ))
        except Exception as column_error:
            print(f"Column error: {str(column_error)}")
            # Fallback to old column structure
            cursor.execute("""
                INSERT INTO guest_registrations (
                    guest_id, name, aadhar_number, address, room_id, 
                    card_ui_id, checkin_time, checkout_time, registered_by, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                guest_id, name, id_number, address, room_id, 
                card_ui_id, checkin_time, checkout_time, current_user['id'], datetime.now()
            ))
        
        new_guest_id = cursor.fetchone()['id']
        

        cursor.execute("""
            SELECT product_id 
            FROM productstable 
            WHERE room_no = %s
        """, (room_id,))
        
        product_result = cursor.fetchone()
        if product_result:
            product_id = product_result['product_id']
            
            # Update the productstable to set updated = FALSE
            cursor.execute("""
                UPDATE productstable
                SET updated = TRUE
                WHERE product_id = %s
            """, (product_id,))
            
            print(f"Marked product {product_id} as updated=FALSE for room {room_id}")
        else:
            print(f"Warning: No product found for room {room_id}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Guest {name} registered successfully with ID {new_guest_id}")
        
        return jsonify({
            'message': 'Guest registered successfully',
            'guest_id': guest_id,
            'id': new_guest_id
        }), 201
        
    except Exception as e:
        print(f"Error registering guest: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error registering guest: {str(e)}"}), 500
    




@app.route('/api/guests', methods=['GET'])
def get_guests():
    """Get all guest registrations"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database",
                'guests': []
            }), 500
            
        cursor = conn.cursor()
        
        # Check if the table has the new columns
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'guest_registrations'
                AND column_name = 'id_type'
            )
        """)
        has_new_columns = cursor.fetchone()['exists']
        
        if has_new_columns:
            # Query using new column names
            cursor.execute("""
                SELECT id, guest_id, name, id_type, id_number, address, room_id, 
                       card_ui_id, checkin_time, checkout_time, created_at
                FROM guest_registrations 
                ORDER BY created_at DESC
            """)
        else:
            # Query using old column names
            cursor.execute("""
                SELECT id, guest_id, name, 'aadhar' as id_type, aadhar_number as id_number, 
                       address, room_id, card_ui_id, checkin_time, checkout_time, created_at
                FROM guest_registrations 
                ORDER BY created_at DESC
            """)
        
        guests = cursor.fetchall()
        
        # Convert dates to ISO format for JSON serialization
        if guests:
            for guest in guests:
                if 'checkin_time' in guest and guest['checkin_time']:
                    if isinstance(guest['checkin_time'], datetime):
                        guest['checkinTime'] = guest['checkin_time'].isoformat()
                    del guest['checkin_time']
                
                if 'checkout_time' in guest and guest['checkout_time']:
                    if isinstance(guest['checkout_time'], datetime):
                        guest['checkoutTime'] = guest['checkout_time'].isoformat()
                    del guest['checkout_time']
                
                if 'created_at' in guest and guest['created_at']:
                    if isinstance(guest['created_at'], datetime):
                        guest['createdAt'] = guest['created_at'].isoformat()
                    del guest['created_at']
                
                if 'guest_id' in guest:
                    guest['guestId'] = guest['guest_id']
                    del guest['guest_id']
                
                if 'room_id' in guest:
                    guest['roomId'] = guest['room_id']
                    del guest['room_id']
                
                if 'card_ui_id' in guest:
                    guest['cardUiId'] = guest['card_ui_id']
                    del guest['card_ui_id']
                
                if 'id_number' in guest:
                    guest['idNumber'] = guest['id_number']
                    del guest['id_number']
                
                if 'id_type' in guest:
                    guest['idType'] = guest['id_type']
                    del guest['id_type']
        
        cursor.close()
        conn.close()
        
        return jsonify({'guests': guests})
        
    except Exception as e:
        print(f"Error getting guests: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error fetching guests: {str(e)}",
            'guests': []
        }), 500

@app.route('/api/guests/<int:guest_id>', methods=['PUT'])
def update_guest(guest_id):
    """Update a guest registration"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Get data from request body
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        guest_id_value = data.get('guestId')
        name = data.get('name')
        
        # Handle both old and new ID format
        id_type = data.get('idType', 'aadhar')
        id_number = data.get('idNumber', data.get('aadharNumber', ''))  # Try to get from both fields
        
        address = data.get('address', '')
        room_id = data.get('roomId')
        card_ui_id = data.get('cardUiId')
        checkin_time = data.get('checkinTime')
        checkout_time = data.get('checkoutTime')
        
        # Validate required fields
        if not guest_id_value or not name or not id_number or not room_id or not card_ui_id:
            return jsonify({'error': 'Required fields missing'}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Check if guest exists
        cursor.execute("SELECT id FROM guest_registrations WHERE id = %s", (guest_id,))
        existing_guest = cursor.fetchone()
        
        if not existing_guest:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Guest not found'}), 404
        
        # Check if the table has the new columns
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'guest_registrations'
                AND column_name = 'id_type'
            )
        """)
        has_new_columns = cursor.fetchone()['exists']
        
        if has_new_columns:
            # Update using new column names
            cursor.execute("""
                UPDATE guest_registrations
                SET guest_id = %s, name = %s, id_type = %s, id_number = %s, address = %s,
                    room_id = %s, card_ui_id = %s, checkin_time = %s, checkout_time = %s
                WHERE id = %s
            """, (
                guest_id_value, name, id_type, id_number, address,
                room_id, card_ui_id, checkin_time, checkout_time, guest_id
            ))
        else:
            # Update using old column names
            cursor.execute("""
                UPDATE guest_registrations
                SET guest_id = %s, name = %s, aadhar_number = %s, address = %s,
                    room_id = %s, card_ui_id = %s, checkin_time = %s, checkout_time = %s
                WHERE id = %s
            """, (
                guest_id_value, name, id_number, address,
                room_id, card_ui_id, checkin_time, checkout_time, guest_id
            ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Guest updated successfully'})
        
    except Exception as e:
        print(f"Error updating guest: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error updating guest: {str(e)}"}), 500

@app.route('/api/guests/<int:guest_id>', methods=['DELETE'])
def delete_guest(guest_id):
    """Delete a guest registration"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Check if guest exists
        cursor.execute("SELECT id FROM guest_registrations WHERE id = %s", (guest_id,))
        existing_guest = cursor.fetchone()
        
        if not existing_guest:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Guest not found'}), 404
        
        # Delete guest record
        cursor.execute("DELETE FROM guest_registrations WHERE id = %s", (guest_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Guest deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting guest: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error deleting guest: {str(e)}"}), 500
    



    
@app.route('/api/help-messages', methods=['GET'])
def get_help_messages():
    """Get help desk messages based on user's role"""
    try:
        # Get current user from token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401

        # Super admins shouldn't access this endpoint
        if current_user['role'] == 'super_admin':
            return jsonify({'error': 'Unavailable for super admin'}), 403
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS help_messages (
                id SERIAL PRIMARY KEY,
                sender VARCHAR(255) NOT NULL,
                sender_role VARCHAR(50) NOT NULL,
                recipient VARCHAR(255) NOT NULL,
                recipient_role VARCHAR(50) NOT NULL,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                priority VARCHAR(50) NOT NULL DEFAULT 'normal',
                timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                is_read BOOLEAN NOT NULL DEFAULT FALSE
            )
        """)
        conn.commit()
        
        # Different query based on role
        if current_user['role'] == 'admin':
            cursor.execute("""
                SELECT * FROM help_messages
                ORDER BY timestamp DESC
            """)
        elif current_user['role'] == 'manager':
            cursor.execute("""
                SELECT * FROM help_messages
                WHERE sender = %s 
                OR recipient = %s 
                OR sender_role = 'clerk'
                OR (recipient_role = 'clerk' AND sender = %s)
                ORDER BY timestamp DESC
            """, (current_user['email'], current_user['email'], current_user['email']))
        else:
            cursor.execute("""
                SELECT * FROM help_messages
                WHERE sender = %s OR recipient = %s
                ORDER BY timestamp DESC
            """, (current_user['email'], current_user['email']))
            
        messages = cursor.fetchall()
        
        result = []
        for msg in messages:
            result.append({
                'id': msg['id'],
                'sender': msg['sender'],
                'senderRole': msg['sender_role'],
                'recipient': msg['recipient'],
                'recipientRole': msg['recipient_role'],
                'subject': msg['subject'],
                'message': msg['message'],
                'priority': msg['priority'],
                'timestamp': msg['timestamp'].isoformat() if msg['timestamp'] else None,
                'isRead': msg['is_read']
            })
            
        cursor.close()
        conn.close()
        
        return jsonify({
            'messages': result
        })
        
    except Exception as e:
        print(f"Error getting help messages: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error fetching messages: {str(e)}"}), 500


@app.route('/api/help-messages', methods=['POST'])
def send_help_message():
    """Send a new help desk message"""
    try:
        # Get current user from token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Get message data from request
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        sender = current_user['email']
        sender_role = current_user['role']
        recipient = data.get('recipient')
        subject = data.get('subject')
        message = data.get('message')
        priority = data.get('priority', 'normal')
        
        # Basic validation
        if not recipient or not subject or not message:
            return jsonify({'error': 'Recipient, subject and message are required'}), 400
            
        # Get recipient's role
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Find recipient user
        cursor.execute("SELECT role FROM users WHERE email = %s", (recipient,))
        recipient_user = cursor.fetchone()
        
        if not recipient_user:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Recipient not found'}), 404
            
        recipient_role = recipient_user['role']
        
        # Validate based on roles (clerks can only message admins/managers)
        if sender_role == 'clerk' and recipient_role == 'clerk':
            cursor.close()
            conn.close()
            return jsonify({'error': 'Clerks can only message admins or managers'}), 403
            
        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS help_messages (
                id SERIAL PRIMARY KEY,
                sender VARCHAR(255) NOT NULL,
                sender_role VARCHAR(50) NOT NULL,
                recipient VARCHAR(255) NOT NULL,
                recipient_role VARCHAR(50) NOT NULL,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                priority VARCHAR(50) NOT NULL DEFAULT 'normal',
                timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                is_read BOOLEAN NOT NULL DEFAULT FALSE
            )
        """)
        
        # Insert new message
        cursor.execute("""
            INSERT INTO help_messages 
            (sender, sender_role, recipient, recipient_role, subject, message, priority)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (sender, sender_role, recipient, recipient_role, subject, message, priority))
        
        message_id = cursor.fetchone()['id']
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': 'Message sent successfully',
            'id': message_id
        })
        
    except Exception as e:
        print(f"Error sending help message: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error sending message: {str(e)}"}), 500
    


@app.route('/api/helpdesk/available-recipients', methods=['GET'])
def get_helpdesk_recipients():
    """Get available recipients that can be messaged based on user role"""
    try:
        # Get current user from token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Super admins shouldn't access this endpoint
        if current_user['role'] == 'super_admin':
            return jsonify({'error': 'Unavailable for super admin'}), 403
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Different query based on user role
        if current_user['role'] in ['admin', 'manager']:
            # Admins and managers can message clerks but not super_admins
            cursor.execute("""
                SELECT id, email, role 
                FROM users 
                WHERE id != %s  -- Exclude self
                AND role != 'super_admin'  -- Exclude super_admins
                ORDER BY role, email
            """, (current_user['id'],))
        else:
            # Clerks can only message admins and managers
            cursor.execute("""
                SELECT id, email, role 
                FROM users 
                WHERE role IN ('admin', 'manager')
                ORDER BY role, email
            """)
        
        recipients = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert to list of dicts
        result = []
        for user in recipients:
            result.append({
                'id': user['id'],
                'email': user['email'],
                'role': user['role']
            })
        
        return jsonify({
            'recipients': result
        })
        
    except Exception as e:
        print(f"Error getting helpdesk recipients: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error fetching recipients: {str(e)}"}), 500
    








@app.route('/api/card_packages', methods=['GET'])
def get_card_packages():
    """API endpoint for getting all card packages"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # Query to get all card packages
        cursor.execute("""
            SELECT product_id, uid, package_type FROM card_packages
        """)
        
        # Fetch all rows
        rows = cursor.fetchall()
        
        # Convert rows to dictionaries based on the data type
        packages = []
        for row in rows:
            # Check if row is already a dictionary
            if isinstance(row, dict):
                packages.append(row)
            else:
                # Try to access by index (tuple-like)
                try:
                    packages.append({
                        'product_id': row[0],
                        'uid': row[1],
                        'package_type': row[2]
                    })
                except (IndexError, TypeError):
                    # If that fails, try to access by column name
                    try:
                        packages.append({
                            'product_id': row.product_id,
                            'uid': row.uid,
                            'package_type': row.package_type
                        })
                    except AttributeError:
                        # Print debug info about the row
                        print(f"Debug - row type: {type(row)}, content: {row}")
                        raise
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'packages': packages
        })
        
    except Exception as e:
        import traceback
        print("Error in get_card_packages API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error fetching card packages: {str(e)}"
        }), 500

@app.route('/api/card_packages', methods=['POST'])
def add_card_package():
    """API endpoint for adding or updating a card package"""
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
        uid = data.get('uid')
        package_type = data.get('package_type')
        
        if not product_id or not uid or not package_type:
            return jsonify({
                'error': "Product ID, UID, and package type are required"
            }), 400
        
        cursor = conn.cursor()
        
        # Upsert the card package
        cursor.execute("""
            INSERT INTO card_packages (product_id, uid, package_type) 
            VALUES (%s, %s, %s)
            ON CONFLICT (product_id, uid) DO UPDATE 
            SET package_type = EXCLUDED.package_type
        """, (product_id, uid, package_type))
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': "Package updated successfully!"
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in add_card_package API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error updating card package: {str(e)}"
        }), 500


    

@app.route('/api/access_matrix', methods=['GET'])   
def get_access_matrix():
    """API endpoint for getting the package access matrix"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # Query to get all matrix entries
        cursor.execute("""
            SELECT package_type, facility, has_access FROM access_matrix
        """)
        
        rows = cursor.fetchall()
        
        # Convert to structured format
        matrix = {
            "Standard": {
                "Lounge Room": False,
                "Spa Room": False,
                "Top Pool": False,
                "Gym": False
            },
            "Deluxe": {
                "Lounge Room": False,
                "Spa Room": False,
                "Top Pool": False,
                "Gym": False
            },
            "Suite": {
                "Lounge Room": False,
                "Spa Room": False,
                "Top Pool": False,
                "Gym": False
            },
            "Executive": {
                "Lounge Room": False,
                "Spa Room": False,
                "Top Pool": False,
                "Gym": False
            }
        }
        
        # Fill in values from database
        for row in rows:
            if isinstance(row, dict):
                package_type = row["package_type"]
                facility = row["facility"]
                has_access = row["has_access"]
            else:
                package_type = row[0]
                facility = row[1]
                has_access = bool(row[2])  # Ensure it's a boolean
            
            if package_type in matrix and facility in matrix[package_type]:
                matrix[package_type][facility] = has_access
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'matrix': matrix
        })
        
    except Exception as e:
        import traceback
        print("Error in get_access_matrix API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error fetching access matrix: {str(e)}"
        }), 500
    

# @app.route('/api/access_matrix', methods=['POST'])
# def update_access_matrix():
#     """API endpoint for updating the package access matrix"""
#     # Check authentication (middleware would handle this in a real app)
    
#     conn = get_db_connection()
    
#     if not conn:
#         return jsonify({
#             'error': "Unable to connect to database"
#         }), 500
    
#     try:
#         # Get request JSON data
#         data = request.get_json()
        
#         if not data or 'matrix' not in data:
#             return jsonify({
#                 'error': "No matrix data provided"
#             }), 400
        
#         matrix = data['matrix']
        
#         cursor = conn.cursor()
        
#         # Clear existing matrix data
#         cursor.execute("DELETE FROM access_matrix")
        
#         # Insert new matrix data
#         for package_type, facilities in matrix.items():
#             for facility, has_access in facilities.items():
#                 cursor.execute("""
#                     INSERT INTO access_matrix (package_type, facility, has_access)
#                     VALUES (%s, %s, %s)
#                 """, (package_type, facility, has_access))
        
#         # Commit changes
#         conn.commit()
        
#         cursor.close()
#         conn.close()
        
#         return jsonify({
#             'success': "Access matrix updated successfully!"
#         })
        
#     except Exception as e:
#         # Rollback in case of error
#         if conn:
#             conn.rollback()
        
#         import traceback
#         print("Error in update_access_matrix API:")
#         print(f"Exception type: {type(e).__name__}")
#         print(f"Exception args: {e.args}")
#         print(traceback.format_exc())
        
#         return jsonify({
#             'error': f"Error updating access matrix: {str(e)}"
#         }), 500
    
@app.route('/api/access_matrix', methods=['POST'])
def update_access_matrix():
    """API endpoint for updating the package access matrix"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        # Get request JSON data
        data = request.get_json()
        
        if not data or 'matrix' not in data:
            return jsonify({
                'error': "No matrix data provided"
            }), 400
        
        matrix = data['matrix']
        
        cursor = conn.cursor()
        
        # Clear existing matrix data
        cursor.execute("DELETE FROM access_matrix")
        
        # Insert new matrix data
        id_counter = 1  # Start ID counter at 1
        for package_type, facilities in matrix.items():
            for facility, has_access in facilities.items():
                cursor.execute("""
                    INSERT INTO access_matrix (id, package_type, facility, has_access)
                    VALUES (%s, %s, %s, %s)
                """, (id_counter, package_type, facility, has_access))
                id_counter += 1  # Increment ID for each row
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': "Access matrix updated successfully!"
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in update_access_matrix API:")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception args: {e.args}")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error updating access matrix: {str(e)}"
        }), 500
# VIP Table API Endpoints

@app.route('/api/vip_rooms', methods=['GET'])
def get_vip_rooms():
    """API endpoint for retrieving VIP rooms"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database",
            'vip_rooms': []
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # Get VIP rooms data
        cursor.execute("SELECT product_id, vip_rooms FROM vip_rooms ORDER BY product_id")
        vip_rooms = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'vip_rooms': vip_rooms
        })
    
    except Exception as e:
        # Comprehensive error logging
        import traceback
        print("Detailed error in get_vip_rooms route:")
        print(traceback.format_exc())
        
        if conn:
            conn.close()
        
        return jsonify({
            'error': f"An error occurred: {str(e)}",
            'vip_rooms': []
        }), 500


@app.route('/api/vip_room', methods=['POST'])
def add_vip_room():
    """API endpoint for adding a single VIP room"""
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
        vip_rooms = data.get('vip_rooms')
        
        if not product_id or not vip_rooms:
            return jsonify({
                'error': "Product ID and VIP Rooms are required"
            }), 400
        
        cursor = conn.cursor()
        
        # STRICT CHECK: Verify this product_id does NOT exist in products table
        cursor.execute("SELECT COUNT(*) as count FROM productstable WHERE product_id = %s", (product_id,))
        result = cursor.fetchone()
        product_count = result['count'] if result else 0
        
        if product_count > 0:
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"Product ID '{product_id}' already exists in Products table. VIP rooms cannot use existing product IDs."
            }), 409  # Conflict status code
        
        # Also check if already exists in VIP rooms for uniqueness
        cursor.execute("SELECT COUNT(*) as count FROM vip_rooms WHERE product_id = %s", (product_id,))
        result = cursor.fetchone()
        vip_count = result['count'] if result else 0
        
        if vip_count > 0:
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"Product ID '{product_id}' already exists in VIP Rooms table. Please use a unique Product ID."
            }), 409  # Conflict status code
        
        # Only if we passed both checks, insert the new VIP room
        cursor.execute("""
            INSERT INTO vip_rooms (product_id, vip_rooms) 
            VALUES (%s, %s)
        """, (product_id, vip_rooms))
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': "VIP Room added successfully!",
            'vip_room': {
                'product_id': product_id,
                'vip_rooms': vip_rooms
            }
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in add_vip_room API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error adding VIP Room: {str(e)}"
        }), 500

@app.route('/api/vip_room/<product_id>', methods=['DELETE'])
def delete_vip_room(product_id):
    """API endpoint for deleting a single VIP room"""
    # Check authentication (middleware would handle this in a real app)
    
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # Delete the VIP room
        cursor.execute("DELETE FROM vip_rooms WHERE product_id = %s", (product_id,))
        
        # Check if VIP room was actually deleted
        if cursor.rowcount == 0:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"VIP Room with Product ID {product_id} not found"
            }), 404
        
        # Commit changes
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': f"VIP Room with Product ID {product_id} deleted successfully"
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in delete_vip_room API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error deleting VIP Room: {str(e)}"
        }), 500   
    



@app.route('/api/access_control_data', methods=['GET'])
def get_access_control_data():
    """
    Endpoint for ESP32 access control system.
    Returns consolidated data about cards, products, and guest assignments.
    Only includes guests whose current time is between their checkin and checkout times.
    """
    try:
        # Get the product_id from the request parameters if available
        requested_product_id = request.args.get('product_id')
        
        print(f"Access control data requested, product_id: {requested_product_id}")
        
        # Get database connection
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        # For psycopg2, use DictCursor
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Initialize the response structure
        response_data = {
            "cards": [],
            "products": []
        }
        
        # 1. Fetch master cards and service cards
        cursor.execute("""
            SELECT cp.uid, cp.package_type as type, 
                   CASE WHEN cp.package_type IN ('Master Card', 'Service Card') THEN '["all"]'::json
                        ELSE NULL
                   END as access_rooms
            FROM card_packages cp
            WHERE cp.package_type IN ('Master Card', 'Service Card')
        """)
        
        special_cards = cursor.fetchall()
        
        # Process special cards
        for card in special_cards:
            card_data = dict(card)
            
            # Make sure access_rooms is properly processed
            if isinstance(card_data['access_rooms'], str):
                import json
                card_data['access_rooms'] = json.loads(card_data['access_rooms'])
            elif card_data['access_rooms'] is None:
                card_data['access_rooms'] = ["all"]  # Both Service and Master cards get all access
            
            card_data['active'] = True
            response_data['cards'].append(card_data)

        # 2. First get the access matrix
        cursor.execute("""
            SELECT package_type, facility, has_access 
            FROM access_matrix
        """)
        
        package_access = {}
        for row in cursor.fetchall():
            pkg_type = row['package_type']
            facility = row['facility']
            has_access = row['has_access']
            
            if pkg_type not in package_access:
                package_access[pkg_type] = {}
                
            package_access[pkg_type][facility] = has_access
        
        # 3. Get VIP room mappings
        cursor.execute("""
            SELECT product_id, vip_rooms 
            FROM vip_rooms
        """)
        
        vip_product_to_facility = {}
        facility_to_product = {}
        
        for row in cursor.fetchall():
            vip_product_to_facility[row['product_id']] = row['vip_rooms']
            facility_to_product[row['vip_rooms']] = row['product_id']
            
        # 4. Get all active guests - using NOW() BETWEEN ensures only current guests are included
        cursor.execute("""
            SELECT g.id, g.name, g.card_ui_id as uid, g.room_id,
                   g.checkin_time as checkin, g.checkout_time as checkout
                   p.product_id
            FROM guest_registrations g
            JOIN productstable p ON g.room_id = p.room_no
            WHERE NOW() BETWEEN g.checkin_time AND g.checkout_time
            AND g.checkout_time > NOW()  
        """)
        
        all_guests = cursor.fetchall()
        
        # Debug: Print current time and guest count
        cursor.execute("SELECT NOW() as current_time")
        current_time = cursor.fetchone()['current_time']
        print(f"Current server time: {current_time}")
        print(f"Found {len(all_guests)} active guests")
        
        # 5. Get package type for each guest's card and simplify guest objects
        guests_with_packages = []
        for guest in all_guests:
            guest_dict = dict(guest)
            card_uid = guest_dict['uid']
            
            # Get package type for this card
            cursor.execute("""
                SELECT package_type
                FROM card_packages
                WHERE uid = %s
                LIMIT 1
            """, (card_uid,))
            
            package_result = cursor.fetchone()
            if package_result:
                guest_dict['package_type'] = package_result['package_type']
            else:
                guest_dict['package_type'] = 'Standard'  # Default if no package assigned
                
            # Calculate access rooms for this guest
            access_rooms = [guest_dict['product_id']]  # Always has access to assigned room
            
            # Check which VIP facilities this package has access to
            if guest_dict['package_type'] in package_access:
                for facility, has_access in package_access[guest_dict['package_type']].items():
                    if has_access and facility in facility_to_product:
                        vip_product_id = facility_to_product[facility]
                        access_rooms.append(vip_product_id)
            
            guest_dict['access_rooms'] = access_rooms
            
            # Convert datetime objects to strings
            # if isinstance(guest_dict['checkin'], datetime):
            #     guest_dict['checkin'] = guest_dict['checkin'].isoformat()
            
            # if isinstance(guest_dict['checkout'], datetime):
            #     guest_dict['checkout'] = guest_dict['checkout'].isoformat()

            # Convert datetime objects to human-readable strings without the 'T'
            if isinstance(guest_dict['checkin'], datetime):
               guest_dict['checkin'] = guest_dict['checkin'].strftime('%Y-%m-%d %H:%M:%S')

            if isinstance(guest_dict['checkout'], datetime):
               guest_dict['checkout'] = guest_dict['checkout'].strftime('%Y-%m-%d %H:%M:%S')
            
            # Create simplified guest object with only necessary fields
            simplified_guest = {
                "name": guest_dict['name'],
                "uid": guest_dict['uid'],
                "checkin": guest_dict['checkin'],
                "checkout": guest_dict['checkout'],
                "package_type": guest_dict['package_type'],
                "access_rooms": guest_dict['access_rooms']
            }
            
            guests_with_packages.append(simplified_guest)
        
        # Create mappings for guests by their access products
        guests_by_product = {}
        for guest in guests_with_packages:
            for product_id in guest['access_rooms']:
                if product_id not in guests_by_product:
                    guests_by_product[product_id] = []
                guests_by_product[product_id].append(guest)
        
        # Now fetch and process all products
        if requested_product_id:
            # If a specific product_id is requested
            cursor.execute("""
                SELECT product_id, room_no, COALESCE(updated, FALSE) as updated
                FROM productstable
                WHERE product_id = %s
            """, (requested_product_id,))
            
            regular_product = cursor.fetchone()
            
            if regular_product:
                product_data = {
                    "product_id": regular_product['product_id'],
                    "updated": regular_product['updated'],
                    "cards": []
                }
                
                # Get cards
                cursor.execute("""
                    SELECT ar.uid, 
                          COALESCE(cp.package_type, 'Standard') as type,
                          TRUE as active
                    FROM access_requests ar
                    LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
                    WHERE ar.product_id = %s
                    GROUP BY ar.uid, cp.package_type
                """, (regular_product['product_id'],))
                
                for card in cursor.fetchall():
                    product_data['cards'].append(dict(card))
                
                # Add guests if applicable
                if regular_product['product_id'] in guests_by_product:
                    product_data['guests'] = guests_by_product[regular_product['product_id']]
                
                response_data['products'].append(product_data)
                
                # Mark as updated = false
                cursor.execute("""
                    UPDATE productstable
                    SET updated = FALSE
                    WHERE product_id = %s
                """, (requested_product_id,))
                conn.commit()
            
            # Check if it's a VIP room
            cursor.execute("""
                SELECT product_id, vip_rooms, COALESCE(updated, FALSE) as updated
                FROM vip_rooms
                WHERE product_id = %s
            """, (requested_product_id,))
            
            vip_room = cursor.fetchone()
            
            if vip_room:
                product_data = {
                    "product_id": vip_room['product_id'],
                    "updated": vip_room['updated'],
                    "cards": []
                }
                
                # Get cards
                cursor.execute("""
                    SELECT ar.uid, 
                           COALESCE(cp.package_type, 'Standard') as type,
                           TRUE as active
                    FROM access_requests ar
                    LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
                    WHERE ar.product_id = %s
                    GROUP BY ar.uid, cp.package_type
                """, (vip_room['product_id'],))
                
                for card in cursor.fetchall():
                    product_data['cards'].append(dict(card))
                
                # Add guests if any has access to this VIP room
                if vip_room['product_id'] in guests_by_product:
                    product_data['guests'] = guests_by_product[vip_room['product_id']]
                
                response_data['products'].append(product_data)
                
                # Mark as updated = false
                cursor.execute("""
                    UPDATE vip_rooms
                    SET updated = FALSE
                    WHERE product_id = %s
                """, (requested_product_id,))
                conn.commit()
        else:
            # Get all products
            cursor.execute("""
                SELECT product_id, room_no, COALESCE(updated, FALSE) as updated
                FROM productstable
            """)
            
            for product in cursor.fetchall():
                product_data = {
                    "product_id": product['product_id'],
                    "updated": product['updated'],
                    "cards": []
                }
                
                # Get cards
                cursor.execute("""
                    SELECT ar.uid, 
                           COALESCE(cp.package_type, 'Standard') as type,
                           TRUE as active
                    FROM access_requests ar
                    LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
                    WHERE ar.product_id = %s
                    GROUP BY ar.uid, cp.package_type
                """, (product['product_id'],))
                
                for card in cursor.fetchall():
                    product_data['cards'].append(dict(card))
                
                # Add guests if applicable
                if product['product_id'] in guests_by_product:
                    product_data['guests'] = guests_by_product[product['product_id']]
                
                response_data['products'].append(product_data)
            
            # Also get all VIP rooms
            cursor.execute("""
                SELECT product_id, vip_rooms, COALESCE(updated, FALSE) as updated
                FROM vip_rooms
            """)
            
            for vip in cursor.fetchall():
                product_data = {
                    "product_id": vip['product_id'],
                    "updated": vip['updated'],
                    "cards": []
                }
                
                # Get cards
                cursor.execute("""
                    SELECT ar.uid, 
                           COALESCE(cp.package_type, 'Standard') as type,
                           TRUE as active
                    FROM access_requests ar
                    LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
                    WHERE ar.product_id = %s
                    GROUP BY ar.uid, cp.package_type
                """, (vip['product_id'],))
                
                for card in cursor.fetchall():
                    product_data['cards'].append(dict(card))
                
                # Add guests if any has access to this VIP room
                if vip['product_id'] in guests_by_product:
                    product_data['guests'] = guests_by_product[vip['product_id']]
                
                response_data['products'].append(product_data)
        
        cursor.close()
        conn.close()
        
        return jsonify(response_data)
    
    except Exception as e:
        print(f"Error getting access control data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error fetching access control data: {str(e)}"
        }), 500



# @app.route('/api/access_control_data', methods=['GET'])
# def get_access_control_data():
#     """
#     Endpoint for ESP32 access control system.
#     Returns consolidated data about cards, products, and guest assignments.
#     Simplified guest objects and removed duplicate guest/guests fields.
#     """
#     try:
#         # Get the product_id from the request parameters if available
#         requested_product_id = request.args.get('product_id')
        
#         print(f"Access control data requested, product_id: {requested_product_id}")
        
#         # Get database connection
#         conn = get_db_connection()
#         if not conn:
#             return jsonify({'error': 'Unable to connect to database'}), 500
            
#         # For psycopg2, use DictCursor
#         cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
#         # Initialize the response structure
#         response_data = {
#             "cards": [],
#             "products": []
#         }
        
#         # 1. Fetch master cards and service cards
#         cursor.execute("""
#             SELECT cp.uid, cp.package_type as type, 
#                    CASE WHEN cp.package_type IN ('Master Card', 'Service Card') THEN '["all"]'::json
#                         ELSE NULL
#                    END as access_rooms
#             FROM card_packages cp
#             WHERE cp.package_type IN ('Master Card', 'Service Card')
#         """)
        
#         special_cards = cursor.fetchall()
        
#         # Process special cards
#         for card in special_cards:
#             card_data = dict(card)
            
#             # Make sure access_rooms is properly processed
#             if isinstance(card_data['access_rooms'], str):
#                 import json
#                 card_data['access_rooms'] = json.loads(card_data['access_rooms'])
#             elif card_data['access_rooms'] is None:
#                 card_data['access_rooms'] = ["all"]  # Both Service and Master cards get all access
            
#             card_data['active'] = True
#             response_data['cards'].append(card_data)

#         # 2. First get the access matrix
#         cursor.execute("""
#             SELECT package_type, facility, has_access 
#             FROM access_matrix
#         """)
        
#         package_access = {}
#         for row in cursor.fetchall():
#             pkg_type = row['package_type']
#             facility = row['facility']
#             has_access = row['has_access']
            
#             if pkg_type not in package_access:
#                 package_access[pkg_type] = {}
                
#             package_access[pkg_type][facility] = has_access
        
#         # 3. Get VIP room mappings
#         cursor.execute("""
#             SELECT product_id, vip_rooms 
#             FROM vip_rooms
#         """)
        
#         vip_product_to_facility = {}
#         facility_to_product = {}
        
#         for row in cursor.fetchall():
#             vip_product_to_facility[row['product_id']] = row['vip_rooms']
#             facility_to_product[row['vip_rooms']] = row['product_id']
            
#         # 4. Get all active guests
#         cursor.execute("""
#             SELECT g.id, g.name, g.card_ui_id as uid, g.room_id,
#                    g.checkin_time as checkin, g.checkout_time as checkout,
#                    p.product_id
#             FROM guest_registrations g
#             JOIN productstable p ON g.room_id = p.room_no
#             WHERE NOW() BETWEEN g.checkin_time AND g.checkout_time
#         """)
        
#         all_guests = cursor.fetchall()
        
#         # 5. Get package type for each guest's card and simplify guest objects
#         guests_with_packages = []
#         for guest in all_guests:
#             guest_dict = dict(guest)
#             card_uid = guest_dict['uid']
            
#             # Get package type for this card
#             cursor.execute("""
#                 SELECT package_type
#                 FROM card_packages
#                 WHERE uid = %s
#                 LIMIT 1
#             """, (card_uid,))
            
#             package_result = cursor.fetchone()
#             if package_result:
#                 guest_dict['package_type'] = package_result['package_type']
#             else:
#                 guest_dict['package_type'] = 'Standard'  # Default if no package assigned
                
#             # Calculate access rooms for this guest
#             access_rooms = [guest_dict['product_id']]  # Always has access to assigned room
            
#             # Check which VIP facilities this package has access to
#             if guest_dict['package_type'] in package_access:
#                 for facility, has_access in package_access[guest_dict['package_type']].items():
#                     if has_access and facility in facility_to_product:
#                         vip_product_id = facility_to_product[facility]
#                         access_rooms.append(vip_product_id)
            
#             guest_dict['access_rooms'] = access_rooms
            
#             # Convert datetime objects to strings
#             if isinstance(guest_dict['checkin'], datetime):
#                 guest_dict['checkin'] = guest_dict['checkin'].isoformat()
            
#             if isinstance(guest_dict['checkout'], datetime):
#                 guest_dict['checkout'] = guest_dict['checkout'].isoformat()
            
#             # Create simplified guest object with only necessary fields
#             simplified_guest = {
#                 "name": guest_dict['name'],
#                 "uid": guest_dict['uid'],
#                 "checkin": guest_dict['checkin'],
#                 "checkout": guest_dict['checkout'],
#                 "package_type": guest_dict['package_type'],
#                 "access_rooms": guest_dict['access_rooms']
#             }
            
#             guests_with_packages.append(simplified_guest)
        
#         # Create mappings for guests by their access products
#         guests_by_product = {}
#         for guest in guests_with_packages:
#             for product_id in guest['access_rooms']:
#                 if product_id not in guests_by_product:
#                     guests_by_product[product_id] = []
#                 guests_by_product[product_id].append(guest)
        
#         # Now fetch and process all products
#         if requested_product_id:
#             # If a specific product_id is requested
#             cursor.execute("""
#                 SELECT product_id, room_no, COALESCE(updated, FALSE) as updated
#                 FROM productstable
#                 WHERE product_id = %s
#             """, (requested_product_id,))
            
#             regular_product = cursor.fetchone()
            
#             if regular_product:
#                 product_data = {
#                     "product_id": regular_product['product_id'],
#                     "updated": regular_product['updated'],
#                     "cards": []
#                 }
                
#                 # Get cards
#                 cursor.execute("""
#                     SELECT ar.uid, 
#                           COALESCE(cp.package_type, 'Standard') as type,
#                           TRUE as active
#                     FROM access_requests ar
#                     LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
#                     WHERE ar.product_id = %s
#                     GROUP BY ar.uid, cp.package_type
#                 """, (regular_product['product_id'],))
                
#                 for card in cursor.fetchall():
#                     product_data['cards'].append(dict(card))
                
#                 # Add guests if applicable
#                 if regular_product['product_id'] in guests_by_product:
#                     product_data['guests'] = guests_by_product[regular_product['product_id']]
                
#                 response_data['products'].append(product_data)
                
#                 # Mark as updated = false
#                 cursor.execute("""
#                     UPDATE productstable
#                     SET updated = FALSE
#                     WHERE product_id = %s
#                 """, (requested_product_id,))
#                 conn.commit()
            
#             # Check if it's a VIP room
#             cursor.execute("""
#                 SELECT product_id, vip_rooms, COALESCE(updated, FALSE) as updated
#                 FROM vip_rooms
#                 WHERE product_id = %s
#             """, (requested_product_id,))
            
#             vip_room = cursor.fetchone()
            
#             if vip_room:
#                 product_data = {
#                     "product_id": vip_room['product_id'],
#                     "updated": vip_room['updated'],
#                     "cards": []
#                 }
                
#                 # Get cards
#                 cursor.execute("""
#                     SELECT ar.uid, 
#                            COALESCE(cp.package_type, 'Standard') as type,
#                            TRUE as active
#                     FROM access_requests ar
#                     LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
#                     WHERE ar.product_id = %s
#                     GROUP BY ar.uid, cp.package_type
#                 """, (vip_room['product_id'],))
                
#                 for card in cursor.fetchall():
#                     product_data['cards'].append(dict(card))
                
#                 # Add guests if any has access to this VIP room
#                 if vip_room['product_id'] in guests_by_product:
#                     product_data['guests'] = guests_by_product[vip_room['product_id']]
                
#                 response_data['products'].append(product_data)
                
#                 # Mark as updated = false
#                 cursor.execute("""
#                     UPDATE vip_rooms
#                     SET updated = FALSE
#                     WHERE product_id = %s
#                 """, (requested_product_id,))
#                 conn.commit()
#         else:
#             # Get all products
#             cursor.execute("""
#                 SELECT product_id, room_no, COALESCE(updated, FALSE) as updated
#                 FROM productstable
#             """)
            
#             for product in cursor.fetchall():
#                 product_data = {
#                     "product_id": product['product_id'],
#                     "updated": product['updated'],
#                     "cards": []
#                 }
                
#                 # Get cards
#                 cursor.execute("""
#                     SELECT ar.uid, 
#                            COALESCE(cp.package_type, 'Standard') as type,
#                            TRUE as active
#                     FROM access_requests ar
#                     LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
#                     WHERE ar.product_id = %s
#                     GROUP BY ar.uid, cp.package_type
#                 """, (product['product_id'],))
                
#                 for card in cursor.fetchall():
#                     product_data['cards'].append(dict(card))
                
#                 # Add guests if applicable
#                 if product['product_id'] in guests_by_product:
#                     product_data['guests'] = guests_by_product[product['product_id']]
                
#                 response_data['products'].append(product_data)
            
#             # Also get all VIP rooms
#             cursor.execute("""
#                 SELECT product_id, vip_rooms, COALESCE(updated, FALSE) as updated
#                 FROM vip_rooms
#             """)
            
#             for vip in cursor.fetchall():
#                 product_data = {
#                     "product_id": vip['product_id'],
#                     "updated": vip['updated'],
#                     "cards": []
#                 }
                
#                 # Get cards
#                 cursor.execute("""
#                     SELECT ar.uid, 
#                            COALESCE(cp.package_type, 'Standard') as type,
#                            TRUE as active
#                     FROM access_requests ar
#                     LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
#                     WHERE ar.product_id = %s
#                     GROUP BY ar.uid, cp.package_type
#                 """, (vip['product_id'],))
                
#                 for card in cursor.fetchall():
#                     product_data['cards'].append(dict(card))
                
#                 # Add guests if any has access to this VIP room
#                 if vip['product_id'] in guests_by_product:
#                     product_data['guests'] = guests_by_product[vip['product_id']]
                
#                 response_data['products'].append(product_data)
        
#         cursor.close()
#         conn.close()
        
#         return jsonify(response_data)
    
#     except Exception as e:
#         print(f"Error getting access control data: {str(e)}")
#         import traceback
#         traceback.print_exc()
#         return jsonify({
#             'error': f"Error fetching access control data: {str(e)}"
#         }), 500



if __name__ == '__main__':
    print("Starting Flask application...")
    app.config['DEBUG'] = True
    app.run(debug=True, host='0.0.0.0', port=5000)