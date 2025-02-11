const apiUrl = 'https://api.virtuals.io/api/virtuals?filters[status]=1&sort[0]=createdAt%3Adesc&sort[1]=createdAt%3Adesc&populate[0]=image&pagination[page]=1&pagination[pageSize]=500';
const coinLoreUrl = 'https://api.coinlore.net/api/ticker/?id=127083';
let allItems = [];
let uniqueChains = new Set();
let priceUsd = 0;

async function fetchPrice() {
  try {
    const response = await fetch(coinLoreUrl);
    const data = await response.json();
    priceUsd = parseFloat(data[0].price_usd); // Get the price_usd
  } catch (error) {
    console.error('Error fetching price:', error);
  }
}

async function fetchHolders(preToken) {
  try {
    const response = await fetch(`https://api.virtuals.io/api/tokens/${preToken}/holders`);
    const data = await response.json();
    return data.data.slice(0, 5); // Return top 5 holders
  } catch (error) {
    console.error('Error fetching holders:', error);
    return []; // Return empty array on error
  }
}

async function fetchAllHolders(tokens) {
  const holderPromises = tokens.map(token => fetchHolders(token.preToken));
  return Promise.all(holderPromises);
}

async function fetchData() {
  await fetchPrice(); // Fetch the price first
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    allItems = data.data; // Store all items for filtering

    // Fetch all holders in parallel
    const holdersData = await fetchAllHolders(allItems);
    
    // Combine holders data with items
    allItems = allItems.map((item, index) => ({
      ...item,
      topHolders: holdersData[index] // Add top holders to each item
    }));

    displayData(allItems);
    populateChainFilter(allItems); // Populate chain filter after fetching data
  } catch (error) {
    console.error('Error fetching data:', error);
  }
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

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showPopup('Copied to clipboard: ' + text);
    }).catch(err => {
      console.error('Error copying text: ', err);
      fallbackCopyToClipboard(text); // Fallback method
    });
  } else {
    fallbackCopyToClipboard(text); // Fallback method
  }
}

function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showPopup('Copied to clipboard: ' + text);
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }
  document.body.removeChild(textArea);
}

function displayData(items) {
  const container = document.getElementById('data-container');
  container.innerHTML = ''; // Clear previous items
  items.forEach(item => {
    const mcapInVirtual = parseFloat(item.mcapInVirtual);
    const marketCap = (isNaN(mcapInVirtual) ? 'N/A' : (mcapInVirtual * priceUsd).toFixed(2)); // Calculate Market Cap with validation

    // Calculate total of top holders
    const totalTopHolders = item.topHolders.reduce((total, holder) => total + holder[1], 0); // Sum the amounts of top holders
    const topHoldersPercentage = ((totalTopHolders / 1_000_000_000) * 100).toFixed(2); // Calculate percentage of 1 billion

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
          ${new Date(item.createdAt).toLocaleString()}
        </p>
        <p class="copyable-text" onclick="copyToClipboard('${item.preToken}')"><strong>CA:</strong> ${item.preToken}</p>
        <p class="copyable-text" onclick="copyToClipboard('${item.walletAddress}')"><strong>Dev Wallet:</strong> ${item.walletAddress}</p>
        <p><strong>Holders:</strong> ${item.holderCount || 0}</p>
        <p><strong>Chain:</strong> ${item.chain}</p>
        <p><strong>Market Cap:</strong> $${marketCap}</p> <!-- Display Market Cap -->
        <p><strong>Top 5 Holder %:</strong> ${topHoldersPercentage}%</p> <!-- Display Top 5 Holder Percentage -->
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
  items.forEach(item => {
    uniqueChains.add(item.chain); // Collect unique chain values
  });
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

function showPopup(message) {
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.textContent = message;
  document.body.appendChild(popup);
  setTimeout(() => {
    document.body.removeChild(popup);
  }, 2000); // Remove after 2 seconds
}

document.getElementById('search-input').addEventListener('input', filterData);
document.getElementById('chain-filter').addEventListener('change', filterData);

fetchData();
