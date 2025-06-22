import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, 
  faSpinner, 
  faExclamationTriangle, 
  faCheckCircle,
  faHeadset,
  faUserTie,
  faUserCog,
  faInbox,
  faReply,
  faClock,
  faUserEdit,
  faExclamation,
  faInfoCircle,
  faUsers
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api';

// ZenV brand colors - matching UserManagement component
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

const Helpdesk = () => {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [adminsManagers, setAdminsManagers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // State for new message
  const [newMessage, setNewMessage] = useState({
    recipient: '',
    subject: '',
    message: '',
    priority: 'normal'
  });
  
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

  // Get current user info
  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    const email = sessionStorage.getItem('userEmail');
    
    setCurrentUserRole(role);
    setCurrentUserEmail(email);
  }, []);
  
  useEffect(() => {
    fetchAdminsManagers();
    fetchMessages();
  }, [currentUserRole]);
  
  const fetchAdminsManagers = async () => {
    try {
      setLoading(true);
      
      // Use the special endpoint for helpdesk recipients
      const response = await api.getHelpdeskRecipients();
      
      if (response && response.data) {
        setAdminsManagers(response.data.recipients || []);
      }
    } catch (err) {
      console.error('Error fetching admins/managers:', err);
      setError('Failed to load admins and managers: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Function to fetch messages
  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      // You would need to implement this API endpoint
      const response = await api.getHelpMessages();
      
      if (response && response.data) {
        setMessages(response.data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewMessage({
      ...newMessage,
      [name]: value
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newMessage.recipient || !newMessage.subject || !newMessage.message) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setSending(true);
      
      // You would need to implement this API endpoint
      const response = await api.sendHelpMessage({
        ...newMessage,
        sender: currentUserEmail,
        senderRole: currentUserRole,
        timestamp: new Date().toISOString()
      });
      
      if (response && response.data) {
        setSuccess('Message sent successfully!');
        
        // Reset form
        setNewMessage({
          recipient: '',
          subject: '',
          message: '',
          priority: 'normal'
        });
        
        // Refresh messages
        fetchMessages();
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };
  
  // Get priority details based on priority
  const getPriorityDetails = (priority) => {
    switch (priority) {
      case 'high':
        return {
          icon: faExclamation,
          color: '#dc3545',
          bg: 'rgba(220, 53, 69, 0.1)',
          text: 'High'
        };
      case 'medium':
        return {
          icon: faExclamationTriangle,
          color: ZENV_COLORS.orange,
          bg: 'rgba(255, 208, 0, 0.1)',
          text: 'Medium'
        };
      case 'normal':
      default:
        return {
          icon: faInfoCircle,
          color: ZENV_COLORS.teal,
          bg: 'rgba(51, 179, 166, 0.1)',
          text: 'Normal'
        };
    }
  };
  
  // Get role details based on role
  const getRoleDetails = (role) => {
    switch (role) {
      case 'admin':
        return {
          icon: faUserTie,
          color: ZENV_COLORS.primary,
          bg: ZENV_COLORS.lightBlue,
          text: 'Admin'
        };
      case 'manager':
        return {
          icon: faUserCog,
          color: ZENV_COLORS.teal,
          bg: ZENV_COLORS.lightTeal,
          text: 'Manager'
        };
      case 'clerk':
      default:
        return {
          icon: faUserEdit,
          color: ZENV_COLORS.green,
          bg: ZENV_COLORS.lightGreen,
          text: 'Clerk'
        };
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // If the message is from today, just show the time
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      // If the message is from yesterday, show "Yesterday" and time
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      // Otherwise show full date and time
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return dateString;
    }
  };
  
  // Sort messages by timestamp, newest first
  const sortedMessages = [...messages].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  // Filter messages based on role
  const filteredMessages = sortedMessages.filter(message => {
    if (currentUserRole === 'clerk') {
      // Clerks only see messages they sent or received
      return message.sender === currentUserEmail || message.recipient === currentUserEmail;
    } else if (currentUserRole === 'manager') {
      // Managers see messages they sent/received or from/to clerks
      return message.sender === currentUserEmail || 
             message.recipient === currentUserEmail ||
             message.senderRole === 'clerk' ||
             (message.recipientRole === 'clerk' && message.sender === currentUserEmail);
    } else if (currentUserRole === 'admin') {
      // Admins see all messages
      return true;
    }
    return false;
  });

  // Get message status - if it's to/from the current user
  const getMessageStatus = (message) => {
    if (message.sender === currentUserEmail) {
      return 'sent';
    } else if (message.recipient === currentUserEmail) {
      return 'received';
    }
    return 'other'; // For admins/managers viewing others' messages
  };
  
  // For loading state
  if (loading && messages.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh', fontFamily: ZENV_FONTS.body }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="fa-2x mb-3" style={{color: ZENV_COLORS.primary}} />
          <h5 className="fw-normal" style={{color: ZENV_COLORS.mediumGray}}>Loading helpdesk data...</h5>
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
            <FontAwesomeIcon icon={faHeadset} className="me-2" />
            Helpdesk Support
          </h2>
          <p style={{color: ZENV_COLORS.mediumGray}}>
            Internal messaging for support and assistance
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
      
      <Row className="g-4">
        {/* Message Form */}
        <Col lg={5} xs={12}>
          <Card className="shadow-sm mb-4 border-0 rounded-4 overflow-hidden">
            <div style={{height: '8px'}} />
            <Card.Header className="bg-white py-4 px-4 border-0">
              <h5 className="m-0 fw-bold d-flex align-items-center" style={{color: ZENV_COLORS.primary}}>
                <FontAwesomeIcon icon={faPaperPlane} className="me-2" />
                Send Message
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">Recipient</Form.Label>
                  <Form.Select
                    name="recipient"
                    value={newMessage.recipient}
                    onChange={handleInputChange}
                    required
                    disabled={sending || loading}
                    className="rounded-3 border-0 py-2 px-3 shadow-sm"
                    style={{backgroundColor: 'white'}}
                  >
                    <option value="">{loading ? 'Loading recipients...' : 'Select recipient'}</option>
                    {adminsManagers.map((user, index) => (
                      <option key={index} value={user.email}>
                        {user.email} ({user.role})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">Subject</Form.Label>
                  <Form.Control
                    type="text"
                    name="subject"
                    value={newMessage.subject}
                    onChange={handleInputChange}
                    placeholder="Enter message subject"
                    required
                    disabled={sending}
                    className="rounded-3 border-0 py-2 px-3 shadow-sm"
                    style={{backgroundColor: 'white'}}
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">Priority</Form.Label>
                  <Form.Select
                    name="priority"
                    value={newMessage.priority}
                    onChange={handleInputChange}
                    disabled={sending}
                    className="rounded-3 border-0 py-2 px-3 shadow-sm"
                    style={{backgroundColor: 'white'}}
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Form.Select>
                  <div className="d-flex mt-2 align-items-center flex-wrap gap-2">
                    {['normal', 'medium', 'high'].map(priority => {
                      const priorityDetail = getPriorityDetails(priority);
                      return (
                        <div 
                          key={priority}
                          className="d-inline-flex align-items-center px-3 py-1 rounded-pill" 
                          style={{
                            backgroundColor: priorityDetail.bg,
                            color: priorityDetail.color,
                            fontSize: '0.85rem',
                            fontWeight: 500
                          }}
                        >
                          <FontAwesomeIcon icon={priorityDetail.icon} className="me-2" />
                          {priorityDetail.text}
                        </div>
                      );
                    })}
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-4">
                  <Form.Label className="fw-medium">Message</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    name="message"
                    value={newMessage.message}
                    onChange={handleInputChange}
                    placeholder="Describe your issue or question..."
                    required
                    disabled={sending}
                    className="rounded-3 border-0 py-2 px-3 shadow-sm"
                    style={{backgroundColor: 'white'}}
                  />
                </Form.Group>
                
                <div className="d-grid mt-4">
                  <Button
                    type="submit"
                    disabled={sending || loading || !newMessage.recipient}
                    className="rounded-3 py-2 px-4"
                    style={{
                      backgroundColor: ZENV_COLORS.green,
                      borderColor: ZENV_COLORS.green,
                      fontWeight: 500,
                      boxShadow: '0 2px 10px rgba(177, 208, 7, 0.2)'
                    }}
                  >
                    {sending ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="me-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPaperPlane} className="me-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Message Inbox */}
        <Col lg={7} xs={12}>
          <Card className="shadow-sm mb-4 border-0 rounded-4 overflow-hidden">
            <div style={{height: '8px'}} />
            <Card.Header className="bg-white py-4 px-4 d-flex justify-content-between align-items-center border-0">
              <h5 className="m-0 fw-bold d-flex align-items-center" style={{color: ZENV_COLORS.primary}}>
                <FontAwesomeIcon icon={faInbox} className="me-2" />
                Messages
              </h5>
              <div 
                className="d-inline-flex align-items-center px-3 py-1 rounded-pill" 
                style={{
                  backgroundColor: ZENV_COLORS.lightBlue,
                  color: ZENV_COLORS.primary,
                  fontSize: '0.85rem',
                  fontWeight: 500
                }}
              >
                <FontAwesomeIcon icon={faUsers} className="me-2" />
                {filteredMessages.length} {filteredMessages.length === 1 ? 'message' : 'messages'}
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {loading ? (
                <div className="text-center p-5">
                  <FontAwesomeIcon icon={faSpinner} spin className="fa-2x mb-3" style={{color: ZENV_COLORS.primary}} />
                  <p style={{color: ZENV_COLORS.mediumGray}} className="mb-0">Loading messages...</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center p-5">
                  <div className="empty-state-icon mb-3">
                    <FontAwesomeIcon icon={faInbox} className="fa-2x" style={{color: ZENV_COLORS.mediumGray}} />
                  </div>
                  <p style={{color: ZENV_COLORS.mediumGray}} className="mb-0">No messages to display</p>
                </div>
              ) : (
                <div className="message-list p-4">
                  {filteredMessages.map((message, index) => {
                    const messageStatus = getMessageStatus(message);
                    const roleDetails = getRoleDetails(message.senderRole);
                    const priorityDetails = getPriorityDetails(message.priority);
                    
                    let headerBgColor;
                    switch(messageStatus) {
                      case 'sent': 
                        headerBgColor = ZENV_COLORS.lightBlue;
                        break;
                      case 'received': 
                        headerBgColor = ZENV_COLORS.lightTeal;
                        break;
                      default: 
                        headerBgColor = ZENV_COLORS.lightGray;
                    }
                    
                    return (
                      <div 
                        key={index} 
                        className="message-item mb-4 border-0 rounded-4 shadow-sm overflow-hidden"
                      >
                        <div 
                          className="message-header p-4 d-flex justify-content-between align-items-start"
                          style={{backgroundColor: headerBgColor}}
                        >
                          <div>
                            <h6 className="mb-1 fw-bold" style={{color: ZENV_COLORS.darkGray}}>{message.subject}</h6>
                            <div className="d-flex align-items-center mt-2 flex-wrap">
                              <div 
                                className="d-inline-flex align-items-center px-3 py-1 rounded-pill me-3 mb-2" 
                                style={{
                                  backgroundColor: roleDetails.bg,
                                  color: roleDetails.color,
                                  fontSize: '0.85rem',
                                  fontWeight: 500
                                }}
                              >
                                <FontAwesomeIcon icon={roleDetails.icon} className="me-2" />
                                {roleDetails.text}
                              </div>
                              <span style={{color: ZENV_COLORS.mediumGray, fontSize: '0.9rem'}} className="me-3 mb-2">
                                <strong>From:</strong> {message.sender}
                                {message.sender === currentUserEmail && " (You)"}
                              </span>
                              <span style={{color: ZENV_COLORS.mediumGray, fontSize: '0.9rem'}} className="mb-2">
                                <strong>To:</strong> {message.recipient}
                                {message.recipient === currentUserEmail && " (You)"}
                              </span>
                            </div>
                          </div>
                          <div className="text-end ms-2">
                            <div 
                              className="d-inline-flex align-items-center px-3 py-1 rounded-pill mb-2" 
                              style={{
                                backgroundColor: priorityDetails.bg,
                                color: priorityDetails.color,
                                fontSize: '0.85rem',
                                fontWeight: 500
                              }}
                            >
                              <FontAwesomeIcon icon={priorityDetails.icon} className="me-2" />
                              {priorityDetails.text}
                            </div>
                            <div style={{color: ZENV_COLORS.mediumGray, fontSize: '0.85rem'}} className="mt-1">
                              <FontAwesomeIcon icon={faClock} className="me-1" />
                              {formatDate(message.timestamp)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="message-content p-4 bg-white">
                          <div className="p-3 rounded-3" style={{backgroundColor: ZENV_COLORS.lightGray}}>
                            {message.message}
                          </div>

                          {currentUserRole !== 'clerk' && message.recipient === currentUserEmail && (
                            <div className="mt-3 text-end">
                              <Button 
                                className="px-3 py-1 rounded-pill border-0"
                                style={{
                                  backgroundColor: ZENV_COLORS.lightTeal,
                                  color: ZENV_COLORS.teal,
                                  fontWeight: 500,
                                  fontSize: '0.85rem'
                                }}
                                onClick={() => {
                                  // Set the sender of the message as the recipient for the reply
                                  setNewMessage({
                                    recipient: message.sender,
                                    subject: `Re: ${message.subject}`,
                                    message: '',
                                    priority: 'normal'
                                  });
                                  // Scroll to form
                                  document.querySelector('form').scrollIntoView({ behavior: 'smooth' });
                                }}
                              >
                                <FontAwesomeIcon icon={faReply} className="me-2" />
                                Reply
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Custom CSS for message styling */}
      <style jsx="true">{`
        /* Form styling */
        .form-control:focus, .form-select:focus {
          border-color: ${ZENV_COLORS.teal};
          box-shadow: 0 0 0 0.2rem rgba(51, 179, 166, 0.25);
        }
        
        /* Custom button hover effect */
        .btn:hover {
          transform: translateY(-1px);
          transition: all 0.2s;
        }
        
        /* Smooth transitions */
        .card, .btn, .badge, .alert, .message-item {
          transition: all 0.3s ease;
        }
        
        /* Message list styling */
        .message-list {
          max-height: 650px;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        
        .message-list::-webkit-scrollbar {
          width: 6px;
        }
        
        .message-list::-webkit-scrollbar-track {
          background: ${ZENV_COLORS.lightGray};
          border-radius: 10px;
        }
        
        .message-list::-webkit-scrollbar-thumb {
          background: rgba(108, 117, 125, 0.2);
          border-radius: 10px;
        }
        
        .message-item {
          transition: transform 0.15s ease;
        }
        
        .message-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05) !important;
        }
        
        /* Empty state styling */
        .empty-state-icon {
          background-color: rgba(107, 114, 128, 0.1);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }
        
        /* Card styling */
        .card {
          overflow: hidden;
        }
        
        /* Responsive adjustments */
        @media (max-width: 767.98px) {
          .message-list {
            max-height: 450px;
          }
          
          .message-header {
            flex-direction: column;
          }
          
          .message-header > div:last-child {
            margin-left: 0 !important;
            margin-top: 0.5rem;
            width: 100%;
          }
        }
      `}</style>
    </Container>
  );
};

export default Helpdesk;


