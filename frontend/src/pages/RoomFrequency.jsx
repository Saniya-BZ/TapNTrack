import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Container, Row, Col, Card, Button, Alert, Table, Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faDoorOpen, 
  faChartBar, 
  faCalculator, 
  faDownload,
  faExclamationTriangle,
  faStar,
  faSync,
  faSpinner,
  faTable
} from '@fortawesome/free-solid-svg-icons';

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
  lightGreen: 'rgba(177, 208, 7, 0.1)',
  lightBlue: 'rgba(42, 110, 187, 0.1)',
  lightTeal: 'rgba(51, 179, 166, 0.1)',
  lightPurple: 'rgba(151, 96, 177, 0.1)',
  lightOrange: 'rgba(255, 208, 0, 0.1)',
};

const RoomFrequency = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [roomStats, setRoomStats] = useState([]);
  const [totalRooms, setTotalRooms] = useState(0);
  const [totalAccess, setTotalAccess] = useState(0);
  const [avgAccessPerRoom, setAvgAccessPerRoom] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchRoomFrequencyData = async () => {
    try {
      setLoading(true);
      // Use the API service method instead of direct axios call
      const response = await api.getRoomFrequency();
      console.log('API Response:', response); // Debug response
      const data = response.data;
      
      setRoomStats(data.room_stats || []);
      setTotalRooms(data.total_rooms || 0);
      setTotalAccess(data.total_access || 0);
      setAvgAccessPerRoom(data.avg_access_per_room || 0);
      setError(data.error || null);
    } catch (err) {
      console.error('Error details:', err); // More detailed error logging
      setError(`Failed to fetch room frequency data: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial data fetch on component mount
  useEffect(() => {
    fetchRoomFrequencyData();
  }, []);

  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRoomFrequencyData();
  };

  const handleExport = () => {
    // Implement CSV export functionality with room type included
    const headers = ['Room ID', 'Room Type', 'Total Access', 'Access Granted', 'Access Denied', 'Most Active Hour', 'Most Active Day'];
    
    let csvContent = headers.join(',') + '\n';
    
    roomStats.forEach(room => {
      const row = [
        room.room_id,
        room.room_type || 'Regular', // Include room type in export
        room.total_access,
        room.access_granted,
        room.access_denied,
        room.most_active_hour,
        room.most_active_day
      ];
      csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'room_access_statistics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to determine which columns to show based on screen width
  const getVisibleColumns = () => {
    if (windowWidth < 576) {
      // Mobile view - minimal columns
      return {
        room_id: true,
        room_type: true,
        total_access: true,
        access_granted: false,
        access_denied: false,
        most_active_hour: false,
        most_active_day: true
      };
    } else if (windowWidth < 992) {
      // Tablet view - more columns
      return {
        room_id: true,
        room_type: true,
        total_access: true,
        access_granted: true,
        access_denied: false,
        most_active_hour: true,
        most_active_day: true
      };
    } else {
      // Desktop view - all columns
      return {
        room_id: true,
        room_type: true,
        total_access: true,
        access_granted: true,
        access_denied: true,
        most_active_hour: true,
        most_active_day: true
      };
    }
  };

  const visibleColumns = getVisibleColumns();

  if (loading && !refreshing) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="fa-2x mb-3" style={{ color: ZENV_COLORS.primary }} />
          <h5 className="fw-normal text-muted">Loading room frequency data...</h5>
        </div>
      </div>
    );
  }
  
  return (
    <Container fluid className="px-md-4 py-4 bg-light">
      {/* Header Section */}
      <Row className="mb-4 align-items-center">
        <Col md={6} className="mb-3 mb-md-0">
          <h2 className="fw-bold mb-0" style={{ color: ZENV_COLORS.primary }}>Room Access Analytics</h2>
          <p className="text-muted mb-0">Monitor and analyze room access frequency patterns</p>
        </Col>
      </Row>
      
      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger rounded-3 shadow-sm d-flex align-items-center mb-4">
          <FontAwesomeIcon icon={faExclamationTriangle} className="me-3 fa-lg" />
          <div>{error}</div>
        </div>
      )}
  
      {/* Room Access Statistics Cards */}
      <Row className="g-3 mb-4">
        {/* Total Rooms */}
        <Col xl={4} md={4} sm={6} xs={12}>
          <Card className="h-100 shadow-sm border-0 rounded-4">
            <Card.Body className="p-3">
              <Row className="g-0 align-items-center">
                <Col className="me-2">
                  <div className="text-xs text-uppercase text-muted fw-bold mb-1">
                    Total Rooms
                  </div>
                  <div className="h3 mb-0 fw-bold" >
                    {totalRooms}
                  </div>
                </Col>
                <Col xs="auto">
                  <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                    <FontAwesomeIcon icon={faDoorOpen} className="fa-lg" style={{ color: ZENV_COLORS.primary }} />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
  
        {/* Total Access */}
        <Col xl={4} md={4} sm={6} xs={12}>
          <Card className="h-100 shadow-sm border-0 rounded-4">
            <Card.Body className="p-3">
              <Row className="g-0 align-items-center">
                <Col className="me-2">
                  <div className="text-xs text-uppercase text-muted fw-bold mb-1">
                    Total Access
                  </div>
                  <div className="h3 mb-0 fw-bold" >
                    {totalAccess}
                  </div>
                </Col>
                <Col xs="auto">
                  <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                    <FontAwesomeIcon icon={faChartBar} className="fa-lg" style={{ color: ZENV_COLORS.primary }} />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
  
        {/* Average Access Per Room */}
        <Col xl={4} md={4} sm={12} xs={12}>
          <Card className="h-100 shadow-sm border-0 rounded-4">
            <Card.Body className="p-3">
              <Row className="g-0 align-items-center">
                <Col className="me-2">
                  <div className="text-xs text-uppercase text-muted fw-bold mb-1">
                    Avg Access Per Room
                  </div>
                  <div className="h3 mb-0 fw-bold" >
                    {avgAccessPerRoom}
                  </div>
                </Col>
                <Col xs="auto">
                  <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                    <FontAwesomeIcon icon={faCalculator} className="fa-lg" style={{ color: ZENV_COLORS.primary }} />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
  
      {/* Room Access Details Table */}
      <Card className="shadow-sm mb-4 border-0 rounded-4">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center border-0">
          <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faTable} className="me-2" />
            Room Access Details
          </h6>

          
          <div className="d-flex gap-2">
            <Button 
              variant="outline-secondary"
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleRefresh}
              disabled={refreshing}
              className="d-flex align-items-center rounded-pill"
            >
              <FontAwesomeIcon icon={faSync} spin={refreshing} className="me-1" /> 
              <span className="d-none d-sm-inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>

            <Button 
              variant="outline-primary" 
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleExport}
              className="d-flex align-items-center rounded-pill"
              style={{ borderColor: ZENV_COLORS.primary, color: ZENV_COLORS.primary }}
            >

              <FontAwesomeIcon icon={faDownload} className="me-1" /> 
              <span className="d-none d-sm-inline">Export</span>

            </Button>


          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {refreshing && (
            <div className="text-center py-3">
              <FontAwesomeIcon icon={faSync} spin className="me-2" style={{ color: ZENV_COLORS.primary }} /> 
              <span className="text-muted fw-medium">Refreshing data...</span>
            </div>
          )}
          <div className="table-responsive">
            <Table hover responsive className="mb-0 align-middle">
              <thead className="bg-light">
                <tr>
                  {visibleColumns.room_id && <th className="th-room-id ps-3">Room ID</th>}
                  {visibleColumns.room_type && <th className="th-room-type">Room Type</th>}
                  {visibleColumns.total_access && <th className="th-total">Total Access</th>}
                  {visibleColumns.access_granted && <th className="th-granted">Access Granted</th>}
                  {visibleColumns.access_denied && <th className="th-denied">Access Denied</th>}
                  {visibleColumns.most_active_hour && <th className="th-hour">Most Active Hour</th>}
                  {visibleColumns.most_active_day && <th className="th-day pe-3">Most Active Day</th>}
                </tr>
              </thead>
              <tbody>
                {roomStats.length > 0 ? (
                  roomStats.map((room, index) => (
                    <tr key={index}>


                      {visibleColumns.room_id && <td className="td-room-id fw-medium ps-3">{room.room_id}</td>}
                      {visibleColumns.room_type && (
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

                      )}


                      {visibleColumns.total_access && <td className="td-total">{room.total_access}</td>}
                      {visibleColumns.access_granted && (
                        <td className="td-granted">
                          <Badge pill className="text-wrap px-3 py-2" style={{ backgroundColor: ZENV_COLORS.green, color: 'white' }}>
                            {room.access_granted}
                          </Badge>
                        </td>
                      )}



                      {visibleColumns.access_denied && (
                        <td className="td-denied">
                          <Badge pill className="text-wrap px-3 py-2" style={{ backgroundColor: ZENV_COLORS.orange, color: ZENV_COLORS.darkGray }}>
                            {room.access_denied}
                          </Badge>
                        </td>
                      )}

                      {visibleColumns.most_active_hour && <td className="td-hour">{room.most_active_hour}</td>}
                      {visibleColumns.most_active_day && <td className="td-day pe-3">{room.most_active_day}</td>}
                    </tr>
                  ))


                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-4">No room access data available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        <Card.Footer className="py-2 bg-white border-0">
          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">Showing {roomStats.length} rooms</div>
          </div>
        </Card.Footer>
      </Card>
      
      {/* Custom CSS for responsive styling */}
      <style jsx="true">{`
        /* Modern card styling */
        .card {
          border-radius: 0.75rem;
          overflow: hidden;
          background-color: #ffffff;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08) !important;
        }

          /* Badge styling for room types - should be higher in the CSS to ensure higher specificity */
  .vip-badge {
    background-color: #A2248F !important;
    color: white !important;
  }

  .regular-badge {
    background-color: #22C6D4 !important;
    color: white !important;
  }



  .text-wrap {
  background-color: #E0E0E0 !important;
  color: black !important;
  }
        
        /* Text styling */
        .text-xs {
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        
        .fw-medium {
          font-weight: 500;
        }
        
        /* Badge styling */
        .badge.rounded-pill {
          font-weight: 500;
          font-size: 0.75rem;
        }
        
        /* Card header styling */
        .card-header {
          border-bottom: 1px solid rgba(229, 231, 235, 0.5);
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
 
        /* Button styling */
        .btn-outline-primary {
          border-color: #e0e0e0;
          color: ${ZENV_COLORS.primary};
        }
        
        .btn-outline-primary:hover {
          background-color: ${ZENV_COLORS.primary};
          border-color: ${ZENV_COLORS.primary};
          color: white;
        }
        
        .btn-outline-secondary {
          border-color: #e0e0e0;
          color: ${ZENV_COLORS.mediumGray};
        }
        
        .btn-outline-secondary:hover {
          background-color: ${ZENV_COLORS.mediumGray};
          border-color: ${ZENV_COLORS.mediumGray};
          color: white;
        }
        
        /* Rounded-4 utility */
        .rounded-4 {
          border-radius: 0.75rem !important;
        }
        
        /* Responsive sizing */
        @media (max-width: 767.98px) {
          .h3 {
            font-size: 1.35rem;
          }
          
          .table th, .table td {
            padding: 0.6rem 0.5rem;
            font-size: 0.9rem;
          }
        }

        /* Column-specific styling for small screens */
        @media (max-width: 575.98px) {
          .th-room-id, .td-room-id {
            min-width: 80px;
          }
          
          .th-room-type, .td-room-type {
            min-width: 100px;
          }
          
          .th-total, .td-total {
            min-width: 90px;
          }
          
          .th-day, .td-day {
            min-width: 110px;
          }
          
          .table-responsive {
            border: 0;
            padding: 0;
          }
          
          .table td, .table th {
            padding: 0.5rem 0.25rem;
            font-size: 0.85rem;
          }

          // Add to the style JSX block

        }
        
        @media (min-width: 576px) and (max-width: 991.98px) {
          /* Column-specific styling for tablet screens */
          .th-room-id, .td-room-id {
            min-width: 100px;
          }
          
          .th-room-type, .td-room-type {
            min-width: 120px;
          }
          
          .th-hour, .td-hour {
            min-width: 120px;
          }
          
          .th-day, .td-day {
            min-width: 100px;
          }
        }
        
        /* Gap for button group */
        .gap-2 {
          gap: 0.5rem;
        }
      `}</style>
    </Container>
  );
};

export default RoomFrequency;
