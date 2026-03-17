// User Dashboard JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        window.location.href = '/login';
        return;
    }

    // Initialize dashboard
    initDashboard();

    // Event Listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('addFundsBtn').addEventListener('click', addFunds);

    async function initDashboard() {
        try {
            // Load user data
            await loadUserData();
            
            // Load recent transactions
            await loadRecentTransactions();
            
            // Load statistics
            await loadStatistics();
            
            // Update UI
            updateUI();
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showToast('Failed to load dashboard data', 'danger');
        }
    }

    async function loadUserData() {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('user', JSON.stringify(data.data.user));
                updateUserInfo(data.data.user);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            throw error;
        }
    }

    function updateUserInfo(userData) {
        document.getElementById('userName').textContent = userData.fullName || userData.username;
        document.getElementById('welcomeName').textContent = userData.fullName || userData.username;
        document.getElementById('walletBalance').textContent = formatCurrency(userData.walletBalance || 0);
        
        // Format member since date
        const createdAt = new Date(userData.createdAt);
        document.getElementById('memberSince').textContent = createdAt.toLocaleDateString();
    }

    async function loadRecentTransactions() {
        try {
            const response = await fetch('/api/user/transactions?limit=5', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayRecentTransactions(data.data.transactions);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    function displayRecentTransactions(transactions) {
        const tbody = document.getElementById('recentTransactions');
        tbody.innerHTML = '';
        
        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No recent transactions</td></tr>';
            return;
        }

        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(transaction.created_at).toLocaleDateString()}</td>
                <td>${transaction.description}</td>
                <td><span class="badge bg-secondary">${transaction.transaction_type}</span></td>
                <td>${formatCurrency(transaction.amount)}</td>
                <td><span class="badge ${getStatusClass(transaction.status)}">${transaction.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    function getStatusClass(status) {
        switch (status.toLowerCase()) {
            case 'completed': return 'bg-success';
            case 'pending': return 'bg-warning';
            case 'failed': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    async function loadStatistics() {
        try {
            const response = await fetch('/api/user/statistics', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                updateStatistics(data.data);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    function updateStatistics(stats) {
        document.getElementById('totalPurchases').textContent = stats.totalPurchases || 0;
        document.getElementById('totalTransactions').textContent = stats.totalTransactions || 0;
        document.getElementById('totalSavings').textContent = formatCurrency(stats.totalSavings || 0);
    }

    function updateUI() {
        // Update active navigation
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    async function addFunds() {
        const form = document.getElementById('addFundsForm');
        const amount = document.getElementById('amount').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const btn = document.getElementById('addFundsBtn');
        const spinner = btn.querySelector('.spinner-border');

        // Validation
        if (!amount || amount < 100) {
            showToast('Minimum deposit is ₦100', 'warning');
            return;
        }

        if (!paymentMethod) {
            showToast('Please select a payment method', 'warning');
            return;
        }

        // Show loading state
        btn.disabled = true;
        spinner.classList.remove('d-none');
        btn.textContent = ' Processing...';

        try {
            const response = await fetch('/api/user/wallet/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    paymentMethod: paymentMethod
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Funds added successfully!', 'success');
                
                // Update wallet balance
                await loadUserData();
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addFundsModal'));
                modal.hide();
                
                // Reset form
                form.reset();
            } else {
                throw new Error(data.message || 'Failed to add funds');
            }
        } catch (error) {
            console.error('Error adding funds:', error);
            showToast(error.message || 'An error occurred while adding funds', 'danger');
        } finally {
            // Reset button state
            btn.disabled = false;
            spinner.classList.add('d-none');
            btn.innerHTML = '<span class="spinner-border spinner-border-sm d-none me-2" role="status" aria-hidden="true"></span>Add Funds';
        }
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Utility function for showing toast messages
    window.showToast = function(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer') || createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        
        bsToast.show();
        
        // Remove toast from DOM after it's hidden
        toast.addEventListener('hidden.bs.toast', function() {
            this.remove();
        });
    };

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }

    // Handle page visibility changes to refresh data
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // Page is visible, refresh data
            initDashboard();
        }
    });

    // Handle network status changes
    window.addEventListener('online', function() {
        showToast('Connection restored', 'success');
        initDashboard();
    });

    window.addEventListener('offline', function() {
        showToast('You are now offline', 'warning');
    });

    // Auto-refresh data every 5 minutes
    setInterval(() => {
        if (!document.hidden) {
            loadUserData();
            loadRecentTransactions();
        }
    }, 5 * 60 * 1000);
});