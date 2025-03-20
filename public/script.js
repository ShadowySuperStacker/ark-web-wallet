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

// Create a Bootstrap toast instance
const toast = new bootstrap.Toast(toastElement, { 
    autohide: true,
    delay: 3000
});

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
        
        // Clear the existing list
        vtxosList.innerHTML = '';
        
        // Add each VTXO to the table
        vtxos.forEach(vtxo => {
            const row = document.createElement('tr');
            
            // Truncate the ID for display
            const idShort = `${vtxo.id.substring(0, 8)}...${vtxo.id.substring(vtxo.id.length - 8)}`;
            
            // Create the table cells
            row.innerHTML = `
                <td title="${vtxo.id}">${idShort}</td>
                <td>${vtxo.amount_sat.toLocaleString()}</td>
                <td>${vtxo.vtxo_type}</td>
                <td>${vtxo.expiry_height}</td>
            `;
            
            vtxosList.appendChild(row);
        });
        
        showToast('VTXOs updated', 'success');
    } catch (error) {
        console.error('Error fetching VTXOs:', error);
        showToast('Error retrieving VTXOs', 'danger');
    }
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