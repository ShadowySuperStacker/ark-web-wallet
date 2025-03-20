// DOM Elements
const balanceOffchain = document.getElementById('balance-offchain');
const balanceOnchain = document.getElementById('balance-onchain');
const vtxoPubkey = document.getElementById('vtxo-pubkey');
const vtxosList = document.getElementById('vtxos-list');
const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const refreshBalanceBtn = document.getElementById('refresh-balance');
const refreshVtxosBtn = document.getElementById('refresh-vtxos');
const copyPubkeyBtn = document.getElementById('copy-pubkey');
const paymentForm = document.getElementById('payment-form');
const vtxoRefreshAlert = document.getElementById('vtxo-refresh-alert');
const actionGuidanceModal = new bootstrap.Modal(document.getElementById('actionGuidanceModal'));
const actionGuidanceModalBody = document.getElementById('actionGuidanceModalBody');
const actionGuidanceButton = document.getElementById('actionGuidanceButton');

// Create a Bootstrap toast instance
const toast = new bootstrap.Toast(toastElement, { 
    autohide: true,
    delay: 3000
});

// Current block height (approximated)
let currentBlockHeight = 0;
// Store VTXO data
let currentVtxos = [];

// Helper function to format a date
function formatDate(date) {
    return date.toLocaleString();
}

// Helper function to estimate date from block height
function estimateBlockTime(blockHeight) {
    // Average bitcoin block time is 10 minutes, but on signet it can vary
    // Calculate blocks remaining 
    const blocksRemaining = blockHeight - currentBlockHeight;
    
    // Calculate time in the future (10 min per block)
    const futureDate = new Date();
    futureDate.setMinutes(futureDate.getMinutes() + (blocksRemaining * 10));
    
    return formatDate(futureDate);
}

// API Functions
async function fetchBalance() {
    try {
        const response = await fetch('/api/balance');
        const data = await response.json();
        
        balanceOffchain.textContent = data.offchain_sat.toLocaleString();
        balanceOnchain.textContent = data.onchain_sat.toLocaleString();
        
        showToast('Balance updated', 'success');
    } catch (error) {
        console.error('Error fetching balance:', error);
        showToast('Error retrieving balance', 'danger');
    }
}

async function fetchVtxoPubkey() {
    try {
        const response = await fetch('/api/vtxo-pubkey');
        const data = await response.json();
        
        vtxoPubkey.value = data.pubkey;
    } catch (error) {
        console.error('Error fetching VTXO pubkey:', error);
        showToast('Error retrieving VTXO pubkey', 'danger');
    }
}

async function fetchVtxos() {
    try {
        const response = await fetch('/api/vtxos');
        const vtxos = await response.json();
        
        // Store the VTXO data
        currentVtxos = vtxos;
        
        // Clear the existing list
        vtxosList.innerHTML = '';
        
        // Add each VTXO to the table
        vtxos.forEach(vtxo => {
            const row = document.createElement('tr');
            
            // Truncate the ID for display
            const idShort = `${vtxo.id.substring(0, 8)}...${vtxo.id.substring(vtxo.id.length - 8)}`;
            
            // Determine if this VTXO is nearing expiry
            const isNearingExpiry = vtxo.expiry_height - currentBlockHeight < 1000;
            const expiryClass = isNearingExpiry ? 'text-danger fw-bold' : '';
            
            // Estimate expiry time
            const estimatedExpiry = estimateBlockTime(vtxo.expiry_height);
            
            // Create the table cells
            row.innerHTML = `
                <td title="${vtxo.id}">${idShort}</td>
                <td>${vtxo.amount_sat.toLocaleString()}</td>
                <td>${vtxo.vtxo_type}</td>
                <td class="${expiryClass}" title="${isNearingExpiry ? 'Nearing expiry!' : ''}">
                    ${vtxo.expiry_height} 
                    <span class="text-muted small d-block">~${estimatedExpiry}</span>
                </td>
            `;
            
            vtxosList.appendChild(row);
            
            // Update the current block height based on the VTXO
            // This is an approximation, assuming expiry is usually set ~10000 blocks in the future
            if (currentBlockHeight === 0) {
                currentBlockHeight = vtxo.expiry_height - 10000;
            }
        });
        
        // Show refresh alert if needed
        checkVtxosNeedRefresh();
        
        showToast('VTXOs updated', 'success');
    } catch (error) {
        console.error('Error fetching VTXOs:', error);
        showToast('Error retrieving VTXOs', 'danger');
    }
}

function checkVtxosNeedRefresh() {
    // Check if any VTXOs need refresh (non-round type or nearing expiry)
    const needsRefresh = currentVtxos.some(vtxo => 
        vtxo.vtxo_type !== 'round' || 
        (vtxo.expiry_height - currentBlockHeight < 1000)
    );
    
    vtxoRefreshAlert.style.display = needsRefresh ? 'block' : 'none';
}

async function refreshVtxos() {
    try {
        showToast('Refreshing... This may take a moment', 'info');
        
        const response = await fetch('/api/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // Refresh our list of VTXOs
            await fetchVtxos();
            // Also refresh the balance
            await fetchBalance();
            
            showToast('VTXOs successfully refreshed', 'success');
            
            // Show success modal
            showGuidanceModal(
                'VTXOs Successfully Refreshed',
                `<p>Your VTXOs have been successfully refreshed in a round.</p>
                <p>Results of this refresh:</p>
                <ul>
                    <li>The type of your VTXOs has been changed to "round"</li>
                    <li>The expiry time of your VTXOs has been extended</li>
                    <li>Multiple VTXOs have been consolidated into one</li>
                </ul>`,
                'Close',
                null
            );
        } else {
            throw new Error('Failed to refresh VTXOs');
        }
    } catch (error) {
        console.error('Error refreshing VTXOs:', error);
        showToast('Error refreshing VTXOs', 'danger');
    }
}

async function sendPayment(destination, amount, comment) {
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                destination,
                amount,
                comment
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('Payment sent successfully!', 'success');
            // Refresh balance after sending payment
            await fetchBalance();
            await fetchVtxos();
            
            // Show guidance modal
            showGuidanceModal(
                'Payment Sent Successfully',
                `<p>Your payment has been sent successfully!</p>
                <p>You've received change as a new VTXO.</p>
                <p>Would you like to refresh your VTXOs? Refreshing will:</p>
                <ul>
                    <li>Change the type of your VTXOs</li>
                    <li>Extend their expiry time</li>
                    <li>Consolidate multiple VTXOs into one</li>
                </ul>
                <p>Would you like to refresh your VTXOs now?</p>`,
                'Refresh VTXOs',
                refreshVtxos
            );
            
            return true;
        } else {
            throw new Error(result.error || 'Failed to send payment');
        }
    } catch (error) {
        console.error('Error sending payment:', error);
        showToast(`Error sending payment: ${error.message}`, 'danger');
        return false;
    }
}

// Helper function to show toast notifications
function showToast(message, type = 'primary') {
    // Remove previous color classes
    toastElement.classList.remove('bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info');
    
    // Add the appropriate color class
    toastElement.classList.add(`bg-${type}`);
    
    // Set the message
    toastMessage.textContent = message;
    
    // Show the toast
    toast.show();
}

// Helper function to show guidance modals
function showGuidanceModal(title, body, buttonText, buttonAction) {
    // Set the title and body
    document.getElementById('actionGuidanceModalLabel').textContent = title;
    actionGuidanceModalBody.innerHTML = body;
    
    // Set the button text
    actionGuidanceButton.textContent = buttonText;
    
    // Set up the button action
    if (buttonAction) {
        actionGuidanceButton.onclick = () => {
            actionGuidanceModal.hide();
            buttonAction();
        };
        actionGuidanceButton.style.display = 'block';
    } else {
        actionGuidanceButton.style.display = 'none';
    }
    
    // Show the modal
    actionGuidanceModal.show();
}

// Event Listeners
refreshBalanceBtn.addEventListener('click', fetchBalance);
refreshVtxosBtn.addEventListener('click', refreshVtxos);

copyPubkeyBtn.addEventListener('click', () => {
    vtxoPubkey.select();
    document.execCommand('copy');
    showToast('VTXO pubkey copied to clipboard', 'success');
});

paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const destination = document.getElementById('destination').value.trim();
    const amount = document.getElementById('amount').value.trim();
    const comment = document.getElementById('comment').value.trim();
    
    if (!destination) {
        showToast('Please enter a destination', 'warning');
        return;
    }
    
    showToast('Processing payment...', 'info');
    
    const success = await sendPayment(destination, amount, comment);
    
    if (success) {
        // Reset the form
        paymentForm.reset();
    }
});

// Initialize the app
window.addEventListener('DOMContentLoaded', async () => {
    // Load all data on page load
    await fetchVtxoPubkey();
    await fetchBalance();
    await fetchVtxos();
}); 