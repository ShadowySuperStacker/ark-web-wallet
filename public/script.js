// DOM Elements
const balanceOffchain = document.getElementById('balance-offchain');
const balanceOnchain = document.getElementById('balance-onchain');
const balancePending = document.getElementById('balance-pending');
const balanceTotal = document.getElementById('balance-total');
const vtxoPubkeyInput = document.getElementById('vtxo-pubkey');
const vtxosList = document.getElementById('vtxos-list');
const vtxoRefreshBtn = document.getElementById('vtxo-refresh-btn');
const refreshVtxosBtn = document.getElementById('refresh-vtxos-btn');
const refreshBalanceBtn = document.getElementById('refresh-balance-btn');
const copyPubkeyBtn = document.getElementById('copy-pubkey-btn');
const paymentForm = document.getElementById('payment-form');
const helpToggle = document.getElementById('help-toggle');
const helpSection = document.getElementById('help-section');
const actionGuidanceModal = document.getElementById('actionGuidanceModal');
const actionGuidanceModalTitle = document.getElementById('actionGuidanceModalTitle');
const actionGuidanceModalBody = document.getElementById('actionGuidanceModalBody');
const actionGuidanceButton = document.getElementById('actionGuidanceButton');
const actionGuidanceModalClose = document.getElementById('actionGuidanceModalClose');
const vtxoRefreshAlert = document.getElementById('vtxo-refresh-alert');
const deleteWalletBtn = document.getElementById('delete-wallet-btn');
const resetWalletModal = document.getElementById('resetWalletModal');
const confirmDeleteWalletBtn = document.getElementById('confirm-delete-wallet');
const closeStatusAlert = document.getElementById('close-status-alert');
const walletStatusAlert = document.getElementById('wallet-status-alert');
const resetModalClose = document.getElementById('reset-modal-close');
const themeToggle = document.getElementById('theme-toggle');

// Variables
let currentBlockHeight = 0;
let vtxoData = [];

// Theme Toggle
function initTheme() {
    // Check for user preference
    if (localStorage.theme === 'dark' || 
        (!('theme' in localStorage) && 
        window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// Initialize theme
initTheme();

themeToggle.addEventListener('click', () => {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
});

// Status alert handling
closeStatusAlert.addEventListener('click', () => {
    walletStatusAlert.classList.add('hidden');
});

// Help toggle
helpToggle.addEventListener('click', () => {
    helpSection.classList.toggle('hidden');
});

// Toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const bgColor = type === 'success' ? 'bg-green-500' : 
                    type === 'error' ? 'bg-red-500' : 
                    type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
                    
    toast.className = `${bgColor} text-white py-3 px-4 rounded shadow-lg mb-3 flex justify-between items-center`;
    toast.innerHTML = `
        <div>${message}</div>
        <button class="ml-4 text-white hover:text-gray-200">
            <i class="bi bi-x-lg"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Add click event for the close button
    toast.querySelector('button').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Modal handling functions
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

function showGuidanceModal(title, body, buttonText, buttonAction) {
    actionGuidanceModalTitle.textContent = title;
    actionGuidanceModalBody.innerHTML = body;
    actionGuidanceButton.textContent = buttonText;
    
    // Remove previous event listeners
    const newButton = actionGuidanceButton.cloneNode(true);
    actionGuidanceButton.parentNode.replaceChild(newButton, actionGuidanceButton);
    
    // Add new event listener
    newButton.addEventListener('click', () => {
        buttonAction();
        closeModal(actionGuidanceModal);
    });
    
    openModal(actionGuidanceModal);
}

actionGuidanceModalClose.addEventListener('click', () => {
    closeModal(actionGuidanceModal);
});

resetModalClose.addEventListener('click', () => {
    closeModal(resetWalletModal);
});

// Show wallet status
function showWalletStatus(message) {
    document.getElementById('wallet-status-message').textContent = message;
    walletStatusAlert.classList.remove('hidden');
}

// API Functions
async function fetchBalance() {
    try {
        const response = await fetch('/api/balance');
        if (!response.ok) {
            throw new Error('Failed to fetch balance');
        }
        const data = await response.json();
        
        // Update balance displays
        balanceOffchain.textContent = data.offchain_sat.toLocaleString() + ' sats';
        balanceOnchain.textContent = data.onchain_sat.toLocaleString() + ' sats';
        balancePending.textContent = (data.pending_exit_sat || 0).toLocaleString() + ' sats';
        
        // Calculate and display total
        const total = data.offchain_sat + data.onchain_sat + (data.pending_exit_sat || 0);
        balanceTotal.textContent = total.toLocaleString() + ' sats';
        
        return data;
    } catch (error) {
        console.error('Error fetching balance:', error);
        showToast('Error fetching balance: ' + error.message, 'error');
    }
}

async function fetchVtxoPubkey() {
    try {
        const response = await fetch('/api/vtxo-pubkey');
        if (!response.ok) {
            throw new Error('Failed to fetch VTXO pubkey');
        }
        const data = await response.json();
        vtxoPubkeyInput.value = data.pubkey;
        
        return data.pubkey;
    } catch (error) {
        console.error('Error fetching VTXO pubkey:', error);
        showToast('Error fetching VTXO pubkey: ' + error.message, 'error');
    }
}

async function fetchVtxos() {
    try {
        const response = await fetch('/api/vtxos');
        if (!response.ok) {
            throw new Error('Failed to fetch VTXOs');
        }
        const data = await response.json();
        
        // Store the current block height
        currentBlockHeight = data.current_height;
        
        // Store VTXO data for later use
        vtxoData = data.vtxos;
        
        // Clear the current list
        vtxosList.innerHTML = '';
        
        if (vtxoData.length === 0) {
            // Add a placeholder row for empty state
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="4" class="py-4 px-4 text-center text-gray-500 italic">
                    No VTXOs found. Receive funds to create VTXOs.
                </td>
            `;
            vtxosList.appendChild(emptyRow);
            vtxoRefreshAlert.classList.add('hidden');
            return data;
        }
        
        let needsRefresh = false;
        
        // Add each VTXO to the list
        vtxoData.forEach(vtxo => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
            
            // Check if VTXO is nearing expiry (e.g., within 100 blocks)
            const blocksRemaining = vtxo.expiry - currentBlockHeight;
            const isNearingExpiry = blocksRemaining < 100;
            
            if (isNearingExpiry) {
                needsRefresh = true;
                row.className += ' bg-yellow-50 dark:bg-yellow-900';
            }
            
            // Calculate expiry time 
            // (assuming 10 minutes per block as a signet approximation)
            const minutesToExpiry = blocksRemaining * 10;
            let expiryTimeDisplay = '';
            
            if (minutesToExpiry < 60) {
                expiryTimeDisplay = `~${minutesToExpiry} minutes`;
            } else if (minutesToExpiry < 1440) {
                expiryTimeDisplay = `~${Math.round(minutesToExpiry / 60)} hours`;
            } else {
                expiryTimeDisplay = `~${Math.round(minutesToExpiry / 1440)} days`;
            }
            
            // Format the ID for better display
            const formattedId = vtxo.id.length > 20 
                ? `${vtxo.id.substring(0, 10)}...${vtxo.id.substring(vtxo.id.length - 8)}`
                : vtxo.id;
            
            row.innerHTML = `
                <td class="py-2 px-4" title="${vtxo.id}">${formattedId}</td>
                <td class="py-2 px-4">${vtxo.amount.toLocaleString()}</td>
                <td class="py-2 px-4">${vtxo.type}</td>
                <td class="py-2 px-4">
                    ${vtxo.expiry} (${isNearingExpiry ? '<span class="text-red-500 dark:text-red-400 font-semibold">': ''}${expiryTimeDisplay}${isNearingExpiry ? '</span>': ''})
                </td>
            `;
            
            vtxosList.appendChild(row);
        });
        
        // Show refresh alert if needed
        if (needsRefresh) {
            vtxoRefreshAlert.classList.remove('hidden');
        } else {
            vtxoRefreshAlert.classList.add('hidden');
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching VTXOs:', error);
        showToast('Error fetching VTXOs: ' + error.message, 'error');
    }
}

async function refreshVtxos() {
    try {
        showToast('Refreshing VTXOs in a round... This may take a moment.', 'info');
        
        const response = await fetch('/api/refresh-vtxos', {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to refresh VTXOs');
        }
        
        const data = await response.json();
        
        // Refresh the VTXO list and balance after successful refresh
        await fetchVtxos();
        await fetchBalance();
        
        // Show success message
        showToast('VTXOs refreshed successfully!', 'success');
        
        // Show modal explaining what happened
        showGuidanceModal(
            'VTXOs Refreshed Successfully',
            `
            <p class="mb-3">Your VTXOs have been successfully refreshed in a round! Here's what happened:</p>
            <ul class="list-disc pl-5 mb-3">
                <li>Your VTXOs were combined and new ones were created</li>
                <li>The expiry date of your funds has been extended</li>
                <li>Your VTXOs are now of type "round" which means they're optimized for Ark payments</li>
            </ul>
            <p>Refreshing VTXOs periodically helps keep your wallet healthy and extends the life of your funds.</p>
            `,
            'Great!',
            () => {}
        );
        
        return data;
    } catch (error) {
        console.error('Error refreshing VTXOs:', error);
        showToast('Error refreshing VTXOs: ' + error.message, 'error');
    }
}

async function sendPayment() {
    try {
        const recipient = document.getElementById('recipient').value;
        const amount = document.getElementById('amount').value;
        
        if (!recipient) {
            showToast('Recipient is required', 'error');
            return;
        }
        
        // Check if it's a Lightning invoice (starts with lnbc)
        const isLightningInvoice = recipient.toLowerCase().startsWith('lnbc');
        
        // If it's not a Lightning invoice, amount is required
        if (!isLightningInvoice && !amount) {
            showToast('Amount is required for VTXO pubkey or Bitcoin address payments', 'error');
            return;
        }
        
        showToast('Sending payment... This may take a moment.', 'info');
        
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: recipient,
                amount: amount
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to send payment');
        }
        
        // Refresh balance and VTXOs after successful payment
        await fetchBalance();
        await fetchVtxos();
        
        // Clear the form
        document.getElementById('recipient').value = '';
        document.getElementById('amount').value = '';
        
        // Show success message
        showToast('Payment sent successfully!', 'success');
        
        // Show modal with next steps guidance
        showGuidanceModal(
            'Payment Sent Successfully',
            `
            <p class="mb-3">Your payment has been sent! Here's what happens next:</p>
            <ul class="list-disc pl-5 mb-3">
                <li>You may have received change as a new VTXO</li>
                <li>Your updated balance and VTXOs are shown in the interface</li>
                <li>You might want to refresh your VTXOs later to extend their expiry time</li>
            </ul>
            <p>If you bought something from the <a href="https://signet.2nd.dev/store" target="_blank" class="text-ark-orange hover:underline">Ark Test Store</a>, check your order status there!</p>
            `,
            'Got it!',
            () => {}
        );
        
        return data;
    } catch (error) {
        console.error('Error sending payment:', error);
        showToast('Error sending payment: ' + error.message, 'error');
    }
}

async function deleteWallet() {
    try {
        const response = await fetch('/api/delete-wallet', {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete wallet');
        }
        
        const data = await response.json();
        
        // Show success message
        showToast('Wallet deleted successfully. Reloading page...', 'success');
        
        // Reload the page after a short delay
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
        return data;
    } catch (error) {
        console.error('Error deleting wallet:', error);
        showToast('Error deleting wallet: ' + error.message, 'error');
    }
}

// Event Listeners
refreshBalanceBtn.addEventListener('click', fetchBalance);
refreshVtxosBtn.addEventListener('click', fetchVtxos);
vtxoRefreshBtn.addEventListener('click', refreshVtxos);

copyPubkeyBtn.addEventListener('click', () => {
    vtxoPubkeyInput.select();
    document.execCommand('copy');
    showToast('VTXO pubkey copied to clipboard', 'success');
});

paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendPayment();
});

deleteWalletBtn.addEventListener('click', () => {
    openModal(resetWalletModal);
});

confirmDeleteWalletBtn.addEventListener('click', async () => {
    closeModal(resetWalletModal);
    await deleteWallet();
});

// Initialize application
async function initApp() {
    try {
        // Check wallet status
        const response = await fetch('/api/wallet-status');
        const data = await response.json();
        
        if (!data.initialized) {
            // Show initializing message
            showWalletStatus('Initializing new wallet... This may take a moment.');
            
            // Initialize wallet
            const initResponse = await fetch('/api/init-wallet', { method: 'POST' });
            if (!initResponse.ok) {
                const errorData = await initResponse.json();
                throw new Error(errorData.error || 'Failed to initialize wallet');
            }
            
            // Hide the status alert
            walletStatusAlert.classList.add('hidden');
        }
        
        // Load initial data
        await Promise.all([
            fetchBalance(),
            fetchVtxoPubkey(),
            fetchVtxos()
        ]);
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error initializing app: ' + error.message, 'error');
        showWalletStatus('Error initializing wallet. Please try reloading the page.');
    }
}

// Start the application
initApp(); 