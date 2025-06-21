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
import json
import os
import threading
import paho.mqtt.client as mqtt
from flask_socketio import SocketIO 
from dotenv import load_dotenv


app = Flask(__name__)

CORS(app,
     supports_credentials=True,
     origins=["http://localhost:3000"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"])



load_dotenv()

# Database connection function
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=os.getenv("DB_PORT"),
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

# # MQTT broker config
# # MQTT_BROKER = "172.16.4.62" 
# # MQTT_BROKER = "127.0.0.1"  
# MQTT_BROKER = "mqtt.zenvinnovations.com"  # Use localhost for local testing
# MQTT_PORT = 9001  # Use WebSocket port
# # MQTT_TOPIC = "/hotel/esp32/devices/#"
# MQTT_TOPIC = "/RFID/access_control_data/product_id"  

MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))  # Default to 1883 if not set
MQTT_TOPIC = os.getenv("MQTT_TOPIC")


mqtt_client = mqtt.Client(transport="websockets")  # Use WebSocket transport

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT} with result code {rc}")
        client.subscribe(MQTT_TOPIC)
        print(f"Subscribed to topic {MQTT_TOPIC}")
    else:
        print(f"Failed to connect to MQTT broker. Return code: {rc}")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode()
    print(f"MQTT message received on topic {topic}: {payload}")
    # Debugging: Log the received message
    print(f"Debug: Received payload '{payload}' on topic '{topic}'")

    # Avoid infinite loop by ignoring acknowledgment messages
    if payload == "OK":
        print(f"Ignoring acknowledgment message on topic '{topic}'")
        return

    # Send acknowledgment (ACK) back to the same topic
    ack_message = "OK"
    result = client.publish(topic, ack_message)
    status = result[0]
    if status == 0:
        print(f"Sent acknowledgment '{ack_message}' to topic '{topic}'")
    else:
        print(f"Failed to send acknowledgment to topic '{topic}', status: {status}")

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message


def on_disconnect(client, userdata, rc):
    print(f"Disconnected from MQTT broker with result code {rc}")

mqtt_client.on_disconnect = on_disconnect


def mqtt_thread():
    while True:
        try:
            print(f"Attempting to connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT} using WebSocket...")
            mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            mqtt_client.loop_forever()
        except Exception as e:
            print(f"Failed to connect to MQTT broker: {e}")
            time.sleep(5)  # Retry after 5 seconds



def publish_access_control_data(product_id, data_json):
    """
    Publish access control data JSON to MQTT topic for the given product_id.

    Args:
        product_id (str): The product ID to publish under.
        data_json (dict): The JSON data (dict) to publish.
    """
    try:
        # Compose MQTT topic dynamically based on product_id
        topic = f"/RFID/access_control_data/{product_id}"

        # Convert dict to JSON string
        payload = json.dumps(data_json)

        # Publish message
        result = mqtt_client.publish(topic, payload)

        status = result[0]
        if status == 0:
            print(f"Published access control data to topic '{topic}'")
        else:
            print(f"Failed to publish to topic '{topic}', status: {status}")

    except Exception as e:
        print(f"Error publishing access control data: {str(e)}")






def mark_product_updated(product_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE productstable
            SET updated = TRUE
            WHERE product_id = %s
        """, (product_id,))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error marking product {product_id} updated: {str(e)}")

def mark_products_updated_for_uid(uid):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT product_id
            FROM access_requests
            WHERE uid = %s
        """, (uid,))
        products = cursor.fetchall()
        for p in products:
            cursor.execute("""
                UPDATE productstable
                SET updated = TRUE
                WHERE product_id = %s
            """, (p['product_id'],))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error marking products updated for UID {uid}: {str(e)}")





def fetch_access_control_data_for_product(product_id, cursor=None):
    """
    Fetch access control data for a specific product_id.
    
    Args:
        product_id (str): Product ID to fetch data for
        cursor: Optional database cursor. If None, a new connection is created.
        
    Returns:
        dict: Access control data for the product
    """
    close_conn = False
    conn = None
    
    try:
        if cursor is None:
            conn = get_db_connection()
            if not conn:
                return {'error': 'Unable to connect to database'}
            cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            close_conn = True
        
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
                GROUP BY cp.uid, cp.package_type
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
        # Modified to ensure we only get guests with future checkout times
        cursor.execute("""
            SELECT g.id, g.name, g.card_ui_id as uid, g.room_id,
                   g.checkin_time as checkin, g.checkout_time as checkout,
                   p.product_id
            FROM guest_registrations g
            JOIN productstable p ON g.room_id = p.room_no
            WHERE NOW() BETWEEN g.checkin_time AND g.checkout_time 
            AND g.checkout_time > NOW()
        """)

        all_guests = cursor.fetchall()
        
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
                guest_dict['package_type'] = 'General'  # Default if no package assigned
                
            # Calculate access rooms for this guest
            access_rooms = [guest_dict['product_id']]  # Always has access to assigned room
            
            # Check which VIP facilities this package has access to
            if guest_dict['package_type'] in package_access:
                for facility, has_access in package_access[guest_dict['package_type']].items():
                    if has_access and facility in facility_to_product:
                        vip_product_id = facility_to_product[facility]
                        access_rooms.append(vip_product_id)
            
            guest_dict['access_rooms'] = access_rooms

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
            for product_id_item in guest['access_rooms']:
                if product_id_item not in guests_by_product:
                    guests_by_product[product_id_item] = []
                guests_by_product[product_id_item].append(guest)
        
        # Check if it's a regular product
        cursor.execute("""
            SELECT product_id, room_no
            FROM productstable
            WHERE product_id = %s
        """, (product_id,))
        
        regular_product = cursor.fetchone()
        
        if regular_product:
            product_data = {
                "product_id": regular_product['product_id'],
                "updated": True,  # We're generating this for an update
                "cards": []
            }
            
            # Get cards
            cursor.execute(""" 
                SELECT ar.uid, 
                    COALESCE(
                        (SELECT package_type FROM card_packages WHERE uid = ar.uid AND package_type IN ('Master Card', 'Service Card') LIMIT 1),
                        (SELECT package_type FROM card_packages WHERE uid = ar.uid AND product_id = %s LIMIT 1),
                        'General'
                    ) as type,
                    TRUE as active
                FROM access_requests ar
                WHERE ar.product_id = %s
                GROUP BY ar.uid
            """, (product_id, product_id))

            for card in cursor.fetchall():
                product_data['cards'].append(dict(card))
            
            # Add guests if applicable
            if product_id in guests_by_product:
                product_data['guests'] = guests_by_product[product_id]
            
            response_data['products'].append(product_data)
        
        # Check if it's a VIP room
        cursor.execute("""
            SELECT product_id, vip_rooms
            FROM vip_rooms
            WHERE product_id = %s
        """, (product_id,))
        
        vip_room = cursor.fetchone()
        
        if vip_room:
            product_data = {
                "product_id": vip_room['product_id'],
                "updated": True,  # We're generating this for an update
                "cards": []
            }
            
            # Get cards
            cursor.execute("""
                SELECT ar.uid, 
                       COALESCE(cp.package_type, 'General') as type,
                       TRUE as active
                FROM access_requests ar
                LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
                WHERE ar.product_id = %s
                GROUP BY ar.uid, cp.package_type
            """, (product_id,))
            
            for card in cursor.fetchall():
                product_data['cards'].append(dict(card))
            
            # Add guests if any has access to this VIP room
            if product_id in guests_by_product:
                product_data['guests'] = guests_by_product[product_id]
            
            response_data['products'].append(product_data)
        
        if close_conn and conn:
            cursor.close()
            conn.close()
        
        return response_data
        
    except Exception as e:
        print(f"Error fetching access control data for product {product_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        if close_conn and conn:
            cursor.close()
            conn.close()
            
        return {"error": str(e)}


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

        if product_id:
            mark_product_updated(product_id)

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


# API ENDPOINTS 



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
        total_pages = (total_entries + per_page - 1) 
        
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
        # socketio.emit('new_rfid_entry', new_entry)
        return jsonify({'error': 'An error occurred fetching RFID entries'}), 500





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
        
        # Get daily trend data (last 30 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=29)
        
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
        
        # Initialize with all dates in range having zero counts
        daily_data = {}
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime('%Y-%m-%d')
            daily_data[date_str] = 0
            current_date += timedelta(days=1)
            
        # Fill in actual counts
        results = cursor.fetchall()
        for row in results:
            date_str = row['check_date'].strftime('%Y-%m-%d')
            daily_data[date_str] = row['count']
        
        # Convert to arrays for the response
        date_labels = list(daily_data.keys())
        daily_counts = list(daily_data.values())
        
        # Calculate average
        avg_daily = sum(daily_counts) / len(daily_counts) if daily_counts else 0
        
        # Get max and min days
        if daily_counts:
            max_count = max(daily_counts)
            max_day_idx = daily_counts.index(max_count)
            max_day = date_labels[max_day_idx]
            
            min_count = min(daily_counts)
            min_day_idx = daily_counts.index(min_count)
            min_day = date_labels[min_day_idx]
        else:
            max_count = 0
            max_day = 'N/A'
            min_count = 0
            min_day = 'N/A'

        # Create daily entries structure for the dashboard
        daily_entries = []
        for i, date_str in enumerate(date_labels):
            daily_entries.append({
                "date": date_str,
                "count": daily_counts[i]
            })
        
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
            'daily_labels': date_labels,
            'daily_counts': daily_counts,
            'daily_entries': daily_entries,  # Added structured daily entries data
            'recent_entries': serialized_entries,
            'average_entries': round(avg_daily, 1),  # Added average
            'peak_day': max_day,  # Added peak day
            'peak_count': max_count  # Added peak count
        })
    except Exception as e:
        print(f"Dashboard API error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'An error occurred fetching dashboard data'}), 500


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
                        mark_product_updated(product_id)
                
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
                        mark_product_updated(product_id)
                
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


# Add these endpoints after your existing user APIs

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update an existing user based on role permissions"""
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
        password = data.get('password')  # Optional, only update if provided
        role = data.get('role')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Get existing user to check permissions
        cursor.execute("SELECT id, email, role FROM users WHERE id = %s", (user_id,))
        existing_user = cursor.fetchone()
        
        if not existing_user:
            cursor.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Check permissions - can't modify super_admin unless you are super_admin
        if existing_user['role'] == 'super_admin' and current_user['role'] != 'super_admin':
            cursor.close()
            conn.close()
            return jsonify({'error': 'Only super_admin can modify super_admin users'}), 403
        
        # Check permissions - admins can't modify admins
        if existing_user['role'] == 'admin' and current_user['role'] == 'admin':
            cursor.close()
            conn.close()
            return jsonify({'error': 'Admins cannot modify other admins'}), 403
        
        # Store original role for history
        original_role = existing_user['role']
        
        # Build update query parts
        update_parts = []
        params = []
        
        # If role is changed and user has permission
        if role and role != original_role:
            # Check role permissions for the change
            if role == 'super_admin' and current_user['role'] != 'super_admin':
                cursor.close()
                conn.close()
                return jsonify({'error': 'Only super_admin can promote to super_admin'}), 403
                
            if role == 'admin' and current_user['role'] not in ['super_admin']:
                cursor.close()
                conn.close()
                return jsonify({'error': 'Only super_admin can promote to admin'}), 403
                
            if role == 'manager' and current_user['role'] not in ['super_admin', 'admin']:
                cursor.close()
                conn.close()
                return jsonify({'error': 'Only super_admin or admin can promote to manager'}), 403
                
            update_parts.append("role = %s")
            params.append(role)
            
            # Create history record for role change
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_history (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    change_type VARCHAR(50) NOT NULL,
                    previous_value TEXT,
                    new_value TEXT,
                    changed_by_id INTEGER NOT NULL,
                    changed_by_email VARCHAR(255) NOT NULL,
                    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            
            cursor.execute("""
                INSERT INTO user_history (
                    user_id, change_type, previous_value, new_value, 
                    changed_by_id, changed_by_email, timestamp
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id, 'role_change', original_role, role,
                current_user['id'], current_user['email'], datetime.now()
            ))
        
        # Update password if provided
        if password:
            hashed_password = generate_password_hash(password)
            update_parts.append("password = %s")
            params.append(hashed_password)
            
            # Create history record for password change (don't store the actual password)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_history (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    change_type VARCHAR(50) NOT NULL,
                    previous_value TEXT,
                    new_value TEXT,
                    changed_by_id INTEGER NOT NULL,
                    changed_by_email VARCHAR(255) NOT NULL,
                    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            
            cursor.execute("""
                INSERT INTO user_history (
                    user_id, change_type, previous_value, new_value, 
                    changed_by_id, changed_by_email, timestamp
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id, 'password_change', None, None,  # Don't store actual passwords
                current_user['id'], current_user['email'], datetime.now()
            ))
        
        # If we have fields to update, execute the update
        if update_parts:
            # Add the user_id at the end for the WHERE clause
            params.append(user_id)
            
            query = f"UPDATE users SET {', '.join(update_parts)} WHERE id = %s"
            cursor.execute(query, params)
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return jsonify({'message': 'User updated successfully'})
        else:
            conn.commit()
            cursor.close()
            conn.close()
            
            return jsonify({'message': 'No changes to update'})
        
    except Exception as e:
        print(f"Error updating user: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error updating user: {str(e)}"}), 500

@app.route('/api/users/<int:user_id>/history', methods=['GET'])
def get_user_history(user_id):
    """Get history of changes made to a user"""
    try:
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Check if user exists
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor()
        
        # Check if the user exists
        cursor.execute("SELECT id, email, role FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user_history table exists, create if not
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                change_type VARCHAR(50) NOT NULL,
                previous_value TEXT,
                new_value TEXT,
                changed_by_id INTEGER NOT NULL,
                changed_by_email VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        
        # Get history records
        cursor.execute("""
            SELECT id, change_type, previous_value, new_value, 
                   changed_by_id, changed_by_email, timestamp
            FROM user_history
            WHERE user_id = %s
            ORDER BY timestamp DESC
        """, (user_id,))
        
        history = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert history records to serializable format
        serialized_history = []
        for record in history:
            serialized_history.append({
                'id': record['id'],
                'change_type': record['change_type'],
                'previous_value': record['previous_value'],
                'new_value': record['new_value'],
                'changed_by_id': record['changed_by_id'],
                'changed_by_email': record['changed_by_email'],
                'timestamp': record['timestamp'].isoformat() if isinstance(record['timestamp'], datetime) else record['timestamp']
            })
        
        return jsonify({
            'history': serialized_history,
            'user_email': user['email']
        })
        
    except Exception as e:
        print(f"Error getting user history: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error getting user history: {str(e)}"}), 500

# Add a route to handle OPTIONS requests for CORS preflight
@app.route('/api/users/<int:user_id>', methods=['OPTIONS'])
def options_user(user_id):
    response = jsonify({})
    response.headers.add('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    return response




# REGISTER GUEST ENDPOINT




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

                cursor.execute("""
                    SELECT id, guest_id, name, id_type, id_number, address, room_id, 
                        card_ui_id, checkin_time, checkout_time, created_at
                    FROM guest_registrations 
                    WHERE checkout_time > NOW()  -- Only guests with future checkout times
                    ORDER BY checkin_time DESC
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
        
        # Get the product ID for this room
        cursor.execute("""
            SELECT product_id 
            FROM productstable 
            WHERE room_no = %s
        """, (room_id,))
        
        product_result = cursor.fetchone()
        product_id = None
        
        if product_result:
            product_id = product_result['product_id']
            
            # Mark the product as updated
            cursor.execute("""
                UPDATE productstable
                SET updated = TRUE
                WHERE product_id = %s
            """, (product_id,))
            
            print(f"Marked product {product_id} as updated for room {room_id}")
        else:
            print(f"Warning: No product found for room {room_id}")
        
        conn.commit()
        
        # Fetch updated access control data for this product and publish it to MQTT
        if product_id:
            access_data = fetch_access_control_data_for_product(product_id, cursor)
            conn.commit()
            publish_access_control_data(product_id, access_data)
        
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
        
        # Get current room_id for the guest before updating
        cursor.execute("SELECT room_id FROM guest_registrations WHERE id = %s", (guest_id,))
        existing_guest = cursor.fetchone()
        
        if not existing_guest:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Guest not found'}), 404
        
        old_room_id = existing_guest['room_id']
        
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
        
        # Get product IDs for both old and new rooms
        cursor.execute("SELECT product_id FROM productstable WHERE room_no = %s", (old_room_id,))
        old_product = cursor.fetchone()
        
        cursor.execute("SELECT product_id FROM productstable WHERE room_no = %s", (room_id,))
        new_product = cursor.fetchone()
        
        # Track products that need updating
        products_to_update = set()
        
        if old_product and 'product_id' in old_product:
            products_to_update.add(old_product['product_id'])
            mark_product_updated(old_product['product_id'])
        
        if new_product and 'product_id' in new_product:
            products_to_update.add(new_product['product_id'])
            mark_product_updated(new_product['product_id'])
        
        conn.commit()
        
        # Publish updated access control data for all affected products
        for product_id in products_to_update:
            access_data = fetch_access_control_data_for_product(product_id, cursor)
            publish_access_control_data(product_id, access_data)
        
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
        
        # Fetch guest's product_id before delete
        cursor.execute("""
            SELECT p.product_id
            FROM guest_registrations g
            JOIN productstable p ON g.room_id = p.room_no
            WHERE g.id = %s
        """, (guest_id,))
        product = cursor.fetchone()
        
        if not product:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Guest not found or no product associated with room'}), 404
        
        product_id = product['product_id']
        
        # Delete guest record
        cursor.execute("DELETE FROM guest_registrations WHERE id = %s", (guest_id,))
        
        # Mark the product as updated
        mark_product_updated(product_id)
        
        conn.commit()
        
        # Fetch updated access control data
        access_data = fetch_access_control_data_for_product(product_id, cursor)
        
        cursor.close()
        conn.close()
        
        # Publish the updated access control data to MQTT
        publish_access_control_data(product_id, access_data)
        
        return jsonify({'message': 'Guest deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting guest: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error deleting guest: {str(e)}"}), 500


@app.route('/api/guests/past', methods=['GET'])
def get_past_guests():
    """Get all past guest registrations (checkout time has passed)"""
    try:
        # Get authentication token
        auth_header = request.headers.get('Authorization')
        print(f"Auth header received: {auth_header}")
        
        # Get current user from session/token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database",
                'past_guests': []
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
            # Query using new column names for past guests only
            cursor.execute("""
                SELECT id, guest_id, name, id_type, id_number, address, room_id, 
                       card_ui_id, checkin_time, checkout_time, created_at
                FROM guest_registrations 
                WHERE checkout_time < NOW()
                ORDER BY checkout_time DESC
            """)
        else:
            # Query using old column names for past guests only
            cursor.execute("""
                SELECT id, guest_id, name, 'aadhar' as id_type, aadhar_number as id_number, 
                       address, room_id, card_ui_id, checkin_time, checkout_time, created_at
                FROM guest_registrations 
                WHERE checkout_time < NOW()
                ORDER BY checkout_time DESC
            """)
        
        past_guests = cursor.fetchall()
        
        # Convert dates to ISO format for JSON serialization
        if past_guests:
            for guest in past_guests:
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
                    
                # Add stay duration calculation
                if 'checkinTime' in guest and 'checkoutTime' in guest:
                    try:
                        checkin = datetime.fromisoformat(guest['checkinTime'])
                        checkout = datetime.fromisoformat(guest['checkoutTime'])
                        stay_days = (checkout - checkin).days
                        guest['stayDuration'] = stay_days
                    except:
                        guest['stayDuration'] = 0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'past_guests': past_guests,
            'count': len(past_guests)
        })
        
    except Exception as e:
        print(f"Error getting past guests: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f"Error fetching past guests: {str(e)}",
            'past_guests': []
        }), 500


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

        # Modified query for admin role
        # if current_user['role'] == 'admin':
        #     cursor.execute("""
        #         SELECT * FROM help_messages
        #         WHERE sender = %s OR recipient = %s OR recipient_role = 'admin'
        #         ORDER BY timestamp DESC
        #     """, (current_user['email'], current_user['email']))


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
    




@app.route('/api/help-messages/<int:message_id>/status', methods=['PUT']) 
def update_message_status(message_id):
    """Update the status of a help desk message"""
    try:
        # Get current user from token
        current_user = get_current_user_from_token()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Get status from request
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
            
        new_status = data['status']
        
        # Validate status
        valid_statuses = ['open', 'in_progress', 'resolved']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = conn.cursor()
        
        # Check if message exists and if user has access
        cursor.execute("""
            SELECT sender, recipient, sender_role, recipient_role
            FROM help_messages WHERE id = %s
        """, (message_id,))
        
        message = cursor.fetchone()
        if not message:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Message not found'}), 404
            
        # Check access rights
        has_access = False
        if current_user['role'] == 'admin':
            has_access = True
        elif current_user['role'] == 'manager':
            has_access = (
                message['sender'] == current_user['email'] or
                message['recipient'] == current_user['email'] or
                message['sender_role'] == 'clerk' or
                (message['recipient_role'] == 'clerk' and message['sender'] == current_user['email'])
            )
        else:
            has_access = (
                message['sender'] == current_user['email'] or
                message['recipient'] == current_user['email']
            )
            
        if not has_access:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Access denied'}), 403
        
        # Insert or update the status
        cursor.execute("""
            INSERT INTO help_message_status (message_id, status, updated_by)
            VALUES (%s, %s, %s)
            ON CONFLICT (message_id) 
            DO UPDATE SET status = %s, updated_at = NOW(), updated_by = %s
        """, (message_id, new_status, current_user['email'], new_status, current_user['email']))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': f'Status updated to {new_status}'
        })
        
    except Exception as e:
        print(f"Error updating message status: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error updating status: {str(e)}"}), 500






@app.route('/api/card_packages', methods=['GET'])
def get_card_packages():
    """API endpoint for getting all card packages"""
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
                        'id': row[0],
                        'product_id': row[1],
                        'uid': row[2],
                        'package_type': row[3]
                    })
                except (IndexError, TypeError):
                    # If that fails, try to access by column name
                    try:
                        packages.append({
                            'id': row.id,
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
        
        if not uid or not package_type:
            return jsonify({
                'error': "UID and package type are required"
            }), 400
        
        cursor = conn.cursor()
        
        # Upsert the card package (without trying to return an ID)
        cursor.execute("""
            INSERT INTO card_packages (product_id, uid, package_type) 
            VALUES (%s, %s, %s)
            ON CONFLICT (product_id, uid) DO UPDATE 
            SET package_type = EXCLUDED.package_type
        """, (product_id, uid, package_type))
        
        # Mark the product as updated if specified
        affected_products = []
        if product_id:
            mark_product_updated(product_id)
            affected_products.append(product_id)
            
        # Also mark all other products this UID has access to
        cursor.execute("""
            SELECT DISTINCT product_id
            FROM access_requests
            WHERE uid = %s AND product_id != %s
        """, (uid, product_id if product_id else ''))
        
        for row in cursor.fetchall():
            if row['product_id']:
                mark_product_updated(row['product_id'])
                affected_products.append(row['product_id'])
        
        # Commit changes
        conn.commit()
        
        # Publish updates to MQTT for all affected products
        for prod_id in affected_products:
            # Fetch updated access control data
            access_data = fetch_access_control_data_for_product(prod_id)
            
            # Publish to MQTT
            publish_access_control_data(prod_id, access_data)
        
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

@app.route('/api/card_packages/<int:package_id>', methods=['PUT'])
def update_card_package(package_id):
    """API endpoint for updating an existing card package"""
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
        
        # Get data from request
        product_id = data.get('product_id')
        uid = data.get('uid')
        package_type = data.get('package_type')
        
        # Check if at least one field is provided
        if product_id is None and uid is None and package_type is None:
            return jsonify({
                'error': "At least one field to update is required"
            }), 400
        
        cursor = conn.cursor()
        
        # First get the current package data to know what's changing
        cursor.execute("""
            SELECT product_id, uid FROM card_packages WHERE id = %s
        """, (package_id,))
        
        existing = cursor.fetchone()
        if not existing:
            cursor.close()
            conn.close()
            return jsonify({
                'error': "Card package not found"
            }), 404
        
        old_product_id = existing['product_id']
        old_uid = existing['uid']
        
        # Build the update query dynamically based on what fields are provided
        update_parts = []
        params = []
        
        if product_id is not None:
            update_parts.append("product_id = %s")
            params.append(product_id)
            
        if uid is not None:
            update_parts.append("uid = %s")
            params.append(uid)
            
        if package_type is not None:
            update_parts.append("package_type = %s")
            params.append(package_type)
            
        # Add the package_id at the end for the WHERE clause
        params.append(package_id)
        
        # Execute the update if there are fields to update
        if update_parts:
            query = f"UPDATE card_packages SET {', '.join(update_parts)} WHERE id = %s"
            cursor.execute(query, params)
        
        # Determine which products need to be marked as updated
        products_to_update = set()
        
        # Always update the old product_id if it exists
        if old_product_id:
            products_to_update.add(old_product_id)
        
        # If product_id was changed, also update the new one
        if product_id and product_id != old_product_id:
            products_to_update.add(product_id)
        
        # Update each affected product and publish changes
        for prod_id in products_to_update:
            mark_product_updated(prod_id)
            access_data = fetch_access_control_data_for_product(prod_id, cursor)
            # Will publish after commit
            
        # If UID changed, update all products associated with either old or new UID
        if uid and uid != old_uid:
            # Get all products associated with the old UID
            cursor.execute("""
                SELECT DISTINCT product_id FROM card_packages 
                WHERE uid = %s AND product_id IS NOT NULL AND product_id != %s
            """, (old_uid, old_product_id if old_product_id else ''))
            
            for row in cursor.fetchall():
                prod_id = row['product_id']
                if prod_id not in products_to_update:
                    products_to_update.add(prod_id)
                    mark_product_updated(prod_id)
            
            # Get all products associated with the new UID
            cursor.execute("""
                SELECT DISTINCT product_id FROM card_packages 
                WHERE uid = %s AND product_id IS NOT NULL AND product_id != %s
            """, (uid, product_id if product_id else ''))
            
            for row in cursor.fetchall():
                prod_id = row['product_id']
                if prod_id not in products_to_update:
                    products_to_update.add(prod_id)
                    mark_product_updated(prod_id)
        
        # Commit changes
        conn.commit()
        
        # Now publish updates for all affected products
        for prod_id in products_to_update:
            access_data = fetch_access_control_data_for_product(prod_id)
            publish_access_control_data(prod_id, access_data)
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': "Card package updated successfully!"
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in update_card_package API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error updating card package: {str(e)}"
        }), 500

@app.route('/api/card_packages/<int:package_id>', methods=['DELETE'])
def delete_card_package(package_id):
    """API endpoint for deleting a card package"""
    conn = get_db_connection()
    
    if not conn:
        return jsonify({
            'error': "Unable to connect to database"
        }), 500
    
    try:
        cursor = conn.cursor()
        
        # First get the product_id and uid to know what needs updating
        cursor.execute("""
            SELECT product_id, uid FROM card_packages WHERE id = %s
        """, (package_id,))
        
        package = cursor.fetchone()
        if not package:
            cursor.close()
            conn.close()
            return jsonify({
                'error': "Card package not found"
            }), 404
        
        product_id = package['product_id']
        uid = package['uid']
        
        # Delete the card package
        cursor.execute("DELETE FROM card_packages WHERE id = %s", (package_id,))
        
        # Mark the product as updated
        if product_id:
            mark_product_updated(product_id)
            
            # Fetch updated access control data for this product
            access_data = fetch_access_control_data_for_product(product_id, cursor)
        
        # Commit changes
        conn.commit()
        cursor.close()
        conn.close()
        
        # Publish the updated access control data to MQTT
        if product_id:
            publish_access_control_data(product_id, access_data)
        
        return jsonify({
            'success': "Card package deleted successfully!"
        })
        
    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        
        import traceback
        print("Error in delete_card_package API:")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f"Error deleting card package: {str(e)}"
        }), 500

@app.route('/api/card_packages', methods=['OPTIONS'])
def options_card_packages():
    """Handle OPTIONS preflight requests for the card_packages endpoint"""
    response = app.make_default_options_response()
    response.headers.add('Access-Control-Allow-Methods', 'GET')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    return response




@app.route('/api/access_matrix', methods=['GET'])   
def get_access_matrix():
    """API endpoint for getting the package access matrix"""
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



@app.route('/api/access_matrix', methods=['POST'])
def update_access_matrix():
    """API endpoint for updating the package access matrix"""
    try:
        # Get request JSON data
        data = request.get_json()
        
        if not data or 'matrix' not in data:
            return jsonify({'error': "No matrix data provided"}), 400
        
        matrix = data['matrix']
        print(f"Received matrix data: {json.dumps(matrix, indent=2)}")
        
        # Use a simple approach with autocommit enabled
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': "Unable to connect to database"}), 500
        
        # Enable autocommit to avoid transaction issues
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Get current matrix for comparison
        cursor.execute("SELECT package_type, facility, has_access FROM access_matrix")
        current_matrix = {}
        
        for row in cursor.fetchall():
            package_type = row['package_type']
            facility = row['facility']
            has_access = row['has_access']
            
            if package_type not in current_matrix:
                current_matrix[package_type] = {}
            
            current_matrix[package_type][facility] = has_access
        
        print(f"Current matrix in DB: {json.dumps(current_matrix, indent=2)}")
        
        updated_facilities = set()
        
        # Process each update individually
        for package_type, facilities in matrix.items():
            for facility, has_access in facilities.items():
                print(f"Processing: {package_type} -> {facility} -> {has_access}")
                
                # Check if record exists
                cursor.execute("""
                    SELECT has_access FROM access_matrix 
                    WHERE package_type = %s AND facility = %s
                """, (package_type, facility))
                
                result = cursor.fetchone()
                
                if result:
                    # Record exists, update it
                    current_access = result['has_access']
                    if current_access != has_access:
                        print(f"Updating: {package_type}, {facility}: {current_access} -> {has_access}")
                        cursor.execute("""
                            UPDATE access_matrix 
                            SET has_access = %s 
                            WHERE package_type = %s AND facility = %s
                        """, (has_access, package_type, facility))
                        updated_facilities.add(facility)
                    else:
                        print(f"No change needed for: {package_type}, {facility}")
                else:
                    # Record doesn't exist, insert it
                    print(f"Inserting new record: {package_type}, {facility}, {has_access}")
                    cursor.execute("""
                        INSERT INTO access_matrix (package_type, facility, has_access)
                        VALUES (%s, %s, %s)
                    """, (package_type, facility, has_access))
                    updated_facilities.add(facility)
        
        print("All database changes completed successfully")
        
        # Handle MQTT updates
        if updated_facilities:
            print(f"Updating facilities via MQTT: {updated_facilities}")
            for facility in updated_facilities:
                try:
                    cursor.execute("SELECT product_id FROM vip_rooms WHERE vip_rooms = %s", (facility,))
                    result = cursor.fetchone()
                    if result:
                        product_id = result['product_id']
                        mark_product_updated(product_id)
                        print(f"Marked product {product_id} as updated for facility {facility}")
                except Exception as mqtt_error:
                    print(f"Warning: Could not update MQTT for facility {facility}: {mqtt_error}")
        
        cursor.close()
        conn.close()
        
        return jsonify({'success': "Access matrix updated successfully!"})
        
    except Exception as e:
        print(f"Error in update_access_matrix: {e}")
        import traceback
        traceback.print_exc()
        
        # Clean up connections
        try:
            if 'cursor' in locals() and cursor:
                cursor.close()
            if 'conn' in locals() and conn:
                conn.close()
        except:
            pass
            
        return jsonify({'error': f"Error updating access matrix: {str(e)}"}), 500



# vip tables endpoint
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
        mark_product_updated(product_id)

        
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
        mark_product_updated(product_id)
        
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
    


@app.route('/api/routes', methods=['GET'])
def list_routes():
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': [method for method in rule.methods if method not in ('HEAD', 'OPTIONS')],
            'route': str(rule)
        })
    return jsonify(routes)







# Define file paths for health data storage
HEALTH_DATA_DIR = 'health_data'
HEALTH_HISTORY_DIR = 'health_history'

# Store health data per room ID
latest_health_data = {}
health_history = {}
MAX_HISTORY_ENTRIES = 50 

# Ensure directories exist
def ensure_directories():
    try:
        if not os.path.exists(HEALTH_DATA_DIR):
            os.makedirs(HEALTH_DATA_DIR)
        if not os.path.exists(HEALTH_HISTORY_DIR):
            os.makedirs(HEALTH_HISTORY_DIR)
    except Exception as e:
        print(f"Error creating directories: {e}")

# Load data from disk at startup
def load_health_data():
    global latest_health_data, health_history
    try:
        ensure_directories()

        # Load latest health data for each room
        if os.path.exists(HEALTH_DATA_DIR):
            for filename in os.listdir(HEALTH_DATA_DIR):
                if filename.endswith('.json'):
                    room_id = filename[:-5] # Remove .json extension
                    file_path = os.path.join(HEALTH_DATA_DIR, filename)
                    with open(file_path, 'r') as f:
                        latest_health_data[room_id] = json.load(f)
                        print(f"Loaded health data for room {room_id}")

        # Load history data for each room
        if os.path.exists(HEALTH_HISTORY_DIR):
            for filename in os.listdir(HEALTH_HISTORY_DIR):
                if filename.endswith('.json'):
                    room_id = filename[:-5] # Remove .json extension
                    file_path = os.path.join(HEALTH_HISTORY_DIR, filename)
                    with open(file_path, 'r') as f:
                        health_history[room_id] = json.load(f)
                        print(f"Loaded {len(health_history[room_id])} history entries for room {room_id}")

    except Exception as e:
        print(f"Error loading health data from disk: {e}")

# Save data to disk
def save_health_data(room_id):
    try:
        ensure_directories()
        file_path = os.path.join(HEALTH_DATA_DIR, f"{room_id}.json")
        with open(file_path, 'w') as f:
            json.dump(latest_health_data[room_id], f)
    except Exception as e:
        print(f"Error saving health data for {room_id}: {e}")

def save_health_history(room_id):
    try:
        ensure_directories()
        file_path = os.path.join(HEALTH_HISTORY_DIR, f"{room_id}.json")
        with open(file_path, 'w') as f:
            json.dump(health_history[room_id], f)
    except Exception as e:
        print(f"Error saving health history for {room_id}: {e}")

# Load data at application startup
load_health_data()


# --- API Endpoints ---




@app.route('/api/system_health', methods=['GET', 'POST'])
def system_health():
    """
    API Endpoint to handle system health status by room ID or VIP room name.
    - GET request: Returns health status for a specific room_id or vip_room
    - POST request: Receives health status data from a hardware device and stores it
    """
    global latest_health_data, health_history

    if request.method == 'POST':
        try:
            # Get the JSON data sent by the hardware device
            data = request.get_json()
            print(f"Received health update from device: {json.dumps(data, indent=2)}")

            room_id = None
            
            # Check if it's a regular room submission
            if "room_id" in data:
                room_id = data["room_id"]
                print(f"Processing health data for regular room: {room_id}")
            
            # Check if it's a VIP room submission
            elif "vip_rooms" in data:
                vip_room_name = data["vip_rooms"]
                print(f"Processing health data for VIP room: {vip_room_name}")
                
                # Look up the product_id for this VIP room name
                try:
                    conn = get_db_connection()
                    if not conn:
                        return jsonify({"error": "Database connection failed"}), 500
                        
                    cursor = conn.cursor()
                    cursor.execute("SELECT product_id FROM vip_rooms WHERE vip_rooms = %s", (vip_room_name,))
                    result = cursor.fetchone()
                    cursor.close()
                    conn.close()
                    
                    if result:
                        room_id = result['product_id']
                        print(f"Mapped VIP room '{vip_room_name}' to product_id '{room_id}'")
                        
                        # Replace vip_rooms with room_id in the data for storage
                        data.pop("vip_rooms")
                        data["room_id"] = room_id
                        data["vip_room_name"] = vip_room_name  # Store the original name for reference
                    else:
                        return jsonify({
                            "error": f"No VIP room found with name '{vip_room_name}'",
                            "vip_room": vip_room_name
                        }), 404
                except Exception as e:
                    print(f"Error looking up VIP room: {e}")
                    return jsonify({"error": f"Error looking up VIP room: {e}"}), 500
            
            # Validate the incoming data structure and the room_id
            if room_id and "system_health" in data and all(key in data["system_health"] for key in ["rtc", "wifi", "internet", "ota"]):
                # Add timestamp for this update
                timestamp = datetime.now().isoformat()
                data_with_timestamp = {
                    "timestamp": timestamp,
                    **data  # Include all the original data
                }
                
                # Initialize history for this room if it doesn't exist
                if room_id not in health_history:
                    health_history[room_id] = []
                
                # Store in history
                health_history[room_id].append(data_with_timestamp)
                # Keep only the latest MAX_HISTORY_ENTRIES entries
                health_history[room_id] = health_history[room_id][-MAX_HISTORY_ENTRIES:]
                # Save history to disk
                save_health_history(room_id)
                
                # Update latest health data
                latest_health_data[room_id] = data
                # Save data to disk
                save_health_data(room_id)
                
                print(f"Health data updated successfully for room {room_id} and saved to disk.")
                return jsonify({"message": "Health data received and updated"}), 200
            else:
                print("Received invalid health data format.")
                return jsonify({"error": "Invalid data format. Requires either 'room_id' or 'vip_rooms', and 'system_health' with 'rtc', 'wifi', 'internet', 'ota'."}), 400

        except Exception as e:
            print(f"Error processing health update from device: {e}")
            return jsonify({"error": f"Internal server error: {e}"}), 500

    # GET request handling remains the same - already supports both room_id and vip_room parameters
    elif request.method == 'GET':
        # Get the room_id or vip_room from query parameters
        room_id = request.args.get('room_id')
        vip_room = request.args.get('vip_room')
        
        # Use product_id from vip_rooms table if vip_room parameter is provided
        if vip_room and not room_id:
            try:
                conn = get_db_connection()
                if not conn:
                    return jsonify({"error": "Database connection failed"}), 500
                    
                cursor = conn.cursor()
                cursor.execute("SELECT product_id FROM vip_rooms WHERE vip_rooms = %s", (vip_room,))
                result = cursor.fetchone()
                cursor.close()
                conn.close()
                
                if result:
                    room_id = result['product_id']
                    print(f"Mapped VIP room '{vip_room}' to product_id '{room_id}'")
                else:
                    return jsonify({
                        "error": f"No VIP room found with name '{vip_room}'",
                        "vip_room": vip_room
                    }), 404
            except Exception as e:
                print(f"Error looking up VIP room: {e}")
                return jsonify({"error": f"Error looking up VIP room: {e}"}), 500
        
        print(f"GET request for /api/system_health with room_id={room_id}")
        
        if not room_id:
            return jsonify({"error": "Missing room_id or vip_room parameter"}), 400
        
        if room_id in latest_health_data:
            response_data = latest_health_data[room_id].copy()
            
            # If this was originally a VIP room (it has vip_room_name), 
            # add both the product_id and the vip_room name
            if 'vip_room_name' in response_data:
                response_data['vip_rooms'] = response_data['vip_room_name']
                
            return jsonify(response_data)
        else:
            # No health data for this room yet
            return jsonify({
                "error": f"No health data available for room {room_id}",
                "room_id": room_id
            }), 404

    return jsonify({"error": "Method not allowed"}), 405

@app.route('/api/system_health/history', methods=['GET'])
def system_health_history():
    """
    API Endpoint to retrieve historical system health data for a specific room.
    """
    # Get the room_id or vip_room from query parameters
    room_id = request.args.get('room_id')
    vip_room = request.args.get('vip_room')
    
    # Use product_id from vip_rooms table if vip_room parameter is provided
    if vip_room and not room_id:
        try:
            conn = get_db_connection()
            if not conn:
                return jsonify({"error": "Database connection failed"}), 500
                
            cursor = conn.cursor()
            cursor.execute("SELECT product_id FROM vip_rooms WHERE vip_rooms = %s", (vip_room,))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if result:
                room_id = result['product_id']
                print(f"Mapped VIP room '{vip_room}' to product_id '{room_id}'")
            else:
                return jsonify({
                    "error": f"No VIP room found with name '{vip_room}'",
                    "vip_room": vip_room,
                    "history": []
                }), 404
        except Exception as e:
            print(f"Error looking up VIP room: {e}")
            return jsonify({"error": f"Error looking up VIP room: {e}", "history": []}), 500
    
    print(f"GET request for /api/system_health/history with room_id={room_id}")
    
    if not room_id:
        return jsonify({"error": "Missing room_id or vip_room parameter"}), 400
    
    # If no history for this room, return empty list
    if room_id not in health_history:
        response = jsonify({"history": []})
    else:
        # Optional: Allow limiting the number of entries returned
        limit = request.args.get('limit', default=10, type=int)
        if limit > MAX_HISTORY_ENTRIES:
            limit = MAX_HISTORY_ENTRIES
        
        # Get the most recent entries up to the limit
        history_entries = health_history[room_id][-limit:]
        
        # Ensure vip_rooms field is included in the response if applicable
        for entry in history_entries:
            if 'vip_room_name' in entry:
                entry['vip_rooms'] = entry['vip_room_name']
            
        # Return the history data
        response = jsonify({"history": history_entries})
    
    return response


@app.route('/api/system_health/history/all', methods=['GET'])
def all_system_health_history():
    """
    API Endpoint to retrieve historical system health data for all rooms.
    """
    print(f"GET request for /system_health/history/all")
    
    # Optional: Allow limiting the number of entries returned per room
    limit = request.args.get('limit', default=50, type=int)
    if limit > MAX_HISTORY_ENTRIES:
        limit = MAX_HISTORY_ENTRIES
    
    # Prepare a list to hold all history entries
    all_history = []
    
    # Collect history from all rooms
    for room_id, room_history in health_history.items():
        # Get the most recent entries up to the limit
        recent_entries = room_history[-limit:]
        
        # Ensure each entry has a room_id field
        for entry in recent_entries:
            # Make sure entry has room_id
            if 'room_id' not in entry:
                entry['room_id'] = room_id
                
            # Include VIP room name if available
            if 'vip_room_name' in entry:
                entry['vip_rooms'] = entry['vip_room_name']
        
        # Add to the combined list
        all_history.extend(recent_entries)
    
    # Sort all entries by timestamp, most recent first
    all_history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    # Optionally limit the total number of entries across all rooms
    total_limit = request.args.get('total_limit', default=200, type=int)
    if len(all_history) > total_limit:
        all_history = all_history[:total_limit]
    
    # Return the combined history data
    return jsonify({"history": all_history})


@app.route('/api/ota', methods=['GET'])
def get_ota_details():
    """
    API Endpoint to provide OTA details for a specific room ID.
    Returns product version, firmware version, and update URL in JSON format.
    """
    room_id = request.args.get('room_id') # Expect room_id as a query parameter
    print(f"Received GET request for /ota with room_id={room_id}")

    ota_details = {
        "product_version": "Unknown", # This would typically come from the device or a config
        "Firmware version": "Unknown",
        "url": None
    }

    if room_id and room_id in latest_health_data:
        # Access health data using room_id
        health_info = latest_health_data[room_id]
        if "system_health" in health_info and "ota" in health_info["system_health"]:
            ota_info = health_info["system_health"]["ota"]
            ota_details = {
                "product_version": ota_info.get("product_version", "v1.0"), # Assuming device sends this
                "Firmware version": ota_info.get("current_version", "Unknown"), # Current version from device
                "url": ota_info.get("update_url", None) # Update URL from device or config
            }
        # If the device sends a specific product version, it should be in the health data
        # Otherwise, "v1.0" or similar is a placeholder for a generic product version
        ota_details["product_version"] = health_info.get("product_version", ota_details["product_version"])

    return jsonify(ota_details)

@app.route('/api/initiate_ota_update', methods=['POST'])
def initiate_ota_update():
    """
    API Endpoint to initiate an OTA update for a specific room.
    Expects JSON with 'update_url' and 'room_id'.
    """
    try:
        data = request.get_json()
        update_url = data.get('update_url')
        room_id = data.get('room_id') # Changed from product_id

        if not update_url or not room_id:
            return jsonify({"error": "Missing 'update_url' or 'room_id'"}), 400

        # In a real application, you would send a command to the device
        # identified by room_id to initiate the OTA update using update_url.
        # For now, we'll just log it.
        print(f"Initiating OTA update for room {room_id} with URL: {update_url}")

        # You might want to store this OTA request or push it to a queue
        # for a device management system to pick up.

        return jsonify({"message": f"OTA update initiated for room {room_id}"}), 200

    except Exception as e:
        print(f"Error initiating OTA update: {e}")
        return jsonify({"error": f"Internal server error: {e}"}), 500



# # # good handling duplicates

@app.route('/api/access_control_data', methods=['GET'])
def get_access_control_data():
    try:
        requested_product_id = request.args.get('product_id')
        print(f"Access control data requested, product_id: {requested_product_id}")

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500

        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        response_data = {
            "cards": [],
            "products": []
        }

        # 1. Master and Service Cards - ONLY ACTIVE ONES
        cursor.execute("""
            SELECT cp.uid, cp.package_type as type
            FROM card_packages cp
            JOIN access_requests ar ON cp.uid = ar.uid
            WHERE cp.package_type IN ('Master Card', 'Service Card')
            AND ar.active = TRUE
            GROUP BY cp.uid, cp.package_type
        """)

        special_cards = cursor.fetchall()
        for card in special_cards:
            response_data['cards'].append({
                "uid": card['uid'],
                "type": card['type'],
                "access_rooms": ["all"],
                "active": True
            })

        # 2. Access Matrix
        cursor.execute("SELECT package_type, facility, has_access FROM access_matrix")
        package_access = {}
        for row in cursor.fetchall():
            pkg_type = row['package_type']
            facility = row['facility']
            has_access = row['has_access']
            package_access.setdefault(pkg_type, {})[facility] = has_access

        # 3. VIP Room Mappings
        cursor.execute("SELECT product_id, vip_rooms FROM vip_rooms")
        vip_product_to_facility = {}
        facility_to_product = {}
        for row in cursor.fetchall():
            vip_product_to_facility[row['product_id']] = row['vip_rooms']
            facility_to_product[row['vip_rooms']] = row['product_id']

        # 4. Get all cards data and create unique card details
        cursor.execute("""
            SELECT ar.uid, ar.product_id, COALESCE(cp.package_type, 'General') as type, ar.active
            FROM access_requests ar
            LEFT JOIN card_packages cp ON ar.uid = cp.uid AND ar.product_id = cp.product_id
        """)

        all_cards_data = cursor.fetchall()
        card_details = {}  # Map UID to details (avoiding duplicates by UID)
        product_cards = {}  # Map product_id to set of card UIDs (to avoid duplicates)
        
        for card in all_cards_data:
            uid = card['uid']
            product_id = card['product_id']
            card_type = card['type']
            
            # Store unique card details by UID
            if uid not in card_details:
                card_details[uid] = {
                    'uid': uid,
                    'type': card_type,
                    'active': card['active']
                }
            else:
                # Update with more specific package type if available
                if card_type != 'General' and card_details[uid]['type'] == 'General':
                    card_details[uid]['type'] = card_type
            
            # Use set to track unique UIDs per product
            if product_id not in product_cards:
                product_cards[product_id] = set()
            product_cards[product_id].add(uid)

        # 5. Handle VIP room access based on access matrix
        for facility, vip_product_id in facility_to_product.items():
            if vip_product_id not in product_cards:
                product_cards[vip_product_id] = set()
                
            # Add Master and Service cards to VIP rooms automatically
            for uid, card_info in card_details.items():
                card_type = card_info['type']
                
                # Only Master Card and Service Card have universal access
                if card_type in ['Master Card', 'Service Card']:
                    product_cards[vip_product_id].add(uid)
                # Regular package types (including General) - check access matrix
                else:
                    if card_type in package_access and facility in package_access[card_type] and package_access[card_type][facility]:
                        product_cards[vip_product_id].add(uid)

        # 6. Active Guests
        cursor.execute("""
            SELECT g.id, g.name, g.card_ui_id as uid, g.room_id,
                   g.checkin_time as checkin, g.checkout_time as checkout,
                   p.product_id
            FROM guest_registrations g
            JOIN productstable p ON g.room_id = p.room_no
            WHERE NOW() BETWEEN g.checkin_time AND g.checkout_time
              AND g.checkout_time > NOW()
        """)

        all_guests = cursor.fetchall()
        guests_with_packages = []
        for guest in all_guests:
            guest_dict = dict(guest)
            card_uid = guest_dict['uid']
            cursor.execute("""
                SELECT cp.package_type 
                FROM card_packages cp 
                JOIN access_requests ar ON cp.uid = ar.uid
                WHERE cp.uid = %s AND ar.active = TRUE
                LIMIT 1
            """, (card_uid,))
            pkg_result = cursor.fetchone()
            package_type = pkg_result['package_type'] if pkg_result else 'General'

            # Only add active guest cards
            cursor.execute("""
                SELECT active FROM access_requests 
                WHERE uid = %s AND product_id = %s
            """, (card_uid, guest_dict['product_id']))
            card_status = cursor.fetchone()
            if not card_status or not card_status['active']:
                continue

            access_rooms = [guest_dict['product_id']]
            if package_type in package_access:
                for facility, has_access in package_access[package_type].items():
                    if has_access and facility in facility_to_product:
                        access_rooms.append(facility_to_product[facility])

            guests_with_packages.append({
                "name": guest_dict['name'],
                "uid": card_uid,
                "checkin": guest_dict['checkin'].strftime('%Y-%m-%d %H:%M:%S'),
                "checkout": guest_dict['checkout'].strftime('%Y-%m-%d %H:%M:%S'),
                "package_type": package_type,
                "access_rooms": access_rooms
            })

        guests_by_product = {}
        for guest in guests_with_packages:
            for pid in guest['access_rooms']:
                guests_by_product.setdefault(pid, []).append(guest)

        # 7. Add guest cards (only active ones) - avoid duplicates
        existing_uids = {card['uid'] for card in response_data['cards']}
        for guest in guests_with_packages:
            if guest['uid'] not in existing_uids:
                response_data['cards'].append({
                    "uid": guest['uid'],
                    "type": guest['package_type'],
                    "active": True,
                    "access_rooms": guest['access_rooms']
                })
                existing_uids.add(guest['uid'])  # Track this UID as added

        # 8. Build final response
        if requested_product_id:
            # Handle single product request
            cursor.execute("SELECT product_id, room_no, COALESCE(updated, FALSE) as updated FROM productstable WHERE product_id = %s", (requested_product_id,))
            result = cursor.fetchone()
            if result:
                # Convert set to list of card objects
                cards_list = []
                if result['product_id'] in product_cards:
                    for uid in product_cards[result['product_id']]:
                        if uid in card_details:
                            cards_list.append(card_details[uid])
                
                product_data = {
                    "product_id": result['product_id'], 
                    "updated": result['updated'],
                    "cards": cards_list
                }
                
                if result['product_id'] in guests_by_product:
                    product_data['guests'] = guests_by_product[result['product_id']]
                    
                response_data['products'].append(product_data)
                cursor.execute("UPDATE productstable SET updated = FALSE WHERE product_id = %s", (requested_product_id,))

            cursor.execute("SELECT product_id, vip_rooms, COALESCE(updated, FALSE) as updated FROM vip_rooms WHERE product_id = %s", (requested_product_id,))
            vip_result = cursor.fetchone()
            if vip_result:
                # Convert set to list of card objects
                cards_list = []
                if vip_result['product_id'] in product_cards:
                    for uid in product_cards[vip_result['product_id']]:
                        if uid in card_details:
                            cards_list.append(card_details[uid])
                
                product_data = {
                    "product_id": vip_result['product_id'],
                    "updated": vip_result['updated'],
                    "cards": cards_list
                }
                
                if vip_result['product_id'] in guests_by_product:
                    product_data['guests'] = guests_by_product[vip_result['product_id']]
                    
                response_data['products'].append(product_data)
                cursor.execute("UPDATE vip_rooms SET updated = FALSE WHERE product_id = %s", (requested_product_id,))

            conn.commit()
        else:
            # Handle all products request
            cursor.execute("SELECT product_id, room_no, COALESCE(updated, FALSE) as updated FROM productstable")
            for row in cursor.fetchall():
                pid = row['product_id']
                # Convert set to list of card objects
                cards_list = []
                if pid in product_cards:
                    for uid in product_cards[pid]:
                        if uid in card_details:
                            cards_list.append(card_details[uid])
                
                product_data = {
                    "product_id": pid,
                    "updated": row['updated'],
                    "cards": cards_list
                }
                
                if pid in guests_by_product:
                    product_data['guests'] = guests_by_product[pid]
                    
                response_data['products'].append(product_data)

            cursor.execute("SELECT product_id, vip_rooms, COALESCE(updated, FALSE) as updated FROM vip_rooms")
            for row in cursor.fetchall():
                pid = row['product_id']
                # Convert set to list of card objects
                cards_list = []
                if pid in product_cards:
                    for uid in product_cards[pid]:
                        if uid in card_details:
                            cards_list.append(card_details[uid])
                
                product_data = {
                    "product_id": pid,
                    "updated": row['updated'],
                    "cards": cards_list
                }
                
                if pid in guests_by_product:
                    product_data['guests'] = guests_by_product[pid]
                    
                response_data['products'].append(product_data)

        cursor.close()
        conn.close()

        response_data['products'] = sorted(response_data['products'], key=lambda x: x['product_id'])

        if requested_product_id:
            publish_access_control_data(requested_product_id, response_data)

        return jsonify(response_data)

    except Exception as e:
        print(f"Error getting access control data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error fetching access control data: {str(e)}"}), 500



@app.route('/api/update_card_status', methods=['POST'])
def update_card_status():
    """
    Update the active status of a card for a specific product
    """
    try:
        data = request.json
        
        if not data or 'product_id' not in data or 'uid' not in data or 'active' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
            
        product_id = data['product_id']
        uid = data['uid']
        active = data['active']
        
        # Get database connection
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Update the active status in the database
        cursor.execute("""
            UPDATE access_requests
            SET active = %s
            WHERE product_id = %s AND uid = %s
        """, (active, product_id, uid))
        
        # Set the product as updated to ensure changes are synced to devices
        cursor.execute("""
            UPDATE productstable
            SET updated = TRUE
            WHERE product_id = %s
        """, (product_id,))
        
        # Also check if it's a VIP room and update it if needed
        cursor.execute("""
            UPDATE vip_rooms
            SET updated = TRUE
            WHERE product_id = %s
        """, (product_id,))
        
        # Commit the changes
        conn.commit()
        
        # Trigger an update notification for this product
        publish_access_control_data(product_id, None)
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f"Card {uid} for product {product_id} has been {'activated' if active else 'disabled'}"
        })
        
    except Exception as e:
        print(f"Error updating card status: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error updating card status: {str(e)}"
        }), 500, 





@app.route('/api/test', methods=['GET'])
def test_endpoint():
    return jsonify({"message": "CORS is working"})




# Now, let's fix the activity history endpoint to handle OPTIONS requests properly
@app.route('/api/users/activity-history', methods=['GET', 'OPTIONS'])
def get_all_activity_history():
    """Get all user activity history with pagination."""
    # Handle OPTIONS request (preflight)
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response

    try:
        # Get current user from session/token
        # Comment this out temporarily to test if it's causing the issue
        # current_user = get_current_user_from_token()
        # if not current_user:
        #     return jsonify({'error': 'Authentication required'}), 401
        
        # # Only allow admin roles to access this endpoint
        # if current_user['role'] not in ['super_admin', 'admin', 'manager']:
        #     return jsonify({'error': 'Unauthorized access'}), 403
        
        # Parse pagination parameters
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 10, type=int)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Unable to connect to database'}), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)  # Use RealDictCursor here
        
        # Check if user_history table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'user_history'
            )
        """)
        
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_history (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    change_type VARCHAR(50) NOT NULL,
                    previous_value TEXT,
                    new_value TEXT,
                    changed_by_id INTEGER,
                    changed_by_email VARCHAR(255),
                    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            conn.commit()
            # Return empty result since table was just created
            return jsonify({
                'activity': {
                    'records': [],
                    'totalCount': 0,
                    'currentPage': page,
                    'pageSize': page_size
                }
            }), 200
        
        # Count total records for pagination
        cursor.execute("SELECT COUNT(*) FROM user_history")
        total_count = cursor.fetchone()['count']
        
        # Query with pagination
        cursor.execute("""
            SELECT 
                uh.id, 
                uh.user_id,
                u.email as user_email,
                uh.change_type,
                uh.previous_value,
                uh.new_value,
                uh.changed_by_id,
                uh.changed_by_email,
                uh.timestamp
            FROM 
                user_history uh
            LEFT JOIN
                users u ON uh.user_id = u.id
            ORDER BY 
                uh.timestamp DESC
            LIMIT %s OFFSET %s
        """, (page_size, (page - 1) * page_size))
        
        records = cursor.fetchall()
        
        # Format the results
        history_records = []
        for record in records:
            history_records.append({
                'id': record['id'],
                'user_id': record['user_id'],
                'user_email': record['user_email'] or 'Unknown User',
                'change_type': record['change_type'],
                'previous_value': record['previous_value'],
                'new_value': record['new_value'],
                'changed_by_id': record['changed_by_id'],
                'changed_by_email': record['changed_by_email'] or 'System',
                'timestamp': record['timestamp'].isoformat() if record['timestamp'] else None
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'activity': {
                'records': history_records,
                'totalCount': total_count,
                'currentPage': page,
                'pageSize': page_size
            }
        }), 200
    
    except Exception as e:
        print(f"Error fetching activity history: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error fetching activity history: {str(e)}"}), 500









@app.route('/api/managers', methods=['POST'])
def register_manager():
    """API endpoint for registering a new manager"""
    try:
        # Get JSON data from request
        data = request.json
        if not data:
            return jsonify({
                'error': "Missing request data"
            }), 400
            
        # Extract required fields
        manager_id = data.get('managerId')
        name = data.get('name')
        role = data.get('role', 'manager')  # Default to 'manager' if not provided
        card_ui_id = data.get('cardUiId')
        
        # Validate required fields
        if not all([manager_id, name, card_ui_id]):
            return jsonify({
                'error': "Missing required fields: managerId, name, and cardUiId are required"
            }), 400
            
        # Get database connection
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database"
            }), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if the manager ID already exists
        cursor.execute("SELECT COUNT(*) FROM managers WHERE manager_id = %s", (manager_id,))
        if cursor.fetchone()['count'] > 0:
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"Manager with ID {manager_id} already exists"
            }), 409  # Conflict
            
        # Check if the card is already assigned to another manager
        cursor.execute("SELECT COUNT(*) FROM managers WHERE card_ui_id = %s", (card_ui_id,))
        if cursor.fetchone()['count'] > 0:
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"Card {card_ui_id} is already assigned to another manager"
            }), 409  # Conflict
        
        # Insert the new manager
        cursor.execute("""
            INSERT INTO managers (manager_id, name, role, card_ui_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (manager_id, name, role, card_ui_id))
        
        # Get the newly created manager's ID
        new_id = cursor.fetchone()['id']
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': "Manager registered successfully",
            'id': new_id
        }), 201  # Created
        
    except Exception as e:
        print(f"Error registering manager: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error registering manager: {str(e)}"
        }), 500


@app.route('/api/managers/<manager_id>', methods=['PUT'])
def update_manager_string(manager_id):
    """API endpoint for updating a manager with string ID"""
    try:
        # Convert to int if possible (for backward compatibility)
        try:
            int_id = int(manager_id)
            return update_manager(int_id)
        except ValueError:
            # If not an integer, continue with string-based logic
            pass
            
        # Get JSON data from request
        data = request.json
        if not data:
            return jsonify({
                'error': "Missing request data"
            }), 400
            
        # Get database connection
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database"
            }), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if the manager exists by manager_id instead of id
        cursor.execute("SELECT * FROM managers WHERE manager_id = %s", (manager_id,))
        existing_manager = cursor.fetchone()
        
        if not existing_manager:
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"No manager found with Manager ID {manager_id}"
            }), 404
            
        # Extract fields to update
        name = data.get('name', existing_manager['name'])
        role = data.get('role', existing_manager['role'])
        card_ui_id = data.get('cardUiId', existing_manager['card_ui_id'])
        
        # Check if the new card_ui_id is already assigned to another manager
        if card_ui_id != existing_manager['card_ui_id']:
            cursor.execute("""
                SELECT COUNT(*) FROM managers 
                WHERE card_ui_id = %s AND id != %s
            """, (card_ui_id, existing_manager['id']))
            
            if cursor.fetchone()['count'] > 0:
                cursor.close()
                conn.close()
                return jsonify({
                    'error': f"Card {card_ui_id} is already assigned to another manager"
                }), 409  # Conflict
        
        # Update the manager
        cursor.execute("""
            UPDATE managers 
            SET name = %s, role = %s, card_ui_id = %s
            WHERE manager_id = %s
        """, (name, role, card_ui_id, manager_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': "Manager updated successfully",
            'manager_id': manager_id
        })
        
    except Exception as e:
        print(f"Error updating manager: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error updating manager: {str(e)}"
        }), 500





@app.route('/api/managers', methods=['GET'])
def get_managers():
    """API endpoint for retrieving all managers"""
    try:
        # Get database connection
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database",
                'managers': []
            }), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if managers table exists, create if not
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS managers (
                manager_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'manager',
                card_ui_id VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        conn.commit()
        
        # Get all managers
        cursor.execute("""
            SELECT manager_id, name, role, card_ui_id, created_at
            FROM managers
            ORDER BY created_at DESC
        """)
        
        managers = cursor.fetchall()
        
        # Format for response
        result = []
        for manager in managers:
            result.append({
                'id': manager['manager_id'],  # Use manager_id as the id
                'managerId': manager['manager_id'],
                'name': manager['name'],
                'role': manager['role'],
                'cardUiId': manager['card_ui_id'],
                'createdAt': manager['created_at'].isoformat() if manager['created_at'] else None
            })
            
        cursor.close()
        conn.close()
        
        return jsonify({
            'managers': result
        })
        
    except Exception as e:
        print(f"Error getting managers: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error fetching managers: {str(e)}",
            'managers': []
        }), 500



@app.route('/api/managers/<manager_id>', methods=['DELETE'])
def delete_manager(manager_id):
    """API endpoint for deleting a manager"""
    try:
        # Get database connection
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': "Unable to connect to database"
            }), 500
            
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Delete the manager
        cursor.execute("DELETE FROM managers WHERE manager_id = %s", (manager_id,))
        
        # Check if a row was actually deleted
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return jsonify({
                'error': f"No manager found with ID {manager_id}"
            }), 404
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': f"Manager {manager_id} deleted successfully"
        })
        
    except Exception as e:
        print(f"Error deleting manager: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f"Error deleting manager: {str(e)}"
        }), 500




@app.route('/api/managers', methods=['OPTIONS'])
def options_managers():
    response = app.make_default_options_response()
    return response


@app.route('/api/managers/<manager_id>', methods=['OPTIONS'])
def options_manager_detail(manager_id):
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Methods'] = 'GET, PUT, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


@app.route('/api/assign_card', methods=['POST', 'OPTIONS'])
def assign_card():
    """API endpoint for assigning a card to a product"""
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        return response
        
    try:
        data = request.json
        if not data:
            return jsonify({'error': "Missing request data"}), 400
            
        product_id = data.get('product_id')
        uid = data.get('uid')
        package_type = data.get('package_type', 'General')
        
        if not product_id or not uid:
            return jsonify({'error': "Product ID and UID are required"}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': "Unable to connect to database"}), 500
            
        # Log incoming data for debugging
        print(f"Assigning card - Product ID: {product_id}, UID: {uid}, Package: {package_type}")
        
        cursor = conn.cursor()
        
        # Current timestamp for database
        current_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        created_at = datetime.now()
        
        # TRANSACTION: Wrap all DB operations in a transaction
        cursor.execute("BEGIN")
        try:

            # 1. Insert into access_requests (remove ON CONFLICT)
            cursor.execute("""
                INSERT INTO access_requests (uid, product_id, access_status, active, timestamp, created_at)
                VALUES (%s, %s, 'Assigned', TRUE, %s, %s)
            """, (uid, product_id, current_time_str, created_at))

            # 2. Insert into card_packages (remove ON CONFLICT)
            cursor.execute("""
                INSERT INTO card_packages (uid, product_id, package_type)
                VALUES (%s, %s, %s)
            """, (uid, product_id, package_type))
            
            # Print debug info
            cursor.execute("SELECT * FROM card_packages WHERE uid = %s AND product_id = %s", (uid, product_id))
            pkg_result = cursor.fetchone()
            print(f"Card package after update: {pkg_result}")
            
            cursor.execute("SELECT * FROM access_requests WHERE uid = %s AND product_id = %s", (uid, product_id))
            access_result = cursor.fetchone()
            print(f"Access request after update: {access_result}")
            
            # Commit the transaction
            cursor.execute("COMMIT")
            
        except Exception as e:
            cursor.execute("ROLLBACK")
            print(f"Transaction error: {str(e)}")
            raise e
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f"Card {uid} successfully assigned to product {product_id} with {package_type} package",
            'refresh_needed': True
        })
        
    except Exception as e:
        print(f"Error assigning card: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f"Error assigning card: {str(e)}"}), 500




if __name__ == '__main__':


    print("Starting Flask application...")
    # Start MQTT thread
    mqtt_thread_instance = threading.Thread(target=mqtt_thread)
    mqtt_thread_instance.daemon = True
    mqtt_thread_instance.start()
    print("MQTT client thread started")
    app.config['DEBUG'] = False
    app.run(debug=False, host='0.0.0.0', port=5000)
