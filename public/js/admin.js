// Admin Dashboard JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user || !user.isAdmin) {
        window.location.href = '/login';
        return;
    }

    // Initialize dashboard
    initDashboard();

    // Event Listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);

    async function initDashboard() {
        try {
            // Load dashboard data
            await loadDashboardData();
            
            // Update UI
            updateUI();
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showToast('Failed to load dashboard data', 'danger');
        }
    }

    async function loadDashboardData() {
        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                updateStatistics(data.data.statistics);
                displayRecentUsers(data.data.recentUsers);
                displayRecentTransactions(data.data.recentTransactions);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            throw error;
        }
    }

    function updateStatistics(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalProducts').textContent = stats.totalProducts || 0;
        document.getElementById('totalTransactions').textContent = stats.totalTransactions || 0;
        document.getElementById('totalRevenue').textContent = formatCurrency(stats.totalPurchases || 0);
    }

    function displayRecentUsers(users) {
        const tbody = document.getElementById('recentUsers');
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No recent users</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.full_name || user.username}</td>
                <td>${user.email}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td><span class="badge bg-${user.is_verified ? 'success' : 'warning'}">${user.is_verified ? 'Verified' : 'Pending'}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    function displayRecentTransactions(transactions) {
        const tbody = document.getElementById('recentTransactions');
        tbody.innerHTML = '';
        
        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No recent transactions</td></tr>';
            return;
        }

        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.username || 'Unknown'}</td>
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
            loadDashboardData();
        }
    });

    // Handle network status changes
    window.addEventListener('online', function() {
        showToast('Connection restored', 'success');
        loadDashboardData();
    });

    window.addEventListener('offline', function() {
        showToast('You are now offline', 'warning');
    });

    // Auto-refresh data every 2 minutes
    setInterval(() => {
        if (!document.hidden) {
            loadDashboardData();
        }
    }, 2 * 60 * 1000);
});