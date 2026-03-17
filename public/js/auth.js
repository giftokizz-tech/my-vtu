// Authentication JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Login Form Handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const spinner = submitBtn.querySelector('.spinner-border');
            const messageDiv = document.getElementById('loginMessage');
            
            // Show loading state
            submitBtn.disabled = true;
            spinner.classList.remove('d-none');
            submitBtn.textContent = ' Signing In...';
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Store token and redirect
                    localStorage.setItem('token', data.data.token);
                    localStorage.setItem('user', JSON.stringify(data.data.user));
                    
                    // Show success message
                    showMessage(messageDiv, 'success', 'Login successful! Redirecting...');
                    
                    // Redirect based on user type
                    setTimeout(() => {
                        if (data.data.user.isAdmin) {
                            window.location.href = '/admin';
                        } else {
                            window.location.href = '/dashboard';
                        }
                    }, 1500);
                } else {
                    throw new Error(data.message || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessage(messageDiv, 'danger', error.message || 'An error occurred. Please try again.');
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                spinner.classList.add('d-none');
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm d-none me-2" role="status" aria-hidden="true"></span>Sign In';
            }
        });
    }
    
    // Register Form Handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fullName = document.getElementById('fullName').value;
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const terms = document.getElementById('terms').checked;
            
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const spinner = submitBtn.querySelector('.spinner-border');
            const messageDiv = document.getElementById('registerMessage');
            
            // Validation
            if (!fullName || !username || !email || !password || !confirmPassword) {
                showMessage(messageDiv, 'warning', 'Please fill in all required fields.');
                return;
            }
            
            if (!validateEmail(email)) {
                showMessage(messageDiv, 'warning', 'Please enter a valid email address.');
                return;
            }
            
            if (!validatePassword(password)) {
                showMessage(messageDiv, 'warning', 'Password must be at least 5 characters (letters or numbers only).');
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage(messageDiv, 'warning', 'Passwords do not match.');
                return;
            }
            
            if (!terms) {
                showMessage(messageDiv, 'warning', 'Please agree to the Terms of Service and Privacy Policy.');
                return;
            }
            
            // Show loading state
            submitBtn.disabled = true;
            spinner.classList.remove('d-none');
            submitBtn.textContent = ' Creating Account...';
            
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        fullName, 
                        username, 
                        email, 
                        phone, 
                        password, 
                        confirmPassword 
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Show success message
                    showMessage(messageDiv, 'success', 'Account created successfully! Redirecting to login...');
                    
                    // Redirect to login after success
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    throw new Error(data.message || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                showMessage(messageDiv, 'danger', error.message || 'An error occurred. Please try again.');
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                spinner.classList.add('d-none');
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm d-none me-2" role="status" aria-hidden="true"></span>Create Account';
            }
        });
    }
    
    // Password visibility toggle
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    
    // Password visibility functionality
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            togglePasswordVisibility(passwordInput, this.querySelector('i'));
        });
    }
    
    if (toggleConfirmPassword && confirmPasswordInput) {
        toggleConfirmPassword.addEventListener('click', function() {
            togglePasswordVisibility(confirmPasswordInput, this.querySelector('i'));
        });
    }
    
    // Password validation for registration
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            validatePasswordLength(this.value);
        });
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            const password = passwordInput ? passwordInput.value : '';
            const confirmPassword = this.value;
            
            if (password && confirmPassword) {
                updatePasswordMatchIndicator(password === confirmPassword);
            }
        });
    }
    
    // Utility Functions
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }
    
    function validatePassword(password) {
        // At least 5 characters, letters or numbers only
        const re = /^[a-zA-Z0-9]{5,}$/;
        return re.test(password);
    }
    
    function validatePasswordLength(password) {
        const indicator = document.getElementById('password-strength');
        if (!indicator) return;
        
        if (password.length >= 5) {
            indicator.textContent = 'Password length is valid';
            indicator.className = 'form-text text-success';
        } else if (password.length > 0) {
            indicator.textContent = 'Password must be at least 5 characters';
            indicator.className = 'form-text text-danger';
        } else {
            indicator.textContent = '';
            indicator.className = 'form-text text-muted';
        }
    }
    
    function togglePasswordVisibility(input, icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
    
    function updatePasswordMatchIndicator(match) {
        const indicator = document.getElementById('password-match');
        if (!indicator) return;
        
        if (match) {
            indicator.textContent = 'Passwords match!';
            indicator.className = 'form-text text-success';
        } else {
            indicator.textContent = 'Passwords do not match';
            indicator.className = 'form-text text-danger';
        }
    }
    
    function showMessage(element, type, message) {
        element.className = `alert alert-${type} alert-dismissible fade show`;
        element.innerHTML = `
            <strong>${type === 'success' ? 'Success!' : type === 'danger' ? 'Error!' : 'Warning!'}</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        element.classList.remove('d-none');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (!element.classList.contains('d-none')) {
                element.classList.add('d-none');
            }
        }, 5000);
    }
    
    // Auto-hide alerts after 3 seconds
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            if (!alert.classList.contains('d-none')) {
                alert.classList.add('d-none');
            }
        }, 3000);
    });
    
    // Add password strength indicator if not present
    if (passwordInput && !document.getElementById('password-strength')) {
        const formGroup = passwordInput.parentElement;
        const strengthDiv = document.createElement('div');
        strengthDiv.id = 'password-strength';
        strengthDiv.className = 'form-text text-muted';
        strengthDiv.textContent = 'Password length: Too short';
        formGroup.appendChild(strengthDiv);
    }
    
    // Add password match indicator if not present
    if (confirmPasswordInput && !document.getElementById('password-match')) {
        const formGroup = confirmPasswordInput.parentElement;
        const matchDiv = document.createElement('div');
        matchDiv.id = 'password-match';
        matchDiv.className = 'form-text text-muted';
        matchDiv.textContent = '';
        formGroup.appendChild(matchDiv);
    }
});