import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faSave, 
  faExclamationTriangle, 
  faCheckCircle,
  faSpinner,
  faCheck,
  faTimes,
  faDatabase,
  faLock,
  faTable,
  faCreditCard,
  faInfo,
  faUserShield,
  faExchangeAlt,
  faLink,
  faInfoCircle,
  faBan,
  faFilter
} from '@fortawesome/free-solid-svg-icons';
import api from '../services/api'; 
import axios from 'axios';

const ManageTables = () => {
  // State for tables data
  const [products, setProducts] = useState([]);
  const [rfidEntries, setRfidEntries] = useState([]);
  const [uniqueRfidEntries, setUniqueRfidEntries] = useState([]);
  const [vipRooms, setVipRooms] = useState([]);
  
  // Package states
  const [cardPackages, setCardPackages] = useState({});
  const [draftCardPackages, setDraftCardPackages] = useState({});
  const [savingPackage, setSavingPackage] = useState(false);
  const [hasPackageChanges, setHasPackageChanges] = useState(false);
  const [cardTypeMap, setCardTypeMap] = useState({});

  // Add this with your other state declarations
  const [accessStatusMap, setAccessStatusMap] = useState({});

  // Access matrix state 
  const [accessMatrix, setAccessMatrix] = useState(null);
  const [matrixChanges, setMatrixChanges] = useState({});
  const [savingMatrix, setSavingMatrix] = useState(false);
  
  // Other states
  const [showProductForm, setShowProductForm] = useState(false);
  const [showVipForm, setShowVipForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ product_id: '', room_id: '' });
  const [newVipRoom, setNewVipRoom] = useState({ product_id: '', vip_rooms: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const [productFormError, setProductFormError] = useState(null);
  const [vipRoomFormError, setVipRoomFormError] = useState(null);

  const [cardStatusMap, setCardStatusMap] = useState({});

  const [showCardSwitcher, setShowCardSwitcher] = useState(false);
  const [cardSwitcherData, setCardSwitcherData] = useState({
    selectedProductId: '',
    selectedCardId: '',
  });

  const [availableCards, setAvailableCards] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [cardSwitcherError, setCardSwitcherError] = useState(null);
  // Add this inside your component before the return statement
  const [unifiedCardEntries, setUnifiedCardEntries] = useState([]);
  




  // Define constants
  const ALL_FACILITIES = ["Lounge Room", "Spa Room", "Top Pool", "Gym"];
  const PACKAGE_TYPES = ["Standard", "Deluxe", "Suite", "Executive", "General", "Service Card", "Master Card"];

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

  // Add a useEffect to listen for storage events or add a refresh button
useEffect(() => {
  const handleStorageChange = (e) => {
    if (e.key === 'card_status_updated') {
      refreshData();
      localStorage.removeItem('card_status_updated'); // Clean up
    }
  };

  window.addEventListener('storage', handleStorageChange);
  
  // Also add an interval to refresh data every 30 seconds
  const interval = setInterval(refreshData, 30000);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
    clearInterval(interval);
  };
}, []);



// Add this to your useEffect that loads data or create a new one
useEffect(() => {
  // Merge data from card packages and RFID entries
  const mergeCardData = () => {
    const allEntries = [];
    
    // Add entries from cardPackages
    Object.keys(cardPackages).forEach(key => {
      const [productId, cardId] = key.split('-');
      const packageType = cardPackages[key];
      
      // Check if this entry exists in uniqueRfidEntries to get active status
      const rfidEntry = uniqueRfidEntries.find(
        entry => entry.product_id === productId && entry.uid === cardId
      );
      
      allEntries.push({
        product_id: productId,
        uid: cardId,
        active: rfidEntry ? rfidEntry.active : true,
        package_type: packageType
      });
    });
    
    // Add any uniqueRfidEntries that aren't already in the list
    uniqueRfidEntries.forEach(entry => {
      const key = `${entry.product_id}-${entry.uid}`;
      const existingEntry = allEntries.find(
        e => e.product_id === entry.product_id && e.uid === entry.uid
      );
      
      if (!existingEntry) {
        allEntries.push({
          product_id: entry.product_id,
          uid: entry.uid,
          active: entry.active,
          package_type: cardPackages[key] || (cardTypeMap[entry.uid] || 'General')
        });
      }
    });
    
    // Filter out entries that are not valid or active
    const filteredEntries = allEntries.filter(entry => 
      entry.active !== false && // Active status
      entry.product_id && // Valid product ID
      entry.uid // Valid card ID
    );
    
    setUnifiedCardEntries(filteredEntries);
  };
  
  mergeCardData();
}, [cardPackages, uniqueRfidEntries, cardTypeMap]);


// Update the useEffect that processes uniqueRfidEntries:


useEffect(() => {
  if (rfidEntries.length > 0 && products.length > 0) {
    const uniqueCombinations = new Map();
    
    // Create a Set of valid product IDs for faster lookups
    const validProductIds = new Set(products.map(p => p.product_id));
    
    rfidEntries.forEach(entry => {
      // Only include entries:
      // 1. Where product_id exists in products table
      // 2. Where the card has "Granted" access status (if we have status info)
      // 3. Cards with "deleted" in status should be excluded
      // 4. Cards that are active (not disabled)
      const cardStatus = accessStatusMap[entry.uid]?.status || '';
      // const hasGrantedAccess = cardStatus.toLowerCase().includes('granted') || cardStatus === '';
      // const isDeleted = cardStatus.toLowerCase().includes('deleted');
      const hasGrantedAccess = cardStatus.toLowerCase().includes('granted') || cardStatus.toLowerCase().includes('new') || cardStatus.toLowerCase().includes('reactivated');
      const isDeleted = cardStatus.toLowerCase().includes('deleted') || cardStatus.toLowerCase().includes('denied') || cardStatus === '';
      const isActive = cardStatusMap[entry.uid] !== false;
      
      if (validProductIds.has(entry.product_id) && hasGrantedAccess && !isDeleted && isActive) {
        const key = `${entry.product_id}-${entry.uid}`;
        // Only add if not already present (prevents duplicates)
        if (!uniqueCombinations.has(key)) {
          uniqueCombinations.set(key, entry);
        }
      }
    });
    
    const filteredEntries = Array.from(uniqueCombinations.values());
    
    // Don't filter out entries based on UIDs - display all valid entries
    const finalUniqueEntries = filteredEntries;
    
    setUniqueRfidEntries(finalUniqueEntries);
  } else {
    setUniqueRfidEntries([]);
  }
}, [rfidEntries, products, accessStatusMap, cardStatusMap]);



// Call this in useEffect along with your other data fetching
useEffect(() => {
  fetchData();
  fetchPackageData();
}, []);


const toggleAccess = (packageType, facility) => {
  if (['Service Card', 'Master Card', 'General'].includes(packageType)) {
    return; // Prevent changes to special cards
  }
  
  setAccessMatrix(prev => {
    const updatedMatrix = { ...prev };
    
    // Ensure the package type exists in the access matrix
    if (!updatedMatrix[packageType]) {
      updatedMatrix[packageType] = ALL_FACILITIES.reduce((acc, fac) => {
        acc[fac] = false;
        return acc;
      }, {});
    }
    
    // Toggle the access - fix the logic here
    const currentValue = updatedMatrix[packageType][facility] || false;
    updatedMatrix[packageType] = {
      ...updatedMatrix[packageType],
      [facility]: !currentValue
    };
    
    return updatedMatrix;
  });
  
  // Update matrix changes tracking - fix this too
  setMatrixChanges(prev => {
    const currentValue = accessMatrix[packageType]?.[facility] || false;
    return {
      ...prev,
      [`${packageType}-${facility}`]: !currentValue
    };
  });
};




// Fetch package data
const fetchPackageData = async () => {
  try {
    const packagesResponse = await axios.get('http://localhost:5000/api/card_packages', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      params: { _t: new Date().getTime() }
    });

    if (packagesResponse?.data?.packages) {
      const packagesMap = {};
      const newCardTypeMap = {};
      
      packagesResponse.data.packages.forEach(pkg => {
        const key = `${pkg.product_id}-${pkg.uid}`;
        packagesMap[key] = pkg.package_type;
        newCardTypeMap[pkg.uid] = pkg.package_type;
      });
      
      setCardPackages(packagesMap);
      setDraftCardPackages(packagesMap);
      setCardTypeMap(newCardTypeMap);
      setHasPackageChanges(false);
    }
  } catch (err) {
    console.error('Error fetching card packages:', err);
    setError(`Failed to load card packages: ${err.message}`);
  }
};


const fetchData = async () => {
  try {
    setLoading(true);

    // Fetch all data in parallel where possible
    const [
      productsResponse, 
      vipRoomsResponse,
      firstPageResponse,
      matrixResponse,
      accessStatusResponse
    ] = await Promise.all([
      api.getTables(),
      api.getVipRooms(),
      axios.get('http://localhost:5000/api/access_control_data', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }),
      api.getAccessMatrix(),
      axios.get('http://localhost:5000/api/rfid_entries', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        params: { limit: 1000 }
      })
    ]);

    // // Process access status map with PRODUCT-SPECIFIC KEYS
    if (accessStatusResponse?.data?.entries) {
      const statusMap = {};
      accessStatusResponse.data.entries.forEach(entry => {
        // Create product-specific key instead of just UID
        const productCardKey = `${entry.product_id}-${entry.uid}`;
        
        if (!statusMap[productCardKey] || new Date(entry.timestamp) > new Date(statusMap[productCardKey].timestamp)) {
          statusMap[productCardKey] = {
            status: entry.access_status || entry.access,
            timestamp: entry.timestamp || entry.time,
            product_id: entry.product_id,
            uid: entry.uid
          };
        }
      });
      setAccessStatusMap(statusMap);
    }

    // if (accessStatusResponse?.data?.entries) {
    //   const statusMap = {};
    //   accessStatusResponse.data.entries.forEach(entry => {
    //     const key = `${entry.product_id}-${entry.uid}`;
    //     if (
    //       !statusMap[key] ||
    //       new Date(entry.created_at) > new Date(statusMap[key].created_at)
    //     ) {
    //       statusMap[key] = {
    //         status: entry.access_status || entry.access,
    //         created_at: entry.created_at,
    //         product_id: entry.product_id,
    //         uid: entry.uid
    //       };
    //     }
    //   });
    //   setAccessStatusMap(statusMap);
    // }

    // Build cardStatusMap from the access control data
    if (firstPageResponse?.data?.products) {
      const cardStatus = {};
      firstPageResponse.data.products.forEach(product => {
        if (product.cards && product.cards.length > 0) {
          product.cards.forEach(card => {
            // Use product-specific key for card status too
            const productCardKey = `${product.product_id}-${card.uid}`;
            cardStatus[productCardKey] = card.active !== false;
          });
        }
      });
      setCardStatusMap(cardStatus);

      // Build cardTypeMap
      const fetchedCardTypeMap = {};
      firstPageResponse.data.products.forEach(product => {
        if (product.cards && product.cards.length > 0) {
          product.cards.forEach(card => {
            fetchedCardTypeMap[card.uid] = card.type;
          });
        }
      });
      setCardTypeMap(fetchedCardTypeMap);
    }

    // Build rfidEntries - only include active cards
    let allEntries = [];
    if (firstPageResponse?.data?.products) {
      firstPageResponse.data.products.forEach(product => {
        if (product.cards && product.cards.length > 0) {
          product.cards.forEach(card => {
            // Only include cards that are active
            if (card.active !== false) {
              allEntries.push({
                product_id: product.product_id,
                uid: card.uid
              });
            }
          });
        }
      });
    }
    setRfidEntries(allEntries);

    // Process products
    // if (productsResponse?.data) {
    //   setProducts(productsResponse.data.products || []);
    // }

      if (productsResponse?.data) {
        setProducts(productsResponse.data.products || []);
        setAvailableProducts(productsResponse.data.products || []);
      }

    // Process VIP rooms
    if (vipRoomsResponse?.data) {
      setVipRooms(vipRoomsResponse.data.vip_rooms || []);
    }

    // Process access matrix
    if (matrixResponse?.data?.matrix) {
      const dbMatrix = matrixResponse.data.matrix;
      const completeMatrix = PACKAGE_TYPES.reduce((acc, packageType) => {
        if (['Service Card', 'Master Card'].includes(packageType)) {
          acc[packageType] = ALL_FACILITIES.reduce((facilities, facility) => ({
            ...facilities,
            [facility]: null
          }), {});
        } else {
          acc[packageType] = ALL_FACILITIES.reduce((facilities, facility) => ({
            ...facilities,
            [facility]: dbMatrix[packageType]?.[facility] ?? false
          }), {});
        }
        return acc;
      }, {});
      setAccessMatrix(completeMatrix);
    }

          // Extract all unique cards across all products for the card switcher
      const allCards = [];
      if (firstPageResponse?.data?.products) {
        firstPageResponse.data.products.forEach(product => {
          if (product.cards && product.cards.length > 0) {
            product.cards.forEach(card => {
              if (card.active !== false) {
                // Only include active cards
                const existingCard = allCards.find(c => c.uid === card.uid);
                if (!existingCard) {
                  allCards.push({
                    uid: card.uid,
                    type: card.type || cardTypeMap[card.uid] || 'General'
                  });
                }
              }
            });
          }
        });
      }
      setAvailableCards(allCards);
      

  } catch (err) {
    console.error('Error fetching data:', err);
    setError(`Failed to load data: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

// Update the useEffect that processes uniqueRfidEntries to use product-specific status
useEffect(() => {
  if (rfidEntries.length > 0 && products.length > 0) {
    const uniqueCombinations = new Map();
    
    // Create a Set of valid product IDs for faster lookups
    const validProductIds = new Set(products.map(p => p.product_id));
    
    rfidEntries.forEach(entry => {
      // Only include entries:
      // 1. Where product_id exists in products table
      // 2. Where the card has "granted" or "new" or "reactivated" access status for THIS SPECIFIC PRODUCT
      // 3. Cards with "denied" or "deleted" in status should be excluded for THIS SPECIFIC PRODUCT
      // 4. Cards that are active for THIS SPECIFIC PRODUCT
      
      const productCardKey = `${entry.product_id}-${entry.uid}`;
      const cardStatus = accessStatusMap[productCardKey]?.status || '';
      const hasGrantedAccess = cardStatus.toLowerCase().includes('granted') || cardStatus.toLowerCase().includes('new') || cardStatus.toLowerCase().includes('reactivated');
      const isDeleted = cardStatus.toLowerCase().includes('deleted') || cardStatus.toLowerCase().includes('denied') || cardStatus === '';
      const isActive = cardStatusMap[productCardKey] !== false;
      
      if (validProductIds.has(entry.product_id) && hasGrantedAccess && !isDeleted && isActive) {
        const key = `${entry.product_id}-${entry.uid}`;
        // Only add if not already present (prevents duplicates)
        if (!uniqueCombinations.has(key)) {
          uniqueCombinations.set(key, entry);
        }
      }
    });
    
    setUniqueRfidEntries(Array.from(uniqueCombinations.values()));
  } else {
    setUniqueRfidEntries([]);
  }
}, [rfidEntries, products, accessStatusMap, cardStatusMap]);

// ...existing code...

// Add this function to refresh data from external changes
const refreshData = async () => {
  try {
    await fetchData();
    await fetchPackageData();
  } catch (err) {
    console.error('Error refreshing data:', err);
  }
};



  // Handle input change in Card Switcher form
  const handleCardSwitcherInputChange = (e) => {
    const { name, value } = e.target;
    setCardSwitcherData({
      ...cardSwitcherData,
      [name]: value
    });
  };
  
  // Reset the Card Switcher form
  const resetCardSwitcherForm = () => {
    setCardSwitcherData({
      selectedProductId: '',
      selectedCardId: ''
    });
    setCardSwitcherError(null);
  };



    // Check if the card assignment already exists
  const isCardAssignmentUnique = (productId, cardId) => {
    return !uniqueRfidEntries.some(entry => 
      entry.product_id === productId && entry.uid === cardId
    );
  };



      

// Function to assign card to product
const handleCardAssignment = async () => {
  setCardSwitcherError(null);
  
  const { selectedProductId, selectedCardId } = cardSwitcherData;
  
  // Validate form
  if (!selectedProductId || !selectedCardId) {
    setCardSwitcherError('Please select both a Product and a Card');
    return;
  }
  
  // Check if assignment already exists
  if (!isCardAssignmentUnique(selectedProductId, selectedCardId)) {
    setCardSwitcherError('This Card is already assigned to this Product');
    return;
  }
  
  try {
    setActionLoading(true);
    
    // Get card package type
    const selectedCard = availableCards.find(card => card.uid === selectedCardId);
    const packageType = selectedCard?.type || cardTypeMap[selectedCardId] || 'General';
    
    // Add the new RFID entry
    await axios.post(
      'http://localhost:5000/api/assign_card', 
      {
        product_id: selectedProductId,
        uid: selectedCardId,
        package_type: packageType
      },
      {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }
    );
    
    // Show success message
    setSuccess(`Card ${selectedCardId} successfully assigned to ${selectedProductId} with ${packageType} package`);
    
    // Important: Refresh all data to update the UI
    await refreshData();
    
    // Reset the form
    resetCardSwitcherForm();
    setShowCardSwitcher(false);  // Optional: close the form after successful submission
    
  } catch (err) {
    console.error('Error assigning card:', err);
    setCardSwitcherError(`Failed to assign card: ${err.message}`);
  } finally {
    setActionLoading(false);
  }
};     




  // Save access matrix to database
  const saveAccessMatrix = async () => {
    setSavingMatrix(true);
    
    try {
      // Filter out special cards before saving
      const dataToSave = Object.entries(accessMatrix).reduce((acc, [pkg, facilities]) => {
        if (!['Service Card', 'Master Card'].includes(pkg)) {
          acc[pkg] = facilities;
        }
        return acc;
      }, {});

      await axios.post('http://localhost:5000/api/access_matrix', 
        { matrix: dataToSave },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setSuccess('Access matrix updated successfully!');
      setMatrixChanges({});
    } catch (err) {
      console.error('Error updating access matrix:', err);
      setError(`Failed to update access matrix: ${err.message}`);
    } finally {
      setSavingMatrix(false);
    }
  };

  // Handle package selection change
  // const handlePackageChange = (productId, uid, packageType) => {
  //   setDraftCardPackages(prev => {
  //     const updated = { ...prev };
  //     uniqueRfidEntries.forEach(entry => {
  //       if (entry.uid === uid) {
  //         const entryKey = `${entry.product_id}-${uid}`;
  //         updated[entryKey] = packageType;
  //       }
  //     });
  //     return updated;
  //   });
    
  //   setCardTypeMap(prev => ({
  //     ...prev,
  //     [uid]: packageType
  //   }));
    
  //   setHasPackageChanges(true);
  // };
  

  const handlePackageChange = (productId, uid, packageType) => {
  setDraftCardPackages(prev => {
    const updated = { ...prev };
    // Always update the current row
    const currentKey = `${productId}-${uid}`;
    updated[currentKey] = packageType;
    // Update all other assignments with the same card id
    Object.keys(prev).forEach(key => {
      if (key.endsWith(`-${uid}`)) {
        updated[key] = packageType;
      }
    });
    return updated;
  });

  setCardTypeMap(prev => ({
    ...prev,
    [uid]: packageType
  }));

  setHasPackageChanges(true);
};
  // Save package changes
const savePackageChanges = async () => {
  setSavingPackage(true);
  
  try {
    const changedKeys = Object.keys(draftCardPackages).filter(
      key => draftCardPackages[key] !== cardPackages[key]
    );
    
    if (changedKeys.length > 0) {
      await Promise.all(changedKeys.map(key => {
        const [productId, uid] = key.split('-');
        return axios.post('http://localhost:5000/api/card_packages', 
          { 
            product_id: productId, 
            uid: uid, 
            package_type: draftCardPackages[key] 
          },
          {
            headers: { 
              'Authorization': `Bearer ${localStorage.getItem('token')}` 
            }
          }
        );
      }));
      
      setSuccess('Package changes saved successfully!');
      
      // Refresh all relevant data
      await Promise.all([fetchPackageData(), fetchData()]);
      setHasPackageChanges(false);
    }
  } catch (err) {
    console.error('Error saving package changes:', err);
    setError(`Failed to save package changes: ${err.message}`);
  } finally {
    setSavingPackage(false);
  }
};

  // Check if product ID exists in either products or VIP rooms
  const isProductIdUnique = (productId) => {
    const existsInProducts = products.some(p => p.product_id === productId);
    const existsInVipRooms = vipRooms.some(v => v.product_id === productId);
    return !existsInProducts && !existsInVipRooms;
  };

const isProductValid = (productId, roomId) => {
  // Check for duplicate Product ID
  const existsInProducts = products.some(p => p.product_id === productId);
  const existsInVipRooms = vipRooms.some(v => v.product_id === productId);
  
  // Check for duplicate Room ID in products
  const duplicateRoomId = products.some(p => p.room_id === roomId);
  
  // Check if room ID matches any VIP room facility name
  const overlapWithVipFacility = vipRooms.some(v => v.vip_rooms === roomId);
  
  if (existsInProducts || existsInVipRooms) {
    setProductFormError(`Product ID "${productId}" already exists in Products or VIP Rooms.`);
    return false;
  }
  
  if (duplicateRoomId) {
    setProductFormError(`Room ID "${roomId}" is already assigned to another product.`);
    return false;
  }
  
  if (overlapWithVipFacility) {
    setProductFormError(`Room ID "${roomId}" is already used as a VIP Room facility name.`);
    return false;
  }
  
  return true;
};


// Modify the isVipRoomValid function similarly
const isVipRoomValid = (productId, vipRoomName) => {
  // Check for duplicate Product ID
  const existsInProducts = products.some(p => p.product_id === productId);
  const existsInVipRooms = vipRooms.some(v => v.product_id === productId);
  
  // Check for duplicate VIP Room name
  const duplicateVipRoom = vipRooms.some(v => v.vip_rooms === vipRoomName);
  
  // Check if VIP room name matches any product room ID
  const overlapWithProductRoom = products.some(p => p.room_id === vipRoomName);
  
  if (existsInProducts || existsInVipRooms) {
    setVipRoomFormError(`Product ID "${productId}" already exists in Products or VIP Rooms.`);
    return false;
  }
  
  if (duplicateVipRoom) {
    setVipRoomFormError(`VIP Room "${vipRoomName}" is already assigned to another product.`);
    return false;
  }
  
  if (overlapWithProductRoom) {
    setVipRoomFormError(`VIP Room "${vipRoomName}" is already used as a Room ID in Products.`);
    return false;
  }
  
  return true;
};




  // Handle product form inputs
  const handleProductInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({ ...newProduct, [name]: value });
  };
  
  // Handle VIP room form inputs
  const handleVipRoomInputChange = (e) => {
    const { name, value } = e.target;
    setNewVipRoom({ ...newVipRoom, [name]: value });
  };



// Update handleAddProduct to use the local error state
const handleAddProduct = async () => {
  // Clear previous error
  setProductFormError(null);
  
  if (!newProduct.product_id || !newProduct.room_id) {
    setProductFormError('Please fill in all fields for the product');
    return;
  }
  
  // Use enhanced validation
  if (!isProductValid(newProduct.product_id, newProduct.room_id)) {
    return; // Error is already set in isProductValid
  }

  try {
    setActionLoading(true);
    const response = await api.addProduct(newProduct.product_id, newProduct.room_id);
    if (response && response.data) {
      if (response.data.error) {
        setProductFormError(response.data.error);
      } else {
        setSuccess('Product added successfully!');
        fetchData();
        setNewProduct({ product_id: '', room_id: '' });
        setShowProductForm(false);
      }
    }
  } catch (err) {
    console.error('Error adding product:', err);
    if (err.response && err.response.status === 400 && 
        err.response.data && err.response.data.error && 
        (err.response.data.error.includes("duplicate") || 
         err.response.data.error.includes("already exists"))) {
      setProductFormError(`Product ID "${newProduct.product_id}" already exists. Please use a unique ID.`);
    } else {
      setProductFormError(`Failed to add product: ${err.message}`);
    }
  } finally {
    setActionLoading(false);
  }
};

// Update handleAddVipRoom similarly
const handleAddVipRoom = async () => {
  // Clear previous error
  setVipRoomFormError(null);
  
  if (!newVipRoom.product_id || !newVipRoom.vip_rooms) {
    setVipRoomFormError('Please fill in all fields for the VIP room');
    return;
  }

  // Check if product ID already exists in either table
  if (!isVipRoomValid(newVipRoom.product_id, newVipRoom.vip_rooms)) {
    return; // Error is already set in isVipRoomValid
  }

  try {
    setActionLoading(true);
    const response = await api.addVipRoom(newVipRoom.product_id, newVipRoom.vip_rooms);
    if (response && response.data) {
      if (response.data.error) {
        setVipRoomFormError(response.data.error);
      } else {
        setSuccess('VIP room added successfully!');
        setVipRooms([...vipRooms, {
          product_id: newVipRoom.product_id,
          vip_rooms: newVipRoom.vip_rooms
        }]);
        setNewVipRoom({ product_id: '', vip_rooms: '' });
        setShowVipForm(false);
      }
    }
  } catch (err) {
    console.error('Error adding VIP room:', err);
    const errorMessage = err.response?.data?.error || err.message;
    setVipRoomFormError(`Failed to add VIP room: ${errorMessage}`);
  } finally {
    setActionLoading(false);
  }
};






  if (loading && !accessMatrix) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh', background: '#F7F9FC' }}>
        <div className="text-center">
          <div className="spinner-container mb-3">
            <FontAwesomeIcon icon={faSpinner} spin className="text-primary" style={{ fontSize: '2.5rem' }} />
          </div>
          <h5 className="text-dark">Loading tables data...</h5>
          <p className="text-muted">Please wait while we fetch your information</p>
        </div>
      </div>
    );
  }

  return (
    <Container fluid className="manage-tables-container px-md-4 py-4">
      {/* Header Section */}
      <div className="header-section mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center">
          <div className="mb-3 mb-md-0">
            <h2 className="page-title">
              <FontAwesomeIcon icon={faUserShield} className="me-2 text-primary" />
              Manage Tables
            </h2>
            <p className="text-secondary">Configure products, cards and access controls</p>
          </div>
        </div>
      </div>
      
      {/* Alert Messages */}
      {error && (
        <div className="alert-message mb-4">
          <div className="alert alert-danger d-flex align-items-center" role="alert">
            <div className="alert-icon-container me-3">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>
            <div>{error}</div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="alert-message mb-4">
          <div className="alert alert-success d-flex align-items-center" role="alert">
            <div className="alert-icon-container me-3">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div>{success}</div>
          </div>
        </div>
      )}
      
      {/* Access Matrix Card */}
      {accessMatrix && (
        <Card className="access-matrix-card mb-4">
          <Card.Header>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <h6 className="section-title">
                <FontAwesomeIcon icon={faLock} className="me-2" />
                Package Access Matrix
              </h6>
              <Button 
                variant="primary"
                size={windowWidth < 576 ? "sm" : ""}
                onClick={saveAccessMatrix}
                disabled={savingMatrix || Object.keys(matrixChanges).length === 0}
                className="save-button"
              >
                {savingMatrix ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Saving...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSave} className="me-2" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover responsive className="matrix-table mb-0">
                <thead>
                  <tr>
                    <th>Package Type</th>
                    {ALL_FACILITIES.map(facility => (
                      <th key={facility} className="text-center">{facility}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PACKAGE_TYPES.map(packageType => (
                  <tr key={packageType}>
                    <td className="package-type-cell">
                      <span className="package-name">{packageType}</span>
                      {['Service Card', 'Master Card', 'General'].includes(packageType) && (
                        <span className="special-badge">Special</span>
                      )}
                    </td>
                    {ALL_FACILITIES.map(facility => (
                      <td 
                        key={`${packageType}-${facility}`}
                        className={['Service Card', 'Master Card', 'General'].includes(packageType) ? 'text-center' : 'access-cell'}
                        onClick={() => !['Service Card', 'Master Card', 'General'].includes(packageType) && toggleAccess(packageType, facility)}
                      >
                        {['Service Card', 'Master Card', 'General'].includes(packageType) ? (
                          <span className="text-muted">—</span>
                        ) : (accessMatrix[packageType] && accessMatrix[packageType][facility]) ? (
                          <div className="access-allowed">
                            <FontAwesomeIcon icon={faCheck} className="me-1" /> Allowed
                          </div>
                        ) : (
                          <div className="access-denied">
                            <FontAwesomeIcon icon={faTimes} className="me-1" /> Denied
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
          <Card.Footer className="text-muted">
            <FontAwesomeIcon icon={faInfo} className="me-1" />
            Click on the cells to toggle access for each package type and facility
          </Card.Footer>
        </Card>
      )}

      {/* Products and Cards Row */}
      <Row className="g-4">
        {/* Products Table Card */}
        <Col lg={6} xs={12}>
          <Card className="data-card mb-4">
            <Card.Header>
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                <h6 className="section-title">
                  <FontAwesomeIcon icon={faDatabase} className="me-2" />
                  Products
                </h6>


                {!showProductForm && (
                  <Button 
                    variant="outline-primary"
                    size={windowWidth < 576 ? "sm" : ""}
                    onClick={() => setShowProductForm(true)}
                    disabled={actionLoading}
                    className="add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Product
                  </Button>
                )}
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover responsive className="data-table mb-0">
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Room ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length > 0 ? (
                      products.map((product, index) => (
                        <tr key={index}>
                          <td className="product-id">{product.product_id}</td>
                          <td>{product.room_id}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="text-center py-4">No products defined</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
              
              {/* Product Form */}
            {showProductForm && (
              <div className="form-container">
                <div className="form-content">
                  <h6 className="form-title">Add New Product</h6>
                  {productFormError && (
                    <div className="alert alert-danger mb-3">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                      {productFormError}
                    </div>
                  )}
                    <Form>
                      <Row className="g-3">
                        <Col sm={6}>
                          <Form.Group>
                            <Form.Label>Product ID</Form.Label>
                            <Form.Control
                              type="text" 
                              name="product_id" 
                              placeholder="Enter product ID" 
                              value={newProduct.product_id}
                              onChange={handleProductInputChange}
                              required 
                            />
                            <Form.Text className="text-muted">
                              Must be unique across Products and VIP Rooms
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col sm={6}>
                          <Form.Group>
                            <Form.Label>Room ID</Form.Label>
                            <Form.Control
                              type="text" 
                              name="room_id" 
                              placeholder="Enter room ID" 
                              value={newProduct.room_id}
                              onChange={handleProductInputChange}
                              required 
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <div className="form-actions">
                        <Button 
                          variant="outline-secondary"
                          onClick={() => {
                            setShowProductForm(false);
                            setNewProduct({ product_id: '', room_id: '' });
                          }}
                          disabled={actionLoading}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="primary"
                          onClick={handleAddProduct}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Saving...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faCheck} className="me-2" /> Save
                            </>
                          )}
                        </Button>
                      </div>
                    </Form>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
          
          {/* VIP Rooms Table Card */}
          <Card className="data-card mb-4">
            <Card.Header>
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                <h6 className="section-title">
                  <FontAwesomeIcon icon={faTable} className="me-2" />
                  VIP Rooms
                </h6>
                {!showVipForm && (
                  <Button 
                    variant="outline-primary"
                    size={windowWidth < 576 ? "sm" : ""}
                    onClick={() => setShowVipForm(true)}
                    disabled={actionLoading}
                    className="add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} className="me-1" /> Add VIP Room
                  </Button>
                )}
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover responsive className="data-table mb-0">
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>VIP Rooms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vipRooms.length > 0 ? (
                      vipRooms.map((vip, index) => (
                        <tr key={index}>
                          <td className="product-id">{vip.product_id}</td>
                          <td>
                            <span className="vip-room-badge">{vip.vip_rooms}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="text-center py-4">No VIP rooms defined</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
              
              {/* VIP Form */}
          {showVipForm && (
            <div className="form-container">
              <div className="form-content">
                <h6 className="form-title">Add New VIP Room</h6>
                {vipRoomFormError && (
                  <div className="alert alert-danger mb-3">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                    {vipRoomFormError}
                  </div>
                )}
                              <Form>
                      <Row className="g-3">
                        <Col sm={6}>
                          <Form.Group>
                            <Form.Label>Product ID</Form.Label>
                            <Form.Control
                              type="text" 
                              name="product_id" 
                              placeholder="Enter product ID" 
                              value={newVipRoom.product_id}
                              onChange={handleVipRoomInputChange}
                              required 
                            />
                            <Form.Text className="text-muted">
                              Must be unique across Products and VIP Rooms
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col sm={6}>
                          <Form.Group>
                            <Form.Label>VIP Rooms</Form.Label>
                            <Form.Control
                              type="text" 
                              name="vip_rooms" 
                              placeholder="Enter VIP rooms" 
                              value={newVipRoom.vip_rooms}
                              onChange={handleVipRoomInputChange}
                              required 
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <div className="form-actions">
                        <Button 
                          variant="outline-secondary"
                          onClick={() => {
                            setShowVipForm(false);
                            setNewVipRoom({ product_id: '', vip_rooms: '' });
                          }}
                          disabled={actionLoading}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="primary"
                          onClick={handleAddVipRoom}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Saving...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faCheck} className="me-2" /> Save
                            </>
                          )}
                        </Button>
                      </div>
                    </Form>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

 <Col lg={6} xs={12}>
        <Card className="data-card mb-4">
  <Card.Header>
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
      <h6 className="section-title">
        <FontAwesomeIcon icon={faCreditCard} className="me-2" />
        Card Package Management
      </h6>
      <div className="d-flex gap-2">
        <Button 
          variant="outline-secondary"
          size={windowWidth < 576 ? "sm" : ""}
          onClick={refreshData}
          disabled={loading}
          className="refresh-button"
        >
          <FontAwesomeIcon icon={faSpinner} spin={loading} className="me-1" />
          Refresh
        </Button>
        <Button 
          variant="primary"
          size={windowWidth < 576 ? "sm" : ""}
          onClick={savePackageChanges}
          disabled={savingPackage || !hasPackageChanges}
          className="save-button"
        >
          {savingPackage ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Saving...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faSave} className="me-2" /> Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  </Card.Header>
  <Card.Body className="p-0">
    <div className="table-responsive">
      <Table hover responsive className="data-table mb-0">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Card ID</th>

            <th>Package Type</th>
          </tr>
        </thead>
        <tbody>
          {/* {unifiedCardEntries.length > 0 ? (
            unifiedCardEntries.map((entry, index) => { */}

            {/* {unifiedCardEntries.length > 0 ? (
            [...unifiedCardEntries]
              .sort((a, b) => a.product_id.localeCompare(b.product_id))
              .map((entry, index) => { */}
            {unifiedCardEntries.length > 0 ? (
            [...unifiedCardEntries]
              .sort((a, b) => {
                const prodCompare = a.product_id.localeCompare(b.product_id);
                if (prodCompare !== 0) return prodCompare;
                return a.uid.localeCompare(b.uid);
              })
              .map((entry, index) => {

              const cardKey = `${entry.product_id}-${entry.uid}`;
              const currentPackage = draftCardPackages[cardKey] || '';
              const savedPackage = cardPackages[cardKey] || '';
              const hasDraftChanges = currentPackage !== savedPackage && currentPackage !== ''; 

              return (
                <tr key={index}>
                  <td className="product-id">{entry.product_id}</td>
                  <td className="card-id">{entry.uid}</td>

                  <td>
                    <Dropdown>
                      <Dropdown.Toggle 
                        variant={hasDraftChanges ? "warning" : "outline-secondary"}
                        size={windowWidth < 576 ? "sm" : ""}
                        disabled={savingPackage}
                        className="package-dropdown"
                      >
                        {savingPackage && hasDraftChanges ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Saving...
                          </>
                        ) : currentPackage || (cardTypeMap[entry.uid] ? 
                          `${cardTypeMap[entry.uid]}` : 'General')}
                      </Dropdown.Toggle>

                      <Dropdown.Menu className="package-dropdown-menu">
                        {!currentPackage && cardTypeMap[entry.uid] && (
                          <Dropdown.Item 
                            onClick={() => handlePackageChange(entry.product_id, entry.uid, cardTypeMap[entry.uid])}
                          >
                            Use existing ({cardTypeMap[entry.uid]})
                          </Dropdown.Item>
                        )}
                        {PACKAGE_TYPES.map((option, idx) => (
                          <Dropdown.Item 
                            key={idx} 
                            onClick={() => handlePackageChange(entry.product_id, entry.uid, option)}
                            active={currentPackage === option}
                          >
                            {option}
                          </Dropdown.Item>
                        ))}
                        <Dropdown.Divider />
                        <Dropdown.Item 
                          className="apply-all-item"
                          onClick={() => {
                            const packageToApply = currentPackage || PACKAGE_TYPES[0];
                            handlePackageChange(entry.product_id, entry.uid, packageToApply, true);
                          }}
                        >
                          <FontAwesomeIcon icon={faCheck} className="me-1" />
                          Apply selected to all instances
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="2" className="text-center py-4">No card assignments found</td>
            </tr>
          )}
        </tbody>
      </Table>
      {hasPackageChanges && (
        <div className="changes-notification">
          <div className="d-flex align-items-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
            <span>You have unsaved package changes. Click "Save Changes" to apply them.</span>
          </div>
        </div>
      )}
    </div>
  </Card.Body>
  <Card.Footer className="text-muted d-flex justify-content-between align-items-center flex-wrap">
    <div>
      Showing {unifiedCardEntries.length} card assignments
    </div>
    <div className="text-info small">
      <FontAwesomeIcon icon={faFilter} className="me-1" />
      Only active, valid assignments are shown
    </div>
  </Card.Footer>
</Card>


        
    
                    <Card className="data-card mb-4">
            <Card.Header>
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                <h6 className="section-title">
                  <FontAwesomeIcon icon={faExchangeAlt} className="me-2" />
                  Card Switcher
                </h6>
                {!showCardSwitcher && (
                  <Button 
                    variant="outline-primary"
                    size={windowWidth < 576 ? "sm" : ""}
                    onClick={() => setShowCardSwitcher(true)}
                    disabled={actionLoading}
                    className="add-button"
                  >
                    <FontAwesomeIcon icon={faPlus} className="me-1" /> Assign Card to Product
                  </Button>
                )}
              </div>
            </Card.Header>
                        <Card.Body className={showCardSwitcher ? "p-0" : "p-4"}>
              {!showCardSwitcher ? (
                <div className="text-center py-4 text-muted">
                  <FontAwesomeIcon icon={faInfoCircle} className="me-2" />
                  Use this tool to assign existing cards to different products
                </div>
              ) : (
                <div className="form-container">
                  <div className="form-content">
                    <h6 className="form-title">Assign Card to Product</h6>
                    {cardSwitcherError && (
                      <div className="alert alert-danger mb-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                        {cardSwitcherError}
                      </div>
                    )} 

                    <Form>
                      <Row className="g-3">
                        <Col sm={6}>
                          <Form.Group>
                            <Form.Label>Select Product</Form.Label>
                            <Form.Select
                              name="selectedProductId"
                              value={cardSwitcherData.selectedProductId}
                              onChange={handleCardSwitcherInputChange}
                              required
                              disabled={actionLoading}
                            >
                              <option value="">Choose a product...</option>
                              {availableProducts.map((product, idx) => (
                                <option key={idx} value={product.product_id}>
                                  {product.product_id} ({product.room_id})
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col sm={6}>

                          <Form.Group>
                            <Form.Label>Select Card</Form.Label>
                            <Form.Select
                              name="selectedCardId"
                              value={cardSwitcherData.selectedCardId}
                              onChange={handleCardSwitcherInputChange}
                              required
                              disabled={actionLoading}
                            >
                              <option value="">Choose a card...</option>
                              {availableCards.map((card, idx) => (
                                <option key={idx} value={card.uid}>
                                  {card.uid} ({card.type || 'General'})
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                      </Row>
                      <div className="form-actions">
                        <Button 
                          variant="outline-secondary"
                          onClick={() => {
                            setShowCardSwitcher(false);
                            resetCardSwitcherForm();
                          }}
                          disabled={actionLoading}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="primary"
                          onClick={handleCardAssignment}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin className="me-2" /> Assigning...
                            </>
                          ) : (
                                                        <>
                              <FontAwesomeIcon icon={faLink} className="me-2" /> Assign Card
                            </>
                          )}
                        </Button>
                      </div>
                    </Form>
                  </div>
                </div>
              )}
            </Card.Body>
            <Card.Footer className="text-muted">
              <FontAwesomeIcon icon={faInfoCircle} className="me-1" />
              Card package type will automatically be inherited from the card's existing assignment
            </Card.Footer>
          </Card>


</Col>
        
      </Row>

      {/* Custom styling */}
      <style jsx="true">{`
        /* General Layout and Colors */
        .manage-tables-container {
          background-color: #F7F9FC;
          min-height: 100vh;
        }
        
        /* Typography */
        .page-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1E293B;
          margin-bottom: 0.5rem;
        }
        
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #3361FF;
          margin: 0;
          display: flex;
          align-items: center;
        }
        
        /* Cards */
        .data-card, .access-matrix-card {
          border: none;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          transition: all 0.2s ease;
        }
        
        .data-card:hover, .access-matrix-card:hover {
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
        
        /* Card Headers */
        .card-header {
          background-color: #FFFFFF;
          border-bottom: 1px solid #E9ECEF;
          padding: 16px 20px;
        }
        
        /* Card Footer */
        .card-footer {
          background-color: #FFFFFF;
          border-top: 1px solid #E9ECEF;
          padding: 12px 20px;
          font-size: 0.85rem;
        }
        
        /* Buttons */
        .add-button, .save-button {
          border-radius: 8px;
          padding: 0.5rem 1rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
        }
        
        .add-button {
          color: #3361FF;
          border-color: #3361FF;
        }
        
        .add-button:hover {
          background-color: #3361FF;
          color: white;
        }
        
        .save-button {
          background-color: #3361FF;
          border-color: #3361FF;
        }
        
        .save-button:hover {
          background-color: #264CDC;
          border-color: #264CDC;
        }
        
        .save-button:disabled {
          background-color: #B8C2CC;
          border-color: #B8C2CC;
        }
        
        /* Tables */
        .data-table, .matrix-table {
          margin-bottom: 0;
        }
        
        .data-table thead th, .matrix-table thead th {
          background-color: #F8FAFD;
          color: #64748B;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 14px 16px;
          border-bottom: 1px solid #E9ECEF;
        }
        
        .data-table tbody td, .matrix-table tbody td {
          padding: 14px 16px;
          vertical-align: middle;
          border-bottom: 1px solid #F1F5F9;
          color: #1E293B;
        }
        
        .product-id {
          font-weight: 600;
          color: #3361FF;
        }
        
        .card-id {
          font-family: 'Courier New', monospace;
          font-size: 0.9rem;
          color: #475569;
        }
        
        /* Access Matrix */
        .access-cell {
          cursor: pointer;
          text-align: center;
          transition: background-color 0.15s ease;
        }
        
        .access-cell:hover {
          background-color: #F1F5F9;
        }
        
        .package-type-cell {
          display: flex;
          align-items: center;
          padding: 14px 16px;
        }
        
        .package-name {
          font-weight: 600;
          color: #334155;
        }
        
        .special-badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 600;
          color: #0284C7;
          background-color: #E0F2FE;
          padding: 2px 8px;
          border-radius: 12px;
          margin-left: 8px;
        }
        
        .access-allowed {
          display: inline-block;
          font-weight: 500;
          color: #059669;
          background-color: #ECFDF5;
          padding: 6px 12px;
          border-radius: 6px;
        }
        
        .access-denied {
          display: inline-block;
          font-weight: 500;
          color: #DC2626;
          background-color: #FEF2F2;
          padding: 6px 12px;
          border-radius: 6px;
        }
        
        /* VIP Room Badge */
        .vip-room-badge {
          display: inline-block;
          background-color: #FEF3C7;
          color: #B45309;
          font-weight: 500;
          font-size: 0.9rem;
          padding: 6px 12px;
          border-radius: 6px;
        }
        
        /* Package Dropdown */
        .package-dropdown {
          width: 100%;
          text-align: left;
          border-radius: 6px;
          font-weight: 500;
        }
        
        .package-dropdown-menu {
          width: 100%;
          padding: 8px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .apply-all-item {
          color: #3361FF;
          font-weight: 500;
        }
        
        /* Forms */
        .form-container {
          padding: 20px;
          border-top: 1px solid #E9ECEF;
        }
        
        .form-content {
          background-color: #F8FAFD;
          border-radius: 8px;
          padding: 20px;
        }
        
        .form-title {
          font-weight: 600;
          color: #1E293B;
          margin-bottom: 1.25rem;
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 1.5rem;
        }
        
        .form-control {
          border-radius: 6px;
          border-color: #CBD5E1;
          padding: 0.6rem 0.75rem;
        }
        
        .form-control:focus {
          border-color: #3361FF;
          box-shadow: 0 0 0 0.25rem rgba(51, 97, 255, 0.15);
        }
        
        /* Alert Messages */
        .alert {
          border: none;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
        }
        
        .alert-danger {
          background-color: #FEF2F2;
          color: #B91C1C;
        }
        
        .alert-success {
          background-color: #ECFDF5;
          color: #047857;
        }
        
        .alert-icon-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 1rem;
        }
        
        .alert-danger .alert-icon-container {
          background-color: #FEE2E2;
        }
        
        .alert-success .alert-icon-container {
          background-color: #D1FAE5;
        }
        
        /* Changes Notification */
        .changes-notification {
          padding: 14px 20px;
          background-color: #FFFBEB;
          color: #B45309;
          border-top: 1px solid #FEF3C7;
        }
        
        /* Spinner Animation */
        .spinner-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background-color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          margin: 0 auto;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .section-title {
            font-size: 1rem;
          }
          
          .page-title {
            font-size: 1.4rem;
          }
          
          .data-table thead th, .matrix-table thead th {
            padding: 12px;
            font-size: 0.8rem;
          }
          
          .data-table tbody td, .matrix-table tbody td {
            padding: 12px;
          }
          
          .access-allowed, .access-denied {
            padding: 4px 8px;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </Container>
  );
};

export default ManageTables;





