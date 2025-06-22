import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Form, Button, Table, Alert, Container } from 'react-bootstrap';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, 
  faChartLine, 
  faCheckCircle, 
  faTimesCircle, 
  faChartBar, 
  faClock,
  faCalendarDay,
  faSpinner,
  faExclamationTriangle,
  faSearch
} from '@fortawesome/free-solid-svg-icons';

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
  lightGreen: 'rgba(177, 208, 7, 0.1)',
  lightBlue: 'rgba(42, 110, 187, 0.1)',
  lightTeal: 'rgba(51, 179, 166, 0.1)',
  lightPurple: 'rgba(151, 96, 177, 0.1)',
  lightOrange: 'rgba(255, 208, 0, 0.1)',
};

const CheckinTrends = () => {
  // Constants
  const DAY_NAMES = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
    'Friday', 'Saturday', 'Sunday'
  ];
  const HOURLY_LABELS = ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00", 
                         "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", 
                         "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", 
                         "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];
  
  // State for form and data
  const [period, setPeriod] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  // Add these new states to track the form values separately from the fetch parameters
  const [formPeriod, setFormPeriod] = useState('30');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  
  // Chart container refs for responsive sizing
  const dailyChartRef = useRef(null);
  const accessChartRef = useRef(null);
  const hourlyChartRef = useRef(null);
  const dowChartRef = useRef(null);
  
  // State for stats and charts
  const [checkinData, setCheckinData] = useState({
    total_entries: 0,
    avg_daily: 0,
    granted_count: 0,
    denied_count: 0,
    granted_percentage: 0,
    denied_percentage: 0,
    date_labels: [],
    daily_counts: [],
    hourly_counts: Array(24).fill(0),
    day_of_week_counts: Array(7).fill(0),
    max_daily: 0,
    min_daily: 0,
    max_day: 'N/A',
    min_day: 'N/A',
    most_active_hour: 0,
    most_active_dow: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Set initial dates
  useEffect(() => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    
    setStartDate(formatDate(oneMonthAgo));
    setEndDate(formatDate(today));
    // Initialize form dates too
    setFormStartDate(formatDate(oneMonthAgo));
    setFormEndDate(formatDate(today));
  }, []);
  
  // Handle period change in the form
  useEffect(() => {
    setShowCustomDates(formPeriod === 'custom');
    
    if (formPeriod !== 'custom') {
      const today = new Date();
      const pastDate = new Date();
      
      switch (formPeriod) {
        case '30':
          pastDate.setMonth(today.getMonth() - 1);
          break;
        case '90':
          pastDate.setMonth(today.getMonth() - 3);
          break;
        case '180':
          pastDate.setMonth(today.getMonth() - 6);
          break;
        case '365':
          pastDate.setFullYear(today.getFullYear() - 1);
          break;
        default:
          pastDate.setMonth(today.getMonth() - 1);
      }
      
      setFormStartDate(formatDate(pastDate));
      setFormEndDate(formatDate(today));
    }
  }, [formPeriod]);
  
  // Fetch data when actual parameters change (only after Apply button is clicked)
  useEffect(() => {
    if (!startDate || !endDate) return;
    
    const fetchCheckinTrends = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:5000/api/checkin_trends', {
          params: { 
            period,
            start_date: startDate,
            end_date: endDate
          },
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        setCheckinData(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching checkin trends data:", err);
        setError("Failed to load checkin trends data: " + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchCheckinTrends();
  }, [period, startDate, endDate]);
  
  // Helper to format date for input fields
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    // Update the actual parameters used for fetching data
    setPeriod(formPeriod);
    setStartDate(formStartDate);
    setEndDate(formEndDate);
  };
  
  // Get chart heights based on screen size
  const getChartHeight = (chartType) => {
    if (windowWidth < 576) {
      // Mobile
      return chartType === 'doughnut' ? 220 : 250;
    } else if (windowWidth < 992) {
      // Tablet
      return chartType === 'doughnut' ? 250 : 300;
    } else {
      // Desktop
      return chartType === 'doughnut' ? 300 : 350;
    }
  };
  
  // Get shortened labels for mobile
  const getMobileLabels = (labels) => {
    if (windowWidth < 576) {
      return labels.map(label => {
        // Shorten hour labels (e.g., "01:00" to "01")
        if (label.includes(':00')) {
          return label.split(':')[0];
        }
        // Shorten day names (e.g., "Monday" to "Mon")
        if (DAY_NAMES.includes(label)) {
          return label.substring(0, 3);
        }
        return label;
      });
    }
    return labels;
  };

  // Create chart data and options
  const dailyTrendData = {
    labels: checkinData.date_labels,
    datasets: [{
      label: 'Daily Check-ins',
      data: checkinData.daily_counts,
      backgroundColor: ZENV_COLORS.lightBlue,
      borderColor: ZENV_COLORS.primary,
      pointBackgroundColor: ZENV_COLORS.primary,
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: ZENV_COLORS.primary,
      borderWidth: 2,
      fill: true
    }]
  };
  
  const dailyTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: {
            size: windowWidth < 768 ? 10 : 12
          },
          maxTicksLimit: windowWidth < 576 ? 5 : undefined
        },
        grid: {
          display: windowWidth >= 576
        }
      },
      x: {
        ticks: {
          font: {
            size: windowWidth < 768 ? 10 : 12
          },
          maxTicksLimit: windowWidth < 576 ? 5 : (windowWidth < 992 ? 7 : undefined)
        },
        grid: {
          display: windowWidth >= 576
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            size: windowWidth < 768 ? 11 : 12
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
        }
      }
    }
  };


  
  const accessDistData = {
    labels: ['Access Granted', 'Access Denied'],
    datasets: [{
      data: [checkinData.granted_count, checkinData.denied_count],
      backgroundColor: [ZENV_COLORS.green, ZENV_COLORS.orange],
      borderColor: ['rgba(177, 208, 7, 1)', 'rgba(255, 208, 0, 1)'],
      borderWidth: 1
    }]
  };
  
  const accessDistOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: windowWidth < 576 ? '65%' : '70%',
    plugins: {
      legend: {
        position: windowWidth < 576 ? 'right' : 'bottom',
        labels: {
          font: {
            size: windowWidth < 768 ? 11 : 12
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
        }
      }
    }
  };
  
  const hourlyDistData = {
    labels: getMobileLabels(HOURLY_LABELS),
    datasets: [{
      label: 'Check-ins by Hour',
      data: checkinData.hourly_counts,
      backgroundColor: ZENV_COLORS.teal,
      borderColor: ZENV_COLORS.teal,
      borderWidth: 1
    }]
  };
  
  const hourlyDistOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: {
            size: windowWidth < 768 ? 10 : 12
          },
          maxTicksLimit: windowWidth < 576 ? 5 : undefined
        },
        grid: {
          display: windowWidth >= 576
        }
      },
      x: {
        ticks: {
          font: {
            size: windowWidth < 768 ? 9 : 11
          },
          maxRotation: windowWidth < 576 ? 90 : 0,
          minRotation: windowWidth < 576 ? 45 : 0
        },
        grid: {
          display: windowWidth >= 576
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            size: windowWidth < 768 ? 11 : 12
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
        }
      }
    }
  };
  
  const dowDistData = {
    labels: getMobileLabels(DAY_NAMES),
    datasets: [{
      label: 'Check-ins by Day of Week',
      data: checkinData.day_of_week_counts,
      backgroundColor: ZENV_COLORS.purple,
      borderColor: ZENV_COLORS.purple,
      borderWidth: 1
    }]
  };
  
  const dowDistOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: {
            size: windowWidth < 768 ? 10 : 12
          },
          maxTicksLimit: windowWidth < 576 ? 5 : undefined
        },
        grid: {
          display: windowWidth >= 576
        }
      },
      x: {
        ticks: {
          font: {
            size: windowWidth < 768 ? 10 : 12
          }
        },
        grid: {
          display: windowWidth >= 576
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            size: windowWidth < 768 ? 11 : 12
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
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="fa-2x mb-3" style={{ color: ZENV_COLORS.primary }} />
          <h5 className="fw-normal text-muted">Loading check-in trends...</h5>
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
          <h2 className="fw-bold mb-0" style={{ color: ZENV_COLORS.primary }}>Check-in Analytics</h2>
          <p className="text-muted mb-0">Monitor and analyze guest check-in patterns</p>
        </Col>
      </Row>

      {/* Period Selection */}
      <Card className="shadow-sm mb-4 rounded-4 border-0">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center border-0">
          <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faCalendarAlt} className="me-2" />
            Select Time Period
          </h6>
        </Card.Header>
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col xs={12} md={3}>
                <Form.Group>
                  <Form.Label className="form-label fw-medium">Predefined Period</Form.Label>
                  <Form.Select 
                    id="period" 
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value)}
                    className="form-select rounded-3 shadow-sm border-0"
                  >
                    <option value="30">1 Month</option>
                    <option value="90">3 Months</option>
                    <option value="180">6 Months</option>
                    <option value="365">1 Year</option>
                    <option value="custom">Custom Range</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              {showCustomDates && (
                <>
                  <Col xs={6} md={3}>
                    <Form.Group>
                      <Form.Label className="form-label fw-medium">Start Date</Form.Label>
                      <Form.Control
                        type="date"
                        id="start_date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="form-control rounded-3 shadow-sm border-0"
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col xs={6} md={3}>
                    <Form.Group>
                      <Form.Label className="form-label fw-medium">End Date</Form.Label>
                      <Form.Control
                        type="date"
                        id="end_date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="form-control rounded-3 shadow-sm border-0"
                      />
                    </Form.Group>
                  </Col>
                </>
              )}
              
              <Col xs={12} md={showCustomDates ? 3 : 9} className="d-flex align-items-end">
                <Button 
                  type="submit"
                  variant="primary"
                  className="rounded-pill px-4 py-2 shadow-sm border-0 w-100"
                  style={{ backgroundColor: ZENV_COLORS.primary }}
                >
                  <FontAwesomeIcon icon={faSearch} className="me-2" />
                  Apply
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
  
      {/* Stats Cards */}
      <Row className="g-3 mb-4">
        {/* Total Check-ins Card */}
        <Col xl={3} md={6} sm={6}>
          <Card className="h-100 shadow-sm border-0 rounded-4">
            <Card.Body className="p-3">
              <Row className="g-0 align-items-center">
                <Col className="me-2">
                  <div className="text-xs text-uppercase text-muted fw-bold mb-1">
                    Total Check-ins
                  </div>
                  <div className="h3 mb-0 fw-bold">
                    {checkinData.total_entries}
                  </div>
                </Col>
                <Col xs="auto">
                  <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                    <FontAwesomeIcon icon={faCalendarAlt} className="fa-lg" style={{ color: ZENV_COLORS.primary }} />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
  
        {/* Daily Average Card */}
        <Col xl={3} md={6} sm={6}>
          <Card className="h-100 shadow-sm border-0 rounded-4">
            <Card.Body className="p-3">
              <Row className="g-0 align-items-center">
                <Col className="me-2">
                  <div className="text-xs text-uppercase text-muted fw-bold mb-1">
                    Daily Average
                  </div>
                  <div className="h3 mb-0 fw-bold" >
                    {checkinData.avg_daily.toFixed(1)}
                  </div>
                </Col>
                <Col xs="auto">
                  <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                    <FontAwesomeIcon icon={faChartLine} className="fa-lg" style={{ color: ZENV_COLORS.primaryl }} />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
  
        {/* Access Granted Card */}
        <Col xl={3} md={6} sm={6}>
          <Card className="h-100 shadow-sm border-0 rounded-4">
            <Card.Body className="p-3">
              <Row className="g-0 align-items-center">
                <Col className="me-2">
                  <div className="text-xs text-uppercase text-muted fw-bold mb-1">
                    Access Granted
                  </div>
                  <div className="h3 mb-0 fw-bold" >
                    {checkinData.granted_count} <span className="fw-normal text-muted small">({checkinData.granted_percentage.toFixed(1)}%)</span>
                  </div>
                </Col>
                <Col xs="auto">
                  <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                    <FontAwesomeIcon icon={faCheckCircle} className="fa-lg" style={{ color: ZENV_COLORS.primary }} />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
  
        {/* Access Denied Card */}
        <Col xl={3} md={6} sm={6}>
          <Card className="h-100 shadow-sm border-0 rounded-4">
            <Card.Body className="p-3">
              <Row className="g-0 align-items-center">
                <Col className="me-2">
                  <div className="text-xs text-uppercase text-muted fw-bold mb-1">
                    Access Denied
                  </div>
                  <div className="h3 mb-0 fw-bold" >
                    {checkinData.denied_count} <span className="fw-normal text-muted small">({checkinData.denied_percentage.toFixed(1)}%)</span>
                  </div>
                </Col>
                <Col xs="auto">
                  <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                    <FontAwesomeIcon icon={faTimesCircle} className="fa-lg" style={{ color: ZENV_COLORS.primary }} />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
  
      {/* Charts Row */}
      <Row className="g-3">
        {/* Daily Trend Chart */}
        <Col xl={8} lg={7} xs={12}>
          <Card className="shadow-sm mb-4 rounded-4 border-0">
            <Card.Header className="bg-white py-3 border-0">
              <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                <FontAwesomeIcon icon={faChartLine} className="me-2" />
                Daily Check-in Trend
              </h6>
            </Card.Header>
            <Card.Body className="p-4">
              <div 
                className="chart-container"
                ref={dailyChartRef}
                style={{ height: `${getChartHeight('line')}px` }}
              >
                <Line data={dailyTrendData} options={dailyTrendOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Access Distribution Chart */}
        <Col xl={4} lg={5} xs={12}>
          <Card className="shadow-sm mb-4 rounded-4 border-0">
            <Card.Header className="bg-white py-3 border-0">
              <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                <FontAwesomeIcon icon={faChartBar} className="me-2" />
                Access Status Distribution
              </h6>
            </Card.Header>
            <Card.Body className="p-4">
              <div 
                className="chart-container"
                ref={accessChartRef}
                style={{ height: `${getChartHeight('doughnut')}px` }}
              >
                <Doughnut data={accessDistData} options={accessDistOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
  
      {/* Hourly & DOW Charts */}
      <Row className="g-3">
        {/* Hourly Distribution Chart */}
        <Col xl={6} xs={12}>
          <Card className="shadow-sm mb-4 rounded-4 border-0">
            <Card.Header className="bg-white py-3 border-0">
              <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                <FontAwesomeIcon icon={faClock} className="me-2" />
                Hourly Check-in Distribution
              </h6>
            </Card.Header>
            <Card.Body className="p-4">
              <div 
                className="chart-container"
                ref={hourlyChartRef}
                style={{ height: `${getChartHeight('bar')}px` }}
              >
                <Bar data={hourlyDistData} options={hourlyDistOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Day of Week Distribution */}
        <Col xl={6} xs={12}>
          <Card className="shadow-sm mb-4 rounded-4 border-0">
            <Card.Header className="bg-white py-3 border-0">
              <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
                <FontAwesomeIcon icon={faCalendarDay} className="me-2" />
                Day of Week Distribution
              </h6>
            </Card.Header>
            <Card.Body className="p-4">
              <div 
                className="chart-container"
                ref={dowChartRef}
                style={{ height: `${getChartHeight('bar')}px` }}
              >
                <Bar data={dowDistData} options={dowDistOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
 
      {/* Activity Summary Table */}
      <Card className="shadow-sm mb-4 rounded-4 border-0">
        <Card.Header className="bg-white py-3 border-0">
          <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faChartLine} className="me-2" />
            Activity Summary
          </h6>
        </Card.Header>
        <Card.Body className="p-4">
          <Row className="g-3">
            <Col xs={12} md={6}>
              <div className="table-responsive">
                <Table bordered hover responsive className="mb-0 rounded-3">
                  <tbody>
                    <tr>
                      <th className="bg-light" style={{width: "50%"}}>Total Check-ins</th>
                      <td>{checkinData.total_entries}</td>
                    </tr>
                    <tr>
                      <th className="bg-light">Daily Average</th>
                      <td>{checkinData.avg_daily.toFixed(1)}</td>
                    </tr>
                    <tr>
                      <th className="bg-light">Maximum Daily Check-ins</th>
                      <td>{checkinData.max_daily} ({checkinData.max_day})</td>
                    </tr>
                    <tr>
                      <th className="bg-light">Minimum Daily Check-ins</th>
                      <td>{checkinData.min_daily} ({checkinData.min_day})</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="table-responsive">
                <Table bordered hover responsive className="mb-0 rounded-3">
                  <tbody>
                    <tr>
                      <th className="bg-light" style={{width: "50%"}}>Most Active Hour</th>
                      <td>{HOURLY_LABELS[checkinData.most_active_hour]} ({checkinData.hourly_counts[checkinData.most_active_hour]} check-ins)</td>
                    </tr>
                    <tr>
                      <th className="bg-light">Most Active Day</th>
                      <td>{DAY_NAMES[checkinData.most_active_dow]} ({checkinData.day_of_week_counts[checkinData.most_active_dow]} check-ins)</td>
                    </tr>
                    <tr>
                      <th className="bg-light">Access Granted</th>
                      <td>{checkinData.granted_count} ({checkinData.granted_percentage.toFixed(1)}%)</td>
                    </tr>
                    <tr>
                      <th className="bg-light">Access Denied</th>
                      <td>{checkinData.denied_count} ({checkinData.denied_percentage.toFixed(1)}%)</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Col>
          </Row>
        </Card.Body>
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
        }
        
        .table tbody td {
          vertical-align: middle;
          padding: 0.75rem 0.5rem;
        }
        
        .table tbody th {
          vertical-align: middle;
          font-weight: 600;
          padding: 0.75rem 0.5rem;
        }
        
        /* Chart container styling */
        .chart-container {
          transition: height 0.3s ease;
          border-radius: 0.5rem;
          padding: 0.5rem;
        }
        
        /* Form control styling */
        .form-control, .form-select {
          border: 1px solid rgba(229, 231, 235, 0.8);
          padding: 0.5rem 1rem;
          height: calc(2.5rem + 2px);
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
        
        /* Rounded-4 utility */
        .rounded-4 {
          border-radius: 0.75rem !important;
        }
        
        /* Responsive adjustments */
        @media (max-width: 767.98px) {
          .h3 {
            font-size: 1.35rem;
          }
          
          .table th, .table td {
            padding: 0.6rem 0.5rem;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </Container>
  );
};

export default CheckinTrends;




