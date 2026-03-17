const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../config/database');
const { authenticateToken, requireUser } = require('../config/auth');

const router = express.Router();

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2
    }).format(amount);
};

// Get user dashboard data
router.get('/dashboard', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user info
        const user = await db.get(
            'SELECT id, username, email, full_name, phone, wallet_balance, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get recent transactions
        const transactions = await db.all(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [userId]
        );

        // Get statistics
        const stats = await db.get(
            `SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN transaction_type = 'purchase' THEN 1 ELSE 0 END) as total_purchases,
                SUM(CASE WHEN transaction_type = 'wallet_add' THEN amount ELSE 0 END) as total_deposited,
                SUM(CASE WHEN transaction_type = 'wallet_withdraw' THEN amount ELSE 0 END) as total_withdrawn
             FROM transactions WHERE user_id = ?`,
            [userId]
        );

        // Calculate savings (this would be based on actual pricing vs market rates)
        const totalSavings = 0; // Placeholder - would need actual calculation

        res.json({
            success: true,
            data: {
                user: {
                    ...user,
                    wallet_balance: parseFloat(user.wallet_balance)
                },
                transactions,
                statistics: {
                    totalTransactions: stats.total_transactions || 0,
                    totalPurchases: stats.total_purchases || 0,
                    totalDeposited: parseFloat(stats.total_deposited || 0),
                    totalWithdrawn: parseFloat(stats.total_withdrawn || 0),
                    totalSavings: totalSavings
                }
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get user wallet information
router.get('/wallet', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get wallet info
        const wallet = await db.get(
            'SELECT * FROM wallets WHERE user_id = ?',
            [userId]
        );

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet not found'
            });
        }

        // Get recent wallet transactions
        const transactions = await db.all(
            `SELECT * FROM transactions 
             WHERE user_id = ? AND transaction_type IN ('wallet_add', 'wallet_withdraw', 'purchase', 'airtime_to_cash')
             ORDER BY created_at DESC LIMIT 10`,
            [userId]
        );

        res.json({
            success: true,
            data: {
                wallet: {
                    ...wallet,
                    balance: parseFloat(wallet.balance),
                    total_deposited: parseFloat(wallet.total_deposited),
                    total_withdrawn: parseFloat(wallet.total_withdrawn)
                },
                transactions
            }
        });

    } catch (error) {
        console.error('Wallet error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Add funds to wallet
router.post('/wallet/add', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, paymentMethod } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum deposit is ₦100'
            });
        }

        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Payment method is required'
            });
        }

        // In a real application, you would integrate with a payment gateway here
        // For now, we'll simulate a successful payment
        
        const depositAmount = parseFloat(amount);
        
        // Update wallet balance
        await db.run(
            'UPDATE wallets SET balance = balance + ?, total_deposited = total_deposited + ? WHERE user_id = ?',
            [depositAmount, depositAmount, userId]
        );

        // Update user wallet balance
        await db.run(
            'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
            [depositAmount, userId]
        );

        // Record transaction
        await db.run(
            'INSERT INTO transactions (user_id, transaction_type, amount, description, status, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, 'wallet_add', depositAmount, `Wallet deposit via ${paymentMethod}`, 'completed', `DEP_${Date.now()}`]
        );

        // Get updated wallet info
        const updatedWallet = await db.get(
            'SELECT * FROM wallets WHERE user_id = ?',
            [userId]
        );

        res.json({
            success: true,
            message: 'Funds added successfully',
            data: {
                wallet: {
                    ...updatedWallet,
                    balance: parseFloat(updatedWallet.balance)
                }
            }
        });

    } catch (error) {
        console.error('Add funds error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Withdraw funds from wallet
router.post('/wallet/withdraw', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, bankAccount, accountName } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid withdrawal amount'
            });
        }

        if (!bankAccount || !accountName) {
            return res.status(400).json({
                success: false,
                message: 'Bank account details are required'
            });
        }

        // Get current wallet balance
        const wallet = await db.get(
            'SELECT balance FROM wallets WHERE user_id = ?',
            [userId]
        );

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet not found'
            });
        }

        if (wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient funds'
            });
        }

        const withdrawalAmount = parseFloat(amount);

        // Update wallet balance
        await db.run(
            'UPDATE wallets SET balance = balance - ?, total_withdrawn = total_withdrawn + ? WHERE user_id = ?',
            [withdrawalAmount, withdrawalAmount, userId]
        );

        // Update user wallet balance
        await db.run(
            'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
            [withdrawalAmount, userId]
        );

        // Record transaction
        await db.run(
            'INSERT INTO transactions (user_id, transaction_type, amount, description, status, reference_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'wallet_withdraw', withdrawalAmount, 'Wallet withdrawal', 'pending', `WDR_${Date.now()}`, JSON.stringify({ bankAccount, accountName })]
        );

        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully. Processing may take 1-3 business days.',
            data: {
                withdrawalAmount
            }
        });

    } catch (error) {
        console.error('Withdraw funds error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get user transactions
router.get('/transactions', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type;

        let query = 'SELECT * FROM transactions WHERE user_id = ?';
        let params = [userId];

        if (type) {
            query += ' AND transaction_type = ?';
            params.push(type);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const transactions = await db.all(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?';
        let countParams = [userId];

        if (type) {
            countQuery += ' AND transaction_type = ?';
            countParams.push(type);
        }

        const countResult = await db.get(countQuery, countParams);
        const total = countResult.total;

        res.json({
            success: true,
            data: {
                transactions,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            }
        });

    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get user profile
router.get('/profile', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await db.get(
            'SELECT id, username, email, full_name, phone, is_verified, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                user
            }
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { fullName, phone, email } = req.body;

        // Validation
        if (email && !validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (phone && !/^(?:\+234|0)[7-9][0-1]\d{8}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format'
            });
        }

        // Check if email already exists (excluding current user)
        if (email) {
            const existingUser = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Update user
        const updates = [];
        const params = [];

        if (fullName) {
            updates.push('full_name = ?');
            params.push(fullName);
        }

        if (phone) {
            updates.push('phone = ?');
            params.push(phone);
        }

        if (email) {
            updates.push('email = ?');
            params.push(email);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No updates provided'
            });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(userId);

        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

        await db.run(query, params);

        // Get updated user info
        const updatedUser = await db.get(
            'SELECT id, username, email, full_name, phone, is_verified, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedUser
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get available products
router.get('/products', authenticateToken, requireUser, async (req, res) => {
    try {
        const category = req.query.category;
        const network = req.query.network;

        let query = 'SELECT * FROM products WHERE is_active = 1';
        let params = [];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        if (network) {
            query += ' AND network = ?';
            params.push(network);
        }

        query += ' ORDER BY category, network, amount';

        const products = await db.all(query, params);

        // Group products by category
        const groupedProducts = products.reduce((acc, product) => {
            if (!acc[product.category]) {
                acc[product.category] = [];
            }
            acc[product.category].push({
                ...product,
                price: parseFloat(product.price),
                amount: parseFloat(product.amount)
            });
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                products: groupedProducts,
                categories: Object.keys(groupedProducts)
            }
        });

    } catch (error) {
        console.error('Products error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Purchase service
router.post('/purchase', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, phoneNumber, recipientName, smartCardNumber } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        // Get product details
        const product = await db.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Get user wallet balance
        const user = await db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.wallet_balance < product.price) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient funds'
            });
        }

        // Validate required fields based on product type
        if (product.category === 'airtime' && !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required for airtime purchase'
            });
        }

        if (product.category === 'data' && !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required for data purchase'
            });
        }

        if (product.category === 'tv' && !smartCardNumber) {
            return res.status(400).json({
                success: false,
                message: 'Smart card number is required for TV subscription'
            });
        }

        // Deduct from wallet
        await db.run(
            'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
            [product.price, userId]
        );

        await db.run(
            'UPDATE wallets SET balance = balance - ? WHERE user_id = ?',
            [product.price, userId]
        );

        // Record transaction
        const description = `${product.name} for ${phoneNumber || smartCardNumber}`;
        const referenceId = `PUR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.run(
            'INSERT INTO transactions (user_id, product_id, transaction_type, amount, description, status, reference_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, productId, 'purchase', product.price, description, 'completed', referenceId, JSON.stringify({
                phoneNumber,
                recipientName,
                smartCardNumber
            })]
        );

        // In a real application, you would call the VTU API here
        // For now, we'll simulate a successful purchase

        res.json({
            success: true,
            message: 'Purchase completed successfully',
            data: {
                transaction: {
                    referenceId,
                    amount: product.price,
                    description,
                    status: 'completed'
                },
                newBalance: user.wallet_balance - product.price
            }
        });

    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Airtime to cash conversion
router.post('/airtime-to-cash', authenticateToken, requireUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { network, phoneNumber, amount, pin } = req.body;

        if (!network || !phoneNumber || !amount || !pin) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!['mtn', 'airtel', 'glo', '9mobile'].includes(network)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid network'
            });
        }

        if (amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum conversion amount is ₦100'
            });
        }

        // Get user wallet balance
        const user = await db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Calculate conversion rate (this would be dynamic in a real application)
        const conversionRate = 0.85; // 85% of airtime value
        const convertedAmount = amount * conversionRate;

        // Record transaction
        const description = `Airtime to cash conversion: ${network.toUpperCase()} ₦${amount}`;
        const referenceId = `ATC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.run(
            'INSERT INTO transactions (user_id, transaction_type, amount, description, status, reference_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'airtime_to_cash', convertedAmount, description, 'pending', referenceId, JSON.stringify({
                network,
                phoneNumber,
                airtimeAmount: amount,
                pin
            })]
        );

        // Update wallet balance
        await db.run(
            'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
            [convertedAmount, userId]
        );

        await db.run(
            'UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
            [convertedAmount, userId]
        );

        res.json({
            success: true,
            message: 'Airtime to cash conversion request submitted successfully. Please allow 5-10 minutes for processing.',
            data: {
                transaction: {
                    referenceId,
                    airtimeAmount: amount,
                    convertedAmount,
                    description,
                    status: 'pending'
                },
                newBalance: user.wallet_balance + convertedAmount
            }
        });

    } catch (error) {
        console.error('Airtime to cash error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;