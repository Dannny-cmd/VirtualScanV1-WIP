const apiUrl = 'https://api.virtuals.io/api/virtuals?filters[status]=1&sort[0]=createdAt%3Adesc&sort[1]=createdAt%3Adesc&populate[0]=image&pagination[page]=1&pagination[pageSize]=200';
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
      const holderPromises = tokens.map(token => fetchHolders(token.preToken));
      return Promise.all(holderPromises);
    }

    async function fetchData() {
      await fetchPrice();
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        allItems = data.data;

        const holdersData = await fetchAllHolders(allItems);
        allItems = allItems.map((item, index) => ({
          ...item,
          topHolders: holdersData[index] || [] // Ensure topHolders is always defined
        }));

        displayData(allItems);
        populateChainFilter(allItems);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    function formatMarketCap(value) {
      if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(1)}M`; // Millions
      } else if (value >= 1e3) {
        return `$${(value / 1e3).toFixed(1)}k`; // Thousands
      }
      return `$${value.toFixed(2)}`; // Default to two decimal places
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

    function generateUserLinks(links) {
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
            <p class="copyable-text" onclick="copyToClipboard('${item.preToken}')"><strong>CA:</strong> ${item.preToken}</p>
            <p class="copyable-text" onclick="copyToClipboard('${item.walletAddress}')"><strong>Dev Wallet:</strong> ${item.walletAddress}</p>
            <p><strong>Holders:</strong> ${item.holderCount || 0}</p>
            <p><strong>Chain:</strong> ${item.chain}</p>
            <p><strong>Market Cap:</strong> ${marketCap}</p> <!-- Use formatted market cap -->
            <p><strong>Top 10 Holder %:</strong> ${topHoldersPercentage}% 
              <button onclick="showTopHolders('${item.preToken}')" style="background: none; border: none; cursor: pointer;">
                <img src="https://i.postimg.cc/s2zTj2XX/magnify.png" alt="View Top Holders" style="width: 20px; height: 20px; vertical-align: middle;">
              </button>
            </p>
            <div class="user-links">
              ${generateUserLinks(item.socials.USER_LINKS)}
            </div>
            <div class="trade-links">
              <a href="https://app.virtuals.io/prototypes/${item.preToken}" target="_blank" class="trade-link">Trade on Virtuals</a>
              ${item.chain === 'SOLANA' ? 
                `<a href="https://solscan.io/token/${item.preToken}" target="_blank" class="trade-link">Solscan</a>` : 
                item.chain === 'BASE' ? 
                `<a href="https://basescan.org/address/${item.preToken}" target="_blank" class="trade-link">Basescan</a>` : 
                ''
              }
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

    function showTopHolders(preToken) {
      const holders = allItems.find(item => item.preToken === preToken).topHolders;
      const modalBody = document.getElementById('modal-body');
      modalBody.innerHTML = holders.map(holder => `<p>${holder[0]}: ${holder[1]}</p>`).join('');
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

    document.querySelectorAll('input[name="sort"]').forEach(input => {
      input.addEventListener('change', () => displayData(allItems));
    });

    document.getElementById('search-input').addEventListener('input', filterData);
    document.getElementById('chain-filter').addEventListener('change', filterData);

    fetchData();
