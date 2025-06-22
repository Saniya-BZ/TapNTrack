import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Button, Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faIdCard, 
  faDoorOpen,
  faSignOutAlt, 
  faExclamationTriangle,
  faUsers,
  faHeadset,
  faCog,
  faDatabase,
  faUserPlus,
  faChartBar,
  faHeartbeat,
  faArrowLeft,
  faArrowRight,
  faBell,
  faBoxOpen,
  faUserShield
  
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


const Layout = ({ children, username, error }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [userRole, setUserRole] = useState('');
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminName, setAdminName] = useState('Admin');
  const [searchQuery, setSearchQuery] = useState('');


  // Search handler
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // Implement your search logic here
    console.log(`Searching for: ${searchQuery}`);
  };

  // Get user role from session storage
  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    setUserRole(role || '');
  }, []);
  
  // Handle window resize for responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      
      // Auto-close sidebar on small screens
      if (width < 768) {
        setSidebarOpen(false);
        setSidebarCollapsed(false);
      } else {
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Call on initial load
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Check if a nav item is active based on current route
  const isActive = (path) => {
    return location.pathname === path;
  };
  
  // Toggle sidebar visibility
  const toggleSidebar = () => {
    if (windowWidth < 768) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    // Remove auth token and redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userEmail');
    window.location.href = '/login';
  };
  
  // Helper function to get page title
  const getPageTitle = () => {
    const titleMap = {
      '/dashboard': 'Dashboard',
      '/register_guest': 'Guest Registration',
      '/management_registration': 'Management Registration',
      '/rfid_entries': 'RFID Entries',
      '/checkin_trends': 'Time-based Check-in Trends',
      '/room_frequency': 'Room-based Access Frequency',
      '/manage_tables': 'Manage Tables',
      '/user_management': 'User Management',
      '/system_health': 'System Health Monitoring',
      // '/all_products': 'All Products',
      '/helpdesk': userRole === 'clerk' ? 'Get Support' : 'Support Messages',
      '/access_control_tracking': 'Access Control Tracking'
      // '/settings': 'Settings'
    };
    return titleMap[location.pathname] || '';
  };
  
  // Calculate sidebar width based on state
  const getSidebarWidth = () => {
    if (windowWidth < 768) {
      return '230px';
    }
    return sidebarCollapsed ? '60px' : '230px';
  };
  
  // Calculate content margin based on sidebar state
  const getContentMargin = () => {
    if (windowWidth < 768) {
      return '0';
    }
    if (!sidebarOpen) {
      return '0';
    }
    return sidebarCollapsed ? '60px' : '230px';
  };
  
  return (
    <div className="d-flex h-100">
      {/* Sidebar */}
      <div 
        className={`sidebar bg-white shadow-sm ${sidebarOpen ? 'd-block' : 'd-none d-md-block'} ${sidebarCollapsed ? 'collapsed' : ''}`} 
        style={{ width: getSidebarWidth() }}
      >
        {/* Brand/Logo Section */}
        <div className={`sidebar-brand d-flex align-items-center p-3 border-bottom ${sidebarCollapsed ? 'justify-content-center' : ''}`}>
          {!sidebarCollapsed ? (
            <h5 className="mb-0 fw-bold text-primary">RFTrack</h5>
          ) : (
            <h5 className="mb-0 fw-bold text-primary">RF</h5>
          )}

          {windowWidth >= 768 && (
            <Button 
              variant="link" 
              className="ms-auto p-0 text-secondary sidebar-toggle-btn" 
              onClick={toggleSidebar} 
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <FontAwesomeIcon 
                icon={sidebarCollapsed ? faArrowRight : faArrowLeft} 
                size="xs"
              />
            </Button>
          )}
        </div>
        
        {/* Navigation Items */}
        <Nav className="flex-column mt-3">
          {/* Dashboard - not visible to clerks */}
          {userRole !== 'clerk' && (
            <Nav.Item>
              <Link 
                to="/dashboard" 
                className={`nav-link text-dark ${isActive('/dashboard') ? 'active-link' : ''}`}
                title="Dashboard"
              >
                <FontAwesomeIcon icon={faChartLine} className={isActive('/dashboard') ? 'text-primary' : 'text-secondary'} />
                {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
              </Link>
            </Nav.Item>
          )}


          
          {/* Guest Registration */}
          {(userRole === 'clerk' || userRole === 'manager' || userRole === 'admin') && (
            <Nav.Item>
              <Link 
                to="/register_guest" 
                className={`nav-link text-dark ${isActive('/register_guest') ? 'active-link' : ''}`}
                title="Guest Registration"
              >
                <FontAwesomeIcon icon={faUserPlus} className={isActive('/register_guest') ? 'text-primary' : 'text-secondary'} />
                {!sidebarCollapsed && <span className="nav-text">Guest Registration</span>}
              </Link>
            </Nav.Item>
          )}
          

          
          {/* Management Registration - only visible to admin */}
          {userRole === 'admin' && (
            <Nav.Item>
              <Link 
                to="/management_registration" 
                className={`nav-link text-dark ${isActive('/management_registration') ? 'active-link' : ''}`}
                title="Management Registration"
              >
                <FontAwesomeIcon icon={faUserShield} className={isActive('/management_registration') ? 'text-primary' : 'text-secondary'} />
                {!sidebarCollapsed && <span className="nav-text">Management Staff</span>}
              </Link>
            </Nav.Item>
          )}

          {/* Other menu items - not visible to clerks */}
          {userRole !== 'clerk' && (
            <>
              <Nav.Item>
                <Link 
                  to="/rfid_entries" 
                  className={`nav-link text-dark ${isActive('/rfid_entries') ? 'active-link' : ''}`}
                  title="RFID Entries"
                >
                  <FontAwesomeIcon icon={faIdCard} className={isActive('/rfid_entries') ? 'text-primary' : 'text-secondary'} />
                  {!sidebarCollapsed && <span className="nav-text">RFID Entries</span>}
                </Link>
              </Nav.Item>


                 <Nav.Item>
                <Link 
                  to="/manage_tables" 
                  className={`nav-link text-dark ${isActive('/manage_tables') ? 'active-link' : ''}`}
                  title="Manage Tables"
                >
                  <FontAwesomeIcon icon={faDatabase} className={isActive('/manage_tables') ? 'text-primary' : 'text-secondary'} />
                  {!sidebarCollapsed && <span className="nav-text">Manage Tables</span>}
                </Link>
              </Nav.Item>



  {userRole !== 'clerk' && (
  <Nav.Item>
    <Link 
      to="/access_control_tracking" 
      className={`nav-link text-dark ${isActive('/access_control_tracking') ? 'active-link' : ''}`}
    >
      <FontAwesomeIcon 
        icon={faBoxOpen} 
        className={isActive('/access_control_tracking') ? 'text-primary' : 'text-secondary'} 
      />
      {!sidebarCollapsed && <span className="nav-text">Access Control Tracking</span>}
    </Link>
  </Nav.Item>

  )}
          
              
              <Nav.Item>
                <Link 
                  to="/checkin_trends" 
                  className={`nav-link text-dark ${isActive('/checkin_trends') ? 'active-link' : ''}`}
                  title="Check-in Trends"
                >
                  <FontAwesomeIcon icon={faChartBar} className={isActive('/checkin_trends') ? 'text-primary' : 'text-secondary'} />
                  {!sidebarCollapsed && <span className="nav-text">Check-in Trends</span>}
                </Link>
              </Nav.Item>
              
              <Nav.Item>
                <Link 
                  to="/room_frequency" 
                  className={`nav-link text-dark ${isActive('/room_frequency') ? 'active-link' : ''}`}
                  title="Room Access"
                >
                  <FontAwesomeIcon icon={faDoorOpen} className={isActive('/room_frequency') ? 'text-primary' : 'text-secondary'} />
                  {!sidebarCollapsed && <span className="nav-text">Room Access</span>}
                </Link>
              </Nav.Item>
              

              
              <Nav.Item>
                <Link 
                  to="/user_management" 
                  className={`nav-link text-dark ${isActive('/user_management') ? 'active-link' : ''}`}
                  title="User Management"
                >
                  <FontAwesomeIcon icon={faUsers} className={isActive('/user_management') ? 'text-primary' : 'text-secondary'} />
                  {!sidebarCollapsed && <span className="nav-text">User Management</span>}
                </Link>
              </Nav.Item>
              
              <Nav.Item>
                <Link 
                  to="/system_health" 
                  className={`nav-link text-dark ${isActive('/system_health') ? 'active-link' : ''}`}
                  title="System Health"
                >
                  <FontAwesomeIcon icon={faHeartbeat} className={isActive('/system_health') ? 'text-primary' : 'text-secondary'} />
                  {!sidebarCollapsed && <span className="nav-text">System Health</span>}
                </Link>
              </Nav.Item>

            </>
          )}
          
          {/* Helpdesk - visible to all users EXCEPT super_admin */}
          {userRole !== 'super_admin' && (
            <Nav.Item>
              <Link 
                to="/helpdesk" 
                className={`nav-link text-dark ${isActive('/helpdesk') ? 'active-link' : ''}`}
                title={userRole === 'clerk' ? 'Get Support' : 'Support Messages'}
              >
                <FontAwesomeIcon icon={faHeadset} className={isActive('/helpdesk') ? 'text-primary' : 'text-secondary'} />
                {!sidebarCollapsed && (
                  <span className="nav-text">
                    {userRole === 'clerk' ? 'Get Support' : 'Support Messages'}
                  </span>
                )}
              </Link>
            </Nav.Item>
          )}

          
          {/* Logout */}
          <Nav.Item>
            <Link 
              to="#" 
              className="nav-link text-dark"
              onClick={handleLogout}
              title="Logout"
            >
              <FontAwesomeIcon icon={faSignOutAlt} className={`text-secondary`} />
              {!sidebarCollapsed && <span className="nav-text">Logout</span>}
            </Link>
          </Nav.Item>
        </Nav>
      </div>
      
      {/* Main Content Wrapper */}
      <div className="d-flex flex-column flex-grow-1" style={{ 
        marginLeft: getContentMargin(),
        transition: 'margin 0.3s ease-in-out'
      }}>
<Navbar bg="white" expand="lg" className="px-4 py-3 shadow-sm">
  <div className="d-flex justify-content-between w-100">
    {/* Left side - Empty now since search is removed */}
    <div className="d-flex align-items-center">
      {/* Empty space where search bar was */}
    </div>
    
    {/* Right side - Profile and settings */}
    <div className="d-flex align-items-center">
      {/* User profile */}
      <div className="profile-section d-flex align-items-center me-3">
        <div className="profile-avatar me-2">
          <img 
            src="/profile-avatar.jpg" 
            alt="Profile"
            onError={(e) => {
              e.target.onError = null;
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<FontAwesomeIcon icon={faUserCircle} className="text-secondary" style={{fontSize: "1.5rem"}} />';
            }}
          />
        </div>
        <div className="d-none d-sm-flex flex-column">
          <span className="profile-name">{username || 'Guest'}</span>
          <span className="profile-role">{userRole || 'User'}</span>
        </div>
      </div>
      
      {/* Settings dropdown */}
      <Dropdown align="end">
        <Dropdown.Toggle 
          as={Button}
          variant="light" 
          size="sm"
          className="border-0 rounded-circle settings-btn me-2"
          title="Settings"
          id="dropdown-settings"
        >
          <FontAwesomeIcon icon={faCog} />
        </Dropdown.Toggle>
        
        <Dropdown.Menu className="shadow-sm border-0 rounded-3 mt-2">
          <Dropdown.Item as={Link} to="/settings">
            <FontAwesomeIcon icon={faCog} className="me-2 text-secondary" />
            Settings
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} className="me-2 text-secondary" />
            Logout
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      
      {/* Notifications */}
      <div className="position-relative">
        <Button 
          variant="light" 
          size="sm"
          className="border-0 rounded-circle notif-btn"
          onClick={() => setShowNotifications(!showNotifications)}
          title="Notifications"
        >
          <FontAwesomeIcon icon={faBell} />
        </Button>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount}</span>
        )}
        
        {/* Notification dropdown */}
        {showNotifications && (
          <div className="notif-dropdown rounded-3">
            <div className="p-3 border-bottom">
              <h6 className="mb-0 fw-bold">Notifications</h6>
            </div>
            <div className="notifications-list">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => (
                  <div key={index} className="p-3 border-bottom notification-item">
                    <div className="d-flex align-items-center">
                      <FontAwesomeIcon icon={faIdCard} className="me-2 text-primary" />
                      <div>
                        <p className="mb-0 small">{notification.message}</p>
                        <small className="text-muted">
                          {new Date(notification.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </small>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted">
                  <p className="mb-0">No new notifications</p>
                </div>
              )}
            </div>
            <div className="p-2 text-center border-top">
              <Link to="/notifications" className="text-decoration-none small">
                View all notifications
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</Navbar>
        
        {/* Display any error messages */}
        {error && (
          <div className="alert alert-danger rounded-3 shadow-sm d-flex align-items-center m-3">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-3 fa-lg" />
            <div>{error}</div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="content p-4 bg-light flex-grow-1">
          {children}
        </div>
      </div>
      
      {/* Overlay for sidebar on mobile */}
      {windowWidth < 768 && sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 99
          }}
        />
      )}
      
      {/* Additional custom styling */}
      <style jsx="true">{`

        body {
    font-family: ${ZENV_FONTS.body};
  }
  
  h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6 {
    font-family: ${ZENV_FONTS.heading};
  }
        .sidebar {
          position: fixed;
          height: 100vh;
          z-index: 100;
          overflow-y: auto;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          scrollbar-width: thin;
          scrollbar-color: #e9e9e9 transparent;
        }
        
        .sidebar.collapsed {
          overflow-x: hidden;
        }
        
        .sidebar.collapsed .nav-link {
          padding: 0.8rem 0;
          margin: 0.1rem;
          display: flex;
          justify-content: center;
          border-radius: 0.375rem;
        }
        
        .sidebar::-webkit-scrollbar {
          width: 5px;
        }
        
        .sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .sidebar::-webkit-scrollbar-thumb {
          background-color: #e9e9e9;
          border-radius: 10px;
        }

        .sidebar-toggle-btn {
          opacity: 0.5;
          transition: opacity 0.2s ease-in-out;
        }

        .sidebar-toggle-btn:hover {
          opacity: 1;
        }

        .sidebar-brand {
          position: relative;
        }

        .sidebar.collapsed .sidebar-toggle-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
        }
        
        .nav-link {
          padding: 0.8rem 1rem;
          margin: 0.1rem 0.8rem;
          border-radius: 0.375rem;
          transition: all 0.3s ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .nav-link:hover {
          background-color: #f8f9fa;
        }
        
        .nav-text {
          margin-left: 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          transition: opacity 0.3s ease;
        }
        
        .active-link {
          background-color: #f0f7ff !important;
          font-weight: 600;
        }
        
        /* Content area adjustments */
        .content {
          min-height: calc(100vh - 70px);
        }
        
        /* Improve sidebar responsiveness */
        @media (max-width: 768px) {
          .sidebar {
            left: 0;
            transform: translateX(-100%);
          }
          
          .sidebar.d-block {
            transform: translateX(0);
          }
        }

        .dashboard-search-form {
          width: 300px;
        }
        
        .dashboard-search {
          background: #f8fafc;
          border-radius: 20px;
          font-size: 0.9rem;
          height: 42px;
          border: 1px solid #e3e7ed;
          transition: box-shadow 0.2s;
        }
        
        .search-icon {
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }
        
        .dashboard-search:focus {
          box-shadow: 0 0 0 2px #2A6EBB33;
          border-color: #2A6EBB;
          background: #fff;
        }
        
        .profile-section {
          cursor: pointer;
        }
        
        .profile-avatar {
          width: 42px;
          height: 42px;
          background: #f0f0f0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 2px solid #fff;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .profile-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: #333;
          line-height: 1.1;
        }
        
        .profile-role {
          font-size: 0.75rem;
          color: #777;
        }
        
        .settings-btn, .notif-btn {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          background: #f8f9fa;
        }
        
        .settings-btn:hover, .notif-btn:hover {
          background: #f0f0f0;
        }
        
        .notif-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #FF5252;
          color: white;
          font-size: 0.65rem;
          font-weight: bold;
          border-radius: 50%;
          padding: 1px 5px;
          min-width: 18px;
          height: 18px;
          text-align: center;
          z-index: 2;
          border: 2px solid #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .notif-dropdown {
          position: absolute;
          right: 0;
          top: 120%;
          min-width: 260px;
          background: #fff;
          z-index: 100;
          border: 1px solid #e3e7ed;
          box-shadow: 0 4px 16px rgba(42,110,187,0.08);
          animation: fadeIn 0.2s;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px);}
          to { opacity: 1; transform: translateY(0);}
        }
        
        .notification-item {
          transition: background-color 0.15s;
        }
        
        .notification-item:hover {
          background-color: #f9f9f9;
        }
      `}</style>
    </div>
  );
};

export default Layout;

