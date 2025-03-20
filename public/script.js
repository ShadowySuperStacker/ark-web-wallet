// DOM Elements
let balanceOffchain, balanceOnchain, balancePending, balanceTotal, vtxoPubkeyInput, 
    vtxosList, vtxoRefreshBtn, refreshVtxosBtn, refreshBalanceBtn, copyPubkeyBtn, 
    paymentForm, actionGuidanceModal, actionGuidanceModalTitle, actionGuidanceModalBody,
    actionGuidanceButton, actionGuidanceModalClose, vtxoRefreshAlert, deleteWalletBtn,
    resetWalletModal, confirmDeleteWalletBtn, resetModalClose, walletStatusAlert,
    closeStatusAlertBtn, themeToggle, onchainBalanceEl, onchainAddressEl, boardAmountInput,
    boardBtn, exitBtn, exitVtxoSelect, refreshOnchainBtn, copyOnchainAddressBtn;

// Initialize DOM references
function initializeDOMReferences() {
    balanceOffchain = document.getElementById('balance-offchain');
    balanceOnchain = document.getElementById('balance-onchain');
    balancePending = document.getElementById('balance-pending');
    balanceTotal = document.getElementById('balance-total');
    vtxoPubkeyInput = document.getElementById('vtxo-pubkey');
    vtxosList = document.getElementById('vtxos-list');
    vtxoRefreshBtn = document.getElementById('vtxo-refresh-btn');
    refreshVtxosBtn = document.getElementById('refresh-vtxos-btn');
    refreshBalanceBtn = document.getElementById('refresh-balance-btn');
    copyPubkeyBtn = document.getElementById('copy-pubkey-btn');
    paymentForm = document.getElementById('payment-form');
    actionGuidanceModal = document.getElementById('actionGuidanceModal');
    actionGuidanceModalTitle = document.getElementById('actionGuidanceModalTitle');
    actionGuidanceModalBody = document.getElementById('actionGuidanceModalBody');
    actionGuidanceButton = document.getElementById('actionGuidanceButton');
    actionGuidanceModalClose = document.getElementById('actionGuidanceModalClose');
    vtxoRefreshAlert = document.getElementById('vtxo-refresh-alert');
    deleteWalletBtn = document.getElementById('delete-wallet-btn');
    resetWalletModal = document.getElementById('resetWalletModal');
    confirmDeleteWalletBtn = document.getElementById('confirm-delete-wallet');
    resetModalClose = document.getElementById('reset-modal-close');
    walletStatusAlert = document.getElementById('wallet-status-alert');
    closeStatusAlertBtn = document.getElementById('close-status-alert');
    themeToggle = document.getElementById('theme-toggle');
    onchainBalanceEl = document.getElementById('onchain-balance');
    onchainAddressEl = document.getElementById('onchain-address');
    boardAmountInput = document.getElementById('board-amount');
    boardBtn = document.getElementById('board-btn');
    exitBtn = document.getElementById('exit-btn');
    exitVtxoSelect = document.getElementById('exit-vtxo');
    refreshOnchainBtn = document.getElementById('refresh-onchain-btn');
    copyOnchainAddressBtn = document.getElementById('copy-onchain-address-btn');
}

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

// Don't execute this code immediately, wait for DOM
// Initialize theme as it doesn't depend on DOM elements
initTheme();

// Wait for DOM before accessing elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM references first
    initializeDOMReferences();
    
    // Now we can add event listeners to DOM elements
    themeToggle.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
    });
    
    // Continue with other DOM-dependent initialization
    setupEventListeners();
    initApp();
});

// Setup event listeners after DOM is loaded
function setupEventListeners() {
    // Status alert handling
    closeStatusAlertBtn.addEventListener('click', () => {
        walletStatusAlert.classList.add('hidden');
    });
    
    // Other event listeners
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
    
    actionGuidanceModalClose.addEventListener('click', () => {
        closeModal(actionGuidanceModal);
    });
    
    resetModalClose.addEventListener('click', () => {
        closeModal(resetWalletModal);
    });
    
    // Advanced Features event listeners
    refreshOnchainBtn.addEventListener('click', async () => {
        await Promise.all([
            fetchOnchainBalance(),
            fetchOnchainAddress()
        ]);
        showToast('On-chain info refreshed', 'success');
    });
    
    copyOnchainAddressBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(onchainAddressEl.title);
        showToast('On-chain address copied to clipboard', 'success');
    });
    
    boardBtn.addEventListener('click', boardFunds);
    exitBtn.addEventListener('click', exitFunds);
}

// Status alert handling
function setupStatusAlertHandling() {
    closeStatusAlertBtn.addEventListener('click', () => {
        walletStatusAlert.classList.add('hidden');
    });
}

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
    try {
        // Get fresh references to DOM elements to avoid any stale references
        const modalTitle = document.getElementById('actionGuidanceModalTitle');
        const modalBody = document.getElementById('actionGuidanceModalBody');
        const actionButton = document.getElementById('actionGuidanceButton');
        const modal = document.getElementById('actionGuidanceModal');
        const closeButton = document.getElementById('actionGuidanceModalClose');
        
        if (!modal || !modalTitle || !modalBody || !actionButton) {
            console.error('Modal elements not found');
            showToast('Error: Could not show the guidance modal', 'error');
            return;
        }
        
        // Update modal content
        modalTitle.textContent = title;
        modalBody.innerHTML = body;
        actionButton.textContent = buttonText;
        
        // Direct approach: remove all existing listeners
        // and add a new one, without node replacement
        // This is safer in case of DOM manipulation issues
        const safeButton = document.getElementById('actionGuidanceButton');
        if (safeButton) {
            // Clone node approach (safer if button exists)
            try {
                const parent = safeButton.parentNode;
                if (parent) {
                    const newButton = safeButton.cloneNode(true);
                    parent.replaceChild(newButton, safeButton);
                    
                    // Add the click event listener to the new button
                    newButton.addEventListener('click', () => {
                        if (typeof buttonAction === 'function') {
                            buttonAction();
                        }
                        modal.classList.add('hidden');
                    });
                } else {
                    // Fallback if parentNode is null
                    safeButton.onclick = () => {
                        if (typeof buttonAction === 'function') {
                            buttonAction();
                        }
                        modal.classList.add('hidden');
                    };
                }
            } catch (error) {
                console.error('Button replacement failed, using direct event assignment:', error);
                // Direct approach fallback
                safeButton.onclick = () => {
                    if (typeof buttonAction === 'function') {
                        buttonAction();
                    }
                    modal.classList.add('hidden');
                };
            }
        }
        
        // Add handler to close button as well
        if (closeButton) {
            closeButton.onclick = () => {
                modal.classList.add('hidden');
            };
        }
        
        // Show the modal
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error showing guidance modal:', error);
        showToast('Could not display the guidance information', 'error');
    }
}

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
            
            // Calculate expiry date
            const expiryDate = new Date();
            expiryDate.setMinutes(expiryDate.getMinutes() + minutesToExpiry);
            const expiryDateStr = expiryDate.toLocaleString();
            
            if (minutesToExpiry < 60) {
                expiryTimeDisplay = `~${minutesToExpiry} minutes (${expiryDateStr})`;
            } else if (minutesToExpiry < 1440) {
                expiryTimeDisplay = `~${Math.round(minutesToExpiry / 60)} hours (${expiryDateStr})`;
            } else {
                expiryTimeDisplay = `~${Math.round(minutesToExpiry / 1440)} days (${expiryDateStr})`;
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
        
        const data = await response.json();
        
        if (!response.ok) {
            // Specifieke afhandeling voor het geval er geen VTXOs zijn om te verversen
            if (data.error === 'No VTXOs to refresh') {
                showToast(data.message, 'info');
                // Toon een informatieve modal
                showGuidanceModal(
                    'No VTXOs Need Refreshing',
                    `
                    <p class="mb-3">None of your VTXOs need to be refreshed at this time.</p>
                    <p class="mb-3">VTXOs typically need refreshing when:</p>
                    <ul class="list-disc pl-5 mb-3">
                        <li>They are nearing their expiry height (shown in yellow)</li>
                        <li>You want to combine several small VTXOs</li>
                    </ul>
                    <p>The system will automatically indicate when your VTXOs need refreshing.</p>
                    `,
                    'Understood',
                    () => {}
                );
                return;
            }
            
            // Anders, toon de standaard fout
            throw new Error(data.error || 'Failed to refresh VTXOs');
        }
        
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
        
        // Check if it's a Lightning invoice (starts with lnbc or lntbs)
        const isLightningInvoice = recipient.toLowerCase().startsWith('lnbc') || recipient.toLowerCase().startsWith('lntbs');
        
        // If it's not a Lightning invoice, amount is required
        if (!isLightningInvoice && !amount) {
            showToast('Amount is required for VTXO pubkey or Lightning address payments', 'error');
            return;
        }
        
        // Controleer of er al een "Sending payment..." toast zichtbaar is
        const existingToasts = document.querySelectorAll('#toast-container div');
        let paymentToastExists = false;
        
        existingToasts.forEach(toast => {
            if (toast.textContent.includes('Sending payment...')) {
                paymentToastExists = true;
            }
        });
        
        // Alleen een nieuwe toast tonen als er nog geen is
        if (!paymentToastExists) {
            showToast('Sending payment... This may take a moment.', 'info');
        }
        
        try {
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
            
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error('Failed to parse JSON response:', jsonError);
                throw new Error('Invalid response from server');
            }
            
            if (!response.ok) {
                // Check if the data contains a meaningful error message
                const errorMessage = data.error || data.details || 'Failed to send payment';
                
                // Check if error message actually contains payment success indicators
                if (
                    typeof errorMessage === 'string' && (
                        errorMessage.includes('Payment sent') ||
                        errorMessage.includes('Bolt11 payment succeeded') ||
                        errorMessage.includes('Payment preimage received') ||
                        errorMessage.includes('Adding change VTXO') ||
                        errorMessage.includes('UNIQUE constraint failed: bark_vtxo_key.idx')
                    )
                ) {
                    // Payment was actually successful despite error response
                    console.log('Payment actually succeeded despite error response');
                    
                    // Continue with success handling
                    await handleSuccessfulPayment();
                    return;
                }
                
                throw new Error(errorMessage);
            }
            
            await handleSuccessfulPayment();
            return data;
        } catch (apiError) {
            console.error('API Error:', apiError);
            
            // Check if there's a specific error with a successful status message anyway
            if (
                apiError.message && 
                (
                    apiError.message.includes('Payment sent') ||
                    apiError.message.includes('Bolt11 payment succeeded') ||
                    apiError.message.includes('Payment preimage received') ||
                    apiError.message.includes('Adding change VTXO') ||
                    apiError.message.includes('UNIQUE constraint failed: bark_vtxo_key.idx')
                )
            ) {
                console.log('Payment might have succeeded despite error');
                
                // Refresh data to check
                const [balanceData, vtxosData] = await Promise.all([
                    fetchBalance(), 
                    fetchVtxos()
                ]);
                
                // If we got data, assume it worked
                if (balanceData && vtxosData) {
                    await handleSuccessfulPayment();
                    return;
                }
            }
            
            // Let's reload the data anyway to check if payment went through
            try {
                await Promise.all([fetchBalance(), fetchVtxos()]);
                // Als de betaling eigenlijk is geslaagd, zou de balans moeten zijn veranderd
                // In dat geval tonen we alsnog een succesbericht
                showToast('Error occurred but payment may have succeeded. Please check your balance.', 'warning');
            } catch (e) {
                console.error('Failed to refresh data after payment error:', e);
            }
            
            // Re-throw for the outer catch
            throw apiError;
        }
    } catch (error) {
        console.error('Error sending payment:', error);
        showToast('Error sending payment: ' + error.message, 'error');
    }
    
    // Helper function for success flow
    async function handleSuccessfulPayment() {
        // Refresh balance and VTXOs after successful payment
        await Promise.all([
            fetchBalance(),
            fetchVtxos()
        ]);
        
        // Clear the form
        document.getElementById('recipient').value = '';
        document.getElementById('amount').value = '';
        
        // Verwijder eventuele bestaande "Sending payment..." toasts
        const existingToasts = document.querySelectorAll('#toast-container div');
        existingToasts.forEach(toast => {
            if (toast.textContent.includes('Sending payment...')) {
                toast.remove();
            }
        });
        
        // Controleer of er al een "Payment sent successfully!" toast zichtbaar is
        const successToastExists = Array.from(document.querySelectorAll('#toast-container div'))
            .some(toast => toast.textContent.includes('Payment sent successfully!'));
        
        // Alleen een nieuwe toast tonen als er nog geen is
        if (!successToastExists) {
            // Show success message
            showToast('Payment sent successfully!', 'success');
        }
        
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

// Function to initialize the app
async function initApp() {
    try {
        // Initialize DOM references first
        initializeDOMReferences();
        
        // Initialize theme
        initTheme();
        
        // Setup event handlers that depend on DOM elements
        setupEventListeners();
        
        // Fetch initial data
        await Promise.all([
            fetchBalance(),
            fetchVtxos(),
            fetchVtxoPubkey()
        ]);
        
        // Initialize advanced features
        await initAdvancedFeatures();
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error initializing wallet. Please refresh the page.', 'error');
    }
}

// Advanced Features API Functions
async function fetchOnchainBalance() {
    try {
        const response = await fetch('/api/onchain-balance');
        if (!response.ok) {
            throw new Error('Failed to fetch onchain balance');
        }
        const data = await response.json();
        
        // Update display
        onchainBalanceEl.textContent = data.balance.toLocaleString() + ' sats';
        
        return data;
    } catch (error) {
        console.error('Error fetching onchain balance:', error);
        showToast('Error fetching onchain balance: ' + error.message, 'error');
    }
}

async function fetchOnchainAddress() {
    try {
        const response = await fetch('/api/onchain-address');
        if (!response.ok) {
            throw new Error('Failed to fetch onchain address');
        }
        
        // Parse de JSON response
        const data = await response.json();
        const address = data.address;
        
        // Update display
        onchainAddressEl.textContent = address;
        onchainAddressEl.title = address;
        
        return address;
    } catch (error) {
        console.error('Error fetching onchain address:', error);
        showToast('Error fetching onchain address: ' + error.message, 'error');
    }
}

async function boardFunds() {
    try {
        const amount = boardAmountInput.value.trim();
        
        showToast('Boarding funds... This may take a moment.', 'info');
        
        const response = await fetch('/api/board', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount || null
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to board funds');
        }
        
        const data = await response.json();
        
        // Refresh relevant data
        await Promise.all([
            fetchBalance(),
            fetchVtxos(),
            fetchOnchainBalance()
        ]);
        
        // Clear input
        boardAmountInput.value = '';
        
        // Show success message
        showToast('Funds boarded successfully!', 'success');
        
        // Show guidance
        showGuidanceModal(
            'Funds Boarded Successfully',
            `
            <p class="mb-3">Your on-chain Bitcoin has been successfully moved to the Ark protocol!</p>
            <p class="mb-3">You should now see a new VTXO of type "board" in your VTXO list.</p>
            <p>This VTXO can be used just like any other VTXO for sending payments within the Ark network.</p>
            `,
            'Got it!',
            () => {}
        );
        
        return data;
    } catch (error) {
        console.error('Error boarding funds:', error);
        showToast('Error boarding funds: ' + error.message, 'error');
    }
}

async function exitFunds() {
    try {
        const vtxoId = exitVtxoSelect.value;
        
        // Confirmation modal for starting the exit process
        showGuidanceModal(
            'Confirm Unilateral Exit',
            `
            <div class="alert-warning mb-4">
                <i class="bi bi-exclamation-triangle-fill"></i> <strong>Warning!</strong> This process:
                <ul class="list-disc pl-5 mt-2">
                    <li>Takes 1-2 hours to complete</li>
                    <li>Requires at least 15,000 on-chain sats per VTXO</li>
                    <li>Cannot be cancelled once started</li>
                </ul>
            </div>
            <p>Are you sure you want to proceed with the unilateral exit?</p>
            `,
            'Start Exit Process',
            async () => {
                try {
                    showToast('Starting exit process... This will take 1-2 hours to complete.', 'info');
                    
                    const response = await fetch('/api/exit', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            vtxoId: vtxoId || null,
                            exitAll: !vtxoId
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to start exit process');
                    }
                    
                    const data = await response.json();
                    
                    // Refresh balances and VTXO list after successful exit
                    await Promise.all([
                        fetchBalance(),
                        fetchVtxos(),
                        fetchOnchainBalance()
                    ]);
                    
                    // Show success message
                    showToast('Exit process started successfully!', 'success');
                    
                    // Show guidance
                    showGuidanceModal(
                        'Exit Process Started',
                        `
                        <p class="mb-3">The unilateral exit process has been started successfully!</p>
                        <p class="mb-3">This process will take 1-2 hours to complete. You can check the progress in your terminal.</p>
                        <p class="mb-3">Once complete, your funds will be available on-chain.</p>
                        <div class="alert-info mt-4">
                            <i class="bi bi-info-circle"></i> <strong>Note:</strong> You can continue using the wallet normally while the exit process runs in the background.
                        </div>
                        `,
                        'Got it!',
                        () => {}
                    );
                    
                    return data;
                } catch (error) {
                    console.error('Error starting exit process:', error);
                    showToast('Error starting exit process: ' + error.message, 'error');
                }
            }
        );
    } catch (error) {
        console.error('Error confirming exit:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// Function to update the exit VTXO select with current VTXOs
function updateExitVtxoSelect() {
    // Clear current options except the first one
    while (exitVtxoSelect.options.length > 1) {
        exitVtxoSelect.remove(1);
    }
    
    // Add current VTXOs as options
    vtxoData.forEach(vtxo => {
        const option = document.createElement('option');
        option.value = vtxo.id;
        option.textContent = `${vtxo.id.substring(0, 8)}... (${vtxo.amount.toLocaleString()} sats, ${vtxo.type})`;
        exitVtxoSelect.appendChild(option);
    });
}

// Extend fetchVtxos to update the exit VTXO select
const originalFetchVtxos = fetchVtxos;
fetchVtxos = async function() {
    const result = await originalFetchVtxos.apply(this, arguments);
    updateExitVtxoSelect();
    return result;
};

// Initialize advanced features
async function initAdvancedFeatures() {
    try {
        await Promise.all([
            fetchOnchainBalance(),
            fetchOnchainAddress()
        ]);
    } catch (error) {
        console.error('Error initializing advanced features:', error);
    }
} 