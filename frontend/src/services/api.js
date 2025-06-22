import axios from 'axios';

// Create axios instance
const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});



// Add request interceptor for auth
apiClient.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  console.log('Sending request with token:', token ? 'Token exists' : 'No token');
  console.log('Request URL:', config.url);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Define API methods
const api = {

  // Auth endpoints
  login: (email, password) =>
    apiClient.post('/login', { username: email, password }, { withCredentials: true }),

  logout: () =>
    apiClient.post('/logout', {}, { withCredentials: true }),

  checkSession: () =>
    apiClient.get('/check-session', { withCredentials: true }),

  // Dashboard data
  getDashboardData: () =>
    apiClient.get('/dashboard'),

  // RFID entries
  getRfidEntries: (page = 1) =>
    apiClient.get(`/rfid_entries?page=${page}`),

  // Checkin trends
  getCheckinTrendsData: (period = '7', startDate = null, endDate = null) => {
    let url = `/checkin_trends?period=${period}`;
    if (period === 'custom' && startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }
    return apiClient.get(url);
  },

  // Room frequency
  getRoomFrequency: () =>
    apiClient.get('/room_frequency'),



  updateUser: (userData) =>
    apiClient.put(`/users/${userData.id}`, userData),

  getUserHistory: (userId) =>
    apiClient.get(`/users/${userId}/history`),

    // NEW METHOD: Get all activity history with pagination
  getAllActivityHistory: (page = 1, pageSize = 10) =>
    apiClient.get(`/users/activity-history?page=${page}&page_size=${pageSize}`),


  // Tables management
  getTables: () =>
    apiClient.get('/manage_tables'),

  updateTables: (productChanges, cardChanges) =>
    apiClient.post('/manage_tables', {
      product_changes: productChanges,
      card_changes: cardChanges
    }),

  // User management with role-based permissions
  getUsers: () =>
    apiClient.get('/users'),

  addUser: (userData) =>
    apiClient.post('/users', userData),

  deleteUser: (userId) =>
    apiClient.delete(`/users/${userId}`),

  // Guest management
  registerGuest: (guestData) =>
    apiClient.post('/register_guest', guestData),

  getGuests: () =>
    apiClient.get('/guests'),

  updateGuest: (guestId, guestData) =>
    apiClient.put(`/guests/${guestId}`, guestData),

  deleteGuest: (guestId) =>
    apiClient.delete(`/guests/${guestId}`),

  // Individual product/card operations
  addProduct: (productId, roomId) =>
    apiClient.post('/product', {
      product_id: productId,
      room_id: roomId
    }),

  deleteProduct: (productId) =>
    apiClient.delete(`/product/${productId}`),

  addCard: (productId, cardId) =>
    apiClient.post('/card', {
      product_id: productId,
      card_id: cardId
    }),

  deleteCard: (productId, cardId) =>
    apiClient.delete(`/card/${productId}/${cardId}`),

  getHelpMessages: () =>
    apiClient.get('/help-messages'),

  sendHelpMessage: (messageData) =>
    apiClient.post('/help-messages', messageData),


  getHelpdeskRecipients: () =>
    apiClient.get('/helpdesk/available-recipients'),


  getAccessMatrix: () =>
    apiClient.get('/access_matrix'),

  updateAccessMatrix: (matrix) =>
    apiClient.post('/access_matrix', { matrix }),

  // VIP rooms related API methods
  getVipRooms: () =>
    apiClient.get('/vip_rooms'),

  addVipRoom: (productId, vipRooms) =>
    apiClient.post('/vip_room', {
      product_id: productId,
      vip_rooms: vipRooms
    }),

  deleteVipRoom: (productId) =>
    apiClient.delete(`/vip_room/${productId}`),


  // Updated to accept roomId parameter
  getSystemHealth: (roomId = null) => {
    let url = '/system_health';
    if (roomId) {
      url += `?room_id=${roomId}`; // Change to room_id
    }
    return apiClient.get(url);
  },

  // OTA update initiation with room ID
  initiateOtaUpdate: (updateUrl, roomId = null) => {
    const data = { update_url: updateUrl };
    if (roomId) {
      data.room_id = roomId; // Change to room_id
    }
    return apiClient.post('/initiate_ota_update', data);
  },

  // Get OTA update details with optional room filtering
  getOtaDetails: (roomId = null) => {
    let url = '/ota';
    if (roomId) {
      url += `?room_id=${roomId}`; // Change to room_id
    }
    return apiClient.get(url);
  },

  // Get system health history with optional room filtering
  getSystemHealthHistory: (limit = 10, roomId = null) => {
    let url = `/system_health/history?limit=${limit}`;
    if (roomId) {
      url += `&room_id=${roomId}`; // Change to room_id
    }
    return apiClient.get(url);
  },

  getAllSystemHealthHistory: (limit = 50) => {
  let url = `/system_health/history/all?limit=${limit}`;
  return apiClient.get(url);
},



  // Card scanning and assignment
  getRooms: () =>
    apiClient.get('/rooms'),

  getPackageTypes: () =>
    apiClient.get('/package_types'),

  assignCard: (cardData) =>
    apiClient.post('/assign_card', cardData),

  getPastGuests: () =>
    apiClient.get('/guests/past'),

    // Management staff APIs
  getManagers: () => 
    apiClient.get('/managers'),

  registerManager: (managerData) => 
    apiClient.post('/managers', managerData),

  updateManager: (managerId, managerData) => 
    apiClient.put(`/managers/${managerId}`, managerData),

  deleteManager: (managerId) => 
    apiClient.delete(`/managers/${managerId}`),
  getCardPackages: () =>
  apiClient.get('/card_packages'),

};

export default api;



