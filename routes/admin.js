const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../config/auth');

const router = express.Router();

// Get admin dashboard data
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get system statistics
        const stats = await db.get(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE is_admin = 1) as total_admins,
                (SELECT COUNT(*) FROM transactions) as total_transactions,
                (SELECT COUNT(*) FROM products WHERE is_active = 1) as total_products,
                (SELECT SUM(amount) FROM transactions WHERE transaction_type = 'wallet_add') as total_deposits,
                (SELECT SUM(amount) FROM transactions WHERE transaction_type = 'wallet_withdraw') as total_withdrawals,
                (SELECT SUM(amount) FROM transactions WHERE transaction_type = 'purchase') as total_purchases
        `);

        // Get recent transactions
        const recentTransactions = await db.all(`
            SELECT t.*, u.username, u.email, p.name as product_name
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN products p ON t.product_id = p.id
            ORDER BY t.created_at DESC LIMIT 10
        `);

        // Get recent users
        const recentUsers = await db.all(`
            SELECT * FROM users 
            ORDER BY created_at DESC LIMIT 5
        `);

        res.json({
            success: true,
            data: {
                statistics: {
                    totalUsers: stats.total_users || 0,
                    totalAdmins: stats.total_admins || 0,
                    totalTransactions: stats.total_transactions || 0,
                    totalProducts: stats.total_products || 0,
                    totalDeposits: parseFloat(stats.total_deposits || 0),
                    totalWithdrawals: parseFloat(stats.total_withdrawals || 0),
                    totalPurchases: parseFloat(stats.total_purchases || 0)
                },
                recentTransactions,
                recentUsers
            }
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let query = `
            SELECT u.*, w.balance as wallet_balance
            FROM users u
            LEFT JOIN wallets w ON u.id = w.user_id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM users u';
        let params = [];
        let countParams = [];

        if (search) {
            query += ' WHERE u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?';
            countQuery += ' WHERE username LIKE ? OR email LIKE ? OR full_name LIKE ?';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const users = await db.all(query, params);
        const countResult = await db.get(countQuery, countParams);
        const total = countResult.total;

        res.json({
            success: true,
            data: {
                users: users.map(user => ({
                    ...user,
                    wallet_balance: parseFloat(user.wallet_balance || 0)
                })),
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get user by ID
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await db.get(`
            SELECT u.*, w.balance as wallet_balance, w.total_deposited, w.total_withdrawn
            FROM users u
            LEFT JOIN wallets w ON u.id = w.user_id
            WHERE u.id = ?
        `, [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user transactions
        const transactions = await db.all(`
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT 20
        `, [userId]);

        res.json({
            success: true,
            data: {
                user: {
                    ...user,
                    wallet_balance: parseFloat(user.wallet_balance || 0),
                    total_deposited: parseFloat(user.total_deposited || 0),
                    total_withdrawn: parseFloat(user.total_withdrawn || 0)
                },
                transactions
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update user wallet balance
router.post('/users/:id/wallet', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { amount, type, description } = req.body;

        if (!amount || !type || !description) {
            return res.status(400).json({
                success: false,
                message: 'Amount, type, and description are required'
            });
        }

        if (!['add', 'subtract'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Must be "add" or "subtract"'
            });
        }

        const amountValue = parseFloat(amount);
        if (amountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }

        // Check if user exists
        const user = await db.get('SELECT id, wallet_balance FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const newAmount = type === 'add' ? amountValue : -amountValue;
        const referenceId = `ADM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Update user wallet balance
        await db.run(
            'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
            [newAmount, userId]
        );

        // Update wallet record
        if (type === 'add') {
            await db.run(
                'UPDATE wallets SET balance = balance + ?, total_deposited = total_deposited + ? WHERE user_id = ?',
                [amountValue, amountValue, userId]
            );
        } else {
            await db.run(
                'UPDATE wallets SET balance = balance + ?, total_withdrawn = total_withdrawn + ? WHERE user_id = ?',
                [newAmount, amountValue, userId]
            );
        }

        // Record transaction
        await db.run(
            'INSERT INTO transactions (user_id, transaction_type, amount, description, status, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, type === 'add' ? 'wallet_add' : 'wallet_withdraw', amountValue, description, 'completed', referenceId]
        );

        // Get updated user info
        const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            message: `Wallet ${type === 'add' ? 'credited' : 'debited'} successfully`,
            data: {
                user: {
                    ...updatedUser,
                    wallet_balance: parseFloat(updatedUser.wallet_balance)
                },
                transaction: {
                    referenceId,
                    amount: amountValue,
                    type,
                    description
                }
            }
        });

    } catch (error) {
        console.error('Update user wallet error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get all products
router.get('/products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const products = await db.all('SELECT * FROM products ORDER BY category, network, amount');

        res.json({
            success: true,
            data: {
                products: products.map(product => ({
                    ...product,
                    price: parseFloat(product.price),
                    amount: parseFloat(product.amount)
                }))
            }
        });

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Create new product
router.post('/products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, category, network, dataType, amount, price } = req.body;

        if (!name || !category || !price) {
            return res.status(400).json({
                success: false,
                message: 'Name, category, and price are required'
            });
        }

        if (!['data', 'airtime', 'tv'].includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category. Must be "data", "airtime", or "tv"'
            });
        }

        if (category === 'data' && (!dataType || !amount)) {
            return res.status(400).json({
                success: false,
                message: 'Data type and amount are required for data products'
            });
        }

        if (category === 'airtime' && !network) {
            return res.status(400).json({
                success: false,
                message: 'Network is required for airtime products'
            });
        }

        if (category === 'tv' && !name.includes('Subscription')) {
            return res.status(400).json({
                success: false,
                message: 'TV products should include "Subscription" in the name'
            });
        }

        const priceValue = parseFloat(price);
        const amountValue = amount ? parseFloat(amount) : null;

        if (priceValue <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Price must be greater than 0'
            });
        }

        // Check if product already exists
        const existingProduct = await db.get(
            'SELECT id FROM products WHERE name = ? AND category = ?',
            [name, category]
        );

        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: 'Product with this name and category already exists'
            });
        }

        // Insert new product
        const result = await db.run(
            'INSERT INTO products (name, category, network, data_type, amount, price) VALUES (?, ?, ?, ?, ?, ?)',
            [name, category, network || null, dataType || null, amountValue, priceValue]
        );

        const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);

        res.json({
            success: true,
            message: 'Product created successfully',
            data: {
                product: {
                    ...newProduct,
                    price: parseFloat(newProduct.price),
                    amount: parseFloat(newProduct.amount || 0)
                }
            }
        });

    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update product
router.put('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, category, network, dataType, amount, price, isActive } = req.body;

        // Check if product exists
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const updates = [];
        const params = [];

        if (name) {
            updates.push('name = ?');
            params.push(name);
        }

        if (category) {
            updates.push('category = ?');
            params.push(category);
        }

        if (network !== undefined) {
            updates.push('network = ?');
            params.push(network || null);
        }

        if (dataType !== undefined) {
            updates.push('data_type = ?');
            params.push(dataType || null);
        }

        if (amount !== undefined) {
            updates.push('amount = ?');
            params.push(amount || null);
        }

        if (price !== undefined) {
            const priceValue = parseFloat(price);
            if (priceValue <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Price must be greater than 0'
                });
            }
            updates.push('price = ?');
            params.push(priceValue);
        }

        if (isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(isActive ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No updates provided'
            });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(productId);

        const query = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;

        await db.run(query, params);

        // Get updated product
        const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [productId]);

        res.json({
            success: true,
            message: 'Product updated successfully',
            data: {
                product: {
                    ...updatedProduct,
                    price: parseFloat(updatedProduct.price),
                    amount: parseFloat(updatedProduct.amount || 0)
                }
            }
        });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Delete product
router.delete('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;

        // Check if product exists
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Delete product
        await db.run('DELETE FROM products WHERE id = ?', [productId]);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get all transactions
router.get('/transactions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const type = req.query.type;
        const status = req.query.status;
        const userId = req.query.userId;

        let query = `
            SELECT t.*, u.username, u.email, p.name as product_name
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN products p ON t.product_id = p.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM transactions t';
        let params = [];
        let countParams = [];

        const conditions = [];
        
        if (type) {
            conditions.push('t.transaction_type = ?');
            params.push(type);
            countParams.push(type);
        }

        if (status) {
            conditions.push('t.status = ?');
            params.push(status);
            countParams.push(status);
        }

        if (userId) {
            conditions.push('t.user_id = ?');
            params.push(userId);
            countParams.push(userId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const transactions = await db.all(query, params);
        const countResult = await db.get(countQuery, countParams);
        const total = countResult.total;

        res.json({
            success: true,
            data: {
                transactions: transactions.map(transaction => ({
                    ...transaction,
                    amount: parseFloat(transaction.amount)
                })),
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update transaction status
router.put('/transactions/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const transactionId = req.params.id;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        if (!['pending', 'completed', 'failed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Check if transaction exists
        const transaction = await db.get('SELECT * FROM transactions WHERE id = ?', [transactionId]);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Update transaction status
        await db.run(
            'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, transactionId]
        );

        res.json({
            success: true,
            message: 'Transaction status updated successfully'
        });

    } catch (error) {
        console.error('Update transaction status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get system settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get API configurations
        const apiConfigs = await db.all('SELECT * FROM api_configs WHERE is_active = 1');

        res.json({
            success: true,
            data: {
                apiConfigs
            }
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update system settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { apiConfigs } = req.body;

        if (!apiConfigs || !Array.isArray(apiConfigs)) {
            return res.status(400).json({
                success: false,
                message: 'API configurations are required'
            });
        }

        // Update API configurations
        for (const config of apiConfigs) {
            if (config.id) {
                // Update existing config
                await db.run(
                    'UPDATE api_configs SET provider_name = ?, api_key = ?, api_secret = ?, base_url = ?, is_active = ? WHERE id = ?',
                    [config.provider_name, config.api_key, config.api_secret, config.base_url, config.is_active ? 1 : 0, config.id]
                );
            } else {
                // Insert new config
                await db.run(
                    'INSERT INTO api_configs (provider_name, api_key, api_secret, base_url) VALUES (?, ?, ?, ?)',
                    [config.provider_name, config.api_key, config.api_secret, config.base_url]
                );
            }
        }

        res.json({
            success: true,
            message: 'Settings updated successfully'
        });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;