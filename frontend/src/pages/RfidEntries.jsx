import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  InputGroup, 
  FormControl, 
  Button, 
  Table, 
  Badge, 
  Pagination, 
  Modal,
  Dropdown,
  Container,
  Row,
  Col
} from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, 
  faDownload, 
  faSort, 
  faSortUp, 
  faSortDown, 
  faSpinner,
  faExclamationTriangle,
  faChartBar,
  faSync
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

const RfidEntries = () => {
  // State for entries data
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [roomMapping, setRoomMapping] = useState({});

  // const [socket, setSocket] = useState(null);
  
  // Summary statistics
  const [stats, setStats] = useState({
    totalEntries: 0,
    accessGranted: 0,
    accessDenied: 0,
    todayEntries: 0
  });
  
  // Sorting state
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Navigation and query params
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);



  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Get page from URL params on initial load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pageParam = parseInt(params.get('page'), 10);
    if (pageParam && !isNaN(pageParam)) {
      setPage(pageParam);
    }
  }, [location.search]);
  

  

// Add this function to your component (outside of any useEffect)
const fetchEntries = async () => {
  try {
    setLoading(true);
    // Fetch entries from API with pagination
    const response = await axios.get(`http://localhost:5000/api/rfid_entries`, {
      params: { page },
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    // Update entries state
    setEntries(response.data.entries);
    setFilteredEntries(response.data.entries);
    setTotalPages(response.data.total_pages);
    
    // Calculate summary statistics
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const allEntries = response.data.entries || [];
    
    const granted = allEntries.filter(e => e.access_status.includes('Granted')).length;
    const denied = allEntries.length - granted;
    const todayCount = allEntries.filter(e => e.timestamp?.startsWith(todayString)).length;
    
    setStats({
      totalEntries: allEntries.length,
      accessGranted: granted,
      accessDenied: denied,
      todayEntries: todayCount
    });
    
    setLoading(false);
  } catch (err) {
    console.error('Error fetching RFID entries:', err);
    setError('Failed to load RFID entries: ' + (err.response?.data?.error || err.message));
    setLoading(false);
  }
};
useEffect(() => {
  const fetchEntries = async () => {
    try {
      setLoading(true);
      // Fetch entries from API with pagination
      const response = await axios.get(`http://localhost:5000/api/rfid_entries`, {
        params: { page },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // No longer filtering out entries with "deleted" status
      setEntries(response.data.entries);
      setFilteredEntries(response.data.entries);
      setTotalPages(response.data.total_pages);
      
      // Calculate summary statistics
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      const allEntries = response.data.entries || [];
      
      const granted = allEntries.filter(e => e.access_status.includes('Granted')).length;
      const denied = allEntries.length - granted;
      const todayCount = allEntries.filter(e => e.timestamp?.startsWith(todayString)).length;
      
      setStats({
        totalEntries: allEntries.length,
        accessGranted: granted,
        accessDenied: denied,
        todayEntries: todayCount
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching RFID entries:', err);
      setError('Failed to load RFID entries: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };
  
  fetchEntries();
}, [page]);
  

  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/manage_tables`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data) {
          const tablesData = response.data.products || response.data;
          
          // Create a mapping of product_id to room_no/room_id from the data array
          const mapping = {};
          
          // Log the first item to see its structure
          if (tablesData.length > 0) {
            console.log('Sample item structure:', tablesData[0]);
          }
          
          tablesData.forEach(item => {
            const productId = item.product_id || item.id;
            const roomId = item.room_no || item.room_id || item.room;
            
            // Convert to string to ensure comparison works (if needed)
            mapping[productId.toString()] = roomId;
          });
          
          setRoomMapping(mapping);
        }
      } catch (err) {
        console.error('Error fetching room data:', err);
      }
    };
    
    fetchRoomData();
  }, []);
  
  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      // Update URL with page number
      navigate(`/rfid_entries?page=${newPage}`);
      setPage(newPage);
    }
  };
  
  useEffect(() => {
  fetchEntries();
}, [page]); // Only dependency is page



const handleSearch = () => {
  if (!searchTerm.trim()) {
    // Make sure we're working with the already filtered entries (without deleted items)
    setFilteredEntries(entries);
    return;
  }

  const term = searchTerm.toLowerCase();
  const filtered = entries.filter(entry => {
    // Prepare all searchable fields as strings
    const id = entry.id ? entry.id.toString() : '';
    const uid = entry.uid ? entry.uid.toString() : '';
    const timestamp = entry.timestamp ? entry.timestamp.replace('T', ' ') : '';
    const roomId = roomMapping[entry.product_id] ? roomMapping[entry.product_id].toString() : 'Not Assigned';
    const status = entry.access_status ? entry.access_status.toString() : '';

    // Search in all fields
    return (
      id.toLowerCase().includes(term) ||
      uid.toLowerCase().includes(term) ||
      timestamp.toLowerCase().includes(term) ||
      roomId.toLowerCase().includes(term) ||
      status.toLowerCase().includes(term)
    );
  });

  setFilteredEntries(filtered);
};

  // Handle Enter key in search input
  const handleSearchKeyUp = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  // Handle sorting
  const handleSort = (field) => {
    const isAsc = sortField === field && sortDirection === 'asc';
    const direction = isAsc ? 'desc' : 'asc';
    
    setSortField(field);
    setSortDirection(direction);
    
    const sortedEntries = [...filteredEntries].sort((a, b) => {
      // Special case for room_id which comes from roomMapping
      if (field === 'room_id') {
        const roomA = roomMapping[a.product_id] || '';
        const roomB = roomMapping[b.product_id] || '';
        return direction === 'asc' 
          ? roomA.localeCompare(roomB) 
          : roomB.localeCompare(roomA);
      }
      
      // Convert values to the appropriate type for comparison
      let valueA = a[field] || ''; // Use empty string as fallback
      let valueB = b[field] || ''; // Use empty string as fallback
      
      // Handle different data types
      if (field === 'id' || field === 'product_id') {
        valueA = parseInt(valueA, 10) || 0;
        valueB = parseInt(valueB, 10) || 0;
        return direction === 'asc' ? valueA - valueB : valueB - valueA;
      } else if (field === 'timestamp' || field === 'created_at') {
        // Date comparison
        const dateA = new Date(valueA || 0);
        const dateB = new Date(valueB || 0);
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        // String comparison
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        } else {
          // Convert to string if not already
          valueA = String(valueA).toLowerCase();
          valueB = String(valueB).toLowerCase();
        }
        
        return direction === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
    });
    
    setFilteredEntries(sortedEntries);
  };
  
  // Get the sort icon for a field
  const getSortIcon = (field) => {
    if (sortField !== field) return <FontAwesomeIcon icon={faSort} className="text-muted" />;
    if (sortDirection === 'asc') return <FontAwesomeIcon icon={faSortUp} style={{ color: ZENV_COLORS.primary }} />;
    return <FontAwesomeIcon icon={faSortDown} style={{ color: ZENV_COLORS.primary }} />;
  };
  
  // Handle export to CSV
  const handleExport = () => {
    if (!filteredEntries.length) return;
    
    // Headers excluding Actions
    const headers = ['ID', 'UID', 'Timestamp', 'Room ID', 'Status'];
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(',') + "\r\n";
    
    // Add rows
    filteredEntries.forEach(entry => {
      const rowData = [
        entry.id,
        entry.uid,
        entry.timestamp,
        roomMapping[entry.product_id] || 'Not Assigned',
        entry.access_status
      ];
      
      // Escape commas with quotes
      const formattedRowData = rowData.map(cell => {
        const content = cell.toString().trim();
        return content.includes(',') ? `"${content}"` : content;
      });
      
      csvContent += formattedRowData.join(',') + "\r\n";
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rfid_entries_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle viewing entry details
  const handleViewDetails = (entry) => {
    setSelectedEntry(entry);
    setShowModal(true);
  };
  
  // Render pagination items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = windowWidth < 576 ? 3 : (windowWidth < 768 ? 5 : 7);
    
    // Always show first page
    if (totalPages > 1) {
      items.push(
        <Pagination.Item 
          key={1} 
          active={1 === page}
          onClick={() => handlePageChange(1)}
        >
          {1}
        </Pagination.Item>
      );
    }
    
    // Show ellipsis if needed
    if (page > 3) {
      items.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
    }
    
    // Calculate range of pages to show
    let startPage = Math.max(2, page - Math.floor((maxVisiblePages - 2) / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3);
    
    // Adjust if we're at the ends
    if (endPage <= startPage) {
      // Very few pages
      startPage = 2;
      endPage = Math.min(totalPages - 1, startPage);
    } else if (endPage === totalPages - 1) {
      // Near the end
      startPage = Math.max(2, totalPages - maxVisiblePages + 2);
    }
    
    // Add the range of pages
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <Pagination.Item 
          key={i} 
          active={i === page}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </Pagination.Item>
      );
    }
    
    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      items.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
    }
    
    // Always show last page if more than one page
    if (totalPages > 1) {
      items.push(
        <Pagination.Item 
          key={totalPages} 
          active={totalPages === page}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }
    
    return items;
  };
  
  // Column header component with sort dropdown
  const SortableColumnHeader = ({ field, label }) => (
    <div className="d-flex align-items-center">
      <span className="column-label">{label}</span>
      <Dropdown className="ms-1">
        <Dropdown.Toggle variant="link" size="sm" className="p-0 shadow-none" id={`dropdown-${field}`}>
          {getSortIcon(field)}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => handleSort(field)}>
            <FontAwesomeIcon icon={faSortUp} className="me-2" /> Sort Ascending
          </Dropdown.Item>
          <Dropdown.Item onClick={() => { setSortDirection('desc'); handleSort(field); }}>
            <FontAwesomeIcon icon={faSortDown} className="me-2" /> Sort Descending
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );

  // Function to determine which columns to show based on screen width
  const getVisibleColumns = () => {
    if (windowWidth < 576) {
      // Mobile view - minimal columns
      return {
        id: true,
        uid: false,
        timestamp: true,
        product_id: false,
        room_id: true,
        access_status: true,
        created_at: false,
        actions: false
      };
    } else if (windowWidth < 992) {
      // Tablet view - more columns
      return {
        id: true,
        uid: true,
        timestamp: true,
        product_id: false,
        room_id: true,
        access_status: true,
        created_at: false,
        actions: false
      };
    } else {
      // Desktop view - all columns
      return {
        id: true,
        uid: true,
        timestamp: true,
        product_id: false,
        room_id: true,
        access_status: true,
        created_at: false,
        actions: false
      };
    }
  };

  const visibleColumns = getVisibleColumns();
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="fa-2x mb-3" style={{ color: ZENV_COLORS.primary }} />
          <h5 className="fw-normal text-muted">Loading RFID entries...</h5>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger rounded-3 shadow-sm d-flex align-items-center m-4">
        <FontAwesomeIcon icon={faExclamationTriangle} className="me-3 fa-lg" />
        <div>{error}</div>
      </div>
    );
  }
  
  return (
    <Container fluid className="px-md-4 py-4 bg-light">
      {/* Header Section */}
      <Row className="mb-4 align-items-center">
        <Col md={6} className="mb-3 mb-md-0">
          <h2 className="fw-bold mb-0" style={{ color: ZENV_COLORS.primary }}>RFID Entry Records</h2>
          <p className="text-muted mb-0">Monitor and manage RFID entry activities</p>
        </Col>
        <Col md={6}>
          <div className="d-flex justify-content-md-end">
            {/* You could add additional action buttons here */}
          </div>
        </Col>
      </Row>
      
      {/* RFID Entries Table Card */}
      <Card className="shadow-sm border-0 rounded-4 mb-4">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center border-0">

<Col md={6}>
  <div className="d-flex justify-content-md-end">
    <Button 
      variant="outline-primary" 
      id="refreshBtn"
      onClick={fetchEntries}
      className="d-flex align-items-center rounded-pill me-2"
      disabled={loading}
    >
      <FontAwesomeIcon 
        icon={loading ? faSpinner : faSync} 
        className={`${loading ? 'fa-spin' : ''} me-1`} 
      /> 
      <span className="d-none d-sm-inline">Refresh</span>
    </Button>
    {/* You could add additional action buttons here */}
  </div>
</Col>
          {/* <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faChartBar} className="me-2" />
            Entry Records
          </h6> */}
          <div className="d-flex flex-column flex-md-row gap-2">
            <InputGroup className="flex-grow-1">
              <FormControl
                id="searchInput"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyUp={handleSearchKeyUp}
                ref={searchInputRef}
                className="rounded-start border-end-0 shadow-sm border-0"
                style={{ backgroundColor: '#f9fafc' }}
              />
              <Button 
                variant="outline-primary" 
                id="searchButton"
                onClick={handleSearch}
                className="d-flex align-items-center justify-content-center"
                style={{ border: 'none', backgroundColor: '#f9fafc' }}
              >
                <FontAwesomeIcon icon={faSearch} style={{ color: ZENV_COLORS.primary }} />
              </Button>
            </InputGroup>
            
            <Button 
              variant="outline-primary" 
              id="exportBtn"
              onClick={handleExport}
              disabled={filteredEntries.length === 0}
              className="d-flex align-items-center rounded-pill"
              style={{ borderColor: ZENV_COLORS.primary, color: ZENV_COLORS.primary }}
            >
              <FontAwesomeIcon icon={faDownload} className="me-1" /> 
              <span className="d-none d-sm-inline">Export</span>
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover id="dataTable" className="mb-0 align-middle">
              <thead className="bg-light">
                <tr>
                  {visibleColumns.id && <th className="ps-3"><SortableColumnHeader field="id" label="ID" /></th>}
                  {visibleColumns.uid && <th><SortableColumnHeader field="uid" label="UID" /></th>}
                  {visibleColumns.timestamp && <th><SortableColumnHeader field="timestamp" label="Timestamp" /></th>}
                  {visibleColumns.room_id && <th><SortableColumnHeader field="room_id" label="Room ID" /></th>}
                  {visibleColumns.access_status && <th><SortableColumnHeader field="access_status" label="Status" /></th>}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length > 0 ? (
                  filteredEntries.map(entry => (
                    <tr key={entry.id} >
                      {visibleColumns.id && <td className="ps-3 fw-medium">{entry.id}</td>}
                      {visibleColumns.uid && <td>{entry.uid}</td>}
                      {/* {visibleColumns.timestamp && <td>{entry.timestamp}</td>} */}
                       {visibleColumns.timestamp && (
                        <td>
                          {entry.timestamp ? entry.timestamp.replace('T', ' ') : ''}
                        </td>
                      )} 
                                             
                      {visibleColumns.room_id && (
                        <td>
                          {roomMapping[entry.product_id] || 
                            <Badge pill className="text-wrap px-2 py-1" style={{ backgroundColor: '#f0f0f0' }}>
                              Not Assigned
                            </Badge>
                          }
                        </td>
                      )}
                      


                        {/* {visibleColumns.access_status && (
                        <td>
                          {entry.access_status.includes('Granted') ? (
                            <Badge pill className="access-granted text-wrap px-3 py-2">
                              {entry.access_status}
                            </Badge>
                          ) : (
                            <Badge pill className="access-denied text-wrap px-3 py-2">
                              {entry.access_status}
                            </Badge>
                          )}
                        </td>
                      )} */}

               
{visibleColumns.access_status && (
  <td>
    {(() => {
      const statusLower = entry.access_status.toLowerCase();
      // Check for positive status indicators
      const isPositive = 
        statusLower.includes('granted') || 
        statusLower.includes('new') || 
        statusLower.includes('stored') || 
        statusLower.includes('reactivated');
      // Check for negative status indicators
      const isNegative = 
        statusLower.includes('denied') || 
        statusLower.includes('deleted');
      
      if (isPositive) {
        // Green badge for positive statuses
        return (
          <Badge pill className="access-granted text-wrap px-3 py-2">
            {entry.access_status}
          </Badge>
        );
      } else if (isNegative) {
        // Yellow badge for negative statuses
        return (
          <Badge pill className="access-denied text-wrap px-3 py-2">
            {entry.access_status}
          </Badge>
        );
      } else {
        // Gray badge for unknown/other statuses
        return (
          <Badge pill className="access-unknown text-wrap px-3 py-2" 
                 style={{ backgroundColor: ZENV_COLORS.mediumGray, color: 'white' }}>
            {entry.access_status}
          </Badge>
        );
      }
    })()}
  </td>
)}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-4">No entries found</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        <Card.Footer className="py-2 bg-white border-0">
          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">
              Showing {filteredEntries.length} of {entries.length} entries
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination size={windowWidth < 768 ? "sm" : ""} className="mb-0">
                <Pagination.Prev 
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                />
                {renderPaginationItems()}
                <Pagination.Next 
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                />
              </Pagination>
            )}
          </div>
        </Card.Footer>
      </Card>

      {/* Details Modal */}
      <Modal 
        show={showModal} 
        onHide={() => setShowModal(false)}
        aria-labelledby="detailsModalLabel"
        size={windowWidth < 576 ? "sm" : "lg"}
        centered
      >
        <Modal.Header closeButton className="border-0">
          <Modal.Title id="detailsModalLabel" style={{ color: ZENV_COLORS.primary }}>RFID Entry Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEntry && (
            <div className="details-content">
              <Card className="mb-3 border-0 shadow-sm rounded-4">
                <Card.Body>
                  <Row className="mb-3">
                    <Col md={3} className="fw-bold text-muted">ID:</Col>
                    <Col md={9}>{selectedEntry.id}</Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={3} className="fw-bold text-muted">UID:</Col>
                    <Col md={9}>{selectedEntry.uid}</Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={3} className="fw-bold text-muted">Timestamp:</Col>
                    <Col md={9}>{selectedEntry.timestamp}</Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={3} className="fw-bold text-muted">Room ID:</Col>
                    <Col md={9}>{roomMapping[selectedEntry.product_id] || 'Not Assigned'}</Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={3} className="fw-bold text-muted">Status:</Col>
                    <Col md={9}>
                      {selectedEntry.access_status.includes('Granted') ? (
                        <Badge pill className="access-granted text-wrap px-3 py-2">
                          {selectedEntry.access_status}
                        </Badge>
                      ) : (
                        <Badge pill className="access-denied text-wrap px-3 py-2">
                          {selectedEntry.access_status}
                        </Badge>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button 
            variant="secondary" 
            onClick={() => setShowModal(false)} 
            className="rounded-pill px-4"
            style={{ backgroundColor: ZENV_COLORS.primary, borderColor: ZENV_COLORS.primary }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Custom CSS for responsive table */}
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

        .access-granted {
          background-color: ${ZENV_COLORS.green} !important;
          color: white !important;
        }

        .access-denied {
          background-color: ${ZENV_COLORS.orange} !important;
          color: white !important;
        }
        
        /* Text styling */
        .text-xs {
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        
        .fw-medium {
          font-weight: 500;
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
        
        /* Badge styling */
        .badge.rounded-pill {
          font-weight: 500;
          font-size: 0.75rem;
        }
        
        /* Custom responsive styles */
        @media (max-width: 991.98px) {
          .column-label {
            font-size: 0.9rem;
          }
        }

        @media (max-width: 767.98px) {
          .card-header h6 {
            font-size: 1rem;
          }
          
          .h3 {
            font-size: 1.35rem;
          }
        }
        
        @media (max-width: 575.98px) {
          .column-label {
            font-size: 0.8rem;
          }
          
          .card-header h6 {
            font-size: 0.95rem;
          }
          
          /* Column-specific styling for small screens */
          .th-id, .td-id {
            max-width: 60px;
            min-width: 40px;
          }
          
          .th-timestamp, .td-timestamp {
            max-width: 120px;
            min-width: 90px;
          }
          
          .th-status, .td-status {
            max-width: 100px;
            min-width: 80px;
          }
          
          .table-responsive {
            border: 0;
            padding: 0;
          }
          
          .table td, .table th {
            padding: 0.5rem 0.25rem;
          }
        }
        
        /* Ensure table is always scrollable horizontally */
        .table-responsive {
          min-height: 300px;
        }
        
        /* Add wrapping for badges */
        .badge {
          white-space: normal;
          text-align: left;
          font-weight: 500;
        }
        
        /* Fix dropdown position */
        .dropdown-menu {
          min-width: 180px;
        }

        /* Gap for stacked search controls */
        .gap-2 {
          gap: 0.5rem;
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
        
        /* Pagination styling */
        .pagination .page-link {
          color: ${ZENV_COLORS.primary};
          border-color: #e0e0e0;
        }
        
        .pagination .page-item.active .page-link {
          background-color: ${ZENV_COLORS.lightBlue};
          border-color: ${ZENV_COLORS.primary};
        }
        
        /* Rounded-4 utility */
        .rounded-4 {
          border-radius: 0.75rem !important;
        }

        /* Table hover effect */
        .table tr:hover {
          background-color: ${ZENV_COLORS.lightBlue};
        }

        .refresh-btn {
          transition: all 0.3s ease;
        }

        .refresh-btn:active {
          transform: rotate(180deg);
        }

        .refresh-success {
          animation: pulse-success 1s;
        }

        .access-unknown {
          background-color: ${ZENV_COLORS.mediumGray} !important;
          color: white !important;
        }

        @keyframes pulse-success {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </Container>
  );
};

export default RfidEntries;