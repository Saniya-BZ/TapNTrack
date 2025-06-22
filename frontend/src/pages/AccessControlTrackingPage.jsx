import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tabs, Tab, Card, Container, Badge, Button, Row, Col, Spinner , Form, Modal,ListGroup} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSync, faBuilding, faCreditCard, faUser, faCheckCircle, 
  faTimesCircle, faIdCard, faDoorOpen, faCalendarCheck, 
  faCalendarTimes, faLayerGroup, faInfoCircle, faUserTie,
   faCheck, faTimes, faStar, faKey, faTools
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';




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

const AccessControlTrackingPage = () => {
  const [accessControlData, setAccessControlData] = useState(null);
  const [manageTablesData, setManageTablesData] = useState(null);
  const [cardPackages, setCardPackages] = useState(null);
  const [vipRooms, setVipRooms] = useState(null);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [key, setKey] = useState('products');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [universalCards, setUniversalCards] = useState({ masterCards: [], serviceCards: [] });
  const [accessStatusMap, setAccessStatusMap] = useState({});

  
  const PACKAGE_TYPES = ["Standard", "Deluxe", "Suite", "Executive", "General", "Service Card", "Master Card"];

  // Get package color based on type
  const getPackageColor = (packageType) => {
    switch (packageType) {
      case "Master Card": return { bg: 'danger', light: '#f8d7da' };
      case "Service Card": return { bg: 'warning', light: '#fff3cd' };
      case "Executive": return { bg: ZENV_COLORS.purple, light: ZENV_COLORS.lightPurple };
      case "Suite": return { bg: ZENV_COLORS.teal, light: ZENV_COLORS.lightTeal };
      case "Deluxe": return { bg: ZENV_COLORS.green, light: ZENV_COLORS.lightGreen };
      case "Standard": return { bg: ZENV_COLORS.primary, light: ZENV_COLORS.lightBlue };
      default: return { bg: ZENV_COLORS.mediumGray, light: ZENV_COLORS.lightGray };
    }
  };





const fetchAllData = () => {
  setRefreshing(true);
  Promise.all([
    axios.get('http://localhost:5000/api/access_control_data'),
    axios.get('http://localhost:5000/api/manage_tables'),
    axios.get('http://localhost:5000/api/card_packages'),
    axios.get('http://localhost:5000/api/vip_rooms'),
    axios.get('http://localhost:5000/api/managers'),
    axios.get('http://localhost:5000/api/rfid_entries')
  ])
    .then(([accessControlRes, manageTablesRes, cardPackagesRes, vipRoomsRes, managersRes, rfidEntriesRes]) => {
      console.log('Access control data:', accessControlRes.data);
      
      // Process the RFID entries to get access status PER PRODUCT
      const productCardStatusMap = {};
      if (rfidEntriesRes?.data?.entries) {
        rfidEntriesRes.data.entries.forEach(entry => {
          // Create unique key for product-card combination
          const productCardKey = `${entry.product_id}-${entry.uid}`;
          
          if (!productCardStatusMap[productCardKey] || new Date(entry.timestamp) > new Date(productCardStatusMap[productCardKey].timestamp)) {
            productCardStatusMap[productCardKey] = {
              status: entry.access_status || entry.access, // Handle both access_status and access fields
              timestamp: entry.timestamp || entry.time,
              product_id: entry.product_id,
              uid: entry.uid
            };
          }
        });
        setAccessStatusMap(productCardStatusMap);
      }

      // Filter products to only include cards with granted access and not deleted FOR THAT SPECIFIC PRODUCT
      const filteredProducts = accessControlRes.data.products.map(product => {
        const uniqueCardUIDs = new Set();
        let productCards = [];
        
        // First, add existing product cards by access status
        if (product.cards && product.cards.length > 0) {
          product.cards.forEach(card => {
            // Check status for this specific product-card combination
            const productCardKey = `${product.product_id}-${card.uid}`;
            const cardStatus = productCardStatusMap[productCardKey]?.status || '';
            const isValidCard = cardStatus.toLowerCase().includes('granted') || (cardStatus.toLowerCase().includes('reactivated') || cardStatus.toLowerCase().includes('new'));

            if (isValidCard && !uniqueCardUIDs.has(card.uid)) {
              productCards.push(card);
              uniqueCardUIDs.add(card.uid);
            }
          });
        }

        // Then, add guest cards if they're not already included
        if (product.guests && product.guests.length > 0) {
          product.guests.forEach(guest => {
            if (guest.uid && !uniqueCardUIDs.has(guest.uid)) {
              // Check status for this specific product-card combination
              const productCardKey = `${product.product_id}-${guest.uid}`;
              const guestCardStatus = productCardStatusMap[productCardKey]?.status || '';
              const isValidGuestCard = guestCardStatus.toLowerCase().includes('granted') || (guestCardStatus.toLowerCase().includes('reactivated') ||  guestCardStatus.toLowerCase().includes('new'));

              if (isValidGuestCard) {
                productCards.push({
                  uid: guest.uid,
                  type: guest.package_type || 'Standard',
                  active: true,
                  isGuestCard: true
                });
                uniqueCardUIDs.add(guest.uid);
              }
            }
          });
        }
        
        return {
          ...product,
          cards: productCards
        };
      });




// Handle direct card assignments from card_packages - ensure ALL valid assignments are shown
if (cardPackagesRes.data && cardPackagesRes.data.packages) {
  const packageAssignments = cardPackagesRes.data.packages;
  
  // First, create a clear map of all product-card assignments from card_packages
  const cardAssignmentMap = {};
  
  packageAssignments.forEach(pkg => {
    const productId = pkg.product_id;
    const cardUid = pkg.uid;
    
    if (productId && cardUid) {
      // Create a unique key for each product-card combination
      const key = `${productId}-${cardUid}`;
      
      // Store the assignment in the map
      cardAssignmentMap[key] = {
        productId,
        cardUid,
        packageType: pkg.package_type || 'General'
      };
    }
  });
  
  // Add all valid card assignments to products
  Object.values(cardAssignmentMap).forEach(assignment => {
    const { productId, cardUid, packageType } = assignment;
    const productIndex = filteredProducts.findIndex(p => p.product_id === productId);
    
    if (productIndex >= 0) {
      // Check if the card already exists in the product's cards
      const existingCardIndex = filteredProducts[productIndex].cards.findIndex(c => c.uid === cardUid);
      
      // Create the product-card key for status check
      const productCardKey = `${productId}-${cardUid}`;
      const cardStatus = productCardStatusMap[productCardKey]?.status || '';
      
      // Consider a card valid unless it's explicitly deleted
      const isValidCard = !cardStatus.toLowerCase().includes('deleted');
      
      if (existingCardIndex < 0 && isValidCard) {
        // Add the card if it doesn't exist yet
        filteredProducts[productIndex].cards.push({
          uid: cardUid,
          type: packageType,
          active: true
        });
        console.log(`Added card ${cardUid} to product ${productId} with package ${packageType}`);
      } else if (existingCardIndex >= 0) {
        // Update existing card's package type
        filteredProducts[productIndex].cards[existingCardIndex].type = packageType;
      }
    }
  });
}


      // Update accessControlData with the enhanced filtered products
      setAccessControlData({
        ...accessControlRes.data,
        products: filteredProducts
      });
      
      setManageTablesData(manageTablesRes.data);
      setCardPackages(cardPackagesRes.data);
      setVipRooms(vipRoomsRes.data);
      setManagers(managersRes.data.managers || []);
      setLoading(false);
      setRefreshing(false);
    })
    .catch(err => {
      console.error('Error fetching data:', err);
      setLoading(false);
      setRefreshing(false);
    });
};




// Add this logging when a product is clicked
const handleProductClick = (product) => {
  console.log("Selected product:", product);
  console.log("Cards assigned to this product:", product.cards);
  
  // Check if guest cards are showing up properly
  if (product.guests && product.guests.length > 0) {
    console.log("Guest cards that should be available:", product.guests.map(g => g.uid));
  }
  
  setSelectedProduct(product);
  setShowModal(true);
};

  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Fetch data on initial load and when refresh is triggered
  useEffect(() => {
    fetchAllData();
  }, [lastRefresh]);

  // Log changes in guest data for debugging
  useEffect(() => {
    if (accessControlData) {
      console.log('Current guests:', getUniqueGuests());
    }
  }, [accessControlData]);


  useEffect(() => {
  if (accessControlData) {
    const masterCards = accessControlData.cards.filter(card => card.type === 'Master Card');
    const serviceCards = accessControlData.cards.filter(card => card.type === 'Service Card');
    setUniversalCards({ masterCards, serviceCards });
  }
}, [accessControlData]);




const getRoomNameByProductId = (productId) => {
  console.log("Fetching room name for productId:", productId);

  // Check if it's a VIP room from the vipRooms data
  const vipProduct = vipRooms?.vip_rooms.find(vip => vip.product_id === productId);

  if (vipProduct) {
    console.log("VIP Product Found:", vipProduct);
    return vipProduct.vip_rooms || 'Unknown VIP Room';  // Ensure that 'vip_rooms' is the correct property in your data
  }

  // If it's not a VIP room, fall back to regular product lookup
  const regularProduct = manageTablesData?.products.find(p => p.product_id === productId);
  if (regularProduct) {
    console.log("Regular Product Found:", regularProduct);
    return `${regularProduct.room_id}`;  // Assuming 'room_id' refers to regular rooms like R1, R2, etc.
  }

  console.log("Room not found for productId:", productId);
  return 'Unknown Room';  // Fallback if the product ID isn't found
};



  const getLinkedProductsForCard = (uid) => {
    if (!accessControlData || !accessControlData.products) return [];
    return accessControlData.products
      .filter(product => product.cards?.some(card => card.uid === uid))
      .map(product => product.product_id);
  };

  const getRoomId = (productId) => {
    if (manageTablesData) {
      const product = manageTablesData.products.find(p => p.product_id === productId);
      if (product) return product.room_id;
    }
    
    if (vipRooms) {
      const vipRoom = vipRooms.vip_rooms.find(v => v.product_id === productId);
      if (vipRoom) return vipRoom.vip_rooms;
    }
    
    return 'N/A';
  };

  const getUniqueGuests = () => {
    if (!accessControlData) return [];
    const guestMap = new Map();

    accessControlData.products.forEach(product => {
      product.guests?.forEach(guest => {
        if (!guestMap.has(guest.uid)) {
          guestMap.set(guest.uid, {
            ...guest,
            linkedProducts: [product.product_id],
            // Store access rooms from the guest object directly
            accessRooms: new Set(guest.access_rooms || [])
          });
        } else {
          // Add product to linked products if not already there
          const existingGuest = guestMap.get(guest.uid);
          if (!existingGuest.linkedProducts.includes(product.product_id)) {
            existingGuest.linkedProducts.push(product.product_id);
          }
          
          // Merge access rooms using Set to avoid duplicates
          guest.access_rooms?.forEach(room => {
            existingGuest.accessRooms.add(room);
          });
        }
      });
    });

    // Convert the map values to an array and convert Sets to Arrays
    return Array.from(guestMap.values()).map(guest => ({
      ...guest,
      accessRooms: Array.from(guest.accessRooms)
    }));
  };

  // Get all people (guests and managers)
  const getAllPeople = () => {
    const uniqueGuests = getUniqueGuests();
    
    // Convert managers to the same format as guests for consistent rendering
    const formattedManagers = managers.map(manager => ({
      uid: manager.cardUiId,
      name: manager.name,
      package_type: manager.role === 'manager' ? 'Master Card' : 'Service Card',
      role: manager.role, // Add role field to distinguish managers from guests
      managerId: manager.managerId, // Add managerId for display
      // Add default empty values for guest-specific fields
      linkedProducts: [],
      accessRooms: []
    }));
    
    // Return combined array of guests and managers
    return [...uniqueGuests, ...formattedManagers];
  };






// Add this debugging code inside your getCardsByPackageType function
const getCardsByPackageType = () => {
  if (!cardPackages || !accessControlData) return {};
  
  // Add this debugging to see what data you're receiving
  console.log("Card packages data:", cardPackages);
  console.log("Access control cards:", accessControlData.cards);
  console.log("Access status map:", accessStatusMap);
  
  const packageGroups = {};
  
  // Initialize package groups with empty arrays
  PACKAGE_TYPES.forEach(type => {
    packageGroups[type] = [];
  });
  
  // Track processed card UIDs to avoid duplicates
  const processedCards = new Set();
  
  // First, add cards from cardPackages (these are the assignments made in ManageTables)
  if (cardPackages.packages && Array.isArray(cardPackages.packages)) {
    cardPackages.packages.forEach(pkg => {
      // Skip if card is already processed
      if (processedCards.has(pkg.uid)) return;
      
      // MODIFIED: Relax the access status check
      // Instead of looking for exact product-card combinations, just check if the card exists
      // and has been granted access somewhere in the system
      const hasGrantedAccess = Object.keys(accessStatusMap).some(key => {
        return key.includes(pkg.uid) && 
          (accessStatusMap[key].status.toLowerCase().includes('granted') || 
           accessStatusMap[key].status.toLowerCase().includes('new') || 
           accessStatusMap[key].status.toLowerCase().includes('reactivated'));
      });
      
      const isDeleted = Object.keys(accessStatusMap).some(key => {
        return key.includes(pkg.uid) && 
          (accessStatusMap[key].status.toLowerCase().includes('deleted') || 
           accessStatusMap[key].status.toLowerCase().includes('denied'));
      });
      
      // RELAXED CONDITION: Include cards even if they don't have a specific status
      if (!isDeleted) { // Just check they aren't deleted
        // Find card data from accessControlData if available
        const cardData = accessControlData.cards.find(c => c.uid === pkg.uid) || {
          uid: pkg.uid,
          type: pkg.package_type,
          active: true
        };
        
        // Add to the corresponding package group
        if (!packageGroups[pkg.package_type]) {
          packageGroups[pkg.package_type] = [];
        }
        
        packageGroups[pkg.package_type].push({
          ...cardData,
          products: getLinkedProductsForCard(pkg.uid)
        });
        
        // Mark as processed
        processedCards.add(pkg.uid);
      }
    });
  }
  
  // Then add any cards from accessControlData that weren't already added
  if (accessControlData.cards) {
    accessControlData.cards.forEach(card => {
      // Skip if card is already processed
      if (processedCards.has(card.uid)) return;
      
      // MODIFIED: Same relaxed condition as above
      const hasGrantedAccess = Object.keys(accessStatusMap).some(key => {
        return key.includes(card.uid) && 
          (accessStatusMap[key].status.toLowerCase().includes('granted') || 
           accessStatusMap[key].status.toLowerCase().includes('new') || 
           accessStatusMap[key].status.toLowerCase().includes('reactivated'));
      });
      
      const isDeleted = Object.keys(accessStatusMap).some(key => {
        return key.includes(card.uid) && 
          (accessStatusMap[key].status.toLowerCase().includes('deleted') || 
           accessStatusMap[key].status.toLowerCase().includes('denied'));
      });
      
      // RELAXED CONDITION: Include all cards that aren't explicitly deleted
      if (!isDeleted) {
        // Add to the corresponding package group
        if (!packageGroups[card.type]) {
          packageGroups[card.type] = [];
        }
        
        packageGroups[card.type].push({
          ...card,
          products: getLinkedProductsForCard(card.uid)
        });
      }
    });
  }
  
  // Log the results to check what cards made it through
  console.log("Package groups after filtering:", packageGroups);
  
  return packageGroups;
};

// Update the universalCards filter as well
useEffect(() => {
  if (accessControlData) {
    const allCards = accessControlData.cards.filter(card => {
      const cardStatus = accessStatusMap[card.uid]?.status || '';
      return cardStatus.includes('Granted') && !cardStatus.toLowerCase().includes('deleted');
    });
    
    const masterCards = allCards.filter(card => card.type === 'Master Card');
    const serviceCards = allCards.filter(card => card.type === 'Service Card');
    setUniversalCards({ masterCards, serviceCards });
  }
}, [accessControlData, accessStatusMap]);
  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch (err) {
      return dateString;
    }
  };

const toggleCardStatus = async (productId, uid, currentStatus) => {
  try {
    setSavingChanges(true);
    const newStatus = !currentStatus;
    
    // First update the UI immediately
    // Update accessControlData with the new card status
    const updatedProducts = accessControlData.products.map(product => {
      if (product.product_id === productId) {
        const updatedCards = product.cards.map(card => {
          if (card.uid === uid) {
            return { ...card, active: newStatus };
          }
          return card;
        });
        return { ...product, cards: updatedCards };
      }
      return product;
    });
    
    setAccessControlData({
      ...accessControlData,
      products: updatedProducts
    });
    
    // Update the selected product in the modal
    if (selectedProduct && selectedProduct.product_id === productId) {
      const updatedCards = selectedProduct.cards.map(card => {
        if (card.uid === uid) {
          return { ...card, active: newStatus };
        }
        return card;
      });
      setSelectedProduct({ ...selectedProduct, cards: updatedCards });
    }
    
    // Then make the API call
    await axios.post('http://localhost:5000/api/update_card_status', {
      product_id: productId,
      uid: uid,
      active: newStatus
    });
    
    toast.success(`Card ${uid} has been ${newStatus ? 'enabled' : 'disabled'}`);
  } catch (err) {
    console.error('Error updating card status:', err);
    toast.error(`Failed to update card status: ${err.message}`);
    
    // If the API call fails, revert the UI changes
    fetchAllData();
  } finally {
    setSavingChanges(false);
  }
};

  if (loading || !accessControlData) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="text-center">
          <Spinner animation="border" style={{ color: ZENV_COLORS.primary, width: '3rem', height: '3rem' }} />
          <p className="mt-3">Loading access control data...</p>
        </div>
      </div>
    );
  }

  const cardsByPackage = getCardsByPackageType();
  const allPeople = getAllPeople();
  
  // Count stats
  const totalProducts = accessControlData.products.length || 0;
  const totalCards = accessControlData.cards.length || 0;
  const totalGuests = getUniqueGuests().length;
  const totalManagers = managers.length;

  return (
    <Container fluid className="py-4 px-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={{ color: ZENV_COLORS.primary, fontWeight: 600 }}>
            Access Control Tracking
          </h2>
          <p className="text-muted">
            Last updated: {lastRefresh.toLocaleString('en-US')}
          </p>
        </div>
        <Button 
          onClick={() => setLastRefresh(new Date())} 
          variant="outline-primary" 
          className="d-flex align-items-center"
          disabled={refreshing}
        >
          <FontAwesomeIcon icon={faSync} spin={refreshing} className="me-2" />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>
      
      {/* Stats Cards */}
      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="shadow-sm h-100 border-0 rounded-3">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightBlue }}>
                  <FontAwesomeIcon icon={faBuilding} style={{ color: ZENV_COLORS.primary, fontSize: '1.5rem' }} />
                </div>
                <div className="ms-3">
                  <div className="text-muted mb-1">Total Products</div>
                  <h3 className="mb-0 fw-bold">{totalProducts}</h3>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100 border-0 rounded-3">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightTeal }}>
                  <FontAwesomeIcon icon={faCreditCard} style={{ color: ZENV_COLORS.teal, fontSize: '1.5rem' }} />
                </div>
                <div className="ms-3">
                  <div className="text-muted mb-1">Total Cards</div>
                  <h3 className="mb-0 fw-bold">{totalCards}</h3>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100 border-0 rounded-3">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightGreen }}>
                  <FontAwesomeIcon icon={faUser} style={{ color: ZENV_COLORS.green, fontSize: '1.5rem' }} />
                </div>
                <div className="ms-3">
                  <div className="text-muted mb-1">Active Guests</div>
                  <h3 className="mb-0 fw-bold">{totalGuests}</h3>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100 border-0 rounded-3">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div className="rounded-circle p-3" style={{ backgroundColor: ZENV_COLORS.lightPurple }}>
                  <FontAwesomeIcon icon={faUserTie} style={{ color: ZENV_COLORS.purple, fontSize: '1.5rem' }} />
                </div>
                <div className="ms-3">
                  <div className="text-muted mb-1">Staff Members</div>
                  <h3 className="mb-0 fw-bold">{totalManagers}</h3>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Tab Navigation */}
      <Card className="shadow-sm border-0 rounded-3 mb-4">
        <Card.Header className="bg-white border-0 pt-3 pb-0">
          <Tabs 
            activeKey={key} 
            onSelect={(k) => setKey(k)} 
            className="border-bottom-0"
            style={{ borderBottom: 'none' }}
          >
            <Tab 
              eventKey="products" 
              title={
                <div className="d-flex align-items-center">
                  <FontAwesomeIcon icon={faBuilding} className="me-2" /> 
                  Products
                </div>
              }
            />
            <Tab 
              eventKey="packages" 
              title={
                <div className="d-flex align-items-center">
                  <FontAwesomeIcon icon={faLayerGroup} className="me-2" /> 
                  Card Packages
                </div>
              }
            />
            <Tab 
              eventKey="people" 
              title={
                <div className="d-flex align-items-center">
                  <FontAwesomeIcon icon={faUser} className="me-2" /> 
                  People
                </div>
              }
            />
          </Tabs>
        </Card.Header>
        <Card.Body className="p-0">
    



{key === 'products' && (
  <div className="p-4">
    <Row xs={1} md={2} lg={3} className="g-4">
      {accessControlData.products.map(product => {
        const roomName = getRoomNameByProductId(product.product_id);
        const isVip = vipRooms?.vip_rooms.some(vip => vip.product_id === product.product_id);
        
        // Calculate all cards associated with this product - including those assigned through guests
        let allCards = [...(product.cards || [])];
        
        // Include cards from guests if they're not already in the cards array
        if (product.guests && product.guests.length > 0) {
          product.guests.forEach(guest => {
            // Check if guest's card is already counted
            if (guest.uid && !allCards.some(card => card.uid === guest.uid)) {
              allCards.push({
                uid: guest.uid,
                type: guest.package_type || 'Standard',
                active: true // Guest cards are assumed active
              });
            }
          });
        }
        
        // Get counts for display
        // const productCardCount = allCards.length;
        const productCardCount = allCards.filter(card => card.active).length;
        const guestCount = product.guests?.length || 0;
        
        return (
          <Col key={product.product_id}>
            <Card 
              className="h-100 shadow-sm border-0" 
              style={{ 
                borderLeft: isVip ? `4px solid ${ZENV_COLORS.orange}` : undefined,
                transition: 'transform 0.2s',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => handleProductClick(product)} 
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Card.Body>
                <div className="d-flex justify-content-between mb-3">
                  <h5 style={{ color: ZENV_COLORS.primary }}>{product.product_id}</h5>
                  {isVip && (
                    <Badge 
                      style={{ backgroundColor: ZENV_COLORS.orange, color: '#212529' }}
                      pill
                    >
                      VIP
                    </Badge>
                  )}
                </div>
                
                <div className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <FontAwesomeIcon icon={faDoorOpen} className="me-2" style={{ color: ZENV_COLORS.primary }} />
                    <div className="fw-medium">Room:</div>
                    <Badge 
                      className="ms-2" 
                      bg="light" 
                      text="dark" 
                      style={{ fontSize: '0.85rem' }}
                    >
                      {roomName}
                    </Badge>
                  </div>
   
                  {/* Card Count - Always show actual card count */}
                  <div className="d-flex align-items-center mb-2">
                    <FontAwesomeIcon icon={faCreditCard} className="me-2" style={{ color: ZENV_COLORS.teal }} />
                    <div className="fw-medium">Cards:</div>
                    <div className="ms-2">
                      <Badge bg={productCardCount > 0 ? "info" : "secondary"} pill>
                        {productCardCount}
                      </Badge>
                    </div>
                  </div>

                  {/* Guest Count - Always show independent of card count */}
                  <div className="d-flex align-items-center mb-2">
                    <FontAwesomeIcon icon={faUser} className="me-2" style={{ color: ZENV_COLORS.green }} />
                    <div className="fw-medium">Guests:</div>
                    <div className="ms-2">
                      <Badge bg={guestCount > 0 ? "success" : "secondary"} pill>
                        {guestCount}
                      </Badge>
                    </div>
                  </div>
                </div>
                






{productCardCount > 0 && (
  <div className="mt-3">
    <small className="text-muted d-block mb-2">Card Access Control:</small>
    <div className="table-responsive">
      <table className="table table-sm table-borderless card-table mb-0">
        <thead>
          <tr>
            <th style={{fontSize: '0.7rem'}}>Card UID</th>
            <th style={{fontSize: '0.7rem'}}>Package</th>
          </tr>
        </thead>
        <tbody>
          {product.cards.filter(card => card.active).map((card, idx) => (
            <tr key={idx}>
              <td className="ps-0">
                <Badge 
                  bg="light" 
                  text="dark" 
                  className="me-1"
                  style={{ border: `1px solid ${ZENV_COLORS.teal}` }}
                >
                  <span style={{ color: ZENV_COLORS.teal }}>•</span> {card.uid || 'NA'}
                </Badge>
              </td>
              <td className="ps-0">
                <small className="badge bg-light text-dark">
                  {card.type || 'NA'}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>

      {/* Add the Modal component after the Products tab content */}
<Modal 
show={showModal}
onHide={handleCloseModal} 
size="lg"
className='product-details-modal'
backdrop={false}
centered>
  <Modal.Header closeButton>
    <Modal.Title className="d-flex align-items-center">
      Product ID: {selectedProduct?.product_id}
      {selectedProduct?.isVip && (
        <Badge 
          style={{ backgroundColor: ZENV_COLORS.orange, color: '#212529' }}
          className="ms-2"
        >
          <FontAwesomeIcon icon={faStar} className="me-1" />
          VIP Room
        </Badge>
      )}
    </Modal.Title>
  </Modal.Header>
<Modal.Body>
  {selectedProduct && (
    <>
      {selectedProduct.isVip && (
        <div className="mb-4">
          <h5 className="mb-2">VIP Room Information</h5>
          <p><strong>Room Name:</strong> {getRoomNameByProductId(selectedProduct.product_id)}</p>
        </div>
      )}

{/* Modal Summary Statistics */}
<div className="mb-4 p-3 bg-light rounded">
  <Row>
    <Col xs={6}>
      <div className="d-flex align-items-center">
        <FontAwesomeIcon icon={faCreditCard} className="me-2" style={{ color: ZENV_COLORS.teal }} />
        <span className="fw-medium">Total Cards:</span>
        <Badge className="ms-2" bg="info">
          {/* Calculate total cards including ones assigned through guests */}
          {(() => {
            let cardCount = selectedProduct.cards?.length || 0;
            
            // Add guest cards if they're not already in the cards array
            if (selectedProduct.guests && selectedProduct.guests.length > 0) {
              selectedProduct.guests.forEach(guest => {
                if (guest.uid && (!selectedProduct.cards || !selectedProduct.cards.some(card => card.uid === guest.uid))) {
                  cardCount++;
                }
              });
            }
            
            return cardCount;
          })()}
        </Badge>
      </div>
    </Col>
  </Row>
</div>

<h5 className="mb-3">Assigned Cards</h5>
<div className="mb-4">
  <Row className="mb-2 fw-bold">
    <Col xs={4}>UID</Col>
    <Col xs={3}>Type</Col>
    <Col xs={5}>Status</Col>
  </Row>
  <ListGroup variant="flush">
    {(() => {
      // Create a combined list of all cards including ones from guests
      let allCards = [...(selectedProduct.cards || [])];
      
      // Include guest cards if they're not already in the cards array
      if (selectedProduct.guests && selectedProduct.guests.length > 0) {
        selectedProduct.guests.forEach(guest => {
          if (guest.uid && !allCards.some(card => card.uid === guest.uid)) {
            allCards.push({
              uid: guest.uid,
              type: guest.package_type || 'Standard',
              active: true, // Guest cards are assumed active
              isGuestCard: true // Flag to identify this is from a guest
            });
          }
        });
      }
      
      if (allCards.length > 0) {
        return allCards.map((card, index) => (
          <ListGroup.Item key={`card-${index}`} className="py-3">
            <Row className="align-items-center">
              <Col xs={4}>{card.uid || 'NA'}</Col>
              <Col xs={3}>
                <Badge 
                  bg={card.type === 'Master Card' ? 'danger' :
                    card.type === 'Service Card' ? 'warning' :
                    card.type === 'Executive' ? 'primary' :
                    card.type === 'Suite' ? 'success' : 'secondary'}
                >
                  {card.type || 'NA'}
                </Badge>
              </Col>
              <Col xs={5} className="d-flex justify-content-between align-items-center">
                <Badge bg={card.active ? 'success' : 'danger'}>
                  <FontAwesomeIcon icon={card.active ? faCheck : faTimes} /> 
                  {card.active ? 'Active' : 'Disabled'}
                </Badge>

                <Form.Check
                  type="switch"
                  id={`card-switch-${index}`}
                  checked={card.active}
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCardStatus(selectedProduct.product_id, card.uid, card.active);
                  }}
                  disabled={savingChanges}
                  label=""
                  onClick={(e) => e.stopPropagation()}
                />
              </Col>
            </Row>
          </ListGroup.Item>
        ));
      } else {
        return <p className="text-muted">No product-specific cards assigned</p>;
      }
    })()}
    
    {/* Show Universal Master Cards - keep this section unchanged */}
    {universalCards.masterCards.length > 0 && (
      <>
        <ListGroup.Item className="py-3 bg-light">
          <strong className="text-danger">
            <FontAwesomeIcon icon={faKey} className="me-2" />
            Universal Master Cards
          </strong>
        </ListGroup.Item>
        {universalCards.masterCards.map((card, index) => (
                <ListGroup.Item key={`master-${index}`} className="py-3">
                  <Row className="align-items-center">
                    <Col xs={4}>{card.uid}</Col>
                    <Col xs={3}>
                      <Badge bg="danger">Master Card</Badge>
                    </Col>
                    <Col xs={5}>
                      <Badge bg={card.active ? 'success' : 'danger'}>
                        <FontAwesomeIcon icon={card.active ? faCheck : faTimes} /> 
                        {card.active ? 'Active' : 'Disabled'}
                      </Badge>
                    </Col>
                  </Row>
                </ListGroup.Item>

        ))}
      </>
    )}

    {/* Show Universal Service Cards - keep this section unchanged */}
    {universalCards.serviceCards.length > 0 && (
      <>
        <ListGroup.Item className="py-3 bg-light">
          <strong className="text-warning">
            <FontAwesomeIcon icon={faTools} className="me-2" />
            Universal Service Cards
          </strong>
        </ListGroup.Item>
        {universalCards.serviceCards.map((card, index) => (

                <ListGroup.Item key={`service-${index}`} className="py-3">
                  <Row className="align-items-center">
                    <Col xs={4}>{card.uid}</Col>
                    <Col xs={3}>
                      <Badge bg="warning" text="dark">Service Card</Badge>
                    </Col>
                    <Col xs={5}>
                      <Badge bg={card.active ? 'success' : 'danger'}>
                        <FontAwesomeIcon icon={card.active ? faCheck : faTimes} /> 
                        {card.active ? 'Active' : 'Disabled'}
                      </Badge>
                    </Col>
                  </Row>
                </ListGroup.Item>
        ))}
      </>
    )}
  </ListGroup>
</div>


      {/* Guest Access Section */}
      {selectedProduct.guests && selectedProduct.guests.length > 0 && (
        <>
          <h5 className="mb-3 mt-4">Guest Access</h5>
          <ListGroup variant="flush">
            {selectedProduct.guests.map((guest, index) => (
              <ListGroup.Item key={index} className="py-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h6>{guest.name}</h6>
                    <div><small><strong>Card:</strong> {guest.uid}</small></div>
                    <div><small><strong>Package:</strong> {guest.package_type}</small></div>
                  </div>
                  <div className="text-end">
                    <div><small><strong>Check In:</strong> {formatDate(guest.checkin)}</small></div>
                    <div><small><strong>Check Out:</strong> {formatDate(guest.checkout)}</small></div>
                  </div>
                </div>
                <div className="mt-2">
                  <small><strong>Access Rooms:</strong></small>
                  <div className="mt-1">
                    {guest.access_rooms.map((room, i) => (
                      <Badge key={i} bg="info" className="me-1">
                        {getRoomNameByProductId(room)} {/* This will show the actual room names */}
                      </Badge>
                    ))}
                  </div>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </>
      )}
    </>
  )}
</Modal.Body>

  <Modal.Footer>
    <Button variant="secondary" onClick={handleCloseModal}>
      Close
    </Button>
  </Modal.Footer>
</Modal>

    </div>
  )}
             
{/* Card Packages Tab */}
{key === 'packages' && (
  <div className="p-4">
    <Row xs={1} md={2} className="g-4">
      {PACKAGE_TYPES.map(packageType => {
        const cards = cardsByPackage[packageType] || [];
        const colors = getPackageColor(packageType);

        return (
          <Col key={packageType}>
            <Card className="shadow-sm h-100 border-0 rounded-3" style={{ overflow: 'hidden' }}>
              <div style={{ height: '8px', backgroundColor: colors.bg }}></div>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">{packageType}</h5>

                </div>

                {cards.length > 0 ? (
                  <Row xs={1} className="g-3">
                    {cards.map(card => (
                      <Col key={card.uid}>
                        <Card className="border-0 shadow-sm" style={{ borderRadius: '8px' }}>
                          <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <div className="d-flex align-items-center">
                                <FontAwesomeIcon icon={faIdCard} className="me-2" style={{ color: colors.bg }} />
                                <span className="fw-bold text-monospace">{card.uid}</span>
                              </div>

                            </div>

                            <div className="small">
                              <div className="mb-1">
                                <strong>Access Rooms:</strong> {card.access_rooms?.length ? (
                                  <span>
                                    {card.access_rooms.map((roomId, idx) => (
                                      <Badge key={idx} bg="info" className="me-1">
                                        {getRoomNameByProductId(roomId)} 
                                      </Badge>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="text-muted">None</span>
                                )}
                              </div>
 
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <div className="text-center py-4">
                    <FontAwesomeIcon icon={faInfoCircle} className="mb-2" style={{ fontSize: '1.5rem', color: ZENV_COLORS.mediumGray }} />
                    <p className="text-muted mb-0">No cards with this package type</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>
  </div>
)}

          {/* People Tab (formerly Guests) */}
          {key === 'people' && (
            <div className="p-4">
              <Row xs={1} md={2} className="g-4">
                {allPeople.length > 0 ? allPeople.map((person, index) => (
                  <Col key={person.uid + (person.role || '')}>
                    <Card 
                      className="h-100 shadow-sm border-0" 
                      style={{ 
                        borderRadius: '8px',
                        transition: 'transform 0.2s',
                        borderLeft: person.role ? `4px solid ${person.role === 'manager' ? ZENV_COLORS.purple : ZENV_COLORS.teal}` : undefined
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <h5 style={{ color: ZENV_COLORS.primary }}>{person.name}</h5>
                          <div className="d-flex">
                            {person.role && (
                              <Badge 
                                className="me-1"
                                style={{ 
                                  backgroundColor: person.role === 'manager' ? 
                                    ZENV_COLORS.lightPurple : ZENV_COLORS.lightTeal,
                                  color: person.role === 'manager' ? 
                                    ZENV_COLORS.purple : ZENV_COLORS.teal 
                                }}
                                pill
                              >
                                {person.role === 'manager' ? 'Manager' : 'Servicer'}
                              </Badge>
                            )}
                            <Badge 
                              style={{ 
                                backgroundColor: getPackageColor(person.package_type || 'General').light, 
                                color: getPackageColor(person.package_type || 'General').bg
                              }}
                              className="px-3 py-2 rounded-pill"
                            >
                              {person.package_type || 'General'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="mb-3 px-0">
                          <div className="d-flex align-items-center mb-2">
                            <FontAwesomeIcon icon={faIdCard} className="me-2" style={{ color: ZENV_COLORS.teal }} />
                            <div className="fw-medium">Card UID:</div>
                            <Badge 
                              className="ms-2" 
                              bg="light" 
                              text="dark"
                              style={{ fontSize: '0.85rem' }}
                            >
                              {person.uid}
                            </Badge>
                          </div>
                          
                          {person.managerId ? (
                            // Display staff ID for managers
                            <div className="d-flex mb-2">
                              <FontAwesomeIcon icon={faUserTie} className="me-2" style={{ color: ZENV_COLORS.purple }} />
                              <span className="fw-medium">Staff ID:</span>
                              <span className="ms-2">{person.managerId}</span>
                            </div>
                          ) : (
                            // Display check-in/out dates for guests
                            <div className="d-flex mb-2">
                              <div className="me-3">
                                <FontAwesomeIcon icon={faCalendarCheck} className="me-2" style={{ color: ZENV_COLORS.green }} />
                                <span className="fw-medium">Check In:</span>
                                <div className="ms-4 small">{formatDate(person.checkin)}</div>
                              </div>
                              
                              <div>
                                <FontAwesomeIcon icon={faCalendarTimes} className="me-2" style={{ color: '#dc3545' }} />
                                <span className="fw-medium">Check Out:</span>
                                <div className="ms-4 small">{formatDate(person.checkout)}</div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                      
                {!person.role && (
                <div className="mt-3 pt-2 border-top">
                    <div className="mb-2">
                    <strong>Access Rooms:</strong>
                    <div className="mt-1">
                        {person.accessRooms && person.accessRooms.length > 0 ? (
                        person.accessRooms.map((room, i) => (
                            <Badge key={i} bg="info" className="me-1 mb-1">
                            {getRoomNameByProductId(room)}
                            </Badge>
                        ))
                        ) : (
                        <span className="text-muted">None</span>
                        )}
                    </div>
                    </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                )) : (
                  <Col className="text-center py-5">
                    <FontAwesomeIcon icon={faUser} className="mb-3" style={{ fontSize: '3rem', color: ZENV_COLORS.mediumGray, opacity: 0.5 }} />
                    <h5 className="text-muted">No people found</h5>
                    <p className="text-muted">There are currently no active guests or staff members in the system</p>
                  </Col>
                )}
              </Row>
            </div>
          )}
        </Card.Body>
      </Card>

      <style jsx="true">{`
        .nav-tabs .nav-link {
          color: ${ZENV_COLORS.mediumGray};
          border: none;
          padding: 0.75rem 1rem;
          font-weight: 500;
        }
        
        .nav-tabs .nav-link.active {
          color: ${ZENV_COLORS.primary};
          border-bottom: 3px solid ${ZENV_COLORS.primary};
          background-color: transparent;
        }
        
        .fw-medium {
          font-weight: 500;
        }
        
        .text-monospace {
          font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        
        .card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        
        .card:hover {
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
        }

        .modal-content {
            background-color: white;
            border-radius: 8px;
            border: none;
            box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
        }
        
        .modal-header {
            border-bottom: 1px solid #dee2e6;
            background-color: white;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
        }
        
        .modal-body {
            background-color: white;
        }
        
        .modal-footer {
        border-top: 1px solid #dee2e6;
        background-color: white;
        border-bottom-left-radius: 8px;
        border-bottom-right-radius: 8px;
    }
    
        .list-group-item {
            border: none;
            border-bottom: 1px solid rgba(0,0,0,.125);
        }
        
        .list-group-item:last-child {
            border-bottom: none;
        }
        
        .list-group-item.bg-light {
            background-color: #f8f9fa !important;
        }
        .product-details-modal {
        background: rgba(0, 0, 0, 0.1); // Very light overlay instead of dark
    }


      `}</style>
    </Container>
  );
};

export default AccessControlTrackingPage;






