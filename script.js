const apiUrlPrototype = 'https://api.virtuals.io/api/virtuals?filters[status]=1&sort[0]=createdAt%3Adesc&sort[1]=createdAt%3Adesc&populate[0]=image&pagination[page]=1&pagination[pageSize]=100';
    const apiUrlSentient = 'https://api.virtuals.io/api/virtuals?filters[status]=2&sort[0]=createdAt%3Adesc&sort[1]=createdAt%3Adesc&populate[0]=image&pagination[page]=1&pagination[pageSize]=100';
    const coinLoreUrl = 'https://api.coinlore.net/api/ticker/?id=127083';
    let allItems = [];
    let uniqueChains = new Set();
    let priceUsd = 0;

    async function fetchPrice() {
      try {
        const response = await fetch(coinLoreUrl);
        const data = await response.json();
        priceUsd = parseFloat(data[0].price_usd);
      } catch (error) {
        console.error('Error fetching price:', error);
      }
    }

    async function fetchHolders(preToken) {
      try {
        const response = await fetch(`https://api.virtuals.io/api/tokens/${preToken}/holders`);
        const data = await response.json();
        return data.data.slice(0, 10);
      } catch (error) {
        console.error('Error fetching holders:', error);
        return [];
      }
    }

    async function fetchAllHolders(tokens) {
      const holderPromises = tokens.map(token => {
        const tokenToUse = token.tokenAddress || token.preToken; // Use tokenAddress if available, otherwise use preToken
        return fetchHolders(tokenToUse);
      });
      return Promise.all(holderPromises);
    }

    async function fetchData(searchTerm = '') {
      showLoadingScreen(); // Show loading screen
      await fetchPrice();
      let url;

      if (searchTerm) {
        // Disable the radio buttons
        document.querySelectorAll('input[name="type"]').forEach(input => {
          input.disabled = true;
          input.parentElement.style.color = 'grey'; // Grey out the labels
        });

        url = `https://api.virtuals.io/api/virtuals?filters&sort[0]=createdAt%3Adesc&sort[1]=createdAt%3Adesc&populate[0]=image&pagination[page]=1&pagination[pageSize]=100&filters[$or][0][name][$contains]=${searchTerm}&filters[$or][1][symbol][$contains]=${searchTerm}&filters`;
      } else {
        const selectedType = document.querySelector('input[name="type"]:checked').value;
        url = selectedType === 'sentient' ? apiUrlSentient : apiUrlPrototype;
        enableRadioButtons(); // Re-enable radio buttons when search term is cleared
      }

      try {
        const response = await fetch(url);
        const data = await response.json();
        allItems = data.data.map(item => ({
          ...item,
          tokenAddress: item.tokenAddress !== null ? item.tokenAddress : item.preToken // Use tokenAddress if not null, otherwise use preToken
        }));

        // Fetch holders data for the filtered items
        const holdersData = await fetchAllHolders(allItems);
        allItems = allItems.map((item, index) => ({
          ...item,
          topHolders: holdersData[index] || [] // Ensure topHolders is always defined
        }));

        displayData(allItems);
        populateChainFilter(allItems);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        hideLoadingScreen(); // Hide loading screen
      }
    }

    function debounce(func, delay) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    }

    function showLoadingScreen() {
      document.getElementById('loading-screen').style.display = 'flex';
    }

    function hideLoadingScreen() {
      document.getElementById('loading-screen').style.display = 'none';
    }

    function formatMarketCap(value) {
      if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(1)}M`; // Millions
      } else if (value >= 1e3) {
        return `$${(value / 1e3).toFixed(1)}k`; // Thousands
      }
      return `$${value.toFixed(2)}`; // Default to two decimal places
    }

    function formatAmount(value) {
      let formattedValue;
      let percentage = ((value / 1_000_000_000) * 100).toFixed(2); // Calculate percentage of 1 billion

      if (value < 10000) {
        formattedValue = value.toFixed(9); // Full number with 9 decimal places
      } else if (value >= 1e6) {
        formattedValue = `${(value / 1e6).toFixed(1)}m`; // Format as millions
      } else if (value >= 1e3) {
        formattedValue = `${(value / 1e3).toFixed(1)}k`; // Format as thousands
      } else {
        formattedValue = `${value.toFixed(1)}`; // Format as is with one decimal place
      }

      return `${formattedValue} (${percentage}%)`; // Return formatted value with percentage
    }

    function timeAgo(dateString) {
      const now = new Date();
      const createdAt = new Date(dateString);
      const seconds = Math.floor((now - createdAt) / 1000);
      let interval = Math.floor(seconds / 31536000);

      if (interval >= 1) {
        return interval === 1 ? "1 year ago" : interval + " years ago";
      }
      interval = Math.floor(seconds / 2592000);
      if (interval >= 1) {
        return interval === 1 ? "1 month ago" : interval + " months ago";
      }
      interval = Math.floor(seconds / 86400);
      if (interval >= 1) {
        return interval === 1 ? "1 day ago" : interval + " days ago";
      }
      interval = Math.floor(seconds / 3600);
      if (interval >= 1) {
        return interval === 1 ? "1 hour ago" : interval + " hours ago";
      }
      interval = Math.floor(seconds / 60);
      if (interval >= 1) {
        return interval === 1 ? "1 minute ago" : interval + " minutes ago";
      }
      return seconds === 1 ? "1 second ago" : seconds + " seconds ago";
    }

    function formatAddress(address) {
      if (!address || typeof address !== 'string') return ''; // Return empty string if address is null or not a string
      if (address.length <= 8) return address; // Return as is if too short
      return `${address.slice(0, 4)}...${address.slice(-4)}`; // Format address
    }

    function generateUserLinks(links) {
      if (!links || typeof links !== 'object') {
        return ''; // Return empty string if links is undefined or not an object
      }
      
      let userLinksHtml = '';
      for (const [key, value] of Object.entries(links)) {
        if (value) {
          userLinksHtml += `<a href="${value}" target="_blank">${key}</a>`;
        }
      }
      return userLinksHtml;
    }

    function sortData(items) {
      const sortOption = document.querySelector('input[name="sort"]:checked').value;
      if (sortOption === 'marketCap') {
        return items.sort((a, b) => parseFloat(b.mcapInVirtual) - parseFloat(a.mcapInVirtual));
      }
      return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function displayData(items) {
      const container = document.getElementById('data-container');
      container.innerHTML = '';
      const sortedItems = sortData(items);
      sortedItems.forEach(item => {
        const mcapInVirtual = parseFloat(item.mcapInVirtual);
        const marketCap = formatMarketCap(mcapInVirtual * priceUsd); // Format market cap

        const totalTopHolders = item.topHolders.reduce((total, holder) => total + holder[1], 0);
        const topHoldersPercentage = ((totalTopHolders / 1_000_000_000) * 100).toFixed(2);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'item';
        itemDiv.innerHTML = `
          <div class="item-header">
            <img src="${item.image.url}" alt="${item.name}">
            <h2>${item.name} <span class="symbol">($${item.symbol})</span></h2>
          </div>
          <div class="item-details">
            <p>
              <img src="https://i.postimg.cc/GpCVcvh6/icon-design-black-and-white-timer-symbol-alarm-clocks-removebg-preview.png" 
                   alt="Created At" title="Created At" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 5px;">
              ${timeAgo(item.createdAt)} <!-- Use the timeAgo function here -->
            </p>
            <div class="copyable-text" onclick="copyToClipboard('${item.tokenAddress || item.preToken}')"><strong>CA:</strong> ${formatAddress(item.tokenAddress || item.preToken)}</div>
            <div class="copyable-text" onclick="copyToClipboard('${item.walletAddress}')"><strong>Dev Wallet:</strong> ${formatAddress(item.walletAddress)}</div>
            <p><strong>Holders:</strong> ${item.holderCount || 0}</p>
            <p><strong>Chain:</strong> ${item.chain}</p>
            <p><strong>Market Cap:</strong> ${marketCap}</p> <!-- Use formatted market cap -->
            <p><strong>Top 10 Holder %:</strong> ${topHoldersPercentage}% 
              <button onclick="showTopHolders('${item.preToken}')" style="background: none; border: none; cursor: pointer;">
                <img src="https://i.postimg.cc/s2zTj2XX/magnify.png" alt="View Top Holders" style="width: 20px; height: 20px; vertical-align: middle;">
              </button>
            </p>
            <div class="user-links">
              ${generateUserLinks(item.socials && typeof item.socials === 'object' ? item.socials.USER_LINKS : {})}
            </div>
            <div class="trade-links">
              <a href="https://app.virtuals.io/prototypes/${item.preToken}" target="_blank" class="trade-link">Trade on Virtuals</a>
              <a href="${item.chain === 'SOLANA' ? `https://solscan.io/token/${item.tokenAddress}` : `https://basescan.org/address/${item.tokenAddress}`}" target="_blank" class="trade-link">${item.chain === 'SOLANA' ? 'Solscan' : 'Basescan'}</a>
            </div>
          </div>
        `;
        container.appendChild(itemDiv);
      });
    }

    function populateChainFilter(items) {
      const chainFilter = document.getElementById('chain-filter');
      uniqueChains.clear();
      items.forEach(item => {
        uniqueChains.add(item.chain);
      });
      chainFilter.innerHTML = '<option value="">All Chains</option>';
      uniqueChains.forEach(chain => {
        const option = document.createElement('option');
        option.value = chain;
        option.textContent = chain;
        chainFilter.appendChild(option);
      });
    }

    function filterData() {
      const searchTerm = document.getElementById('search-input').value.toLowerCase();
      const selectedChain = document.getElementById('chain-filter').value;
      const filteredItems = allItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm);
        const matchesChain = selectedChain ? item.chain === selectedChain : true;
        return matchesSearch && matchesChain;
      });
      displayData(filteredItems);
    }

    // Add event listener for chain filter
    document.getElementById('chain-filter').addEventListener('change', filterData);

    function showTopHolders(preToken) {
      const item = allItems.find(item => item.preToken === preToken);
      if (!item) {
        console.error('Token not found:', preToken);
        return; // Exit if the item is not found
      }
      
      const holders = item.topHolders;
      const modalBody = document.getElementById('modal-body');
      modalBody.innerHTML = holders.map(holder => {
        const formattedAmount = formatAmount(holder[1]); // Format the amount
        return `<p>${holder[0]}: ${formattedAmount}</p>`; // Use formatted amount
      }).join('');
      openModal();
    }

    function openModal() {
      document.getElementById('modal').style.display = 'block';
    }

    function closeModal() {
      document.getElementById('modal').style.display = 'none';
    }

    function copyToClipboard(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showCopyNotification('Copied to clipboard: ' + text); // Show notification
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
      }
      document.body.removeChild(textArea);
    }

    function showCopyNotification(message) {
      const popup = document.createElement('div');
      popup.className = 'copy-popup';
      popup.innerText = message;
      document.body.appendChild(popup);
      setTimeout(() => {
        document.body.removeChild(popup);
      }, 2000); // Remove after 2 seconds
    }

    // Add event listener for radio buttons
    document.querySelectorAll('input[name="type"]').forEach(input => {
      input.addEventListener('change', () => {
        const searchTerm = document.getElementById('search-input').value.trim();
        fetchData(searchTerm); // Fetch data with the current search term
      });
    });

    // Add event listener for sorting buttons
    document.querySelectorAll('input[name="sort"]').forEach(input => {
      input.addEventListener('change', () => {
        displayData(allItems); // Re-display data when sorting option changes
      });
    });

    // Add event listener for search input with debounce
    const debouncedFetchData = debounce((searchTerm) => fetchData(searchTerm), 500);
    document.getElementById('search-input').addEventListener('input', (event) => {
      const searchTerm = event.target.value.trim();
      document.getElementById('clear-search').style.display = searchTerm ? 'block' : 'none'; // Show or hide clear button
      debouncedFetchData(searchTerm); // Use debounced function
    });

    // Clear search input
    document.getElementById('clear-search').addEventListener('click', () => {
      const searchInput = document.getElementById('search-input');
      searchInput.value = '';
      document.getElementById('clear-search').style.display = 'none'; // Hide clear button
      fetchData(); // Fetch all data again
    });

    // Add event listener for refresh button
    document.querySelector('.refresh-button').addEventListener('click', () => {
      const searchInput = document.getElementById('search-input');
      searchInput.value = '';
      document.getElementById('clear-search').style.display = 'none'; // Hide clear button
      fetchData(); // Fetch all data again
    });

    // Enable radio buttons function
    function enableRadioButtons() {
      document.querySelectorAll('input[name="type"]').forEach(input => {
        input.disabled = false;
        input.parentElement.style.color = ''; // Reset label color
      });
    }

    // Initial data fetch
    fetchData();

    // Show and hide sidebar menu
    function showMenu() {
      document.getElementById('sidebar').style.display = 'block';
    }

    function hideMenu() {
      document.getElementById('sidebar').style.display = 'none';
    }
