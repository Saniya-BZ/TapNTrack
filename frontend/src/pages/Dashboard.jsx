import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Doughnut , Bar} from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser,
  faDoorOpen, 
  faArrowRight,
  faSpinner,
  faExclamationTriangle,
  faCalendarCheck,
  faChartPie,
  faUserCircle,
  faTable,
  faUserFriends,
  faStar,
  faCreditCard,
  faCalendarAlt,
  faCalendar,
  faComments,
  faAngleRight,
  faBell,
  faEnvelope,
  faUserCheck
} from '@fortawesome/free-solid-svg-icons';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';




import { Card, Row, Col, Container, Table, Badge, Button } from 'react-bootstrap';

// Register Chart.js components
Chart.register(...registerables);

// ZenV brand colors
const ZENV_COLORS = {
  primary: '#2A6EBB',
  teal: '#33B3A6',
  green: '#B1D007',
  purple: '#9760B1',
  orange: '#FFD000',
  lightGray: '#f8f9fa',
  mediumGray: '#6c757d',
  darkGray: '#343a40',
  purpleColor: '#A2248F',
  
  // Add additional theme colors
  lightGreen: 'rgba(177, 208, 7, 0.1)',
  lightBlue: 'rgba(42, 110, 187, 0.1)',
  lightTeal: 'rgba(51, 179, 166, 0.1)',
  darkTeal: 'rgba(23, 178, 163, 0.1)',
};




const ZENV_FONTS = {
  heading: "'Lato', sans-serif",
  body: "'Lato', sans-serif"
};

const DISPLAY_LIMIT = 3;

const Dashboard = () => {
  // State variables and hooks
  const [dashboardData, setDashboardData] = useState({
    total_entries: 0,
    today_entries: 0,
    unique_rooms: 0,
    unique_users: 0,
    granted_count: 0,
    denied_count: 0,
    daily_labels: [],
    daily_counts: [],
    daily_entries: [],
    recent_entries: []
  });

  const [containerWidth, setContainerWidth] = useState(window.innerWidth < 992 ? window.innerWidth - 60 : window.innerWidth - 380);
  const layout = [
  { i: 'today_checkins', x: 0, y: 0, w: 1, h: 1, static: false },
  { i: 'room_access', x: 1, y: 0, w: 1, h: 1, static: false },
  { i: 'guest_registration', x: 2, y: 0, w: 1, h: 1, static: false },
  { i: 'rfid_entries', x: 3, y: 0, w: 1, h: 1, static: false },
  { i: 'most_accessed_rooms', x: 0, y: 1, w: 2, h: 2 },
  { i: 'recent_guest_registrations', x: 2, y: 1, w: 2, h: 2 },
  { i: 'helpdesk_messages', x: 0, y: 3, w: 2, h: 2 },
  { i: 'recent_activities', x: 2, y: 3, w: 1, h: 2 },
  { i: 'rfid_assistant', x: 3, y: 3, w: 1, h: 2 }
];


const [visibleCards, setVisibleCards] = useState({
  today_checkins: true,
  room_access: true,
  guest_registration: true,
  rfid_entries: true,
  guest_distribution: true,
  frequent_visitors: true,
  daily_checkins: true,
  access_distribution: true,
  recent_rfid_entries: true,
  most_accessed_rooms: true,
  recent_guest_registrations: true
});


  
  // Add this state at the top of your Dashboard component:
  const [helpdeskMessages, setHelpdeskMessages] = useState([]);
  const [loadingHelpdeskMessages, setLoadingHelpdeskMessages] = useState(true);
  const [timeRange, setTimeRange] = useState('1m'); // Default to 1 month

  const [roomMapping, setRoomMapping] = useState({});

  const [guestDistribution, setGuestDistribution] = useState({
    newGuests: 0,
    returningGuests: 0,
    frequentGuests: 0,
    total: 0
  });
  const [loadingGuestDistribution, setLoadingGuestDistribution] = useState(true);

  // Recent entries from RFID entries page
  const [recentEntries, setRecentEntries] = useState([]);
  
  // Room frequency data
  const [roomStats, setRoomStats] = useState([]);
  const [totalRooms, setTotalRooms] = useState(0);
  
  // Guest registration data
  const [guests, setGuests] = useState([]);
  const [availableRooms, setAvailableRooms] = useState(0);
  
  // Recent activities for the right side column
  const [recentActivities, setRecentActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [rightPanelVisible, setRightPanelVisible] = useState(false);
  
  // Chart container refs for responsive sizing
  const doughnutChartRef = useRef(null);
  const dailyChartRef = useRef(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  // Handle window resize for responsive charts
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  


  // Add handleSearchSubmit function
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // Implement your search logic here
    alert(`Searching for: ${searchQuery}`);
  };
  
  // Add handleLogout function
  const handleLogout = () => {
    // Logout logic
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userEmail');
    window.location.href = '/login';
  };





const fetchRoomMapping = async (token) => {
  try {
    const response = await axios.get('http://localhost:5000/api/manage_tables', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Room mapping API response:", response.data);
    
    if (response.data) {
      // Check what's in the response and adjust accordingly
      const tablesData = response.data.products || response.data;
      
      // Create a mapping of product_id to room_no/room_id
      const mapping = {};
      
      console.log('Creating mapping from:', tablesData);
      
      // Log the first item to see its structure
      if (tablesData.length > 0) {
        console.log('Sample item structure:', tablesData[0]);
      }
      
      tablesData.forEach(item => {
        // Handle multiple possible property names
        const productId = item.product_id || item.id;
        const roomId = item.room_no || item.room_id || item.room;
        
        console.log(`Mapping product ${productId} to room ${roomId}`);
        
        // Convert to string to ensure comparison works
        mapping[productId.toString()] = roomId;
      });
      
      console.log("Final room mapping:", mapping);
      setRoomMapping(mapping);
      return mapping;
    }
  } catch (err) {
    console.error("Error fetching room mapping:", err);
    return {};
  }
};

useEffect(() => {
  const handleResize = () => {
    setWindowWidth(window.innerWidth);
    setContainerWidth(window.innerWidth < 992 ? window.innerWidth - 60 : window.innerWidth - 380);
  };
  
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// Add this component inside your Dashboard component, before the return statement

const GuestFrequencyCard = () => {
  const [guestFrequency, setGuestFrequency] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchGuestFrequency = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem('token');
        
        if (!token) {
          console.error("No auth token available");
          setLoading(false);
          return;
        }
        
        // Fetch all guests data
        const [activeGuestsResponse, pastGuestsResponse] = await Promise.all([
          axios.get('http://localhost:5000/api/guests', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }),
          axios.get('http://localhost:5000/api/guests/past', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        ]);
        
        const allGuests = [
          ...(activeGuestsResponse.data.guests || []),
          ...(pastGuestsResponse.data.past_guests || [])
        ];
        
        // Count visits by ID number
        const idCounts = {};
        allGuests.forEach(guest => {
          if (guest.idNumber) {
            const idNum = guest.idNumber;
            if (!idCounts[idNum]) {
              idCounts[idNum] = {
                count: 1,
                name: guest.name,
                idNumber: idNum,
                lastVisit: new Date(guest.checkinTime || guest.checkin_time)
              };
            } else {
              idCounts[idNum].count += 1;
              const visitDate = new Date(guest.checkinTime || guest.checkin_time);
              if (visitDate > new Date(idCounts[idNum].lastVisit)) {
                idCounts[idNum].lastVisit = visitDate;
              }
            }
          }
        });
        
        // Convert to array and sort by visit count (most frequent first)
        const frequencyArray = Object.values(idCounts).sort((a, b) => b.count - a.count);
        setGuestFrequency(frequencyArray);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching guest frequency data:', err);
        setLoading(false);
      }
    };
    
    fetchGuestFrequency();
  }, []);
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  if (loading) {
    return (
      <div className="text-center py-3">
        <FontAwesomeIcon icon={faSpinner} spin className="mb-2" style={{ color: ZENV_COLORS.primary }} />
        <p className="small text-muted mb-0">Loading guest data...</p>
      </div>
    );
  }


  
  return (
    <div>
      <h6 className="fw-bold mb-3">Guest Visit Frequency</h6>
      {guestFrequency.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-hover border-0">
            <thead>
              <tr>
                <th>Guest Name</th>
                <th>ID Number</th>
                <th>Visits</th>
                <th>Status</th>
                <th>Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {guestFrequency.slice(0, DISPLAY_LIMIT).map((guest, index) => (
                <tr key={index}>
                  <td className="fw-medium">{guest.name}</td>
                  <td>{guest.idNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3')}</td>
                  <td>
                    <span className="badge rounded-pill" 
                      style={{
                        backgroundColor: guest.count > 3 ? ZENV_COLORS.purple : 
                                        (guest.count > 1 ? ZENV_COLORS.teal : ZENV_COLORS.green),
                        color: 'white',
                        padding: '4px 8px'
                      }}
                    >
                      {guest.count}
                    </span>
                  </td>
                  <td>
                    {guest.count === 1 ? (
                      <Badge pill className="text-wrap px-3 py-2" style={{ backgroundColor: ZENV_COLORS.green, color: 'white' }}>
                        New
                      </Badge>
                    ) : guest.count > 3 ? (
                      <Badge pill className="text-wrap px-3 py-2" style={{ backgroundColor: ZENV_COLORS.purple, color: 'white' }}>
                        <FontAwesomeIcon icon={faStar} className="me-1" /> Frequent
                      </Badge>
                    ) : (
                      <Badge pill className="text-wrap px-3 py-2" style={{ backgroundColor: ZENV_COLORS.teal, color: 'white' }}>
                        Returning
                      </Badge>
                    )}
                  </td>
                  <td>{formatDate(guest.lastVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="small text-muted mb-0">No guest data available</p>
        </div>
      )}
    </div>
  );
};




// Update the EnhancedGuestDistributionChart component

const EnhancedGuestDistributionChart = () => {
  const [distributionData, setDistributionData] = useState({
    newGuests: 0,
    returningGuests: 0,
    frequentGuests: 0
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchDistribution = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem('token');
        
        if (!token) {
          console.error("No auth token available");
          setLoading(false);
          return;
        }
        
        // Fetch all guests data
        const [activeGuestsResponse, pastGuestsResponse] = await Promise.all([
          axios.get('http://localhost:5000/api/guests', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          axios.get('http://localhost:5000/api/guests/past', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        const allGuests = [
          ...(activeGuestsResponse.data.guests || []),
          ...(pastGuestsResponse.data.past_guests || [])
        ];
        
        // Count visits by ID number
        const idCounts = {};
        allGuests.forEach(guest => {
          if (guest.idNumber) {
            idCounts[guest.idNumber] = (idCounts[guest.idNumber] || 0) + 1;
          }
        });
        
        // Calculate distribution
        let newCount = 0;
        let returningCount = 0; 
        let frequentCount = 0;
        
        Object.values(idCounts).forEach(count => {
          if (count === 1) {
            newCount++;
          } else if (count <= 3) {
            returningCount++;
          } else {
            frequentCount++;
          }
        });
        
        setDistributionData({
          newGuests: newCount,
          returningGuests: returningCount,
          frequentGuests: frequentCount
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching guest distribution:', err);
        setLoading(false);
      }
    };
    
    fetchDistribution();
  }, []);
  
  // Bar chart configuration
  const chartData = {
    labels: ['New Guests', 'Returning Guests', 'Frequent Guests'],
    datasets: [{
      data: [
        distributionData.newGuests, 
        distributionData.returningGuests, 
        distributionData.frequentGuests
      ],
      backgroundColor: [
        ZENV_COLORS.green,
        ZENV_COLORS.teal,
        ZENV_COLORS.purple
      ],
      borderWidth: 1,
      borderRadius: 6,
      borderColor: 'rgba(255, 255, 255, 0.8)',
      hoverBackgroundColor: [
        `${ZENV_COLORS.green}CC`,
        `${ZENV_COLORS.teal}CC`,
        `${ZENV_COLORS.purple}CC`
      ],
      maxBarThickness: 60
    }]
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y', // Horizontal bar chart
    scales: {
      y: {
        grid: {
          display: false
        }
      },
      x: {
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          precision: 0
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#333',
        bodyColor: '#555',
        titleFont: { weight: 'bold' },
        bodyFont: { size: 13 },
        padding: 12,
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            const value = context.raw;
            const total = distributionData.newGuests + 
                          distributionData.returningGuests + 
                          distributionData.frequentGuests;
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `Count: ${value} guests (${percentage}%)`;
          }
        }
      }
    }
  };
  
  if (loading) {
    return (
      <div className="text-center py-4">
        <FontAwesomeIcon icon={faSpinner} spin className="mb-2" style={{ color: ZENV_COLORS.primary }} />
        <p className="small text-muted mb-0">Loading distribution data...</p>
      </div>
    );
  }
  
  const total = distributionData.newGuests + 
                distributionData.returningGuests + 
                distributionData.frequentGuests;
  
  return (
    <div>
      <div style={{ height: '200px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
      
      <div className="mt-3">
        <h6 className="fw-bold">Guest Distribution Details</h6>
        <div className="d-flex justify-content-between mb-1">
          <span className="small">
            <span className="rounded-circle d-inline-block me-1" style={{ width: '8px', height: '8px', backgroundColor: ZENV_COLORS.green }}></span> 
            New (1 visit)
          </span>
          <span className="small fw-medium">{distributionData.newGuests}</span>
        </div>
        <div className="d-flex justify-content-between mb-1">
          <span className="small">
            <span className="rounded-circle d-inline-block me-1" style={{ width: '8px', height: '8px', backgroundColor: ZENV_COLORS.teal }}></span> 
            Returning (2-3 visits)
          </span>
          <span className="small fw-medium">{distributionData.returningGuests}</span>
        </div>
        <div className="d-flex justify-content-between mb-1">
          <span className="small">
            <span className="rounded-circle d-inline-block me-1" style={{ width: '8px', height: '8px', backgroundColor: ZENV_COLORS.purple }}></span> 
            Frequent (4+ visits)
          </span>
          <span className="small fw-medium">{distributionData.frequentGuests}</span>
        </div>
      </div>
    </div>
  );
};

// Replace your existing fetchGuestDistribution function with this enhanced version:

const fetchGuestDistribution = async () => {
  try {
    setLoadingGuestDistribution(true);
    
    const token = sessionStorage.getItem('token');
    
    if (!token) {
      console.error("No auth token available");
      setLoadingGuestDistribution(false);
      return;
    }
    
    // Fetch all guests including past guests
    const [activeGuestsResponse, pastGuestsResponse] = await Promise.all([
      axios.get('http://localhost:5000/api/guests', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      axios.get('http://localhost:5000/api/guests/past', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);
    
    // Combine active and past guests
    const allGuests = [
      ...(activeGuestsResponse.data.guests || []),
      ...(pastGuestsResponse.data.past_guests || [])
    ];
    
    // Count visits by ID number and collect additional info
    const guestDetails = {};
    allGuests.forEach(guest => {
      if (guest.idNumber) {
        const idNum = guest.idNumber;
        
        if (!guestDetails[idNum]) {
          guestDetails[idNum] = {
            count: 1,
            name: guest.name,
            lastVisit: new Date(guest.checkinTime || guest.checkin_time),
            visits: [{
              roomId: guest.roomId,
              checkIn: new Date(guest.checkinTime || guest.checkin_time),
              checkOut: new Date(guest.checkoutTime || guest.checkout_time)
            }]
          };
        } else {
          guestDetails[idNum].count += 1;
          
          // Track this visit
          guestDetails[idNum].visits.push({
            roomId: guest.roomId,
            checkIn: new Date(guest.checkinTime || guest.checkin_time),
            checkOut: new Date(guest.checkoutTime || guest.checkout_time)
          });
          
          // Update last visit date if this one is more recent
          const visitDate = new Date(guest.checkinTime || guest.checkin_time);
          if (visitDate > guestDetails[idNum].lastVisit) {
            guestDetails[idNum].lastVisit = visitDate;
          }
        }
      }
    });
    
    // Calculate distribution
    let newGuests = 0;
    let returningGuests = 0;
    let frequentGuests = 0;
    
    Object.values(guestDetails).forEach(guest => {
      if (guest.count === 1) {
        newGuests++;
      } else if (guest.count <= 3) {
        returningGuests++;
      } else {
        frequentGuests++;
      }
    });
    
    // Store full guest details for potential future use
    sessionStorage.setItem('guestVisitDetails', JSON.stringify(guestDetails));
    
    setGuestDistribution({
      newGuests: newGuests,
      returningGuests: returningGuests,
      frequentGuests: frequentGuests,
      total: newGuests + returningGuests + frequentGuests
    });
    
  } catch (err) {
    console.error('Error fetching guest distribution:', err);
  } finally {
    setLoadingGuestDistribution(false);
  }
};




  // Fetch dashboard data on component mount
  useEffect(() => {

    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // Get token from session storage for authentication
        const token = sessionStorage.getItem('token');
        
        if (!token) {
          console.error("No auth token available");
          setError("Authentication error. Please log in again.");
          setLoading(false);
          return;
        }

        await fetchRoomMapping(token);
  
        // Create axios instance with auth header
        const api = axios.create({
          baseURL: 'http://localhost:5000/api',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Fetch main dashboard data
        const dashboardResponse = await api.get('/dashboard');
        setDashboardData(dashboardResponse.data);
        
        // Process daily trend data from API, ensuring it includes up to today
        prepareDailyTrendData(dashboardResponse.data);
        
        // Fetch recent RFID entries
        const entriesResponse = await api.get('/rfid_entries', { params: { page: 1 } });
        setRecentEntries(entriesResponse.data.entries?.slice(0, 5) || []);

        try {
          const helpdeskResponse = await axios.get('http://localhost:5000/api/help-messages', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: { limit: 3 }
          });
          console.log('Helpdesk API response:', helpdeskResponse);
          if (helpdeskResponse && helpdeskResponse.data) {
            setHelpdeskMessages(helpdeskResponse.data.messages?.slice(0, 3) || []);
          }
          setLoadingHelpdeskMessages(false);
        } catch (err) {
          console.error('Error fetching helpdesk messages:', err);
          setLoadingHelpdeskMessages(false);
        }
        // Fetch activities for right column
        try {
          const activitiesResponse = await api.get('/rfid_entries', { 
            params: { 
              limit: 5,
              sort: 'desc' 
            }
          });
          setRecentActivities(activitiesResponse.data.entries?.slice(0, 5) || []);
          setLoadingActivities(false);
        } catch (err) {
          console.error('Error fetching recent activities:', err);
          setLoadingActivities(false);
        }
        
        // Fetch room frequency data
        try {
          const roomResponse = await api.get('/room_frequency');
          setRoomStats(roomResponse.data.room_stats?.slice(0, 5) || []);
          setTotalRooms(roomResponse.data.total_rooms || 0);
        } catch (err) {
          console.log('Room frequency data not available');
        }

        // Fetch guest registration data
        try {
          const guestResponse = await api.get('/guests');
          
          console.log('Guest response data:', guestResponse.data);
          
          if (guestResponse.data && Array.isArray(guestResponse.data.guests)) {
            // Sort guests by check-in time (most recent first) and take only 5
            const sortedGuests = [...guestResponse.data.guests].sort((a, b) => {
              const dateA = new Date(a.checkinTime || a.checkin_time || 0);
              const dateB = new Date(b.checkinTime || b.checkin_time || 0);
              return dateB - dateA; // Sort in descending order (newest first)
            }).slice(0, 5);
            
            setGuests(sortedGuests);
            console.log('Recent guest count:', sortedGuests.length);
            
            // Count available rooms (calculate based on total rooms minus occupied rooms)
            const occupiedRooms = new Set(guestResponse.data.guests.map(guest => guest.roomId || guest.room_id));
            setAvailableRooms(totalRooms - occupiedRooms.size);
          } else {
            console.error('Invalid guest data format:', guestResponse.data);
            setGuests([]);
          }
        } catch (err) {
          console.error('Error fetching guest data:', err);
        }
        fetchGuestDistribution();
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, [totalRooms]);
  


  const prepareDailyTrendData = (data, range = timeRange) => {
  // Calculate date range based on selected option
  const today = new Date();
  let startDate = new Date();
  
  switch(range) {
    case '3m':
      startDate.setDate(today.getDate() - 90); // 3 months (approx. 90 days)
      break;
    case '6m':
      startDate.setDate(today.getDate() - 180); // 6 months (approx. 180 days)
      break;
    case '1y':
      startDate.setDate(today.getDate() - 365); // 1 year (365 days)
      break;
    case '1m':
    default:
      startDate.setDate(today.getDate() - 30); // 1 month (30 days)
      break;
  }
  
  const allDates = [];
  const allCounts = [];
  
  // Fill in all dates for the selected range
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    // Format date as yyyy-mm-dd for comparison with API data
    const dateStr = d.toISOString().slice(0, 10);
    allDates.push(dateStr);
    
    // Find this date in the API data if it exists
    const idx = data.daily_labels?.indexOf(dateStr);
    if (idx !== -1 && data.daily_counts) {
      allCounts.push(data.daily_counts[idx]);
    } else {
      allCounts.push(0); // No entries for this date
    }
  }
  
  // Format dates for display based on range
  const displayLabels = allDates.map(dateStr => {
    const date = new Date(dateStr);
    // For longer ranges, only show month/day or month depending on range
    if (range === '1y') {
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    } else if (range === '6m') {
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  });
  
  // Update chart data
  setDailyTrendData({
    labels: displayLabels,
    datasets: [{
      ...dailyTrendData.datasets[0],
      data: allCounts,
      // Adjust bar thickness based on range and screen size
      barThickness: range === '1y' ? (windowWidth < 768 ? 3 : 5) : 
                   range === '6m' ? (windowWidth < 768 ? 4 : 8) :
                   range === '3m' ? (windowWidth < 768 ? 6 : 12) :
                   (windowWidth < 768 ? 10 : 16)
    }]
  });
};

const handleTimeRangeChange = (e) => {
  const newRange = e.target.value;
  setTimeRange(newRange);
  prepareDailyTrendData(dashboardData, newRange);
};

  


const [dailyTrendData, setDailyTrendData] = useState({
  labels: [],
  datasets: [{
    label: 'Daily Check-ins',
    data: [],
    backgroundColor: (context) => {
      const ctx = context.chart.ctx;
      const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
      gradient.addColorStop(0, 'rgba(34, 198, 212, 0.8)');  
      gradient.addColorStop(1, 'rgba(177, 208, 7, 0.6)');   
      return gradient;
    },
    borderColor: '#22C6D4',
    borderWidth: 1,
    borderRadius: 4,
    hoverBackgroundColor: ZENV_COLORS.primary,
    barThickness: windowWidth < 768 ? 10 : 16,
    maxBarThickness: 20
  }]
});

  
  // Status distribution chart data
  const [statusChartData, setStatusChartData] = useState({
    labels: ['Granted', 'Denied'],
    datasets: [{
      data: [0, 0],
      backgroundColor: [ZENV_COLORS.green, ZENV_COLORS.orange],
      hoverBackgroundColor: [ZENV_COLORS.green, ZENV_COLORS.orange],
      borderWidth: 0,
      borderRadius: 5
    }]
  });
  
  // Update status chart data when dashboard data changes
  useEffect(() => {
    if (dashboardData.granted_count !== undefined && dashboardData.denied_count !== undefined) {
      setStatusChartData({
        ...statusChartData,
        datasets: [{
          ...statusChartData.datasets[0],
          data: [dashboardData.granted_count || 0, dashboardData.denied_count || 0]
        }]
      });
    }
  }, [dashboardData]);

  useEffect(() => {
  if (dashboardData && dashboardData.daily_labels) {
    prepareDailyTrendData(dashboardData, timeRange);
  }
}, [dashboardData, timeRange]);

  



// Update the daily trend options for the Bar chart
const dailyTrendOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: "rgba(0, 0, 0, 0.05)",
        drawBorder: false,
        display:false
      },
      ticks: {
        font: {
          family: ZENV_FONTS.body,
          size: windowWidth < 768 ? 10 : 12
        },
        padding: 10
      }
    },
    x: {
      grid: {
        display: false
      },
      ticks: {
        font: {
          family: ZENV_FONTS.body,
          size: windowWidth < 768 ? 10 : 12
        },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: timeRange === '1y' ? (windowWidth < 768 ? 6 : 12) :
                    timeRange === '6m' ? (windowWidth < 768 ? 8 : 16) :
                    timeRange === '3m' ? (windowWidth < 768 ? 10 : 20) :
                    (windowWidth < 768 ? 12 : 24)
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    title:{
      display: true,
      font:{
        family: ZENV_FONTS.heading,
        size: 16
      }
    },
    tooltip: {
      titleFont:{
        family: ZENV_FONTS.heading
      },
      bodyFont:{
        family: ZENV_FONTS.body
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#000',
      bodyColor: '#666',
      borderWidth: 1,
      padding: 12,
      displayColors: false,
      callbacks: {
        title: function(context) {
          return context[0].label;
        },
        label: function(context) {
          return `Total Check-ins: ${context.raw}`;
        },
        afterLabel: function(context) {
          const value = context.raw;
          // Calculate percentage of the max value
          const maxValue = Math.max(...context.dataset.data);
          const percentage = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
          return `${percentage}% of peak day`;
        }
      }
    }
  },
  interaction: {
    mode: 'index',
    intersect: false
  },
  animation: {
    duration: 1000
  }
};

  
  // Status chart options
  const statusChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12
          },
          color: ZENV_COLORS.darkGray
        }
      },
      tooltip: {
        titleFont: {
          size: windowWidth < 768 ? 12 : 14
        },
        bodyFont: {
          size: windowWidth < 768 ? 11 : 13
        },
        callbacks: {
          label: function(context) {
            const total = dashboardData.granted_count + dashboardData.denied_count;
            const value = context.raw;
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${context.label}: ${value} (${percentage}%)`;
          }
        },
        backgroundColor: 'rgba(42, 110, 187, 0.8)',
        padding: 8,
        boxPadding: 6,
        cornerRadius: 6
      }
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (err) {
      return dateString;
    }
  };
  

  const formatTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (isNaN(diffInSeconds)) return 'Invalid date';
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  return `${days}d ago`;
};
  
  // Get chart height based on screen size and chart type
  const getChartHeight = (chartType) => {
    if (windowWidth < 576) {
      return chartType === 'doughnut' ? 220 : 250;
    } else if (windowWidth < 992) {
      return chartType === 'doughnut' ? 250 : 300;
    } else {
      return chartType === 'doughnut' ? 300 : 350;
    }
  };





// Now update the HelpdeskMessages component to include ticket status summary
const HelpdeskMessages = () => {
  // Render loading state
  if (loadingHelpdeskMessages) {
    return (
      <div className="text-center py-4">
        <FontAwesomeIcon icon={faSpinner} spin className="mb-2" style={{ color: ZENV_COLORS.primary }} />
        <p className="small text-muted mb-0">Loading helpdesk messages...</p>
      </div>
    );
  }


  return (
    <>
      
      {/* Existing messages list */}
      {helpdeskMessages.length === 0 ? (
        <div className="text-center py-4">
          <div 
            className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-2"
            style={{ width: "40px", height: "40px" }}
          >
            <FontAwesomeIcon icon={faEnvelope} size="1x" style={{ color: ZENV_COLORS.mediumGray }} />
          </div>
          <p className="small text-muted mb-0">No new messages</p>
        </div>
      ) : (
        <div>
          {helpdeskMessages.map((message, index) => {
            const priorityColor = message.priority === 'high' ? '#dc3545' : 
                                message.priority === 'medium' ? ZENV_COLORS.orange : 
                                ZENV_COLORS.teal;
            
            return (
              <div 
                key={index}
                className="d-flex align-items-start p-3 border-bottom"
                style={{ borderBottom: index < helpdeskMessages.length - 1 ? '1px solid #eee' : 'none' }}
              >
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                  style={{ 
                    backgroundColor: `rgba(${parseInt(priorityColor.slice(1, 3), 16)}, ${parseInt(priorityColor.slice(3, 5), 16)}, ${parseInt(priorityColor.slice(5, 7), 16)}, 0.1)`,
                    color: priorityColor,
                    width: '36px',
                    height: '36px'
                  }}
                >
                  <FontAwesomeIcon icon={faBell} />
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-medium" style={{ fontSize: '0.85rem' }}>
                      {message.subject}
                    </div>
                    <div className="text-muted ms-2" style={{ fontSize: '0.75rem' }}>
                      {formatTimeAgo(new Date(message.timestamp))}
                    </div>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    From: {message.sender}
                  </div>
                  <Link 
                    to="/helpdesk" 
                    className="mt-1 d-block small"
                    style={{ color: ZENV_COLORS.primary, fontSize: '0.75rem', textDecoration: 'none' }}
                  >
                    Reply to message
                  </Link>
                </div>
              </div>
            );
          })}
          <div className="text-center p-2">
            <Link 
              to="/helpdesk" 
              className="text-decoration-none small"
              style={{ color: ZENV_COLORS.primary, fontSize: '0.8rem' }}
            >
              See all messages
            </Link>
          </div>
        </div>
      )}
    </>
  );
};




  // Loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="fa-2x mb-3" style={{ color: ZENV_COLORS.primary }} />
          <h5 className="fw-normal text-muted">Loading dashboard data...</h5>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="alert alert-danger rounded-3 shadow-sm d-flex align-items-center m-4">
        <FontAwesomeIcon icon={faExclamationTriangle} className="me-3 fa-lg" />
        <div>{error}</div>
      </div>
    );
  }


  return (


      <div className="d-flex dashboard-wrapper">
        <div className="dashboard-main">
          <Container fluid className="p-4 bg-light">
          {/* Header Section */}

<Row className="mb-4 align-items-center">
  <Col md={6}>
    <h2 className="fs-4 fw-bold mb-0">Dashboard</h2>
    <p className="text-muted mb-0">Welcome to the RFID Access Management System</p>
  </Col>



</Row>







<GridLayout 
  className="layout mb-4" 
  layout={layout}
  cols={5}
  rowHeight={160}
  width={window.innerWidth < 992 ? window.innerWidth - 60 : window.innerWidth - 360}
  isDraggable={true}
  isResizable={false}
  margin={[16, 16]}
  useCSSTransforms={true}
  containerPadding={[16, 16]}
  draggableHandle='.drag-handle'
>


  

{/* Today's Check-ins - UPDATED */}
<div key="today_checkins">
  <div style={{ pointerEvents: 'auto', position: 'relative', zIndex: 2 }}>
    <Card className="shadow-sm border-0 rounded-4 h-100 stat-card checkin-card">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between mb-2 drag-handle">
          <div className="small text-muted">Today's Check-ins</div>
        </div>
        <h3 className="fs-4 fw-bold mb-0">{dashboardData.today_entries || 0}</h3>
        <div className="small text-muted mt-1">check-ins today</div>
      </Card.Body>
      <Card.Footer className="bg-transparent border-0 p-3 pt-0">
        <Link
          to="/checkin_trends"
          className="text-decoration-none small d-flex align-items-center view-details"
          style={{ pointerEvents: 'auto', zIndex: 10 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          View details <FontAwesomeIcon icon={faArrowRight} className="ms-2 small" />
        </Link>
      </Card.Footer>
    </Card>
  </div>
</div>

{/* Room Access - UPDATED */}
<div key="room_access">
  <div style={{ pointerEvents: 'auto', position: 'relative', zIndex: 2 }}>
    <Card className="shadow-sm border-0 rounded-4 h-100 stat-card room-card">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between mb-2 drag-handle">
          <div className="small text-muted">Room Access</div>
        </div>
        <h3 className="fs-4 fw-bold mb-0">{dashboardData.unique_rooms}</h3>
        <div className="small text-muted mt-1">unique rooms</div>
      </Card.Body>
      <Card.Footer className="bg-transparent border-0 p-3 pt-0">
        <Link
          to="/room_frequency"
          className="text-decoration-none small d-flex align-items-center view-details"
          style={{ pointerEvents: 'auto', zIndex: 10 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          View details <FontAwesomeIcon icon={faArrowRight} className="ms-2 small" />
        </Link>
      </Card.Footer>
    </Card>
  </div>
</div>

{/* Guest Registration - UPDATED */}
<div key="guest_registration">
  <div style={{ pointerEvents: 'auto', position: 'relative', zIndex: 2 }}>
    <Card className="shadow-sm border-0 rounded-4 h-100 stat-card guest-card">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between mb-2 drag-handle">
          <div className="small text-muted">Guest Registration</div>
        </div>
        <h3 className="fs-4 fw-bold mb-0">{guests.length || 0}</h3>
        <div className="small text-muted mt-1">active guests</div>
      </Card.Body>
      <Card.Footer className="bg-transparent border-0 p-3 pt-0">
        <Link
          to="/register_guest"
          className="text-decoration-none small d-flex align-items-center view-details"
          style={{ pointerEvents: 'auto', zIndex: 10 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          View details <FontAwesomeIcon icon={faArrowRight} className="ms-2 small" />
        </Link>
      </Card.Footer>
    </Card>
  </div>
</div>


{/* RFID Entries - UPDATED */}
<div key="rfid_entries">
  <div style={{ pointerEvents: 'auto', position: 'relative', zIndex: 2 }}>
    <Card className="shadow-sm border-0 rounded-4 h-100 stat-card rfid-card">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between mb-2 drag-handle">
          <div className="small text-muted">RFID Entries</div>
        </div>
        <h3 className="fs-4 fw-bold mb-0">{dashboardData.total_entries}</h3>
        <div className="small text-muted mt-1">total entries</div>
      </Card.Body>
      <Card.Footer className="bg-transparent border-0 p-3 pt-0">
        <Link
          to="/rfid_entries"
          className="text-decoration-none small d-flex align-items-center view-details"
          style={{ pointerEvents: 'auto', zIndex: 10 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          View details <FontAwesomeIcon icon={faArrowRight} className="ms-2 small" />
        </Link>
      </Card.Footer>
    </Card>
  </div>
</div>

</GridLayout>




<GridLayout
  className="layout"
  layout={[
    { i: 'guest_distribution', x: 0, y: 0, w: 2, h: 2 },
    { i: 'frequent_visitors', x: 2, y: 0, w: 2, h: 2 },
    { i: 'daily_checkins', x: 0, y: 2, w: 3, h: 2 },
    { i: 'access_distribution', x: 3, y: 2, w: 1, h: 2 },
    { i: 'recent_rfid_entries', x: 0, y: 4, w: 2, h: 3 },
    { i: 'most_accessed_rooms', x: 2, y: 4, w: 2, h: 3 },
    { i: 'recent_guest_registrations', x: 0, y: 7, w: 4, h: 3 },
  ]}
  cols={4}
  rowHeight={160}
  width={1200}
  isDraggable={true}
  isResizable={false}
  margin={[16, 16]}
  useCSSTransforms={true}
  draggableHandle='.drag-handle'
>
<div key="guest_distribution">
  {/* Guest Distribution Card */}
  <Card className="shadow-sm border-0 rounded-4 h-100 stat-card guest-distribution-card">
    <Card.Header className="bg-white py-3">
      <div className='d-flex justify-content-between align-items-center'>
        <h6 className="m-0 fw-bold drag-handle" style={{ color: ZENV_COLORS.primary }}> {/* Add drag-handle class here */}
          <FontAwesomeIcon icon={faUserCircle} className="me-2" /> Guest Distribution
        </h6>
      </div>
    </Card.Header>
    <Card.Body className="p-3">
      <EnhancedGuestDistributionChart />
    </Card.Body>
  </Card>
</div>

  <div key="frequent_visitors">
    <Card className="shadow-sm border-0 rounded-4 h-100">
      <Card.Header className="bg-white py-3">
         <div className="d-flex justify-content-between align-items-center">
         <h6 className="m-0 fw-bold drag-handle" style={{ color: ZENV_COLORS.primary }}> {/* Add drag-handle class */}
             <FontAwesomeIcon icon={faUserCheck} className="me-2" /> Frequent Visitors
           </h6>

         </div>
      </Card.Header>
      <Card.Body className="p-3">
        <GuestFrequencyCard />
      </Card.Body>
    </Card>
  </div>



  <div key="daily_checkins">
    <Card className="shadow-sm border-0 rounded-4 h-100">
      <Card.Header className="bg-white py-3">
          <div className="d-flex justify-content-between align-items-center">
  <h6 className="m-0 fw-bold drag-handle" style={{ color: ZENV_COLORS.primary }}> {/* Add drag-handle class */}
          <FontAwesomeIcon icon={faCalendar} className="me-2" /> Daily Check-in Trend
        </h6>
            <div className="d-flex align-items-center">
              <select 
                className="form-select form-select-sm me-2"
                value={timeRange}
                onChange={handleTimeRangeChange}
                style={{ 
                  borderRadius: '20px', 
                  fontSize: '0.8rem', 
                  padding: '0.25rem 0.5rem',
                  paddingRight: '1.75rem',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e9ecef',
                  width: 'auto',
                  minWidth: '100px'
                }}
              >
                <option value="1m">1 Month</option>
                <option value="3m">3 Months</option>
                <option value="6m">6 Months</option>
                <option value="1y">1 Year</option>
              </select>
              
              <Link 
                to="/checkin_trends" 
                className="text-decoration-none small" 
                style={{ color: ZENV_COLORS.primary }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                View All
              </Link>
            </div>
            </div>
      </Card.Header>
      <Card.Body className="p-3">
        <Bar data={dailyTrendData} options={dailyTrendOptions} />
      </Card.Body>
    </Card>
  </div>






  <div key="access_distribution">
    {/* Access Distribution */}
    <Card className="shadow-sm border-0 rounded-4 h-100">
      <Card.Header className="bg-white py-3">
  <h6 className="m-0 fw-bold drag-handle" style={{ color: ZENV_COLORS.primary }}> {/* Add drag-handle class */}
          <FontAwesomeIcon icon={faChartPie} className="me-2" /> Access Distribution
        </h6>
      </Card.Header> 
      <Card.Body className="p-3">
        <Doughnut data={statusChartData} options={statusChartOptions} />
      </Card.Body>
    </Card>
  </div>

  <div key="recent_rfid_entries">
    {/* Recent RFID Entries */}
    <Card className="border-0 shadow-sm rounded-4 h-100">
      <Card.Header className="bg-white py-3">
        {/* <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
          <FontAwesomeIcon icon={faTable} className="me-2" /> Recent RFID Entries
        </h6> */}
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                  <FontAwesomeIcon icon={faTable} className="me-2" />
                  Recent RFID Entries
                </h6>
                <Link 
                  to="/rfid_entries" 
                  className="text-decoration-none small" 
                  style={{ color: ZENV_COLORS.primary }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  View All
                </Link>
              </div>
      </Card.Header>
    <Card.Body className="p-0">
      <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
        <Table hover className="mb-0">
          <thead className="bg-light">
            <tr>
              <th className="ps-3">ID</th>
              <th>UID</th>
              <th>Room</th>
              <th>Status</th>
              <th className="pe-3">Timestamp</th>
            </tr>
          </thead>
<tbody>
  {recentEntries.length > 0 ? (
    recentEntries.map(entry => (
      <tr key={entry.id}>
        <td className="ps-3 fw-medium">{entry.id}</td>
        <td>{entry.uid}</td>
        <td>
          {(() => {
            // Convert to string if needed for comparison
            const productIdKey = entry.product_id?.toString();
            const room = roomMapping[productIdKey];
            
            if (room) {
              return (
                <Badge pill className="text-wrap px-3 py-2" style={{ backgroundColor: ZENV_COLORS.teal, color: 'white' }}>
                  {room}
                </Badge>
              );
            } else {
              return (
                <Badge pill className="text-wrap px-3 py-2 bg-secondary">
                  {productIdKey || 'N/A'}
                </Badge>
              );
            }
          })()}
        </td>
        <td>
          <Badge 
            pill 
            className="text-wrap px-3 py-2" 
            style={{ 
              backgroundColor: entry.access_status?.includes('Granted') ? ZENV_COLORS.green : ZENV_COLORS.orange,
              color: 'white' 
            }}
          >
            {entry.access_status || 'Unknown'}
          </Badge>
        </td>
        <td className="pe-3">{formatDate(entry.timestamp)}</td>
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan="5" className="text-center py-4">No recent entries found</td>
    </tr>
  )}
</tbody>

        </Table>
      </div>
    </Card.Body>
    </Card>



  </div>






  <div key="most_accessed_rooms">
    {/* Most Accessed Rooms */}
    <Card className="border-0 shadow-sm rounded-4 h-100">
      <Card.Header className="bg-white py-3">
                 <div className="d-flex justify-content-between align-items-center">
                    <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                      <FontAwesomeIcon icon={faDoorOpen} className="me-2" />
                      Most Accessed Rooms
                    </h6>
                    <Link to="/room_frequency" className="text-decoration-none small" style={{ color: ZENV_COLORS.primary }}>
                      View All
                    </Link>
                  </div>
      </Card.Header>

                  <Card.Body className="p-0">
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <Table hover className="mb-0">
                      <thead className="bg-light">
                        <tr>
                          <th className="ps-3">Room ID</th>
                          <th>Type</th>
                          <th>Total Access</th>
                          <th className="pe-3">Most Active Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomStats.length > 0 ? (
                          roomStats.map((room, index) => (
                            <tr key={index}>
                              
                              <td className="ps-3 fw-medium">{room.room_id}</td>
                              
                             <td>
                                  {room.room_type === 'VIP' ? (
                                    <Badge pill className="vip-badge px-3 py-2">
                                      <FontAwesomeIcon icon={faStar} className="me-1" /> VIP
                                    </Badge>
                                  ) : (
                                    <Badge pill className="regular-badge px-3 py-2">
                                      Regular
                                    </Badge>
                                  )}
                                </td>

                              <td>{room.total_access}</td>
                              <td className="pe-3">{room.most_active_day}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="text-center py-4">No room data available</td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>

    </Card>
  </div>

  <div key="recent_guest_registrations">
    {/* Guest Registrations */}
    <Card className="border-0 shadow-sm rounded-4 h-100">
      <Card.Header className="bg-white py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                      <FontAwesomeIcon icon={faUserFriends} className="me-2" />
                      Recent Guest Registrations <span className="small text-muted">(Latest 5)</span>
                    </h6>
                    <Link to="/register_guest" className="text-decoration-none small" style={{ color: ZENV_COLORS.primary }}>
                      View All Guests
                    </Link>
                  </div>
      </Card.Header>
               <Card.Body className="p-0">
                  <div className="table-responsive">
                    <Table hover className="mb-0">
                      <thead className="bg-light">
                        <tr>
                          <th className="ps-3">Guest ID</th>
                          <th>Name</th>
                          <th>Room ID</th>
                          <th>Card ID</th>
                          <th className="pe-3">Check-in / Check-out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {guests.length > 0 ? (
                          guests.map(guest => (
                            <tr key={guest.id || guest.guest_id}>
                              <td className="ps-3 fw-medium">{guest.guestId}</td>
                              <td>{guest.name}</td>
                
                              <td>


                                <Badge pill className="rounded-pill px-3 py-2" style={{ backgroundColor: ZENV_COLORS.teal, color: 'white' }}>
                                  {guest.roomId}
                                </Badge>
                                </td>

                              <td>
                                <Badge pill className="rounded-pill px-3 py-2" style={{ backgroundColor: ZENV_COLORS.purple, color: 'white' }}>
                                  <FontAwesomeIcon icon={faCreditCard} className="me-1" />
                                  {guest.cardUiId}
                                </Badge>
                              </td>
                              <td className="pe-3">
                                <div className="d-flex flex-column">
                                  <small>
                                    <FontAwesomeIcon icon={faCalendarAlt} className="me-1" style={{ color: ZENV_COLORS.green }} />
                                    {formatDate(guest.checkinTime)}
                                  </small>
                                  <small>
                                    <FontAwesomeIcon icon={faCalendarCheck} className="me-1" style={{ color: ZENV_COLORS.orange }} />
                                    {formatDate(guest.checkoutTime)}
                                  </small>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="text-center py-4">No guest registrations found</td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </GridLayout>





   <style jsx="true">{`
  /* Modern card styling */
  .card {
    border-radius: 1rem;
    overflow: hidden;
    background-color: #ffffff;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08) !important;
  }
  
  /* Stats card hover effects using ZenV colors */
  .stat-card {
    transition: all 0.3s ease;
  }
  
  .stat-card:hover {
    border-color: ${ZENV_COLORS.primary} !important;
  }
  
  .rfid-card:hover {
    background-color: ${ZENV_COLORS.darkTeal};
  }
  
  .rfid-card:hover .view-details {
    color: ${ZENV_COLORS.primary};
  }
  
  .checkin-card:hover {
    background-color: ${ZENV_COLORS.darkTeal};
  }
  
  .checkin-card:hover .view-details {
    color: ${ZENV_COLORS.primary};
  }
  
  .room-card:hover {
    background-color: ${ZENV_COLORS.darkTeal};
  }
  
  .room-card:hover .view-details {
    color: ${ZENV_COLORS.primary};
  }
  
  .guest-card:hover {
    background-color: ${ZENV_COLORS.darkTeal};
  }
  
  .guest-card:hover .view-details {
    color: ${ZENV_COLORS.primary};
  }

  .view-details {
    color: ${ZENV_COLORS.primary};
    transition: all 0.3s ease;
  }
  
  /* Font styling */
  .small {
    font-size: 0.785rem;
  }
  
  /* Progress bar styling */
  .progress {
    border-radius: 0.75rem;
    overflow: hidden;
  }
  
  /* Chart styling */
  .chart-container {
    transition: height 0.3s ease;
    border-radius: 0.5rem;
    padding: 0.5rem;
  }
  
  /* Badge styling */
  .badge {
    font-weight: 500;
    font-size: 0.75rem;
  }
  
  /* Search box styling */
  .form-control-sm {
    height: calc(1.5em + 0.5rem + 2px);
    padding: 0.25rem 1rem;
    font-size: 0.875rem;
    border-radius: 1rem;
  }
  
  .rounded-4 {
    border-radius: 1rem !important;
  }
  
  /* Table styling */
  .table {
    margin-bottom: 0;
  }
  
  .table thead th {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 600;
    color: #6c757d;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }
  
  .table tbody td {
    vertical-align: middle;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .fw-medium {
    font-weight: 500;
  }

  .badge-success, .bg-success {
    background-color: ${ZENV_COLORS.green} !important;
  }
  
  .badge-danger, .bg-danger {
    background-color: ${ZENV_COLORS.orange} !important;
  }
  
  /* Specifically target access status badges */
  .access-granted {
    background-color: ${ZENV_COLORS.green} !important;
    color: white;
  }
  
  .access-denied {
    background-color: ${ZENV_COLORS.orange} !important;
    color: white;
  }
  
  /* Dashboard layout */

  .dashboard-wrapper {
  width: 100%;
  display: flex;
  overflow-x: hidden;
  position: relative;
}

.dashboard-main {
  flex: 1;
  min-width: 0; /* This is crucial for flex child to prevent overflow */
  overflow-x: hidden;
  max-width: 100%;
}
 
  
.dashboard-right {
  width: 320px;
  flex-shrink: 0;
  padding: 1.5rem;
  border-left: 1px solid #eee;
  background-color: #f9f9f9;
  display: none;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

/* Update media query for better display on zoom */
@media (min-width: 992px) {
  .dashboard-right {
    display: block;
  }
  
  .dashboard-main {
    max-width: calc(100% - 320px);
  }
}

  /* Activity card styling */
  .activity-item {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
  }

  /* Chatbot styling */
  .chat-input {
    border-radius: 1.5rem;
    padding: 0.5rem 1rem;
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
  }

  .suggestion-chip {
    background-color: #f0f4f9;
    border-radius: 1rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-block;
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .suggestion-chip:hover {
    background-color: ${ZENV_COLORS.primary};
    color: white;
  }

  /* Activity card styling */
  .activity-item {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-icon {
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }


    .vip-badge {
    background-color: #A2248F !important;
    color: white !important;
  }

  .regular-badge {
    background-color: #22C6D4 !important;
    color: white !important;
  }



  .helpdesk-message {
  transition: background-color 0.2s ease;
}

.helpdesk-message:hover {
  background-color: rgba(247, 250, 252, 0.8);
}

.helpdesk-priority-high {
  color: #dc3545;
  background-color: rgba(220, 53, 69, 0.1);
}

.helpdesk-priority-medium {
  color: ${ZENV_COLORS.orange};
  background-color: rgba(255, 208, 0, 0.1);
}

.helpdesk-priority-normal {
  color: ${ZENV_COLORS.teal};
  background-color: rgba(51, 179, 166, 0.1);
}

.guest-distribution-card:hover {
  background-color: ${ZENV_COLORS.lightPurple};
}

.guest-distribution-card:hover .view-details {
  color: ${ZENV_COLORS.purple};
}

.drag-handle {
  cursor: grab;
}

.drag-handle:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

`}</style>
        
        
        
        
        
        </Container>

      </div>
      
      {/* Right Side Column with Activity and Chatbot Cards */}
      <div className="dashboard-right">


                {/* New Helpdesk Messages Card */}
        <Card className="shadow-sm border-0 rounded-4 mb-4">
          <div style={{height: '8px'}} />
          <Card.Header className="bg-white py-3">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                <FontAwesomeIcon icon={faComments} className="me-2" />
                Helpdesk Messages
              </h6>
              <Link to="/helpdesk" className="text-decoration-none small" style={{ color: ZENV_COLORS.primary }}>
                View All
              </Link>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            {/* We'll add state for helpdesk messages later */}
            <HelpdeskMessages />
          </Card.Body>
        </Card>


        {/* Recent Activities Card */}
        <Card className="shadow-sm border-0 rounded-4 mb-4">
          <Card.Header className="bg-white py-3">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                <FontAwesomeIcon icon={faCalendarCheck} className="me-2" />
                Recent Activities
              </h6>
              <Link to="/rfid_entries" className="text-decoration-none small" style={{ color: ZENV_COLORS.primary }}>
                View All
              </Link>
            </div>
          </Card.Header>



<Card.Body className="p-0">
  {loadingActivities ? (
    <div className="text-center py-4">
      <FontAwesomeIcon icon={faSpinner} spin className="mb-2" style={{ color: ZENV_COLORS.primary }} />
      <p className="small text-muted mb-0">Loading activities...</p>
    </div>
  ) : recentActivities.length > 0 ? (
    <>
      {recentActivities.map((activity, index) => (




        <div className="activity-item d-flex align-items-start" key={activity.id || index}>
  <div 
    className="activity-icon" 
    style={{ 
      backgroundColor: activity.access_status?.includes('Granted') ? 'rgba(177, 208, 7, 0.1)' : 'rgba(255, 208, 0, 0.1)',
      color: activity.access_status?.includes('Granted') ? ZENV_COLORS.green : ZENV_COLORS.orange,
      minWidth: '36px',
      height: '36px',
      marginTop: '2px'
    }}
  >
    <FontAwesomeIcon icon={activity.access_status?.includes('Granted') ? faDoorOpen : faExclamationTriangle} />
  </div>
  <div className="flex-grow-1 ms-2">
    <div className="d-flex justify-content-between align-items-center">
      <div className="fw-medium" style={{ fontSize: '0.85rem' }}>
        Room: {roomMapping[activity.product_id] || activity.product_id || 'N/A'}
      </div>
      <span className="text-muted" style={{ fontSize: '0.75rem', minWidth: '70px', textAlign: 'right' }}>
        {activity.timestamp ? formatTimeAgo(new Date(activity.timestamp)) : 'N/A'}
      </span>
    </div>
    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
      {activity.access_status || 'Unknown'} • UID: {activity.uid?.substring(0, 8)}...
    </div>
  </div>
</div>



      ))}
    </>
  ) : (
    <div className="text-center py-4">
      <p className="small text-muted mb-0">No recent activities found</p>
    </div>
  )}
</Card.Body>



</Card>
       
        
        {/* Chatbot Card */}
        <Card className="shadow-sm border-0 rounded-4 mt-4">
          <Card.Header className="bg-white py-3">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                <FontAwesomeIcon icon={faComments} className="me-2" />
                RFID Assistant
              </h6>
            </div>
          </Card.Header>
          <Card.Body className="p-3">
            <div className="text-center mb-3">
              <div 
                className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-2"
                style={{ width: "60px", height: "60px" }}
              >
                <FontAwesomeIcon icon={faUser} size="2x" style={{ color: ZENV_COLORS.primary }} />
              </div>
              <h6 className="fw-bold mb-1">How can I help?</h6>
              <p className="small text-muted mb-0">Ask me anything about RFID access</p>
            </div>
            
            <div className="position-relative mt-3">
              <input 
                type="text"
                placeholder="Type your question..."
                className="form-control chat-input"
              />
              <Button 
                variant="primary"
                size="sm"
                style={{ 
                  position: 'absolute', 
                  right: '5px', 
                  top: '5px',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FontAwesomeIcon icon={faAngleRight} />
              </Button>
            </div>
            
            <div className="mt-3">
              <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>SUGGESTED QUESTIONS</p>
              <div>
                <span className="suggestion-chip">How to add a new card?</span>
                <span className="suggestion-chip">Access denied issues</span>
                <span className="suggestion-chip">Room reports</span>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

