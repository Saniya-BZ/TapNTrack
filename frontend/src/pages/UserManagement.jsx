import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Badge, Modal} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faTrash, 
  faExclamationTriangle, 
  faCheckCircle,
  faUserShield,
  faSpinner,
  faUserTie,
  faUserCog,
  faUserEdit,
  faUsers,
  faPencilAlt,
  faHistory,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api'; 

// Using existing ZenV brand colors
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
  
  // Additional theme colors
  lightGreen: 'rgba(177, 208, 7, 0.1)',
  lightBlue: 'rgba(42, 110, 187, 0.1)',
  lightTeal: 'rgba(51, 179, 166, 0.1)',
  darkTeal: 'rgba(23, 178, 163, 0.1)',
};

// ZenV brand fonts
const ZENV_FONTS = {
  heading: "'Lato', sans-serif",
  body: "'Lato', sans-serif"
};

const UserManagement = () => {
  // State for user data
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

  

  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // State for showing history
  const [userHistory, setUserHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);


  const [allActivityHistory, setAllActivityHistory] = useState([]);
  const [loadingAllHistory, setLoadingAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(10);


  

  // State for user statistics
  const [userCounts, setUserCounts] = useState({
    super_admin: 0,
    admin: 0,
    manager: 0,
    clerk: 0
  });
  
  // State for new user form
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'clerk' // Default role
  });
  
  // State for form visibility
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
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
  
  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // Calculate user counts
  useEffect(() => {
    if (users.length > 0) {
      calculateUserCounts();
    }
  }, [users]);
  
  // Calculate user counts by role
  const calculateUserCounts = () => {
    const counts = {
      super_admin: 0,
      admin: 0,
      manager: 0,
      clerk: 0
    };
    
    users.forEach(user => {
      if (counts[user.role] !== undefined) {
        counts[user.role]++;
      }
    });
    
    setUserCounts(counts);
  };
  
  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Use API service
      const response = await api.getUsers();
      
      setUsers(response.data.users || []);
      
      // Set the current user's role
      if (response.data.currentUserRole) {
        setCurrentUserRole(response.data.currentUserRole);
      }
      
      // Set the current user's email
      if (response.data.currentUserEmail) {
        setCurrentUserEmail(response.data.currentUserEmail);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  







  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser({
      ...newUser,
      [name]: value
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!newUser.email || !newUser.password) {
      setError('Please fill in all fields');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Use API service
      const response = await api.addUser(newUser);
      
      // Reset form
      setNewUser({
        email: '',
        password: '',
        role: 'clerk' // Reset to clerk (default)
      });
      
      setShowForm(false);
      setSuccess('User added successfully!');
      
      // Refresh user list
      fetchUsers();
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Failed to add user: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle user deletion
  const handleDeleteUser = async (userId, userRole) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Use API service
      const response = await api.deleteUser(userId);
      
      setSuccess('User deleted successfully!');
      
      // Refresh user list
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };
  
  // Reset error message when user interacts with form
  const resetError = () => {
    if (error) {
      setError(null);
    }
  };
  
  // Determine which roles the current user can add
  const getAvailableRolesToAdd = () => {
    switch (currentUserRole) {
      case 'super_admin':
        return ['super_admin', 'admin', 'manager', 'clerk'];
      case 'admin':
        return ['manager', 'clerk'];
      case 'manager':
        return ['clerk'];
      default:
        return [];
    }
  };




  useEffect(() => {
  fetchAllActivityHistory();
}, [historyPage]);

  const fetchAllActivityHistory = async () => {
    try {
      setLoadingAllHistory(true);
      const response = await api.getAllActivityHistory(historyPage, historyPageSize);
      setAllActivityHistory(response.data.activity || []);
    } catch (err) {
      console.error('Error fetching activity history:', err);
      setError('Failed to fetch activity history: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingAllHistory(false);
    }
  };

  // Add this function to handle pagination
  const handleHistoryPageChange = (pageNumber) => {
    setHistoryPage(pageNumber);
  };













// Add this render function for the Activity History Card
const renderActivityHistoryCard = () => {
  const totalPages = Math.ceil(allActivityHistory.totalCount / historyPageSize) || 1;
  
  return (
    <Card className="shadow-sm mb-4 border-0 rounded-4 overflow-hidden">


      <Card.Header className="py-4 px-4 bg-white border-bottom border-light" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <h5 className="m-0 fw-bold d-flex align-items-center" style={{color: ZENV_COLORS.primary}}>
            <FontAwesomeIcon icon={faHistory} className="me-2" /> Activity History
          </h5>
        </div>
      </Card.Header>
      <Card.Body className="p-0 bg-white">
        <div className="table-responsive">
          <Table hover className="mb-0 align-middle">
            <thead>
              <tr style={{backgroundColor: ZENV_COLORS.lightGray}}>
                <th className="ps-4 py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
                  USER
                </th>
                <th className="py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
                  ACTION
                </th>
                <th className="py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
                  PREVIOUS VALUE
                </th>
                <th className="py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
                  NEW VALUE
                </th>
                <th className="py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
                  CHANGED BY
                </th>
                <th className="text-end pe-4 py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
                  DATE & TIME
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingAllHistory ? (
                <tr>
                  <td colSpan="6" className="text-center py-5">
                    <FontAwesomeIcon icon={faSpinner} spin className="me-2" style={{color: ZENV_COLORS.primary}} /> 
                    <span style={{color: ZENV_COLORS.mediumGray}}>Loading activity history...</span>
                  </td>
                </tr>
              ) : allActivityHistory.records && allActivityHistory.records.length > 0 ? (
                allActivityHistory.records.map((record, index) => (
                  <tr key={`activity-${record.id || index}`}>
                    <td className="ps-4 py-3 fw-medium" style={{color: ZENV_COLORS.darkGray}}>
                      {record.user_email}
                    </td>
                    <td className="py-3">
                      <Badge 
                        bg={record.change_type === 'role_change' ? 'primary' : 
                          record.change_type === 'created' ? 'success' : 
                          record.change_type === 'deleted' ? 'danger' : 'info'} 
                        className="px-3 py-2"
                      >
                        {formatHistoryChangeType(record.change_type)}
                      </Badge>
                    </td>
                    <td className="py-3" style={{color: ZENV_COLORS.mediumGray}}>
                      {record.previous_value || '-'}
                    </td>
                    <td className="py-3" style={{color: ZENV_COLORS.mediumGray}}>
                      {record.new_value || '-'}
                    </td>
                    <td className="py-3" style={{color: ZENV_COLORS.mediumGray}}>
                      {record.changed_by_email}
                    </td>
                    <td className="text-end pe-4 py-3" style={{color: ZENV_COLORS.mediumGray, fontSize: '0.9rem'}}>
                      {new Date(record.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-5" style={{color: ZENV_COLORS.mediumGray}}>
                    No activity history found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>
      <Card.Footer className="py-3 px-4 bg-white border-top border-light d-flex justify-content-between align-items-center" style={{borderColor: 'rgba(0,0,0,0.05)!important'}}>
        <div className="small" style={{color: ZENV_COLORS.mediumGray}}>
          Showing {allActivityHistory.records?.length || 0} of {allActivityHistory.totalCount || 0} records
        </div>
        {totalPages > 1 && (
          <div className="d-flex">
            <Button 
              variant="light" 
              size="sm" 
              className="me-2"
              disabled={historyPage === 1}
              onClick={() => handleHistoryPageChange(historyPage - 1)}
            >
              Previous
            </Button>
            <span className="mx-2 d-flex align-items-center" style={{color: ZENV_COLORS.mediumGray}}>
              Page {historyPage} of {totalPages}
            </span>
            <Button 
              variant="light" 
              size="sm" 
              className="ms-2"
              disabled={historyPage === totalPages}
              onClick={() => handleHistoryPageChange(historyPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card.Footer>
    </Card>
  );
};





  
  // Check if user can delete a specific role
  const canDeleteRole = (userRole, userEmail) => {
    // Don't allow super_admin to delete themselves
    if (currentUserRole === 'super_admin' && userEmail === currentUserEmail) {
      return false;
    }
    
    switch (currentUserRole) {
      case 'super_admin':
        return true; // Super admin can delete any role except themselves
      case 'admin':
        return userRole !== 'super_admin' && userRole !== 'admin'; // Admins can't delete super_admin or admin
      case 'manager':
        return userRole === 'clerk'; // Managers can only delete clerks
      default:
        return false; // Clerks can't delete anyone
    }
  };

  // Get role specific icon and color
  const getRoleIconAndColor = (role) => {
    switch (role) {
      case 'super_admin':
        return { 
          icon: faUserShield, 
          color: ZENV_COLORS.purple,
          bg: 'rgba(162, 36, 143, 0.1)' 
        };
      case 'admin':
        return { 
          icon: faUserTie, 
          color: ZENV_COLORS.primary,
          bg: 'rgba(42, 110, 187, 0.1)' 
        };
      case 'manager':
        return { 
          icon: faUserCog, 
          color: ZENV_COLORS.teal,
          bg: 'rgba(51, 179, 166, 0.1)' 
        };
      case 'clerk':
        return { 
          icon: faUserEdit, 
          color: ZENV_COLORS.green,
          bg: 'rgba(177, 208, 7, 0.1)' 
        };
      default:
        return { 
          icon: faUserEdit, 
          color: ZENV_COLORS.mediumGray,
          bg: 'rgba(108, 117, 125, 0.1)' 
        };
    }
  };



  // Check if user can edit a specific role
  // const canEditRole = (userRole) => {
  //   switch (currentUserRole) {
  //     case 'super_admin':
  //       return true; // Super admin can edit any role
  //     case 'admin':
  //       return userRole !== 'super_admin'; // Admins can't edit super_admin
  //     default:
  //       return false; // Others can't edit anyone
  //   }
  // };



  // Check if user can edit a specific role and the specific user
const canEditRole = (userRole, userEmail) => {
  // Don't allow admins to edit other admins or themselves to super_admin
  if (currentUserRole === 'admin' && userRole === 'admin') {
    return false;
  }
  
  switch (currentUserRole) {
    case 'super_admin':
      return true; // Super admin can edit any role
    case 'admin':
      return userRole !== 'super_admin'; // Admins can't edit super_admin
    default:
      return false; // Others can't edit anyone
  }
};
  
  // Handle opening the edit modal
  const handleEditUser = (user) => {
    setEditingUser({
      ...user,
      password: '' // Don't show existing password, will only update if new one is provided
    });
    setShowEditModal(true);
  };
  
  // Handle edit form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      // Create payload - only send password if provided
      const payload = {
        id: editingUser.id,
        email: editingUser.email,
        role: editingUser.role
      };
      
      if (editingUser.password) {
        payload.password = editingUser.password;
      }
      
      // Use API service
      const response = await api.updateUser(payload);
      
      setShowEditModal(false);
      setSuccess('User updated successfully!');
      
      // Refresh user list
      fetchUsers();
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle opening the history modal
  const handleViewHistory = async (userId, userEmail) => {
    setSelectedUserForHistory(userEmail);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    
    try {
      // Use API service
      const response = await api.getUserHistory(userId);
      setUserHistory(response.data.history || []);
    } catch (err) {
      console.error('Error fetching user history:', err);
      setError('Failed to fetch user history: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // Format the history change type for display
  const formatHistoryChangeType = (changeType) => {
    switch (changeType) {
      case 'role_change':
        return 'Role Change';
      case 'created':
        return 'User Created';
      case 'deleted':
        return 'User Deleted';
      case 'password_change':
        return 'Password Changed';
      default:
        return changeType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };







  // Edit User Modal
  const renderEditModal = () => {
    if (!editingUser) return null;
    
    return (
      <Modal 
        show={showEditModal} 
        onHide={() => setShowEditModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton style={{backgroundColor: ZENV_COLORS.lightGray}}>
          <Modal.Title style={{color: ZENV_COLORS.primary, fontFamily: ZENV_FONTS.heading}}>
            <FontAwesomeIcon icon={faPencilAlt} className="me-2" />
            Edit User
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEditSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-medium">Email Address</Form.Label>
              <Form.Control
                type="email"
                value={editingUser.email}
                onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                className="rounded-3 shadow-sm"
                disabled
              />
              <Form.Text className="text-muted">
                Email address cannot be changed
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className="fw-medium">New Password (optional)</Form.Label>
              <Form.Control
                type="password"
                placeholder="Leave blank to keep current password"
                value={editingUser.password || ''}
                onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                className="rounded-3 shadow-sm"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className="fw-medium">Role</Form.Label>
              <Form.Select
                value={editingUser.role}
                onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                className="rounded-3 shadow-sm"
              >
                {getAvailableRolesToAdd().map(role => (
                  <option key={role} value={role}>
                    {formatRoleDisplay(role)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="light" 
            onClick={() => setShowEditModal(false)}
            className="rounded-3"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleEditSubmit}
            className="rounded-3"
            disabled={isSubmitting}
            style={{
              backgroundColor: ZENV_COLORS.teal,
              borderColor: ZENV_COLORS.teal,
              fontWeight: 500,
              boxShadow: '0 2px 10px rgba(51, 179, 166, 0.2)'
            }}
          >
            {isSubmitting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Saving...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPencilAlt} className="me-2" /> Update User
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  // User History Modal
  const renderHistoryModal = () => {
    return (
      <Modal 
        show={showHistoryModal} 
        onHide={() => setShowHistoryModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton style={{backgroundColor: ZENV_COLORS.lightGray}}>
          <Modal.Title style={{color: ZENV_COLORS.primary, fontFamily: ZENV_FONTS.heading}}>
            <FontAwesomeIcon icon={faHistory} className="me-2" />
            User History: {selectedUserForHistory}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingHistory ? (
            <div className="text-center py-5">
              <FontAwesomeIcon icon={faSpinner} spin className="me-2 fa-2x mb-3" style={{color: ZENV_COLORS.primary}} />
              <h5 className="fw-normal" style={{color: ZENV_COLORS.mediumGray}}>Loading history...</h5>
            </div>
          ) : userHistory.length > 0 ? (
            <div className="table-responsive">
              <Table hover className="align-middle">
                <thead>
                  <tr style={{backgroundColor: ZENV_COLORS.lightGray}}>
                    <th style={{fontWeight: 600, fontSize: '0.85rem'}}>ACTION</th>
                    <th style={{fontWeight: 600, fontSize: '0.85rem'}}>PREVIOUS</th>
                    <th style={{fontWeight: 600, fontSize: '0.85rem'}}>NEW</th>
                    <th style={{fontWeight: 600, fontSize: '0.85rem'}}>CHANGED BY</th>
                    <th style={{fontWeight: 600, fontSize: '0.85rem'}}>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {userHistory.map((record, index) => (
                    <tr key={index}>
                      <td>
                        <Badge 
                          bg={record.change_type === 'role_change' ? 'primary' : 
                             record.change_type === 'created' ? 'success' : 
                             record.change_type === 'deleted' ? 'danger' : 'info'} 
                          className="px-3 py-2"
                        >
                          {formatHistoryChangeType(record.change_type)}
                        </Badge>
                      </td>
                      <td>{record.previous_value || '-'}</td>
                      <td>{record.new_value || '-'}</td>
                      <td>{record.changed_by_email}</td>
                      <td>{new Date(record.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-5" style={{color: ZENV_COLORS.mediumGray}}>
              No history records found for this user
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={() => setShowHistoryModal(false)} 
            className="rounded-3"
            style={{
              backgroundColor: ZENV_COLORS.primary,
              borderColor: ZENV_COLORS.primary,
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };







  // If clerk, display no access message
  if (currentUserRole === 'clerk') {
    return (
      <Container fluid className="px-4 py-5" style={{backgroundColor: ZENV_COLORS.lightGray}}>
        <Row className="mb-4">
          <Col>
            <h2 style={{fontFamily: ZENV_FONTS.heading, color: ZENV_COLORS.primary, fontWeight: 600}}>
              User Management
            </h2>
            <p style={{fontFamily: ZENV_FONTS.body, color: ZENV_COLORS.mediumGray}}>
              Manage system users and permissions
            </p>
          </Col>
        </Row>
        
        <Alert 
          variant="warning" 
          className="rounded-3 shadow-sm d-flex align-items-center"
          style={{backgroundColor: 'rgba(255, 208, 0, 0.1)', borderColor: ZENV_COLORS.orange}}
        >
          <FontAwesomeIcon icon={faExclamationTriangle} className="me-3 fa-lg" style={{color: ZENV_COLORS.orange}} />
          <div style={{fontFamily: ZENV_FONTS.body}}>Clerks do not have access to user management features.</div>
        </Alert>
      </Container>
    );
  }

  // For loading state
  if (loading && users.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh', fontFamily: ZENV_FONTS.body }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="fa-2x mb-3" style={{color: ZENV_COLORS.primary}} />
          <h5 className="fw-normal" style={{color: ZENV_COLORS.mediumGray}}>Loading user data...</h5>
        </div>
      </div>
    );
  }

  return (
    <Container fluid className="px-4 py-5" style={{backgroundColor: ZENV_COLORS.lightGray, fontFamily: ZENV_FONTS.body}}>
      {/* Header Section */}
      <Row className="mb-4">
        <Col>
          <h2 style={{fontFamily: ZENV_FONTS.heading, color: ZENV_COLORS.primary, fontWeight: 600}}>
            User Management
          </h2>
          <p style={{color: ZENV_COLORS.mediumGray}}>
            Manage system users and permissions
          </p>
        </Col>
      </Row>
      
      {/* Alert Messages */}
      {error && (
        <Alert 
          variant="danger" 
          className="rounded-3 shadow-sm d-flex align-items-center mb-4"
          style={{backgroundColor: 'rgba(220, 53, 69, 0.1)', borderColor: '#dc3545'}}
        >
          <FontAwesomeIcon icon={faExclamationTriangle} className="me-3 fa-lg" style={{color: '#dc3545'}} />
          <div>{error}</div>
        </Alert>
      )}
      
      {success && (
        <Alert 
          variant="success" 
          className="rounded-3 shadow-sm d-flex align-items-center mb-4"
          style={{backgroundColor: 'rgba(25, 135, 84, 0.1)', borderColor: '#198754'}}
        >
          <FontAwesomeIcon icon={faCheckCircle} className="me-3 fa-lg" style={{color: '#198754'}} />
          <div>{success}</div>
        </Alert>
      )}

{/* Role Statistics Cards - Reduced Size */}
<Row className="g-3 mb-4">
  {/* Super Admin Card */}
  {currentUserRole === 'super_admin' && (
    <Col xl={3} md={6}>
      <Card 
        className="h-100 border-0 rounded-3 shadow-sm role-stat-card" 
        style={{overflow: 'hidden'}}
      >
        <div style={{height: '4px'}} />
        <Card.Body className="p-3">
          <Row className="g-0 align-items-center">
            <Col>
              <div className="text-uppercase fs-6 fw-semibold mb-0" 
                style={{ letterSpacing: '0.5px', fontSize: '0.75rem', color: ZENV_COLORS.mediumGray }}>
                Super Admins
              </div>
              <div className="fw-bold fs-3 mb-0">
                {userCounts.super_admin}
              </div>
            </Col>
            <Col xs="auto">
              <div className="p-2 rounded-circle" style={{backgroundColor: 'rgba(162, 36, 143, 0.1)'}}>
                <FontAwesomeIcon icon={faUserShield} style={{color: ZENV_COLORS.purple}} />
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Col>
  )}
  
  {/* Admin Card */}
  {['super_admin'].includes(currentUserRole) && (
    <Col xl={3} md={6}>
      <Card 
        className="h-100 border-0 rounded-3 shadow-sm role-stat-card" 
        style={{overflow: 'hidden'}}
      >
        <div style={{height: '4px'}} />
        <Card.Body className="p-3">
          <Row className="g-0 align-items-center">
            <Col>
              <div className="text-uppercase fs-6 fw-semibold mb-0" 
                style={{ letterSpacing: '0.5px', fontSize: '0.75rem', color: ZENV_COLORS.mediumGray }}>
                Admins
              </div>
              <div className="fw-bold fs-3 mb-0">
                {userCounts.admin}
              </div>
            </Col>
            <Col xs="auto">
              <div className="p-2 rounded-circle" style={{backgroundColor: 'rgba(42, 110, 187, 0.1)'}}>
                <FontAwesomeIcon icon={faUserTie} style={{color: ZENV_COLORS.primary}} />
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Col>
  )}
  
  {/* Manager Card */}
  {['super_admin', 'admin'].includes(currentUserRole) && (
    <Col xl={3} md={6}>
      <Card 
        className="h-100 border-0 rounded-3 shadow-sm role-stat-card" 
        style={{overflow: 'hidden'}}
      >
        <div style={{height: '4px'}} />
        <Card.Body className="p-3">
          <Row className="g-0 align-items-center">
            <Col>
              <div className="text-uppercase fs-6 fw-semibold mb-0" 
                style={{ letterSpacing: '0.5px', fontSize: '0.75rem', color: ZENV_COLORS.mediumGray }}>
                Managers
              </div>
              <div className="fw-bold fs-3 mb-0">
                {userCounts.manager}
              </div>
            </Col>
            <Col xs="auto">
              <div className="p-2 rounded-circle" style={{backgroundColor: 'rgba(51, 179, 166, 0.1)'}}>
                <FontAwesomeIcon icon={faUserCog} style={{color: ZENV_COLORS.teal}} />
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Col>
  )}
  
  {/* Clerk Card */}
  {['super_admin', 'admin', 'manager'].includes(currentUserRole) && (
    <Col xl={3} md={6}>
      <Card 
        className="h-100 border-0 rounded-3 shadow-sm role-stat-card" 
        style={{overflow: 'hidden'}}
      >
        <div style={{height: '4px'}} />
        <Card.Body className="p-3">
          <Row className="g-0 align-items-center">
            <Col>
              <div className="text-uppercase fs-6 fw-semibold mb-0" 
                style={{ letterSpacing: '0.5px', fontSize: '0.75rem', color: ZENV_COLORS.mediumGray }}>
                Clerks
              </div>
              <div className="fw-bold fs-3 mb-0">
                {userCounts.clerk}
              </div>
            </Col>
            <Col xs="auto">
              <div className="p-2 rounded-circle" style={{backgroundColor: 'rgba(177, 208, 7, 0.1)'}}>
                <FontAwesomeIcon icon={faUserEdit} style={{color: ZENV_COLORS.green}} />
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Col>
  )}
</Row>


      
      {/* User Management Card */}
      <Card className="shadow-sm mb-4 border-0 rounded-4 overflow-hidden">
        <Card.Header className="py-4 px-4 bg-white border-bottom border-light" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <h5 className="m-0 fw-bold d-flex align-items-center" style={{color: ZENV_COLORS.primary}}>
              <FontAwesomeIcon icon={faUsers} className="me-2" /> System Users
            </h5>
            {!showForm && (
              <Button 
                className="px-4 py-2 rounded-3"
                style={{
                  backgroundColor: ZENV_COLORS.teal,
                  borderColor: ZENV_COLORS.teal,
                  fontWeight: 500,
                  boxShadow: '0 2px 10px rgba(51, 179, 166, 0.2)'
                }}
                onClick={() => setShowForm(true)}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faPlus} className="me-2" /> Add User
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Body className="p-0 bg-white">
          {/* Add User Form */}
          {showForm && (
            <div className="p-4" style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
              <div 
                className="rounded-4 p-4" 
                style={{backgroundColor: ZENV_COLORS.lightGray}}
              >
                <h6 className="fw-bold mb-4" style={{color: ZENV_COLORS.primary}}>Add New User</h6>
                <Form onSubmit={handleSubmit} onChange={resetError}>
                  <Row className="g-4">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-medium">Email Address</Form.Label>
                        <Form.Control
                          type="email" 
                          name="email" 
                          placeholder="user@example.com" 
                          value={newUser.email}
                          onChange={handleInputChange}
                          className="rounded-3 border-0 py-2 px-3 shadow-sm"
                          style={{backgroundColor: 'white'}}
                          required 
                          disabled={isSubmitting}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-medium">Password</Form.Label>
                        <Form.Control
                          type="password" 
                          name="password" 
                          placeholder="Password" 
                          value={newUser.password}
                          onChange={handleInputChange}
                          className="rounded-3 border-0 py-2 px-3 shadow-sm"
                          style={{backgroundColor: 'white'}}
                          required 
                          disabled={isSubmitting}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-medium">Role</Form.Label>
                        <Form.Select
                          name="role"
                          value={newUser.role}
                          onChange={handleInputChange}
                          className="rounded-3 border-0 py-2 px-3 shadow-sm"
                          style={{backgroundColor: 'white'}}
                          disabled={isSubmitting}
                        >
                          {getAvailableRolesToAdd().map(role => (
                            <option key={role} value={role}>
                              {formatRoleDisplay(role)}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="d-flex justify-content-end gap-3 mt-4">
                    <Button 
                      variant="light"
                      className="px-4 py-2 rounded-3"
                      onClick={() => {
                        setShowForm(false);
                        setNewUser({ email: '', password: '', role: 'clerk' });
                        setError(null);
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="px-4 py-2 rounded-3"
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        backgroundColor: ZENV_COLORS.green,
                        borderColor: ZENV_COLORS.green,
                        fontWeight: 500,
                        boxShadow: '0 2px 10px rgba(177, 208, 7, 0.2)'
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Saving...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faPlus} className="me-2" /> Add User
                        </>
                      )}
                    </Button>
                  </div>
                </Form>
              </div>
            </div>
          )}
          


{/* Users Table */}
<div className="table-responsive">
  <Table hover className="mb-0 align-middle">
    <thead>
      <tr style={{backgroundColor: ZENV_COLORS.lightGray}}>
        <th className="ps-4 py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
          EMAIL
        </th>
        <th className="py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
          ROLE
        </th>
        <th className="py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
          ADDED BY
        </th>
        <th className={`py-3 ${windowWidth < 576 ? 'd-none' : ''}`} style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
          CREATED AT
        </th>
        <th className="text-end pe-4 py-3" style={{color: ZENV_COLORS.darkGray, fontSize: '0.85rem', fontWeight: 600}}>
          ACTIONS
        </th>
      </tr>
    </thead>
    <tbody>
      {loading ? (
        <tr>
          <td colSpan={windowWidth < 576 ? "4" : "5"} className="text-center py-5">
            <FontAwesomeIcon icon={faSpinner} spin className="me-2" style={{color: ZENV_COLORS.primary}} /> 
            <span style={{color: ZENV_COLORS.mediumGray}}>Loading users...</span>
          </td>
        </tr>
      ) : users.length > 0 ? (
        users.map((user) => {
          const roleStyle = getRoleIconAndColor(user.role);
          return (
            <tr key={user.id}>
              <td className="ps-4 py-3 fw-medium" style={{color: ZENV_COLORS.darkGray}}>
                {user.email}
              </td>
              <td className="py-3">
                <div className="d-inline-flex align-items-center px-3 py-1 rounded-pill" 
                  style={{
                    backgroundColor: roleStyle.bg,
                    color: roleStyle.color,
                    fontSize: '0.85rem',
                    fontWeight: 500
                  }}
                >
                  <FontAwesomeIcon icon={roleStyle.icon} className="me-2" />
                  {formatRoleDisplay(user.role)}
                </div>
              </td>
              <td className="py-3" style={{color: ZENV_COLORS.mediumGray}}>
                {user.added_by_email || "-"}
              </td>
              <td className={`py-3 ${windowWidth < 576 ? 'd-none' : ''}`} style={{color: ZENV_COLORS.mediumGray, fontSize: '0.9rem'}}>
                {new Date(user.created_at).toLocaleString()}
              </td>
              <td className="text-end pe-4 py-3">
                <div className="d-flex justify-content-end gap-2">
                  {/* History button - always visible */}
                  {/* <Button
                    variant="outline-info"
                    size="sm"
                    onClick={() => handleViewHistory(user.id, user.email)}
                    className="rounded-pill px-3 py-1 border-0"
                    style={{
                      backgroundColor: 'rgba(13, 202, 240, 0.1)',
                      color: '#0dcaf0',
                      fontSize: '0.85rem'
                    }}
                  >
                    <FontAwesomeIcon icon={faHistory} className="me-1" /> History
                  </Button> */}
                
                  {/* Edit button - only for users who can edit */}
                  {/* {canEditRole(user.role) && (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                      className="rounded-pill px-3 py-1 border-0"
                      style={{
                        backgroundColor: 'rgba(42, 110, 187, 0.1)',
                        color: ZENV_COLORS.primary,
                        fontSize: '0.85rem'
                      }}
                    >
                      <FontAwesomeIcon icon={faPencilAlt} className="me-1" /> Edit
                    </Button>
                  )} */}

                    {canEditRole(user.role, user.email) && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        className="rounded-pill px-3 py-1 border-0"
                        style={{
                          backgroundColor: 'rgba(42, 110, 187, 0.1)',
                          color: ZENV_COLORS.primary,
                          fontSize: '0.85rem'
                        }}
                      >
                        <FontAwesomeIcon icon={faPencilAlt} className="me-1" /> Edit
                      </Button>
                    )}
                                      
                  {/* Delete button - only for users who can delete */}
                  {canDeleteRole(user.role, user.email) && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id, user.role)}
                      disabled={loading}
                      className="rounded-pill px-3 py-1 border-0"
                      style={{
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        color: '#dc3545',
                        fontSize: '0.85rem'
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} className="me-1" /> Delete
                    </Button>
                  )}

                  
                </div>
              </td>
            </tr>
          );
        })
      ) : (
        <tr>
          <td colSpan={windowWidth < 576 ? "4" : "5"} className="text-center py-5" style={{color: ZENV_COLORS.mediumGray}}>
            No users found
          </td>
        </tr>
      )}
    </tbody>
  </Table>
</div>




        </Card.Body>
        <Card.Footer className="py-3 px-4 bg-white border-top border-light" style={{borderColor: 'rgba(0,0,0,0.05)!important'}}>
          <div className="small" style={{color: ZENV_COLORS.mediumGray}}>
            Showing {users.length} users
          </div>
        </Card.Footer>
      </Card>

{renderEditModal()}
{renderHistoryModal()}
{renderActivityHistoryCard()}
{renderEditModal()}
{renderHistoryModal()}

      
      {/* Custom CSS styling */}
      <style jsx="true">{`
        /* Form control focus styles */
        .form-control:focus, .form-select:focus {
          border-color: ${ZENV_COLORS.teal};
          box-shadow: 0 0 0 0.2rem rgba(51, 179, 166, 0.25);
        }
        
        /* Custom button hover effect */
        .btn:hover {
          transform: translateY(-1px);
          transition: all 0.2s;
        }
        
        /* Table hover styling */
        .table tbody tr:hover {
          background-color: rgba(51, 179, 166, 0.03);
        }
        
        /* Custom table borders */
        .table tbody tr {
          border-bottom: 1px solid rgba(0,0,0,0.03);
        }
        
        /* Custom scrollbar for table */
        .table-responsive::-webkit-scrollbar {
          height: 6px;
        }
        
        .table-responsive::-webkit-scrollbar-thumb {
          background-color: rgba(108, 117, 125, 0.2);
          border-radius: 10px;
        }
        
        .table-responsive::-webkit-scrollbar-track {
          background-color: rgba(0, 0, 0, 0.03);
        }
        
        /* Smooth transitions */
        .card, .btn, .badge, .alert {
          transition: all 0.3s ease;
        }
        
        /* Nicer card hover effect */
        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05) !important;
        }

          .role-stat-card {
    transition: all 0.3s ease;
  }
  
  .role-stat-card:hover {
    background-color: rgba(51, 179, 166, 0.05) !important;
    transform: translateY(-3px);
    box-shadow: 0 8px 15px rgba(51, 179, 166, 0.1) !important;
  }
      `}</style>
    </Container>
  );
};

// Helper function to format role display
function formatRoleDisplay(role) {
  return role.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export default UserManagement;





