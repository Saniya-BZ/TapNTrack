import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Badge, Button, Spinner, Table, Tabs, Tab, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faWifi,
  faGlobe,
  faDownload,
  faSync,
  faExclamationTriangle,
  faServer,
  faHeartbeat,
  faClipboard
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';

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
  heading: "'Lato', cursive",
  body: "'Lato', sans-serif"
};

const SystemHealthMonitoring = () => {
  const [healthData, setHealthData] = useState(null);
  const [otaDetails, setOtaDetails] = useState(null); // Keep for display if API provides
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(""); // Changed from productId
  const [availableRoomIds, setAvailableRoomIds] = useState([]); // Changed from availableProducts
  const [requestedRoomId, setRequestedRoomId] = useState(null); // Tracks the ID we actually requested data for
  const [otaUpdateUrl, setOtaUpdateUrl] = useState(''); // New state for OTA URL input
  const [currentRoomDisplayName, setCurrentRoomDisplayName] = useState(null);

  const [allRoomsHistory, setAllRoomsHistory] = useState([]);
  const [allRoomsHistoryLoading, setAllRoomsHistoryLoading] = useState(false);

    const fetchAllRoomsHistory = useCallback(async () => {
    setAllRoomsHistoryLoading(true);
    try {
      const response = await api.getAllSystemHealthHistory(50); // New API method to get history for all rooms
      console.log("All rooms history response:", response.data);

      if (response.data && response.data.history) {
        // Sort by timestamp, most recent first
        const sortedHistory = response.data.history
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setAllRoomsHistory(sortedHistory);
      } else {
        setAllRoomsHistory([]);
      }
    } catch (err) {
      console.error('Error fetching all rooms history:', err);
      setAllRoomsHistory([]);
    } finally {
      setAllRoomsHistoryLoading(false);
    }
  }, []);

    useEffect(() => {
    fetchAllRoomsHistory();

    const allRoomsHistoryInterval = setInterval(() => {
      fetchAllRoomsHistory();
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(allRoomsHistoryInterval);
  }, [fetchAllRoomsHistory]);






  // Function to fetch available room IDs
const fetchAvailableRoomIds = useCallback(async () => {
  try {
    // Fetch both regular rooms and VIP rooms
    const [regularResponse, vipResponse] = await Promise.all([
      api.getTables(),
      api.getVipRooms()
    ]);
    
    let allRoomIds = [];
    
    // Process regular rooms
    if (regularResponse.data && regularResponse.data.products) {
      const regularRoomIds = regularResponse.data.products.map(product => ({
        id: product.room_id,
        type: 'regular',
        displayName: product.room_id
      }));
      allRoomIds = [...allRoomIds, ...regularRoomIds];
    }
    
    // Process VIP rooms
    if (vipResponse.data && vipResponse.data.vip_rooms) {
      const vipRoomIds = vipResponse.data.vip_rooms.map(room => ({
        id: room.product_id,
        type: 'vip',
        displayName: `${room.vip_rooms} (VIP)` // Include "VIP" label
      }));
      allRoomIds = [...allRoomIds, ...vipRoomIds];
    }
    
    // Remove duplicates (if any rooms appear in both lists)
    const uniqueRoomIds = allRoomIds.filter((room, index, self) => 
      index === self.findIndex(r => r.id === room.id)
    );
    
    setAvailableRoomIds(uniqueRoomIds);
    
    // Set first room_id as default selection if nothing is selected yet
    if (uniqueRoomIds.length > 0 && !selectedRoomId) {
      setSelectedRoomId(uniqueRoomIds[0].id);
    }
  } catch (err) {
    console.error('Error fetching available room IDs:', err);
    setError('Failed to load available room IDs.');
  }
}, [selectedRoomId]);


  // Function to fetch health data for a specific room ID
  const fetchHealthData = useCallback(async (roomId) => {
    setRefreshing(true);
    setError(null);
    setRequestedRoomId(roomId); // Store the requested room ID

    // Find the display name for the selected room ID
    const selectedRoom = availableRoomIds.find(room => room.id === roomId);
    setCurrentRoomDisplayName(selectedRoom ? selectedRoom.displayName : roomId);


    try {
      const response = await api.getSystemHealth(roomId);

      // Debug to see what's coming back from the API
      console.log("Health data response:", response.data);

      // Validate that the response matches the requested room
      if (response.data && response.data.room_id === roomId) { // Changed from product_id
        if (response.data.system_health) {
          setHealthData(response.data.system_health);
          // If the API response includes OTA details directly, use it
          // Otherwise, fetch separately if it's a different endpoint/data
          if (response.data.ota_details) { // Assuming backend might send this along
            setOtaDetails(response.data.ota_details);
          }
          setError(null);
        } else if (response.data.error) {
          setError(response.data.error);
          setHealthData(null);
          setOtaDetails(null);
        } else {
          setError('Invalid data format received from server for health data.');
          setHealthData(null);
          setOtaDetails(null);
        }
      } else {
        // Response doesn't match the requested room
        if (response.data && response.data.room_id && response.data.room_id !== roomId) {
          setError(`Received data for room ${response.data.room_id} but requested ${roomId}. Please try again.`);
        } else {
          setError(`No health data available for room ${roomId}.`);
        }
        setHealthData(null);
        setOtaDetails(null);
      }
    } catch (err) {
      console.error('Error fetching health data:', err);
      setHealthData(null);
      setOtaDetails(null);
      setError(`Failed to fetch system health data for room ${roomId}. It might not be reporting yet.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [availableRoomIds]);

  // Function to fetch health history for a specific room ID
  const fetchHealthHistory = useCallback(async (roomId) => {
    setHistoryLoading(true);
    try {
      const response = await api.getSystemHealthHistory(50, roomId); // Fetch up to 50 entries
      // Debug the history response
      console.log("History data response:", response.data);

      if (response.data && response.data.history) {
        // Filter to ensure we only show history for the requested room, and sort by timestamp
        const filteredAndSortedHistory = response.data.history
          .filter(entry => entry.room_id === roomId) // Changed from product_id
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort descending
        setHistoryData(filteredAndSortedHistory);

        if (filteredAndSortedHistory.length === 0) {
          console.log(`No history entries found for room ${roomId}`);
        }
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error('Error fetching health history:', err);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Function to fetch OTA details (could be separate or part of healthData)
  const fetchOtaDetails = useCallback(async (roomId) => {
    try {
      const response = await api.getOtaDetails(roomId);
      setOtaDetails(response.data);
    } catch (err) {
      console.error('Error fetching OTA details:', err);
      setOtaDetails(null);
    }
  }, []);

  // Function to initiate OTA update
  const initiateUpdate = async () => {
    if (!selectedRoomId || !otaUpdateUrl) {
      alert('Please select a Room ID and provide an update URL.');
      return;
    }

    try {
      setUpdating(true);
      await api.initiateOtaUpdate(otaUpdateUrl, selectedRoomId);
      alert(`OTA update command sent for room ${selectedRoomId}. The device will restart after the update is complete.`);
      setOtaUpdateUrl(''); // Clear the URL input after sending
    } catch (err) {
      console.error('Error initiating OTA update:', err);
      alert('Failed to initiate OTA update. Please check the URL and device status.');
    } finally {
      setUpdating(false);
    }
  };

  // Function to apply the selected room and fetch its data
  const applySelectedRoom = useCallback(() => {
    if (selectedRoomId) {
      // Reset state before fetching new data
      setHealthData(null);
      setError(null);
      setHistoryData([]);
      setOtaDetails(null);
      setLoading(true); // Set loading to true when applying a new room

      // Fetch data for the selected room
      fetchHealthData(selectedRoomId);
      fetchHealthHistory(selectedRoomId);
      fetchOtaDetails(selectedRoomId); // Fetch OTA details for the newly selected room
    } else {
      setError('Please select a Room ID to view health data.');
      setHealthData(null);
      setHistoryData([]);
      setOtaDetails(null);
      setLoading(false);
    }
  }, [selectedRoomId, fetchHealthData, fetchHealthHistory, fetchOtaDetails]);


  // Helper function to determine status badge variant
  const getBadgeVariant = (status) => {
    switch (status) {
      case 'working':
      case 'connected':
      case 'reachable':
      case 'up_to_date': // New status for OTA
        return 'success';
      case 'update_available':
        return 'warning';
      case 'error':
      case 'disconnected':
      case 'unreachable':
        return 'danger';
      case 'unknown':
      default:
        return 'secondary';
    }
  };

  // Helper function to determine status badge text
  const getBadgeText = (component, status) => {
    // If status is unknown, show "Checking..."
    if (!status || status === 'unknown') return 'Checking...';

    // Component specific texts
    switch (component) {
      case 'rtc':
        return status === 'working' ? 'Operational' : 'Error';
      case 'wifi':
        return status === 'connected' ? 'Connected' : 'Disconnected';
      case 'internet':
        return status === 'reachable' ? 'Online' : 'Offline';
      case 'ota':
        return status === 'update_available' ? 'Update Available' : 'Up to Date';
      default:
        return status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); // Capitalize words and replace underscores
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  // Fetch available room IDs on component mount
  useEffect(() => {
    fetchAvailableRoomIds();

    // Set up polling every 30 seconds for available room IDs
    const roomIdsIntervalId = setInterval(() => {
      fetchAvailableRoomIds();
    }, 30000);

    return () => {
      clearInterval(roomIdsIntervalId);
    };
  }, [fetchAvailableRoomIds]);

  // Effect to automatically apply the first available room ID once fetched, or whenever selectedRoomId changes
  useEffect(() => {
    if (selectedRoomId && !requestedRoomId) { // Only auto-apply if nothing was requested yet
      applySelectedRoom();
    }
  }, [selectedRoomId, requestedRoomId, applySelectedRoom]);

  // Polling for current health data and OTA details
  useEffect(() => {
    let healthInterval;
    if (requestedRoomId) {
      healthInterval = setInterval(() => {
        fetchHealthData(requestedRoomId);
        fetchOtaDetails(requestedRoomId); // Also refresh OTA details with health
      }, 15000); // Refresh every 15 seconds
    }
    return () => clearInterval(healthInterval); // Clean up on unmount or room change
  }, [requestedRoomId, fetchHealthData, fetchOtaDetails]);

  // Polling for history data (less frequent)
  useEffect(() => {
    let historyInterval;
    if (requestedRoomId) {
      historyInterval = setInterval(() => {
        fetchHealthHistory(requestedRoomId);
      }, 60000); // Refresh history every 60 seconds
    }
    return () => clearInterval(historyInterval); // Clean up
  }, [requestedRoomId, fetchHealthHistory]);


  if (loading && !healthData && !availableRoomIds.length) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading system health data...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 style={{ fontFamily: ZENV_FONTS.heading, color: ZENV_COLORS.primary }}>
            System Health Monitoring
          </h1>
          <div className="d-flex align-items-center mt-2">
            <Form.Group style={{ width: "200px" }} className="me-3">
              <Form.Label><strong>Select Room ID:</strong></Form.Label>






                <Form.Select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      disabled={refreshing || availableRoomIds.length === 0}
                    >
                      {availableRoomIds.length === 0 ? (
                        <option value="">Loading room IDs...</option>
                      ) : (
                        <>
                          <option value="">-- Select a Room --</option>
                          <optgroup label="Regular Rooms">
                            {availableRoomIds
                              .filter(room => room.type === 'regular')
                              .map(room => (
                                <option key={room.id} value={room.id}>
                                  {room.displayName}
                                </option>
                              ))
                            }
                          </optgroup>
                          <optgroup label="VIP Rooms">
                            {availableRoomIds
                              .filter(room => room.type === 'vip')
                              .map(room => (
                                <option key={room.id} value={room.id}>
                                  {room.displayName}
                                </option>
                              ))
                            }
                          </optgroup>
                        </>
                      )}
                    </Form.Select>



            </Form.Group>
            <Button
              variant="primary"
              className="me-2"
              onClick={applySelectedRoom}
              disabled={refreshing || !selectedRoomId}
            >
              Apply
            </Button>
            <div>
              <p className="mb-0">
                <strong>Current Room ID:</strong> <Badge bg="info" pill>{currentRoomDisplayName || 'N/A'}</Badge>
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline-primary"
          className="rounded-pill"
          onClick={() => {
            if (requestedRoomId) { // Only refresh if a room is actively selected and displayed
              fetchHealthData(requestedRoomId);
              fetchHealthHistory(requestedRoomId);
              fetchOtaDetails(requestedRoomId);
            } else {
              alert('Please select a Room ID and click Apply first to refresh.');
            }
          }}
          disabled={refreshing || !requestedRoomId}
        >
          <FontAwesomeIcon
            icon={faSync}
            className={refreshing ? "fa-spin me-2" : "me-2"}
          />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <Card.Body className="p-4">
            <div className="d-flex align-items-center">
              <div className="me-3" style={{ color: '#dc3545' }}>
                <FontAwesomeIcon icon={faExclamationTriangle} size="2x" />
              </div>
              <div>
                <h5 className="mb-1">Error</h5>
                <p className="mb-0">{error}</p>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      <Tabs defaultActiveKey="current" className="mb-4">
        <Tab eventKey="current" title="Current Status">
 

          {!healthData && !error && requestedRoomId ? (
            <div className="text-center py-5">
              <p>No health data available for room **{requestedRoomId}** yet. It might not have reported or data is still loading.</p>
            </div>
          ) : !healthData && !requestedRoomId ? (
            <div className="text-center py-5">
              <p>Please select a Room ID from the dropdown and click 'Apply' to view its health data.</p>
            </div>
          ) : (
            <>
            
            <Row className="g-4">
          

               {/* RTC Card */}
              <Col md={6} lg={6}>
                <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between mb-3">
                      <h5 className="card-title" style={{ fontFamily: ZENV_FONTS.heading }}>
                        <FontAwesomeIcon icon={faClock} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                        Real-Time Clock
                      </h5>
                      {healthData?.rtc?.status && (
                        <Badge
                          bg={getBadgeVariant(healthData.rtc.status)}
                          style={{
                            fontFamily: ZENV_FONTS.body,
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            padding: '0.5em 0.85em'
                          }}
                          pill
                        >
                          {getBadgeText('rtc', healthData.rtc.status)}
                        </Badge>
                      )}
                    </div>

                    <div className="mb-3">
                      <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Status Message:</p>
                      <p className="mb-0">{healthData?.rtc?.message || 'No status available'}</p>
                    </div>

                    <div>
                      <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Current Time:</p>
                      <h3 className="mb-0" style={{ fontFamily: ZENV_FONTS.body, fontWeight: 600 }}>
                        {healthData?.rtc?.time || 'Unavailable'}
                      </h3>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
             

             {/* Wi-Fi Card */}
              <Col md={6} lg={6}>
                <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between mb-3">
                      <h5 className="card-title" style={{ fontFamily: ZENV_FONTS.heading }}>
                        <FontAwesomeIcon icon={faWifi} className="me-2" style={{ color: ZENV_COLORS.teal }} />
                        Wi-Fi Connection
                      </h5>
                      {healthData?.wifi?.status && (
                        <Badge
                          bg={getBadgeVariant(healthData.wifi.status)}
                          style={{
                            fontFamily: ZENV_FONTS.body,
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            padding: '0.5em 0.85em'
                          }}
                          pill
                        >
                          {getBadgeText('wifi', healthData.wifi.status)}
                        </Badge>
                      )}
                    </div>

                    <div className="mb-3">
                      <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Status Message:</p>
                      <p className="mb-0">{healthData?.wifi?.message || 'No status available'}</p>
                    </div>

                    <Row>
                      <Col sm={6}>
                        <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>SSID:</p>
                        <p className="mb-0" style={{ fontWeight: 500 }}>{healthData?.wifi?.ssid || 'Not connected'}</p>
                      </Col>
                      <Col sm={6}>
                        <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>IP Address:</p>
                        <p className="mb-0" style={{ fontWeight: 500, fontFamily: 'monospace' }}>{healthData?.wifi?.ip || 'N/A'}</p>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>

              {/* Internet Card */}
              <Col md={6} lg={6}>
                <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between mb-3">
                      <h5 className="card-title" style={{ fontFamily: ZENV_FONTS.heading }}>
                        <FontAwesomeIcon icon={faGlobe} className="me-2" style={{ color: ZENV_COLORS.green }} />
                        Internet Connectivity
                      </h5>
                      {healthData?.internet?.status && (
                        <Badge
                          bg={getBadgeVariant(healthData.internet.status)}
                          style={{
                            fontFamily: ZENV_FONTS.body,
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            padding: '0.5em 0.85em'
                          }}
                          pill
                        >
                          {getBadgeText('internet', healthData.internet.status)}
                        </Badge>
                      )}
                    </div>

                    <div className="mb-3">
                      <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Status Message:</p>
                      <p className="mb-0">{healthData?.internet?.message || 'No status available'}</p>
                    </div>

                    <div>
                      <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Ping Result:</p>
                      <p className="mb-0" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {healthData?.internet?.ping_result || 'No ping data available'}
                      </p>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Firmware Card */}

              <Col md={6} lg={6}>
                <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between mb-3">
                      <h5 className="card-title" style={{ fontFamily: ZENV_FONTS.heading }}>
                        <FontAwesomeIcon icon={faDownload} className="me-2" style={{ color: ZENV_COLORS.orange }} />
                        Firmware Updates
                      </h5>
                      {healthData?.ota?.status && (
                        <Badge
                          bg={getBadgeVariant(healthData.ota.status)}
                          style={{
                            fontFamily: ZENV_FONTS.body,
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            padding: '0.5em 0.85em'
                          }}
                          pill
                        >
                          {getBadgeText('ota', healthData.ota.status)}
                        </Badge>
                      )}
                    </div>

                    <div className="mb-3">
                      <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Status Message:</p>
                      <p className="mb-0">{healthData?.ota?.message || 'No status available'}</p>
                    </div>

                    <div className="mb-3">
                      <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Current Version:</p>
                      <p className="mb-0" style={{ fontWeight: 600 }}>{healthData?.ota?.current_version || 'Unknown'}</p>
                    </div>

               
                    {otaDetails && (
                      <div className="mt-3 border-top pt-3">
                        <h6>OTA Details:</h6>
                        <p className="mb-1"><strong>Product Version:</strong> {otaDetails.product_version || 'N/A'}</p>
                        <p className="mb-1"><strong>Firmware Version:</strong> {otaDetails['Firmware version'] || 'N/A'}</p>

                      </div>
                    )}


                  </Card.Body>
                </Card>
              </Col>

             
            </Row>

            
          {/* Add new section for All Rooms History after the 4 cards */}
          <div className="mt-5">
            <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 style={{ fontFamily: ZENV_FONTS.heading }}>
                    <FontAwesomeIcon icon={faClipboard} className="me-2" style={{ color: ZENV_COLORS.purpleColor }} />
                    All Rooms Status History
                  </h5>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={fetchAllRoomsHistory}
                    disabled={allRoomsHistoryLoading}
                  >
                    <FontAwesomeIcon
                      icon={faSync}
                      className={allRoomsHistoryLoading ? "fa-spin me-2" : "me-2"}
                    />
                    {allRoomsHistoryLoading ? 'Loading...' : 'Refresh History'}
                  </Button>
                </div>

                
                {allRoomsHistoryLoading && allRoomsHistory.length === 0 ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="secondary" />
                    <p className="mt-3">Loading historical data for all rooms...</p>
                  </div>
                ) : allRoomsHistory.length === 0 ? (
                  <div className="text-center py-5">
                    <p>No historical data available for any rooms yet.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Room ID</th>
                          <th>Room Type</th>
                          <th>Timestamp</th>
                          <th>RTC Status</th>
                          <th>Wi-Fi Status</th>
                          <th>Internet Status</th>
                          <th>OTA Status</th>
                        </tr>
                      </thead>
                      <tbody>

                                          {allRoomsHistory.map((entry, index) => {
                          const room = availableRoomIds.find(r => r.id === entry.room_id);
                          const roomDisplayName = room?.displayName || entry.room_id;
                          const roomType = room?.type || 'unknown';
                          
                          return (
                            <tr key={index}>
                              <td>{roomDisplayName}</td>
                              <td>
                                <Badge 
                                  bg={roomType === 'vip' ? 'warning' : 'info'} 
                                  pill
                                >
                                  {roomType === 'vip' ? 'VIP' : 'Regular'}
                                </Badge>
                              </td>
                              <td>{formatDate(entry.timestamp)}</td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.rtc?.status)}
                                  pill
                                >
                                  {getBadgeText('rtc', entry.system_health?.rtc?.status)}
                                </Badge>
                              </td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.wifi?.status)}
                                  pill
                                >
                                  {getBadgeText('wifi', entry.system_health?.wifi?.status)}
                                </Badge>
                                <div className="small text-muted mt-1">
                                  {entry.system_health?.wifi?.ssid || 'No SSID'}
                                </div>
                              </td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.internet?.status)}
                                  pill
                                >
                                  {getBadgeText('internet', entry.system_health?.internet?.status)}
                                </Badge>
                              </td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.ota?.status)}
                                  pill
                                >
                                  {getBadgeText('ota', entry.system_health?.ota?.status)}
                                </Badge>
                             <div className="small text-muted mt-1">
                                  {entry.system_health?.ota?.current_version || 'Unknown'}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
               </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>
          </>
          )}




        </Tab>

        <Tab eventKey="history" title="Historical Data">
          <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-4">
              
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 style={{ fontFamily: ZENV_FONTS.heading }}>
                  <FontAwesomeIcon icon={faServer} className="me-2" style={{ color: ZENV_COLORS.purple }} />
                  System Health History for {currentRoomDisplayName || 'N/A'}
                </h5>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => fetchHealthHistory(requestedRoomId)}
                  disabled={historyLoading || !requestedRoomId}
                >
                  <FontAwesomeIcon
                    icon={faSync}
                    className={historyLoading ? "fa-spin me-2" : "me-2"}
                  />
                  {historyLoading ? 'Loading...' : 'Refresh History'}
                </Button>
              </div>

              {historyLoading && historyData.length === 0 ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="secondary" />
                  <p className="mt-3">Loading historical data...</p>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-5">
                  <p>No historical data available for room **{requestedRoomId || 'N/A'}** yet.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Room ID</th>
                        <th>RTC Status</th>
                        <th>Wi-Fi Status</th>
                        <th>Internet Status</th>
                        <th>OTA Status</th>
                      </tr>
                    </thead>
                    <tbody>

                      {historyData.map((entry, index) => {
                   
                          const roomDisplayName = availableRoomIds.find(
                            room => room.id === entry.room_id
                          )?.displayName || entry.room_id;
                          
                          return (
                            <tr key={index}>
                              <td>{roomDisplayName}</td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.rtc?.status)}
                                  pill
                                >
                                  {getBadgeText('rtc', entry.system_health?.rtc?.status)}
                                </Badge>
                              </td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.wifi?.status)}
                                  pill
                                >
                                  {getBadgeText('wifi', entry.system_health?.wifi?.status)}
                                </Badge>
                                <div className="small text-muted mt-1">
                                  {entry.system_health?.wifi?.ssid || 'No SSID'}
                                </div>
                              </td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.internet?.status)}
                                  pill
                                >
                                  {getBadgeText('internet', entry.system_health?.internet?.status)}
                                </Badge>
                              </td>
                              <td>
                                <Badge
                                  bg={getBadgeVariant(entry.system_health?.ota?.status)}
                                  pill
                                >
                                  {getBadgeText('ota', entry.system_health?.ota?.status)}
                                </Badge>
                                <div className="small text-muted mt-1">
                                  {entry.system_health?.ota?.current_version || 'Unknown version'}
                                </div>
                              </td>
                            </tr>
                          );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
              </Card.Body>
              </Card>
              </Tab>
              </Tabs>
              </Container>
  );
};
        


export default SystemHealthMonitoring;




