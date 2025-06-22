import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faExclamationTriangle, 
  faCheckCircle, 
  faSpinner,
  faUserTie,
  faIdCard,
  faCreditCard,
  faEdit,
  faTrash,
  faSave,
  faTimes,
  faUserPlus,
  faSearch,
  faDownload,
  faSync,
  faUserCog,
  faUsers
} from '@fortawesome/free-solid-svg-icons';
import { Container, Row, Col, Card, Button, Alert, Table, Badge } from 'react-bootstrap';
import api from '../services/api';
import axios from 'axios';

// ZenV brand colors - same as GuestRegistration
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

const ManagementRegistration = () => {
  // State management
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [managers, setManagers] = useState([]);
  const [editingManagerId, setEditingManagerId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshingManagers, setRefreshingManagers] = useState(false);
  const [accessStatusMap, setAccessStatusMap] = useState({});
  // Available service and master cards
  const [availableCards, setAvailableCards] = useState([]);
  const [cardsByType, setCardsByType] = useState({});
  const [filteredCards, setFilteredCards] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  


// Update the initial state of managerForm to use "manager" as default role
const [managerForm, setManagerForm] = useState({
  managerId: '',
  name: '',
  role: 'manager', // Default to 'manager'
  cardUiId: ''
});


  // Handle window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear alerts after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);


  
  // Initial data fetch
  useEffect(() => {
    fetchManagers();
    fetchAvailableCards();
  }, []);

  useEffect(() => {
  if (managers.length > 0) {
    fetchAvailableCards();
  }
}, [managers]);

  const handleRefreshManagers = () => {
    setRefreshingManagers(true);
    fetchManagers().finally(() => {
      setRefreshingManagers(false);
    });
  };

  // When component loads, set the filtered cards based on default role
useEffect(() => {
  if (Object.keys(cardsByType).length > 0) {
    // Default role is 'manager', so show Master Cards
    setFilteredCards(cardsByType['Master Card'] || []);
  }
}, [cardsByType]);

  const handleExportManagers = () => {
    const headers = ['Manager ID', 'Name', 'Role', 'Card ID'];
    
    let csvContent = headers.join(',') + '\n';
    
    filteredManagers.forEach(manager => {
      const row = [
        manager.managerId,
        `"${manager.name.replace(/"/g, '""')}"`,
        manager.role,
        manager.cardUiId

      ];
      csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'management_staff.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchManagers = async () => {
    try {
      setLoading(true);
      // Assuming you have a getManagers API endpoint or similar
      const response = await api.getManagers();
      setManagers(response.data.managers || []);
    } catch (err) {
      console.error('Error fetching managers:', err);
      setError('Failed to load managers: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };



// Modify the fetchAvailableCards function to filter out already assigned cards
const fetchAvailableCards = async () => {
  try {
    setLoadingOptions(true);
    setError('');
    
    // Always fetch fresh card data from the server
    const response = await api.getCardPackages();
    
    // Get all assigned cards from current managers (except for the one being edited)
    const assignedCards = managers
      .filter(manager => manager.id !== editingManagerId)
      .map(manager => manager.cardUiId);
    
    if (response?.data?.packages) {
      console.log("Fetched card packages:", response.data.packages);
      
      // Group cards by package type and remove duplicates
      const cardsByTypeMap = {};
      const uniqueCardsByType = {};
      
      // Process all packages to get the latest package types
      response.data.packages.forEach(pkg => {
        const packageType = pkg.package_type;
        const uid = pkg.uid;
        
        // Skip cards that are already assigned to managers
        if (assignedCards.includes(uid)) {
          return;
        }
        
        // Include the card currently being edited
        if (editingManagerId && managerForm.cardUiId === uid) {
          // Initialize arrays if needed
          if (!cardsByTypeMap[packageType]) {
            cardsByTypeMap[packageType] = new Set();
            uniqueCardsByType[packageType] = [];
          }
          
          // Only add if this UID hasn't been seen for this package type
          if (!cardsByTypeMap[packageType].has(uid)) {
            cardsByTypeMap[packageType].add(uid);
            uniqueCardsByType[packageType].push(uid);
          }
          return;
        }
        
        // Initialize arrays if needed
        if (!cardsByTypeMap[packageType]) {
          cardsByTypeMap[packageType] = new Set();
          uniqueCardsByType[packageType] = [];
        }
        
        // Only add if this UID hasn't been seen for this package type
        if (!cardsByTypeMap[packageType].has(uid)) {
          cardsByTypeMap[packageType].add(uid);
          uniqueCardsByType[packageType].push(uid);
        }
      });
      
      // Store the unique cards by type
      setCardsByType(uniqueCardsByType);
      
      // Get all unique card UIDs
      const allUniqueCards = [...new Set(response.data.packages
        .filter(pkg => !assignedCards.includes(pkg.uid) || (editingManagerId && managerForm.cardUiId === pkg.uid))
        .map(pkg => pkg.uid))];
      
      setAvailableCards(allUniqueCards);
      
      // Apply current role-based filtering
      if (managerForm.role === 'manager') {
        setFilteredCards(uniqueCardsByType['Master Card'] || []);
      } else if (managerForm.role === 'servicer') {
        setFilteredCards(uniqueCardsByType['Service Card'] || []);
      }
    }
  } catch (err) {
    console.error('Error fetching available cards:', err);
    setError('Failed to load cards: ' + (err.response?.data?.error || err.message));
  } finally {
    setLoadingOptions(false);
  }
};




const handleInputChange = (e) => {
  const { name, value } = e.target;

  if (name === 'role') {
    setManagerForm({
      ...managerForm,
      [name]: value,
      cardUiId: '' // Reset card selection when role changes
    });
    
    // Filter cards based on the newly selected role
    if (value === 'manager') {
      setFilteredCards(cardsByType['Master Card'] || []);
    } else if (value === 'servicer') {
      setFilteredCards(cardsByType['Service Card'] || []);
    }
  } else {
    setManagerForm({
      ...managerForm,
      [name]: value
    });
  }
};


// Update the resetForm function to use "manager" as default role
const resetForm = () => {
  setManagerForm({
    managerId: '',
    name: '',
    role: 'manager',
    cardUiId: ''
  });
  setEditingManagerId(null);
  
  // When resetting, show Master Cards since default role is manager
  setFilteredCards(cardsByType['Master Card'] || []);
};





const startEdit = (manager) => {
  setManagerForm({
    ...manager
  });
  setEditingManagerId(manager.id);

  // Fetch fresh card data when starting to edit
  fetchAvailableCards().then(() => {
    // Filter cards based on manager's role after cards are fetched
    if (manager.role === 'manager') {
      setFilteredCards(cardsByType['Master Card'] || []);
    } else if (manager.role === 'servicer') {
      setFilteredCards(cardsByType['Service Card'] || []);
    }
  });
};

  const cancelEdit = () => {
    resetForm();
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { managerId, name, role, cardUiId } = managerForm;
    
    if (!managerId || !name || !role || !cardUiId) {
      return setError('Please fill in all required fields');
    }
  
    setIsSubmitting(true);
    try {
      const data = { ...managerForm };
      
      const res = editingManagerId ? 
        await api.updateManager(editingManagerId, data) : 
        await api.registerManager(data);
        
      setSuccess(editingManagerId ? 'Manager information updated successfully!' : 'Manager registered successfully!');
      fetchManagers();
      resetForm();
    } catch (err) {
      setError('Failed to process manager: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };
    
  const handleDeleteManager = async (managerId) => {
    if (!window.confirm('Are you sure you want to delete this manager?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await api.deleteManager(managerId);
      
      setSuccess('Manager deleted successfully!');
      fetchManagers();
    } catch (err) {
      console.error('Error deleting manager:', err);
      setError('Failed to delete manager: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const resetError = () => {
    if (error) {
      setError(null);
    }
  };

  // Filtered managers based on search term
  const filteredManagers = managers.filter(manager => 
    manager.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    manager.managerId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    manager.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    manager.cardUiId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container-fluid px-md-4 py-4" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Header Section */}
      <div className="row mb-4 align-items-center">
        <div className="col-md-6 mb-3 mb-md-0">
          <h2 className="fw-bold mb-0" style={{ color: ZENV_COLORS.primary }}>
            Management Registration
          </h2>
          <p className="text-muted mb-0">Register and manage staff with special access privileges</p>
        </div>
        <div className="col-md-6">
          <div className="d-flex justify-content-md-end">
            <div className="position-relative me-2" style={{ width: '250px' }}>
              <input 
                type="text" 
                className="form-control form-control-sm rounded-pill pe-5 border-0"
                placeholder="Search managers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
              />
              <span className="position-absolute" style={{ right: '15px', top: '7px' }}>
                <FontAwesomeIcon icon={faSearch} className="text-muted" />
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Alert Messages */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center rounded-3 mb-4 shadow-sm">
          <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" /> {error}
          <button type="button" className="btn-close ms-auto" onClick={() => setError(null)}></button>
        </div>
      )}
      
      {success && (
        <div className="alert alert-success d-flex align-items-center rounded-3 mb-4 shadow-sm">
          <FontAwesomeIcon icon={faCheckCircle} className="me-2" /> {success}
          <button type="button" className="btn-close ms-auto" onClick={() => setSuccess(null)}></button>
        </div>
      )}
      
      
      
      {/* Manager Registration Form Card */}
      <div className="card shadow-sm mb-4 border-0 rounded-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-0">
          <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faUserPlus} className="me-2" /> 
            {editingManagerId ? 'Edit Staff Information' : 'Register New Staff'}
          </h6>
          {editingManagerId && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              onClick={cancelEdit}
            >
              <FontAwesomeIcon icon={faTimes} className="me-1" />
              Cancel Editing
            </button>
          )}
        </div>
        <div className="card-body p-4">
          <form onSubmit={handleSubmit} onChange={resetError}>
            <div className="row g-3 mb-4">
              {/* First row */}
              <div className="col-md-6">
                <label htmlFor="managerId" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faIdCard} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Staff ID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg rounded-3 shadow-sm border-0"
                  id="managerId"
                  name="managerId"
                  value={managerForm.managerId}
                  onChange={handleInputChange}
                  placeholder="Enter staff ID"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="name" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faUserTie} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg rounded-3 shadow-sm border-0"
                  id="name"
                  name="name"
                  value={managerForm.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              {/* Second row */}
              <div className="col-md-6">


                    <label htmlFor="role" className="form-label fw-medium">
                    <FontAwesomeIcon icon={faUserCog} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                    Role <span className="text-danger">*</span>
                    </label>
                    <select
                    className="form-select form-select-lg rounded-3 shadow-sm border-0"
                    id="role"
                    name="role"
                    value={managerForm.role}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    >
                    <option value="manager">Manager</option>
                    <option value="servicer">Servicer</option>
                    </select>


              </div>

              <div className="col-md-6">




<label htmlFor="cardUiId" className="form-label fw-medium">
  <FontAwesomeIcon icon={faCreditCard} className="me-2" style={{ color: ZENV_COLORS.primary }} />
  {managerForm.role === 'manager' ? 'Master Card' : 'Service Card'} <span className="text-danger">*</span>
</label>
<select
  className="form-select form-select-lg rounded-3 shadow-sm border-0"
  id="cardUiId"
  name="cardUiId"
  value={managerForm.cardUiId}
  onChange={handleInputChange}
  required
  disabled={isSubmitting || loadingOptions}
>
  <option value="">{loadingOptions 
    ? 'Loading cards...' 
    : filteredCards.length > 0 
      ? `Select ${managerForm.role === 'manager' ? 'Master' : 'Service'} Card` 
      : `No ${managerForm.role === 'manager' ? 'Master' : 'Service'} cards available`}
  </option>
  {filteredCards.map((cardId, index) => (
    <option key={index} value={cardId}>{cardId}</option>
  ))}
</select>


              </div>
              


            </div>
            
            {/* Form Buttons */}
            <div className="d-flex justify-content-end gap-2">
              {editingManagerId ? (
                <button
                  type="submit"
                  className="btn btn-lg px-4 rounded-pill"
                  style={{ backgroundColor: ZENV_COLORS.green, color: 'white' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="me-1" /> 
                      Saving...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faSave} className="me-1" /> 
                      Update Staff
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-lg px-4 rounded-pill"
                  style={{ backgroundColor: ZENV_COLORS.primary, color: 'white' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="me-1" /> 
                      Registering...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPlus} className="me-1" /> 
                      Register Staff
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      
      {/* Managers List Card */}
      <div className="card shadow-sm border-0 rounded-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-0">
          <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faUsers} className="me-2" /> 
            Registered Staff
          </h6>
          <div className="small text-muted">
            Showing {filteredManagers.length} of {managers.length} staff members
          </div>
          <div className="d-flex gap-2">
            <Button 
              variant="outline-secondary"
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleRefreshManagers}
              disabled={refreshingManagers}
              className="d-flex align-items-center rounded-pill"
            >
              <FontAwesomeIcon icon={faSync} spin={refreshingManagers} className="me-1" /> 
              <span className="d-none d-sm-inline">{refreshingManagers ? 'Refreshing...' : 'Refresh'}</span>
            </Button>

            <Button 
              variant="outline-primary" 
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleExportManagers}
              className="d-flex align-items-center rounded-pill"
              style={{ borderColor: ZENV_COLORS.primary, color: ZENV_COLORS.primary }}
            >
              <FontAwesomeIcon icon={faDownload} className="me-1" /> 
              <span className="d-none d-sm-inline">Export</span>
            </Button>
          </div>
        </div>
        <div className="card-body p-0">
          {refreshingManagers && (
            <div className="text-center py-3">
              <FontAwesomeIcon icon={faSync} spin className="me-2" style={{ color: ZENV_COLORS.primary }} /> 
              <span className="text-muted fw-medium">Refreshing data...</span>
            </div>
          )}
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead style={{ backgroundColor: ZENV_COLORS.lightGray }}>
                <tr>
                  <th className="ps-3">Staff ID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th className="d-none d-md-table-cell">Card ID</th>
                  <th className="text-center pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      <FontAwesomeIcon icon={faSpinner} spin className="me-2" style={{ color: ZENV_COLORS.primary }} /> 
                      Loading staff...
                    </td>
                  </tr>
                ) : filteredManagers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      {managers.length > 0 ? 'No matching staff found' : 'No staff registered yet'}
                    </td>
                  </tr>
                ) : (

// Replace the table rows with this corrected version
            filteredManagers.map((manager) => (
              <tr key={manager.id}>
                <td className="ps-3 fw-medium" style={{ color: ZENV_COLORS.primary }}>
                  {manager.managerId}
                </td>
                <td>{manager.name}</td>
                <td>
                  <span className="badge rounded-pill px-3 py-2" 
                    style={{ 
                      backgroundColor: manager.role === 'manager' ? 
                        ZENV_COLORS.lightPurple : ZENV_COLORS.lightBlue,
                      color: manager.role === 'manager' ? 
                        ZENV_COLORS.purple : ZENV_COLORS.primary 
                    }}>
                    {manager.role === 'manager' ? 'Manager' : 'Servicer'}
                  </span>
                </td>
                <td className="d-none d-md-table-cell">
                  {manager.cardUiId}
                </td>
                <td className="text-center pe-3">
                  <button
                    className="btn btn-sm rounded-pill px-3 me-2"
                    style={{ backgroundColor: ZENV_COLORS.lightBlue, color: ZENV_COLORS.primary }}
                    onClick={() => startEdit(manager)}
                    disabled={isSubmitting || editingManagerId === manager.id}
                  >
                    <FontAwesomeIcon icon={faEdit} className="me-1" /> Edit
                  </button>
                  <button
                    className="btn btn-sm rounded-pill px-3"
                    style={{ backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}
                    onClick={() => handleDeleteManager(manager.id)}
                    disabled={isSubmitting || editingManagerId === manager.id}
                  >
                    <FontAwesomeIcon icon={faTrash} className="me-1" /> Delete
                  </button>
                </td>
              </tr>
            ))


                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Custom styling for improved appearance - same as GuestRegistration */}
      <style jsx="true">{`
        /* Modern card styling */
        .card {
          border-radius: 0.75rem;
          overflow: hidden;
          background-color: #ffffff;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        },
          .col-xl-20percent {
          @media (min-width: 1200px) {
            flex: 0 0 20%;
            max-width: 20%;
          }
        },

        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08) !important;
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
        
        /* Form control styling */
        .form-control, .form-select {
          border: 1px solid rgba(229, 231, 235, 0.8);
        }
        
        .form-control:focus, .form-select:focus {
          box-shadow: 0 0 0 0.25rem ${ZENV_COLORS.lightBlue};
          border-color: ${ZENV_COLORS.primary};
        }
        
        /* Button hover effects */
        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        /* Pill button styling */
        .rounded-pill {
          padding-left: 1.25rem;
          padding-right: 1.25rem;
        }
        
        /* Rounded style */
        .rounded-4 {
          border-radius: 0.75rem !important;
        }
      `}</style>
    </div>
  );
};

export default ManagementRegistration;