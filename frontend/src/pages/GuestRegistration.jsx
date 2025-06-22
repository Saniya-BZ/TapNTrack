
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faExclamationTriangle, faCheckCircle, faSpinner,faUserFriends,faIdCard,faAddressCard,faMapMarkerAlt,faDoorOpen,faCreditCard,faCalendarAlt,faCalendarCheck,faEdit,faTrash,faSave,faTimes,faUserPlus,faSearch,faHistory,faDownload, faSync      
} from '@fortawesome/free-solid-svg-icons';
import { Container, Row, Col, Card, Button, Alert, Table, Badge } from 'react-bootstrap';
import api from '../services/api';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import axios from 'axios';

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

const GuestRegistration = () => {
  
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [guests, setGuests] = useState([]);
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [deniedRooms, setDeniedRooms] = useState([]);
  const [deniedCardProducts, setDeniedCardProducts] = useState([]);

  
  // Available rooms and cards from ManageTables
  const [availableRooms, setAvailableRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]); // Store all rooms
  const [availableCards, setAvailableCards] = useState([]);
  const [cardsByProduct, setCardsByProduct] = useState({});
  // const [roomToProductMap, setRoomToProductMap] = useState({});
  const [roomToProductMap, setRoomToProductMap] = useState({});
  const [filteredCards, setFilteredCards] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [refreshingGuests, setRefreshingGuests] = useState(false);
  const [refreshingPastGuests, setRefreshingPastGuests] = useState(false);
  const [roomAvailability, setRoomAvailability] = useState({});
  

  // Add a new state for past guests
  const [pastGuests, setPastGuests] = useState([]);
  const [loadingPastGuests, setLoadingPastGuests] = useState(false);


  
  const [guestForm, setGuestForm] = useState({
    guestId: '',
    name: '',
    idType: 'aadhar',
    idNumber: '',
    address: '',
    roomId: '',
    cardUiId: '',
    checkinTime: new Date(),
    checkoutTime: new Date(new Date().setDate(new Date().getDate() + 1))
  });



  const handleRefreshGuests = () => {
    setRefreshingGuests(true);
    fetchGuests().finally(() => {
      setRefreshingGuests(false);
    });
  };
  
  const handleRefreshPastGuests = () => {
    setRefreshingPastGuests(true);
    fetchPastGuests().finally(() => {
      setRefreshingPastGuests(false);
    });
  };


  // Add export functions for both tables
  const handleExportGuests = () => {
    const headers = ['Guest ID', 'Name', 'ID Type', 'ID Number', 'Address', 'Room ID', 'Card UI ID', 'Check-in Time', 'Check-out Time'];
    
    let csvContent = headers.join(',') + '\n';
    
    filteredGuests.forEach(guest => {
      const row = [
        guest.guestId,
        `"${guest.name.replace(/"/g, '""')}"`, // Handle names with commas
        guest.idType,
        guest.idNumber,
        `"${(guest.address || '').replace(/"/g, '""')}"`,
        guest.roomId,
        guest.cardUiId,
        formatDate(guest.checkinTime),
        formatDate(guest.checkoutTime)
      ];
      csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'active_guests.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


    const handleExportPastGuests = () => {
    const headers = ['Guest ID', 'Name', 'ID Type', 'ID Number', 'Address', 'Room ID', 'Card UI ID', 'Check-in Time', 'Check-out Time'];
    
    let csvContent = headers.join(',') + '\n';
    
    pastGuests.forEach(guest => {
      const row = [
        guest.guestId,
        `"${guest.name.replace(/"/g, '""')}"`,
        guest.idType,
        guest.idNumber,
        `"${(guest.address || '').replace(/"/g, '""')}"`,
        guest.roomId,
        guest.cardUiId,
        formatDate(guest.checkinTime),
        formatDate(guest.checkoutTime)
      ];
      csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'past_guests_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  


  


// // Modify the fetchDeniedEntries function with case-insensitive checks
// const fetchDeniedEntries = async () => {
//   try {
//     const response = await axios.get(`http://localhost:5000/api/rfid_entries`, {
//       headers: {
//         'Authorization': `Bearer ${localStorage.getItem('token')}`
//       }
//     });
    
//     // Process entries to get rooms with denied access and deleted cards
//     if (response.data && response.data.entries) {
//       // Get the most recent entry for each product_id (room)
//       const entriesByProduct = {};
//       // Track denied/deleted card-product combinations
//       const deniedCards = {};
//       // Track globally deleted cards (should be excluded from all products)
//       const deletedCards = new Set();
      
//       response.data.entries.forEach(entry => {
//         const productId = entry.product_id;
//         const status = entry.access_status.toLowerCase();
        
//         // If we haven't seen this product_id or this entry is newer, update
//         if (!entriesByProduct[productId] || 
//             new Date(entry.timestamp) > new Date(entriesByProduct[productId].timestamp)) {
//           entriesByProduct[productId] = entry;
//         }
        
//         // Track denied card-product combinations (case-insensitive)
//         if (status.includes('denied')) {
//           if (!deniedCards[productId]) {
//             deniedCards[productId] = new Set();
//           }
//           deniedCards[productId].add(entry.uid);
//         }
        
//         // Track deleted cards globally - these should be excluded everywhere (case-insensitive)
//         if (status.includes('deleted')) {
//           deletedCards.add(entry.uid);
//         }
//       });
      
//       // Get product_ids of rooms with denied access in their most recent entry
//       const deniedProductIds = Object.values(entriesByProduct)
//         .filter(entry => entry.access_status.toLowerCase().includes('denied') || entry.access_status.toLowerCase().includes('deleted'))
//         .map(entry => entry.product_id.toString());
      
//       // Map product_ids to room_ids
//       const deniedRoomIds = [];
//       deniedProductIds.forEach(productId => {
//         const roomId = roomToProductMap[productId];
//         if (roomId) deniedRoomIds.push(roomId);
//       });
      
//       // Store the denied cards
//       setDeniedRooms(deniedRoomIds);
//       setDeniedCardProducts({ ...deniedCards, deletedCards: deletedCards });
//     }
//   } catch (err) {
//     console.error('Error fetching denied entries:', err);
//   }
// };


// ...existing code...
const fetchDeniedEntries = async () => {
  try {
    const response = await axios.get(`http://localhost:5000/api/rfid_entries`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (response.data && response.data.entries) {
      // Track latest entry for each card-product and card globally
      const latestEntryByProductCard = {};
      const latestEntryByCard = {};

      response.data.entries.forEach(entry => {
        const productId = entry.product_id;
        const cardUid = entry.uid;
        const timestamp = new Date(entry.timestamp);

        // Track latest entry for card-product
        const key = `${productId}_${cardUid}`;
        if (!latestEntryByProductCard[key] || timestamp > new Date(latestEntryByProductCard[key].timestamp)) {
          latestEntryByProductCard[key] = entry;
        }

        // Track latest entry for card globally
        if (!latestEntryByCard[cardUid] || timestamp > new Date(latestEntryByCard[cardUid].timestamp)) {
          latestEntryByCard[cardUid] = entry;
        }
      });

      // Now, determine denied rooms and denied/deleted cards
      const deniedCards = {};
      const deletedCards = new Set();
      const deniedProductIds = [];

      // Check latest status for each card-product
      Object.entries(latestEntryByProductCard).forEach(([key, entry]) => {
        const status = entry.access_status.toLowerCase();
        const productId = entry.product_id;
        const cardUid = entry.uid;

        // If latest status is denied and not reactivated/granted/new
        if (
          (status.includes('denied') || status.includes('deleted')) &&
          !status.match(/reactivated|granted|new/)
        ) {
          if (!deniedCards[productId]) deniedCards[productId] = new Set();
          deniedCards[productId].add(cardUid);
        }
      });

      // Check latest status for each card globally
      Object.entries(latestEntryByCard).forEach(([cardUid, entry]) => {
        const status = entry.access_status.toLowerCase();
        if (
          status.includes('deleted') &&
          !status.match(/reactivated|granted|new/)
        ) {
          deletedCards.add(cardUid);
        }
      });

      // Denied rooms: if latest entry for product is denied/deleted and not reactivated/granted/new
      const entriesByProduct = {};
      response.data.entries.forEach(entry => {
        const productId = entry.product_id;
        const timestamp = new Date(entry.timestamp);
        if (!entriesByProduct[productId] || timestamp > new Date(entriesByProduct[productId].timestamp)) {
          entriesByProduct[productId] = entry;
        }
      });
      Object.values(entriesByProduct).forEach(entry => {
        const status = entry.access_status.toLowerCase();
        if (
          (status.includes('denied') || status.includes('deleted')) &&
          !status.match(/reactivated|granted|new/)
        ) {
          deniedProductIds.push(entry.product_id.toString());
        }
      });

      // Map product_ids to room_ids
      const deniedRoomIds = [];
      deniedProductIds.forEach(productId => {
        const roomId = roomToProductMap[productId];
        if (roomId) deniedRoomIds.push(roomId);
      });

      setDeniedRooms(deniedRoomIds);
      setDeniedCardProducts({ ...deniedCards, deletedCards: deletedCards });
    }
  } catch (err) {
    console.error('Error fetching denied entries:', err);
  }
};
// ...existing code...



// Modify the handleInputChange function to filter out both denied and deleted cards
const handleInputChange = (e) => {
  const { name, value } = e.target;

  if (name === 'roomId') {
    setGuestForm({
      ...guestForm,
      [name]: value,
      cardUiId: ''
    });

    // Find the product ID for the selected room
    const productId = roomToProductMap[value];

    // Get the cards for this product, or an empty array if none exist
    let cardsForProduct = productId && cardsByProduct[productId] ? cardsByProduct[productId] : [];

    // Exclude cards already assigned to active guests (except when editing and keeping the same card)
    const usedCards = guests
      .filter(g => editingGuestId ? g.id !== editingGuestId : true)
      .map(g => g.cardUiId);

    // Get cards denied for this specific product
    const deniedCardsForProduct = deniedCardProducts[productId] ? [...deniedCardProducts[productId]] : [];
    
    // Get globally deleted cards
    const deletedCards = deniedCardProducts.deletedCards ? [...deniedCardProducts.deletedCards] : [];

    // Filter out used, denied, and deleted cards
    cardsForProduct = cardsForProduct.filter(cardId => 
      !usedCards.includes(cardId) && 
      !deniedCardsForProduct.includes(cardId) &&
      !deletedCards.includes(cardId)
    );

    // Remove duplicates
    cardsForProduct = Array.from(new Set(cardsForProduct));

    setFilteredCards(cardsForProduct);
  } else {
    setGuestForm({
      ...guestForm,
      [name]: value
    });
  }
};


const fetchPastGuests = async () => {
  try {
    setLoadingPastGuests(true);
    
    // Use the API utility which already handles token authentication
    const response = await api.getPastGuests();
    
    setPastGuests(response.data.past_guests || []);
  } catch (err) {
    console.error('Error fetching past guests:', err);
    setError('Failed to load past guests: ' + (err.response?.data?.error || err.message));
  } finally {
    setLoadingPastGuests(false);
  }
};

// Make sure this useEffect is in your component
useEffect(() => {
  fetchPastGuests();
}, []);


    useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    fetchGuests();
    fetchAvailableOptions();
    fetchDeniedEntries();
  }, []);
  
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [success, error]);
  
  useEffect(() => {
    updateAvailableRooms();
  }, [guests, allRooms, deniedRooms]);
  


  // Update your fetchGuests function (or similar function that gets registered guests)
const fetchGuests = async () => {
  try {
    setLoading(true);
    const response = await api.getGuests();
    
    // Filter out guests whose checkout time has passed
    const currentTime = new Date();
    const activeGuests = response.data.guests.filter(guest => {
      // Only include guests whose checkout time is in the future
      const checkoutTime = new Date(guest.checkoutTime);
      return checkoutTime > currentTime;
    });
    
    setGuests(activeGuests);
  } catch (err) {
    console.error('Error fetching guests:', err);
    setError('Failed to load guests: ' + (err.response?.data?.error || err.message));
  } finally {
    setLoading(false);
  }
};
  

  const updateAvailableRooms = () => {
  if (allRooms.length === 0) return;
  
  const currentTime = new Date();
  
  const occupiedRooms = guests
    .filter(guest => {
      if (editingGuestId === guest.id) return false;
      const checkoutTime = new Date(guest.checkoutTime);
      return checkoutTime > currentTime;
    })
    .map(guest => guest.roomId);
  
  // Filter out both occupied rooms AND denied rooms
  const filteredRooms = allRooms.filter(roomId => 
    !occupiedRooms.includes(roomId) && !deniedRooms.includes(roomId)
  );
  
  setAvailableRooms(filteredRooms);
};




// Modified fetchAvailableOptions function that properly filters out Master/Service cards
const fetchAvailableOptions = async () => {
  try {
    setLoadingOptions(true);
    
    // Fetch rooms data from getTables API
    const productsResponse = await api.getTables();
    
    if (productsResponse && productsResponse.data) {
      const products = productsResponse.data.products || [];
      const allRoomIds = products.map(product => product.room_id);
      
      setAllRooms(allRoomIds);
      setAvailableRooms(allRoomIds);
      
      const roomToProductMap = {};
      products.forEach(product => {
        roomToProductMap[product.room_id] = product.product_id;
      });
      
      setRoomToProductMap(roomToProductMap);
    }
    
    // Fetch all card packages to properly filter by package type
    const cardPackagesResponse = await axios.get('http://localhost:5000/api/card_packages', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (cardPackagesResponse?.data?.packages) {
      // Get all packages
      const allPackages = cardPackagesResponse.data.packages;
      
      // Create a map of card UIDs to their package types for easy lookup
      const cardPackageTypeMap = {};
      allPackages.forEach(pkg => {
        cardPackageTypeMap[pkg.uid] = pkg.package_type;
      });
      
      // Fetch access control data to get all cards
      const accessControlResponse = await axios.get('http://localhost:5000/api/access_control_data', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (accessControlResponse?.data?.products) {
        // Process all cards from all products
        const cardsByProduct = {};
        const allGuestCards = new Set();
        
        accessControlResponse.data.products.forEach(product => {
          if (product.cards && product.cards.length > 0) {
            // Filter cards that are NOT Master Card or Service Card
            const guestCards = product.cards.filter(card => {
              const packageType = cardPackageTypeMap[card.uid] || "General";
              return packageType !== 'Master Card' && packageType !== 'Service Card';
            }).map(card => card.uid);
            
            // Add filtered cards to the product
            cardsByProduct[product.product_id] = guestCards;
            
            // Add all filtered cards to the set of available cards
            guestCards.forEach(uid => allGuestCards.add(uid));
          }
        });
        
        setCardsByProduct(cardsByProduct);
        setAvailableCards([...allGuestCards]);
      }
    }
  } catch (err) {
    console.error('Error fetching available options:', err);
    setError('Failed to load rooms and cards: ' + (err.response?.data?.error || err.message));
  } finally {
    setLoadingOptions(false);
  }
};









  const handleDateChange = (date, field) => {
    setGuestForm({
      ...guestForm,
      [field]: date
    });
  };
  
  const resetForm = () => {
    setGuestForm({
      guestId: '',
      name: '',
      idType: 'aadhar',
      idNumber: '',
      address: '',
      roomId: '',
      cardUiId: '',
      checkinTime: new Date(),
      checkoutTime: new Date(new Date().setDate(new Date().getDate() + 1))
    });
    setEditingGuestId(null);
    setFilteredCards([]);
    
    updateAvailableRooms();
  };
  
  const startEdit = (guest) => {
    const editGuest = {
      ...guest,
      checkinTime: new Date(guest.checkinTime),
      checkoutTime: new Date(guest.checkoutTime)
    };
    
    setGuestForm(editGuest);
    setEditingGuestId(guest.id);
    
    const productId = roomToProductMap[guest.roomId];
    
    if (guest.roomId && productId && cardsByProduct[productId]) {
      setFilteredCards(cardsByProduct[productId]);
    } else {
      setFilteredCards([]);
    }
    
    updateAvailableRooms();
  };
  
  const cancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { guestId, name, idType, idNumber, address, roomId, cardUiId, checkinTime, checkoutTime } = guestForm;
    
    if (!guestId || !name || !idNumber || !roomId || !cardUiId) return setError('Please fill in all required fields');
    if (idType === 'aadhar' && !/^\d{12}$/.test(idNumber)) return setError('Aadhar number must be exactly 12 digits');
    if (idType === 'passport' && !/^[A-Z0-9]{8}$/i.test(idNumber)) return setError('Passport number must be exactly 8 characters');
    if (checkoutTime <= checkinTime) return setError('Checkout time must be after checkin time');
  
    setIsSubmitting(true);
    try {
      const formatDateForPostgres = (date) => {
        return date.getFullYear() + '-' + 
               String(date.getMonth() + 1).padStart(2, '0') + '-' + 
               String(date.getDate()).padStart(2, '0') + ' ' + 
               String(date.getHours()).padStart(2, '0') + ':' + 
               String(date.getMinutes()).padStart(2, '0') + ':' + 
               String(date.getSeconds()).padStart(2, '0');
      };
      
      const data = { 
        ...guestForm, 
        checkinTime: formatDateForPostgres(checkinTime),
        checkoutTime: formatDateForPostgres(checkoutTime)
      };
      
      const res = editingGuestId ? 
        await api.updateGuest(editingGuestId, data) : 
        await api.registerGuest(data);
        
      setSuccess(editingGuestId ? 'Guest information updated successfully!' : 'Guest registered successfully!');
      fetchGuests();
      resetForm();
    } catch (err) {
      setError('Failed to process guest: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };
    
  const handleDeleteGuest = async (guestId) => {
    if (!window.confirm('Are you sure you want to delete this guest registration?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await api.deleteGuest(guestId);
      
      setSuccess('Guest deleted successfully!');
      fetchGuests();
    } catch (err) {
      console.error('Error deleting guest:', err);
      setError('Failed to delete guest: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const resetError = () => {
    if (error) {
      setError(null);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch (err) {
      console.error('Error formatting date:', err);
      return dateString;
    }
  };
  // Filtered guests based on search term
  const filteredGuests = guests.filter(guest => 
    guest.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    guest.guestId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    guest.roomId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guest.cardUiId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container-fluid px-md-4 py-4" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Header Section */}
      <div className="row mb-4 align-items-center">
        <div className="col-md-6 mb-3 mb-md-0">
          <h2 className="fw-bold mb-0" style={{ color: ZENV_COLORS.primary }}>
            Guest Registration
          </h2>
          <p className="text-muted mb-0">Manage guest check-ins and room assignments</p>
        </div>
        <div className="col-md-6">
          <div className="d-flex justify-content-md-end">
            <div className="position-relative me-2" style={{ width: '250px' }}>
              <input 
                type="text" 
                className="form-control form-control-sm rounded-pill pe-5 border-0"
                placeholder="Search guests..."
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
      
      {/* Stats Overview Cards */}
<div className="row g-3 mb-4">
  <div className="col-xl col-md-6 col-sm-6">
    <div className="card h-100 shadow-sm border-0 rounded-4">
      <div className="card-body p-3">
        <div className="row g-0 align-items-center">
          <div className="col me-2">
            <div className="text-xs text-uppercase text-muted fw-bold mb-1">
              Total Guests
            </div>
            <div className="h3 mb-0 fw-bold">
              {guests.length}
            </div>
          </div>
          <div className="col-auto">
            <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
              <FontAwesomeIcon icon={faUserFriends} style={{ color: ZENV_COLORS.primary }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div className="col-xl col-md-6 col-sm-6">
    <div className="card h-100 shadow-sm border-0 rounded-4">
      <div className="card-body p-3">
        <div className="row g-0 align-items-center">
          <div className="col me-2">
            <div className="text-xs text-uppercase text-muted fw-bold mb-1">
              Available Rooms
            </div>
            <div className="h3 mb-0 fw-bold">
              {availableRooms.length}
            </div>
          </div>
          <div className="col-auto">
            <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
              <FontAwesomeIcon icon={faDoorOpen} style={{ color: ZENV_COLORS.primary}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div className="col-xl col-md-6 col-sm-6">
    <div className="card h-100 shadow-sm border-0 rounded-4">
      <div className="card-body p-3">
        <div className="row g-0 align-items-center">
          <div className="col me-2">
            <div className="text-xs text-uppercase text-muted fw-bold mb-1">
              Available Cards
            </div>
            <div className="h3 mb-0 fw-bold" >
              {availableCards.length}
            </div>
          </div>
          <div className="col-auto">
            <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue}}>
              <FontAwesomeIcon icon={faCreditCard} style={{ color: ZENV_COLORS.primary }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div> 
  
  <div className="col-xl col-md-6 col-sm-6">
    <div className="card h-100 shadow-sm border-0 rounded-4">
      <div className="card-body p-3">
        <div className="row g-0 align-items-center">
          <div className="col me-2">
            <div className="text-xs text-uppercase text-muted fw-bold mb-1">
              Today's Check-ins
            </div>
            <div className="h3 mb-0 fw-bold" >
              {guests.filter(g => {
                const today = new Date();
                const checkin = new Date(g.checkinTime);
                return checkin.toDateString() === today.toDateString();
              }).length}
            </div>
          </div>
          <div className="col-auto">
            <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
              <FontAwesomeIcon icon={faCalendarCheck} style={{ color: ZENV_COLORS.primary }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div className="col-xl col-md-6 col-sm-6">
    <div className="card h-100 shadow-sm border-0 rounded-4">
      <div className="card-body p-3">
        <div className="row g-0 align-items-center">
          <div className="col me-2">
            <div className="text-xs text-uppercase text-muted fw-bold mb-1">
              Past Guests
            </div>
            <div className="h3 mb-0 fw-bold">
              {pastGuests.length}
            </div>
          </div>
          <div className="col-auto">
            <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightPurple }}>
              <FontAwesomeIcon icon={faHistory} style={{ color: ZENV_COLORS.primary }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>



      
      {/* Guest Registration Form Card */}
      <div className="card shadow-sm mb-4 border-0 rounded-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-0">
          <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faUserPlus} className="me-2" /> 
            {editingGuestId ? 'Edit Guest Information' : 'Register New Guest'}
          </h6>
          {editingGuestId && (
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
              {/* First row with guest identification */}
              <div className="col-md-6">
                <label htmlFor="guestId" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faIdCard} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Guest ID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg rounded-3 shadow-sm border-0"
                  id="guestId"
                  name="guestId"
                  value={guestForm.guestId}
                  onChange={handleInputChange}
                  placeholder="Enter guest ID"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="name" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faUserFriends} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg rounded-3 shadow-sm border-0"
                  id="name"
                  name="name"
                  value={guestForm.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              {/* Second row with ID information */}
              <div className="col-md-3">
                <label htmlFor="idType" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faAddressCard} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  ID Type <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-lg rounded-3 shadow-sm border-0"
                  id="idType"
                  name="idType"
                  value={guestForm.idType}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                >
                  <option value="aadhar">Aadhar</option>
                  <option value="passport">Passport</option>
                </select>
              </div>

              <div className="col-md-3">
                <label htmlFor="idNumber" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faIdCard} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  {guestForm.idType === 'aadhar' ? 'Aadhar Number' : 'Passport Number'} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg rounded-3 shadow-sm border-0"
                  id="idNumber"
                  name="idNumber"
                  value={guestForm.idNumber}
                  onChange={handleInputChange}
                  placeholder={
                    guestForm.idType === 'aadhar'
                      ? 'Enter 12-digit Aadhar number'
                      : 'Enter Passport number'
                  }
                  required
                  disabled={isSubmitting}
                  maxLength={guestForm.idType === 'aadhar' ? 12 : 8}
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="address" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Address
                </label>
                <textarea
                  className="form-control rounded-3 shadow-sm border-0"
                  id="address"
                  name="address"
                  value={guestForm.address}
                  onChange={handleInputChange}
                  placeholder="Enter address"
                  disabled={isSubmitting}
                  rows={2}
                />
              </div>
              
              {/* Third row with room and card assignment */}
              <div className="col-md-6">
                <label htmlFor="roomId" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faDoorOpen} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Room ID <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-lg rounded-3 shadow-sm border-0"
                  id="roomId"
                  name="roomId"
                  value={guestForm.roomId}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting || loadingOptions}
                >
                  <option value="">{loadingOptions ? 'Loading rooms...' : 'Select Room ID'}</option>
                  {editingGuestId && guestForm.roomId && !availableRooms.includes(guestForm.roomId) && (
                    <option key={`editing-${guestForm.roomId}`} value={guestForm.roomId}>
                      {guestForm.roomId}
                    </option>
                  )}
                  {availableRooms.map((roomId, index) => (
                    <option key={index} value={roomId}>{roomId}</option>
                  ))}
                </select>
                {availableRooms.length === 0 && !loadingOptions && !editingGuestId && (
                  <div className="form-text mt-1" style={{ color: ZENV_COLORS.orange }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
                    All rooms are currently registered to guests
                  </div>
                )}
              </div>
              
              <div className="col-md-6">
                <label htmlFor="cardUiId" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faCreditCard} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Card UI ID <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-lg rounded-3 shadow-sm border-0"
                  id="cardUiId"
                  name="cardUiId"
                  value={guestForm.cardUiId}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting || loadingOptions || !guestForm.roomId}
                >
                  <option value="">{loadingOptions 
                    ? 'Loading cards...' 
                    : !guestForm.roomId 
                      ? 'Select a room first' 
                      : filteredCards.length > 0 
                        ? 'Select Card ID' 
                        : 'No cards available for this room'}
                  </option>
                  {filteredCards.map((cardId, index) => (
                    <option key={index} value={cardId}>{cardId}</option>
                  ))}
                </select>
              </div>
              
              {/* Fourth row with check-in and check-out dates */}
              <div className="col-md-6">
                <label htmlFor="checkinTime" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faCalendarAlt} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Check-in Time
                </label>
                <DatePicker
                  selected={guestForm.checkinTime}
                  onChange={(date) => handleDateChange(date, 'checkinTime')}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  timeCaption="Time"
                  dateFormat="MMMM d, yyyy h:mm aa"
                  className="form-control form-control-lg rounded-3 shadow-sm border-0"
                  disabled={isSubmitting}
                  wrapperClassName="w-100"
                />
              </div>
              
              <div className="col-md-6">
                <label htmlFor="checkoutTime" className="form-label fw-medium">
                  <FontAwesomeIcon icon={faCalendarCheck} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                  Check-out Time
                </label>
                <DatePicker
                  selected={guestForm.checkoutTime}
                  onChange={(date) => handleDateChange(date, 'checkoutTime')}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  timeCaption="Time"
                  dateFormat="MMMM d, yyyy h:mm aa"
                  className="form-control form-control-lg rounded-3 shadow-sm border-0"
                  minDate={guestForm.checkinTime}
                  disabled={isSubmitting}
                  wrapperClassName="w-100"
                />
              </div>
            </div>
            
            {/* Form Buttons */}
            <div className="d-flex justify-content-end gap-2">
              {editingGuestId ? (
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
                      Update Guest
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
                      Register Guest
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      
      {/* Guests List Card */}
      <div className="card shadow-sm border-0 rounded-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-0">
          <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
            <FontAwesomeIcon icon={faUserFriends} className="me-2" /> 
            Registered Guests
          </h6>


          <div className="small text-muted">
            Showing {filteredGuests.length} of {guests.length} guests
          </div>
        

     <div className="d-flex gap-2">
            <Button 
              variant="outline-secondary"
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleRefreshGuests}
              disabled={refreshingGuests}
              className="d-flex align-items-center rounded-pill"
            >
              <FontAwesomeIcon icon={faSync} spin={refreshingGuests} className="me-1" /> 
              <span className="d-none d-sm-inline">{refreshingGuests ? 'Refreshing...' : 'Refresh'}</span>
            </Button>

            <Button 
              variant="outline-primary" 
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleExportGuests}
              className="d-flex align-items-center rounded-pill"
              style={{ borderColor: ZENV_COLORS.primary, color: ZENV_COLORS.primary }}
            >
              <FontAwesomeIcon icon={faDownload} className="me-1" /> 
              <span className="d-none d-sm-inline">Export</span>
            </Button>
          </div>
        </div>
        <div className="card-body p-0">
          {refreshingGuests && (
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
                  <th className="ps-3">Guest ID</th>
                  <th>Name</th>
                  <th>ID Number</th>
                  <th>Room ID</th>
                  <th className="d-none d-md-table-cell">Card UI ID</th>
                  <th className="d-none d-md-table-cell">Check-in</th>
                  <th className="d-none d-md-table-cell">Check-out</th>
                  <th className="text-center pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      <FontAwesomeIcon icon={faSpinner} spin className="me-2" style={{ color: ZENV_COLORS.primary }} /> 
                      Loading guests...
                    </td>
                  </tr>
                ) : filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      {guests.length > 0 ? 'No matching guests found' : 'No guests registered yet'}
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((guest) => (
                    <tr key={guest.id}>
                      <td className="ps-3 fw-medium" style={{ color: ZENV_COLORS.primary }}>{guest.guestId}</td>
                      <td>{guest.name}</td>


                        <td>
                    <span className="badge rounded-pill px-3 py-2" 
                      style={{ backgroundColor: ZENV_COLORS.primary, color: 'white' }}>
                      {guest.idType === 'aadhar' ? 'Aadhar: ' : 'Passport: '}{guest.idNumber}
                    </span>
                  </td>




                      <td>
                        <span className="badge rounded-pill px-3 py-2" 
                          style={{ backgroundColor: ZENV_COLORS.primary, color: 'white' }}>
                          {guest.roomId}
                        </span>
                      </td>
                      <td className="d-none d-md-table-cell">
                        <span className="badge rounded-pill px-3 py-2" 
                          style={{ backgroundColor: ZENV_COLORS.primary, color: 'white' }}>
                          <FontAwesomeIcon icon={faCreditCard} className="me-1" />
                          {guest.cardUiId}
                        </span>
                      </td>
                      <td className="d-none d-md-table-cell">
                        <small>
                          <FontAwesomeIcon icon={faCalendarAlt} className="me-1" style={{ color: ZENV_COLORS.primary }} />
                          {formatDate(guest.checkinTime)}
                        </small>
                      </td>
                      <td className="d-none d-md-table-cell">
                        <small>
                          <FontAwesomeIcon icon={faCalendarCheck} className="me-1" style={{ color: ZENV_COLORS.primary }} />
                          {formatDate(guest.checkoutTime)}
                        </small>
                      </td>
                      <td className="text-center pe-3">
                        <button
                          className="btn btn-sm rounded-pill px-3 me-2"
                          style={{ backgroundColor: ZENV_COLORS.lightBlue, color: ZENV_COLORS.primary }}
                          onClick={() => startEdit(guest)}
                          disabled={isSubmitting || editingGuestId === guest.id}
                        >
                          <FontAwesomeIcon icon={faEdit} className="me-1" /> Edit
                        </button>
                        <button
                          className="btn btn-sm rounded-pill px-3"
                          style={{ backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}
                          onClick={() => handleDeleteGuest(guest.id)}
                          disabled={isSubmitting || editingGuestId === guest.id}
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

<div className="card shadow-sm border-0 rounded-4 mt-4">
  <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-0">
    <h6 className="m-0 fw-bold" style={{ color: ZENV_COLORS.primary }}>
      <FontAwesomeIcon icon={faHistory} className="me-2" /> 
      Past Guest History
    </h6>


    <div className="small text-muted">
      Showing {pastGuests.length} past guests
    </div>
          <div className="d-flex gap-2">
            <Button 
              variant="outline-secondary"
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleRefreshPastGuests}
              disabled={refreshingPastGuests}
              className="d-flex align-items-center rounded-pill"
            >
              <FontAwesomeIcon icon={faSync} spin={refreshingPastGuests} className="me-1" /> 
              <span className="d-none d-sm-inline">{refreshingPastGuests ? 'Refreshing...' : 'Refresh'}</span>
            </Button>

            <Button 
              variant="outline-primary" 
              size={windowWidth < 576 ? "sm" : ""}
              onClick={handleExportPastGuests}
              className="d-flex align-items-center rounded-pill"
              style={{ borderColor: ZENV_COLORS.primary, color: ZENV_COLORS.primary }}
            >
              <FontAwesomeIcon icon={faDownload} className="me-1" /> 
              <span className="d-none d-sm-inline">Export</span>
            </Button>
          </div>
        </div>
        <div className="card-body p-0">
          {refreshingPastGuests && (
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
            <th className="ps-3">Guest ID</th>
            <th>Name</th>
            <th>ID Number</th> {/* Add this new column */}
            <th>Room ID</th>
            <th className="d-none d-md-table-cell">Card UI ID</th>
            <th className="d-none d-md-table-cell">Check-in</th>
            <th className="d-none d-md-table-cell">Check-out</th>
          </tr>
        </thead>
        <tbody>
          {loadingPastGuests ? (
            <tr>
              <td colSpan="6" className="text-center py-4">
                <FontAwesomeIcon icon={faSpinner} spin className="me-2" style={{ color: ZENV_COLORS.primary }} /> 
                Loading past guests...
              </td>
            </tr>
          ) : pastGuests.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-4 text-muted">
                No past guest records available
              </td>
            </tr>
          ) : (
            pastGuests.map((guest) => (
              <tr key={guest.id}>
                <td className="ps-3 fw-medium" style={{ color: ZENV_COLORS.primary }}>{guest.guestId}</td>
                <td>{guest.name}</td>

              <td>
            <span className="badge rounded-pill px-3 py-2" 
              style={{ backgroundColor: ZENV_COLORS.primary, color: 'white' }}>
              {guest.idType === 'aadhar' ? 'Aadhar: ' : 'Passport: '}{guest.idNumber}
            </span>
          </td>


                <td>
                  <span className="badge rounded-pill px-3 py-2" 
                    style={{ backgroundColor: ZENV_COLORS.purple, color: 'white' }}>
                    {guest.roomId}
                  </span>
                </td>



                <td className="d-none d-md-table-cell">
                  <span className="badge rounded-pill px-3 py-2" 
                    style={{ backgroundColor: ZENV_COLORS.purple, color: 'white' }}>
                    <FontAwesomeIcon icon={faCreditCard} className="me-1" />
                    {guest.cardUiId}
                  </span>
                </td>


                <td className="d-none d-md-table-cell">
                  <small>
                    <FontAwesomeIcon icon={faCalendarAlt} className="me-1" style={{ color: ZENV_COLORS.primary }} />
                    {formatDate(guest.checkinTime)}
                  </small>
                </td>
                <td className="d-none d-md-table-cell">
                  <small>
                    <FontAwesomeIcon icon={faCalendarCheck} className="me-1" style={{ color: ZENV_COLORS.primary }} />
                    {formatDate(guest.checkoutTime)}
                  </small>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
</div>


      
      {/* Custom styling for improved appearance */}
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
        
        /* Custom DatePicker styling */
        .react-datepicker-wrapper {
          display: block;
          width: 100%;
        }
        
        .react-datepicker__input-container input {
          background-color: white;
        }
        
        /* Rounded style */
        .rounded-4 {
          border-radius: 0.75rem !important;
        }
      `}</style>
    </div>
  );
};

export default GuestRegistration;



 